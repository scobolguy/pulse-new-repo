import { attachPcodeSignature } from '../../../scripts/pcode-signing.mjs';
import { executeProgram, loadOpcodeMap, parsePcode, parseProgramMapMappings } from '../../../../pmachines/javascript/index.mjs';

const SHADOW_TRACE_MAX_STEPS = 200000;

// Older device firmware omits stdout/callStack from debug state. Programs are
// deterministic, so a JS shadow trace lets us recover them by matching device stops.
async function buildShadowTrace(pcodeText, programMap) {
  const trace = [];
  let result = null;
  try {
    result = await executeProgram({
      instructions: parsePcode(pcodeText),
      opcodeMap: await loadOpcodeMap(),
      mappingsById: parseProgramMapMappings(programMap || {}),
      inputQueue: 'debug.in',
      sourceMessage: '',
      debugHooks: {
        beforeInstruction: (snapshot) => {
          if (trace.length >= SHADOW_TRACE_MAX_STEPS) throw new Error('shadow trace step limit');
          trace.push({
            pc: snapshot.pc,
            locals: snapshot.locals,
            globals: snapshot.globals,
            stdoutLength: snapshot.stdout.length,
            callStack: snapshot.callStack
          });
        }
      }
    });
  } catch {
    return null;
  }
  return { trace, stdout: Array.isArray(result?.stdout) ? result.stdout.map(String) : [], cursor: 0 };
}

function shadowMatches(entry, state) {
  if (entry.pc !== state.pc) return false;
  for (const [scope, values] of [['locals', state.locals], ['globals', state.globals]]) {
    for (const [key, value] of Object.entries(values || {})) {
      if (!(key in entry[scope]) || String(entry[scope][key]) !== String(value)) return false;
    }
  }
  return true;
}

function syncShadow(shadow, state) {
  if (!shadow) return null;
  if (state.status === 'stopped') {
    shadow.cursor = shadow.trace.length;
    return { stdout: shadow.stdout, callStack: [] };
  }
  if (state.status !== 'paused') return null;
  for (let index = shadow.cursor; index < shadow.trace.length; index += 1) {
    if (shadowMatches(shadow.trace[index], state)) {
      shadow.cursor = index;
      break;
    }
  }
  const entry = shadow.trace[Math.min(shadow.cursor, shadow.trace.length - 1)];
  if (!entry) return null;
  return { stdout: shadow.stdout.slice(0, entry.stdoutLength), callStack: entry.callStack };
}

const REQUEST_TIMEOUT_MS = 15000;
const STOP_WAIT_MS = 20000;
const HOST_PATTERN = /^(?:https?:\/\/)?[a-z0-9._-]+(?::\d{1,5})?$/i;
const DEBUG_ACTIONS = new Set(['step', 'stepin', 'stepout', 'continue', 'pause', 'breakpoint-set', 'breakpoint-clear']);
const LINE_ACTIONS = new Set(['line-step-in', 'line-step-over', 'line-step-out']);

// Per-session context kept by the backend so it can translate between pcode
// addresses and source lines (the devices only know about pcs).
const sessionContexts = new Map();

function contextKey(host, sessionId) {
  return `${resolveDeviceBaseUrl(host)}|${String(sessionId || '').trim()}`;
}

function getSessionContext(host, sessionId) {
  return sessionContexts.get(contextKey(host, sessionId)) || null;
}

