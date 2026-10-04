#!/usr/bin/env node
// Standalone JavaScript PMachine node. Serves the same HTTP contract as the
// ESP32 firmware (/status, /ffs/upload, /pmachine/execute_file and
// /pmachine/debug/session*) so backend run/debug bridges can target it by host.
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSingleMessageForEvolution } from './index.mjs';
import {
  createJavaScriptPmachineDebugSession,
  getJavaScriptPmachineDebugSession,
  getJavaScriptPmachineDebugState,
  stepJavaScriptPmachineDebugSession,
  stepOutJavaScriptPmachineDebugSession,
  continueJavaScriptPmachineDebugSession,
  pauseJavaScriptPmachineDebugSession,
  setJavaScriptPmachineDebugBreakpoints,
  stopJavaScriptPmachineDebugSession
} from '../../aggregator/src/backend/modules/javascriptPmachineDebugger.mjs';

const MAX_BODY_BYTES = 4 * 1024 * 1024;

function parseCliArgs(argv) {
  const args = {
    port: Number(process.env.JS_PMACHINE_PORT || 4111),
    host: process.env.JS_PMACHINE_BIND || '0.0.0.0',
    name: process.env.JS_PMACHINE_NAME || ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--port') args.port = Number(argv[++index]);
    else if (token === '--host') args.host = String(argv[++index]);
    else if (token === '--name') args.name = String(argv[++index]);
  }
  if (!args.name) args.name = `js-pmachine-${args.port}`;
  return args;
}

function send(res, status, body, contentType) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': contentType || (typeof body === 'string' ? 'text/plain' : 'application/json'),
    'access-control-allow-origin': '*'
  });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Mirrors the firmware's getRequestParam: form body params win over query params.
async function readParams(req, url) {
  const params = new Map(url.searchParams);
  if (req.method === 'POST' || req.method === 'DELETE') {
    const text = await readBody(req);
    const contentType = String(req.headers['content-type'] || '');
    if (text && contentType.includes('application/json')) {
      for (const [key, value] of Object.entries(JSON.parse(text))) params.set(key, String(value));
    } else if (text) {
      for (const [key, value] of new URLSearchParams(text)) params.set(key, value);
    }
  }
  return params;
}

function debugStatus(state) {
  if (!state) return 'stopped';
  if (state.status === 'paused') return 'paused';
  if (state.status === 'running') return 'running';
  return 'stopped';
}

function deviceDebugState(id) {
  const state = getJavaScriptPmachineDebugState(id);
  if (!state) return null;
  return {
    sessionId: id,
    status: debugStatus(state),
    pc: state.pc,
    callDepth: state.callStack.length,
    globals: state.globals,
    locals: state.locals,
    stdout: state.stdout,
    callStack: state.callStack,
    breakpoints: state.breakpoints,
    error: state.error
  };
}

