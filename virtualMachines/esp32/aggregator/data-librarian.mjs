import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(express.json());

// Config: where to look for data files and schemas
const DATA_ROOT = path.resolve('./data');
const SCHEMA_ROOT = path.join(DATA_ROOT, 'schemas');

// Utility: Recursively list files with metadata, with optional filter
async function listFiles(dir, relBase = '', filter = null) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(relBase, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await listFiles(fullPath, relPath, filter));
    } else {
      if (filter && !filter(entry, relPath, fullPath)) continue;
      const stat = await fs.stat(fullPath);
      results.push({
        name: entry.name,
        path: relPath.replace(/\\/g, '/'),
        size: stat.size,
        mtime: stat.mtime,
        ctime: stat.ctime,
        ext: path.extname(entry.name).slice(1),
        fullPath,
      });
    }
  }
  return results;
}

// Utility: Parse schema file name for metadata (type, name, version)
function parseSchemaFilename(filename) {
  // Example: order.v1.xsd, customer.v2.avro, payment.json-schema, legacy.copybook
  const match = filename.match(/^([\w-]+)(?:\.v(\d+))?\.(xsd|avro|json-schema|copybook|sql|proto|csv|xml|json)$/i);
  if (!match) return null;
  return {
    name: match[1],
    version: match[2] ? parseInt(match[2], 10) : null,
    type: match[3].toLowerCase(),
  };
}

// List all files
app.get('/api/librarian/files', async (req, res) => {
  try {
    const files = await listFiles(DATA_ROOT);
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Search files by name or extension
app.get('/api/librarian/search', async (req, res) => {
  const { q = '', ext = '' } = req.query;
  try {
    let files = await listFiles(DATA_ROOT);
    if (q) files = files.filter(f => f.name.toLowerCase().includes(q.toLowerCase()));
    if (ext) files = files.filter(f => f.ext === ext.replace(/^\./, ''));
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download a file — use app.use so the path after /file/ is captured in req.path
app.use('/api/librarian/file', async (req, res) => {
  const relPath = req.path.replace(/^\//, '');
  if (!relPath) return res.status(400).json({ error: 'No file path specified' });
  const absPath = path.resolve(DATA_ROOT, relPath);
  // Security: ensure the resolved path is under DATA_ROOT
  if (!absPath.startsWith(path.resolve(DATA_ROOT))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    await fs.access(absPath);
    res.sendFile(absPath);
  } catch (e) {
    res.status(404).json({ error: 'File not found' });
  }
});


// List all schemas with metadata
app.get('/api/librarian/schemas', async (req, res) => {
  try {
    const files = await listFiles(SCHEMA_ROOT);
    const schemas = files
      .map(f => {
        const meta = parseSchemaFilename(f.name);
        if (!meta) return null;
        return {
          ...meta,
          path: f.path,
          size: f.size,
          mtime: f.mtime,
        };
      })
      .filter(Boolean);
    res.json({ schemas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Lookup schema by type/name (version is optional query param: ?version=1)
app.get('/api/librarian/schema/:type/:name', async (req, res) => {
  const { type, name } = req.params;
  const version = req.query.version ? parseInt(req.query.version, 10) : null;
  try {
    const files = await listFiles(SCHEMA_ROOT, '', (entry, relPath) => {
      const meta = parseSchemaFilename(entry.name);
      if (!meta) return false;
      if (meta.type !== type.toLowerCase()) return false;
      if (meta.name !== name) return false;
      if (version && meta.version !== parseInt(version, 10)) return false;
      return true;
    });
    if (!files.length) return res.status(404).json({ error: 'Schema not found' });
    // If multiple, pick highest version
    files.sort((a, b) => (b.version || 0) - (a.version || 0));
    const file = files[0];
    res.sendFile(file.fullPath);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Data Types Registry ---
const DATA_TYPES_PATH = path.join(DATA_ROOT, 'data-types.json');
const BUILTIN_TYPES = [
  { id: 'text-string', label: 'Text String', builtin: true },
];

async function loadDataTypes() {
  try {
    const content = await fs.readFile(DATA_TYPES_PATH, 'utf-8');
    const stored = JSON.parse(content);
    const customTypes = Array.isArray(stored) ? stored.filter(t => !t.builtin) : [];
    return [...BUILTIN_TYPES, ...customTypes];
  } catch {
    return [...BUILTIN_TYPES];
  }
}

async function saveDataTypes(types) {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  await fs.writeFile(DATA_TYPES_PATH, JSON.stringify(types.filter(t => !t.builtin), null, 2));
}

app.get('/api/librarian/data-types', async (req, res) => {
  try {
    const types = await loadDataTypes();
    res.json({ types });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/librarian/data-types', async (req, res) => {
  try {
    const { id, label } = req.body || {};
    if (!id || !label) return res.status(400).json({ error: 'id and label are required' });
    const cleanId = String(id).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (cleanId === 'text-string') return res.status(409).json({ error: 'text-string is a built-in type' });
    const types = await loadDataTypes();
    if (types.some(t => t.id === cleanId)) {
      return res.status(409).json({ error: `Type ${cleanId} already exists` });
    }
    const newType = { id: cleanId, label: String(label), builtin: false };
    types.push(newType);
    await saveDataTypes(types);
    res.json({ status: 'created', type: newType });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List all files (unchanged)

const PORT = process.env.LIBRARIAN_PORT || 4100;
app.listen(PORT, () => {
  console.log(`[Librarian] Service running on http://localhost:${PORT}`);
});
