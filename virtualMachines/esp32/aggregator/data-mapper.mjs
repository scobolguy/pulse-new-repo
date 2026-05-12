import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(express.json());

const DATA_ROOT = path.resolve('./data');
const MAPPINGS_PATH = path.join(DATA_ROOT, 'data-mappings.json');

function sanitizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-');
}

function buildMappingId(sourceTypeId, targetTypeId) {
  return `${sanitizeId(sourceTypeId)}-to-${sanitizeId(targetTypeId)}-${Date.now().toString(36)}`;
}

function normalizeMappingItem(item) {
  const sourcePath = String(item?.sourcePath || '').trim();
  const targetPath = String(item?.targetPath || '').trim();
  const kind = String(item?.kind || '').trim().toLowerCase();
  const sourceValueType = String(item?.sourceValueType || '').trim().toLowerCase() || 'unknown';
  const targetValueType = String(item?.targetValueType || '').trim().toLowerCase() || 'unknown';
  const conversionRule = String(item?.conversionRule || '').trim();

  if (!sourcePath || !targetPath) {
    throw new Error('Each mapping item requires sourcePath and targetPath');
  }
  if (kind !== 'leaf' && kind !== 'branch') {
    throw new Error(`Invalid mapping kind for ${sourcePath}: expected leaf or branch`);
  }

  return {
    sourcePath,
    targetPath,
    kind,
    sourceValueType,
    targetValueType,
    conversionRule,
  };
}

function normalizeMapping(input) {
  const sourceTypeId = sanitizeId(input?.sourceTypeId);
  const targetTypeId = sanitizeId(input?.targetTypeId);
  const sourceSchemaPath = String(input?.sourceSchemaPath || '').trim();
  const targetSchemaPath = String(input?.targetSchemaPath || '').trim();
  const name = String(input?.name || `${sourceTypeId} -> ${targetTypeId}`).trim();
  const enabled = input?.enabled !== false;

  if (!sourceTypeId || !targetTypeId) {
    throw new Error('sourceTypeId and targetTypeId are required');
  }
  if (!sourceSchemaPath || !targetSchemaPath) {
    throw new Error('sourceSchemaPath and targetSchemaPath are required');
  }

  const rawItems = Array.isArray(input?.items) ? input.items : [];
  const items = rawItems.map(normalizeMappingItem);
  if (items.length === 0) {
    throw new Error('At least one mapping item is required');
  }

  return {
    id: sanitizeId(input?.id) || buildMappingId(sourceTypeId, targetTypeId),
    name,
    sourceTypeId,
    targetTypeId,
    sourceSchemaPath,
    targetSchemaPath,
    enabled,
    items,
    updatedAt: new Date().toISOString(),
  };
}

async function loadMappings() {
  try {
    const content = await fs.readFile(MAPPINGS_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveMappings(mappings) {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  await fs.writeFile(MAPPINGS_PATH, JSON.stringify(mappings, null, 2));
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'data-mapper' });
});

app.get('/api/mapper/mappings', async (req, res) => {
  try {
    const mappings = await loadMappings();
    res.json({ mappings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/mapper/mappings', async (req, res) => {
  try {
    const normalized = normalizeMapping(req.body || {});
    const mappings = await loadMappings();
    const index = mappings.findIndex(m => m.id === normalized.id);
    const existing = index >= 0 ? mappings[index] : null;

    const next = {
      ...normalized,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      mappings[index] = next;
    } else {
      mappings.push(next);
    }

    await saveMappings(mappings);
    res.json({ status: index >= 0 ? 'updated' : 'created', mapping: next });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/mapper/mappings/:id', async (req, res) => {
  try {
    const id = sanitizeId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id is required' });

    const mappings = await loadMappings();
    const next = mappings.filter(m => sanitizeId(m.id) !== id);
    if (next.length === mappings.length) {
      return res.status(404).json({ error: `Mapping not found: ${id}` });
    }

    await saveMappings(next);
    res.json({ status: 'deleted', id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.MAPPER_PORT || 4200;
app.listen(PORT, () => {
  console.log(`[Mapper] Service running on http://localhost:${PORT}`);
});
