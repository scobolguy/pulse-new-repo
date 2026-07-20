import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_PROJECTS_ROOT = path.join(os.homedir(), 'Documents', 'Pulse');
const configuredProjectsRoot = process.env.PULSE_PROJECTS_ROOT || DEFAULT_PROJECTS_ROOT;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(process.env.PULSE_RUNTIME_DATA_ROOT || path.join(moduleDir, '../../data'));
const projectsConfigPath = path.join(runtimeRoot, 'project-workspace-config.json');
let projectsRoot = path.resolve(configuredProjectsRoot);

function normalizeProjectId(projectId) {
  return String(projectId || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'default';
}

function resolveProjectRoot(projectId) {
  const safeProjectId = normalizeProjectId(projectId);
  return path.join(projectsRoot, safeProjectId);
}

function resolveWorkspaceFile(projectId) {
  return path.join(resolveProjectRoot(projectId), 'workspace.json');
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

async function ensureProjectDirectory(projectId) {
  const projectRoot = resolveProjectRoot(projectId);
  await fs.mkdir(projectRoot, { recursive: true });
  return projectRoot;
}

function normalizeProjectsRoot(inputPath) {
  return path.resolve(String(inputPath || '').trim() || DEFAULT_PROJECTS_ROOT);
}

async function loadProjectsRootConfig() {
  try {
    const raw = await fs.readFile(projectsConfigPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (isObject(parsed) && typeof parsed.projectsRoot === 'string' && parsed.projectsRoot.trim()) {
      projectsRoot = normalizeProjectsRoot(parsed.projectsRoot);
    }
  } catch {
    // Keep default/root from env when config file does not exist or is invalid.
  }
}

async function saveProjectsRootConfig(nextRoot) {
  await fs.mkdir(path.dirname(projectsConfigPath), { recursive: true });
  await fs.writeFile(projectsConfigPath, `${JSON.stringify({ projectsRoot: nextRoot }, null, 2)}\n`, 'utf-8');
}

function normalizeTextContent(value) {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

async function persistWorkspaceArtifacts(projectId, workspace) {
  const projectRoot = await ensureProjectDirectory(projectId);
  const documents = isObject(workspace?.documents) ? workspace.documents : {};

  for (const document of Object.values(documents)) {
    if (!isObject(document)) continue;
    const fileName = String(document.fileName || '').trim();
    if (!fileName || fileName.includes('..') || /[\\/]/.test(fileName)) continue;
    const content = normalizeTextContent(document.content);
    await fs.writeFile(path.join(projectRoot, fileName), content, 'utf-8');
  }

  const flowFileName = String(workspace?.flow?.fileName || '').trim();
  if (flowFileName && !flowFileName.includes('..') && !/[\\/]/.test(flowFileName) && isObject(workspace?.flow?.payload)) {
    await fs.writeFile(path.join(projectRoot, flowFileName), `${JSON.stringify(workspace.flow.payload, null, 2)}\n`, 'utf-8');
  }

  const workspaceFile = resolveWorkspaceFile(projectId);
  await fs.writeFile(workspaceFile, `${JSON.stringify(workspace, null, 2)}\n`, 'utf-8');

  return {
    projectRoot,
    workspaceFile,
  };
}

async function loadWorkspace(projectId) {
  const workspaceFile = resolveWorkspaceFile(projectId);
  const raw = await fs.readFile(workspaceFile, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!isObject(parsed)) {
    throw new Error('Workspace file is not a valid object');
  }
  return parsed;
}

export async function registerProjectWorkspaceRoutes(app) {
  await loadProjectsRootConfig();
  await fs.mkdir(projectsRoot, { recursive: true });

  app.get('/api/projects/root', (req, res) => {
    res.json({ projectsRoot, configuredBy: process.env.PULSE_PROJECTS_ROOT ? 'env' : 'runtime' });
  });

  app.put('/api/projects/root', async (req, res) => {
    const requestedRoot = String(req.body?.projectsRoot || '').trim();
    if (!requestedRoot) {
      return res.status(400).json({ error: 'projectsRoot is required' });
    }

    try {
      const nextRoot = normalizeProjectsRoot(requestedRoot);
      await fs.mkdir(nextRoot, { recursive: true });
      projectsRoot = nextRoot;
      await saveProjectsRootConfig(nextRoot);
      return res.json({ ok: true, projectsRoot: nextRoot });
    } catch (error) {
      return res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.get('/api/projects/:projectId/workspace', async (req, res) => {
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    try {
      const projectRoot = await ensureProjectDirectory(projectId);
      const workspace = await loadWorkspace(projectId);
      return res.json({
        projectId: normalizeProjectId(projectId),
        projectRoot,
        workspace,
      });
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return res.status(404).json({
          error: 'Workspace not found',
          projectId: normalizeProjectId(projectId),
          projectRoot: resolveProjectRoot(projectId),
        });
      }
      return res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.put('/api/projects/:projectId/workspace', async (req, res) => {
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const workspace = req.body?.workspace;
    if (!isObject(workspace)) {
      return res.status(400).json({ error: 'workspace object is required' });
    }

    try {
      const persisted = await persistWorkspaceArtifacts(projectId, workspace);
      return res.json({
        ok: true,
        projectId: normalizeProjectId(projectId),
        projectRoot: persisted.projectRoot,
        workspaceFile: persisted.workspaceFile,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || String(error) });
    }
  });
}
