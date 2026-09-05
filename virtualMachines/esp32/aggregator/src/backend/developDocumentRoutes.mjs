import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createNewDocumentFileName, DOCUMENT_TYPES, getDocumentTypeByFileName, getDocumentTypeById, normalizeDocumentFileName } from '../documentRegistry.js';
import { compileRouterMapperDSL } from '../../scripts/compile-pascal.mjs';
import { compileCobolishToPmachine, compileVbishToPmachine } from '../../scripts/compile-interoperable-language.mjs';
import { executeProgram, parsePcode } from '../../scripts/run-js-pmachine.mjs';
import { loadOpcodeMap } from '../../scripts/pmachine-js-opcodes.mjs';
import { validatePascalishSubschemaMappings } from '../librarianSchemaContracts.js';

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

async function runCompiledPmachineArtifact(compiled) {
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
    sourceMessage: '',
    runtimeContext: {}
  });
  return {
    stdout: result?.stdout || [],
    deliveries: result?.deliveries || [],
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
          run = await runCompiledPmachineArtifact(compiled);
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
