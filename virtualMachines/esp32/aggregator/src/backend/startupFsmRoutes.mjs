import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const defaultCatalogPath = path.join(repoRoot, 'data', 'fsm-catalog.json');
const FsmStates = {
  IDLE: 'IDLE',
  READY: 'READY',
  FAILED: 'FAILED'
};

function getCatalogPath() {
  const configured = String(process.env.FSM_CATALOG_PATH || '').trim();
  return configured ? path.resolve(configured) : defaultCatalogPath;
}

function createDefaultCatalog() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    fsms: [
      {
        id: 'startup-fsm',
        name: 'Startup Workflow FSM',
        activeVersion: 'v1',
        versions: {
          v1: {
            description: 'Boot sequence orchestration for backend/frontend startup.',
            scriptPath: 'scripts/startup-fsm-workflow.mjs',
            statusPath: 'data/startup-fsm-status.json',
            notesPath: 'data/startup-fsm-notes.jsonl',
            subflows: [
              'kill-backend-processes',
              'sanitize-queue-persistence',
              'backend-health-check',
              'frontend-health-check'
            ]
          }
        }
      },
      {
        id: 'web-bootstrap-fsm',
        name: 'Web Bootstrap FSM',
        activeVersion: 'v1',
        versions: {
          v1: {
            description: 'Base FSM runner to bring up and validate the web page.',
            scriptPath: 'scripts/web-bootstrap-fsm-workflow.mjs',
            statusPath: 'data/web-bootstrap-fsm-status.json',
            notesPath: 'data/web-bootstrap-fsm-notes.jsonl',
            subflows: [
              'frontend-health-check',
              'frontend-launch',
              'frontend-wait-ready'
            ]
          }
        }
      }
    ]
  };
}

async function loadCatalog() {
  const catalogPath = getCatalogPath();
  try {
    const raw = await fs.readFile(catalogPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.fsms)) {
      throw new Error('Invalid FSM catalog format');
    }
    return parsed;
  } catch {
    const fallback = createDefaultCatalog();
    await fs.mkdir(path.dirname(catalogPath), { recursive: true });
    await fs.writeFile(catalogPath, `${JSON.stringify(fallback, null, 2)}\n`, 'utf8');
    return fallback;
  }
}

async function saveCatalog(catalog) {
  const catalogPath = getCatalogPath();
  const next = {
    ...catalog,
    updatedAt: new Date().toISOString()
  };
  await fs.mkdir(path.dirname(catalogPath), { recursive: true });
  await fs.writeFile(catalogPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function resolveRelativePath(value, fallbackRelative) {
  const input = String(value || '').trim();
  const relative = input || fallbackRelative;
  return path.resolve(repoRoot, relative);
}

function findFsmRecord(catalog, fsmId) {
  const id = String(fsmId || 'startup-fsm').trim() || 'startup-fsm';
  const fsms = Array.isArray(catalog?.fsms) ? catalog.fsms : [];
  return fsms.find((fsm) => String(fsm?.id || '') === id) || null;
}

function getFsmDefinition(catalog, fsmId) {
  const fsm = findFsmRecord(catalog, fsmId);
  if (!fsm) return null;
  const activeVersion = String(fsm.activeVersion || '').trim() || 'v1';
  const versions = fsm.versions && typeof fsm.versions === 'object' ? fsm.versions : {};
  const version = versions[activeVersion];
  if (!version || typeof version !== 'object') return null;

  return {
    id: String(fsm.id || '').trim(),
    name: String(fsm.name || fsm.id || '').trim(),
    activeVersion,
    description: String(version.description || '').trim() || String(fsm.description || '').trim(),
    scriptPath: resolveRelativePath(version.scriptPath, 'scripts/startup-fsm-workflow.mjs'),
    statusPath: resolveRelativePath(version.statusPath, `data/${String(fsm.id || 'startup-fsm')}-status.json`),
    notesPath: resolveRelativePath(version.notesPath, `data/${String(fsm.id || 'startup-fsm')}-notes.jsonl`),
    subflows: Array.isArray(version.subflows) ? version.subflows.map((item) => String(item || '').trim()).filter(Boolean) : []
  };
}

function canRunFromState(stateValue) {
  const state = String(stateValue || FsmStates.IDLE).trim().toUpperCase();
  return state === FsmStates.IDLE || state === FsmStates.READY || state === FsmStates.FAILED;
}

function createDefaultStatus() {
  return {
    ok: false,
    state: 'IDLE',
    workflow: [],
    logs: [],
    updatedAt: new Date().toISOString()
  };
}

async function readStatusForDefinition(definition) {
  if (!definition) return createDefaultStatus();
  try {
    const raw = await fs.readFile(definition.statusPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createDefaultStatus();
    return parsed;
  } catch {
    return createDefaultStatus();
  }
}

async function readStatus(fsmId) {
  const catalog = await loadCatalog();
  const definition = getFsmDefinition(catalog, fsmId);
  return readStatusForDefinition(definition);
}

async function readNotes(fsmId, limit = 80) {
  const catalog = await loadCatalog();
  const definition = getFsmDefinition(catalog, fsmId);
  if (!definition) return [];
  try {
    const raw = await fs.readFile(definition.notesPath, 'utf8');
    const lines = String(raw || '').split(/\r?\n/).filter(Boolean);
    return lines
      .slice(-Math.max(1, Number(limit) || 80))
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { at: new Date().toISOString(), note: line };
        }
      });
  } catch {
    return [];
  }
}

