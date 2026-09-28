import crypto from 'node:crypto';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../../../pmachines/javascript/index.mjs';

const sessions = new Map();

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function createSessionState(session) {
  const sourceLocation = session.sourceMap?.[String(session.snapshot?.pc ?? '')] || null;
  return {
    id: session.id,
    runtime: 'js-pmachine',
    status: session.status,
    pc: session.snapshot?.pc ?? 0,
    instruction: session.snapshot?.instruction || null,
    sourceLocation: clone(sourceLocation),
    operandStack: clone(session.snapshot?.operandStack || []),
    stdout: clone(session.snapshot?.stdout || []),
    globals: clone(session.snapshot?.globals || {}),
    locals: clone(session.snapshot?.locals || {}),
    runtimeState: clone(session.snapshot?.runtimeState || {}),
    callStack: clone(session.snapshot?.callStack || []),
    breakpoints: [...session.breakpoints],
    sourceBreakpoints: clone(session.sourceBreakpoints),
    ready: Boolean(session.ready),
    error: session.error || null,
    result: session.result ? clone(session.result) : null
  };
}

function notify(session) {
  for (const resolve of session.waiters.splice(0)) resolve();
}

function waitForControl(session) {
  if (session.running || session.stepBudget > 0 || session.status === 'stopped') return Promise.resolve();
  return new Promise(resolve => session.waiters.push(resolve));
}

function pickSourceBreakpointPcs(session) {
  const requested = session.sourceBreakpoints || [];
  const byLine = new Map();

  for (const item of requested) {
    const candidates = [];
    for (const [pcText, location] of Object.entries(session.sourceMap || {})) {
      const pc = Number(pcText);
      if (!Number.isInteger(pc)) continue;
      if (item.sourceFile && item.sourceFile !== location?.sourceFile) continue;
      if (item.sourceLanguage && item.sourceLanguage !== location?.sourceLanguage) continue;
      candidates.push({ pc, location, line: Number(location?.sourceLine) });
    }

    // Lines such as `begin`, `else` or `end` emit no instruction, so snap forward to the next executable line.
    let effectiveLine = candidates.some(entry => entry.line === item.sourceLine) ? item.sourceLine : null;
    if (effectiveLine === null) {
      for (const entry of candidates) {
        if (entry.line > item.sourceLine && (effectiveLine === null || entry.line < effectiveLine)) effectiveLine = entry.line;
      }
    }
    if (effectiveLine === null) continue;

    for (const entry of candidates) {
      if (entry.line !== effectiveLine) continue;
      const key = `${entry.location?.sourceFile || ''}:${entry.location?.sourceLanguage || ''}:${entry.line}`;
      const list = byLine.get(key) || [];
      list.push(entry.pc);
      byLine.set(key, list);
    }
  }

  const selected = [];
  for (const pcs of byLine.values()) {
    pcs.sort((a, b) => a - b);

    const lineGroupBase = Number(session.sourceMap?.[String(pcs[0])]?.sourceLine);
    const lineGroupLast = Number(session.sourceMap?.[String(pcs[pcs.length - 1])]?.sourceLine);
    const callPc = pcs.find(pc => session.instructions?.[pc]?.mnemonic === 'CALL');
    if (Number.isInteger(callPc)) {
      selected.push(callPc);
      continue;
    }

    let nearbyCallPc = null;
    const lastMappedPc = pcs[pcs.length - 1];
    for (let pc = lastMappedPc + 1; pc < Math.min(session.instructions.length, lastMappedPc + 16); pc += 1) {
      const instruction = session.instructions?.[pc];
      if (!instruction || instruction.mnemonic !== 'CALL') continue;

      const nextLocation = session.sourceMap?.[String(pc)];
      const nextLine = Number(nextLocation?.sourceLine);
      if (!Number.isInteger(nextLine)) continue;
      if (nextLine < lineGroupBase || nextLine > lineGroupLast + 1) continue;
      nearbyCallPc = pc;
      break;
    }

    selected.push(nearbyCallPc ?? pcs[0]);
  }
  return selected;
}

function normalizeRuntimeProgramMap(programMap) {
  return {
    ...programMap,
    __globals: Array.isArray(programMap?.__globals) ? programMap.__globals : (programMap?.globals || []),
    __proceduresByLabel: programMap?.__proceduresByLabel || programMap?.procedures || {}
  };
}

