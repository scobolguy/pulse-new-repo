import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaultRuntimeRoot = path.resolve(
  process.env.PULSE_OPERATIONAL_DATA_ROOT
  || (process.platform === 'win32' ? 'c:/dev/pulse-operational-data' : '/opt/pulse/operational-data')
);
const runtimeRoot = path.resolve(
  process.env.PULSE_DEVELOP_WORKSPACE_ROOT
  || process.env.PULSE_RUNTIME_DATA_ROOT
  || process.env.PULSE_QUEUE_DATA_ROOT
  || defaultRuntimeRoot
);

const transformerCatalogPath = path.join(runtimeRoot, 'services', 'transformers', 'transformers.json');
const mapperRulesetsPath = path.join(runtimeRoot, 'services', 'librarian', 'mapper-rulesets.json');
const mapperInventoryPath = path.join(runtimeRoot, 'mapper-authoring-inventory.json');

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeToken(value) {
  return String(value || '').trim();
}

function normalizeMappingRules(value, fallback = '') {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).join(', ');
  }
  if (value && typeof value === 'object') {
    const id = normalizeToken(value.id || value.ref || value.name);
    if (id) return id;
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeTriplet(entry, index = 0) {
  const incomingMessageType = normalizeToken(
    entry?.incomingMessageType
    || entry?.incoming
    || entry?.inputSchema
    || entry?.sourceTypeId
    || entry?.source
  );
  const outgoingMessageType = normalizeToken(
    entry?.outgoingMessageType
    || entry?.outgoing
    || entry?.outputSchema
    || entry?.targetTypeId
    || entry?.target
  );
  const mappingRules = normalizeMappingRules(
    entry?.mappingRules
    || entry?.ruleset
    || entry?.rulesetId
    || entry?.ruleRef
    || entry?.mapId,
    ''
  );
  const id = normalizeToken(entry?.id || `${incomingMessageType || '*'}::${outgoingMessageType || '*'}::${index + 1}`);

  if (!incomingMessageType && !outgoingMessageType && !mappingRules) return null;

  return {
    id,
    incomingMessageType: incomingMessageType || '*',
    outgoingMessageType: outgoingMessageType || '*',
    mappingRules: mappingRules || 'UNSPECIFIED',
  };
}

function normalizeTransformerEntry(entry, index = 0) {
  const name = normalizeToken(entry?.name || entry?.transformerName || entry?.id || `transformer-${index + 1}`);
  const triplets = asArray(entry?.triplets)
    .map((triplet, tripletIndex) => normalizeTriplet(triplet, tripletIndex))
    .filter(Boolean);
  if (!name) return null;
  return {
    name,
    triplets,
  };
}

function pushTriplet(transformersByName, transformerName, triplet) {
  const normalizedName = normalizeToken(transformerName);
  if (!normalizedName || !triplet) return;
  const existing = transformersByName.get(normalizedName) || { name: normalizedName, triplets: [] };
  const duplicate = existing.triplets.some((candidate) =>
    candidate.incomingMessageType === triplet.incomingMessageType
    && candidate.outgoingMessageType === triplet.outgoingMessageType
    && candidate.mappingRules === triplet.mappingRules
  );
  if (!duplicate) {
    existing.triplets.push(triplet);
  }
  transformersByName.set(normalizedName, existing);
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function loadExplicitCatalog() {
  const payload = await readJson(transformerCatalogPath, null);
  if (!payload) return [];
  const rawTransformers = asArray(payload?.transformers || payload);
  return rawTransformers
    .map((entry, index) => normalizeTransformerEntry(entry, index))
    .filter(Boolean);
}

async function synthesizeCatalogFromMapperAssets() {
  const [rulesetsPayload, inventoryPayload] = await Promise.all([
    readJson(mapperRulesetsPath, []),
    readJson(mapperInventoryPath, { mappers: [] }),
  ]);

  const transformersByName = new Map();

  const rulesets = asArray(rulesetsPayload);
  for (const ruleset of rulesets) {
    const sourcePatterns = asArray(ruleset?.sourcePatterns).map((item) => normalizeToken(item)).filter(Boolean);
    const targetPatterns = asArray(ruleset?.targetPatterns).map((item) => normalizeToken(item)).filter(Boolean);
    const sourceCandidates = sourcePatterns.length ? sourcePatterns : ['*'];
    const targetCandidates = targetPatterns.length ? targetPatterns : ['*'];
    for (const incomingMessageType of sourceCandidates) {
      for (const outgoingMessageType of targetCandidates) {
        pushTriplet(transformersByName, 'librarian-rulesets', {
          id: normalizeToken(ruleset?.id || `${incomingMessageType}::${outgoingMessageType}`),
          incomingMessageType,
          outgoingMessageType,
          mappingRules: normalizeToken(ruleset?.id || ruleset?.label || 'UNSPECIFIED'),
        });
      }
    }
  }

  const mappers = asArray(inventoryPayload?.mappers);
  for (const mapper of mappers) {
    const mapId = normalizeToken(mapper?.mapId);
    if (!mapId) continue;
    pushTriplet(transformersByName, mapId, {
      id: mapId,
      incomingMessageType: normalizeToken(mapper?.sourceTypeId) || '*',
      outgoingMessageType: normalizeToken(mapper?.targetTypeId) || '*',
      mappingRules: mapId,
    });
  }

  return Array.from(transformersByName.values())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({
      ...entry,
      triplets: entry.triplets.sort((left, right) => {
        const inCmp = left.incomingMessageType.localeCompare(right.incomingMessageType);
        if (inCmp !== 0) return inCmp;
        const outCmp = left.outgoingMessageType.localeCompare(right.outgoingMessageType);
        if (outCmp !== 0) return outCmp;
        return left.mappingRules.localeCompare(right.mappingRules);
      }),
    }));
}

async function loadTransformerCatalog() {
  const explicit = await loadExplicitCatalog();
  if (explicit.length > 0) return explicit;
  return synthesizeCatalogFromMapperAssets();
}

export async function registerTransformerServiceRoutes(app) {
  app.get('/api/transformers', async (req, res) => {
    try {
      const transformers = await loadTransformerCatalog();
      return res.json({
        count: transformers.length,
        transformers,
        runtimeRoot,
        source: transformers.length > 0 ? 'catalog' : 'empty',
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.get('/api/transformers/:transformerName', async (req, res) => {
    try {
      const transformerName = normalizeToken(req.params.transformerName);
      const transformers = await loadTransformerCatalog();
      const transformer = transformers.find((entry) => entry.name === transformerName);
      if (!transformer) {
        return res.status(404).json({ error: 'Transformer not found', transformerName });
      }
      return res.json({ transformer });
    } catch (error) {
      return res.status(500).json({ error: error?.message || String(error) });
    }
  });
}
