const PROJECT_STORAGE_PREFIX = 'pulse.project.workspace';
const ACTIVE_PROJECT_KEY = 'pulse.project.active-id';
const PROJECT_WORKSPACE_SAVE_DEBOUNCE_MS = 450;
const pendingProjectSaveTimers = new Map();
const pendingProjectSavePayloads = new Map();
const DEFAULT_PROJECT_ID = 'default';

export const PROJECT_DEFINITIONS = [
  {
    id: 'myProject',
    label: 'myProject',
    description: 'Single bundled project containing Pascalish, WFL, QA, PM, and canvas artifacts.',
    owner: 'project-owner',
  },
];

function getProjectSlug(projectId) {
  return String(projectId || PROJECT_DEFINITIONS[0]?.id || DEFAULT_PROJECT_ID)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || PROJECT_DEFINITIONS[0]?.id || DEFAULT_PROJECT_ID;
}

function normalizeSubprojectPath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

export function getProjectStorageKey(projectId, suffix = 'workspace', options = {}) {
  const subprojectPath = normalizeSubprojectPath(options?.subprojectPath || '');
  if (!subprojectPath) return `${PROJECT_STORAGE_PREFIX}.${getProjectSlug(projectId)}.${suffix}`;
  const subprojectToken = subprojectPath.replace(/[^a-z0-9]+/gi, '.');
  return `${PROJECT_STORAGE_PREFIX}.${getProjectSlug(projectId)}.${suffix}.subproject.${subprojectToken}`;
}

function getProjectWorkspaceApiPath(projectId, options = {}) {
  const normalizedProjectId = String(projectId || PROJECT_DEFINITIONS[0]?.id || DEFAULT_PROJECT_ID).trim() || DEFAULT_PROJECT_ID;
  const subprojectPath = normalizeSubprojectPath(options?.subprojectPath || '');
  const basePath = `/api/projects/${encodeURIComponent(normalizedProjectId)}/workspace`;
  if (!subprojectPath) return basePath;
  return `${basePath}?subproject=${encodeURIComponent(subprojectPath)}`;
}

async function persistProjectWorkspaceToServer(projectId, workspace, options = {}) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  try {
    await window.fetch(getProjectWorkspaceApiPath(projectId, options), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace }),
    });
  } catch {
    // Local workspace remains the source of truth when server persistence is unavailable.
  }
}

