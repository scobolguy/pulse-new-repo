import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readEnvNumber } from './src/env-config.mjs';
import { compilePascalishProgramWithAntlr } from './scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../pmachines/javascript/src/service-host.mjs';
import { createPascalishCatalogStore } from './src/librarian/~catalog-store.mjs';
import { createPascalishXsdParser } from './src/librarian/~xsd-parser.mjs';
import { createPascalishSchemaTreeService } from './src/librarian/schema-tree-service.mjs';
import { createPascalishSchemaStructureService } from './src/librarian/schema-structure-service.mjs';
import { createPascalishLibrarianNormalization } from './src/librarian/~normalization.mjs';
import { createPascalishLibrarianMetadataRoutes } from './src/librarian/metadata-routes.mjs';
import { createPascalishLibrarianSchemaFieldsRoutes } from './src/librarian/schema-fields-routes.mjs';
import { createPascalishLibrarianSearchRoutes } from './src/librarian/search-routes.mjs';
import { createPascalishLibrarianSchemaLookupRoutes } from './src/librarian/schema-lookup-routes.mjs';
import { createPascalishLibrarianSchemaCatalogRoutes } from './src/librarian/schema-catalog-routes.mjs';
import { createPascalishLibrarianFileDownloadRoutes } from './src/librarian/file-download-routes.mjs';
import { createPascalishLibrarianSubschemaMutationRoutes } from './src/librarian/subschema-mutation-routes.mjs';
import { createPascalishLibrarianDataTypeRoutes } from './src/librarian/data-type-routes.mjs';
import { createPascalishLibrarianMapperRulesetRoutes } from './src/librarian/mapper-ruleset-routes.mjs';
import { createPascalishLibrarianSchemaOperationRoutes } from './src/librarian/schema-operation-routes.mjs';
import { createPascalishLibrarianUploadRoutes } from './src/librarian/upload-routes.mjs';

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
let schemaStructureService;
let normalization;
let metadataRoutes;
let schemaFieldsRoutes;
let searchRoutes;
let schemaLookupRoutes;
let schemaCatalogRoutes;
let fileDownloadRoutes;
let subschemaMutationRoutes;
let dataTypeRoutes;
let mapperRulesetRoutes;
let schemaOperationRoutes;
let uploadRoutes;

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function isPathWithinRoot(rootPath, targetPath) {
  const root = path.resolve(rootPath);
  const relative = path.relative(root, path.resolve(targetPath));
  return relative !== '' && relative !== '..'
    && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
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
      return schemaStructureService.parseCopybook(content);
    }
    if (lowerType !== 'json' && lowerType !== 'json-schema') {
      return null;
    }
    const parsed = JSON.parse(content);
    const normalizedContent = JSON.stringify(parsed);
    const isSchema = lowerType === 'json-schema'
      || (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        && (parsed.type === 'object' || parsed.properties || parsed.items || parsed.enum));
    return isSchema
      ? schemaStructureService.parseJsonSchema(normalizedContent)
      : schemaStructureService.parseJsonValue(normalizedContent);
  } catch {
    return null;
  }
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
  return normalization.subschemaCatalog(parsed);
}

async function mutateSubschemas(prepare) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const stored = await catalogStore.read('subschemas');
    const expected = stored === undefined ? [] : stored;
    const entries = await normalization.subschemaCatalog(expected);
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