async function appendFailureNote(fsmId, note) {
  const catalog = await loadCatalog();
  const definition = getFsmDefinition(catalog, fsmId);
  if (!definition) return;
  const entry = {
    at: new Date().toISOString(),
    fsmId: definition.id,
    version: definition.activeVersion,
    ...note
  };
  await fs.mkdir(path.dirname(definition.notesPath), { recursive: true });
  await fs.appendFile(definition.notesPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function startFsmProcess(definition, statusPath) {
  const child = spawn(process.execPath, [definition.scriptPath], {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      STARTUP_FSM_STATUS_PATH: statusPath,
      FSM_NOTES_PATH: definition.notesPath,
      FSM_ID: definition.id,
      FSM_VERSION: definition.activeVersion,
      FSM_SUBFLOWS: JSON.stringify(definition.subflows || [])
    }
  });
  child.unref();
  return child;
}

export function registerStartupFsmRoutes(app) {
  app.get('/api/fsm/catalog', async (_req, res) => {
    const catalog = await loadCatalog();
    res.json(catalog);
  });

  app.post('/api/fsm/catalog/promote', async (req, res) => {
    const fsmId = String(req?.body?.fsmId || '').trim();
    const targetVersion = String(req?.body?.targetVersion || '').trim();
    const reason = String(req?.body?.reason || 'manual promotion').trim();
    if (!fsmId || !targetVersion) {
      return res.status(400).json({ error: 'fsmId and targetVersion are required' });
    }

    const catalog = await loadCatalog();
    const fsm = findFsmRecord(catalog, fsmId);
    if (!fsm) {
      return res.status(404).json({ error: `Unknown FSM: ${fsmId}` });
    }
    const versions = fsm.versions && typeof fsm.versions === 'object' ? fsm.versions : {};
    if (!versions[targetVersion]) {
      return res.status(404).json({ error: `Unknown version: ${targetVersion}` });
    }

    fsm.activeVersion = targetVersion;
    const updated = await saveCatalog(catalog);
    await appendFailureNote(fsmId, {
      type: 'promotion',
      source: 'catalog',
      targetVersion,
      reason
    });
    res.json({ ok: true, fsmId, activeVersion: targetVersion, updatedAt: updated.updatedAt });
  });

  app.post('/api/fsm/catalog/upsert-version', async (req, res) => {
    const fsmId = String(req?.body?.fsmId || '').trim();
    const versionId = String(req?.body?.versionId || '').trim();
    const versionPatch = req?.body?.version && typeof req.body.version === 'object' ? req.body.version : null;
    if (!fsmId || !versionId || !versionPatch) {
      return res.status(400).json({ error: 'fsmId, versionId, and version are required' });
    }

    const catalog = await loadCatalog();
    const fsm = findFsmRecord(catalog, fsmId);
    if (!fsm) {
      return res.status(404).json({ error: `Unknown FSM: ${fsmId}` });
    }

    const versions = fsm.versions && typeof fsm.versions === 'object' ? fsm.versions : {};
    const previous = versions[versionId] && typeof versions[versionId] === 'object' ? versions[versionId] : {};
    versions[versionId] = {
      ...previous,
      ...versionPatch,
      subflows: Array.isArray(versionPatch?.subflows)
        ? versionPatch.subflows.map((item) => String(item || '').trim()).filter(Boolean)
        : Array.isArray(previous?.subflows)
          ? previous.subflows
          : []
    };
    fsm.versions = versions;

    const updated = await saveCatalog(catalog);
    await appendFailureNote(fsmId, {
      type: 'catalog-upsert-version',
      source: 'catalog',
      versionId,
      note: 'Version definition updated from UI/editor'
    });

    res.json({ ok: true, fsmId, versionId, activeVersion: fsm.activeVersion, updatedAt: updated.updatedAt });
  });

  app.post('/api/fsm/catalog/upsert-subflows', async (req, res) => {
    const fsmId = String(req?.body?.fsmId || '').trim();
    const versionId = String(req?.body?.versionId || '').trim();
    const subflows = Array.isArray(req?.body?.subflows)
      ? req.body.subflows.map((item) => String(item || '').trim()).filter(Boolean)
      : null;
    if (!fsmId || !versionId || !subflows) {
      return res.status(400).json({ error: 'fsmId, versionId, and subflows are required' });
    }

    const catalog = await loadCatalog();
    const fsm = findFsmRecord(catalog, fsmId);
    if (!fsm) {
      return res.status(404).json({ error: `Unknown FSM: ${fsmId}` });
    }

    const versions = fsm.versions && typeof fsm.versions === 'object' ? fsm.versions : {};
    const version = versions[versionId];
    if (!version || typeof version !== 'object') {
      return res.status(404).json({ error: `Unknown version: ${versionId}` });
    }

    version.subflows = subflows;
    versions[versionId] = version;
    fsm.versions = versions;

    const updated = await saveCatalog(catalog);
    await appendFailureNote(fsmId, {
      type: 'catalog-upsert-subflows',
      source: 'catalog',
      versionId,
      subflowCount: subflows.length
    });

    res.json({ ok: true, fsmId, versionId, subflows, updatedAt: updated.updatedAt });
  });

  app.get('/api/fsm/runnable', async (_req, res) => {
    const catalog = await loadCatalog();
    const fsms = Array.isArray(catalog?.fsms) ? catalog.fsms : [];
    const definitions = fsms
      .map((fsm) => getFsmDefinition(catalog, fsm?.id))
      .filter(Boolean);
    const statuses = await Promise.all(definitions.map((fsm) => readStatus(fsm.id)));
    const items = definitions.map((fsm, index) => {
      const activeState = String(statuses[index]?.state || FsmStates.IDLE);
      return {
        id: fsm.id,
        name: fsm.name,
        description: fsm.description,
        activeVersion: fsm.activeVersion,
        subflows: fsm.subflows,
        state: activeState,
        canRun: canRunFromState(activeState),
        endpoint: '/api/fsm/start'
      };
    });
    res.json({ ok: true, items });
  });

  app.get('/api/fsm/status', async (req, res) => {
    const fsmId = String(req.query?.fsmId || 'startup-fsm').trim() || 'startup-fsm';
    const catalog = await loadCatalog();
    const definition = getFsmDefinition(catalog, fsmId);
    if (!definition) {
      return res.status(404).json({ ok: false, error: `Unknown FSM: ${fsmId}` });
    }
    const payload = await readStatusForDefinition(definition);
    return res.json({ ...payload, fsmId: definition.id, version: definition.activeVersion, subflows: definition.subflows });
  });

  app.get('/api/fsm/events', async (req, res) => {
    const fsmId = String(req.query?.fsmId || 'startup-fsm').trim() || 'startup-fsm';
    const catalog = await loadCatalog();
    const definition = getFsmDefinition(catalog, fsmId);
    if (!definition) {
      return res.status(404).json({ ok: false, error: `Unknown FSM: ${fsmId}` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    let lastFingerprint = '';
    let closed = false;

    const toPayload = async () => {
      const status = await readStatusForDefinition(definition);
      return {
        ...status,
        fsmId: definition.id,
        version: definition.activeVersion,
        subflows: definition.subflows
      };
    };

    const toFingerprint = (payload) => JSON.stringify({
      state: payload?.state || '',
      workflow: Array.isArray(payload?.workflow) ? payload.workflow : [],
      ok: Boolean(payload?.ok),
      error: String(payload?.error || ''),
      updatedAt: String(payload?.updatedAt || ''),
      version: String(payload?.version || '')
    });

    const pushIfChanged = async (force = false) => {
      const payload = await toPayload();
      const nextFingerprint = toFingerprint(payload);
      if (!force && nextFingerprint === lastFingerprint) {
        return;
      }
      lastFingerprint = nextFingerprint;
      res.write(`event: fsm\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    await pushIfChanged(true);

    const pollHandle = setInterval(() => {
      if (closed) return;
      void pushIfChanged(false);
    }, 700);

    const heartbeatHandle = setInterval(() => {
      if (closed) return;
      res.write('event: ping\n');
      res.write('data: {}\n\n');
    }, 15000);

    const closeStream = () => {
      if (closed) return;
      closed = true;
      clearInterval(pollHandle);
      clearInterval(heartbeatHandle);
      res.end();
    };

    req.on('close', closeStream);
    req.on('error', closeStream);
  });

  app.get('/api/fsm/notes', async (req, res) => {
    const fsmId = String(req.query?.fsmId || 'startup-fsm').trim() || 'startup-fsm';
    const catalog = await loadCatalog();
    const definition = getFsmDefinition(catalog, fsmId);
    if (!definition) {
      return res.status(404).json({ ok: false, error: `Unknown FSM: ${fsmId}` });
    }
    const limit = Number(req.query?.limit || 80);
    const notes = await readNotes(definition.id, limit);
    return res.json({ ok: true, fsmId: definition.id, items: notes });
  });

  app.post('/api/fsm/start', async (req, res) => {
    const fsmId = String(req?.body?.fsmId || req?.query?.fsmId || 'startup-fsm').trim() || 'startup-fsm';
    const catalog = await loadCatalog();
    const definition = getFsmDefinition(catalog, fsmId);
    if (!definition) {
      return res.status(404).json({ ok: false, error: `Unknown FSM: ${fsmId}` });
    }

    const statusPath = definition.statusPath;

    try {
      const child = await startFsmProcess(definition, statusPath);
      return res.json({
        ok: true,
        status: 'started',
        fsmId: definition.id,
        version: definition.activeVersion,
        pid: child.pid,
        statusPath
      });
    } catch (e) {
      await appendFailureNote(definition.id, {
        source: 'route-start',
        type: 'spawn-error',
        error: e?.message || String(e)
      });
      return res.status(500).json({
        ok: false,
        error: e?.message || String(e)
      });
    }
  });

  app.get('/api/startup-fsm/status', async (req, res) => {
    const payload = await readStatus(String(req.query?.fsmId || 'startup-fsm'));
    res.json(payload);
  });

  app.post('/api/startup-fsm/start', async (req, res) => {
    const fsmId = String(req?.body?.fsmId || req?.query?.fsmId || 'startup-fsm').trim() || 'startup-fsm';
    const catalog = await loadCatalog();
    const definition = getFsmDefinition(catalog, fsmId);
    if (!definition) {
      return res.status(404).json({ ok: false, error: `Unknown FSM: ${fsmId}` });
    }
    const statusPath = definition.statusPath;

    try {
      const child = await startFsmProcess(definition, statusPath);

      res.json({
        ok: true,
        status: 'started',
        fsmId: definition.id,
        version: definition.activeVersion,
        pid: child.pid,
        statusPath
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e?.message || String(e)
      });
    }
  });
}
