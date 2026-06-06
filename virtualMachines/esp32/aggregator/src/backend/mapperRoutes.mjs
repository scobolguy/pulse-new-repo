import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { runPL0 } from '../../scripts/pl0-interpreter.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaultRuntimeRoot = path.join(repoRoot, 'data');
const runtimeRoot = path.resolve(
  process.env.PULSE_DEVELOP_WORKSPACE_ROOT
  || process.env.PULSE_RUNTIME_DATA_ROOT
  || process.env.PULSE_QUEUE_DATA_ROOT
  || defaultRuntimeRoot
);
const mapsRoot = path.join(runtimeRoot, 'data-maps');
const issueTestStorePath = path.join(runtimeRoot, 'issue-test-system.json');

function normalizePath(value) {
  return String(value || '').trim().replaceAll('\\', '/').replace(/^\/+/, '');
}

function isInsideRoot(candidatePath, rootPath) {
  return path.resolve(candidatePath).startsWith(path.resolve(rootPath));
}

function safeSchemaPath(rawPath) {
  const normalized = normalizePath(rawPath);
  if (!normalized || normalized.includes('..')) {
    throw new Error('Invalid schema path');
  }
  const resolved = path.resolve(runtimeRoot, normalized);
  if (!isInsideRoot(resolved, runtimeRoot)) {
    throw new Error('Invalid schema path');
  }
  return resolved;
}

async function readJsonFile(filePath, fallback = null) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function flattenStructure(node, prefix = '') {
  if (!node || typeof node !== 'object') return [];
  const children = Array.isArray(node.children) ? node.children : [];
  const out = [];
  for (const child of children) {
    const name = String(child?.name || '').trim();
    if (!name) continue;
    const nextPath = prefix ? `${prefix}.${name}` : name;
    out.push({
      path: nextPath,
      kind: String(child?.kind || 'leaf').toLowerCase() === 'branch' ? 'branch' : 'leaf',
      valueType: String(child?.valueType || 'unknown').toLowerCase(),
      required: child?.required === true,
    });
    out.push(...flattenStructure(child, nextPath));
  }
  return out;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const out = {};
  for (const key of keys) {
    out[key] = sortObject(value[key]);
  }
  return out;
}

