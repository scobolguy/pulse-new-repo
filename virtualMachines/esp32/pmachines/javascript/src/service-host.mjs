import http from 'node:http';
import dgram from 'node:dgram';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { executeProgram, parsePcode, parseProgramMapMappings } from './runtime.mjs';
import { loadOpcodeMap } from './opcodes.mjs';
import { SERVICE_HOST_BINDINGS_VERSION } from '../../shared/contracts/service-host-bindings.mjs';

function failure(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw failure(`Invalid ${label}`);
  return value;
}

function text(value, label, max = 256) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw failure(`Invalid ${label}`);
  return value;
}

function objectJson(value) {
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw failure('Invalid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw failure('Expected a JSON object');
  return parsed;
}

export async function createPascalishServiceHost({
  compiled, daemons = [], collectorId, bindings = {}, host = '127.0.0.1', httpPort = 4300, udpPort = 4210,
  maxEntries = 255, maxTables = 4, maxEvents = 16, maxBodyBytes = 4096,
  maxStorageBytes = 131072, maxResponseBytes = 262144, maxSteps = 10000, maxExecutionMs = 2000,
  maxTimers = 8, clock = () => Math.floor(performance.now()), logger = console
}) {
  if (compiled?.programMap?.hostBindingsVersion !== SERVICE_HOST_BINDINGS_VERSION
    || compiled.programMap.runtimeUnit?.kind !== 'service') throw failure('Unsupported service host contract');
  text(collectorId, 'collectorId');
  if (httpPort !== null) integer(httpPort, 0, 65535, 'HTTP port');
  integer(udpPort, 0, 65535, 'UDP port');
  for (const [name, value] of Object.entries({ maxEntries, maxTables, maxEvents, maxBodyBytes, maxTimers, maxStorageBytes, maxResponseBytes, maxExecutionMs })) {
    integer(value, 1, 1000000, name);
  }
  integer(maxSteps, 1, 200000, 'maxSteps');
  const instructions = parsePcode(compiled.pcodeText);
  const mappingsById = parseProgramMapMappings(compiled.programMap);
  const opcodeMap = await loadOpcodeMap();
  const units = new Map();
  for (const daemon of daemons) {
    const map = daemon?.programMap;
    if (map?.hostBindingsVersion !== SERVICE_HOST_BINDINGS_VERSION || map.runtimeUnit?.kind !== 'daemon') throw failure('Expected a hosted daemon');
    const id = text(map.runtimeUnit.id, 'daemon ID');
    const interval = integer(map.runtimeUnit.refreshMs, 10, 180000, 'daemon interval');
    if (units.has(id) || units.size >= maxTimers) throw failure('Duplicate daemon or daemon capacity exceeded');
    units.set(id, { instructions: parsePcode(daemon.pcodeText), mappingsById: parseProgramMapMappings(map), interval });
  }
  const bootId = randomUUID();
  const tables = new Map();
  const declaredHostTables = compiled.programMap.hostTables;
  if (declaredHostTables !== undefined && !Array.isArray(declaredHostTables)) {
    throw failure('Invalid hosted table declarations');
  }
  const hasTableDeclarations = Array.isArray(declaredHostTables) && declaredHostTables.length > 0;
  const tableDefinitions = new Map();
  if (hasTableDeclarations) {
    if (declaredHostTables.length > maxTables) throw failure('Declared table capacity exceeded');
    for (const definition of declaredHostTables) {
      const name = text(definition?.name, 'table name').toLowerCase();
      const capacity = integer(definition?.capacity, 1, 255, `capacity for table ${name}`);
      if (tableDefinitions.has(name)) throw failure(`Duplicate hosted table: ${name}`);
      tableDefinitions.set(name, { capacity });
    }
  }
  const timers = new Map();
  const requests = new Set();
  const executionAbort = new AbortController();
  let sequence = 0;
  let pending = 0;
  let tail = Promise.resolve();
  let running = false;
  let closed = false;
  let starting;
  let stopping;
  let server;
  let socket;
  let udpBound = false;
  let lastClock = -1;
  let storageBytes = 0;
  function now() {
    const value = integer(clock(), 0, Number.MAX_SAFE_INTEGER, 'monotonic clock');
    if (value < lastClock) throw failure('Monotonic clock moved backwards', 500);
    lastClock = value;
    return value;
  }
  function table(name) {
    const key = text(name, 'table name').toLowerCase();
    if (hasTableDeclarations && !tableDefinitions.has(key)) throw failure(`Undeclared table: ${key}`);
    if (!tables.has(key)) {
      if (tables.size >= maxTables) throw failure('Table capacity exceeded', 503);
      tables.set(key, new Map());
    }
    return tables.get(key);
  }
  function expire(entries) {
    const timestamp = now();
    let count = 0;
    for (const [key, entry] of entries) {
      if (entry.deadline <= timestamp) { entries.delete(key); storageBytes -= entry.bytes; count += 1; }
    }
    return count;
  }
  function boundedBody(body) {
    if (typeof body !== 'string' || Buffer.byteLength(body) > maxBodyBytes) throw failure('Event body too large', 413);
    return body;
  }
  function dispatch(event, unit = null) {
    if (!running || closed) return Promise.reject(failure('Service is stopped', 503));
    if (pending >= maxEvents) return Promise.reject(failure('Service event queue full', 503));
    try {
      boundedBody(event.body ?? '');
      event = { ...event, observedAt: now() };
      text(event.method, 'event method');
      text(event.path, 'event path');
    } catch (error) { return Promise.reject(error); }
    pending += 1;
    const work = tail.then(async () => {
      if (closed) throw failure('Service is stopped', 503);
      let status = 200;
      const handlers = {
        'host.clock': () => now(),
        'host.event_body': () => event.body ?? '',
        'host.event_peer': () => event.peer || '',
        'host.event_port': () => event.port || 0,
        'host.event_method': () => event.method,
        'host.event_path': () => event.path,
        'host.event_query': (name) => {
          text(name, 'query parameter name');
          return event.query?.[name] ?? '';
        },
        'host.collector_id': () => collectorId,
        'host.boot_id': () => bootId,
        'host.next_sequence': () => integer(++sequence, 1, Number.MAX_SAFE_INTEGER, 'sequence'),
        'host.json_text': (json, key) => {
          const value = objectJson(json)[text(key, 'JSON key')];
          if (typeof value !== 'string') throw failure(`Expected string field: ${key}`);
          return value;
        },
        'host.json_set': (json, key, value) => JSON.stringify({ ...objectJson(json), [text(key, 'JSON key')]: value }),
        'host.json_embed': (json, key, value) => {
          let parsed;
          try { parsed = JSON.parse(value); } catch { throw failure('Invalid embedded JSON'); }
          return JSON.stringify({ ...objectJson(json), [text(key, 'JSON key')]: parsed });
        },
        'host.json_merge': (previous, next) => JSON.stringify({ ...objectJson(previous), ...objectJson(next) }),
        'host.table_get': (name, key) => {
          text(key, 'table key');
          const entry = table(name).get(key);
          return JSON.stringify(entry && entry.deadline > now() ? entry.value : {});
        },
        'host.table_put': (name, key, json, ttl) => {
          text(key, 'table key');
          boundedBody(json);
          const value = objectJson(json);
          integer(ttl, 1, 180000, 'observation TTL');
          const entries = table(name);
          expire(entries);
          const capacity = Math.min(tableDefinitions.get(String(name).toLowerCase())?.capacity || maxEntries, maxEntries);
          if (!entries.has(key) && entries.size >= capacity) throw failure('Table entry capacity exceeded', 503);
          const bytes = Buffer.byteLength(json) + Buffer.byteLength(key);
          const nextBytes = storageBytes - (entries.get(key)?.bytes || 0) + bytes;
          if (nextBytes > maxStorageBytes) throw failure('Table storage capacity exceeded', 503);
          const deadline = event.observedAt + ttl;
          if (deadline <= now()) throw failure('Announcement expired before execution', 503);
          entries.set(key, { value, deadline, bytes });
          storageBytes = nextBytes;
          return 0;
        },
        'host.table_expire': (name) => expire(table(name)),
        'host.table_snapshot': (name, cursor, limit) => {
          if (typeof cursor !== 'string' || cursor.length > 256) throw failure('Invalid table snapshot cursor');
          integer(limit, 1, 5, 'table snapshot limit');
          const timestamp = now();
          const entries = table(name);
          const keys = [...entries.keys()].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
          const nodes = [];
          let hasMore = false;
          let nextCursor = '';
          for (const key of keys) {
            if (cursor && Buffer.compare(Buffer.from(key), Buffer.from(cursor)) <= 0) continue;
            const entry = entries.get(key);
            if (entry.deadline <= timestamp) continue;
            if (nodes.length === limit) {
              hasMore = true;
              break;
            }
            nodes.push({ ...entry.value, remainingTtlMs: entry.deadline - timestamp });
            nextCursor = key;
          }
          return JSON.stringify({
            nodes,
            continuation: hasMore ? 'continue' : 'end',
            nextCursor: hasMore ? nextCursor : ''
          });
        },
        'host.http_status': (value) => { status = integer(value, 200, 599, 'HTTP status'); return 0; },
        'host.udp_reply': async (body) => {
          boundedBody(body);
          if (event.transport !== 'udp' || !socket) throw failure('UDP reply requires a UDP event');
          await new Promise((resolve, reject) => socket.send(body, event.port, event.peer, error => error ? reject(error) : resolve()));
          return 0;
        }
      };
      const invocationAbort = new AbortController();
      const signal = AbortSignal.any([executionAbort.signal, invocationAbort.signal]);
      let rejectCancelled;
      const cancelled = new Promise((resolve, reject) => { rejectCancelled = reject; });
      const onAbort = () => rejectCancelled(failure(signal.reason?.message || 'Service execution cancelled', 503));
      signal.addEventListener('abort', onAbort, { once: true });
      const timeout = setTimeout(() => invocationAbort.abort(new Error('Service execution timeout')), maxExecutionMs);
      let result;
      try {
        result = await Promise.race([cancelled, executeProgram({
        instructions: unit?.instructions || instructions, mappingsById: unit?.mappingsById || mappingsById,
        opcodeMap, inputQueue: '', sourceMessage: event.body ?? '',
        runtimeContext: {
          maxSteps, maxStack: 256, maxCallDepth: 32, cooperative: true, signal,
          callHost: async (name, args) => {
            signal.throwIfAborted();
            const handler = handlers[name] || bindings[name];
            if (typeof handler !== 'function') throw failure(`Host binding unavailable: ${name}`, 500);
            const value = await handler(...args, { signal });
            signal.throwIfAborted();
            if (typeof value === 'string' && Buffer.byteLength(value) > maxResponseBytes) throw failure('Host result capacity exceeded', 503);
            return value;
          } }
        })]);
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', onAbort);
      }
      if (result.stepLimitHit || result.error) throw failure(result.error || 'Service instruction limit exceeded', 500);
      if (Buffer.byteLength(JSON.stringify(result.response)) > maxResponseBytes) throw failure('Response capacity exceeded', 503);
      return { status, body: result.response };
    }).finally(() => { pending -= 1; });
    tail = work.catch(logError);
    return work;
  }
  function logError(error) { logger.warn(`[SERVICE] Event rejected: ${error.message}`); }
  function schedule(name, interval, event, unit = null) {
    if (!timers.has(name) && timers.size >= maxTimers) throw failure('Timer capacity exceeded', 503);
    clearInterval(timers.get(name));
    let busy = false;
    timers.set(name, setInterval(() => {
      if (busy || closed) return;
      busy = true;
      dispatch(event, unit).catch(logError).finally(() => { busy = false; });
    }, interval));
  }
  function stop() {
    if (stopping) return stopping;
    closed = true;
    running = false;
    executionAbort.abort();
    for (const timer of timers.values()) clearInterval(timer);
    timers.clear();
    for (const request of requests) request.destroy();
    stopping = finishStop();
    return stopping;
  }
  async function finishStop() {
    if (starting) {
      try { await starting; } catch (error) { logError(error); }
    }
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    await tail;
    if (socket) {
      await new Promise((resolve, reject) => {
        try { socket.close(resolve); } catch (error) {
          if (error.code === 'ERR_SOCKET_DGRAM_NOT_RUNNING') resolve();
          else reject(error);
        }
      });
    }
    tables.clear();
    storageBytes = 0;
    udpBound = false;
  }
  async function start() {
    if (closed) throw failure('A stopped service host cannot be restarted');
    if (starting) return starting;
    if (running) return;
    starting = startHost();
    try { await starting; } catch (error) { await stop(); throw error; }
  }
  async function startHost() {
    running = true;
    if (httpPort !== null) {
      server = http.createServer(async (req, res) => {
        requests.add(req);
        try {
          if (requests.size > maxEvents) throw failure('HTTP request capacity exceeded', 503);
          let size = 0;
          const chunks = [];
          for await (const chunk of req) {
            size += chunk.length;
            if (size > maxBodyBytes) throw failure('Event body too large', 413);
            chunks.push(chunk);
          }
          const requestUrl = new URL(req.url, 'http://localhost');
          const requestPath = requestUrl.pathname;
          if (requestPath.startsWith('/events/')) throw failure('Internal service event', 404);
          const query = Object.fromEntries(requestUrl.searchParams);
          const result = await dispatch({
            transport: 'http', method: req.method, path: requestPath,
            body: Buffer.concat(chunks).toString('utf8'), peer: req.socket.remoteAddress?.replace('::ffff:', '') || '',
            query
          });
          if (!res.destroyed) res.writeHead(result.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(result.body));
        } catch (error) {
          logError(error);
          if (!res.destroyed) res.writeHead(error.status || 500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error.message }));
        } finally { requests.delete(req); }
      });
      server.requestTimeout = 10000;
      server.headersTimeout = 10000;
      server.maxConnections = maxEvents;
    }
    socket = dgram.createSocket('udp4');
    socket.on('message', (data, peer) => {
      dispatch({ transport: 'udp', method: 'POST', path: '/events/udp', body: data.toString('utf8'), peer: peer.address, port: peer.port })
        .catch(error => {
          logError(error);
          if (!closed) socket.send(JSON.stringify({ kind: 'serviceError', error: error.message }), peer.port, peer.address,
            sendError => { if (sendError) logger.error(`[SERVICE] UDP error reply: ${sendError.message}`); });
        });
    });
    await new Promise((resolve, reject) => {
      socket.once('error', reject);
      socket.bind(udpPort, host, () => {
        socket.removeListener('error', reject);
        udpBound = true;
        resolve();
      });
    });
    if (closed) throw failure('Service stopped during startup', 503);
    socket.on('error', error => logger.error(`[SERVICE] UDP: ${error.message}`));
    for (const [id, unit] of units) {
      await dispatch({ method: 'POST', path: `/daemon/${id}`, body: '{}' }, unit);
      if (closed) throw failure('Service stopped during startup', 503);
      schedule(id, unit.interval, { method: 'POST', path: `/daemon/${id}`, body: '{}' }, unit);
    }
    if (server) {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        if (closed) { reject(failure('Service stopped during startup', 503)); return; }
        server.listen(httpPort, host, () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
      if (closed) throw failure('Service stopped during startup', 503);
      server.on('error', error => logger.error(`[SERVICE] HTTP: ${error.message}`));
    }
  }
  return {
    start, stop, dispatch,
    getStatus: () => ({ running, pending, timers: timers.size, daemons: units.size, storageBytes,
      entries: [...tables.values()].reduce((count, entries) => count + entries.size, 0), bootId, collectorId,
      httpPort: server?.listening ? server.address().port : null,
      udpPort: running && udpBound ? socket.address().port : null })
  };
}
