import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { readEnvNumber } from './src/env-config.mjs';
import { registerMapperRoutes } from './src/backend/mapperRoutes.mjs';

const app = express();
app.use(express.json());
registerMapperRoutes(app);

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

function validateConversionRule(ruleText) {
  const text = String(ruleText || '').trim();
  if (!text) return { valid: true };
  if (text.length > 1000) return { valid: false, error: 'conversionRule is too long (max 1000 chars)' };

  // Allow PL/0 syntax with extended character set including:
  // - Alphanumerics and underscore for identifiers
  // - Operators: := + - * / || = < > <= >= <>
  // - Delimiters: ( ) [ ] { } , ; : 
  // - String literals: "..." '...'
  // - Comments: // ...
  // - PL/0 keywords: if then else while do for to begin end var call not
  if (!/^[\w\s\.,()'"\[\]{};:\-+*/%<>=!|&?#@\\~`]+$/.test(text)) {
    return { valid: false, error: 'conversionRule contains unsupported characters' };
  }

  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') parenDepth += 1;
    if (ch === ')') parenDepth -= 1;
    if (ch === '[') bracketDepth += 1;
    if (ch === ']') bracketDepth -= 1;
    if (ch === '{') braceDepth += 1;
    if (ch === '}') braceDepth -= 1;
    if (parenDepth < 0 || bracketDepth < 0 || braceDepth < 0) {
      return { valid: false, error: 'conversionRule has unbalanced delimiters' };
    }
  }

  if (quote || parenDepth !== 0 || bracketDepth !== 0 || braceDepth !== 0) {
    return { valid: false, error: 'conversionRule has unbalanced quotes or delimiters' };
  }

  // PL/0 validation: basic sanity check
  // Accept statements like "output := trim(src);" or more complex PL/0 code
  const hasAssignment = text.includes(':=') || text.match(/[A-Za-z_]\w*\s*=\s*/);
  const hasFunctionCall = /[A-Za-z_]\w*\s*\(/.test(text);
  const hasKeyword = /\b(if|then|else|while|do|for|to|begin|end|var|call|not)\b/i.test(text);
  
  if (!hasAssignment && !hasFunctionCall && !hasKeyword) {
    return { valid: false, error: 'conversionRule must contain an assignment, function call, or PL/0 keyword' };
  }

  return { valid: true };
}

function normalizeMappingItem(item) {
  const sourcePath = String(item?.sourcePath || '').trim();
  const targetPath = String(item?.targetPath || '').trim();
  const kind = String(item?.kind || '').trim().toLowerCase();
  const sourceValueType = String(item?.sourceValueType || '').trim().toLowerCase() || 'unknown';
  const targetValueType = String(item?.targetValueType || '').trim().toLowerCase() || 'unknown';
  const conversionRule = String(item?.conversionRule || '').trim();
  const conversionRuleValidation = validateConversionRule(conversionRule);

  if (!sourcePath || !targetPath) {
    throw new Error('Each mapping item requires sourcePath and targetPath');
  }
  if (kind !== 'leaf' && kind !== 'branch') {
    throw new Error(`Invalid mapping kind for ${sourcePath}: expected leaf or branch`);
  }
  if (!conversionRuleValidation.valid) {
    throw new Error(`Invalid conversionRule for ${sourcePath} -> ${targetPath}: ${conversionRuleValidation.error}`);
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

const PORT = readEnvNumber('MAPPER_PORT', 4200);
app.listen(PORT, () => {
  console.log(`[Mapper] Service running on http://localhost:${PORT}`);
});
