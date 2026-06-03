import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaultRuntimeRoot = path.join(repoRoot, 'data');
const runtimeRoot = path.resolve(
  process.env.PULSE_DEVELOP_WORKSPACE_ROOT
  || process.env.PULSE_RUNTIME_DATA_ROOT
  || process.env.PULSE_QUEUE_DATA_ROOT
  || defaultRuntimeRoot
);
const mapsRoot = path.join(runtimeRoot, 'data-maps');

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
}