// First pc of each contiguous run of instructions belonging to a source line.
export function sourceLinesToPcs(sourceMap, lines) {
  const wanted = new Set((Array.isArray(lines) ? lines : []).map(Number).filter((line) => Number.isInteger(line) && line > 0));
  const pcs = [];
  for (const [pcText, entry] of Object.entries(sourceMap || {})) {
    const pc = Number(pcText);
    const line = Number(entry?.sourceLine);
    if (!Number.isInteger(pc) || !wanted.has(line)) continue;
    if (Number(sourceMap[String(pc - 1)]?.sourceLine) === line) continue;
    pcs.push(pc);
  }
  return pcs.sort((left, right) => left - right);
}

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
  const idempotent = !init.method || init.method === 'GET' || endpoint.includes('/breakpoint/');
  let response;
  for (let attempt = 0; ; attempt += 1) {
    try {
      response = await fetch(`${baseUrl}${endpoint}`, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      break;
    } catch (error) {
      // Small devices occasionally reset keep-alive sockets; retry only safe requests.
      if (!idempotent || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
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
  sourceMap = null,
  startPc = 0,
  breakpoints = [],
  sourceBreakpoints = [],
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

  const resolvedSourceMap = sourceMap && typeof sourceMap === 'object'
    ? sourceMap
    : (programMap?.sourceMap && typeof programMap.sourceMap === 'object' ? programMap.sourceMap : {});
  const userBreakpoints = parseBreakpoints([
    ...parseBreakpoints(breakpoints),
    ...sourceLinesToPcs(resolvedSourceMap, sourceBreakpoints)
  ]);

  const params = new URLSearchParams({
    file: remotePcodePath,
    max: String(resolvedMax),
    startPc: String(Number.parseInt(startPc, 10) || 0),
    breakpoints: userBreakpoints.join(',')
  });
  if (remoteMapPath) params.set('programMap', remoteMapPath);

  const session = await deviceRequest(baseUrl, `/pmachine/debug/session?${params}`, { method: 'POST' });
  const sessionId = String(session.sessionId || '');
  sessionContexts.set(contextKey(host, sessionId), {
    instructions: pcodeText.trim() ? parsePcode(pcodeText) : [],
    sourceMap: resolvedSourceMap,
    breakpoints: userBreakpoints,
    shadow: pcodeText.trim() ? await buildShadowTrace(pcodeText, programMap) : null,
    createdAt: Date.now()
  });
  return {
    host,
    baseUrl,
    pcodeFile: remotePcodePath,
    programMapFile: remoteMapPath,
    sessionId,
    status: String(session.status || 'unknown'),
    pc: Number(session.pc || 0),
    callDepth: Number(session.callDepth || 0),
    breakpoints: userBreakpoints
  };
}

export async function readEsp32DebugSession({ host, sessionId } = {}) {
  const baseUrl = resolveDeviceBaseUrl(host);
  const id = String(sessionId || '').trim();
  if (!id) throw new Error('sessionId is required');
  const context = getSessionContext(host, id);
  let state;
  try {
    state = await deviceRequest(baseUrl, `/pmachine/debug/session?id=${encodeURIComponent(id)}`);
    if (context) context.lastDeviceState = state;
  } catch (error) {
    // Firmware frees sessions once the program finishes; report that as stopped.
    if (!context || !/\(404\)/.test(String(error?.message))) throw error;
    state = { ...(context.lastDeviceState || {}), status: 'stopped' };
  }
  const pc = Number(state.pc || 0);
  const sourceLocation = context?.sourceMap?.[String(pc)] || null;
  const status = String(state.status || 'unknown');
  const globals = state.globals && typeof state.globals === 'object' ? state.globals : {};
  const locals = state.locals && typeof state.locals === 'object' ? state.locals : {};
  const deviceHasStdout = Array.isArray(state.stdout);
  const shadow = (!deviceHasStdout || !Array.isArray(state.callStack))
    ? syncShadow(context?.shadow, { status, pc, globals, locals })
    : null;
  return {
    host,
    sessionId: id,
    status,
    pc,
    callDepth: Number(state.callDepth || 0),
    breakpoints: Array.isArray(state.breakpoints) ? state.breakpoints.map(Number) : [],
    globals,
    locals,
    stdout: deviceHasStdout ? state.stdout.map(String) : (shadow?.stdout || []),
    stdoutSource: deviceHasStdout ? 'device' : (shadow ? 'shadow' : 'none'),
    callStack: Array.isArray(state.callStack) ? state.callStack : (shadow?.callStack || null),
    instruction: context?.instructions?.[pc]?.mnemonic || null,
    sourceLocation: sourceLocation ? {
      sourceFile: sourceLocation.sourceFile || null,
      sourceLine: Number(sourceLocation.sourceLine) || null,
      sourceText: sourceLocation.sourceText || ''
    } : null,
    error: state.error || null
  };
}

async function postDeviceAction(baseUrl, command, id, pc) {
  const query = `id=${encodeURIComponent(id)}${pc == null ? '' : `&pc=${pc}`}`;
  return deviceRequest(baseUrl, `/pmachine/debug/session/${command}?${query}`, { method: 'POST' });
}

async function waitForStop(host, id, isDone = (state) => state.status === 'paused') {
  const deadline = Date.now() + STOP_WAIT_MS;
  let state;
  while (Date.now() < deadline) {
    state = await readEsp32DebugSession({ host, sessionId: id });
    if (state.status === 'stopped' || isDone(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for the pmachine debug session to stop');
}

async function advanceInstruction(host, baseUrl, id, current) {
  await postDeviceAction(baseUrl, 'step', id);
  return waitForStop(host, id, (state) => state.status === 'paused'
    && (state.pc !== current.pc || state.callDepth !== current.callDepth));
}

// Runs over a CALL by parking a temporary breakpoint on the return address;
// recursive calls hit that address at deeper depths first, so keep going.
async function runOverCall(host, baseUrl, id, current, userBreakpoints) {
  const returnPc = current.pc + 1;
  const temporary = !userBreakpoints.includes(returnPc);
  if (temporary) await postDeviceAction(baseUrl, 'breakpoint/set', id, returnPc);
  try {
    let state = current;
    for (;;) {
      if (state !== current && state.pc === returnPc) {
        // Firmware skips the breakpoint on the instruction right after resuming,
        // and recursive returns often execute the same RET pc back-to-back.
        state = await advanceInstruction(host, baseUrl, id, state);
      } else {
        await postDeviceAction(baseUrl, 'continue', id);
        state = await waitForStop(host, id);
      }
      if (state.status === 'stopped') return state;
      if (state.pc !== returnPc || state.callDepth <= current.callDepth) {
        if (state.pc === returnPc || userBreakpoints.includes(state.pc)) return state;
        if (state.callDepth <= current.callDepth) return state;
        continue;
      }
    }
  } finally {
    if (temporary) await postDeviceAction(baseUrl, 'breakpoint/clear', id, returnPc).catch(() => {});
  }
}

export async function waitForEsp32DebugStop({ host, sessionId } = {}) {
  return waitForStop(host, String(sessionId || '').trim());
}

async function stepSourceLine(host, baseUrl, id, mode) {
  const context = getSessionContext(host, id) || { instructions: [], sourceMap: {}, breakpoints: [] };
  let state = await readEsp32DebugSession({ host, sessionId: id });
  if (state.status === 'running' || state.status === 'starting') state = await waitForStop(host, id);
  if (state.status !== 'paused') return state;
  const originLine = state.sourceLocation?.sourceLine || 0;
  const depth = state.callDepth;
  if (mode === 'line-step-out' && depth > 0) {
    await postDeviceAction(baseUrl, 'stepout', id);
    return waitForStop(host, id);
  }
  for (let index = 0; index < 20000; index += 1) {
    const mnemonic = context.instructions[state.pc]?.mnemonic || '';
    state = mode === 'line-step-over' && mnemonic === 'CALL'
      ? await runOverCall(host, baseUrl, id, state, context.breakpoints)
      : await advanceInstruction(host, baseUrl, id, state);
    if (state.status === 'stopped') return state;
    const line = state.sourceLocation?.sourceLine || 0;
    const changedSource = line > 0 && (line !== originLine || state.callDepth !== depth);
    if (changedSource && context.breakpoints.includes(state.pc)) return state;
    const stop = mode === 'line-step-out'
      ? state.callDepth < depth || (depth === 0 && changedSource)
      : changedSource && (mode === 'line-step-in' || state.callDepth <= depth);
    if (stop) return state;
  }
  throw new Error('Timed out waiting for the next source statement');
}

export async function setEsp32SourceBreakpoints({ host, sessionId, lines = [], breakpoints = [] } = {}) {
  const baseUrl = resolveDeviceBaseUrl(host);
  const id = String(sessionId || '').trim();
  if (!id) throw new Error('sessionId is required');
  const context = getSessionContext(host, id);
  if (!context) throw new Error('Unknown debug session for this backend; restart the session');
  const next = parseBreakpoints([...parseBreakpoints(breakpoints), ...sourceLinesToPcs(context.sourceMap, lines)]);
  for (const pc of context.breakpoints.filter((value) => !next.includes(value))) {
    await postDeviceAction(baseUrl, 'breakpoint/clear', id, pc);
  }
  for (const pc of next.filter((value) => !context.breakpoints.includes(value))) {
    await postDeviceAction(baseUrl, 'breakpoint/set', id, pc);
  }
  context.breakpoints = next;
  return readEsp32DebugSession({ host, sessionId: id });
}

export async function controlEsp32DebugSession({ host, sessionId, action, pc } = {}) {
  const baseUrl = resolveDeviceBaseUrl(host);
  const id = String(sessionId || '').trim();
  if (!id) throw new Error('sessionId is required');
  const command = String(action || '').trim().toLowerCase();
  if (LINE_ACTIONS.has(command)) return stepSourceLine(host, baseUrl, id, command);
  if (!DEBUG_ACTIONS.has(command)) {
    throw new Error(`action must be one of ${[...DEBUG_ACTIONS, ...LINE_ACTIONS].join(', ')}`);
  }
  let endpoint = `/pmachine/debug/session/${command}`;
  if (command === 'stepin') endpoint = '/pmachine/debug/session/step';
  if (command === 'breakpoint-set' || command === 'breakpoint-clear') {
    const breakpointPc = Number.parseInt(pc, 10);
    if (!Number.isInteger(breakpointPc) || breakpointPc < 0) throw new Error('pc must be a non-negative integer');
    endpoint = `/pmachine/debug/session/breakpoint/${command === 'breakpoint-set' ? 'set' : 'clear'}?id=${encodeURIComponent(id)}&pc=${breakpointPc}`;
    const context = getSessionContext(host, id);
    if (context) {
      context.breakpoints = command === 'breakpoint-set'
        ? parseBreakpoints([...context.breakpoints, breakpointPc])
        : context.breakpoints.filter((value) => value !== breakpointPc);
    }
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
  sessionContexts.delete(contextKey(host, id));
  const result = await deviceRequest(baseUrl, `/pmachine/debug/session?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  return { host, sessionId: id, status: String(result.status || 'terminated') };
}
