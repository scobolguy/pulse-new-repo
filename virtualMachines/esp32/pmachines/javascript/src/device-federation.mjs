import http from 'node:http';
import net from 'node:net';
import { performance } from 'node:perf_hooks';

const monotonic = () => Math.floor(performance.now());
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const boundedText = (value, max) => typeof value === 'string' && Buffer.byteLength(value) <= max && value.trim().length > 0;
const fail = message => { throw new Error(message); };
const compare = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export function isPreExecutionBusy(status, text) {
  if (status !== 503) return false;
  if (/^Service host(?: ingress)? busy$/.test(text)) return true;
  let body;
  try { body = JSON.parse(text); } catch { return false; }
  return body?.busy === true && (body.preExecution === true ||
    (body.hostBindingsVersion === 1 && body.executionModel === 'single-worker' &&
      Object.keys(body).every(key => ['busy', 'hostBindingsVersion', 'executionModel'].includes(key))));
}

// Configured trusted LAN pull only. No redirects, remote cache writes, or discovered endpoints.
export function boundedGet(url, { signal, timeoutMs = 5000, maxBytes = 2048 } = {}) {
  const target = new URL(url);
  if (target.protocol !== 'http:' || target.username || target.password) fail('Expected credential-free configured HTTP endpoint');
  return new Promise((resolve, reject) => {
    const request = http.get(target, { agent: false, signal }, response => {
      const chunks = [];
      let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > maxBytes) { response.destroy(new Error('Source response byte limit exceeded')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('Source request timeout')));
    request.on('error', reject);
  });
}

export function createDeviceFederation({
  sources, clock: suppliedClock = monotonic, get = boundedGet, logger = console,
  sourceTimeoutMs = 30000, maxSyncAgeMs = 120000, wait = pause, random = Math.random,
  maxSources = 6, maxDevices = 150, maxEvidenceBytes = 524288, resolveName = null
}) {
  let lastTime = -1;
  function clock() {
    const time = suppliedClock();
    if (!integer(time, 0, Number.MAX_SAFE_INTEGER) || time < lastTime) fail('Invalid central monotonic clock');
    lastTime = time;
    return time;
  }
  if (!integer(maxSources, 1, 6) || !integer(maxDevices, 1, 150) ||
      !integer(maxEvidenceBytes, 2048, 524288) || !integer(sourceTimeoutMs, 1, 120000) ||
      !integer(maxSyncAgeMs, 1, 3600000) || !Array.isArray(sources) ||
      sources.length < 1 || sources.length > maxSources ||
      sources.some(source => !source || typeof source !== 'object') ||
      new Set(sources.map(source => source.collectorId)).size !== sources.length) fail('Invalid bounded source membership or limits');
  const states = sources.map(source => {
    if (!['kasa', 'tuya', 'ssdp', 'pulse'].includes(source.protocol) ||
        typeof source.collectorId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,64}$/.test(source.collectorId)) fail('Invalid source identity');
    const origin = new URL(source.origin);
    if (origin.protocol !== 'http:' || origin.username || origin.password ||
        !net.isIP(origin.hostname) || !(origin.hostname.startsWith('127.') || origin.hostname.startsWith('10.') ||
        origin.hostname.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(origin.hostname))) fail('Source must be a configured private IPv4 HTTP origin');
    if (origin.pathname !== '/' || origin.search || origin.hash) fail('Configure an origin, not a source path');
    return { config: { ...source, origin: origin.origin }, entries: new Map(), observations: new Map(),
      synchronization: 'unavailable', collection: 'unknown', error: 'Not synchronized', lastSync: null, bootId: null,
      retiredBootIds: [] };
  });
  if (new Set(states.map(state => state.config.origin)).size !== states.length) fail('One endpoint cannot supply extra collector votes');
  let refreshing = null;
  let revision = 0, materializedSignature = '';
  function expire() {
    const time = clock();
    for (const state of states) for (const [key, entry] of state.entries) if (entry.deadline <= time) state.entries.delete(key);
    return time;
  }
  function metadata() {
    const time = expire();
    const sources = states.map(state => {
      const current = state.synchronization === 'ok' && state.collection === 'ok' &&
        state.lastSync !== null && time - state.lastSync <= maxSyncAgeMs;
      return { collectorId: state.config.collectorId, protocol: state.config.protocol, current,
        synchronization: state.synchronization, collection: state.collection, error: state.error,
        lastSync: state.lastSync, asOf: state.sampledAtMs ?? null, ageMs: state.lastSync === null ? null : time - state.lastSync,
        bootId: state.bootId, sequence: state.sequence ?? null, total: state.entries.size };
    });
    return { total: new Set(states.flatMap(state => [...state.entries.keys()])).size,
      evidenceCount: sources.reduce((sum, source) => sum + source.total, 0),
      current: sources.filter(source => source.current).reduce((sum, source) => sum + source.total, 0),
      limits: { maxSources, maxDevices, entriesPerSource: 50, maxEvidenceBytes, pagesPerSnapshot: 25, sourceTimeoutMs },
      completeness: sources.every(source => source.current), sources };
  }
  async function read(state, path, signal, maxBytes = 2048) {
    for (let attempt = 0; attempt <= 3; attempt++) {
      signal.throwIfAborted();
      const started = clock();
      const response = await get(new URL(path, state.config.origin), { signal, maxBytes, timeoutMs: 5000 });
      signal.throwIfAborted();
      const busy = isPreExecutionBusy(response.status, response.text);
      if (busy && attempt < 3) { await wait(250 + Math.floor(random() * 751)); continue; }
      if (response.status !== 200) fail(`Source HTTP ${response.status}: ${response.text.slice(0, 160)}`);
      if (Buffer.byteLength(response.text) > maxBytes) fail('Source response byte limit exceeded');
      let body;
      try { body = JSON.parse(response.text); } catch { fail('Source returned invalid JSON'); }
      return { body, started };
    }
  }
  async function health(state, signal) {
    const { body: response } = await read(state, `/pmachine/service_host/status?collectorId=${encodeURIComponent(state.config.collectorId)}`, signal, 4096);
    const daemonId = state.config.protocol === 'pulse' ? 'pulse-node-collector' : `${state.config.protocol}-collector`;
    const daemons = Array.isArray(response.daemons) ? response.daemons : (state.config.protocol === 'pulse'
      ? response.daemonDiagnostics?.map(({ id, failures, lastError }) => ({ id, failures, lastError }))
      : null);
    if (response.collectorId !== state.config.collectorId || response.running !== true || !boundedText(response.bootId, 128) ||
        !Array.isArray(daemons) || daemons.length !== 1 || daemons[0].id !== daemonId ||
        !integer(daemons[0].failures, 0, Number.MAX_SAFE_INTEGER) ||
        typeof daemons[0].lastError !== 'string') fail('Invalid collector health identity/schema');
    return { ...response, daemons };
  }
  function validateRecord(state, record, page) {
    const device = record?.device;
    if (!record || Object.keys(record).sort().join(',') !== 'device,key,observationMs,observationSequence,remainingTTLms' ||
        !device || Object.keys(device).sort().join(',') !== 'address,deviceType,name,protocol' ||
        device.protocol !== state.config.protocol || !boundedText(device.name, 256) ||
        !boundedText(device.deviceType, 64) || net.isIP(device.address) !== 4 ||
        !boundedText(record.key, 256) || !integer(record.observationMs, 0, page.sampledAtMs) ||
        !integer(record.observationSequence, 1, Number.MAX_SAFE_INTEGER) ||
        !integer(record.remainingTTLms, 1, 180000) ||
        page.sampledAtMs - record.observationMs + record.remainingTTLms > 180000) fail('Invalid typed device/observation schema');
    const keyPattern = device.protocol === 'pulse' ? /^[^\s]{1,256}$/ :
      device.protocol === 'kasa' ? /^kasa:(\d{1,3}\.){3}\d{1,3}$/ :
      device.protocol === 'tuya' ? /^tuya:[a-zA-Z0-9_-]{6,64}$/ :
        /^ssdp:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|mediaroom:(\d{1,3}\.){3}\d{1,3})$/;
    if (!keyPattern.test(record.key) || (device.protocol === 'kasa' && record.key !== `kasa:${device.address}`) ||
        (record.key.startsWith('ssdp:mediaroom:') && record.key !== `ssdp:mediaroom:${device.address}`)) fail('Invalid device key namespace');
  }
  async function synchronize(state) {
    expire();
    const signal = AbortSignal.timeout(sourceTimeoutMs);
    try {
      const before = await health(state, signal);
      if (state.retiredBootIds.includes(before.bootId)) fail('Retired collector boot replay');
      let completed;
      for (let restart = 0; restart < 3 && !completed; restart++) {
        let cursor = '', first, firstStarted, previous = '', entries = new Map();
        try {
          for (let index = 0; index < 25; index++) {
            const query = new URLSearchParams({ cursor, revision: first?.revision ?? '' });
            const { body: page, started } = await read(state, `/api/devices/snapshot?${query}`, signal);
            if (page.version !== 1 || page.collectorId !== state.config.collectorId || page.bootId !== before.bootId ||
                !/^(0|[1-9][0-9]{0,15})$/.test(page.revision) || String(page.sequence) !== page.revision ||
                !integer(page.sequence, 0, Number.MAX_SAFE_INTEGER) || !integer(page.sampledAtMs, 0, Number.MAX_SAFE_INTEGER) ||
                !integer(page.total, 0, 50) || !Array.isArray(page.records) || page.records.length > 2 ||
                typeof page.nextCursor !== 'string' || Buffer.byteLength(page.nextCursor) > 256) fail('Invalid snapshot envelope');
            if (first && (page.revision !== first.revision || page.sequence !== first.sequence ||
                page.total !== first.total || page.sampledAtMs < first.sampledAtMs)) fail('Snapshot changed during pagination');
            if (!first) { first = page; firstStarted = started; }
            for (const record of page.records) {
              validateRecord(state, record, page);
              if (compare(record.key, previous) <= 0 || entries.has(record.key)) fail('Duplicate or out-of-order snapshot key');
              previous = record.key;
              let deadline = firstStarted + record.remainingTTLms;
              const old = state.observations.get(record.key);
              if (state.bootId === page.bootId && old?.observationSequence === record.observationSequence &&
                  ['name', 'protocol', 'address', 'deviceType'].some(field => old.device[field] !== record.device[field])) fail('Observation changed without a new sequence');
              // Retries/repeated snapshots of the same observation can only shorten its lifetime.
              if (old?.observationSequence === record.observationSequence &&
                  ['name', 'protocol', 'address', 'deviceType'].every(field => old.device[field] === record.device[field])) deadline = Math.min(deadline, old.deadline);
              if (state.bootId === page.bootId && old && record.observationSequence < old.observationSequence) fail('Stale observation sequence');
              entries.set(record.key, { ...record, deadline });
              if (entries.size > 50) fail('Source capacity exceeded');
            }
            if (page.nextCursor && (page.records.length !== 2 || page.nextCursor !== previous || compare(page.nextCursor, cursor) <= 0 ||
                entries.size >= page.total)) fail('Invalid pagination cursor');
            if (!page.nextCursor) {
              if (entries.size !== page.total) fail('Incomplete authoritative snapshot');
              completed = { entries, first };
              break;
            }
            cursor = page.nextCursor;
          }
          if (!completed) fail('Snapshot page limit exceeded');
        } catch (error) {
          if (!/revision changed|changed during pagination|Incomplete authoritative/.test(error.message) || restart === 2) throw error;
        }
      }
      const after = await health(state, signal);
      if (after.bootId !== before.bootId) fail('Collector restarted during synchronization');
      if (state.bootId === completed.first.bootId && state.sequence !== undefined &&
          completed.first.sequence < state.sequence) fail('Stale source revision');
      const candidateStates = states.map(candidate => candidate === state ? completed.entries : candidate.entries);
      const bytes = candidateStates.reduce((sum, entries) => sum + [...entries].reduce((total, [key, entry]) =>
        total + Buffer.byteLength(key) + Buffer.byteLength(JSON.stringify(entry)), 0), 0) +
        states.reduce((sum, candidate) => sum + Buffer.byteLength(JSON.stringify([...(
          candidate === state ? completed.entries : candidate.observations)].map(([key, entry]) =>
          [key, { device: entry.device, observationSequence: entry.observationSequence, deadline: entry.deadline }]))), 0);
      if (bytes > maxEvidenceBytes) fail('Evidence storage byte limit exceeded');
      if (new Set(candidateStates.flatMap(entries => [...entries.keys()])).size > maxDevices) fail('Combined device capacity exceeded');
      const error = after.daemons[0].lastError.slice(0, 160);
      if (state.bootId && state.bootId !== completed.first.bootId) {
        state.retiredBootIds.push(state.bootId);
        if (state.retiredBootIds.length > 8) state.retiredBootIds.shift();
      }
      Object.assign(state, { entries: completed.entries, synchronization: 'ok', collection: error ? 'failed' : 'ok',
        observations: new Map([...completed.entries].map(([key, entry]) => [key, {
          device: entry.device, observationSequence: entry.observationSequence, deadline: entry.deadline
        }])),
        error, lastSync: clock(), bootId: completed.first.bootId, sequence: completed.first.sequence,
        sampledAtMs: completed.first.sampledAtMs });
      if (error) logger.warn(`[DEVICE-FEDERATION] ${state.config.collectorId} collection failed: ${error}`);
    } catch (error) {
      state.synchronization = 'unavailable';
      state.error = error.message.slice(0, 200);
      logger.warn(`[DEVICE-FEDERATION] ${state.config.collectorId} synchronization failed: ${state.error}`);
    }
    expire();
  }
  function refresh() {
    if (!refreshing) refreshing = (async () => {
      // Sequential pulls avoid ESP32 TCP connection bursts and keep retry queues at one.
      for (const state of states) await synchronize(state);
      return metadata();
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  function page({ cursor = '', namesOnly = false, fence = '' } = {}) {
    const meta = metadata();
    if (typeof cursor !== 'string' || Buffer.byteLength(cursor) > 256 ||
        typeof fence !== 'string' || !/^(|[0-9]{1,16})$/.test(fence) || (cursor && !fence)) fail('Invalid aggregation cursor/revision');
    const groups = new Map();
    for (const state of states) for (const [key, entry] of state.entries) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ collectorId: state.config.collectorId, bootId: state.bootId,
        device: entry.device, remainingTTLms: entry.deadline - clock(),
        observationSequence: entry.observationSequence, observationMs: entry.observationMs,
        sourceAvailable: meta.sources.find(source => source.collectorId === state.config.collectorId).current,
        deadline: entry.deadline });
    }
    const records = [...groups].map(([key, evidence]) => {
      evidence.sort((a, b) => compare(a.collectorId, b.collectorId));
      const meaningful = device => JSON.stringify([device.name, device.address, device.protocol, device.deviceType]);
      const consistent = new Set(evidence.map(report => meaningful(report.device))).size === 1;
      const naming = resolveName?.(key, evidence[0].device);
      return { key, device: naming?.status === 'resolved' ? { ...evidence[0].device, name: naming.name } : evidence[0].device,
        ...(naming ? { naming } : {}),
        confidence: !consistent ? 'CONFLICTING' : evidence.length >= 2 ? 'CORROBORATED' : 'PROVISIONAL',
        conflict: !consistent, evidence };
    }).sort((a, b) => compare(a.key, b.key));
    const signature = JSON.stringify(records.map(record => [record.key, record.confidence, record.device,
      record.naming && [record.naming.status, record.naming.location, record.naming.error],
      record.evidence.map(entry => [entry.collectorId, entry.bootId, entry.device, entry.deadline, entry.sourceAvailable])]));
    if (signature !== materializedSignature) { revision++; materializedSignature = signature; }
    if (fence && fence !== String(revision)) fail('Aggregation revision changed; restart pagination');
    if (cursor && !records.some(record => record.key === cursor)) fail('Aggregation cursor expired; restart pagination');
    const remaining = records.filter(record => !cursor || compare(record.key, cursor) > 0);
    const selected = remaining.slice(0, namesOnly ? 10 : 2).map(record => ({
      ...record, evidence: record.evidence.map(({ deadline, ...entry }) => entry)
    }));
    return { ...meta, total: records.length, revision: String(revision),
      ...(namesOnly ? { names: selected.map(record => record.device.name),
        devices: selected.map(({ evidence, ...record }) => ({ ...record, collectors: evidence.map(entry => entry.collectorId) })) } : { records: selected }),
      nextCursor: remaining.length > selected.length ? selected.at(-1).key : '' };
  }
  return { refresh, metadata, page };
}

export async function serveDeviceFederation(federation, { host = '127.0.0.1', port = 4310, intervalMs = 60000 } = {}) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (request.method !== 'GET') { response.writeHead(405).end(); return; }
      let body;
      if (url.pathname === '/api/devices/refresh') body = await federation.refresh();
      else if (url.pathname === '/api/devices/source-health' || url.pathname === '/health') body = federation.metadata();
      else if (url.pathname === '/api/devices/names' || url.pathname === '/api/devices') body = federation.page({
        cursor: url.searchParams.get('cursor') ?? '', namesOnly: url.pathname.endsWith('/names'), fence: url.searchParams.get('revision') ?? ''
      });
      else { response.writeHead(404).end(); return; }
      const json = JSON.stringify(body);
      if (Buffer.byteLength(json) > 49152) fail('Aggregation response byte limit exceeded');
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(json);
    } catch (error) { response.writeHead(503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ completeness: false, error: error.message })); }
  });
  server.maxConnections = 8;
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  const timer = setInterval(() => federation.refresh().catch(error => console.error(error)), intervalMs);
  return { server, stop: async () => { clearInterval(timer); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