app.use(async (req, res, next) => {
  const requestPath = new URL(req.originalUrl, 'http://localhost').pathname;
  if (requestPath !== '/health' && !requestPath.startsWith('/api/librarian/llm/')) {
    return next();
  }
  try {
    const result = await metadataRoutes.dispatch({ method: req.method, path: requestPath });
    if (!result.matched) return next();
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
});

// List all files
app.get('/api/librarian/files', async (req, res) => {
  try {
    const files = await listFiles(LIBRARIAN_SERVICE_ROOT);
    const result = await metadataRoutes.dispatch({
      method: req.method, path: '/api/librarian/files', files
    });
    if (!result.matched) throw new Error('Pascalish metadata route did not match');
    return res.status(result.status).json(result.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Search files by name or extension
app.get('/api/librarian/search', async (req, res) => {
  try {
    const files = await listFiles(LIBRARIAN_SERVICE_ROOT);
    const result = await searchRoutes.dispatch({
      method: req.method,
      path: '/api/librarian/search',
      q: req.query.q ?? '',
      ext: req.query.ext ?? '',
      files
    });
    if (!result.matched) return res.status(result.status).json(result.body);
    return res.status(result.status).json(result.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download a file — use app.use so the path after /file/ is captured in req.path
app.use('/api/librarian/file', async (req, res) => {
  const relPath = req.path.replace(/^\//, '');
  const candidates = [
    path.resolve(LIBRARIAN_SERVICE_ROOT, relPath),
    path.resolve(SCHEMA_ROOT, relPath),
  ];
  const candidateRoots = [path.resolve(LIBRARIAN_SERVICE_ROOT), path.resolve(SCHEMA_ROOT)];
  const existingCandidates = [];
  for (const [index, candidate] of candidates.entries()) {
    const relativePath = path.relative(candidateRoots[index], candidate);
    if (relativePath === '' || relativePath === '..'
      || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      existingCandidates.push(false);
      continue;
    }
    try {
      await fs.access(candidate);
      existingCandidates.push(true);
    } catch {
      existingCandidates.push(false);
    }
  }

  const result = await fileDownloadRoutes.dispatch({
    method: req.method,
    path: new URL(req.originalUrl, 'http://localhost').pathname,
    filePath: relPath,
    candidateExists: existingCandidates
  });
  if (!result.matched) return res.status(404).json({ error: 'File not found' });
  if (result.status !== 200) return res.status(result.status).json(result.body);
  return res.sendFile(candidates[result.body.selectedIndex]);
});


async function loadPhysicalSchemaCatalog() {
  const files = await listFiles(SCHEMA_ROOT);
  const lifecycleByPath = await loadSchemaLifecycleByPath();
  const schemas = [];
  for (const file of files) {
    const meta = await schemaStructureService.parseFilename(file.name);
    if (!meta) continue;
    const lifecycle = lifecycleByPath[file.path] || {
      activeFrom: null,
      rejectAfter: null,
      keepForDisplay: true,
    };
    schemas.push({ file, meta, lifecycle });
  }
  const catalog = [];
  // The structure host has a bounded event queue; do not submit a whole catalog at once.
  for (let offset = 0; offset < schemas.length; offset += 8) {
    const batch = await Promise.all(schemas.slice(offset, offset + 8).map(async ({ file, meta, lifecycle }) => ({
      ...meta,
      path: file.path,
      size: file.size,
      mtime: file.mtime,
      structure: await extractStructureForFile(file.fullPath, meta.type),
      lifecycle,
    })));
    catalog.push(...batch);
  }
  for (const schema of catalog) {
    schema.lifecycle = await normalization.lifecycleDisplay(schema.lifecycle);
  }
  return catalog;
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
  const definition = await normalization.subschema(candidate);
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
    const result = await schemaCatalogRoutes.dispatch({
      method: req.method,
      path: '/api/librarian/schemas',
      physicalSchemas,
      subschemas
    });
    if (!result.matched) throw new Error('Pascalish Librarian schema-catalog route did not match');
    res.status(result.status).json(result.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/librarian/schema-fields', async (req, res) => {
  try {
    const schemaPath = typeof req.query.path === 'string'
      ? req.query.path.trim().replace(/\\/g, '/')
      : '';
    const schema = schemaPath
      ? (await loadPhysicalSchemaCatalog()).find(item => item.path === schemaPath)
      : null;
    const availableFields = schema?.structure
      ? await schemaTreeService.collect(schema.structure)
      : [];
    const result = await schemaFieldsRoutes.dispatch({
      method: req.method,
      path: '/api/librarian/schema-fields',
      schemaPath,
      found: Boolean(schema),
      structureAvailable: Boolean(schema?.structure),
      availableFields
    });
    if (!result.matched) throw new Error('Pascalish Librarian schema-field route did not match');
    res.status(result.status).json(result.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/librarian/subschemas', async (req, res) => {
  try {
    const physicalSchemas = await loadPhysicalSchemaCatalog();
    const subschemas = await loadSubschemaCatalog(physicalSchemas);
    const result = await schemaCatalogRoutes.dispatch({
      method: req.method,
      path: '/api/librarian/subschemas',
      subschemas
    });
    if (!result.matched) throw new Error('Pascalish Librarian schema-catalog route did not match');
    res.status(result.status).json(result.body);
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
    const routeResult = await subschemaMutationRoutes.dispatch({
      method: req.method,
      path: '/api/librarian/subschemas',
      id: definition.id,
      subschema
    });
    if (!routeResult.matched) throw new Error('Pascalish Librarian subschema mutation route did not match');
    return res.status(routeResult.status).json(routeResult.body);
  } catch (e) {
    const routeResult = await subschemaMutationRoutes.dispatch({
      method: req.method,
      path: '/api/librarian/subschemas',
      error: e.message,
      errorStatus: e.status || 400
    });
    if (!routeResult.matched) throw new Error('Pascalish Librarian subschema mutation route did not match');
    return res.status(routeResult.status).json(routeResult.body);
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
    const routeResult = await subschemaMutationRoutes.dispatch({
      method: req.method,
      path: '/api/librarian/subschemas/:id',
      id: currentId,
      subschema
    });
    if (!routeResult.matched) throw new Error('Pascalish Librarian subschema mutation route did not match');
    return res.status(routeResult.status).json(routeResult.body);
  } catch (e) {
    const routeResult = await subschemaMutationRoutes.dispatch({
      method: req.method,
      path: '/api/librarian/subschemas/:id',
      error: e.message,
      errorStatus: e.status || 400
    });
    if (!routeResult.matched) throw new Error('Pascalish Librarian subschema mutation route did not match');
    return res.status(routeResult.status).json(routeResult.body);
  }
});

app.delete('/api/librarian/subschemas/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim().toLowerCase();
    await mutateSubschemas(async () => ({ mutation: { operation: 'delete', id } }));
    const routeResult = await subschemaMutationRoutes.dispatch({
      method: req.method,
      path: '/api/librarian/subschemas/:id',
      id
    });
    if (!routeResult.matched) throw new Error('Pascalish Librarian subschema mutation route did not match');
    return res.status(routeResult.status).json(routeResult.body);
  } catch (e) {
    const routeResult = await subschemaMutationRoutes.dispatch({
      method: req.method,
      path: '/api/librarian/subschemas/:id',
      error: e.message,
      errorStatus: e.status || 500
    });
    if (!routeResult.matched) throw new Error('Pascalish Librarian subschema mutation route did not match');
    return res.status(routeResult.status).json(routeResult.body);
  }
});

// Lookup schema by type/name (version is optional query param: ?version=1)
app.get('/api/librarian/schema/:type/:name', async (req, res) => {
  const { type, name } = req.params;
  const version = req.query.version ? parseInt(req.query.version, 10) : null;
  try {
    const schemas = [];
    for (const file of await listFiles(SCHEMA_ROOT)) {
      const meta = await schemaStructureService.parseFilename(file.name);
      if (!meta) continue;
      schemas.push({ ...meta, fullPath: file.fullPath });
    }
    const result = await schemaLookupRoutes.dispatch({
      method: req.method,
      path: '/api/librarian/schema/:type/:name',
      type,
      name,
      version: Number.isFinite(version) ? version : null,
      schemas
    });
    if (!result.matched) throw new Error('Pascalish Librarian schema-lookup route did not match');
    if (result.status !== 200) return res.status(result.status).json(result.body);
    return res.sendFile(schemas[result.body.selectedIndex].fullPath);
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
    const result = await dataTypeRoutes.dispatch({
      method: req.method, path: '/api/librarian/data-types', types
    });
    if (!result.matched) throw new Error('Pascalish data-type route did not match');
    return res.status(result.status).json(result.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/librarian/data-types', async (req, res) => {
  const request = { ...req.body, method: req.method, path: '/api/librarian/data-types' };
  try {
    const validation = await dataTypeRoutes.dispatch({ ...request, phase: 'validate' });
    if (!validation.matched) throw new Error('Pascalish data-type route did not match');
    if (validation.status !== 200) return res.status(validation.status).json(validation.body);
    const { id, label, isIso } = req.body || {};
    const creation = await normalization.createType({ id, label, isIso });
    const result = await mutateDataTypes({ operation: 'create', id: creation.id, record: creation.record });
    const routeResult = await dataTypeRoutes.dispatch({ ...request, type: result.record });
    return res.status(routeResult.status).json(routeResult.body);
  } catch (e) {
    const routeResult = await dataTypeRoutes.dispatch({
      ...request, error: e.message, errorStatus: e.status || 500,
      catalogDecision: e.catalogDecision ? 1 : 0
    });
    return res.status(routeResult.status).json(routeResult.body);
  }
});

app.delete('/api/librarian/data-types/:id', async (req, res) => {
  const request = { method: req.method, path: '/api/librarian/data-types/:id', id: req.params.id };
  try {
    const id = String(req.params.id || '').trim().toLowerCase();
    const validation = await dataTypeRoutes.dispatch({ ...request, id, phase: 'validate' });
    if (!validation.matched) throw new Error('Pascalish data-type route did not match');
    if (validation.status !== 200) return res.status(validation.status).json(validation.body);
    await mutateDataTypes({ operation: 'delete', id });
    const routeResult = await dataTypeRoutes.dispatch({ ...request, id });
    return res.status(routeResult.status).json(routeResult.body);
  } catch (e) {
    const routeResult = await dataTypeRoutes.dispatch({
      ...request, error: e.message, errorStatus: e.status || 500,
      catalogDecision: e.catalogDecision ? 1 : 0
    });
    return res.status(routeResult.status).json(routeResult.body);
  }
});

app.post('/api/librarian/data-types/:id/rename', async (req, res) => {
  const request = {
    method: req.method, path: '/api/librarian/data-types/:id/rename',
    id: req.params.id, newId: req.body?.newId
  };
  try {
    const currentId = String(req.params.id || '').trim().toLowerCase();
    const nextId = String(req.body?.newId || '').trim().toLowerCase();
    const nextLabel = String(req.body?.label || '').trim();
    const validation = await dataTypeRoutes.dispatch({
      ...request, id: currentId, newId: nextId, phase: 'validate'
    });
    if (!validation.matched) throw new Error('Pascalish data-type route did not match');
    if (validation.status !== 200) return res.status(validation.status).json(validation.body);
    const result = await mutateDataTypes({
      operation: 'rename', id: currentId, nextId,
      patch: { label: nextLabel, isIso: req.body?.isIso }
    });
    const routeResult = await dataTypeRoutes.dispatch({ ...request, type: result.record });
    return res.status(routeResult.status).json(routeResult.body);
  } catch (e) {
    const routeResult = await dataTypeRoutes.dispatch({
      ...request, error: e.message, errorStatus: e.status || 500,
      catalogDecision: e.catalogDecision ? 1 : 0
    });
    return res.status(routeResult.status).json(routeResult.body);
  }
});

app.patch('/api/librarian/data-types/:id', async (req, res) => {
  const request = { method: req.method, path: '/api/librarian/data-types/:id', id: req.params.id };
  try {
    const id = String(req.params.id || '').trim().toLowerCase();
    const validation = await dataTypeRoutes.dispatch({ ...request, id, phase: 'validate' });
    if (!validation.matched) throw new Error('Pascalish data-type route did not match');
    if (validation.status !== 200) return res.status(validation.status).json(validation.body);
    const result = await mutateDataTypes({ operation: 'update', id,
      patch: { label: req.body?.label, isIso: req.body?.isIso } });
    const routeResult = await dataTypeRoutes.dispatch({ ...request, type: result.record });
    return res.status(routeResult.status).json(routeResult.body);
  } catch (e) {
    const routeResult = await dataTypeRoutes.dispatch({
      ...request, error: e.message, errorStatus: e.status || 500,
      catalogDecision: e.catalogDecision ? 1 : 0
    });
    return res.status(routeResult.status).json(routeResult.body);
  }
});

app.get('/api/librarian/mapper-rulesets', async (req, res) => {
  try {
    const rulesets = await loadMapperRulesets();
    const result = await mapperRulesetRoutes.dispatch({
      method: req.method, path: '/api/librarian/mapper-rulesets', rulesets
    });
    if (!result.matched) throw new Error('Pascalish mapper-ruleset route did not match');
    return res.status(result.status).json(result.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/librarian/mapper-rulesets', async (req, res) => {
  const request = { method: req.method, path: '/api/librarian/mapper-rulesets' };
  try {
    const normalized = await normalization.ruleset(req.body || {});
    const result = await mutateMapperRulesets({ operation: 'create', id: normalized.id, record: normalized });
    const routeResult = await mapperRulesetRoutes.dispatch({ ...request, ruleset: result.record });
    return res.status(routeResult.status).json(routeResult.body);
  } catch (e) {
    const routeResult = await mapperRulesetRoutes.dispatch({
      ...request, error: e.message, errorStatus: e.status || 400,
      catalogDecision: e.catalogDecision ? 1 : 0
    });
    return res.status(routeResult.status).json(routeResult.body);
  }
});

app.put('/api/librarian/mapper-rulesets/:id', async (req, res) => {
  const request = {
    method: req.method, path: '/api/librarian/mapper-rulesets/:id',
    id: req.params.id
  };
  try {
    const id = String(req.params.id || '').trim().toUpperCase();
    const validation = await mapperRulesetRoutes.dispatch({ ...request, id, phase: 'validate' });
    if (!validation.matched) throw new Error('Pascalish mapper-ruleset route did not match');
    if (validation.status !== 200) return res.status(validation.status).json(validation.body);

    const requestedId = await normalization.rulesetId(req.body?.id || id);

    const result = await mutateMapperRulesets({ operation: 'update', id, nextId: requestedId, patch: req.body || {} });
    const routeResult = await mapperRulesetRoutes.dispatch({ ...request, id, ruleset: result.record });
    return res.status(routeResult.status).json(routeResult.body);
  } catch (e) {
    const routeResult = await mapperRulesetRoutes.dispatch({
      ...request, error: e.message, errorStatus: e.status || 400,
      catalogDecision: e.catalogDecision ? 1 : 0
    });
    return res.status(routeResult.status).json(routeResult.body);
  }
});

app.delete('/api/librarian/mapper-rulesets/:id', async (req, res) => {
  const request = {
    method: req.method, path: '/api/librarian/mapper-rulesets/:id',
    id: req.params.id
  };
  try {
    const id = String(req.params.id || '').trim().toUpperCase();
    const validation = await mapperRulesetRoutes.dispatch({ ...request, id, phase: 'validate' });
    if (!validation.matched) throw new Error('Pascalish mapper-ruleset route did not match');
    if (validation.status !== 200) return res.status(validation.status).json(validation.body);

    await mutateMapperRulesets({ operation: 'delete', id });
    const routeResult = await mapperRulesetRoutes.dispatch({ ...request, id });
    return res.status(routeResult.status).json(routeResult.body);
  } catch (e) {
    const routeResult = await mapperRulesetRoutes.dispatch({
      ...request, error: e.message, errorStatus: e.status || 500,
      catalogDecision: e.catalogDecision ? 1 : 0
    });
    return res.status(routeResult.status).json(routeResult.body);
  }
});

app.delete('/api/librarian/schemas', async (req, res) => {
  const routeRequest = {
    method: req.method,
    path: '/api/librarian/schemas',
    schemaPath: String(req.body?.path || '').trim().replace(/\\/g, '/')
  };
  try {
    const relPath = routeRequest.schemaPath;
    const absPath = path.resolve(SCHEMA_ROOT, relPath);
    let exists = true;
    try { await fs.access(absPath); } catch (error) {
      if (error.code === 'ENOENT') exists = false;
      else throw error;
    }
    const dependentIds = (await loadSubschemas())
      .filter(item => item.parentSchemaPath === relPath).map(item => item.id);
    const validation = await schemaOperationRoutes.dispatch({
      ...routeRequest,
      phase: 'validate',
      safe: String(isPathWithinRoot(SCHEMA_ROOT, absPath)),
      exists: String(exists),
      hasDependents: String(dependentIds.length > 0),
      dependentIds
    });
    if (!validation.matched) throw new Error('Pascalish schema-operation route did not match');
    if (validation.status !== 200) return res.status(validation.status).json(validation.body);
    await fs.unlink(absPath);
    await mutateSchemaLifecycle('delete', relPath);
    const result = await schemaOperationRoutes.dispatch(routeRequest);
    return res.status(result.status).json(result.body);
  } catch (e) {
    const result = await schemaOperationRoutes.dispatch({
      ...routeRequest, error: e.message, notFound: e.code === 'ENOENT' ? 1 : 0
    });
    return res.status(result.status).json(result.body);
  }
});

app.post('/api/librarian/schemas/rename', async (req, res) => {
  const routeRequest = {
    method: req.method,
    path: '/api/librarian/schemas/rename',
    schemaPath: String(req.body?.path || '').trim().replace(/\\/g, '/'),
    newName: String(req.body?.newName || '').trim()
  };
  try {
    const currentPath = routeRequest.schemaPath;
    const newName = routeRequest.newName;
    const currentAbsPath = path.resolve(SCHEMA_ROOT, currentPath);
    const currentDir = path.dirname(currentAbsPath);
    const currentExt = path.extname(currentAbsPath) || '.xsd';
    const nextFileName = newName.endsWith(currentExt) ? newName : `${newName}${currentExt}`;
    const nextAbsPath = path.resolve(currentDir, nextFileName);
    let exists = true;
    try { await fs.access(currentAbsPath); } catch (error) {
      if (error.code === 'ENOENT') exists = false;
      else throw error;
    }
    const validation = await schemaOperationRoutes.dispatch({
      ...routeRequest,
      phase: 'validate',
      safe: String(isPathWithinRoot(SCHEMA_ROOT, currentAbsPath)
        && isPathWithinRoot(SCHEMA_ROOT, nextAbsPath)),
      exists: String(exists)
    });
    if (!validation.matched) throw new Error('Pascalish schema-operation route did not match');
    if (validation.status !== 200) return res.status(validation.status).json(validation.body);
    await fs.mkdir(path.dirname(nextAbsPath), { recursive: true });
    await fs.rename(currentAbsPath, nextAbsPath);

    const nextRelPath = path.relative(SCHEMA_ROOT, nextAbsPath).replace(/\\/g, '/');
    await mutateSchemaLifecycle('rename', currentPath, { nextId: nextRelPath });

    await mutateSubschemas(async () => ({
      mutation: { operation: 'rename-parent', previousPath: currentPath, nextPath: nextRelPath }
    }));
    const result = await schemaOperationRoutes.dispatch({ ...routeRequest, nextPath: nextRelPath });
    return res.status(result.status).json(result.body);
  } catch (e) {
    const result = await schemaOperationRoutes.dispatch({
      ...routeRequest, error: e.message, notFound: e.code === 'ENOENT' ? 1 : 0
    });
    return res.status(result.status).json(result.body);
  }
});

// Upload a file into the librarian repository
// :dest = 'schemas' (writes to SCHEMA_ROOT) or 'data' (writes to LIBRARIAN_SERVICE_ROOT)
app.post('/api/librarian/upload/:dest', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
  const dest = req.params.dest;
  const rawFilename = (req.get('x-filename') || '').trim();
  const targetDir = dest === 'schemas' ? SCHEMA_ROOT : LIBRARIAN_SERVICE_ROOT;
  const targetPath = path.join(targetDir, rawFilename);
  const routeRequest = {
    method: req.method,
    path: '/api/librarian/upload/:dest',
    dest,
    filename: rawFilename,
    safe: isPathWithinRoot(targetDir, targetPath) ? 1 : 0,
    size: req.body?.length || 0
  };
  const respond = async additional => {
    const result = await uploadRoutes.dispatch({ ...routeRequest, ...additional });
    if (!result.matched) throw new Error('Pascalish upload route did not match');
    return res.status(result.status).json(result.body);
  };
  let filename;
  let catalogName;
  let isCatalogWrite = false;

  const validation = await uploadRoutes.dispatch(routeRequest);
  if (!validation.matched) return res.status(404).json({ error: 'Upload route not found' });
  if (validation.status !== 200) return res.status(validation.status).json(validation.body);
  try {
    filename = process.platform === 'win32' ? rawFilename.toLowerCase().replace(/[ .]+$/, '') : rawFilename;
    catalogName = ['subschemas', 'schema-lifecycle', 'data-types', 'mapper-rulesets']
      .find(name => filename === `${name}.json`);
    isCatalogWrite = dest === 'data' && Boolean(catalogName);
    if (isCatalogWrite) {
      const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(req.body);
      await catalogStore.writeText(catalogName, content);
    } else {
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(targetPath, req.body);
    }
    return await respond({});
  } catch (e) {
    return await respond({ error: e.message });
  }
});

app.post('/api/librarian/schema-lifecycle', async (req, res) => {
  const routeRequest = {
    method: req.method,
    path: '/api/librarian/schema-lifecycle',
    schemaPath: req.body?.path || ''
  };
  try {
    const { path: schemaPath, activeFrom, rejectAfter, keepForDisplay } = req.body || {};
    const files = await listFiles(SCHEMA_ROOT);
    const exists = files.some(file => file.path === schemaPath);
    const validation = await schemaOperationRoutes.dispatch({
      ...routeRequest, phase: 'validate', exists: String(exists)
    });
    if (!validation.matched) throw new Error('Pascalish schema-operation route did not match');
    if (validation.status !== 200) return res.status(validation.status).json(validation.body);
    const lifecycle = await normalization.lifecycle({ activeFrom, rejectAfter, keepForDisplay });
    const result = await mutateSchemaLifecycle('set', schemaPath, { record: lifecycle });
    const routeResult = await schemaOperationRoutes.dispatch({
      ...routeRequest,
      lifecycle: await normalization.lifecycleDisplay(result.record)
    });
    return res.status(routeResult.status).json(routeResult.body);
  } catch (e) {
    const routeResult = await schemaOperationRoutes.dispatch({
      ...routeRequest,
      error: e.message,
      validation: e.normalizationValidation ? 1 : 0
    });
    return res.status(routeResult.status).json(routeResult.body);
  }
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
schemaStructureService = await createPascalishSchemaStructureService();
normalization = await createPascalishLibrarianNormalization();
metadataRoutes = await createPascalishLibrarianMetadataRoutes();
schemaFieldsRoutes = await createPascalishLibrarianSchemaFieldsRoutes();
searchRoutes = await createPascalishLibrarianSearchRoutes();
schemaLookupRoutes = await createPascalishLibrarianSchemaLookupRoutes();
schemaCatalogRoutes = await createPascalishLibrarianSchemaCatalogRoutes();
fileDownloadRoutes = await createPascalishLibrarianFileDownloadRoutes();
subschemaMutationRoutes = await createPascalishLibrarianSubschemaMutationRoutes();
dataTypeRoutes = await createPascalishLibrarianDataTypeRoutes();
mapperRulesetRoutes = await createPascalishLibrarianMapperRulesetRoutes();
schemaOperationRoutes = await createPascalishLibrarianSchemaOperationRoutes();
uploadRoutes = await createPascalishLibrarianUploadRoutes();

app.listen(PORT, () => {
  console.log(`[Librarian] Service running on http://localhost:${PORT}`);
  console.log(`[Librarian] Data root: ${DATA_ROOT}`);
});
