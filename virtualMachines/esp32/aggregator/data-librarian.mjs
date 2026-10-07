import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readEnvNumber } from './src/env-config.mjs';
import { compilePascalishProgramWithAntlr } from './scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../pmachines/javascript/src/service-host.mjs';
import { createPascalishCatalogStore } from './src/librarian/catalog-store.mjs';
import { createPascalishXsdParser } from './src/librarian/xsd-parser.mjs';
import { createPascalishSchemaTreeService } from './src/librarian/schema-tree-service.mjs';
import { createPascalishLibrarianNormalization } from './src/librarian/normalization.mjs';

const app = express();
app.use(express.json());

// Config: where to look for data files and schemas (independent of process cwd)
const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultOperationalDataRoot = process.platform === 'win32'
  ? 'c:/dev/pulse-operational-data'
  : '/opt/pulse/operational-data';
const DATA_ROOT = path.resolve(
  process.env.LIBRARIAN_DATA_ROOT
  || process.env.PULSE_LIBRARIAN_DATA_ROOT
  || process.env.PULSE_RUNTIME_DATA_ROOT
  || process.env.PULSE_QUEUE_DATA_ROOT
  || process.env.PULSE_OPERATIONAL_DATA_ROOT
  || defaultOperationalDataRoot
);
const SERVICES_ROOT = path.join(DATA_ROOT, 'services');
const LIBRARIAN_SERVICE_ROOT = path.join(SERVICES_ROOT, 'librarian');
const SCHEMA_ROOT = path.join(LIBRARIAN_SERVICE_ROOT, 'schemas');
const SCHEMA_LIFECYCLE_PATH = path.join(LIBRARIAN_SERVICE_ROOT, 'schema-lifecycle.json');
const MAPPER_RULESETS_PATH = path.join(LIBRARIAN_SERVICE_ROOT, 'mapper-rulesets.json');
const DATA_TYPES_PATH = path.join(LIBRARIAN_SERVICE_ROOT, 'data-types.json');

const LEGACY_SCHEMA_ROOT = path.join(DATA_ROOT, 'schemas');
const LEGACY_SCHEMA_LIFECYCLE_PATH = path.join(DATA_ROOT, 'schema-lifecycle.json');
const LEGACY_MAPPER_RULESETS_PATH = path.join(DATA_ROOT, 'mapper-rulesets.json');
const LEGACY_DATA_TYPES_PATH = path.join(DATA_ROOT, 'data-types.json');
let subschemaPolicyHost;
let catalogStore;
let xsdParser;
let schemaTreeService;
let normalization;

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function migrateLegacyPath(legacyPath, nextPath) {
  if (await pathExists(nextPath)) return;
  if (!(await pathExists(legacyPath))) return;
  await fs.mkdir(path.dirname(nextPath), { recursive: true });
  await fs.rename(legacyPath, nextPath);
}

async function ensureLibrarianStorageLayout() {
  await fs.mkdir(LIBRARIAN_SERVICE_ROOT, { recursive: true });

  await migrateLegacyPath(LEGACY_SCHEMA_ROOT, SCHEMA_ROOT);
  await migrateLegacyPath(LEGACY_SCHEMA_LIFECYCLE_PATH, SCHEMA_LIFECYCLE_PATH);
  await migrateLegacyPath(LEGACY_MAPPER_RULESETS_PATH, MAPPER_RULESETS_PATH);
  await migrateLegacyPath(LEGACY_DATA_TYPES_PATH, DATA_TYPES_PATH);

  await fs.mkdir(SCHEMA_ROOT, { recursive: true });
}

