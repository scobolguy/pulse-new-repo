import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readEnvNumber } from './src/env-config.mjs';

const app = express();
app.use(express.json());

// Config: where to look for data files and schemas (independent of process cwd)
const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(repoRoot, 'data');
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
  // ISO 20022 format: pacs.002.001.12.xsd, pain.001.001.03.xsd, etc.
  const iso20022Match = filename.match(/^([a-z]{3,4})\.(\d{3})\.(\d{3})\.(\d{2,3})\.xsd$/i);
  if (iso20022Match) {
    const area = iso20022Match[1].toLowerCase();
    const msgCode = iso20022Match[2];
    const ver1 = iso20022Match[3];
    const ver2 = iso20022Match[4];
    return {
      name: `${area}.${msgCode}.${ver1}.${ver2}`,
      version: parseInt(ver2, 10),
      type: 'xsd',
      area,
    };
  }
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
  if (meta?.area) return meta.area;
  return String(meta?.name || '').trim().toLowerCase() || null;
}

function summarizeValueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function normalizeEnumValues(values) {
  if (!Array.isArray(values)) return null;
  return values.map((value) => {
    const valueType = summarizeValueType(value);
    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean' || valueType === 'null') {
      return value;
    }
    return JSON.stringify(value);
  });
}

function inferJsonSchemaValueType(schemaNode) {
  if (!schemaNode || typeof schemaNode !== 'object') return 'unknown';
  if (Array.isArray(schemaNode.type)) return String(schemaNode.type[0] || 'unknown');
  if (typeof schemaNode.type === 'string') return schemaNode.type;
  if (Array.isArray(schemaNode.enum)) return 'enum';
  if (schemaNode.properties && typeof schemaNode.properties === 'object') return 'object';
  if (schemaNode.items) return 'array';
  return 'unknown';
}

function inferSwiftFieldDefaults(fieldTag) {
  const tag = String(fieldTag || '').toUpperCase();
  const known = {
    '16R': { type: 'marker', format: '3!c' },
    '16S': { type: 'marker', format: '3!c' },
    '20': { type: 'string', format: '16x' },
    '21': { type: 'string', format: '16x' },
    '21R': { type: 'string', format: '16x' },
    '22A': { type: 'code', format: '4!c' },
    '22B': { type: 'code', format: '4!c' },
    '22F': { type: 'code', format: '4!c[/30x]' },
    '23': { type: 'code', format: '4!c' },
    '23B': { type: 'code', format: '4!c' },
    '26E': { type: 'number', format: '3n' },
    '30': { type: 'date', format: '6!n (YYMMDD)' },
    '31C': { type: 'date', format: '6!n (YYMMDD)' },
    '31D': { type: 'composite', format: '6!n29x' },
    '32A': { type: 'composite', format: '6!n3!a15d' },
    '32B': { type: 'amount', format: '3!a15d' },
    '33B': { type: 'amount', format: '3!a15d' },
    '35B': { type: 'instrument', format: '4*35x' },
    '36': { type: 'number', format: '15d' },
    '40A': { type: 'code', format: '24x' },
    '41A': { type: 'bic+code', format: '4!a2!a2!c[3!c]/1!a' },
    '50': { type: 'party', format: '4*35x' },
    '50A': { type: 'bic', format: '4!a2!a2!c[3!c]' },
    '50F': { type: 'party', format: '4*35x' },
    '50H': { type: 'party', format: '4*35x' },
    '50K': { type: 'party', format: '/34x and 4*35x' },
    '52A': { type: 'bic', format: '4!a2!a2!c[3!c]' },
    '53A': { type: 'bic', format: '4!a2!a2!c[3!c]' },
    '54A': { type: 'bic', format: '4!a2!a2!c[3!c]' },
    '56A': { type: 'bic', format: '4!a2!a2!c[3!c]' },
    '57A': { type: 'bic', format: '4!a2!a2!c[3!c]' },
    '58A': { type: 'bic', format: '4!a2!a2!c[3!c]' },
    '59': { type: 'party', format: '/34x and 4*35x' },
    '59A': { type: 'bic', format: '4!a2!a2!c[3!c]' },
    '70': { type: 'text', format: '4*35x' },
    '70E': { type: 'text', format: '10*35x' },
    '71A': { type: 'code', format: '3!a' },
    '71B': { type: 'text', format: '6*35x' },
    '71D': { type: 'text', format: '6*35x' },
    '72': { type: 'text', format: '6*35x' },
    '73': { type: 'text', format: '6*35x' },
    '75': { type: 'text', format: '35*50x' },
    '76': { type: 'text', format: '35*50x' },
    '77B': { type: 'text', format: '3*35x' },
    '77C': { type: 'text', format: '35*50x' },
    '77J': { type: 'text', format: '20*35x' },
    '79': { type: 'text', format: '35*50x' },
    '97A': { type: 'account', format: '35x' },
    '98A': { type: 'date', format: '8!n' },
  };
  if (known[tag]) return known[tag];
  if (/^\d{2}[A-Z]$/.test(tag)) return { type: 'string', format: 'variable' };
  if (/^\d{2}$/.test(tag)) return { type: 'string', format: 'variable' };
  return { type: 'string', format: 'variable' };
}

