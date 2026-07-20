import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaultRuntimeRoot = path.join(repoRoot, 'data');
const runtimeRoot = path.resolve(
  process.env.PULSE_DEVELOP_WORKSPACE_ROOT
  || process.env.PULSE_RUNTIME_DATA_ROOT
  || process.env.PULSE_QUEUE_DATA_ROOT
  || defaultRuntimeRoot
);
const mapsRoot = path.join(runtimeRoot, 'data-maps');
// Repo-local data-maps directory (source of truth for seeding)
const repoMapsRoot = path.join(repoRoot, 'data', 'data-maps');

async function ensureMapSeeded(mapId) {
  const targetPath = path.join(mapsRoot, `${mapId}.map`);
  const exists = await fs.stat(targetPath).then(() => true).catch(() => false);
  if (exists) return;
  await fs.mkdir(mapsRoot, { recursive: true }).catch(() => {});
  const sourcePath = path.join(repoMapsRoot, `${mapId}.map`);
  const sourceExists = await fs.stat(sourcePath).then(() => true).catch(() => false);
  if (!sourceExists) return;
  await fs.copyFile(sourcePath, targetPath);
}

// Sample MT103 payload for testing
const SAMPLE_MT103 = {
  finEnvelope: {
    block1: 'F01BANKGB2LXXXX0000000000',
    block2: 'I103BANKUS33XXXXN',
    block4: {
      fields: {
        '20': 'TXN20260719-0001',
        '21': 'NOTPROVIDED',
        '23B': 'CRED',
        '32A': {
          components: {
            valueDate: '20260719',
            currency: 'USD',
            amount: '10000.00',
          },
        },
        '33B': {
          components: {
            currency: 'USD',
            amount: '10000.00',
          },
        },
        '50K': 'ACME CORPORATION\n123 MAIN STREET\nNEW YORK NY 10001 US',
        '52A': 'BANKGB2L',
        '57A': 'BANKUS33',
        '59': 'RECIPIENT CORP\n456 BROADWAY\nNEW YORK NY 10013 US',
        '70': 'INVOICE INV-2026-0719',
        '71A': 'OUR',
      },
    },
  },
};

function getByPath(source, dottedPath) {
  const parts = String(dottedPath || '').split('.');
  let cur = source;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function setByPath(target, dottedPath, value) {
  const parts = String(dottedPath || '').split('.');
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (cur[part] === undefined || cur[part] === null || typeof cur[part] !== 'object') {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

function normalizeRule(rule) {
  return {
    sourcePath: String(rule?.sourcePath || rule?.from || '').trim(),
    targetPath: String(rule?.targetPath || rule?.to || '').trim(),
  };
}

async function executeMap(mapId, payload) {
  await ensureMapSeeded(mapId);
  const filePath = path.join(mapsRoot, `${mapId}.map`);
  let content;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`Map not found: ${mapId}`);
    throw e;
  }

  const map = JSON.parse(content);
  const rules = (Array.isArray(map.rules) ? map.rules : []).map(normalizeRule);
  const output = {};
  const diagnostics = [];

  for (const rule of rules) {
    if (!rule.sourcePath || !rule.targetPath) continue;
    const value = getByPath(payload, rule.sourcePath);
    if (value === undefined) {
      diagnostics.push({ level: 'warning', path: rule.sourcePath, message: 'Source field not present in payload' });
      continue;
    }
    setByPath(output, rule.targetPath, value);
    diagnostics.push({ level: 'info', path: `${rule.sourcePath} -> ${rule.targetPath}`, message: 'Mapped' });
  }

  return { mapId: map.id, mapName: map.name, output, diagnostics };
}

export function registerConversionRoutes(app) {
  // Execute any map by id with a provided payload
  app.post('/api/convert', async (req, res) => {
    try {
      const { mapId, payload } = req.body || {};
      if (!mapId) return res.status(400).json({ error: 'mapId is required' });
      if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'payload object is required' });

      const result = await executeMap(mapId, payload);
      res.json(result);
    } catch (e) {
      res.status(e.message.startsWith('Map not found') ? 404 : 500).json({ error: e.message });
    }
  });

  // MT103 → PAIN.001 with provided or sample payload
  app.post('/api/convert/mt103-to-pain001', async (req, res) => {
    try {
      const payload = (req.body?.payload && typeof req.body.payload === 'object')
        ? req.body.payload
        : SAMPLE_MT103;

      const result = await executeMap('mt103-to-pain001', payload);
      res.json({
        ...result,
        usedSamplePayload: !req.body?.payload,
        input: payload,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET sample MT103 payload
  app.get('/api/convert/mt103-to-pain001/sample', (req, res) => {
    res.json({ sample: SAMPLE_MT103 });
  });

  console.log('[CONVERT] Routes registered at /api/convert*');
}