// Utility: Recursively list files with metadata, with optional filter
async function listFiles(dir, relBase = '', filter = null) {
  let results = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e?.code === 'ENOENT') return results;
    throw e;
  }
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
  if (lowerType === 'xsd' || lowerType === 'xml') {
    return xsdParser.parseFile(path.relative(SCHEMA_ROOT, filePath).replace(/\\/g, '/'));
  }
  try {
    const fileBuffer = await fs.readFile(filePath);
    const content = decodeTextBuffer(fileBuffer);
    if (lowerType === 'copybook') {
      return buildCopybookTree(content);
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

function normalizeSchemaFieldPath(value) {
  return String(value || '')
    .trim()
    .replace(/^root\.?/i, '')
    .split('.')
    .map(part => part.trim())
    .filter(Boolean)
    .join('.');
}

function normalizeSubschemaDefinition(candidate) {
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  const id = String(source.id || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const label = String(source.label || id).trim();
  const parentSchemaPath = String(source.parentSchemaPath || '').trim().replace(/\\/g, '/');
  const parentTypeId = String(source.parentTypeId || '').trim().toLowerCase();
  const accessibleFields = Array.from(new Set(
    (Array.isArray(source.accessibleFields) ? source.accessibleFields : [])
      .map(normalizeSchemaFieldPath)
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));
  if (!id) throw new Error('id is required');
  if (!label) throw new Error('label is required');
  if (!parentSchemaPath) throw new Error('parentSchemaPath is required');
  if (accessibleFields.length === 0) throw new Error('accessibleFields must include at least one field path');
  return { id, label, parentSchemaPath, ...(parentTypeId ? { parentTypeId } : {}), accessibleFields };
}

async function startSubschemaPolicyHost() {
  const policyPath = path.join(repoRoot, '..', 'src', 'librarian', 'subschema-policy.pas');
  const source = await fs.readFile(policyPath, 'utf-8');
  const compiled = compilePascalishProgramWithAntlr(source, {
    fileName: policyPath,
    hostServices: true,
  });
  const host = await createPascalishServiceHost({
    compiled,
    collectorId: 'pulse-data-librarian-policy',
    httpPort: null,
    udpPort: null,
    maxBodyBytes: 1000000,
  });
  await host.start();
  return host;
}

async function pascalishPolicyCheck(path, body) {
  if (!subschemaPolicyHost) throw new Error('Pascalish subschema policy is not initialized');
  const result = await subschemaPolicyHost.dispatch({
    transport: 'internal',
    method: 'POST',
    path,
    body: JSON.stringify(body),
  });
  if (result.status !== 200 || typeof result.body?.valid !== 'boolean') {
    throw new Error(`Pascalish subschema policy failed: ${JSON.stringify(result.body)}`);
  }
  return result.body.valid;
}

function encodePolicyField(field) {
  // Preserve JS string identity, including unpaired UTF-16 surrogates.
  return Buffer.from(field, 'utf16le').toString('base64');
}

function chunkPolicyFields(fields) {
  const chunks = [];
  const longFields = [];
  let chunk = [];
  for (const field of fields) {
    const token = encodePolicyField(field);
    if (Buffer.byteLength(JSON.stringify([token])) > 800) {
      longFields.push(field);
      continue;
    }
    const next = [...chunk, token];
    if (Buffer.byteLength(JSON.stringify(next)) > 800 && chunk.length > 0) {
      chunks.push(chunk);
      chunk = [token];
    } else {
      chunk = next;
    }
  }
  if (chunk.length > 0) chunks.push(chunk);
  return { chunks, longFields };
}

async function findUnknownSubschemaFields(accessibleFields, availableFields) {
  const { chunks, longFields } = chunkPolicyFields(availableFields);
  const unknownFields = [];
  for (const field of accessibleFields) {
    const token = encodePolicyField(field);
    let isAvailable = false;
    if (Buffer.byteLength(JSON.stringify([token])) <= 800) {
      for (const availableFieldsChunk of chunks) {
        isAvailable = await pascalishPolicyCheck('/validate-field', {
          fieldToken: token,
          availableFields: availableFieldsChunk,
        });
        if (isAvailable) break;
      }
    }
    if (!isAvailable) {
      for (const longField of longFields) {
        if (field.length !== longField.length) continue;
        isAvailable = await pascalishPolicyCheck('/compare-field', { field, candidate: longField });
        if (isAvailable) break;
      }
    }
    if (!isAvailable) unknownFields.push(field);
  }
  return unknownFields;
}

async function loadSubschemas() {
  const parsed = await catalogStore.read('subschemas');
  if (parsed === undefined) return [];
  if (!Array.isArray(parsed)) throw new Error('Subschema catalog must be a JSON array');
  return parsed.map(normalizeSubschemaDefinition);
}

async function mutateSubschemas(prepare) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const stored = await catalogStore.read('subschemas');
    const expected = stored === undefined ? [] : stored;
    if (!Array.isArray(expected)) throw new Error('Subschema catalog must be a JSON array');
    const entries = expected.map(normalizeSubschemaDefinition);
    const { mutation, ...context } = await prepare(entries);
    try {
      const result = await catalogStore.mutateSubschemas({ ...mutation, expected, entries });
      return { ...result, ...context };
    } catch (error) {
      if (!error.retry || attempt === 31) throw error;
    }
  }
}

async function loadSchemaLifecycleByPath() {
  const parsed = await catalogStore.read('schema-lifecycle');
  if (parsed === undefined) return {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Schema lifecycle catalog must be a JSON object');
  return parsed;
}

async function mutateSchemaLifecycle(operation, id, values = {}) {
  return catalogStore.mutateCatalog('schema-lifecycle', () => ({ operation, id, ...values }));
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
    id: 'listSubschemas',
    method: 'GET',
    path: '/api/librarian/subschemas',
    description: 'List field-restricted virtual schemas and their parent schema contracts.',
    requestSchema: null,
    responseShape: { subschemas: [{ id: 'string', parentSchemaPath: 'string', accessibleFields: 'string[]', structure: 'tree' }] }
  },
  {
    id: 'createSubschema',
    method: 'POST',
    path: '/api/librarian/subschemas',
    description: 'Create a virtual schema that exposes only selected canonical field paths from a parent schema.',
    requestSchema: { id: 'string', label: 'string', parentSchemaPath: 'string', accessibleFields: 'string[]' },
    responseShape: { status: 'created', subschema: 'object' }
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
  },
  {
    id: 'listMapperRulesets',
    method: 'GET',
    path: '/api/librarian/mapper-rulesets',
    description: 'List mapper rulesets used to constrain source->destination map transforms.',
    requestSchema: null,
    responseShape: { rulesets: [{ id: 'string', sourcePatterns: 'string[]', targetPatterns: 'string[]' }] }
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
      subschemas: '/api/librarian/subschemas',
      dataTypes: '/api/librarian/data-types',
      mapperRulesets: '/api/librarian/mapper-rulesets'
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
    const files = await listFiles(LIBRARIAN_SERVICE_ROOT);
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Search files by name or extension
app.get('/api/librarian/search', async (req, res) => {
  const { q = '', ext = '' } = req.query;
  try {
    let files = await listFiles(LIBRARIAN_SERVICE_ROOT);
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

  const candidates = [
    path.resolve(LIBRARIAN_SERVICE_ROOT, relPath),
    path.resolve(SCHEMA_ROOT, relPath),
  ];
  const allowedRoots = [path.resolve(LIBRARIAN_SERVICE_ROOT), path.resolve(SCHEMA_ROOT)];

  let absPath = null;
  for (const candidate of candidates) {
    if (!allowedRoots.some(root => candidate.startsWith(root))) continue;
    try {
      await fs.access(candidate);
      absPath = candidate;
      break;
    } catch {
      // Try next candidate.
    }
  }

  if (!absPath) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    res.sendFile(absPath);
  } catch (e) {
    res.status(404).json({ error: 'File not found' });
  }
});


async function loadPhysicalSchemaCatalog() {
  const files = await listFiles(SCHEMA_ROOT);
  const lifecycleByPath = await loadSchemaLifecycleByPath();
  const schemas = files.map(async file => {
    const meta = parseSchemaFilename(file.name);
    if (!meta) return null;
    const lifecycle = lifecycleByPath[file.path] || {
      activeFrom: null,
      rejectAfter: null,
      keepForDisplay: true,
    };
    const structure = await extractStructureForFile(file.fullPath, meta.type);
    return {
      ...meta,
      typeId: inferTypeIdFromSchema(meta),
      path: file.path,
      size: file.size,
      mtime: file.mtime,
      structure,
      lifecycle: {
        activeFrom: lifecycle.activeFrom || null,
        rejectAfter: lifecycle.rejectAfter || null,
        keepForDisplay: lifecycle.keepForDisplay !== false,
        status: computeLifecycleStatus(lifecycle),
      },
    };
  });
  return (await Promise.all(schemas)).filter(Boolean);
}

function subschemaCatalogEntry(parent, definition, projection) {
  return {
    name: definition.id,
    label: definition.label,
    type: 'subschema',
    typeId: parent.typeId,
    path: `subschemas/${definition.id}`,
    parentSchemaPath: definition.parentSchemaPath,
    accessibleFields: definition.accessibleFields,
    availableFields: projection.availableFields,
    size: Buffer.byteLength(JSON.stringify(definition)),
    mtime: parent.mtime,
    structure: projection.structure,
    lifecycle: parent.lifecycle,
    virtual: true,
  };
}

async function projectSubschemaCatalog(physicalSchemas, definitions) {
  const parentByPath = new Map(physicalSchemas.map(schema => [schema.path, schema]));
  const schemas = [];
  for (const definition of definitions) {
    const parent = parentByPath.get(definition.parentSchemaPath);
    if (!parent) continue;
    const projection = await schemaTreeService.project(parent.structure, definition.accessibleFields);
    schemas.push(subschemaCatalogEntry(parent, definition, projection));
  }
  return schemas;
}

async function loadSubschemaCatalog(physicalSchemas) {
  return projectSubschemaCatalog(physicalSchemas, await loadSubschemas());
}

async function validateSubschemaDefinition(candidate) {
  const definition = normalizeSubschemaDefinition(candidate);
  const physicalSchemas = await loadPhysicalSchemaCatalog();
  const parent = physicalSchemas.find(schema => schema.path === definition.parentSchemaPath);
  if (!parent) {
    throw new Error(`Parent schema not found: ${definition.parentSchemaPath}`);
  }
  if (!parent.structure) {
    throw new Error(`Parent schema structure is unavailable: ${definition.parentSchemaPath}`);
  }
  const availableFields = await schemaTreeService.collect(parent.structure);
  const unknownFields = await findUnknownSubschemaFields(
    definition.accessibleFields,
    availableFields,
  );
  if (unknownFields.length > 0) {
    throw new Error(`Fields are not present in parent schema: ${unknownFields.join(', ')}`);
  }
  const projection = await schemaTreeService.project(parent.structure, definition.accessibleFields);
  return {
    definition: { ...definition, parentTypeId: String(parent.typeId || '').trim().toLowerCase() },
    parent, projection
  };
}

// List physical schemas and their field-restricted virtual subschemas.
app.get('/api/librarian/schemas', async (req, res) => {
  try {
    const physicalSchemas = await loadPhysicalSchemaCatalog();
    const subschemas = await loadSubschemaCatalog(physicalSchemas);
    res.json({ schemas: [...physicalSchemas, ...subschemas], subschemas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/librarian/schema-fields', async (req, res) => {
  try {
    const schemaPath = typeof req.query.path === 'string' ? req.query.path.trim().replace(/\\/g, '/') : '';
    if (!schemaPath) return res.status(400).json({ error: 'path is required' });
    const schema = (await loadPhysicalSchemaCatalog()).find(item => item.path === schemaPath);
    if (!schema) return res.status(404).json({ error: 'Schema not found' });
    if (!schema.structure) return res.status(422).json({ error: 'Schema structure is unavailable' });
    const availableFields = await schemaTreeService.collect(schema.structure);
    res.json({ path: schema.path, availableFields });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/librarian/subschemas', async (req, res) => {
  try {
    const physicalSchemas = await loadPhysicalSchemaCatalog();
    const subschemas = await loadSubschemaCatalog(physicalSchemas);
    res.json({ subschemas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/librarian/subschemas', async (req, res) => {
  try {
    const { definition, parent, projection } = await validateSubschemaDefinition(req.body || {});
    const result = await mutateSubschemas(async () => ({
      mutation: { operation: 'create', id: definition.id, definition }
    }));
    const subschema = subschemaCatalogEntry(parent, result.definition, projection);
    res.status(201).json({ status: 'created', subschema });
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

app.put('/api/librarian/subschemas/:id', async (req, res) => {
  try {
    const currentId = String(req.params.id || '').trim().toLowerCase();
    const result = await mutateSubschemas(async entries => {
      const existing = entries.find(item => item.id === currentId);
      if (!existing) throw Object.assign(new Error('Subschema not found'), { status: 404 });
      const { definition, parent, projection } = await validateSubschemaDefinition({
        ...existing, ...(req.body || {}), id: req.body?.id || currentId
      });
      return { mutation: { operation: 'update', id: currentId, definition }, parent, projection };
    });
    const subschema = subschemaCatalogEntry(result.parent, result.definition, result.projection);
    res.json({ status: 'updated', subschema });
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

app.delete('/api/librarian/subschemas/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim().toLowerCase();
    await mutateSubschemas(async () => ({ mutation: { operation: 'delete', id } }));
    res.json({ status: 'deleted', id });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
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

async function loadDataTypes() {
  const result = await catalogStore.mutateCatalog('data-types',
    async expected => ({ operation: 'replace', ...await dataTypeSnapshot(expected) }),
    async plan => ({ entries: await normalizeDataTypeCatalog(plan.entries) }));
  return result.entries;
}

function normalizeDataTypeCatalog(types) {
  return normalization.typeCatalog(types);
}

async function dataTypeSnapshot(expected) {
  const entries = await normalizeDataTypeCatalog(expected);
  if (entries.length > 0) return { entries };
  const legacy = await catalogStore.readLegacyDataTypes();
  const expectedLegacy = legacy === undefined ? [] : legacy;
  return { entries: await normalizeDataTypeCatalog(expectedLegacy), expectedLegacy };
}

async function mutateDataTypes(mutation) {
  await loadDataTypes();
  return catalogStore.mutateCatalog('data-types',
    async expected => ({ ...mutation, ...await dataTypeSnapshot(expected) }),
    async plan => {
      const entries = [...plan.entries];
      const record = plan.record && (mutation.operation === 'update' || mutation.operation === 'rename')
        ? await normalization.typeRecord(plan.record) : plan.record;
      if (plan.record) entries[plan.index] = record;
      return {
        entries: await normalizeDataTypeCatalog(entries),
        record: mutation.operation === 'rename' ? plan.record : record
      };
    });
}

async function loadStoredMapperRulesets() {
  const parsed = await catalogStore.read('mapper-rulesets');
  if (parsed === undefined) return [];
  if (!Array.isArray(parsed)) throw new Error('Mapper ruleset catalog must be a JSON array');
  return parsed;
}

function normalizeStoredMapperRulesets(stored) {
  return normalization.rulesetCatalog(stored);
}

async function loadMapperRulesets() {
  return normalizeStoredMapperRulesets(await loadStoredMapperRulesets());
}

async function mutateMapperRulesets(mutation) {
  return catalogStore.mutateCatalog('mapper-rulesets',
    async entries => ({ ...mutation, entries, visible: await normalizeStoredMapperRulesets(entries) }),
    async plan => {
      const entries = [...plan.entries];
      const record = plan.record ? await normalization.ruleset(plan.record) : undefined;
      if (record) entries[plan.index] = record;
      return { entries, record };
    });
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
    const { id, label, isIso } = req.body || {};
    if (!id || !label) return res.status(400).json({ error: 'id and label are required' });
    const creation = await normalization.createType({ id, label, isIso });
    const result = await mutateDataTypes({ operation: 'create', id: creation.id, record: creation.record });
    res.json({ status: 'created', type: result.record });
  } catch (e) {
    res.status(e.catalogDecision ? e.status : 500).json({ error: e.message });
  }
});

app.delete('/api/librarian/data-types/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim().toLowerCase();
    if (!id) return res.status(400).json({ error: 'id is required' });

    await mutateDataTypes({ operation: 'delete', id });
    res.json({ status: 'deleted', id });
  } catch (e) {
    res.status(e.catalogDecision ? e.status : 500).json({ error: e.message });
  }
});

app.post('/api/librarian/data-types/:id/rename', async (req, res) => {
  try {
    const currentId = String(req.params.id || '').trim().toLowerCase();
    const nextId = String(req.body?.newId || '').trim().toLowerCase();
    const nextLabel = String(req.body?.label || '').trim();
    if (!currentId) return res.status(400).json({ error: 'id is required' });
    if (!nextId) return res.status(400).json({ error: 'newId is required' });

    const result = await mutateDataTypes({
      operation: 'rename', id: currentId, nextId,
      patch: { label: nextLabel, isIso: req.body?.isIso }
    });
    res.json({ status: 'renamed', type: result.record });
  } catch (e) {
    res.status(e.catalogDecision ? e.status : 500).json({ error: e.message });
  }
});

app.patch('/api/librarian/data-types/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim().toLowerCase();
    if (!id) return res.status(400).json({ error: 'id is required' });

    const result = await mutateDataTypes({ operation: 'update', id,
      patch: { label: req.body?.label, isIso: req.body?.isIso } });
    res.json({ status: 'updated', type: result.record });
  } catch (e) {
    res.status(e.catalogDecision ? e.status : 500).json({ error: e.message });
  }
});

app.get('/api/librarian/mapper-rulesets', async (req, res) => {
  try {
    const rulesets = await loadMapperRulesets();
    res.json({ rulesets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/librarian/mapper-rulesets', async (req, res) => {
  try {
    const normalized = await normalization.ruleset(req.body || {});
    const result = await mutateMapperRulesets({ operation: 'create', id: normalized.id, record: normalized });
    res.json({ status: 'created', ruleset: result.record });
  } catch (e) {
    res.status(e.catalogDecision ? e.status : 400).json({ error: e.message });
  }
});

app.put('/api/librarian/mapper-rulesets/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim().toUpperCase();
    if (!id) return res.status(400).json({ error: 'id is required' });

    const requestedId = await normalization.rulesetId(req.body?.id || id);

    const result = await mutateMapperRulesets({ operation: 'update', id, nextId: requestedId, patch: req.body || {} });
    res.json({ status: 'updated', ruleset: result.record });
  } catch (e) {
    res.status(e.catalogDecision ? e.status : 400).json({ error: e.message });
  }
});

app.delete('/api/librarian/mapper-rulesets/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim().toUpperCase();
    if (!id) return res.status(400).json({ error: 'id is required' });

    await mutateMapperRulesets({ operation: 'delete', id });
    res.json({ status: 'deleted', id });
  } catch (e) {
    res.status(e.catalogDecision ? e.status : 500).json({ error: e.message });
  }
});

app.delete('/api/librarian/schemas', async (req, res) => {
  try {
    const relPath = String(req.body?.path || '').trim().replace(/\\/g, '/');
    if (!relPath) return res.status(400).json({ error: 'path is required' });

    const dependentSubschemas = (await loadSubschemas()).filter(item => item.parentSchemaPath === relPath);
    if (dependentSubschemas.length > 0) {
      return res.status(409).json({
        error: `Schema is used by subschemas: ${dependentSubschemas.map(item => item.id).join(', ')}`
      });
    }

    const absPath = path.resolve(SCHEMA_ROOT, relPath);
    if (!absPath.startsWith(path.resolve(SCHEMA_ROOT))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await fs.unlink(absPath);
    await mutateSchemaLifecycle('delete', relPath);

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

    const nextRelPath = path.relative(SCHEMA_ROOT, nextAbsPath).replace(/\\/g, '/');
    await mutateSchemaLifecycle('rename', currentPath, { nextId: nextRelPath });

    await mutateSubschemas(async () => ({
      mutation: { operation: 'rename-parent', previousPath: currentPath, nextPath: nextRelPath }
    }));

    res.json({ status: 'renamed', path: nextRelPath });
  } catch (e) {
    if (e.code === 'ENOENT') {
      return res.status(404).json({ error: 'Schema not found' });
    }
    res.status(500).json({ error: e.message });
  }
});

// Upload a file into the librarian repository
// :dest = 'schemas' (writes to SCHEMA_ROOT) or 'data' (writes to LIBRARIAN_SERVICE_ROOT)
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
  const targetDir = dest === 'schemas' ? SCHEMA_ROOT : LIBRARIAN_SERVICE_ROOT;
  const targetPath = path.join(targetDir, rawFilename);
  // Final safety check: resolved path must stay inside targetDir
  if (!path.resolve(targetPath).startsWith(path.resolve(targetDir))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const filename = process.platform === 'win32' ? rawFilename.toLowerCase().replace(/[ .]+$/, '') : rawFilename;
    const catalogName = ['subschemas', 'schema-lifecycle', 'data-types', 'mapper-rulesets']
      .find(name => filename === `${name}.json`);
    if (dest === 'data' && catalogName) {
      const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(req.body);
      await catalogStore.writeText(catalogName, content);
    } else {
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(targetPath, req.body);
    }
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

    const lifecycle = {
      activeFrom: normalizedActiveFrom,
      rejectAfter: normalizedRejectAfter,
      keepForDisplay: keepForDisplay !== false,
    };
    const result = await mutateSchemaLifecycle('set', schemaPath, { record: lifecycle });

    res.json({
      status: 'updated',
      path: schemaPath,
      lifecycle: {
        ...result.record,
        status: computeLifecycleStatus(result.record),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'data-librarian' });
});

const PORT = readEnvNumber('LIBRARIAN_PORT', 4300);

await ensureLibrarianStorageLayout();
catalogStore = await createPascalishCatalogStore({
  root: LIBRARIAN_SERVICE_ROOT, legacyRoot: DATA_ROOT,
  maxFileBytes: readEnvNumber('LIBRARIAN_CATALOG_MAX_BYTES', 262144)
});

subschemaPolicyHost = await startSubschemaPolicyHost();
xsdParser = await createPascalishXsdParser({ schemaRoot: SCHEMA_ROOT });
schemaTreeService = await createPascalishSchemaTreeService();
normalization = await createPascalishLibrarianNormalization();

app.listen(PORT, () => {
  console.log(`[Librarian] Service running on http://localhost:${PORT}`);
  console.log(`[Librarian] Data root: ${DATA_ROOT}`);
});