async function runSession(session) {
  try {
    const opcodeMap = await loadOpcodeMap();
    session.status = 'paused';
    session.result = await executeProgram({
      instructions: parsePcode(session.pcodeText),
      opcodeMap,
      mappingsById: session.programMap,
      inputQueue: session.inputQueue,
      sourceMessage: session.sourceMessage,
      debugHooks: {
        beforeInstruction: async snapshot => {
          session.snapshot = snapshot;
          session.ready = true;
          const callDepth = snapshot.callStack.length;
          const completedControlStep = session.controlMode === 'stepIn'
            ? snapshot.pc !== session.controlOriginPc
            : session.controlMode === 'stepOver'
              ? snapshot.pc !== session.controlOriginPc && callDepth <= session.controlDepth
              : session.controlMode === 'stepOut'
                ? callDepth < session.controlDepth
                : false;
          if (completedControlStep) {
            session.running = false;
            session.controlMode = null;
          }
          const enteredSourceBreakpointCall = session.pendingSourceCallBreakpoint;
          if (enteredSourceBreakpointCall) session.pendingSourceCallBreakpoint = false;
          const hitBreakpoint = session.breakpoints.includes(snapshot.pc);
          const sourceCallBreakpoint = session.sourceCallBreakpointPcs.includes(snapshot.pc)
            && snapshot.instruction?.mnemonic === 'CALL';
          if (sourceCallBreakpoint) session.pendingSourceCallBreakpoint = true;
          if (enteredSourceBreakpointCall || (hitBreakpoint && !sourceCallBreakpoint)) session.running = false;
          if (session.stepBudget > 0) session.stepBudget -= 1;
          if (!session.running && session.stepBudget === 0) session.status = 'paused';
          else session.status = 'running';
          notify(session);
          await waitForControl(session);
          if (session.status === 'stopped') throw new Error('debug session stopped');
        }
      }
    });
    session.status = 'completed';
  } catch (error) {
    if (session.status !== 'stopped') {
      session.error = error?.message || String(error);
      session.status = 'error';
    }
  } finally {
    notify(session);
  }
}

export function createJavaScriptPmachineDebugSession({ pcodeText, programMap = {}, sourceMap = {}, inputQueue = 'debug.in', sourceMessage = '' }) {
  if (!String(pcodeText || '').trim()) throw new Error('pcodeText is required');
  const id = `jsdbg-${crypto.randomUUID()}`;
  const firstInstruction = parsePcode(String(pcodeText))[0] || null;
  const runtimeProgramMap = normalizeRuntimeProgramMap(programMap);
  const session = {
    id,
    pcodeText: String(pcodeText),
    instructions: parsePcode(String(pcodeText)),
    programMap: runtimeProgramMap,
    sourceMap: sourceMap && Object.keys(sourceMap).length > 0 ? sourceMap : (runtimeProgramMap.sourceMap || {}),
    inputQueue,
    sourceMessage,
    status: 'paused',
    running: false,
    stepBudget: 0,
    breakpoints: [],
    sourceBreakpoints: [],
    sourceCallBreakpointPcs: [],
    pendingSourceCallBreakpoint: false,
    controlMode: null,
    controlDepth: 0,
    controlOriginPc: -1,
    snapshot: {
      pc: 0,
      instruction: firstInstruction,
      operandStack: [],
      stdout: [],
      globals: {},
      locals: {},
      runtimeState: {},
      callStack: []
    },
    result: null,
    error: null,
    ready: false,
    waiters: []
  };
  sessions.set(id, session);
  void runSession(session);
  return getJavaScriptPmachineDebugState(id);
}

export function getJavaScriptPmachineDebugSession(id) {
  return sessions.get(String(id || '').trim()) || null;
}

export function getJavaScriptPmachineDebugState(id) {
  const session = getJavaScriptPmachineDebugSession(id);
  return session ? createSessionState(session) : null;
}

export function stepJavaScriptPmachineDebugSession(id) {
  const session = getJavaScriptPmachineDebugSession(id);
  if (!session) throw new Error('Debug session not found');
  session.controlMode = 'stepIn';
  session.controlDepth = session.snapshot?.callStack?.length || 0;
  session.controlOriginPc = session.snapshot?.pc ?? -1;
  session.running = true;
  session.stepBudget = 0;
  session.status = 'running';
  notify(session);
  return createSessionState(session);
}

export function stepOverJavaScriptPmachineDebugSession(id) {
  const session = getJavaScriptPmachineDebugSession(id);
  if (!session) throw new Error('Debug session not found');
  session.controlMode = 'stepOver';
  session.controlDepth = session.snapshot?.callStack?.length || 0;
  session.controlOriginPc = session.snapshot?.pc ?? -1;
  session.running = true;
  session.stepBudget = 0;
  session.status = 'running';
  notify(session);
  return createSessionState(session);
}

export function stepOutJavaScriptPmachineDebugSession(id) {
  const session = getJavaScriptPmachineDebugSession(id);
  if (!session) throw new Error('Debug session not found');
  const depth = session.snapshot?.callStack?.length || 0;
  if (depth === 0) return continueJavaScriptPmachineDebugSession(id);
  session.controlMode = 'stepOut';
  session.controlDepth = depth;
  session.controlOriginPc = session.snapshot?.pc ?? -1;
  session.running = true;
  session.stepBudget = 0;
  session.status = 'running';
  notify(session);
  return createSessionState(session);
}

export function continueJavaScriptPmachineDebugSession(id) {
  const session = getJavaScriptPmachineDebugSession(id);
  if (!session) throw new Error('Debug session not found');
  session.running = true;
  session.stepBudget = 0;
  session.status = 'running';
  notify(session);
  return createSessionState(session);
}

