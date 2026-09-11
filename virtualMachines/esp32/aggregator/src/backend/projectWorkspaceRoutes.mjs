import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileWorkflowDSLWithAntlr } from '../../scripts/workflow-antlr-compiler.mjs';
import { executeWorkflow, executeDeploymentPlan } from '../../scripts/interpret-workflow.mjs';

const DEFAULT_PROJECTS_ROOT = path.join(os.homedir(), 'Documents', 'Pulse');
const configuredProjectsRoot = process.env.PULSE_PROJECTS_ROOT || DEFAULT_PROJECTS_ROOT;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(process.env.PULSE_RUNTIME_DATA_ROOT || path.join(moduleDir, '../../data'));
const projectsConfigPath = path.join(runtimeRoot, 'project-workspace-config.json');
const PROJECT_RESOURCE_FOLDERS = ['programs', 'services', 'daemons', 'artifacts', 'deployment'];
const RESOURCE_FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
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

function normalizeSubprojectPath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function assertSafeSubprojectPath(subprojectPath) {
  const normalized = normalizeSubprojectPath(subprojectPath);
  if (!normalized) return '';
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return '';
  for (const part of parts) {
    if (!/^[a-zA-Z0-9._-]+$/.test(part)) {
      throw new Error('subprojectPath must contain only letters, numbers, dot, underscore, dash, and slash separators');
    }
  }
  return parts.join('/');
}

function resolveWorkspaceDirectory(projectId, subprojectPath = '') {
  const projectRoot = resolveProjectRoot(projectId);
  const normalizedSubprojectPath = assertSafeSubprojectPath(subprojectPath);
  if (!normalizedSubprojectPath) return projectRoot;
  return path.join(projectRoot, 'subprojects', ...normalizedSubprojectPath.split('/'));
}

function resolveWorkspaceFile(projectId, subprojectPath = '') {
  return path.join(resolveWorkspaceDirectory(projectId, subprojectPath), 'workspace.json');
}

function resolveProjectScopeDirectory(projectId, subprojectPath = '') {
  return resolveWorkspaceDirectory(projectId, subprojectPath);
}

function resolveResourceDirectory(projectId, folder, subprojectPath = '') {
  if (!PROJECT_RESOURCE_FOLDERS.includes(folder)) {
    throw new Error(`Unknown project resource folder: ${folder}`);
  }
  return path.join(resolveProjectScopeDirectory(projectId, subprojectPath), folder);
}

