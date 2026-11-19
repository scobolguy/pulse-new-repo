#!/usr/bin/env node
// Standalone JavaScript PMachine node. Serves the same HTTP contract as the
// ESP32 firmware (/status, /ffs/upload, /pmachine/execute_file and
// /pmachine/debug/session*) so backend run/debug bridges can target it by host.
import http from 'node:http';
import dgram from 'node:dgram';
import os from 'node:os';
import v8 from 'node:v8';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  executeProgram,
  loadOpcodeMap,
  parsePcode,
  parseProgramMapMappings,
  PMachineScheduler,
  runSingleMessageForEvolution
} from './index.mjs';
import { normalizeDiscoveryAnnouncement } from './discovery-collector.mjs';
import { createAggregatorCacheSourceResolver, createPascalishServiceHost } from './src/service-host.mjs';
import { createFilesystemBindings } from './src/filesystem-bindings.mjs';
import { createNodeSlotScheduler } from './src/slot-scheduler.mjs';
import { createInventoryClient } from './src/inventory-client.mjs';
import { createWindowsBluetoothSource } from './src/bluetooth-source.mjs';
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
    backendUrl: process.env.JS_PMACHINE_BACKEND_URL || '',
    aggregatorUrl: process.env.JS_PMACHINE_AGGREGATOR_URL || '',
    advertiseHost: process.env.JS_PMACHINE_ADVERTISE_HOST || '127.0.0.1',
    udpAnnounceHost: process.env.JS_PMACHINE_UDP_ANNOUNCE_HOST || '',
    udpAnnouncePort: Number(process.env.JS_PMACHINE_UDP_ANNOUNCE_PORT ?? process.env.UDP_PORT ?? 4210),
    storageGrants: JSON.parse(process.env.JS_PMACHINE_STORAGE_GRANTS || '{}'),
    distributedGrants: JSON.parse(process.env.JS_PMACHINE_DISTRIBUTED_GRANTS || '{}'),
    bluetoothGrants: JSON.parse(process.env.JS_PMACHINE_BLUETOOTH_GRANTS || '[]'),
    ffsRoot: process.env.JS_PMACHINE_FFS_ROOT || ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--port') args.port = Number(argv[++index]);
    else if (token === '--host') args.host = String(argv[++index]);
    else if (token === '--name') args.name = String(argv[++index]);
    else if (token === '--backend') args.backendUrl = String(argv[++index]);
    else if (token === '--aggregator-url') args.aggregatorUrl = String(argv[++index]);
    else if (token === '--advertise-host') args.advertiseHost = String(argv[++index]);
    else if (token === '--udp-announce-host') args.udpAnnounceHost = String(argv[++index]);
    else if (token === '--udp-announce-port') args.udpAnnouncePort = Number(argv[++index]);
    else if (token === '--ffs-root') args.ffsRoot = String(argv[++index]);
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
      let parsed;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        throw Object.assign(new Error('Invalid JSON request body'), { status: 400 });
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw Object.assign(new Error('Expected a JSON request object'), { status: 400 });
      }
      for (const [key, value] of Object.entries(parsed)) {
        params.set(key, ['serviceLifecycle', 'reportTarget'].includes(key) && value !== null && typeof value === 'object'
          ? JSON.stringify(value) : String(value));
      }
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
  aggregatorUrl = '',
  advertiseHost = '127.0.0.1',
  announceIntervalMs = 60_000,
  udpAnnounceHost = '',
  udpAnnouncePort = 0,
  fetchImpl = fetch,
  logger = console,
  scheduler = null,
  onDaemonEvent = null,
  distributedGrants = {},
  inventoryGrants = {},
  bluetoothGrants = [],
  bluetoothSourceFactory = createWindowsBluetoothSource,
  storageGrants = {},
  ffsRoot = '',
  discoveryFactory = async options => {
    const { createLanDiscovery } = await import('../../aggregator/src/service-lifecycle/lan-discovery.mjs');
    return createLanDiscovery(options);
  }
} = {}) {
  if (scheduler !== null && !(scheduler instanceof PMachineScheduler)) throw new TypeError('Invalid pmachine scheduler');
  if (!storageGrants || typeof storageGrants !== 'object' || Array.isArray(storageGrants)) {
    throw new Error('Invalid service storage grants');
  }
  if (!distributedGrants || typeof distributedGrants !== 'object' || Array.isArray(distributedGrants)) {
    throw new Error('Invalid distributed table deployment grants');
  }
  if (!inventoryGrants || typeof inventoryGrants !== 'object' || Array.isArray(inventoryGrants)) {
    throw new Error('Invalid inventory deployment grants');
  }
  for (const [serviceId, grant] of Object.entries(inventoryGrants)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(serviceId)) throw new Error('Invalid inventory service grant name');
    createInventoryClient(grant);
  }
  if (!Array.isArray(bluetoothGrants) || bluetoothGrants.some(id => typeof id !== 'string' || !id) ||
      typeof bluetoothSourceFactory !== 'function') throw new Error('Invalid Bluetooth discovery deployment grants');
  if (!Number.isSafeInteger(udpAnnouncePort) || udpAnnouncePort < 0 || udpAnnouncePort > 65535) {
    throw new Error('UDP announcement port must be an integer from 0 to 65535');
  }
  if (!Number.isSafeInteger(announceIntervalMs) || announceIntervalMs < 1) {
    throw new Error('Announcement interval must be a positive integer');
  }
  const files = new Map();
  const uploadedFiles = new Set();
  const startedAt = Date.now();
  const stats = { runs: 0, debugSessions: 0 };
  let hostedService = null;
  const additionalHostedServices = new Map();
  const managedHosts = new Map();
  let durableFfs;
  const durableFfsReady = ffsRoot
    ? createFilesystemBindings({ pmachine: { path: ffsRoot, readOnly: false } }, {
      maxFileBytes: 1000000,
      maxPageBytes: 262144
    }).then(bindings => { durableFfs = bindings; })
    : Promise.resolve();

  function ffsRelativePath(remotePath) {
    if (typeof remotePath !== 'string' || remotePath.length > 4096
      || !remotePath.startsWith('/') || remotePath.startsWith('//')
      || remotePath.includes('\\') || remotePath.includes(':')
      || [...remotePath].some(character => character.charCodeAt(0) < 32)) {
      throw Object.assign(new Error('Invalid FFS path'), { status: 400 });
    }
    const parts = remotePath.slice(1).split('/');
    if (!parts.length || parts.some(part => !part || part === '.' || part === '..'
      || /[ .]$/.test(part) || /[<>?"*|]/.test(part))) {
      throw Object.assign(new Error('Invalid FFS path'), { status: 400 });
    }
    return parts.join('/');
  }

  function bundleFilePath(storagePath, entry) {
    const base = ffsRelativePath(storagePath);
    if (typeof entry !== 'string' || !entry || entry.startsWith('/')
      || entry.includes('\\') || entry.includes(':')) {
      throw Object.assign(new Error('Invalid bundle entry path'), { status: 400 });
    }
    const relative = entry.split('/');
    if (relative.some(part => !part || part === '.' || part === '..'
      || /[ .]$/.test(part) || /[<>?"*|]/.test(part))) {
      throw Object.assign(new Error('Invalid bundle entry path'), { status: 400 });
    }
    return `/${base}/${relative.join('/')}`;
  }

  async function readFfsFile(remotePath) {
    const key = String(remotePath || '');
    const relative = ffsRelativePath(key);
    await durableFfsReady;
    if (durableFfs) {
      try {
        return await durableFfs.handlers['host.fs_read_text']('pmachine', relative);
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw Object.assign(new Error(`File not found: ${remotePath}`), { status: 404 });
        }
        throw error;
      }
    }
    const value = files.get(key);
    if (value == null) throw Object.assign(new Error(`File not found: ${remotePath}`), { status: 404 });
    return value;
  }

  async function writeFfsFile(remotePath, value) {
    const relative = ffsRelativePath(remotePath);
    await durableFfsReady;
    if (!durableFfs) {
      files.set(remotePath, String(value));
      uploadedFiles.add(remotePath);
      return;
    }
    const parts = relative.split('/');
    let directory = '';
    for (const part of parts.slice(0, -1)) {
      directory = directory ? `${directory}/${part}` : part;
      if (!await durableFfs.handlers['host.fs_exists']('pmachine', directory)) {
        await durableFfs.handlers['host.fs_mkdir']('pmachine', directory);
      }
    }
    await durableFfs.handlers['host.fs_write_text']('pmachine', relative, String(value));
    uploadedFiles.add(remotePath);
  }

  let schedulerSavedState = '{"version":1,"slots":[]}';
  const slotAdapter = createNodeSlotScheduler({
    readFile: readFfsFile,
    prepare: prepareSlotProgram,
    start: startSlotProgram,
    stop: stopSlotProgram,
    async readState() {
      await durableFfsReady;
      if (!durableFfs) return schedulerSavedState;
      try {
        return await durableFfs.handlers['host.fs_read_text']('pmachine', '.pmachine-scheduler/slots.json');
      } catch (error) {
        if (error.code === 'ENOENT') return '{"version":1,"slots":[]}';
        throw error;
      }
    },
    async writeState(text) {
      await durableFfsReady;
      if (!durableFfs) {
        schedulerSavedState = text;
        return;
      }
      const directory = '.pmachine-scheduler';
      if (!await durableFfs.handlers['host.fs_exists']('pmachine', directory)) {
        await durableFfs.handlers['host.fs_mkdir']('pmachine', directory);
      }
      await durableFfs.handlers['host.fs_write_text']('pmachine', `${directory}/slots.json`, text);
    }
  });

  function serviceRegistrations() {
    const origin = `http://${advertiseHost}:${server.address()?.port ?? port}`;
    const services = [{
      serviceId: 'pmachine', instanceId: `${name}:pmachine`, kind: 'runtime',
      provider: 'javascript', enabled: true, endpoint: `${origin}/pmachine/execute_file`
    }];
    for (const host of [hostedService, ...additionalHostedServices.values(), ...managedHosts.values()]) {
      if (!host) continue;
      const registration = host.getRegistration();
      const status = host.getStatus();
      const base = status.httpPort ? `http://127.0.0.1:${status.httpPort}` : origin;
      services.push({
        ...registration,
        provider: status.serviceCapabilities.sourceLanguage,
        endpoint: `${base}/`,
        capabilities: status.serviceCapabilities
      });
      for (const daemon of registration.daemons) {
        services.push({
          serviceId: daemon, instanceId: `${registration.instanceId}:${daemon}`,
          kind: 'daemon',
          provider: status.daemonDiagnostics.find(unit => unit.id === daemon)?.sourceLanguage || 'unknown',
          enabled: registration.enabled,
          endpoint: `${origin}/pmachine/service_host/status?collectorId=${encodeURIComponent(registration.instanceId)}`
        });
      }
    }
    return services;
  }

  async function executeFile(params) {
    const pcodeText = await readFfsFile(params.get('file'));
    const programMapText = params.get('programMap') ? await readFfsFile(params.get('programMap')) : '{}';
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
      }, { scheduler });
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
    const servicePcode = await readFfsFile(params.get('serviceFile'));
    const serviceMap = parseHostedMap(
      servicePcode,
      await readFfsFile(params.get('serviceMap')),
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
      const entries = json.length <= 8192 ? JSON.parse(json) : null;
      if (!Array.isArray(entries) || entries.length < 1 || entries.length > 16) {
        throw Object.assign(new Error('Invalid daemons list (1..16 entries)'), { status: 400 });
      }
      for (const entry of entries) {
        if (typeof entry?.file !== 'string' || typeof entry?.map !== 'string') {
          throw Object.assign(new Error('Each daemon needs file and map'), { status: 400 });
        }
        const pcodeText = await readFfsFile(entry.file);
        const programMap = parseHostedMap(pcodeText, await readFfsFile(entry.map), 'daemon');
        daemons.push({ compiled: { pcodeText, programMap }, udpPort: entry.udpPort ?? null, udpShared: entry.udpShared ?? false,
          udpQueueLimit: entry.udpQueueLimit ?? 1,
          udpBindAddress: entry.udpBindAddress ?? (additional ? '127.0.0.1' : '0.0.0.0'),
          multicastGroup: entry.multicastGroup ?? '', multicastInterface: entry.multicastInterface ?? '' });
      }
    } else if (daemonFile) {
      const daemonPcode = await readFfsFile(daemonFile);
      const daemonMap = parseHostedMap(daemonPcode, await readFfsFile(daemonMapFile), 'daemon');
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

    let lifecycle;
    let cacheSourceAggregatorUrl = aggregatorUrl || backendUrl;
    if (params.has('serviceLifecycle') || params.has('ownerAggregatorId') || params.has('reportTarget')) {
      const configured = params.has('serviceLifecycle') ? JSON.parse(params.get('serviceLifecycle')) : {};
      const reporting = params.has('reportTarget') ? JSON.parse(params.get('reportTarget')) : null;
      if (!configured || typeof configured !== 'object' || Array.isArray(configured)
        || (configured.requires !== undefined && (!Array.isArray(configured.requires)
          || configured.requires.some(id => typeof id !== 'string' || !id)))
        || !params.get('ownerAggregatorId') || typeof reporting?.endpoint !== 'string') {
        throw Object.assign(new Error('Hosted lifecycle requires explicit owner, report target and valid requirements'), { status: 400 });
      }
      cacheSourceAggregatorUrl = reporting?.endpoint || cacheSourceAggregatorUrl;
      const requirements = serviceMap.serviceLifecycle?.requires || [];
      lifecycle = {
        metadata: { ...configured, version: configured.version ?? 1,
          requires: [...new Set([...requirements, ...(configured.requires || [])])] },
        env: {
          ...process.env,
          PULSE_NODE_ID: name,
          PULSE_SERVICE_INSTANCE_ID: params.get('instanceId') || `${collectorId}:${name}`,
          PULSE_OWNER_AGGREGATOR_ID: params.get('ownerAggregatorId') || '',
          PULSE_SERVICE_BINDINGS: JSON.stringify(configured.bindings || {}),
          PULSE_AGGREGATOR_URLS: JSON.stringify(reporting ? [reporting.endpoint] : []),
        },
      };
    }
    const nextHost = await createPascalishServiceHost({
      compiled: { pcodeText: servicePcode, programMap: serviceMap },
      inventoryGrant: Object.hasOwn(inventoryGrants, serviceMap.runtimeUnit.id) ? inventoryGrants[serviceMap.runtimeUnit.id] : null,
      daemons,
      collectorId,
      host: additional ? '127.0.0.1' : '0.0.0.0',
      httpPort,
      lifecycle,
      cacheSourceResolver: cacheSourceAggregatorUrl
        ? createAggregatorCacheSourceResolver({
          aggregatorUrl: cacheSourceAggregatorUrl,
          fetchImpl,
        })
        : null,
      sharedHttpListener: () => server.address(),
      udpPort: additional || sharedDaemons && !udpPort ? null : udpPort,
      networkPeers: params.has('networkPeers') ? JSON.parse(params.get('networkPeers')) : [],
      storageRoots: Object.hasOwn(storageGrants, collectorId) ? storageGrants[collectorId] : {},
      distributedBindings: Object.hasOwn(distributedGrants, collectorId) ? distributedGrants[collectorId] : {},
      bluetoothSourceFactory: bluetoothGrants.includes(collectorId) ? bluetoothSourceFactory : null,
      bindings: {
        'host.announcement': normalizeDiscoveryAnnouncement,
        'host.observation_ttl': () => observationTtlMs,
      },
      logger,
      onDaemonEvent,
      scheduler,
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

  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  async function readBundleImage(manifest, entry, mapEntry, expectedKind, digest = null, requireDigest = true) {
    if (typeof manifest.storagePath !== 'string') {
      throw Object.assign(new Error('Bundle storagePath is required'), { status: 400 });
    }
    if (requireDigest && (digest === null || digest === undefined)) {
      throw Object.assign(new Error('Bundle entry SHA-256 is required'), { status: 400 });
    }
    const pcodeText = await readFfsFile(bundleFilePath(manifest.storagePath, entry));
    if (digest !== null && digest !== undefined && (typeof digest !== 'string'
      || !/^[a-f0-9]{64}$/i.test(digest)
      || createHash('sha256').update(pcodeText, 'utf8').digest('hex') !== digest.toLowerCase())) {
      throw Object.assign(new Error('Bundle entry SHA-256 mismatch'), { status: 400 });
    }
    const mapText = await readFfsFile(bundleFilePath(manifest.storagePath, mapEntry));
    const programMap = parseHostedMap(pcodeText, mapText, expectedKind || 'program');
    if (expectedKind && (programMap.hostBindingsVersion !== 1
      || programMap.runtimeUnit?.kind !== expectedKind)) {
      throw Object.assign(new Error(`Expected a hosted ${expectedKind}`), { status: 400 });
    }
    try {
      parsePcode(pcodeText);
      parseProgramMapMappings(programMap);
    } catch (error) {
      throw Object.assign(new Error(`Invalid ${expectedKind || 'program'} image: ${error.message}`), { status: 400 });
    }
    return { pcodeText, programMap };
  }

  async function readDaemonEntries(manifest) {
    if (manifest.daemons === undefined) return [];
    if (!Array.isArray(manifest.daemons) || manifest.daemons.length > 16) {
      throw Object.assign(new Error('Invalid daemons list (0..16 entries)'), { status: 400 });
    }
    const daemons = [];
    for (const entry of manifest.daemons) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw Object.assign(new Error('Invalid daemon entry'), { status: 400 });
      }
      const daemon = await readBundleImage(
        manifest,
        entry.entry ?? entry.file,
        entry.programMap ?? entry.map,
        'daemon',
        entry.sha256,
      );
      daemons.push({
        compiled: daemon,
        udpPort: entry.udpPort ?? null,
        udpShared: entry.udpShared ?? false,
        udpQueueLimit: entry.udpQueueLimit ?? 1,
        udpBindAddress: entry.udpBindAddress ?? '127.0.0.1',
        multicastGroup: entry.multicastGroup ?? '',
        multicastInterface: entry.multicastInterface ?? ''
      });
    }
    return daemons;
  }

  async function createSlotHost(prepared, slot) {
    const service = prepared.service || {
      pcodeText: 'HALT',
      programMap: {
        hostBindingsVersion: 1,
        runtimeUnit: { kind: 'service', id: `slot-${slot}-daemon-host` },
        sourceLanguage: 'scheduler'
      }
    };
    const collectorId = `pmachine-slot-${slot}`;
    return createPascalishServiceHost({
      compiled: service,
      daemons: prepared.daemons,
      collectorId,
      host: '127.0.0.1',
      httpPort: null,
      udpPort: null,
      sharedHttpListener: () => server.address(),
      cacheSourceResolver: (aggregatorUrl || backendUrl)
        ? createAggregatorCacheSourceResolver({ aggregatorUrl: aggregatorUrl || backendUrl, fetchImpl })
        : null,
      storageRoots: Object.hasOwn(storageGrants, collectorId) ? storageGrants[collectorId] : {},
      distributedBindings: Object.hasOwn(distributedGrants, collectorId) ? distributedGrants[collectorId] : {},
      bluetoothSourceFactory: bluetoothGrants.includes(collectorId) ? bluetoothSourceFactory : null,
      bindings: {
        'host.announcement': normalizeDiscoveryAnnouncement,
        'host.observation_ttl': () => 180000,
      },
      logger,
      onDaemonEvent,
      scheduler,
    });
  }

  async function prepareSlotProgram(descriptor) {
    const manifestPath = descriptor.manifestPath;
    if (typeof manifestPath !== 'string' || !manifestPath) {
      throw Object.assign(new Error('Scheduler manifestPath is required'), { status: 400 });
    }
    const storedText = await readFfsFile(manifestPath);
    let storedManifest;
    try {
      storedManifest = JSON.parse(storedText);
    } catch {
      throw Object.assign(new Error('Invalid bundle manifest'), { status: 400 });
    }
    if (!storedManifest || typeof storedManifest !== 'object' || Array.isArray(storedManifest)
      || stableJson(storedManifest) !== stableJson(descriptor.manifest)) {
      throw Object.assign(new Error('Bundle manifest changed since it was scheduled'), { status: 409 });
    }
    if (descriptor.kind !== storedManifest.type) {
      throw Object.assign(new Error('Bundle kind does not match scheduler descriptor'), { status: 400 });
    }
    if (descriptor.kind === 'transient') {
      const image = await readBundleImage(
        storedManifest, storedManifest.entry, storedManifest.programMap, null, storedManifest.sha256,
      );
      return { kind: 'transient', manifest: storedManifest, image };
    }
    const daemons = await readDaemonEntries(storedManifest);
    if (descriptor.kind === 'service') {
      const service = await readBundleImage(
        storedManifest, storedManifest.entry, storedManifest.programMap, 'service', storedManifest.sha256,
      );
      const prepared = { kind: 'service', manifest: storedManifest, service, daemons };
      prepared.host = await createSlotHost(prepared, descriptor.slot);
      return prepared;
    }
    if (descriptor.kind === 'daemon') {
      const daemon = await readBundleImage(
        storedManifest, storedManifest.entry, storedManifest.programMap, 'daemon', storedManifest.sha256,
      );
      let service = null;
      if (storedManifest.serviceEntry !== undefined || storedManifest.serviceProgramMap !== undefined) {
        if (typeof storedManifest.serviceEntry !== 'string'
          || typeof storedManifest.serviceProgramMap !== 'string') {
          throw Object.assign(new Error('serviceEntry and serviceProgramMap must be supplied together'), { status: 400 });
        }
        service = await readBundleImage(
          storedManifest, storedManifest.serviceEntry, storedManifest.serviceProgramMap, 'service', null, false,
        );
      }
      const prepared = {
        kind: 'daemon',
        manifest: storedManifest,
        service,
        daemons: [{ compiled: daemon }, ...daemons]
      };
      prepared.host = await createSlotHost(prepared, descriptor.slot);
      return prepared;
    }
    throw Object.assign(new Error('Unsupported scheduler bundle kind'), { status: 400 });
  }

  async function startSlotProgram(prepared, descriptor) {
    if (prepared.kind === 'transient') {
      const opcodeMap = await loadOpcodeMap();
      const options = {
        instructions: parsePcode(prepared.image.pcodeText),
        programMap: prepared.image.programMap,
        opcodeMap,
        inputQueue: prepared.manifest.inputQueue || 'deploy-api.in',
        sourceMessage: prepared.manifest.message ?? '',
        runtimeContext: { maxSteps: 200000 }
      };
      const result = scheduler ? await scheduler.execute(options, { name: `transient:${descriptor.slot}` })
        : await executeProgram(options);
      if (result.error || result.stepLimitHit) {
        throw Object.assign(new Error(result.error || 'Transient program exceeded its step limit'), { status: 422 });
      }
      return { kind: 'transient', result };
    }

    const nextHost = prepared.host;
    try {
      await nextHost.start();
    } catch (error) {
      await nextHost.stop();
      throw error;
    }
    managedHosts.set(descriptor.slot, nextHost);
    return nextHost;
  }

  async function stopSlotProgram(active) {
    if (active?.kind === 'transient') return;
    await active?.stop();
    for (const [slot, host] of managedHosts) {
      if (host === active) {
        managedHosts.delete(slot);
        break;
      }
    }
  }

  async function createDebugSession(params) {
    const pcodeText = await readFfsFile(params.get('file'));
    const programMap = params.get('programMap') ? JSON.parse(await readFfsFile(params.get('programMap'))) : {};
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

    if (route === '/api/pmachine/scheduler'
      || route === '/api/pmachine/scheduler/load'
      || route === '/api/pmachine/scheduler/unload') {
      let operation;
      if (req.method === 'GET' && route === '/api/pmachine/scheduler') {
        operation = 'status';
      } else if (req.method === 'POST' && route === '/api/pmachine/scheduler/load') {
        operation = 'load';
      } else if (req.method === 'POST' && route === '/api/pmachine/scheduler/unload') {
        operation = 'unload';
      } else {
        return send(res, 405, { version: 1, error: 'Use GET scheduler status or POST load/unload' });
      }
      let request = rawBody;
      if (operation === 'status') request = '{}';
      if (!request || !String(req.headers['content-type'] || '').includes('application/json')) {
        const body = Object.fromEntries(params);
        if (typeof body.slot === 'string' && /^[0-9]+$/.test(body.slot)) body.slot = Number(body.slot);
        request = JSON.stringify(body);
      }
      const result = await dispatchSlotScheduler(operation, request);
      return send(res, result.status, result.body);
    }

    if (route === '/status' && req.method === 'GET') {
      const schedulerStatus = scheduler?.getStatus() || null;
      const heap = v8.getHeapStatistics();
      return send(res, 200, {
        nodeName: name,
        runtime: 'js-pmachine',
        role: 'pmachine',
        resourceCapacity: {
          status: schedulerStatus ? 'online' : 'degraded',
          estimatedFreeSlots: schedulerStatus
            ? Math.min(schedulerStatus.available, schedulerStatus.maxContexts - schedulerStatus.contexts.length)
            : 0,
          freeMemoryBytes: Math.max(0, Math.min(
            1024 * 1024 * 1024, os.freemem(), heap.heap_size_limit - heap.used_heap_size,
          )),
        },
        serviceCapabilities: Object.fromEntries(Object.keys(inventoryGrants).map(id => [id, ['inventory.transaction']])),
        services: serviceRegistrations().map(service => service.serviceId),
        port: server.address()?.port ?? port,
        uptimeMs: Date.now() - startedAt,
        files: uploadedFiles.size || files.size,
        ...stats
      });
    }

    if (route === '/ffs/upload' && req.method === 'POST') {
      const file = String(params.get('file') || '');
      try {
        await writeFfsFile(file, String(params.get('body') ?? ''));
      } catch (error) {
        return send(res, error.status || 500, error.message);
      }
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
          ? hostedService
          : additionalHostedServices.get(collectorId)
            || [...managedHosts.values()].find(host => host.getStatus().collectorId === collectorId);
        if (!selected) return send(res, 404, { error: `Hosted collector not found: ${collectorId}` });
        return send(res, 200, selected.getStatus());
      }
      return send(res, 200, hostedService?.getStatus() || {
        running: false, hostBindingsVersion: 1, runtime: 'pascalish-hosted',
      });
    }
    if (route === '/pmachine/service_host/stop' && req.method === 'POST') {
      const collectorId = params.get('collectorId');
      if (collectorId && [...managedHosts.values()].some(host =>
        host.getStatus().collectorId === collectorId)) {
        return send(res, 403, { error: 'Scheduler-managed services must be unloaded through the slot scheduler' });
      }
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
      if (req.method === 'POST') return send(res, 200, await createDebugSession(params));
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

    const request = {
      transport: 'http',
      method: req.method,
      path: route,
      body: rawBody,
      peer: req.socket.remoteAddress?.replace('::ffff:', '') || '',
      query: Object.fromEntries(url.searchParams),
    };
    const dispatchHosts = [hostedService, ...additionalHostedServices.values(), ...managedHosts.values()];
    for (const host of dispatchHosts) {
      if (!host?.getStatus().running) continue;
      const result = await host.dispatch(request);
      if (result.status !== 404) {
        return send(res, result.status, JSON.stringify(result.body), 'application/json');
      }
    }
    return send(res, 404, 'Not found');
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (!res.headersSent) send(res, error?.status || 500, error?.message || String(error));
    });
  });
  let schedulerRecoveryError = null;
  const schedulerBootstrap = (async () => {
    await durableFfsReady;
    const restored = await slotAdapter.runtime.dispatch('restore');
    if (restored.status !== 200) {
      throw Object.assign(new Error(restored.body?.error || 'Scheduler recovery failed'), { status: restored.status });
    }
  })().catch(error => {
    schedulerRecoveryError = error;
    logger.error(`[js-pmachine] slot scheduler recovery failed: ${error.message}`);
  });
  async function dispatchSlotScheduler(operation, request = '{}') {
    await schedulerBootstrap;
    if (schedulerRecoveryError) {
      return {
        status: 503,
        body: { version: 1, error: `Scheduler recovery failed: ${schedulerRecoveryError.message}` }
      };
    }
    try {
      return await slotAdapter.runtime.dispatch(operation, request);
    } catch (error) {
      return {
        status: error.status || (operation === 'status' ? 503 : 400),
        body: { version: 1, error: error.message || String(error) }
      };
    }
  }
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
    for (const [slot, managed] of managedHosts) {
      managedHosts.delete(slot);
      managed.stop().catch(error => logger.error(`[js-pmachine] scheduler slot ${slot} shutdown failed: ${error.message}`));
    }
  });
  if (!backendUrl && udpAnnouncePort && !udpAnnounceHost) {
    let discovery;
    let timer;
    let stopped = false;
    let starting;
    server.on('listening', () => {
      starting = (async () => {
        const listeners = () => {
          const address = server.address();
          if (!address || typeof address !== 'object') throw new Error('Node HTTP listener is not bound');
          return [{ protocol: 'http', host: address.address, port: address.port }];
        };
        discovery = await discoveryFactory({
          nodeId: name, bootId: randomUUID(), port: udpAnnouncePort, logger,
          metadata: {
            hardware: 'PMachine JavaScript VM', runtime: 'js-pmachine',
            services: [{ name: 'pmachine', endpoint: '/pmachine/execute_file' }],
          },
          onTargets: async () => {
            if (!stopped) await discovery.advertise(listeners());
          },
        });
        if (stopped) { await discovery.stop(); return; }
        await discovery.start();
        if (stopped) { await discovery.stop(); return; }
        timer = setInterval(() => {
          if (!stopped) void discovery.advertise(listeners()).catch(error =>
            logger.warn(`[js-pmachine] Discovery announcement failed: ${error.message}`));
        }, discovery.getSettings().announcementIntervalMs);
        timer.unref();
      })().catch(error => logger.error(`[js-pmachine] Discovery startup failed: ${error.message}`));
    });
    server.on('close', () => {
      stopped = true;
      clearInterval(timer);
      void Promise.resolve(starting).then(() => discovery?.stop()).catch(error =>
        logger.error(`[js-pmachine] Discovery shutdown failed: ${error.message}`));
    });
  } else if (backendUrl || udpAnnouncePort) {
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
      udpSocket.send(Buffer.from(JSON.stringify(announcement())), udpAnnouncePort, udpAnnounceHost || '127.255.255.255', error => {
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
  let scheduler = null;
  const slotsText = process.env.JS_PMACHINE_SCHEDULER_SLOTS;
  if (slotsText !== undefined && slotsText !== '') {
    if (!/^[0-9]+$/.test(slotsText) || Number(slotsText) < 1 || Number(slotsText) > 64)
      throw new Error('JS_PMACHINE_SCHEDULER_SLOTS must be an integer from 1 to 64');
    scheduler = new PMachineScheduler({ slots: Number(slotsText) });
  }
  const server = createJsPmachineNodeServer({ ...args, scheduler });
  server.listen(args.port, args.host, () => {
    console.log(`[js-pmachine] ${args.name} listening on http://${args.host}:${server.address().port}`);
  });
}
