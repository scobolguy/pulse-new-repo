import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(express.json());

// Config: where to look for data files and schemas
const DATA_ROOT = path.resolve('./data');
const SCHEMA_ROOT = path.join(DATA_ROOT, 'schemas');
const SCHEMA_LIFECYCLE_PATH = path.join(DATA_ROOT, 'schema-lifecycle.json');

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
  const match = filename.match(/^([\w-]+)(?:\.v(\d+))?\.(xsd|avro|json-schema|copybook|cpy|cbl|sql|proto|csv|xml|json)$/i);
  if (!match) return null;
  const rawType = match[3].toLowerCase();
  return {
    name: match[1],
    version: match[2] ? parseInt(match[2], 10) : null,
    type: (rawType === 'copybook' || rawType === 'cpy' || rawType === 'cbl') ? 'copybook' : rawType,
  };
}

function inferTypeIdFromSchema(meta) {
  return String(meta?.name || '').trim().toLowerCase() || null;
}

function summarizeValueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function buildJsonValueTree(name, value) {
  const nodeType = summarizeValueType(value);
  if (nodeType === 'array') {
    const sample = value[0];
    return {
      name,
      kind: 'branch',
      valueType: 'array',
      children: sample === undefined ? [] : [buildJsonValueTree('[0]', sample)],
    };
  }
  if (nodeType === 'object') {
    return {
      name,
      kind: 'branch',
      valueType: 'object',
      children: Object.entries(value).map(([childName, childValue]) => buildJsonValueTree(childName, childValue)),
    };
  }
  return {
    name,
    kind: 'leaf',
    valueType: nodeType,
  };
}

function buildCopybookTree(content) {
  const root = { name: 'root', kind: 'branch', valueType: 'copybook', children: [] };
  const stack = [{ level: 0, node: root }];
  const lines = String(content || '').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.replace(/\*.*$/, '').trim();
    if (!line) continue;
    const match = line.match(/^(\d{2})\s+([A-Z0-9-]+)\b(.*)$/i);
    if (!match) continue;

    const level = parseInt(match[1], 10);
    const name = match[2].toLowerCase();
    const rest = match[3] || '';
    const hasPic = /\bPIC\b/i.test(rest);
    const isBranch = !hasPic || /\bOCCURS\b|\bREDEFINES\b|\bDEPENDING\b|\bGROUP\b/i.test(rest);
    const node = {
      name,
      kind: isBranch ? 'branch' : 'leaf',
      valueType: hasPic ? (rest.match(/\bPIC\s+([^\.]+)/i)?.[1] || 'field') : 'group',
      children: [],
    };

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    stack[stack.length - 1].node.children.push(node);
    if (isBranch) {
      stack.push({ level, node });
    }
  }

  return root.children.length > 0 ? root : null;
}

function buildXsdTree(content) {
  const root = { name: 'root', kind: 'branch', valueType: 'xsd', children: [] };
  const stack = [root];
  const tokens = String(content || '').match(/<\/?[^>]+>/g) || [];

  for (const token of tokens) {
    const closing = /^<\//.test(token);
    const selfClosing = /\/>\s*$/.test(token);
    const nameMatch = token.match(/^<\/?([a-zA-Z0-9:_-]+)\b([^>]*)\/?\s*>$/);
    if (!nameMatch) continue;

    const tagName = nameMatch[1].toLowerCase();
    const attrs = nameMatch[2] || '';

    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    if (tagName.endsWith('element')) {
      const elementName = attrs.match(/\bname="([^"]+)"/i)?.[1] || 'element';
      const typeName = attrs.match(/\btype="([^"]+)"/i)?.[1] || null;
      const isLeaf = selfClosing || !!typeName;
      const node = {
        name: elementName,
        kind: isLeaf ? 'leaf' : 'branch',
        valueType: typeName || 'complex',
        children: [],
      };
      stack[stack.length - 1].children.push(node);
      if (!isLeaf) stack.push(node);
      continue;
    }

    if (tagName.endsWith('sequence') || tagName.endsWith('choice') || tagName.endsWith('all') || tagName.endsWith('complextype')) {
      const name = attrs.match(/\bname="([^"]+)"/i)?.[1] || tagName.split(':').pop();
      const node = {
        name,
        kind: 'branch',
        valueType: tagName.split(':').pop(),
        children: [],
      };
      stack[stack.length - 1].children.push(node);
      if (!selfClosing) stack.push(node);
    }
  }

  return root.children.length > 0 ? root : null;
}