export function createJsPmachineNodeServer({ name = 'js-pmachine', port = 4111 } = {}) {
  const files = new Map();
  const startedAt = Date.now();
  const stats = { runs: 0, debugSessions: 0 };

  function readFfsFile(remotePath) {
    const value = files.get(String(remotePath || ''));
    if (value == null) throw Object.assign(new Error(`File not found: ${remotePath}`), { status: 404 });
    return value;
  }

  async function executeFile(params) {
    const pcodeText = readFfsFile(params.get('file'));
    const programMapText = params.get('programMap') ? readFfsFile(params.get('programMap')) : '{}';
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'js-pmachine-node-'));
    try {
      const pcodePath = path.join(tempDirectory, 'program.pcode');
      const mapPath = path.join(tempDirectory, 'program.map.json');
      await fs.writeFile(pcodePath, pcodeText, 'utf8');
      await fs.writeFile(mapPath, programMapText, 'utf8');
      const result = await runSingleMessageForEvolution({
        pcode: pcodePath,
        programMap: mapPath,
        inputQueue: params.get('inputQueue') || 'deploy-api.in',
        message: params.get('message') || '',
        messageFile: null,
        serviceId: '',
        organismId: '',
        generation: '0',
        fitnessOut: ''
      });
      stats.runs += 1;
      return {
        ok: !result.error,
        nodeName: name,
        runtime: 'js-pmachine',
        stdout: result.stdout,
        globals: result.globals,
        stepCount: result.stepCount,
        stepLimitHit: result.stepLimitHit,
        instructionCount: pcodeText.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#')).length,
        deliveries: result.deliveries,
        response: result.response,
        error: result.error
      };
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
    }
  }

  function createDebugSession(params) {
    const pcodeText = readFfsFile(params.get('file'));
    const programMap = params.get('programMap') ? JSON.parse(readFfsFile(params.get('programMap'))) : {};
    const state = createJavaScriptPmachineDebugSession({ pcodeText, programMap, inputQueue: 'debug.in' });
    const breakpoints = String(params.get('breakpoints') || '').split(',').map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value >= 0);
    if (breakpoints.length > 0) setJavaScriptPmachineDebugBreakpoints(state.id, breakpoints);
    stats.debugSessions += 1;
    return { sessionId: state.id, status: 'running', pc: Number(params.get('startPc') || 0), callDepth: 0 };
  }

  function requireSession(params) {
    const id = String(params.get('id') || '');
    if (!id) throw Object.assign(new Error('Missing id param'), { status: 400 });
    if (!getJavaScriptPmachineDebugSession(id)) throw Object.assign(new Error('Session not found'), { status: 404 });
    return id;
  }

  async function handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const route = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type'
      });
      return res.end();
    }
    const params = await readParams(req, url);

    if (route === '/status' && req.method === 'GET') {
      return send(res, 200, {
        nodeName: name,
        runtime: 'js-pmachine',
        role: 'pmachine',
        services: ['pmachine'],
        port,
        uptimeMs: Date.now() - startedAt,
        files: files.size,
        ...stats
      });
    }

    if (route === '/ffs/upload' && req.method === 'POST') {
      const file = String(params.get('file') || '');
      if (!file.startsWith('/') || file.includes('..')) return send(res, 400, 'Invalid file param');
      files.set(file, String(params.get('body') ?? ''));
      return send(res, 200, 'File uploaded');
    }

    if (route === '/pmachine/execute_file' && req.method === 'POST') {
      return send(res, 200, await executeFile(params));
    }

    if (route === '/pmachine/debug/session') {
      if (req.method === 'POST') return send(res, 200, createDebugSession(params));
      const id = requireSession(params);
      if (req.method === 'GET') return send(res, 200, deviceDebugState(id));
      if (req.method === 'DELETE') {
        stopJavaScriptPmachineDebugSession(id);
        return send(res, 200, { sessionId: id, status: 'terminated' });
      }
    }

    const actionMatch = /^\/pmachine\/debug\/session\/(step|stepout|continue|pause)$/.exec(route);
    if (actionMatch && req.method === 'POST') {
      const id = requireSession(params);
      const action = {
        step: stepJavaScriptPmachineDebugSession,
        stepout: stepOutJavaScriptPmachineDebugSession,
        continue: continueJavaScriptPmachineDebugSession,
        pause: pauseJavaScriptPmachineDebugSession
      }[actionMatch[1]];
      action(id);
      return send(res, 200, { sessionId: id, status: actionMatch[1] === 'pause' ? 'paused' : 'running' });
    }

    const breakpointMatch = /^\/pmachine\/debug\/session\/breakpoint\/(set|clear)$/.exec(route);
    if (breakpointMatch && req.method === 'POST') {
      const id = requireSession(params);
      const pc = Number.parseInt(params.get('pc'), 10);
      if (!Number.isInteger(pc) || pc < 0 || pc > 65535) return send(res, 400, 'Invalid pc param');
      const current = new Set(getJavaScriptPmachineDebugState(id).breakpoints);
      if (breakpointMatch[1] === 'set') current.add(pc);
      else current.delete(pc);
      setJavaScriptPmachineDebugBreakpoints(id, [...current]);
      return send(res, 200, { sessionId: id, breakpoints: [...current] });
    }

    return send(res, 404, 'Not found');
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (!res.headersSent) send(res, error?.status || 500, error?.message || String(error));
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = parseCliArgs(process.argv.slice(2));
  const server = createJsPmachineNodeServer({ name: args.name, port: args.port });
  server.listen(args.port, args.host, () => {
    console.log(`[js-pmachine] ${args.name} listening on http://${args.host}:${args.port}`);
  });
}