function assertSafeResourceFileName(fileName) {
  const normalized = String(fileName || '').trim();
  if (!normalized || !RESOURCE_FILE_NAME_PATTERN.test(normalized) || normalized === '.' || normalized === '..') {
    throw new Error('fileName must contain only letters, numbers, dot, underscore, or dash');
  }
  return normalized;
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

async function ensureProjectDirectory(projectId) {
  const projectRoot = resolveProjectRoot(projectId);
  await fs.mkdir(projectRoot, { recursive: true });
  await ensureResourceDirectories(projectId);
  return projectRoot;
}

async function ensureWorkspaceDirectory(projectId, subprojectPath = '') {
  const workspaceDir = resolveWorkspaceDirectory(projectId, subprojectPath);
  await fs.mkdir(workspaceDir, { recursive: true });
  await ensureResourceDirectories(projectId, subprojectPath);
  return workspaceDir;
}

async function ensureResourceDirectories(projectId, subprojectPath = '') {
  const scopeRoot = resolveProjectScopeDirectory(projectId, subprojectPath);
  await Promise.all(PROJECT_RESOURCE_FOLDERS.map((folder) => fs.mkdir(path.join(scopeRoot, folder), { recursive: true })));
  return scopeRoot;
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

function buildDefaultDeploymentPlan(projectId, subprojectPath = '') {
  const normalizedProjectId = normalizeProjectId(projectId);
  const normalizedSubprojectPath = normalizeSubprojectPath(subprojectPath);
  return {
    version: 1,
    projectId: normalizedProjectId,
    subprojectPath: normalizedSubprojectPath || null,
    status: 'draft',
    targets: [],
    resources: [],
    artifacts: [],
    environment: {},
    rollout: { strategy: 'all-at-once', batchSize: 1, pauseBetweenBatchesMs: 0 },
    healthChecks: [],
    rollback: { enabled: true, strategy: 'previous-version' },
    updatedAt: new Date().toISOString(),
  };
}

function normalizeDeploymentPlan(projectId, subprojectPath, input) {
  const defaults = buildDefaultDeploymentPlan(projectId, subprojectPath);
  const plan = isObject(input) ? input : {};
  return {
    ...defaults,
    ...plan,
    projectId: defaults.projectId,
    subprojectPath: defaults.subprojectPath,
    targets: Array.isArray(plan.targets) ? plan.targets : defaults.targets,
    resources: Array.isArray(plan.resources) ? plan.resources : defaults.resources,
    artifacts: Array.isArray(plan.artifacts) ? plan.artifacts : defaults.artifacts,
    environment: isObject(plan.environment) ? plan.environment : defaults.environment,
    rollout: isObject(plan.rollout) ? { ...defaults.rollout, ...plan.rollout } : defaults.rollout,
    healthChecks: Array.isArray(plan.healthChecks) ? plan.healthChecks : defaults.healthChecks,
    rollback: isObject(plan.rollback) ? { ...defaults.rollback, ...plan.rollback } : defaults.rollback,
    updatedAt: new Date().toISOString(),
  };
}

function renderDeploymentPlanMarkdown(plan) {
  const scope = plan.subprojectPath ? `${plan.projectId} / ${plan.subprojectPath}` : plan.projectId;
  const lines = [
    `# Deployment Plan - ${scope}`,
    '',
    `- Status: ${plan.status}`,
    `- Rollout: ${plan.rollout.strategy}`,
    `- Rollback: ${plan.rollback.enabled ? 'enabled' : 'disabled'} (${plan.rollback.strategy})`,
    '',
    '## Targets',
    ...(plan.targets.length ? plan.targets.map((target) => `- ${typeof target === 'string' ? target : JSON.stringify(target)}`) : ['- None']),
    '',
    '## Resources',
    ...(plan.resources.length ? plan.resources.map((resource) => `- ${typeof resource === 'string' ? resource : JSON.stringify(resource)}`) : ['- None']),
    '',
    '## Artifacts',
    ...(plan.artifacts.length ? plan.artifacts.map((artifact) => `- ${typeof artifact === 'string' ? artifact : JSON.stringify(artifact)}`) : ['- None']),
    '',
    `Updated: ${plan.updatedAt}`,
    '',
  ];
  return lines.join('\n');
}

async function readDeploymentPlan(projectId, subprojectPath = '') {
  const deploymentDirectory = resolveResourceDirectory(projectId, 'deployment', subprojectPath);
  const planFile = path.join(deploymentDirectory, 'deployment-plan.json');
  try {
    const raw = await fs.readFile(planFile, 'utf-8');
    return normalizeDeploymentPlan(projectId, subprojectPath, JSON.parse(raw));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return buildDefaultDeploymentPlan(projectId, subprojectPath);
  }
}

async function persistDeploymentPlan(projectId, subprojectPath, input) {
  await ensureWorkspaceDirectory(projectId, subprojectPath);
  const plan = normalizeDeploymentPlan(projectId, subprojectPath, input);
  const deploymentDirectory = resolveResourceDirectory(projectId, 'deployment', subprojectPath);
  const planFile = path.join(deploymentDirectory, 'deployment-plan.json');
  const markdownFile = path.join(deploymentDirectory, 'deployment-plan.md');
  await fs.writeFile(planFile, `${JSON.stringify(plan, null, 2)}\n`, 'utf-8');
  await fs.writeFile(markdownFile, renderDeploymentPlanMarkdown(plan), 'utf-8');
  return { plan, planFile, markdownFile };
}

function buildDefaultWorkspace(projectId, options = {}) {
  const safeProjectId = normalizeProjectId(projectId);
  const label = String(options.label || safeProjectId || 'project').trim() || safeProjectId;
  const description = String(options.description || `Workspace for ${label}`).trim() || `Workspace for ${label}`;
  const slug = safeProjectId;
  const pascalishName = label.replace(/[^a-z0-9]+/gi, '') || 'Project';
  const flowFileName = `${slug}.flw`;
  const programFileName = `${slug}.pas`;

  return {
    version: 1,
    projectId: safeProjectId,
    projectLabel: label,
    projectDescription: description,
    documents: {
      pascalish: {
        id: 'pascalish',
        kind: 'pascalish',
        label: 'Pascalish Code',
        fileName: programFileName,
        content: [
          `program ${pascalishName};`,
          'begin',
          `  writeln('Project ${label} is ready.');`,
          'end.',
        ].join('\n')
      },
      workflow: {
        id: 'workflow',
        kind: 'workflow',
        label: 'Work Flow Language',
        fileName: `${slug}.wfl`,
        content: [
          `WORKFLOW "${slug}" BEGIN`,
          '  STEP "start" BEGIN',
          '  END;',
          'END;',
        ].join('\n')
      },
      canvas: {
        id: 'canvas',
        kind: 'canvas',
        label: 'Flow Canvas',
        fileName: flowFileName,
        content: JSON.stringify({
          kind: 'pulse.canvas.generic-flow',
          version: '1.0.0',
          meta: { name: flowFileName },
          nodes: [],
          edges: [],
        }, null, 2)
      },
      qa: {
        id: 'qa',
        kind: 'qa',
        label: 'QA Plan',
        fileName: `${slug}.md`,
        content: `# QA Plan - ${label}\n\n- Scope: validate workflow behavior and persistence.\n`
      },
      pm: {
        id: 'pm',
        kind: 'pm',
        label: 'PM Plan',
        fileName: `${slug}-plan.md`,
        content: `# PM Plan - ${label}\n\n- Scope: milestones, ownership, and delivery checkpoints.\n`
      },
    },
    catalogOverrides: {},
    projectModel: {
      programs: [{ id: `${slug}.main`, fileName: programFileName, language: 'pascalish' }],
      flows: [{ id: `${slug}.main.flow`, fileName: flowFileName, contains: [] }],
      daemons: [],
      services: [],
      rulesets: [],
      messageDefinitions: [],
    },
    flow: {
      fileName: flowFileName,
      payload: null,
      lastSavedAt: '',
    },
  };
}

async function persistWorkspaceArtifacts(projectId, workspace, subprojectPath = '') {
  const workspaceRoot = await ensureWorkspaceDirectory(projectId, subprojectPath);
  const documents = isObject(workspace?.documents) ? workspace.documents : {};

  for (const document of Object.values(documents)) {
    if (!isObject(document)) continue;
    const fileName = String(document.fileName || '').trim();
    if (!fileName || fileName.includes('..') || /[\\/]/.test(fileName)) continue;
    const content = normalizeTextContent(document.content);
    await fs.writeFile(path.join(workspaceRoot, fileName), content, 'utf-8');
  }

  const flowFileName = String(workspace?.flow?.fileName || '').trim();
  if (flowFileName && !flowFileName.includes('..') && !/[\\/]/.test(flowFileName) && isObject(workspace?.flow?.payload)) {
    await fs.writeFile(path.join(workspaceRoot, flowFileName), `${JSON.stringify(workspace.flow.payload, null, 2)}\n`, 'utf-8');
  }

  const workspaceFile = resolveWorkspaceFile(projectId, subprojectPath);
  await fs.writeFile(workspaceFile, `${JSON.stringify(workspace, null, 2)}\n`, 'utf-8');
  const deploymentPlan = await readDeploymentPlan(projectId, subprojectPath);
  await persistDeploymentPlan(projectId, subprojectPath, deploymentPlan);

  return {
    projectRoot: resolveProjectRoot(projectId),
    workspaceRoot,
    workspaceFile,
  };
}

async function loadWorkspace(projectId, subprojectPath = '') {
  const workspaceFile = resolveWorkspaceFile(projectId, subprojectPath);
  const raw = await fs.readFile(workspaceFile, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!isObject(parsed)) {
    throw new Error('Workspace file is not a valid object');
  }
  return parsed;
}

async function loadWorkspaceFromDirectory(directoryPath) {
  const workspaceFile = path.join(directoryPath, 'workspace.json');
  try {
    const raw = await fs.readFile(workspaceFile, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function summarizeResourceFolders(projectId, subprojectPath = '') {
  const summary = {};
  for (const folder of PROJECT_RESOURCE_FOLDERS) {
    const directoryPath = resolveResourceDirectory(projectId, folder, subprojectPath);
    const entries = await fs.readdir(directoryPath, { withFileTypes: true }).catch(() => []);
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    summary[folder] = { exists: entries.length > 0 || await fs.access(directoryPath).then(() => true).catch(() => false), count: files.length, files };
  }
  return summary;
}

function summarizeFlows(workspace) {
  const flowItems = [];
  const seen = new Set();

  const modelFlows = Array.isArray(workspace?.projectModel?.flows) ? workspace.projectModel.flows : [];
  for (const entry of modelFlows) {
    const flowId = String(entry?.id || '').trim();
    const fileName = String(entry?.fileName || '').trim();
    const key = `${flowId.toLowerCase()}::${fileName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    flowItems.push({
      id: flowId || fileName || 'flow',
      fileName: fileName || null,
      containsCount: Array.isArray(entry?.contains) ? entry.contains.length : 0,
      source: 'projectModel'
    });
  }

  if (workspace?.flow && typeof workspace.flow === 'object') {
    const flowFileName = String(workspace.flow.fileName || '').trim();
    const flowPayload = workspace.flow.payload;
    const inferredId = String(flowPayload?.meta?.name || flowFileName || '').trim();
    const key = `${inferredId.toLowerCase()}::${flowFileName.toLowerCase()}::flow-payload`;
    if (inferredId || flowFileName) {
      if (!seen.has(key)) {
        seen.add(key);
        flowItems.push({
          id: inferredId || flowFileName,
          fileName: flowFileName || null,
          containsCount: 0,
          source: 'flowPayload'
        });
      }
    }
  }

  return flowItems;
}

async function buildSubprojectTreeNode({ projectId, directoryPath, subprojectPath = '', parentPath = null }) {
  const normalizedSubprojectPath = normalizeSubprojectPath(subprojectPath);
  const workspace = await loadWorkspaceFromDirectory(directoryPath);
  const labelFromWorkspace = String(workspace?.projectLabel || workspace?.projectId || '').trim();
  const fallbackName = normalizedSubprojectPath
    ? normalizedSubprojectPath.split('/').pop()
    : normalizeProjectId(projectId);
  const flows = summarizeFlows(workspace);
  const resourceFolders = await summarizeResourceFolders(projectId, normalizedSubprojectPath);

  const children = [];
  const childrenRoot = path.join(directoryPath, 'subprojects');
  try {
    const entries = await fs.readdir(childrenRoot, { withFileTypes: true });
    const childDirs = entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const child of childDirs) {
      const childSubprojectPath = normalizeSubprojectPath(
        normalizedSubprojectPath ? `${normalizedSubprojectPath}/${child.name}` : child.name
      );
      const childNode = await buildSubprojectTreeNode({
        projectId,
        directoryPath: path.join(childrenRoot, child.name),
        subprojectPath: childSubprojectPath,
        parentPath: normalizedSubprojectPath || null
      });
      children.push(childNode);
    }
  } catch {
    // A node without a subprojects directory is a valid leaf.
  }

  const nodeKind = normalizedSubprojectPath ? 'subproject' : 'project';
  const nodeId = normalizedSubprojectPath
    ? `${normalizeProjectId(projectId)}:${normalizedSubprojectPath}`
    : normalizeProjectId(projectId);

  return {
    id: nodeId,
    projectId: normalizeProjectId(projectId),
    kind: nodeKind,
    name: labelFromWorkspace || fallbackName,
    subprojectPath: normalizedSubprojectPath || null,
    parentSubprojectPath: parentPath,
    directoryPath,
    workspaceExists: Boolean(workspace),
    flowCount: flows.length,
    flows,
    resourceFolders,
    artifactCount: resourceFolders.artifacts?.count || 0,
    deploymentPlanExists: resourceFolders.deployment?.files?.includes('deployment-plan.json') || false,
    childrenCount: children.length,
    children
  };
}

async function buildProjectForest() {
  const projects = [];
  const entries = await fs.readdir(projectsRoot, { withFileTypes: true }).catch(() => []);
  const projectDirs = entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));

  for (const projectDir of projectDirs) {
    const projectId = normalizeProjectId(projectDir.name);
    const projectRoot = path.join(projectsRoot, projectDir.name);
    const node = await buildSubprojectTreeNode({ projectId, directoryPath: projectRoot });
    projects.push(node);
  }

  return projects;
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

  app.get('/api/projects/tree', async (req, res) => {
    try {
      const projectIdQuery = String(req.query?.projectId || '').trim();
      const requestedProjectId = projectIdQuery ? normalizeProjectId(projectIdQuery) : '';
      const projects = await buildProjectForest();
      const filtered = requestedProjectId
        ? projects.filter((project) => project.projectId === requestedProjectId)
        : projects;

      return res.json({
        projectsRoot,
        totalProjects: filtered.length,
        generatedAt: new Date().toISOString(),
        projects: filtered
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.post('/api/projects', async (req, res) => {
    const requestedProjectId = String(req.body?.projectId || req.body?.id || req.body?.name || '').trim();
    if (!requestedProjectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const projectId = normalizeProjectId(requestedProjectId);
    const label = String(req.body?.label || requestedProjectId).trim() || requestedProjectId;
    const description = String(req.body?.description || `Workspace for ${label}`).trim() || `Workspace for ${label}`;

    try {
      const workspaceDir = await ensureWorkspaceDirectory(projectId);
      const workspaceFile = resolveWorkspaceFile(projectId);
      let created = false;

      try {
        await fs.access(workspaceFile);
      } catch {
        const workspace = buildDefaultWorkspace(projectId, { label, description });
        await persistWorkspaceArtifacts(projectId, workspace);
        created = true;
      }

      return res.status(created ? 201 : 200).json({
        ok: true,
        created,
        projectId,
        projectRoot: resolveProjectRoot(projectId),
        workspaceRoot: workspaceDir,
        workspaceFile
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.post('/api/projects/:projectId/subprojects', async (req, res) => {
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const requestedSubprojectPath = String(req.body?.subprojectPath || req.body?.path || '').trim();
    if (!requestedSubprojectPath) return res.status(400).json({ error: 'subprojectPath is required' });

    let subprojectPath = '';
    try {
      subprojectPath = assertSafeSubprojectPath(requestedSubprojectPath);
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
    if (!subprojectPath) return res.status(400).json({ error: 'subprojectPath is required' });

    const label = String(req.body?.label || subprojectPath.split('/').pop() || subprojectPath).trim() || subprojectPath;
    const description = String(req.body?.description || `Subproject ${subprojectPath}`).trim() || `Subproject ${subprojectPath}`;

    try {
      await ensureProjectDirectory(projectId);
      const workspaceDir = await ensureWorkspaceDirectory(projectId, subprojectPath);
      const workspaceFile = resolveWorkspaceFile(projectId, subprojectPath);
      let created = false;

      try {
        await fs.access(workspaceFile);
      } catch {
        const workspace = buildDefaultWorkspace(projectId, { label, description });
        await persistWorkspaceArtifacts(projectId, workspace, subprojectPath);
        created = true;
      }

      return res.status(created ? 201 : 200).json({
        ok: true,
        created,
        projectId: normalizeProjectId(projectId),
        subprojectPath,
        workspaceRoot: workspaceDir,
        workspaceFile
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || String(error) });
    }
  });

  app.get('/api/projects/:projectId/resources', async (req, res) => {
    const projectId = String(req.params.projectId || '').trim();
    let subprojectPath = '';
    try {
      subprojectPath = assertSafeSubprojectPath(req.query?.subproject || '');
      await ensureWorkspaceDirectory(projectId, subprojectPath);
      const resourceFolders = await summarizeResourceFolders(projectId, subprojectPath);
      return res.json({ ok: true, projectId: normalizeProjectId(projectId), subprojectPath: subprojectPath || null, resourceFolders });
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });

  app.get('/api/projects/:projectId/resources/:folder', async (req, res) => {
    const projectId = String(req.params.projectId || '').trim();
    const folder = String(req.params.folder || '').trim();
    let subprojectPath = '';
    try {
      subprojectPath = assertSafeSubprojectPath(req.query?.subproject || '');
      await ensureWorkspaceDirectory(projectId, subprojectPath);
      const directoryPath = resolveResourceDirectory(projectId, folder, subprojectPath);
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      const files = await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => ({
        fileName: entry.name,
        content: await fs.readFile(path.join(directoryPath, entry.name), 'utf-8'),
      })));
      return res.json({ ok: true, projectId: normalizeProjectId(projectId), subprojectPath: subprojectPath || null, folder, files });
    } catch (error) {
      return res.status(error.message?.startsWith('Unknown project') ? 400 : 500).json({ error: error.message || String(error) });
    }
  });

  app.post('/api/projects/:projectId/resources/:folder', async (req, res) => {
    const projectId = String(req.params.projectId || '').trim();
    const folder = String(req.params.folder || '').trim();
    try {
      const subprojectPath = assertSafeSubprojectPath(req.body?.subprojectPath || '');
      const fileName = assertSafeResourceFileName(req.body?.fileName);
      await ensureWorkspaceDirectory(projectId, subprojectPath);
      const filePath = path.join(resolveResourceDirectory(projectId, folder, subprojectPath), fileName);
      const existed = await fs.access(filePath).then(() => true).catch(() => false);
      await fs.writeFile(filePath, normalizeTextContent(req.body?.content), 'utf-8');
      return res.status(existed ? 200 : 201).json({ ok: true, created: !existed, projectId: normalizeProjectId(projectId), subprojectPath: subprojectPath || null, folder, fileName });
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });

  app.delete('/api/projects/:projectId/resources/:folder/:fileName', async (req, res) => {
    const projectId = String(req.params.projectId || '').trim();
    const folder = String(req.params.folder || '').trim();
    try {
      const subprojectPath = assertSafeSubprojectPath(req.query?.subproject || '');
      const fileName = assertSafeResourceFileName(req.params.fileName);
      if (folder === 'deployment' && (fileName === 'deployment-plan.json' || fileName === 'deployment-plan.md')) {
        return res.status(409).json({ error: 'Managed deployment-plan files must be updated through the deployment-plan endpoint' });
      }
      await fs.unlink(path.join(resolveResourceDirectory(projectId, folder, subprojectPath), fileName));
      return res.json({ ok: true, projectId: normalizeProjectId(projectId), subprojectPath: subprojectPath || null, folder, fileName });
    } catch (error) {
      return res.status(error.code === 'ENOENT' ? 404 : 400).json({ error: error.message || String(error) });
    }
  });

  app.get('/api/projects/:projectId/deployment-plan', async (req, res) => {
    const projectId = String(req.params.projectId || '').trim();
    try {
      const subprojectPath = assertSafeSubprojectPath(req.query?.subproject || '');
      await ensureWorkspaceDirectory(projectId, subprojectPath);
      const plan = await readDeploymentPlan(projectId, subprojectPath);
      return res.json({ ok: true, projectId: normalizeProjectId(projectId), subprojectPath: subprojectPath || null, plan });
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });

  app.put('/api/projects/:projectId/deployment-plan', async (req, res) => {
    const projectId = String(req.params.projectId || '').trim();
    try {
      const subprojectPath = assertSafeSubprojectPath(req.query?.subproject || '');
      const input = req.body?.plan;
      if (!isObject(input)) return res.status(400).json({ error: 'plan object is required' });
      const persisted = await persistDeploymentPlan(projectId, subprojectPath, input);
      return res.json({ ok: true, projectId: normalizeProjectId(projectId), subprojectPath: subprojectPath || null, plan: persisted.plan, planFile: persisted.planFile, markdownFile: persisted.markdownFile });
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });

  app.post('/api/deployments/wfl/compile', async (req, res) => {
    const source = String(req.body?.source || '');
    if (!source.trim()) return res.status(400).json({ error: 'source is required' });
    try {
      const compiled = compileWorkflowDSLWithAntlr(source);
      const deployments = Array.isArray(compiled.deployments) ? compiled.deployments : [];
      const projectId = String(req.body?.projectId || deployments[0]?.projectId || '').trim();
      let persisted = null;
      if (req.body?.persist === true && projectId && deployments.length > 0) {
        const deployment = deployments[0];
        const plan = buildDefaultDeploymentPlan(projectId);
        plan.status = 'draft';
        plan.targets = deployment.targets;
        plan.resources = deployment.resources;
        plan.artifacts = deployment.resources.map((resource) => ({ path: resource.fileName, kind: resource.kind, id: resource.id }));
        plan.environment = { deploymentId: deployment.id };
        persisted = await persistDeploymentPlan(projectId, '', plan);
      }
      return res.json({ ok: true, compiled, deployments, persisted: persisted ? { planFile: persisted.planFile, markdownFile: persisted.markdownFile } : null });
    } catch (error) {
      return res.status(400).json({ error: error?.message || String(error) });
    }
  });

  app.post('/api/workflows/wfl/execute', async (req, res) => {
    const source = String(req.body?.source || '');
    if (!source.trim()) return res.status(400).json({ error: 'source is required' });
    try {
      const compiled = compileWorkflowDSLWithAntlr(source);
      const workflowId = String(req.body?.workflowId || compiled.workflows?.[0]?.id || '').trim();
      if (!workflowId) return res.status(400).json({ error: 'workflowId is required' });
      const result = await executeWorkflow(compiled, workflowId, false, {
        ...(req.body?.context && typeof req.body.context === 'object' ? req.body.context : {}),
        serviceBaseUrl: req.body?.serviceBaseUrl || `http://127.0.0.1:${process.env.HTTP_PORT || process.env.PORT || 4000}`
      });
      return res.json({ ok: true, workflowId, result });
    } catch (error) {
      return res.status(400).json({ error: error?.message || String(error) });
    }
  });

  app.get('/api/projects/:projectId/workspace', async (req, res) => {
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    let subprojectPath = '';
    try {
      subprojectPath = assertSafeSubprojectPath(req.query?.subproject || '');
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }

    try {
      const projectRoot = await ensureProjectDirectory(projectId);
      const workspaceRoot = await ensureWorkspaceDirectory(projectId, subprojectPath);
      const workspace = await loadWorkspace(projectId, subprojectPath);
      return res.json({
        projectId: normalizeProjectId(projectId),
        projectRoot,
        workspaceRoot,
        subprojectPath: subprojectPath || null,
        workspace,
      });
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return res.status(404).json({
          error: 'Workspace not found',
          projectId: normalizeProjectId(projectId),
          projectRoot: resolveProjectRoot(projectId),
          workspaceRoot: resolveWorkspaceDirectory(projectId, subprojectPath),
          subprojectPath: subprojectPath || null,
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

    let subprojectPath = '';
    try {
      subprojectPath = assertSafeSubprojectPath(req.query?.subproject || '');
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }

    const workspace = req.body?.workspace;
    if (!isObject(workspace)) {
      return res.status(400).json({ error: 'workspace object is required' });
    }

    try {
      const persisted = await persistWorkspaceArtifacts(projectId, workspace, subprojectPath);
      return res.json({
        ok: true,
        projectId: normalizeProjectId(projectId),
        projectRoot: persisted.projectRoot,
        workspaceRoot: persisted.workspaceRoot,
        subprojectPath: subprojectPath || null,
        workspaceFile: persisted.workspaceFile,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || String(error) });
    }
  });
}