function scheduleProjectWorkspaceServerSave(projectId, workspace, options = {}) {
  if (typeof window === 'undefined') return;
  const storageKey = getProjectStorageKey(projectId, 'workspace', options);
  const payloadKey = `${String(projectId || PROJECT_DEFINITIONS[0]?.id || DEFAULT_PROJECT_ID)}::${storageKey}`;
  pendingProjectSavePayloads.set(payloadKey, { workspace, options });
  const existingTimer = pendingProjectSaveTimers.get(payloadKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timerId = setTimeout(() => {
    const queued = pendingProjectSavePayloads.get(payloadKey);
    pendingProjectSaveTimers.delete(payloadKey);
    pendingProjectSavePayloads.delete(payloadKey);
    if (!queued || !queued.workspace) return;
    void persistProjectWorkspaceToServer(projectId, queued.workspace, queued.options || options);
  }, PROJECT_WORKSPACE_SAVE_DEBOUNCE_MS);

  pendingProjectSaveTimers.set(payloadKey, timerId);
}

export function getProjectDefinition(projectId) {
  const matched = PROJECT_DEFINITIONS.find((project) => project.id === projectId);
  if (matched) return matched;
  const fallbackId = String(projectId || PROJECT_DEFINITIONS[0]?.id || DEFAULT_PROJECT_ID).trim() || DEFAULT_PROJECT_ID;
  return {
    id: fallbackId,
    label: fallbackId,
    description: `Workspace for ${fallbackId}.`,
    owner: 'project-owner',
  };
}

export function loadActiveProjectId() {
  try {
    const stored = String(localStorage.getItem(ACTIVE_PROJECT_KEY) || '').trim();
    return PROJECT_DEFINITIONS.some((project) => project.id === stored)
      ? stored
      : PROJECT_DEFINITIONS[0]?.id || DEFAULT_PROJECT_ID;
  } catch {
    return PROJECT_DEFINITIONS[0]?.id || DEFAULT_PROJECT_ID;
  }
}

export function saveActiveProjectId(projectId) {
  localStorage.setItem(ACTIVE_PROJECT_KEY, String(projectId || PROJECT_DEFINITIONS[0]?.id || DEFAULT_PROJECT_ID));
}

function buildDocument(project, kind, label, extension, starterContent) {
  const slug = getProjectSlug(project.id);
  const suffixByKind = {
    pascalish: 'pas',
    workflow: 'wfl',
    canvas: 'flw',
    qa: 'md',
    pm: 'md',
  };
  const fileName = `${slug}.${suffixByKind[kind] || extension || 'txt'}`;
  return {
    id: kind,
    kind,
    label,
    fileName,
    content: starterContent,
  };
}

export function getDefaultProjectWorkspace(projectId) {
  const project = getProjectDefinition(projectId);
  const slug = getProjectSlug(project.id);
  const pascalishName = project.label.replace(/[^a-z0-9]+/gi, '') || 'Project';
  const flowFileName = `${slug}.flw`;
  const programFileName = `${slug}.pas`;

  return {
    version: 1,
    projectId: project.id,
    projectLabel: project.label,
    projectDescription: project.description,
    documents: {
      pascalish: buildDocument(
        project,
        'pascalish',
        'Pascalish Code',
        'pas',
        [
          `program ${pascalishName};`,
          'begin',
          `  writeln('Project ${project.label} is ready.');`,
          'end.',
        ].join('\n')
      ),
      workflow: buildDocument(
        project,
        'workflow',
        'Work Flow Language',
        'wfl',
        [
          `WORKFLOW "${slug}" BEGIN`,
          '  STEP "start" BEGIN',
          '  END;',
          'END;',
        ].join('\n')
      ),
      canvas: buildDocument(
        project,
        'canvas',
        'Flow Canvas',
        'flw',
        JSON.stringify({
          kind: 'pulse.canvas.generic-flow',
          version: '1.0.0',
          meta: { name: `${slug}.flw` },
          nodes: [],
          edges: [],
        }, null, 2)
      ),
      qa: buildDocument(
        project,
        'qa',
        'QA Plan',
        'md',
        [
          `# QA Plan - ${project.label}`,
          '',
          '- Scope: validate workflow behavior, project saves, and canvas persistence.',
          '- Entry criteria: project workspace is loaded.',
          '- Exit criteria: save, reopen, and cancel flows behave as expected.',
        ].join('\n')
      ),
      pm: buildDocument(
        project,
        'pm',
        'PM Plan',
        'md',
        [
          `# PM Plan - ${project.label}`,
          '',
          '- Scope: define milestones, owners, and delivery checkpoints.',
          '- Key outputs: workflow file, Pascalish source, QA plan, and status notes.',
          '- Review cadence: weekly.',
        ].join('\n')
      ),
    },
    catalogOverrides: {},
    projectModel: {
      programs: [
        {
          id: `${slug}.main`,
          fileName: programFileName,
          language: 'pascalish',
        },
      ],
      flows: [
        {
          id: `${slug}.main.flow`,
          fileName: flowFileName,
          contains: [],
        },
      ],
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

export function loadProjectWorkspace(projectId, options = {}) {
  const fallback = getDefaultProjectWorkspace(projectId);
  try {
    const raw = localStorage.getItem(getProjectStorageKey(projectId, 'workspace', options));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
    return {
      ...fallback,
      ...parsed,
      documents: {
        ...fallback.documents,
        ...(parsed.documents || {}),
      },
      catalogOverrides: parsed.catalogOverrides && typeof parsed.catalogOverrides === 'object' && !Array.isArray(parsed.catalogOverrides)
        ? parsed.catalogOverrides
        : {},
      flow: {
        ...fallback.flow,
        ...(parsed.flow || {}),
      },
      projectModel: {
        ...fallback.projectModel,
        ...(parsed.projectModel || {}),
        programs: Array.isArray(parsed?.projectModel?.programs) ? parsed.projectModel.programs : fallback.projectModel.programs,
        flows: Array.isArray(parsed?.projectModel?.flows) ? parsed.projectModel.flows : fallback.projectModel.flows,
        daemons: Array.isArray(parsed?.projectModel?.daemons) ? parsed.projectModel.daemons : fallback.projectModel.daemons,
        services: Array.isArray(parsed?.projectModel?.services) ? parsed.projectModel.services : fallback.projectModel.services,
        rulesets: Array.isArray(parsed?.projectModel?.rulesets) ? parsed.projectModel.rulesets : fallback.projectModel.rulesets,
        messageDefinitions: Array.isArray(parsed?.projectModel?.messageDefinitions) ? parsed.projectModel.messageDefinitions : fallback.projectModel.messageDefinitions,
      },
    };
  } catch {
    return fallback;
  }
}

export function saveProjectWorkspace(projectId, workspace, options = {}) {
  localStorage.setItem(getProjectStorageKey(projectId, 'workspace', options), JSON.stringify(workspace));
  scheduleProjectWorkspaceServerSave(projectId, workspace, options);
}

export async function hydrateProjectWorkspaceFromServer(projectId, options = {}) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return null;
  }

  try {
    const response = await window.fetch(getProjectWorkspaceApiPath(projectId, options), { method: 'GET' });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || typeof payload !== 'object' || !payload.workspace || typeof payload.workspace !== 'object') {
      return null;
    }

    localStorage.setItem(getProjectStorageKey(projectId, 'workspace', options), JSON.stringify(payload.workspace));
    return {
      workspace: loadProjectWorkspace(projectId, options),
      projectRoot: String(payload.projectRoot || ''),
      workspaceRoot: String(payload.workspaceRoot || ''),
      subprojectPath: String(payload.subprojectPath || ''),
    };
  } catch {
    return null;
  }
}

export function upsertProjectDocument(workspace, kind, patch = {}) {
  return {
    ...workspace,
    documents: {
      ...(workspace.documents || {}),
      [kind]: {
        ...((workspace.documents || {})[kind] || {}),
        ...patch,
      },
    },
  };
}