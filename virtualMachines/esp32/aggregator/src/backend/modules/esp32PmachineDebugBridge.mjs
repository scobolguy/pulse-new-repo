import { attachPcodeSignature } from '../../../scripts/pcode-signing.mjs';

const REQUEST_TIMEOUT_MS = 15000;
const HOST_PATTERN = /^(?:https?:\/\/)?[a-z0-9._-]+(?::\d{1,5})?$/i;
const DEBUG_ACTIONS = new Set(['step', 'stepin', 'stepout', 'continue', 'pause', 'breakpoint-set', 'breakpoint-clear']);

// The debug session endpoints accept a device address from the caller, so the
// value is constrained to a bare host/port before it is ever used in a URL.
export function resolveDeviceBaseUrl(host) {
  const value = String(host || '').trim().replace(/\/+$/, '');
  if (!value) throw new Error('host is required');
  if (!HOST_PATTERN.test(value)) throw new Error(`invalid pmachine host: ${value}`);
  return /^https?:\/\//i.test(value) ? value : `http://${value}`;
}

function normalizeRemotePath(remotePath, fallback) {
  const value = String(remotePath || fallback || '').trim();
  if (!value) throw new Error('remote path is required');
  if (!value.startsWith('/')) throw new Error(`remote path must be absolute: ${value}`);
  if (value.includes('..')) throw new Error(`remote path must not traverse: ${value}`);
  return value;
}

async function deviceRequest(baseUrl, endpoint, init = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`pmachine request ${endpoint} failed (${response.status}): ${text.slice(0, 240)}`);
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function uploadToFfs(baseUrl, remotePath, data) {
  await deviceRequest(baseUrl, '/ffs/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ file: remotePath, body: data })
  });
  return remotePath;
}

function parseBreakpoints(breakpoints) {
  const source = Array.isArray(breakpoints)
    ? breakpoints
    : String(breakpoints || '').split(',');
  return [...new Set(source
    .map((entry) => Number.parseInt(entry, 10))
    .filter((entry) => Number.isInteger(entry) && entry >= 0))]
    .sort((left, right) => left - right);
}

/**
 * Uploads a pcode program (and optional signed program map) to a pmachine's FFS
 * and starts a paused debug session on it.
 */
export async function startEsp32DebugSession({
  host,
  pcode = '',
  pcodeFile = '',
  programMap = null,
  startPc = 0,
  breakpoints = [],
  maxBytes = 0
} = {}) {
  const baseUrl = resolveDeviceBaseUrl(host);
  const pcodeText = String(pcode || '');
  const tag = `vsdbg-${Date.now().toString(36)}`;

  let remotePcodePath;
  let remoteMapPath = '';
  if (pcodeText.trim()) {
    remotePcodePath = normalizeRemotePath(pcodeFile, `/${tag}.pcode`);
    await uploadToFfs(baseUrl, remotePcodePath, pcodeText);
    if (programMap && typeof programMap === 'object') {
      const remoteMap = { ...programMap };
      delete remoteMap.sourceMap;
      remoteMapPath = normalizeRemotePath('', `/${tag}.map.json`);
      await uploadToFfs(baseUrl, remoteMapPath, `${JSON.stringify(attachPcodeSignature(remoteMap, pcodeText), null, 2)}\n`);
    }
  } else {
    // No inline program: debug a pcode file that already lives on the device FFS.
    remotePcodePath = normalizeRemotePath(pcodeFile);
  }

  const resolvedMax = Number.parseInt(maxBytes, 10) > 0
    ? Number.parseInt(maxBytes, 10)
    : Math.max(32768, pcodeText.length * 2);

  const params = new URLSearchParams({
    file: remotePcodePath,
    max: String(resolvedMax),
    startPc: String(Number.parseInt(startPc, 10) || 0),
    breakpoints: parseBreakpoints(breakpoints).join(',')
  });

  const session = await deviceRequest(baseUrl, `/pmachine/debug/session?${params}`, { method: 'POST' });
  return {
    host,
    baseUrl,
    pcodeFile: remotePcodePath,
    programMapFile: remoteMapPath,
    sessionId: String(session.sessionId || ''),
    status: String(session.status || 'unknown'),
    pc: Number(session.pc || 0),
    callDepth: Number(session.callDepth || 0),
    breakpoints: parseBreakpoints(breakpoints)
  };
}

export async function readEsp32DebugSession({ host, sessionId } = {}) {
  const baseUrl = resolveDeviceBaseUrl(host);
  const id = String(sessionId || '').trim();
  if (!id) throw new Error('sessionId is required');
  const state = await deviceRequest(baseUrl, `/pmachine/debug/session?id=${encodeURIComponent(id)}`);
  return {
    host,
    sessionId: id,
    status: String(state.status || 'unknown'),
    pc: Number(state.pc || 0),
    callDepth: Number(state.callDepth || 0),
    breakpoints: Array.isArray(state.breakpoints) ? state.breakpoints.map(Number) : [],
    globals: state.globals && typeof state.globals === 'object' ? state.globals : {},
    locals: state.locals && typeof state.locals === 'object' ? state.locals : {}
  };
}

export async function controlEsp32DebugSession({ host, sessionId, action, pc } = {}) {
  const baseUrl = resolveDeviceBaseUrl(host);
  const id = String(sessionId || '').trim();
  if (!id) throw new Error('sessionId is required');
  const command = String(action || '').trim().toLowerCase();
  if (!DEBUG_ACTIONS.has(command)) {
    throw new Error(`action must be one of ${[...DEBUG_ACTIONS].join(', ')}`);
  }
  let endpoint = `/pmachine/debug/session/${command}`;
  if (command === 'stepin') endpoint = '/pmachine/debug/session/step';
  if (command === 'breakpoint-set' || command === 'breakpoint-clear') {
    const breakpointPc = Number.parseInt(pc, 10);
    if (!Number.isInteger(breakpointPc) || breakpointPc < 0) throw new Error('pc must be a non-negative integer');
    endpoint = `/pmachine/debug/session/breakpoint/${command === 'breakpoint-set' ? 'set' : 'clear'}?id=${encodeURIComponent(id)}&pc=${breakpointPc}`;
  } else {
    endpoint += `?id=${encodeURIComponent(id)}`;
  }
  await deviceRequest(baseUrl, endpoint, { method: 'POST' });
  return readEsp32DebugSession({ host, sessionId: id });
}

export async function stopEsp32DebugSession({ host, sessionId } = {}) {
  const baseUrl = resolveDeviceBaseUrl(host);
  const id = String(sessionId || '').trim();
  if (!id) throw new Error('sessionId is required');
  const result = await deviceRequest(baseUrl, `/pmachine/debug/session?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  return { host, sessionId: id, status: String(result.status || 'terminated') };
}
