#!/usr/bin/env node
// Standalone JavaScript PMachine node. Serves the same HTTP contract as the
// ESP32 firmware (/status, /ffs/upload, /pmachine/execute_file and
// /pmachine/debug/session*) so backend run/debug bridges can target it by host.
import http from 'node:http';
import dgram from 'node:dgram';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { runSingleMessageForEvolution } from './index.mjs';
import { normalizeDiscoveryAnnouncement } from './discovery-collector.mjs';
import { createPascalishServiceHost } from './src/service-host.mjs';
import { signPcodeText } from '../../aggregator/scripts/pcode-signing.mjs';
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
    name: process.env.JS_PMACHINE_NAME || '',
    backendUrl: process.env.JS_PMACHINE_BACKEND_URL || 'http://127.0.0.1:4000',
    advertiseHost: process.env.JS_PMACHINE_ADVERTISE_HOST || '127.0.0.1',
    udpAnnounceHost: process.env.JS_PMACHINE_UDP_ANNOUNCE_HOST || '127.255.255.255',
    udpAnnouncePort: Number(process.env.JS_PMACHINE_UDP_ANNOUNCE_PORT ?? 4210),
    storageGrants: JSON.parse(process.env.JS_PMACHINE_STORAGE_GRANTS || '{}')
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--port') args.port = Number(argv[++index]);
    else if (token === '--host') args.host = String(argv[++index]);
    else if (token === '--name') args.name = String(argv[++index]);
    else if (token === '--backend') args.backendUrl = String(argv[++index]);
    else if (token === '--advertise-host') args.advertiseHost = String(argv[++index]);
    else if (token === '--udp-announce-host') args.udpAnnounceHost = String(argv[++index]);
    else if (token === '--udp-announce-port') args.udpAnnouncePort = Number(argv[++index]);
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
  let rawBody = '';
  if (req.method === 'POST' || req.method === 'DELETE') {
    rawBody = await readBody(req);
    const contentType = String(req.headers['content-type'] || '');
    if (rawBody && contentType.includes('application/json')) {
      for (const [key, value] of Object.entries(JSON.parse(rawBody))) params.set(key, String(value));
    } else if (rawBody) {
      for (const [key, value] of new URLSearchParams(rawBody)) params.set(key, value);
    }
  }
  return { params, rawBody };
}

function parseHostedMap(pcode, mapText, label) {
  let map;
  try { map = JSON.parse(mapText); } catch { throw Object.assign(new Error(`Invalid ${label} program map`), { status: 400 }); }
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    throw Object.assign(new Error(`Invalid ${label} program map`), { status: 400 });
  }
  const signature = map?.signing?.signature;
  const expected = Buffer.from(signPcodeText(pcode), 'hex');
  const actual = typeof signature === 'string' && /^[a-f0-9]{64}$/i.test(signature)
    ? Buffer.from(signature, 'hex') : Buffer.alloc(0);
  if (map.signing?.algorithm !== 'hmac-sha256'
    || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw Object.assign(new Error(`Invalid ${label} pcode signature`), { status: 400 });
  }
  return map;
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