function structureSignature(structure) {
  const flat = flattenStructure(structure);
  const normalized = flat
    .map((node) => ({
      path: node.path,
      kind: node.kind,
      valueType: node.valueType,
      required: node.required,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return JSON.stringify(sortObject(normalized));
}

function nodeMapByPath(structure) {
  const map = new Map();
  for (const item of flattenStructure(structure)) {
    map.set(String(item.path || ''), item);
  }
  return map;
}

function getByPath(source, dottedPath) {
  const parts = String(dottedPath || '').split('.').map(part => part.trim()).filter(Boolean);
  let cursor = source;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object' || !(part in cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function setByPath(target, dottedPath, value) {
  const parts = String(dottedPath || '').split('.').map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return;
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function getRelativePath(fullPath, parentPath) {
  const full = String(fullPath || '');
  const parent = String(parentPath || '');
  if (!parent) return full;
  const prefix = `${parent}.`;
  return full.startsWith(prefix) ? full.slice(prefix.length) : full;
}

function isShapeEquivalentNode(sourceNode, targetNode, sourceChildrenByParent, targetChildrenByParent) {
  if (!sourceNode || !targetNode) return false;
  const sourceChildren = sourceChildrenByParent.get(String(sourceNode.path || '')) || [];
  const targetChildren = targetChildrenByParent.get(String(targetNode.path || '')) || [];
  if (sourceChildren.length !== targetChildren.length) return false;

  const sourceLeaf = sourceChildren.length === 0;
  const targetLeaf = targetChildren.length === 0;
  if (sourceLeaf !== targetLeaf) return false;
  if (sourceLeaf && targetLeaf) {
    const sourceType = String(sourceNode.valueType || 'unknown').toLowerCase();
    const targetType = String(targetNode.valueType || 'unknown').toLowerCase();
    return sourceType === targetType || sourceType === 'unknown' || targetType === 'unknown';
  }

  const sourceByName = new Map(sourceChildren.map((child) => [String(child.path || '').split('.').pop(), child]));
  const targetByName = new Map(targetChildren.map((child) => [String(child.path || '').split('.').pop(), child]));
  if (sourceByName.size !== targetByName.size) return false;

  for (const [name, sourceChild] of sourceByName.entries()) {
    const targetChild = targetByName.get(name);
    if (!targetChild) return false;
    if (!isShapeEquivalentNode(sourceChild, targetChild, sourceChildrenByParent, targetChildrenByParent)) {
      return false;
    }
  }

  return true;
}

function buildChildrenByParent(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const pathValue = String(node.path || '');
    const idx = pathValue.lastIndexOf('.');
    const parent = idx >= 0 ? pathValue.slice(0, idx) : '';
    const list = map.get(parent) || [];
    list.push(node);
    map.set(parent, list);
  }
  return map;
}

function expandShapeMappings(sourceNode, targetNode, sourceChildrenByParent, targetChildrenByParent) {
  const sourceChildren = sourceChildrenByParent.get(String(sourceNode.path || '')) || [];
  const targetChildren = targetChildrenByParent.get(String(targetNode.path || '')) || [];
  if (sourceChildren.length === 0 && targetChildren.length === 0) {
    return [{ sourcePath: sourceNode.path, targetPath: targetNode.path, kind: 'leaf' }];
  }

  const out = [];
  const sourceByName = new Map(sourceChildren.map((child) => [String(child.path || '').split('.').pop(), child]));
  const targetByName = new Map(targetChildren.map((child) => [String(child.path || '').split('.').pop(), child]));

  for (const [name, sourceChild] of sourceByName.entries()) {
    const targetChild = targetByName.get(name);
    if (!targetChild) continue;
    out.push(...expandShapeMappings(sourceChild, targetChild, sourceChildrenByParent, targetChildrenByParent));
  }

  return out;
}

function buildSyntheticPayloadFromNodes(nodes) {
  const payload = {};
  for (const node of nodes) {
    if (String(node.kind || '').toLowerCase() === 'branch') continue;
    const leafName = String(node.path || '').split('.').pop() || 'value';
    const sample = node.valueType && String(node.valueType).toLowerCase().includes('number')
      ? 0
      : `${leafName}-sample`;
    setByPath(payload, node.path, sample);
  }
  return payload;
}

async function currentSchemaMtime(schemaPath) {
  const absolute = safeSchemaPath(schemaPath);
  const stat = await fs.stat(absolute);
  return stat.mtime.toISOString();
}

function normalizeRuleForRuntime(rule) {
  const sourcePath = String(rule?.sourcePath || rule?.from || '').trim();
  const targetPath = String(rule?.targetPath || rule?.to || '').trim();
  return {
    sourcePath,
    targetPath,
    kind: String(rule?.kind || 'leaf').toLowerCase() === 'branch' ? 'branch' : 'leaf',
    sourceValueType: String(rule?.sourceValueType || 'unknown').toLowerCase(),
    targetValueType: String(rule?.targetValueType || 'unknown').toLowerCase(),
    conversionRule: String(rule?.conversionRule || rule?.conversion || '').trim(),
  };
}

function resolveMapFile(fileName) {
  const normalized = String(fileName || '').trim().replace(/[\\/]+/g, '_');
  if (!normalized || normalized.includes('..') || !normalized.endsWith('.map')) {
    throw new Error('Invalid map file name');
  }
  const resolved = path.resolve(mapsRoot, normalized);
  if (!resolved.startsWith(path.resolve(mapsRoot))) {
    throw new Error('Invalid map file path');
  }
  return resolved;
}

async function ensureMapsDirectory() {
  await fs.mkdir(mapsRoot, { recursive: true });
}

async function seedLegacyMapIfMissing(fileName) {
  const targetPath = path.join(mapsRoot, fileName);
  const exists = await fs.stat(targetPath).then(() => true).catch(() => false);
  if (exists) return;

  const sourcePath = path.join(repoRoot, fileName);
  const sourceExists = await fs.stat(sourcePath).then(() => true).catch(() => false);
  if (!sourceExists) return;

  await fs.copyFile(sourcePath, targetPath);
}

async function seedLegacyMaps() {
  await ensureMapsDirectory();
  await Promise.all([
    seedLegacyMapIfMissing('mt103-to-pacs.map'),
    seedLegacyMapIfMissing('mt202-to-pacs.map')
  ]);
}

function createDefaultMap(id, name) {
  return {
    id,
    name,
    description: '',
    version: '1.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: [],
    submaps: []
  };
}

export function registerMapperRoutes(app) {
  // List all maps
  app.get('/api/mapper/maps', async (req, res) => {
    try {
      await seedLegacyMaps();
      const entries = await fs.readdir(mapsRoot).catch(() => []);
      const maps = [];
      for (const entry of entries) {
        if (!entry.endsWith('.map')) continue;
        try {
          const filePath = path.join(mapsRoot, entry);
          const content = await fs.readFile(filePath, 'utf-8');
          const map = JSON.parse(content);
          maps.push({
            id: map.id,
            name: map.name,
            description: map.description,
            version: map.version,
            createdAt: map.createdAt,
            updatedAt: map.updatedAt,
            ruleCount: Array.isArray(map.rules) ? map.rules.length : 0,
            submapCount: Array.isArray(map.submaps) ? map.submaps.length : 0,
            fileName: entry
          });
        } catch {
          // Skip malformed files
        }
      }
      res.json({ maps: maps.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get specific map
  app.get('/api/mapper/maps/:id', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);
      res.json({ map });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/mapper/test-cases', async (req, res) => {
    try {
      const store = await readJsonFile(issueTestStorePath, {});
      const testCases = Array.isArray(store?.testCases) ? store.testCases : [];
      res.json({
        testCases: testCases.map((testCase) => ({
          id: String(testCase?.id || ''),
          name: String(testCase?.name || ''),
          testType: String(testCase?.testType || 'generic').toLowerCase(),
          description: String(testCase?.description || '')
        })).filter((testCase) => testCase.id)
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create new map
  app.post('/api/mapper/maps', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id, name, description } = req.body;
      if (!id || !name) {
        return res.status(400).json({ error: 'id and name are required' });
      }
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const stat = await fs.stat(filePath).catch(() => null);
      if (stat) {
        return res.status(409).json({ error: 'Map already exists' });
      }
      const newMap = createDefaultMap(id, name);
      if (description) {
        newMap.description = description;
      }
      if (req.body?.sourceTypeId) newMap.sourceTypeId = String(req.body.sourceTypeId).toLowerCase();
      if (req.body?.targetTypeId) newMap.targetTypeId = String(req.body.targetTypeId).toLowerCase();
      if (req.body?.sourceSchemaPath) newMap.sourceSchemaPath = String(req.body.sourceSchemaPath);
      if (req.body?.targetSchemaPath) newMap.targetSchemaPath = String(req.body.targetSchemaPath);
      if (req.body?.sourceSchemaMtime) newMap.sourceSchemaMtime = String(req.body.sourceSchemaMtime);
      if (req.body?.targetSchemaMtime) newMap.targetSchemaMtime = String(req.body.targetSchemaMtime);
      if (req.body?.sourceStructure && typeof req.body.sourceStructure === 'object') {
        newMap.sourceStructure = req.body.sourceStructure;
        newMap.sourceShapeSignature = structureSignature(req.body.sourceStructure);
      }
      if (req.body?.targetStructure && typeof req.body.targetStructure === 'object') {
        newMap.targetStructure = req.body.targetStructure;
        newMap.targetShapeSignature = structureSignature(req.body.targetStructure);
      }
      if (Array.isArray(req.body?.rules)) {
        newMap.rules = req.body.rules;
      }
      await fs.writeFile(filePath, JSON.stringify(newMap, null, 2), 'utf-8');
      res.status(201).json({ map: newMap });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update map
  app.put('/api/mapper/maps/:id', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const { name, description, rules, submaps } = req.body;
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);
      if (name) map.name = name;
      if (description !== undefined) map.description = description;
      if (Array.isArray(rules)) map.rules = rules;
      if (Array.isArray(submaps)) map.submaps = submaps;
      if (req.body?.sourceTypeId) map.sourceTypeId = String(req.body.sourceTypeId).toLowerCase();
      if (req.body?.targetTypeId) map.targetTypeId = String(req.body.targetTypeId).toLowerCase();
      if (req.body?.sourceSchemaPath) map.sourceSchemaPath = String(req.body.sourceSchemaPath);
      if (req.body?.targetSchemaPath) map.targetSchemaPath = String(req.body.targetSchemaPath);
      if (req.body?.sourceSchemaMtime) map.sourceSchemaMtime = String(req.body.sourceSchemaMtime);
      if (req.body?.targetSchemaMtime) map.targetSchemaMtime = String(req.body.targetSchemaMtime);
      if (req.body?.sourceStructure && typeof req.body.sourceStructure === 'object') {
        map.sourceStructure = req.body.sourceStructure;
        map.sourceShapeSignature = structureSignature(req.body.sourceStructure);
      }
      if (req.body?.targetStructure && typeof req.body.targetStructure === 'object') {
        map.targetStructure = req.body.targetStructure;
        map.targetShapeSignature = structureSignature(req.body.targetStructure);
      }
      map.updatedAt = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(map, null, 2), 'utf-8');
      res.json({ map });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Delete map
  app.delete('/api/mapper/maps/:id', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Rename map (creates new file, deletes old)
  app.post('/api/mapper/maps/:id/rename', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const { newId } = req.body;
      if (!newId) {
        return res.status(400).json({ error: 'newId is required' });
      }
      const oldFileName = `${id}.map`;
      const newFileName = `${newId}.map`;
      const oldFilePath = resolveMapFile(oldFileName);
      const newFilePath = resolveMapFile(newFileName);
      const content = await fs.readFile(oldFilePath, 'utf-8');
      const map = JSON.parse(content);
      map.id = newId;
      map.updatedAt = new Date().toISOString();
      await fs.writeFile(newFilePath, JSON.stringify(map, null, 2), 'utf-8');
      await fs.unlink(oldFilePath);
      res.json({ map });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Import CSV → map rules
  app.post('/api/mapper/maps/:id/import-csv', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const { csvContent } = req.body;
      if (!csvContent) {
        return res.status(400).json({ error: 'csvContent is required' });
      }

      const lines = String(csvContent).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV must have header row and at least one data row' });
      }

      const header = lines[0].split(',').map(h => h.trim().toUpperCase());
      const fromIdx = header.indexOf('FROM');
      const toIdx = header.indexOf('TO');
      const descIdx = header.indexOf('DESCRIPTION');

      if (fromIdx < 0 || toIdx < 0) {
        return res.status(400).json({ error: 'CSV must contain FROM and TO columns' });
      }

      const rules = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        const from = parts[fromIdx] || '';
        const to = parts[toIdx] || '';
        const desc = descIdx >= 0 ? parts[descIdx] || '' : '';

        if (!from || !to) continue;

        // Generate Pascalish conversion: simple assignment if no special logic
        let conversion = `output := src;`;
        if (desc && desc.toLowerCase().includes('trim')) {
          conversion = `output := trim(src);`;
        } else if (desc && desc.toLowerCase().includes('upper')) {
          conversion = `output := upcase(src);`;
        } else if (desc && desc.toLowerCase().includes('lower')) {
          conversion = `output := downcase(src);`;
        }

        rules.push({
          id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          from,
          to,
          description: desc,
          conversion
        });
      }

      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);
      map.rules.push(...rules);
      map.updatedAt = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(map, null, 2), 'utf-8');

      res.json({ rulesAdded: rules.length, map });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Export map to Excel (returns CSV for now, can enhance to .xlsx)
  app.get('/api/mapper/maps/:id/export-csv', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);

      // Build CSV
      const lines = ['FROM,TO,DESCRIPTION,CONVERSION'];
      for (const rule of map.rules) {
        const from = String(rule.from || '').replaceAll('"', '""');
        const to = String(rule.to || '').replaceAll('"', '""');
        const desc = String(rule.description || '').replaceAll('"', '""');
        const conversion = String(rule.conversion || '').replaceAll('"', '""');
        lines.push(`"${from}","${to}","${desc}","${conversion}"`);
      }

      const csv = lines.join('\n');
      res.set('content-type', 'text/csv');
      res.set('content-disposition', `attachment; filename="${id}.csv"`);
      res.send(csv);
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/mapper/maps/:id/export-excel', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);

      const metadataRows = [
        ['Field', 'Value'],
        ['id', map.id || id],
        ['name', map.name || ''],
        ['description', map.description || ''],
        ['version', map.version || ''],
        ['createdAt', map.createdAt || ''],
        ['updatedAt', map.updatedAt || '']
      ];

      const rulesRows = [
        ['ID', 'FROM', 'TO', 'DESCRIPTION', 'CONVERSION']
      ];
      for (const rule of Array.isArray(map.rules) ? map.rules : []) {
        rulesRows.push([
          String(rule.id || ''),
          String(rule.from || ''),
          String(rule.to || ''),
          String(rule.description || ''),
          String(rule.conversion || '')
        ]);
      }

      const submapRows = [
        ['ID', 'Name', 'Description']
      ];
      for (const submap of Array.isArray(map.submaps) ? map.submaps : []) {
        submapRows.push([
          String(submap.id || ''),
          String(submap.name || ''),
          String(submap.description || '')
        ]);
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(metadataRows), 'Map');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rulesRows), 'Rules');
      if (submapRows.length > 1) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(submapRows), 'Submaps');
      }

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      res.set('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('content-disposition', `attachment; filename="${id}.xlsx"`);
      res.send(buffer);
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/mapper/maps/:id/auto-shape-map', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const { sourcePath, targetPath } = req.body || {};
      if (!sourcePath || !targetPath) {
        return res.status(400).json({ error: 'sourcePath and targetPath are required' });
      }

      const filePath = resolveMapFile(`${id}.map`);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);
      if (!map?.sourceStructure || !map?.targetStructure) {
        return res.status(409).json({ error: 'Map schema snapshot missing. Re-open map and save before using shape-aware mapping.' });
      }

      const sourceNodes = flattenStructure(map.sourceStructure);
      const targetNodes = flattenStructure(map.targetStructure);
      const sourceByPath = nodeMapByPath(map.sourceStructure);
      const targetByPath = nodeMapByPath(map.targetStructure);
      const sourceChildrenByParent = buildChildrenByParent(sourceNodes);
      const targetChildrenByParent = buildChildrenByParent(targetNodes);
      const sourceNode = sourceByPath.get(String(sourcePath));
      const targetNode = targetByPath.get(String(targetPath));

      if (!sourceNode || !targetNode) {
        return res.status(400).json({ error: 'Selected source/target paths were not found in schema snapshots.' });
      }
      if (!isShapeEquivalentNode(sourceNode, targetNode, sourceChildrenByParent, targetChildrenByParent)) {
        return res.status(409).json({ error: 'Selected branches are not structurally equivalent.' });
      }

      const expanded = expandShapeMappings(sourceNode, targetNode, sourceChildrenByParent, targetChildrenByParent);
      const nextRules = Array.isArray(map.rules) ? [...map.rules] : [];
      const existingKeys = new Set(nextRules.map((rule) => {
        const normalized = normalizeRuleForRuntime(rule);
        return `${normalized.sourcePath}=>${normalized.targetPath}`;
      }));

      let added = 0;
      for (const pair of expanded) {
        const key = `${pair.sourcePath}=>${pair.targetPath}`;
        if (existingKeys.has(key)) continue;
        nextRules.push({
          id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          sourcePath: pair.sourcePath,
          targetPath: pair.targetPath,
          kind: 'leaf',
          sourceValueType: 'unknown',
          targetValueType: 'unknown',
          conversionRule: '',
        });
        existingKeys.add(key);
        added += 1;
      }

      map.rules = nextRules;
      map.updatedAt = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(map, null, 2), 'utf-8');

      res.json({ added, map });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/mapper/maps/:id/run', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const filePath = resolveMapFile(`${id}.map`);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);

      if (map?.sourceSchemaPath && map?.sourceSchemaMtime) {
        const mtime = await currentSchemaMtime(map.sourceSchemaPath).catch(() => null);
        if (mtime && String(mtime) !== String(map.sourceSchemaMtime)) {
          return res.status(409).json({ error: 'Source schema changed since this map was saved. Refresh before running.' });
        }
      }
      if (map?.targetSchemaPath && map?.targetSchemaMtime) {
        const mtime = await currentSchemaMtime(map.targetSchemaPath).catch(() => null);
        if (mtime && String(mtime) !== String(map.targetSchemaMtime)) {
          return res.status(409).json({ error: 'Target schema changed since this map was saved. Refresh before running.' });
        }
      }

      let payload = req.body?.payload;
      const testCaseId = String(req.body?.testCaseId || '').trim();
      if (!payload && testCaseId) {
        const store = await readJsonFile(issueTestStorePath, {});
        const testCases = Array.isArray(store?.testCases) ? store.testCases : [];
        const testCase = testCases.find((item) => String(item?.id || '') === testCaseId);
        if (!testCase) {
          return res.status(404).json({ error: `Unknown test case: ${testCaseId}` });
        }
        const sourceNodes = flattenStructure(map?.sourceStructure);
        payload = buildSyntheticPayloadFromNodes(sourceNodes);
      }

      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({ error: 'payload object or testCaseId is required' });
      }

      const rules = (Array.isArray(map.rules) ? map.rules : []).map(normalizeRuleForRuntime);
      const sourceByPath = nodeMapByPath(map?.sourceStructure || null);
      const targetByPath = nodeMapByPath(map?.targetStructure || null);
      const output = {};
      const diagnostics = [];

      for (const rule of rules) {
        if (!rule.sourcePath || !rule.targetPath) continue;
        const sourceValue = getByPath(payload, rule.sourcePath);
        if (sourceValue === undefined) {
          diagnostics.push({ level: 'warning', rule: `${rule.sourcePath} -> ${rule.targetPath}`, message: 'Source field not present in payload' });
          continue;
        }

        let value = sourceValue;
        if (rule.conversionRule) {
          const vars = runPL0(rule.conversionRule, { src: sourceValue, output: sourceValue });
          value = vars && Object.prototype.hasOwnProperty.call(vars, 'output') ? vars.output : sourceValue;
          diagnostics.push({ level: 'info', rule: `${rule.sourcePath} -> ${rule.targetPath}`, message: 'Pascalish routine applied' });
        } else {
          const sourceNode = sourceByPath.get(rule.sourcePath);
          const targetNode = targetByPath.get(rule.targetPath);
          if (sourceNode && targetNode) {
            const sourceType = String(sourceNode.valueType || 'unknown').toLowerCase();
            const targetType = String(targetNode.valueType || 'unknown').toLowerCase();
            if (sourceType !== targetType && sourceType !== 'unknown' && targetType !== 'unknown') {
              return res.status(409).json({
                error: `Non-standard move ${rule.sourcePath} -> ${rule.targetPath} requires a Pascalish routine.`
              });
            }
          }
        }

        setByPath(output, rule.targetPath, value);
      }

      res.json({
        mapId: map.id,
        input: payload,
        output,
        diagnostics,
      });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(400).json({ error: e.message });
    }
  });
}
