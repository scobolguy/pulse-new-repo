import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createNewDocumentFileName, DOCUMENT_TYPES, getDocumentTypeByFileName, getDocumentTypeById, normalizeDocumentFileName } from '../documentRegistry.js';
import { compileRouterMapperDSL } from '../../scripts/compile-pascal.mjs';
import { compileCobolishToPmachine, compileVbishToPmachine } from '../../scripts/compile-interoperable-language.mjs';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../../pmachines/javascript/index.mjs';
import {
  buildPascalishLibrarianContracts,
  validatePascalishSubschemaMappings
} from '../librarianSchemaContracts.js';

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
const workspaceRoot = path.join(runtimeRoot, 'develop-documents');
const librarianSubschemasPath = path.join(runtimeRoot, 'services', 'librarian', 'subschemas.json');
const DEFAULT_LIBRARIAN_PORT = 4300;

function librarianOrigin() {
  return String(process.env.LIBRARIAN_URL || `http://127.0.0.1:${DEFAULT_LIBRARIAN_PORT}`).replace(/\/+$/, '');
}

async function fetchLibrarianCatalog(path, field) {
  const response = await fetch(`${librarianOrigin()}${path}`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Data Librarian request failed (${response.status}): ${path}`);
  }
  const payload = await response.json();
  if (!payload || !Array.isArray(payload[field])) {
    throw new Error(`Data Librarian returned an invalid ${field} catalog`);
  }
  return payload[field];
}

function normalizeImportName(value) {
  return String(value || '').trim().toLowerCase();
}

function validateImportedMappingFields(dataMappings, imported) {
  const errors = [];
  for (const mapping of Array.isArray(dataMappings) ? dataMappings : []) {
    const sourceType = normalizeImportName(mapping.sourceTypeId);
    const targetType = normalizeImportName(mapping.targetTypeId);
    const sourceFields = imported.typeFieldMap[sourceType];
    const targetFields = imported.typeFieldMap[targetType];
    for (const item of Array.isArray(mapping.items) ? mapping.items : []) {
      if (Array.isArray(sourceFields) && !sourceFields.includes(item.sourcePath)) {
        errors.push(`Mapper ${mapping.id}: unknown source field "${item.sourcePath}" for Data Librarian type "${mapping.sourceTypeId}"`);
      }
      if (Array.isArray(targetFields) && !targetFields.includes(item.targetPath)) {
        errors.push(`Mapper ${mapping.id}: unknown target field "${item.targetPath}" for Data Librarian type "${mapping.targetTypeId}"`);
      }
    }
  }
  if (errors.length > 0) throw new Error(`Pascalish Data Librarian field validation failed:\n${errors.join('\n')}`);
}

function validateImportedVariableFieldAccesses(sourceText, variableDeclarations, imported) {
  const variableTypes = new Map(
    (Array.isArray(variableDeclarations) ? variableDeclarations : [])
      .filter(variable => variable?.name && variable?.dataType?.id)
      .map(variable => [normalizeImportName(variable.name), normalizeImportName(variable.dataType.id)])
  );
  const sourceWithoutLiterals = String(sourceText || '').replace(
    /'(?:''|[^'])*'|"(?:[^"]|"")*"|\{[^}]*\}|\(\*[\s\S]*?\*\)|\/\/[^\r\n]*/g,
    value => value.replace(/[^\r\n]/g, ' ')
  );
  const errors = [];
  const accessPattern = /\b([A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)+)\b/g;
  for (const match of sourceWithoutLiterals.matchAll(accessPattern)) {
    const segments = match[1].split('.');
    const typeName = variableTypes.get(normalizeImportName(segments[0]));
    const fields = imported.typeFieldMap[typeName];
    if (!Array.isArray(fields)) continue;
    const fieldPath = segments.slice(1).join('.');
    if (!fields.includes(fieldPath)) {
      errors.push(`Unknown field "${fieldPath}" on Data Librarian type "${typeName}"`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`Pascalish Data Librarian field validation failed:\n${[...new Set(errors)].join('\n')}`);
  }
}

async function resolveLibrarianImports(compiled) {
  const imports = Array.isArray(compiled?.programMap?.librarianImports)
    ? compiled.programMap.librarianImports
    : [];
  if (imports.length === 0) return { typeNames: [], typeFieldMap: {} };
  const importNames = imports.map(item => String(item?.name || '').trim()).filter(Boolean);
  if (importNames.length !== imports.length) throw new Error('Data Librarian import names must not be empty');

  const [dataTypes, schemas] = await Promise.all([
    fetchLibrarianCatalog('/api/librarian/data-types', 'types'),
    fetchLibrarianCatalog('/api/librarian/schemas', 'schemas')
  ]);
  const allContracts = buildPascalishLibrarianContracts(dataTypes, schemas);
  const dataTypeByName = new Map();
  for (const type of dataTypes) {
    for (const name of [type?.id, type?.logicalId, type?.canonicalId, ...(Array.isArray(type?.aliases) ? type.aliases : [])]) {
      const key = normalizeImportName(name);
      if (key) dataTypeByName.set(key, type);
    }
  }
  const schemaByName = new Map();
  for (const schema of schemas) {
    for (const name of [schema?.id, schema?.name, schema?.typeId]) {
      const key = normalizeImportName(name);
      if (key) schemaByName.set(key, schema);
    }
  }

  const importedTypes = new Map();
  const importedSchemas = new Map();
  for (const name of importNames) {
    if (name.toLowerCase() === 'datatypes') {
      for (const type of dataTypes) importedTypes.set(normalizeImportName(type?.id), type);
      continue;
    }
    if (name.toLowerCase() === 'schemas') {
      for (const schema of schemas) importedSchemas.set(normalizeImportName(schema?.typeId || schema?.name), schema);
      continue;
    }
    const key = normalizeImportName(name);
    const type = dataTypeByName.get(key);
    const schema = schemaByName.get(key);
    if (!type && !schema) throw new Error(`Data Librarian import not found: ${name}`);
    if (type) importedTypes.set(normalizeImportName(type.id), type);
    if (schema) importedSchemas.set(normalizeImportName(schema.typeId || schema.name), schema);
  }

  const typeNames = new Map();
  const typeFieldMap = {};
  const addType = (name, schemaTypeId = name) => {
    const normalized = normalizeImportName(name);
    if (!normalized) return;
    typeNames.set(normalized, String(name).trim());
    const fields = allContracts.typeFieldMap[normalizeImportName(schemaTypeId)];
    if (Array.isArray(fields)) typeFieldMap[normalized] = fields;
  };
  for (const type of importedTypes.values()) {
    const aliases = [type.id, type.logicalId, type.canonicalId, ...(Array.isArray(type.aliases) ? type.aliases : [])];
    for (const alias of aliases) addType(alias, type.id);
  }
  for (const schema of importedSchemas.values()) addType(schema.typeId || schema.name, schema.typeId || schema.name);

  for (const [name, fields] of Object.entries(allContracts.typeFieldMap)) {
    if (importedSchemas.has(name)) typeFieldMap[name] = fields;
  }

  const localTypeNames = new Set([
    ...(Array.isArray(compiled.programMap.typeDeclarations) ? compiled.programMap.typeDeclarations : []),
    ...(Array.isArray(compiled.programMap.classDeclarations) ? compiled.programMap.classDeclarations : [])
  ].map(item => normalizeImportName(item?.name)).filter(Boolean));
  const importedTypeNames = new Set(typeNames.keys());
  const validateType = (typeRef, variableName) => {
    if (!typeRef || typeRef.kind === 'simple') return;
    const typeName = normalizeImportName(typeRef.id);
    if (typeRef.kind === 'user' && !localTypeNames.has(typeName) && !importedTypeNames.has(typeName)) {
      throw new Error(`Pascalish type "${typeRef.id}" used by "${variableName}" is not in the imported Data Librarian types`);
    }
    for (const genericArg of Array.isArray(typeRef.genericArgs) ? typeRef.genericArgs : []) {
      validateType(genericArg, variableName);
    }
  };
  const variables = [
    ...(Array.isArray(compiled.programMap.variableDeclarations) ? compiled.programMap.variableDeclarations : []),
    ...(Array.isArray(compiled.programMap.localVariableDeclarations) ? compiled.programMap.localVariableDeclarations : [])
  ];
  for (const variable of variables) {
    validateType(variable.dataType, variable.name);
  }

  const result = {
    typeNames: [...typeNames.values()].sort((left, right) => left.localeCompare(right)),
    typeFieldMap,
    dataTypes: [...importedTypes.values()],
    schemas: [...importedSchemas.values()]
  };
  compiled.programMap.librarianImportData = result;
  compiled.programMap.librarianTypeNames = result.typeNames;
  compiled.programMap.librarianTypeFieldMap = result.typeFieldMap;
  return result;
}

async function runCompiledPmachineArtifact(compiled, sourceMessage = '') {
  const programMap = compiled.programMap || {};
  const mappingsById = new Map();
  mappingsById.__globals = Array.isArray(programMap.globals) ? programMap.globals : [];
  mappingsById.__proceduresByLabel = programMap.procedures || {};
  const result = await executeProgram({
    instructions: parsePcode(compiled.pcodeText),
    opcodeMap: await loadOpcodeMap(),
    mappingsById,
    queueTypesByName: new Map(),
    isoTypeIds: new Set(),
    inputQueue: `${compiled.runtimeUnit?.id || 'language'}.run`,
    sourceMessage,
    runtimeContext: {}
  });
  return {
    stdout: result?.stdout || [],
    deliveries: result?.deliveries || [],
    messageTrace: {
      incoming: sourceMessage,
      outgoing: (result?.deliveries || []).map((delivery) => ({
        queueName: delivery.queueName,
        message: delivery.message
      }))
    },
    response: result?.response ?? null,
    error: result?.error || null
  };
}

async function loadLibrarianSubschemas() {
  try {
    const parsed = JSON.parse(await fs.readFile(librarianSubschemasPath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resolveWorkspaceFile(fileName) {
  const normalized = String(fileName || '').trim().replace(/[\\/]+/g, '_');
  if (!normalized || normalized.includes('..')) {
    throw new Error('Invalid file name');
  }
  const resolved = path.resolve(workspaceRoot, normalized);
  if (!resolved.startsWith(path.resolve(workspaceRoot))) {
    throw new Error('Invalid file path');
  }
  return resolved;
}

async function ensureWorkspaceSeeded() {
  await fs.mkdir(workspaceRoot, { recursive: true });
  const entries = await fs.readdir(workspaceRoot).catch(() => []);
  if (entries.length > 0) return;

  const seedFiles = [
    {
      fileName: 'router-mapper.sample.pas',
      sourcePath: path.join(repoRoot, 'data', 'router-mapper.dsl'),
      fallbackContent: DOCUMENT_TYPES.find((item) => item.id === 'pascalish')?.starterContent || ''
    },
    {
      fileName: 'workflow.sample.wfl',
      sourcePath: path.join(repoRoot, 'data', 'workflow.wfl'),
      fallbackContent: DOCUMENT_TYPES.find((item) => item.id === 'workflow')?.starterContent || ''
    }
  ];

  for (const seed of seedFiles) {
    let content = seed.fallbackContent;
    try {
      content = await fs.readFile(seed.sourcePath, 'utf-8');
    } catch {
      // Fallback to starter content when the source artifact is unavailable.
    }
    await fs.writeFile(path.join(workspaceRoot, seed.fileName), content, 'utf-8');
  }
}

async function readDocumentFile(fileName) {
  const filePath = resolveWorkspaceFile(fileName);
  return fs.readFile(filePath, 'utf-8');
}

async function writeDocumentFile(fileName, content) {
  const filePath = resolveWorkspaceFile(fileName);
  await fs.writeFile(filePath, String(content ?? ''), 'utf-8');
  return filePath;
}

function buildDocumentSummary(fileName, stats) {
  const documentType = getDocumentTypeByFileName(fileName);
  return {
    name: fileName,
    documentTypeId: documentType?.id || null,
    documentTypeLabel: documentType?.label || 'Document',
    extension: documentType?.extension || path.extname(fileName),
    size: stats.size,
    modifiedAt: stats.mtime.toISOString()
  };
}

function applyJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function normalizeFileNameFromBody(body = {}, existingNames = []) {
  const requestedTypeId = String(body.typeId || body.documentTypeId || '').trim().toLowerCase();
  const type = getDocumentTypeById(requestedTypeId);
  if (!type) {
    throw new Error('Unknown document type');
  }

  const requestedName = String(body.name || '').trim();
  if (requestedName) {
    return normalizeDocumentFileName(requestedName, type.id);
  }

  return createNewDocumentFileName(type.id, existingNames);
}

export async function registerDevelopDocumentRoutes(app) {
  await ensureWorkspaceSeeded();

  app.get('/api/develop/document-types', (req, res) => {
    applyJson(res, 200, { documentTypes: DOCUMENT_TYPES });
  });

  app.get('/api/develop/files', async (req, res) => {
    try {
      const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
      const files = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const fileName = entry.name;
        const filePath = path.join(workspaceRoot, fileName);
        const stats = await fs.stat(filePath);
        files.push(buildDocumentSummary(fileName, stats));
      }
      files.sort((left, right) => left.name.localeCompare(right.name));
      applyJson(res, 200, { files, workspaceRoot });
    } catch (error) {
      applyJson(res, 500, { error: error.message });
    }
  });

  app.get('/api/develop/files/:fileName', async (req, res) => {
    try {
      const fileName = String(req.params.fileName || '').trim();
      const content = await readDocumentFile(fileName);
      const stats = await fs.stat(resolveWorkspaceFile(fileName));
      applyJson(res, 200, {
        file: buildDocumentSummary(fileName, stats),
        content
      });
    } catch (error) {
      applyJson(res, 404, { error: error.message });
    }
  });

  app.post('/api/develop/files', async (req, res) => {
    try {
      const entries = await fs.readdir(workspaceRoot).catch(() => []);
      const requestedName = normalizeFileNameFromBody(req.body || {}, entries);
      const content = String(req.body?.content ?? getDocumentTypeByFileName(requestedName)?.starterContent ?? '');
      const filePath = await writeDocumentFile(requestedName, content);
      const stats = await fs.stat(filePath);
      applyJson(res, 201, {
        file: buildDocumentSummary(requestedName, stats),
        content
      });
    } catch (error) {
      applyJson(res, 400, { error: error.message });
    }
  });

  app.put('/api/develop/files/:fileName', async (req, res) => {
    try {
      const fileName = String(req.params.fileName || '').trim();
      const content = String(req.body?.content ?? '');
      const filePath = await writeDocumentFile(fileName, content);
      const stats = await fs.stat(filePath);
      applyJson(res, 200, {
        file: buildDocumentSummary(fileName, stats),
        content
      });
    } catch (error) {
      applyJson(res, 400, { error: error.message });
    }
  });

  app.patch('/api/develop/files/:fileName', async (req, res) => {
    try {
      const oldFileName = String(req.params.fileName || '').trim();
      const newFileName = normalizeDocumentFileName(String(req.body?.newName || '').trim(), getDocumentTypeByFileName(oldFileName)?.id || getDocumentTypeById('pascalish')?.id);
      const oldPath = resolveWorkspaceFile(oldFileName);
      const newPath = resolveWorkspaceFile(newFileName);
      await fs.rename(oldPath, newPath);
      const stats = await fs.stat(newPath);
      const content = await fs.readFile(newPath, 'utf-8');
      applyJson(res, 200, {
        file: buildDocumentSummary(newFileName, stats),
        content
      });
    } catch (error) {
      applyJson(res, 400, { error: error.message });
    }
  });

  app.delete('/api/develop/files/:fileName', async (req, res) => {
    try {
      const fileName = String(req.params.fileName || '').trim();
      await fs.unlink(resolveWorkspaceFile(fileName));
      applyJson(res, 200, { ok: true });
    } catch (error) {
      applyJson(res, 400, { error: error.message });
    }
  });

  app.post('/api/develop/compile', async (req, res) => {
    try {
      const mode = String(req.body?.mode || 'compile').trim().toLowerCase();
      const fileName = String(req.body?.fileName || '').trim();
      const fileType = getDocumentTypeByFileName(fileName);
      const languageId = fileType?.id || 'pascalish';
      const supportedLanguages = new Set(['pascalish', 'cobolish', 'vbish']);
      if (!supportedLanguages.has(languageId)) {
        return applyJson(res, 400, { error: `Compile is not supported for ${languageId}.` });
      }

      let sourceText = String(req.body?.content ?? '');
      if (!sourceText && fileName) {
        sourceText = await readDocumentFile(fileName);
      }
      if (!sourceText.trim()) {
        return applyJson(res, 400, { error: `No ${languageId.toUpperCase()} source content provided.` });
      }

      const compiled = languageId === 'cobolish'
        ? compileCobolishToPmachine(sourceText, { fileName })
        : languageId === 'vbish'
          ? compileVbishToPmachine(sourceText, { fileName })
          : compileRouterMapperDSL(sourceText);

      if (languageId === 'pascalish') {
        const librarianImports = await resolveLibrarianImports(compiled);
        validateImportedMappingFields(compiled.dataMappings, librarianImports);
        validateImportedVariableFieldAccesses(
          sourceText,
          [
            ...(Array.isArray(compiled.programMap.variableDeclarations) ? compiled.programMap.variableDeclarations : []),
            ...(Array.isArray(compiled.programMap.localVariableDeclarations) ? compiled.programMap.localVariableDeclarations : [])
          ],
          librarianImports
        );
        compiled.librarianTypeNames = librarianImports.typeNames;
        compiled.librarianTypeFieldMap = librarianImports.typeFieldMap;
        const subschemaValidation = validatePascalishSubschemaMappings(
          compiled.dataMappings,
          await loadLibrarianSubschemas()
        );
        if (subschemaValidation.errors.length > 0) {
          return applyJson(res, 400, {
            error: `Pascalish subschema validation failed:\n${subschemaValidation.errors.join('\n')}`,
            subschemaErrors: subschemaValidation.errors
          });
        }
        compiled.librarianSubschemas = subschemaValidation.usedContracts;
        const contractById = new Map(
          subschemaValidation.usedContracts.map(contract => [String(contract.id || '').toLowerCase(), contract])
        );
        for (const mapping of compiled.dataMappings || []) {
          const sourceContract = contractById.get(String(mapping.sourceTypeId || '').toLowerCase());
          const targetContract = contractById.get(String(mapping.targetTypeId || '').toLowerCase());
          if (sourceContract) {
            mapping.sourceSubschemaId = sourceContract.id;
            mapping.sourceParentTypeId = sourceContract.parentTypeId || null;
          }
          if (targetContract) {
            mapping.targetSubschemaId = targetContract.id;
            mapping.targetParentTypeId = targetContract.parentTypeId || null;
          }
        }
      }

      const compileSummary = languageId === 'cobolish' || languageId === 'vbish'
        ? {
        language: languageId,
        programId: compiled.runtimeUnit?.id || compiled.programId,
        runtimeKind: compiled.runtimeUnit?.kind || 'program',
        interop: Array.isArray(compiled.interoperability) ? compiled.interoperability.length : 0,
        syntaxErrors: Number(compiled.native?.syntaxErrorCount || 0),
        valid: true,
            compiledAt: compiled.compiledAt || new Date().toISOString()
          }
        : {
            language: 'pascalish',
            serviceId: compiled.serviceId,
            routers: Array.isArray(compiled.routerRules) ? compiled.routerRules.length : 0,
            mappings: Array.isArray(compiled.dataMappings) ? compiled.dataMappings.length : 0,
            variables: Array.isArray(compiled.variableDeclarations) ? compiled.variableDeclarations.length : 0,
            compiledAt: compiled.compiledAt || new Date().toISOString()
          };

      let deployed = false;
      let run = null;
      if (mode === 'compile-run' || mode === 'compile-debug') {
        const artifactOutPath = languageId === 'cobolish' || languageId === 'vbish'
          ? path.join(runtimeRoot, `${languageId}-compiled.json`)
          : path.join(runtimeRoot, 'router-mapper-compiled.json');

        await fs.mkdir(path.dirname(artifactOutPath), { recursive: true });
        if (languageId === 'cobolish' || languageId === 'vbish') {
          await fs.writeFile(artifactOutPath, `${JSON.stringify(compiled, null, 2)}\n`, 'utf-8');
        } else {
          const routerOutPath = path.join(runtimeRoot, 'router-rules.json');
          const mappingsOutPath = path.join(runtimeRoot, 'data-mappings.json');
          await fs.writeFile(routerOutPath, `${JSON.stringify(compiled.routerRules || [], null, 2)}\n`, 'utf-8');
          await fs.writeFile(mappingsOutPath, `${JSON.stringify(compiled.dataMappings || [], null, 2)}\n`, 'utf-8');
          await fs.writeFile(artifactOutPath, `${JSON.stringify(compiled, null, 2)}\n`, 'utf-8');
        }
        deployed = true;
        if ((languageId === 'cobolish' || languageId === 'vbish') && mode === 'compile-run') {
          run = await runCompiledPmachineArtifact(compiled, String(req.body?.message ?? ''));
        }
      }

      return applyJson(res, 200, {
        status: 'ok',
        mode,
        fileName,
        language: languageId,
        deployed,
        run,
        compile: compileSummary,
        debug: mode === 'compile-debug'
          && languageId === 'pascalish'
          ? {
              debuggerTarget: 'fsm-runner',
              fsmId: 'startup-fsm'
            }
          : null
      });
    } catch (error) {
      const requestId = `compile-${Date.now().toString(36)}`;
      console.error(`[DevelopCompile:${requestId}]`, error?.stack || error);
      return applyJson(res, 400, { error: error.message, requestId });
    }
  });
}
