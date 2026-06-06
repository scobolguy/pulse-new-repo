import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createNewDocumentFileName, DOCUMENT_TYPES, getDocumentTypeByFileName, getDocumentTypeById, normalizeDocumentFileName } from '../documentRegistry.js';
import { compileRouterMapperDSL } from '../../scripts/compile-pascal.mjs';
import { compileCobolishWithAntlr } from '../../scripts/cobolish-antlr-compiler.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaultRuntimeRoot = path.join(repoRoot, 'data');
const runtimeRoot = path.resolve(
  process.env.PULSE_DEVELOP_WORKSPACE_ROOT
  || process.env.PULSE_RUNTIME_DATA_ROOT
  || process.env.PULSE_QUEUE_DATA_ROOT
  || defaultRuntimeRoot
);
const workspaceRoot = path.join(runtimeRoot, 'develop-documents');

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
      const supportedLanguages = new Set(['pascalish', 'cobolish']);
      if (!supportedLanguages.has(languageId)) {
        return applyJson(res, 400, { error: `Compile is not supported for ${languageId}.` });
      }

      let sourceText = String(req.body?.content ?? '');
      if (!sourceText && fileName) {
        sourceText = await readDocumentFile(fileName);
      }
      if (!sourceText.trim()) {
        return applyJson(res, 400, { error: `No ${languageId === 'cobolish' ? 'COBOLISH' : 'Pascalish'} source content provided.` });
      }

      const compiled = languageId === 'cobolish'
        ? compileCobolishWithAntlr(sourceText, { fileName })
        : compileRouterMapperDSL(sourceText);

      const compileSummary = languageId === 'cobolish'
        ? {
            language: 'cobolish',
            programId: compiled.programId,
            sections: Array.isArray(compiled.sections) ? compiled.sections.length : 0,
            paragraphs: Array.isArray(compiled.paragraphs) ? compiled.paragraphs.length : 0,
            dataItems: Array.isArray(compiled.dataItems) ? compiled.dataItems.length : 0,
            interop: Array.isArray(compiled.interop) ? compiled.interop.length : 0,
            syntaxErrors: Number(compiled.syntaxErrorCount || 0),
            valid: Boolean(compiled.valid),
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
      if (mode === 'compile-run' || mode === 'compile-debug') {
        const artifactOutPath = languageId === 'cobolish'
          ? path.join(runtimeRoot, 'cobolish-compiled.json')
          : path.join(runtimeRoot, 'router-mapper-compiled.json');

        await fs.mkdir(path.dirname(artifactOutPath), { recursive: true });
        if (languageId === 'cobolish') {
          await fs.writeFile(artifactOutPath, `${JSON.stringify(compiled, null, 2)}\n`, 'utf-8');
        } else {
          const routerOutPath = path.join(runtimeRoot, 'router-rules.json');
          const mappingsOutPath = path.join(runtimeRoot, 'data-mappings.json');
          await fs.writeFile(routerOutPath, `${JSON.stringify(compiled.routerRules || [], null, 2)}\n`, 'utf-8');
          await fs.writeFile(mappingsOutPath, `${JSON.stringify(compiled.dataMappings || [], null, 2)}\n`, 'utf-8');
          await fs.writeFile(artifactOutPath, `${JSON.stringify(compiled, null, 2)}\n`, 'utf-8');
        }
        deployed = true;
      }

      return applyJson(res, 200, {
        status: 'ok',
        mode,
        fileName,
        language: languageId,
        deployed,
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
      return applyJson(res, 400, { error: error.message });
    }
  });
}