function enrichSwiftFieldMetadata(parsed) {
  if (!parsed || typeof parsed !== 'object') return;
  const messageType = String(parsed.messageType || '').toUpperCase();
  if (!/^MT\d{3}/.test(messageType)) return;

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.fields && typeof node.fields === 'object' && !Array.isArray(node.fields)) {
      for (const [fieldTag, fieldDef] of Object.entries(node.fields)) {
        if (!fieldDef || typeof fieldDef !== 'object' || Array.isArray(fieldDef)) continue;
        const defaults = inferSwiftFieldDefaults(fieldTag);
        if (!fieldDef.type) fieldDef.type = defaults.type;
        if (!fieldDef.format) fieldDef.format = defaults.format;
        if (!fieldDef.length) fieldDef.length = fieldDef.format || defaults.format;
      }
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') visit(value);
    }
  }

  visit(parsed);
}

function buildJsonSchemaTree(name, schemaNode) {
  const valueType = inferJsonSchemaValueType(schemaNode);
  const enumValues = normalizeEnumValues(schemaNode?.enum);
  const node = {
    name,
    kind: valueType === 'object' || valueType === 'array' ? 'branch' : 'leaf',
    valueType,
    children: [],
  };

  if (enumValues && enumValues.length > 0) {
    node.enumValues = enumValues;
  }

  if (valueType === 'object' && schemaNode?.properties && typeof schemaNode.properties === 'object') {
    node.children = Object.entries(schemaNode.properties).map(([childName, childSchema]) => buildJsonSchemaTree(childName, childSchema));
    return node;
  }

  if (valueType === 'array') {
    if (Array.isArray(schemaNode?.items)) {
      node.children = schemaNode.items.map((itemSchema, index) => buildJsonSchemaTree(`[${index}]`, itemSchema));
    } else if (schemaNode?.items && typeof schemaNode.items === 'object') {
      node.children = [buildJsonSchemaTree('[*]', schemaNode.items)];
    }
    return node;
  }

  return node;
}