export function createJsPmachineNodeServer({
  name = 'js-pmachine',
  port = 4111,
  backendUrl = '',
  advertiseHost = '127.0.0.1',
  announceIntervalMs = 60_000,
  udpAnnounceHost = '127.255.255.255',
  udpAnnouncePort = 0,
  fetchImpl = fetch,
  logger = console,
  storageGrants = {}
} = {}) {
  if (!storageGrants || typeof storageGrants !== 'object' || Array.isArray(storageGrants)) {
    throw new Error('Invalid service storage grants');
  }
  if (!Number.isSafeInteger(udpAnnouncePort) || udpAnnouncePort < 0 || udpAnnouncePort > 65535) {
    throw new Error('UDP announcement port must be an integer from 0 to 65535');
  }
  if (!Number.isSafeInteger(announceIntervalMs) || announceIntervalMs < 1) {
    throw new Error('Announcement interval must be a positive integer');
  }
  const files = new Map();
  const startedAt = Date.now();
  const stats = { runs: 0, debugSessions: 0 };
  let hostedService = null;
  const additionalHostedServices = new Map();

  function serviceRegistrations() {
    const origin = `http://${advertiseHost}:${server.address()?.port ?? port}`;
    const services = [{
      serviceId: 'pmachine', instanceId: `${name}:pmachine`, kind: 'runtime',
      provider: 'javascript', enabled: true, endpoint: `${origin}/pmachine/execute_file`
    }];
    for (const host of [hostedService, ...additionalHostedServices.values()]) {
      if (!host) continue;
      const registration = host.getRegistration();
      const status = host.getStatus();
      const base = status.httpPort ? `http://127.0.0.1:${status.httpPort}` : origin;
      services.push({ ...registration, provider: 'pascalish', endpoint: `${base}/` });
      for (const daemon of registration.daemons) {
        services.push({
          serviceId: daemon, instanceId: `${registration.instanceId}:${daemon}`,
          kind: 'daemon', provider: 'pascalish', enabled: registration.enabled,
          endpoint: `${origin}/pmachine/service_host/status?collectorId=${encodeURIComponent(registration.instanceId)}`
        });
      }
    }
    return services;
  }

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

  async function installHostedService(params) {
    const additional = params.get('additional') === 'true';
    if (!additional && hostedService?.getStatus().running) {
      throw Object.assign(new Error('Stop the active hosted service before installing another'), { status: 409 });
    }
    const servicePcode = readFfsFile(params.get('serviceFile'));
    const serviceMap = parseHostedMap(
      servicePcode,
      readFfsFile(params.get('serviceMap')),
      'service',
    );
    if (serviceMap.hostBindingsVersion !== 1 || serviceMap.runtimeUnit?.kind !== 'service') {
      throw Object.assign(new Error('Expected a hosted Pascalish service'), { status: 400 });
    }

    const daemonFile = String(params.get('daemonFile') || '');
    const daemonMapFile = String(params.get('daemonMap') || '');
    if (Boolean(daemonFile) !== Boolean(daemonMapFile)) {
      throw Object.assign(new Error('Daemon pcode and map must be supplied together'), { status: 400 });
    }
    const daemons = [];
    const sharedDaemons = params.has('daemons');
    if (sharedDaemons && daemonFile) throw Object.assign(new Error('Use daemons or legacy daemonFile, not both'), { status: 400 });
    if (sharedDaemons) {
      const json = params.get('daemons');
      const entries = json.length <= 1024 ? JSON.parse(json) : null;
      if (!Array.isArray(entries) || entries.length < 1 || entries.length > 3) {
        throw Object.assign(new Error('Invalid daemons list (1..3 entries)'), { status: 400 });
      }
      for (const entry of entries) {
        if (typeof entry?.file !== 'string' || typeof entry?.map !== 'string') {
          throw Object.assign(new Error('Each daemon needs file and map'), { status: 400 });
        }
        const pcodeText = readFfsFile(entry.file);
        const programMap = parseHostedMap(pcodeText, readFfsFile(entry.map), 'daemon');
        daemons.push({ compiled: { pcodeText, programMap }, udpPort: entry.udpPort ?? null, udpShared: entry.udpShared ?? false,
          multicastGroup: entry.multicastGroup ?? '', multicastInterface: entry.multicastInterface ?? '' });
      }
    } else if (daemonFile) {
      const daemonPcode = readFfsFile(daemonFile);
      const daemonMap = parseHostedMap(daemonPcode, readFfsFile(daemonMapFile), 'daemon');
      if (daemonMap.hostBindingsVersion !== 1 || daemonMap.runtimeUnit?.kind !== 'daemon') {
        throw Object.assign(new Error('Expected a hosted daemon'), { status: 400 });
      }
      daemons.push({ pcodeText: daemonPcode, programMap: daemonMap });
    }

    const collectorId = String(params.get('collectorId') || serviceMap.runtimeUnit.id || name);
    if (additional && (hostedService?.getStatus().collectorId === collectorId || additionalHostedServices.has(collectorId))) {
      throw Object.assign(new Error(`Hosted collector already installed: ${collectorId}`), { status: 409 });
    }
    const udpPort = Number(params.get('udpPort') || 0);
    const observationTtlMs = Number(params.get('observationTtlMs') || 180000);
    const httpPort = additional ? Number(params.get('httpPort')) : null;
    if (!Number.isInteger(udpPort) || udpPort < 0 || udpPort > 65535) {
      throw Object.assign(new Error('Invalid UDP port'), { status: 400 });
    }
    if (additional && (!Number.isInteger(httpPort) || httpPort < 0 || httpPort > 65535)) {
      throw Object.assign(new Error('Invalid additional collector HTTP port'), { status: 400 });
    }
    if (!Number.isInteger(observationTtlMs) || observationTtlMs < 1 || observationTtlMs > 180000) {
      throw Object.assign(new Error('Invalid observation TTL'), { status: 400 });
    }

    const nextHost = await createPascalishServiceHost({
      compiled: { pcodeText: servicePcode, programMap: serviceMap },
      daemons,
      collectorId,
      host: additional ? '127.0.0.1' : '0.0.0.0',
      httpPort,
      udpPort: additional || sharedDaemons && !udpPort ? null : udpPort,
      networkPeers: params.has('networkPeers') ? JSON.parse(params.get('networkPeers')) : [],
      storageRoots: Object.hasOwn(storageGrants, collectorId) ? storageGrants[collectorId] : {},
      bindings: {
        'host.announcement': normalizeDiscoveryAnnouncement,
        'host.observation_ttl': () => observationTtlMs,
      },
      logger,
    });
    if (!additional && hostedService) await hostedService.stop();
    try {
      await nextHost.start();
    } catch (error) {
      await nextHost.stop();
      throw error;
    }
    if (additional) {
      additionalHostedServices.set(collectorId, nextHost);
      return nextHost.getStatus();
    }
    hostedService = nextHost;
    return hostedService.getStatus();
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
    const { params, rawBody } = await readParams(req, url);

    if (route === '/api/services' && req.method === 'GET') {
      return send(res, 200, { nodeId: name, services: serviceRegistrations() });
    }

    if (route === '/status' && req.method === 'GET') {
      return send(res, 200, {
        nodeName: name,
        runtime: 'js-pmachine',
        role: 'pmachine',
        services: serviceRegistrations().map(service => service.serviceId),
        port: server.address()?.port ?? port,
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

    if (route === '/pmachine/service_host/install' && req.method === 'POST') {
      return send(res, 200, await installHostedService(params));
    }
    if (route === '/pmachine/service_host/status' && req.method === 'GET') {
      const collectorId = params.get('collectorId');
      if (collectorId) {
        const selected = hostedService?.getStatus().collectorId === collectorId
          ? hostedService : additionalHostedServices.get(collectorId);
        if (!selected) return send(res, 404, { error: `Hosted collector not found: ${collectorId}` });
        return send(res, 200, selected.getStatus());
      }
      return send(res, 200, hostedService?.getStatus() || {
        running: false, hostBindingsVersion: 1, runtime: 'pascalish-hosted',
      });
    }
    if (route === '/pmachine/service_host/stop' && req.method === 'POST') {
      const collectorId = params.get('collectorId');
      if (collectorId && additionalHostedServices.has(collectorId)) {
        const selected = additionalHostedServices.get(collectorId);
        await selected.stop();
        additionalHostedServices.delete(collectorId);
      } else if (hostedService && (!collectorId || hostedService.getStatus().collectorId === collectorId)) {
        await hostedService.stop();
        hostedService = null;
      }
      return send(res, 200, { running: false });
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

    if (hostedService?.getStatus().running) {
      const result = await hostedService.dispatch({
        transport: 'http',
        method: req.method,
        path: route,
        body: rawBody,
        peer: req.socket.remoteAddress?.replace('::ffff:', '') || '',
        query: Object.fromEntries(url.searchParams),
      });
      return send(res, result.status, JSON.stringify(result.body), 'application/json');
    }
    return send(res, 404, 'Not found');
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (!res.headersSent) send(res, error?.status || 500, error?.message || String(error));
    });
  });
  server.once('close', () => {
    const service = hostedService;
    hostedService = null;
    if (service) {
      service.stop().catch(error => logger.error(`[js-pmachine] hosted service shutdown failed: ${error.message}`));
    }
    for (const [collectorId, additional] of additionalHostedServices) {
      additionalHostedServices.delete(collectorId);
      additional.stop().catch(error => logger.error(`[js-pmachine] ${collectorId} shutdown failed: ${error.message}`));
    }
  });
  if (backendUrl || udpAnnouncePort) {
    const announcementUrl = backendUrl ? new URL('/api/pmachine/announce', backendUrl) : null;
    let timer;
    let pending = false;
    let udpSocket;
    let udpReady = false;
    function announcement() {
      return {
        kind: 'nodeBeacon',
        nodeId: name,
        nodeName: name,
        ip: advertiseHost,
        port: server.address().port,
        hardware: 'PMachine JavaScript VM',
        runtime: 'js-pmachine',
        available: true,
        source: 'js-pmachine-announce',
        services: [{ name: 'pmachine', endpoint: '/pmachine/execute_file' }]
      };
    }
    function announceUdp() {
      if (!udpReady || !server.listening) return;
      udpSocket.send(Buffer.from(JSON.stringify(announcement())), udpAnnouncePort, udpAnnounceHost, error => {
        if (error) logger.warn(`[js-pmachine] ${name} UDP announcement to ${udpAnnounceHost}:${udpAnnouncePort} failed: ${error.message}`);
      });
    }
    async function announce() {
      announceUdp();
      if (!announcementUrl || pending || !server.listening) return;
      pending = true;
      try {
        const response = await fetchImpl(announcementUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify(announcement())
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        await response.arrayBuffer();
      } catch (error) {
        logger.warn(`[js-pmachine] ${name} announcement to ${announcementUrl} failed: ${error.message}`);
      } finally {
        pending = false;
      }
    }
    server.on('listening', () => {
      if (udpAnnouncePort) {
        udpSocket = dgram.createSocket('udp4');
        udpSocket.on('error', error => {
          logger.warn(`[js-pmachine] ${name} UDP announcement socket failed: ${error.message}`);
        });
        udpSocket.bind(0, () => {
          if (!server.listening) return;
          try {
            udpSocket.setBroadcast(true);
            udpReady = true;
            udpSocket.unref();
            announceUdp();
          } catch (error) {
            logger.warn(`[js-pmachine] ${name} UDP announcement setup failed: ${error.message}`);
          }
        });
      }
      void announce();
      timer = setInterval(announce, announceIntervalMs);
      timer.unref();
    });
    server.on('close', () => {
      clearInterval(timer);
      udpReady = false;
      if (udpSocket) udpSocket.close();
    });
  }
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = parseCliArgs(process.argv.slice(2));
  const server = createJsPmachineNodeServer(args);
  server.listen(args.port, args.host, () => {
    console.log(`[js-pmachine] ${args.name} listening on http://${args.host}:${server.address().port}`);
  });
}