function decodeTextBuffer(buffer) {
  if (!buffer || buffer.length === 0) return '';

  // UTF-16 LE BOM
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return buffer.toString('utf16le').replace(/^\uFEFF/, '');
  }

  // UTF-16 BE BOM -> swap to LE for decoding
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    const swapped = Buffer.from(buffer);
    for (let i = 0; i + 1 < swapped.length; i += 2) {
      const temp = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = temp;
    }
    return swapped.toString('utf16le').replace(/^\uFEFF/, '');
  }

  // Heuristic: frequent zero bytes strongly suggests UTF-16 LE without BOM.
  let zeroByteCount = 0;
  const sampleLength = Math.min(buffer.length, 512);
  for (let i = 0; i < sampleLength; i++) {
    if (buffer[i] === 0x00) zeroByteCount += 1;
  }
  if (zeroByteCount > sampleLength * 0.2) {
    return buffer.toString('utf16le').replace(/^\uFEFF/, '');
  }

  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

async function extractStructureForFile(filePath, schemaType) {
  const lowerType = String(schemaType || '').toLowerCase();
  try {
    const fileBuffer = await fs.readFile(filePath);
    const content = decodeTextBuffer(fileBuffer);
    if (lowerType === 'copybook') {
      return buildCopybookTree(content);
    }
    if (lowerType === 'xsd' || lowerType === 'xml') {
      return buildXsdTree(content);
    }
    if (lowerType !== 'json' && lowerType !== 'json-schema') {
      return null;
    }
    const parsed = JSON.parse(content);

    if (parsed && typeof parsed === 'object' && parsed.type === 'object' && parsed.properties && typeof parsed.properties === 'object') {
      const children = Object.entries(parsed.properties).map(([childName, childSchema]) => ({
        name: childName,
        kind: childSchema?.type === 'object' || childSchema?.type === 'array' ? 'branch' : 'leaf',
        valueType: childSchema?.type || 'unknown',
        children: childSchema?.type === 'object' && childSchema?.properties
          ? Object.entries(childSchema.properties).map(([nestedName, nestedSchema]) => ({
              name: nestedName,
              kind: nestedSchema?.type === 'object' || nestedSchema?.type === 'array' ? 'branch' : 'leaf',
              valueType: nestedSchema?.type || 'unknown',
              children: [],
            }))
          : [],
      }));
      return { name: 'root', kind: 'branch', valueType: 'object', children };
    }

    return buildJsonValueTree('root', parsed);
  } catch {
    return null;
  }
}

