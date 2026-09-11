import crypto from 'node:crypto';
import { executeProgram, parsePcode } from '../../../scripts/run-js-pmachine.mjs';
import { loadOpcodeMap } from '../../../scripts/pmachine-js-opcodes.mjs';

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
    globals: clone(session.snapshot?.globals || {}),
    locals: clone(session.snapshot?.locals || {}),
    callStack: clone(session.snapshot?.callStack || []),
    breakpoints: [...session.breakpoints],
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
          const hitBreakpoint = session.breakpoints.includes(snapshot.pc);
          if (hitBreakpoint) session.running = false;
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
  const session = {
    id,
    pcodeText: String(pcodeText),
    programMap,
    sourceMap: sourceMap && typeof sourceMap === 'object' ? sourceMap : {},
    inputQueue,
    sourceMessage,
    status: 'created',
    running: false,
    stepBudget: 0,
    breakpoints: [],
    snapshot: null,
    result: null,
    error: null,
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
  session.running = false;
  session.stepBudget = 1;
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
}