export function pauseJavaScriptPmachineDebugSession(id) {
  const session = getJavaScriptPmachineDebugSession(id);
  if (!session) throw new Error('Debug session not found');
  session.running = false;
  session.stepBudget = 0;
  session.status = 'paused';
  return createSessionState(session);
}

export function setJavaScriptPmachineDebugBreakpoints(id, breakpoints) {
  const session = getJavaScriptPmachineDebugSession(id);
  if (!session) throw new Error('Debug session not found');
  session.breakpoints = [...new Set((Array.isArray(breakpoints) ? breakpoints : []).map(Number).filter(Number.isInteger))];
  return createSessionState(session);
}

export function setJavaScriptPmachineSourceBreakpoints(id, sourceBreakpoints) {
  const session = getJavaScriptPmachineDebugSession(id);
  if (!session) throw new Error('Debug session not found');
  session.sourceBreakpoints = (Array.isArray(sourceBreakpoints) ? sourceBreakpoints : []).map(item => ({
    sourceFile: item?.sourceFile || null,
    sourceLanguage: item?.sourceLanguage || null,
    sourceLine: Number(item?.sourceLine)
  })).filter(item => Number.isInteger(item.sourceLine));
  const resolved = pickSourceBreakpointPcs(session);
  session.sourceCallBreakpointPcs = resolved.filter(pc => session.instructions?.[pc]?.mnemonic === 'CALL');
  session.breakpoints = [...new Set([...session.breakpoints, ...resolved])];
  return createSessionState(session);
}

export function inspectJavaScriptPmachineVariable(id, name) {
  const session = getJavaScriptPmachineDebugSession(id);
  if (!session) throw new Error('Debug session not found');
  const variableName = String(name || '').trim();
  if (!variableName) throw new Error('Variable name is required');
  const locals = session.snapshot?.locals || {};
  const globals = session.snapshot?.globals || {};
  const runtimeState = session.snapshot?.runtimeState || {};
  const scope = Object.prototype.hasOwnProperty.call(locals, variableName) ? 'local'
    : Object.prototype.hasOwnProperty.call(globals, variableName) ? 'global'
      : Object.prototype.hasOwnProperty.call(runtimeState, variableName) ? 'runtime' : null;
  if (!scope) throw new Error(`Variable not found: ${variableName}`);
  const value = scope === 'local' ? locals[variableName] : scope === 'global' ? globals[variableName] : runtimeState[variableName];
  return { name: variableName, scope, value: clone(value), serialized: JSON.stringify(value) };
}

export function stopJavaScriptPmachineDebugSession(id) {
  const session = getJavaScriptPmachineDebugSession(id);
  if (!session) throw new Error('Debug session not found');
  session.status = 'stopped';
  session.running = false;
  notify(session);
  return createSessionState(session);
}

export function registerJavaScriptPmachineDebuggerRoutes(app) {
  app.post('/api/debug/js-pmachine/sessions', (req, res) => {
    try {
      res.status(201).json({ state: createJavaScriptPmachineDebugSession(req.body || {}) });
    } catch (error) {
      res.status(400).json({ error: error?.message || String(error) });
    }
  });

  app.get('/api/debug/js-pmachine/sessions/:id', (req, res) => {
    const state = getJavaScriptPmachineDebugState(req.params.id);
    if (!state) return res.status(404).json({ error: 'Debug session not found' });
    return res.json({ state });
  });

  for (const [path, action] of [
    ['step', stepJavaScriptPmachineDebugSession],
    ['step-in', stepJavaScriptPmachineDebugSession],
    ['step-over', stepOverJavaScriptPmachineDebugSession],
    ['step-out', stepOutJavaScriptPmachineDebugSession],
    ['continue', continueJavaScriptPmachineDebugSession],
    ['pause', pauseJavaScriptPmachineDebugSession],
    ['stop', stopJavaScriptPmachineDebugSession]
  ]) {
    app.post(`/api/debug/js-pmachine/sessions/:id/${path}`, (req, res) => {
      try { res.json({ state: action(req.params.id) }); }
      catch (error) { res.status(400).json({ error: error?.message || String(error) }); }
    });
  }

  app.put('/api/debug/js-pmachine/sessions/:id/breakpoints', (req, res) => {
    try { res.json({ state: setJavaScriptPmachineDebugBreakpoints(req.params.id, req.body?.breakpoints) }); }
    catch (error) { res.status(400).json({ error: error?.message || String(error) }); }
  });

  app.put('/api/debug/js-pmachine/sessions/:id/source-breakpoints', (req, res) => {
    try { res.json({ state: setJavaScriptPmachineSourceBreakpoints(req.params.id, req.body?.breakpoints) }); }
    catch (error) { res.status(400).json({ error: error?.message || String(error) }); }
  });

  app.get('/api/debug/js-pmachine/sessions/:id/variables/:name', (req, res) => {
    try { res.json({ variable: inspectJavaScriptPmachineVariable(req.params.id, req.params.name) }); }
    catch (error) { res.status(400).json({ error: error?.message || String(error) }); }
  });
}