async function loadSchemaLifecycleByPath() {
  try {
    const content = await fs.readFile(SCHEMA_LIFECYCLE_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveSchemaLifecycleByPath(lifecycleByPath) {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  await fs.writeFile(SCHEMA_LIFECYCLE_PATH, JSON.stringify(lifecycleByPath, null, 2));
}

function sanitizeLifecycleDate(value) {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function computeLifecycleStatus(lifecycle) {
  const now = Date.now();
  const activeFromMs = lifecycle.activeFrom ? Date.parse(lifecycle.activeFrom) : null;
  const rejectAfterMs = lifecycle.rejectAfter ? Date.parse(lifecycle.rejectAfter) : null;
  if (activeFromMs && now < activeFromMs) return 'scheduled';
  if (rejectAfterMs && now >= rejectAfterMs) return 'rejected';
  return 'active';
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
    const lifecycleByPath = await loadSchemaLifecycleByPath();
    const schemas = files
      .map(async f => {
        const meta = parseSchemaFilename(f.name);
        if (!meta) return null;
        const lifecycle = lifecycleByPath[f.path] || {
          activeFrom: null,
          rejectAfter: null,
          keepForDisplay: true,
        };
        const structure = await extractStructureForFile(f.fullPath, meta.type);
        return {
          ...meta,
          typeId: inferTypeIdFromSchema(meta),
          path: f.path,
          size: f.size,
          mtime: f.mtime,
          structure,
          lifecycle: {
            activeFrom: lifecycle.activeFrom || null,
            rejectAfter: lifecycle.rejectAfter || null,
            keepForDisplay: lifecycle.keepForDisplay !== false,
            status: computeLifecycleStatus(lifecycle),
          },
        };
      })
    const resolvedSchemas = (await Promise.all(schemas)).filter(Boolean);
    res.json({ schemas: resolvedSchemas });
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

// Upload a file into the librarian repository
// :dest = 'schemas' (writes to SCHEMA_ROOT) or 'data' (writes to DATA_ROOT)
app.post('/api/librarian/upload/:dest', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
  const dest = req.params.dest;
  if (dest !== 'schemas' && dest !== 'data') {
    return res.status(400).json({ error: 'dest must be "schemas" or "data"' });
  }
  const rawFilename = (req.get('x-filename') || '').trim();
  if (!rawFilename) return res.status(400).json({ error: 'x-filename header is required' });
  // Security: reject filenames with path separators or traversal sequences
  if (/[/\\]/.test(rawFilename) || rawFilename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const targetDir = dest === 'schemas' ? SCHEMA_ROOT : DATA_ROOT;
  const targetPath = path.join(targetDir, rawFilename);
  // Final safety check: resolved path must stay inside targetDir
  if (!path.resolve(targetPath).startsWith(path.resolve(targetDir))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetPath, req.body);
    res.json({ status: 'ok', filename: rawFilename, dest, size: req.body.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/librarian/schema-lifecycle', async (req, res) => {
  try {
    const { path: schemaPath, activeFrom, rejectAfter, keepForDisplay } = req.body || {};
    if (!schemaPath) {
      return res.status(400).json({ error: 'path is required' });
    }

    const files = await listFiles(SCHEMA_ROOT);
    const exists = files.some(file => file.path === schemaPath);
    if (!exists) {
      return res.status(404).json({ error: `Schema not found: ${schemaPath}` });
    }

    const normalizedActiveFrom = sanitizeLifecycleDate(activeFrom);
    const normalizedRejectAfter = sanitizeLifecycleDate(rejectAfter);
    if (activeFrom && !normalizedActiveFrom) {
      return res.status(400).json({ error: 'activeFrom must be a valid date/time' });
    }
    if (rejectAfter && !normalizedRejectAfter) {
      return res.status(400).json({ error: 'rejectAfter must be a valid date/time' });
    }
    if (normalizedActiveFrom && normalizedRejectAfter && Date.parse(normalizedRejectAfter) <= Date.parse(normalizedActiveFrom)) {
      return res.status(400).json({ error: 'rejectAfter must be later than activeFrom' });
    }

    const lifecycleByPath = await loadSchemaLifecycleByPath();
    const lifecycle = {
      activeFrom: normalizedActiveFrom,
      rejectAfter: normalizedRejectAfter,
      keepForDisplay: keepForDisplay !== false,
    };
    lifecycleByPath[schemaPath] = lifecycle;
    await saveSchemaLifecycleByPath(lifecycleByPath);

    res.json({
      status: 'updated',
      path: schemaPath,
      lifecycle: {
        ...lifecycle,
        status: computeLifecycleStatus(lifecycle),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.LIBRARIAN_PORT || 4100;
app.listen(PORT, () => {
  console.log(`[Librarian] Service running on http://localhost:${PORT}`);
});