function buildJsonValueTree(name, value) {
  const nodeType = summarizeValueType(value);
  if (nodeType === 'array') {
    const enumValues = value.every((item) => {
      const itemType = summarizeValueType(item);
      return itemType !== 'object' && itemType !== 'array';
    }) ? value : null;
    const sample = value[0];
    return {
      name,
      kind: 'branch',
      valueType: 'array',
      ...(enumValues ? { enumValues } : {}),
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
  const simpleTypes = new Map();

  const simpleTypeRegex = /<xs:simpleType\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/xs:simpleType>/gi;
  for (const simpleTypeMatch of String(content || '').matchAll(simpleTypeRegex)) {
    const simpleTypeName = String(simpleTypeMatch[1] || '');
    const simpleTypeBody = String(simpleTypeMatch[2] || '');
    const enumValues = [];
    for (const enumMatch of simpleTypeBody.matchAll(/<xs:enumeration\b[^>]*value="([^"]+)"/gi)) {
      enumValues.push(String(enumMatch[1] || ''));
    }
    const baseType = simpleTypeBody.match(/<xs:restriction\b[^>]*base="([^"]+)"/i)?.[1] || null;
    simpleTypes.set(simpleTypeName, {
      enumValues,
      isEnum: enumValues.length > 0,
      baseType,
    });
  }

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
      const typeNoPrefix = typeName && typeName.includes(':') ? typeName.split(':').pop() : typeName;
      const simpleTypeMeta = (typeNoPrefix && simpleTypes.get(typeNoPrefix)) || (typeName && simpleTypes.get(typeName)) || null;
      const minOccursRaw = attrs.match(/\bminOccurs="([^"]+)"/i)?.[1] || null;
      const minOccurs = minOccursRaw == null ? 1 : Number.parseInt(minOccursRaw, 10);
      const required = Number.isNaN(minOccurs) ? true : minOccurs > 0;
      const isLeaf = selfClosing || !!typeName;
      const node = {
        name: elementName,
        kind: isLeaf ? 'leaf' : 'branch',
        valueType: typeName || 'complex',
        required,
        ...(simpleTypeMeta?.isEnum ? { isEnum: true, enumValues: simpleTypeMeta.enumValues } : {}),
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
    enrichSwiftFieldMetadata(parsed);

    if (parsed && typeof parsed === 'object' && (parsed.type === 'object' || parsed.properties || parsed.items || parsed.enum)) {
      return buildJsonSchemaTree('root', parsed);
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

const LIBRARIAN_LLM_ACTIONS = [
  {
    id: 'listSchemas',
    method: 'GET',
    path: '/api/librarian/schemas',
    description: 'Return schema catalog with inferred structure trees and lifecycle status.',
    requestSchema: null,
    responseShape: { schemas: [{ typeId: 'string', path: 'string', structure: 'tree', lifecycle: 'object' }] }
  },
  {
    id: 'listDataTypes',
    method: 'GET',
    path: '/api/librarian/data-types',
    description: 'List managed data type IDs used by mapper contracts.',
    requestSchema: null,
    responseShape: { types: [{ id: 'string', label: 'string', builtin: 'boolean' }] }
  },
  {
    id: 'createDataType',
    method: 'POST',
    path: '/api/librarian/data-types',
    description: 'Create normalized custom data type entry.',
    requestSchema: { id: 'string', label: 'string' },
    responseShape: { status: 'created', type: 'object' }
  },
  {
    id: 'uploadSchema',
    method: 'POST',
    path: '/api/librarian/upload/schemas',
    description: 'Upload raw schema asset. Requires x-filename header and binary body.',
    requestSchema: {
      headers: { 'x-filename': 'string', 'content-type': 'mime-type' },
      body: 'binary'
    },
    responseShape: { status: 'ok', filename: 'string', dest: 'schemas', size: 'number' }
  },
  {
    id: 'setSchemaLifecycle',
    method: 'POST',
    path: '/api/librarian/schema-lifecycle',
    description: 'Configure active/reject dates for schema selection policy.',
    requestSchema: {
      path: 'string',
      activeFrom: 'iso-date?',
      rejectAfter: 'iso-date?',
      keepForDisplay: 'boolean?'
    },
    responseShape: { status: 'updated', lifecycle: 'object' }
  },
  {
    id: 'searchFiles',
    method: 'GET',
    path: '/api/librarian/search?q=<query>&ext=<ext>',
    description: 'Search cataloged files by name and extension.',
    requestSchema: { query: { q: 'string?', ext: 'string?' } },
    responseShape: { files: 'array' }
  }
];

function librarianActionById(actionId) {
  return LIBRARIAN_LLM_ACTIONS.find((action) => action.id === String(actionId || '').trim()) || null;
}

app.get('/api/librarian/llm/base', (req, res) => {
  res.json({
    service: 'data-librarian',
    version: '1.0',
    purpose: 'Schema and contract intelligence for map generation and validation.',
    outputsForMapper: [
      'sourceTypeId and targetTypeId',
      'sourceSchemaPath and targetSchemaPath',
      'sourceStructure and targetStructure snapshots',
      'schema lifecycle status for safe selection'
    ],
    recommendedFlow: [
      'Call /api/librarian/schemas and select active schemas',
      'Extract typeId/path/structure for source and target contracts',
      'Call mapper /api/mapper/llm/pcode-map-template',
      'Create map via /api/mapper/maps and validate via /api/mapper/maps/:id/run'
    ],
    endpoints: {
      capabilities: '/api/librarian/llm/base',
      actions: '/api/librarian/llm/actions',
      actionSchema: '/api/librarian/llm/actions/:id',
      schemaCatalog: '/api/librarian/schemas',
      dataTypes: '/api/librarian/data-types'
    }
  });
});

app.get('/api/librarian/llm/actions', (req, res) => {
  res.json({
    service: 'data-librarian',
    actionCount: LIBRARIAN_LLM_ACTIONS.length,
    actions: LIBRARIAN_LLM_ACTIONS,
  });
});

app.get('/api/librarian/llm/actions/:id', (req, res) => {
  const action = librarianActionById(req.params.id);
  if (!action) {
    return res.status(404).json({ error: `Unknown librarian action: ${req.params.id}` });
  }
  res.json({ service: 'data-librarian', action });
});

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

app.delete('/api/librarian/data-types/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim().toLowerCase();
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (id === 'text-string') return res.status(409).json({ error: 'text-string is a built-in type' });

    const types = await loadDataTypes();
    const nextTypes = types.filter(type => String(type.id || '').toLowerCase() !== id);
    if (nextTypes.length === types.length) {
      return res.status(404).json({ error: 'Type not found' });
    }

    await saveDataTypes(nextTypes);
    res.json({ status: 'deleted', id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/librarian/data-types/:id/rename', async (req, res) => {
  try {
    const currentId = String(req.params.id || '').trim().toLowerCase();
    const nextId = String(req.body?.newId || '').trim().toLowerCase();
    const nextLabel = String(req.body?.label || '').trim();
    if (!currentId) return res.status(400).json({ error: 'id is required' });
    if (!nextId) return res.status(400).json({ error: 'newId is required' });
    if (currentId === 'text-string') return res.status(409).json({ error: 'text-string is a built-in type' });
    if (nextId === 'text-string') return res.status(409).json({ error: 'text-string is a built-in type' });

    const types = await loadDataTypes();
    const typeIndex = types.findIndex(type => String(type.id || '').toLowerCase() === currentId);
    if (typeIndex < 0) {
      return res.status(404).json({ error: 'Type not found' });
    }
    if (types.some(type => String(type.id || '').toLowerCase() === nextId && String(type.id || '').toLowerCase() !== currentId)) {
      return res.status(409).json({ error: 'Type already exists' });
    }

    const currentType = types[typeIndex];
    const updatedType = {
      ...currentType,
      id: nextId,
      label: nextLabel || currentType.label || nextId,
    };
    types[typeIndex] = updatedType;
    await saveDataTypes(types);
    res.json({ status: 'renamed', type: updatedType });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/librarian/schemas', async (req, res) => {
  try {
    const relPath = String(req.body?.path || '').trim().replace(/\\/g, '/');
    if (!relPath) return res.status(400).json({ error: 'path is required' });

    const absPath = path.resolve(SCHEMA_ROOT, relPath);
    if (!absPath.startsWith(path.resolve(SCHEMA_ROOT))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await fs.unlink(absPath);
    const lifecycleByPath = await loadSchemaLifecycleByPath();
    if (Object.prototype.hasOwnProperty.call(lifecycleByPath, relPath)) {
      delete lifecycleByPath[relPath];
      await saveSchemaLifecycleByPath(lifecycleByPath);
    }

    res.json({ status: 'deleted', path: relPath });
  } catch (e) {
    if (e.code === 'ENOENT') {
      return res.status(404).json({ error: 'Schema not found' });
    }
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/librarian/schemas/rename', async (req, res) => {
  try {
    const currentPath = String(req.body?.path || '').trim().replace(/\\/g, '/');
    const newName = String(req.body?.newName || '').trim();
    if (!currentPath) return res.status(400).json({ error: 'path is required' });
    if (!newName) return res.status(400).json({ error: 'newName is required' });

    const currentAbsPath = path.resolve(SCHEMA_ROOT, currentPath);
    if (!currentAbsPath.startsWith(path.resolve(SCHEMA_ROOT))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const currentDir = path.dirname(currentAbsPath);
    const currentExt = path.extname(currentAbsPath) || '.xsd';
    const nextFileName = newName.endsWith(currentExt) ? newName : `${newName}${currentExt}`;
    const nextAbsPath = path.resolve(currentDir, nextFileName);
    if (!nextAbsPath.startsWith(path.resolve(SCHEMA_ROOT))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await fs.mkdir(path.dirname(nextAbsPath), { recursive: true });
    await fs.rename(currentAbsPath, nextAbsPath);

    const lifecycleByPath = await loadSchemaLifecycleByPath();
    const nextRelPath = path.relative(SCHEMA_ROOT, nextAbsPath).replace(/\\/g, '/');
    if (Object.prototype.hasOwnProperty.call(lifecycleByPath, currentPath)) {
      lifecycleByPath[nextRelPath] = lifecycleByPath[currentPath];
      delete lifecycleByPath[currentPath];
      await saveSchemaLifecycleByPath(lifecycleByPath);
    }

    res.json({ status: 'renamed', path: nextRelPath });
  } catch (e) {
    if (e.code === 'ENOENT') {
      return res.status(404).json({ error: 'Schema not found' });
    }
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

const PORT = readEnvNumber('LIBRARIAN_PORT', 4100);
app.listen(PORT, () => {
  console.log(`[Librarian] Service running on http://localhost:${PORT}`);
});
