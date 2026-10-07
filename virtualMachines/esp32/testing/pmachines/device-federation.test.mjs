import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDeviceFederation, isPreExecutionBusy } from '../../pmachines/javascript/src/device-federation.mjs';
import { createHostCacheStore } from '../../pmachines/javascript/src/host-cache.mjs';

// Synthetic fixtures never bind a socket or enter a real collector cache.
const fields = ['name', 'protocol', 'address', 'deviceType'].map(name => ({ name, type: 'string' }));
const silent = { warn() {} };
function fixture(protocols = ['kasa', 'tuya', 'ssdp'], options = {}) {
  let time = 1000;
  const nodes = protocols.map((protocol, index) => ({
    protocol, collectorId: protocol === 'pulse' ? 'pulse-node-collector' : `collector-${index}`, origin: `http://127.0.0.1:${4400 + index}`,
    bootId: `boot-${index}`, unavailable: false,
    store: createHostCacheStore([{ name: 'devices', capacity: 50, fields }], { clock: () => time })
  }));
  const get = async (target, limits) => {
    const url = new URL(target);
    const node = nodes.find(item => item.origin === url.origin);
    if (node.unavailable) throw new Error('Source timeout');
    let body;
    if (url.pathname.includes('/status')) body = {
      collectorId: node.collectorId, bootId: node.bootId, running: true,
      daemons: [{ id: `${node.protocol}-collector`, failures: 0, lastError: '' }]
    };
    else body = { ...node.store.snapshot('devices', url.searchParams.get('cursor'), url.searchParams.get('revision')),
      collectorId: node.collectorId, bootId: node.bootId };
    if (node.mutate) body = node.mutate(body, url);
    if (node.latency) time += node.latency;
    const text = JSON.stringify(body);
    assert.ok(Buffer.byteLength(text) <= limits.maxBytes);
    return { status: 200, text };
  };
  const federation = createDeviceFederation({ sources: nodes.map(({ protocol, collectorId, origin }) =>
    ({ protocol, collectorId, origin })), clock: () => time, get, logger: silent,
    wait: async () => {}, ...options });
  const put = (index, number = 1, name = `Synthetic ${number}`, ttl = 180000) => {
    const node = nodes[index];
    const key = node.protocol === 'kasa' ? `kasa:192.168.2.${number}` :
      node.protocol === 'tuya' ? `tuya:synthetic${String(number).padStart(3, '0')}` :
        `ssdp:00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
    node.store.put('devices', key, JSON.stringify({ name, protocol: node.protocol,
      address: `192.168.2.${number}`, deviceType: 'synthetic-test-only' }), ttl);
    return key;
  };
  return { federation, nodes, put, advance: ms => { time += ms; } };
}
function walk(federation, namesOnly = false) {
  const records = [];
  let cursor = '', fence = '', pages = 0;
  do {
    const page = federation.page({ cursor, fence, namesOnly });
    records.push(...(namesOnly ? page.names : page.records));
    cursor = page.nextCursor;
    fence = page.revision;
    assert.ok(++pages <= (namesOnly ? 15 : 75));
  } while (cursor);
  return records;
}

test('description naming is display-only: raw full-snapshot evidence, sequence, expiry and votes stay unchanged', async () => {
  let resolved = false;
  const f = fixture(['ssdp'], { resolveName: () => resolved
    ? { status: 'resolved', name: 'Actual LAN name', provenance: 'UPnP description friendlyName', error: '' }
    : { status: 'fallback', provenance: 'UUID label', error: 'lookup pending' } });
  f.put(0, 1, 'SSDP fallback', 100);
  await f.federation.refresh();
  const original = f.federation.page(), evidence = original.records[0].evidence[0];
  resolved = true; f.advance(10);
  const named = f.federation.page().records[0];
  assert.equal(named.device.name, 'Actual LAN name');
  assert.equal(named.confidence, 'PROVISIONAL');
  assert.equal(named.evidence.length, 1);
  assert.equal(named.evidence[0].device.name, 'SSDP fallback');
  assert.equal(named.evidence[0].observationSequence, evidence.observationSequence);
  assert.equal(named.evidence[0].observationMs, evidence.observationMs);
  assert.equal(named.evidence[0].remainingTTLms, evidence.remainingTTLms - 10);
  assert.throws(() => f.federation.page({ fence: original.revision }), /revision changed/);
  await f.federation.refresh();
  assert.equal(f.federation.metadata().completeness, true);
  f.advance(90);
  assert.equal(f.federation.page().records.length, 0);
});

test('Pulse health uses daemon diagnostics when the status daemon field is a count', async () => {
  const f = fixture(['pulse']);
  f.nodes[0].mutate = (body, url) => url.pathname.includes('/status') ? {
    ...body, daemons: 1,
    daemonDiagnostics: [{ id: 'pulse-node-collector', failures: 0, lastError: '' }]
  } : body;
  await f.federation.refresh();
  const [source] = f.federation.metadata().sources;
  assert.equal(source.protocol, 'pulse');
  assert.equal(source.current, true, source.error);
  assert.equal(source.synchronization, 'ok');
  assert.equal(source.error, '');
});

test('three typed fifty-entry sources materialize every one of 150 devices across bounded pages', async () => {
  const f = fixture();
  for (let source = 0; source < 3; source++) for (let index = 1; index <= 50; index++) f.put(source, index);
  await f.federation.refresh();
  assert.equal(f.federation.metadata().completeness, true);
  assert.equal(walk(f.federation).length, 150);
  assert.equal(walk(f.federation, true).length, 150);
  assert.ok(walk(f.federation).every(record => record.confidence === 'PROVISIONAL'));
});

test('configured identities, not retry/process/boot identity, vote; meaningful disagreements conflict', async () => {
  const f = fixture(['kasa', 'kasa']);
  f.put(0); await f.federation.refresh();
  assert.equal(f.federation.page().records[0].confidence, 'PROVISIONAL');
  await f.federation.refresh();
  f.nodes[0].bootId = 'another-process';
  await f.federation.refresh();
  assert.equal(f.federation.page().records[0].evidence.length, 1);
  f.advance(10); f.put(1); await f.federation.refresh();
  let record = f.federation.page().records[0];
  assert.equal(record.confidence, 'CORROBORATED');
  assert.equal(record.evidence.length, 2);
  f.put(1, 1, 'Different meaningful name'); await f.federation.refresh();
  record = f.federation.page().records[0];
  assert.equal(record.confidence, 'CONFLICTING');
  assert.equal(record.conflict, true);
});

test('expiry demotes corroboration then removes records, and unavailable fresh evidence is explicit', async () => {
  const f = fixture(['kasa', 'kasa']);
  f.put(0, 1, 'Same', 100); f.put(1, 1, 'Same', 200);
  await f.federation.refresh();
  f.nodes[0].unavailable = true;
  await f.federation.refresh();
  let page = f.federation.page();
  assert.equal(page.completeness, false);
  assert.equal(page.records[0].confidence, 'CORROBORATED');
  assert.equal(page.records[0].evidence[0].sourceAvailable, false);
  assert.match(page.sources[0].error, /timeout/);
  f.advance(100);
  assert.equal(f.federation.page().records[0].confidence, 'PROVISIONAL');
  f.advance(100);
  assert.equal(f.federation.page().total, 0);
});

test('authoritative snapshots reconcile deletion/eviction/reboot without extra voters or TTL extension', async () => {
  const f = fixture(['kasa']);
  const key = f.put(0, 1, 'Same', 1000);
  await f.federation.refresh();
  f.advance(100);
  f.nodes[0].bootId = 'reboot';
  await f.federation.refresh();
  assert.equal(f.federation.page().records[0].evidence[0].remainingTTLms, 900);
  f.nodes[0].store.remove('devices', key);
  await f.federation.refresh();
  assert.equal(f.federation.page().total, 0);
  for (let index = 1; index <= 51; index++) f.put(0, index);
  await f.federation.refresh();
  assert.equal(f.federation.page().total, 50);
  assert.ok(!walk(f.federation).some(record => record.key === key));
});

test('malformed second page never partially replaces a source, expired retained data eventually disappears', async () => {
  const f = fixture(['kasa']);
  f.put(0, 1, 'Old', 1000); await f.federation.refresh();
  for (let index = 2; index <= 4; index++) f.put(0, index);
  f.nodes[0].mutate = (body, url) => {
    if (url.pathname.endsWith('/snapshot') && url.searchParams.get('cursor')) body.records[0].device.protocol = 'tuya';
    return body;
  };
  await f.federation.refresh();
  assert.equal(f.federation.page().total, 1);
  assert.equal(f.federation.metadata().completeness, false);
  f.advance(1000);
  assert.equal(f.federation.page().total, 0);
});

test('pagination fences prevent source and materialized mixed-revision reads with bounded retries', async () => {
  const f = fixture(['kasa']);
  for (let index = 1; index <= 3; index++) f.put(0, index);
  let calls = 0;
  f.nodes[0].mutate = (body, url) => {
    if (url.pathname.endsWith('/snapshot')) {
      calls++;
      if (url.searchParams.get('cursor')) body.revision = String(body.sequence = body.sequence + 1);
    }
    return body;
  };
  await f.federation.refresh();
  assert.equal(calls, 6);
  assert.equal(f.federation.page().total, 0);
  f.nodes[0].mutate = null; await f.federation.refresh();
  const first = f.federation.page();
  f.put(0, 4); await f.federation.refresh();
  assert.throws(() => f.federation.page({ cursor: first.nextCursor, fence: first.revision }), /revision changed/);
});

test('identity forgery, invalid namespaces, stale source ordering and limits reject atomically', async () => {
  for (const mutate of [
    body => ({ ...body, collectorId: 'forged' }),
    body => body.records ? { ...body, records: body.records.map(record => ({ ...record, key: 'tuya:forged' })) } : body,
    body => body.records ? { ...body, total: 51 } : body
  ]) {
    const f = fixture(['kasa']); f.put(0);
    f.nodes[0].mutate = mutate; await f.federation.refresh();
    assert.equal(f.federation.page().total, 0);
    assert.equal(f.federation.metadata().completeness, false);
  }
  const f = fixture(['kasa']); f.put(0); await f.federation.refresh();
  f.nodes[0].mutate = body => body.records ? { ...body, revision: '0', sequence: 0 } : body;
  await f.federation.refresh();
  assert.match(f.federation.metadata().sources[0].error, /Stale source revision/);
  assert.equal(f.federation.page().total, 1);
  assert.throws(() => fixture(['kasa'], { maxSources: 7 }), /limits/);
  assert.throws(() => createDeviceFederation({ sources: [
    { collectorId: 'a', protocol: 'kasa', origin: 'http://127.0.0.1:1' },
    { collectorId: 'b', protocol: 'kasa', origin: 'http://127.0.0.1:1' }
  ] }), /extra collector votes/);
  assert.throws(() => createDeviceFederation({ sources: [
    { collectorId: 'a', protocol: 'kasa', origin: 'http://127.0.0.1:1' },
    { collectorId: 'a', protocol: 'tuya', origin: 'http://127.0.0.1:2' }
  ] }), /membership/);
});

test('late pagination and transport latency only shorten observation lifetime', async () => {
  const f = fixture(['kasa']);
  for (let index = 1; index <= 4; index++) f.put(0, index, 'Same', 1000);
  f.nodes[0].latency = 100;
  await f.federation.refresh();
  const evidence = walk(f.federation).map(record => record.evidence[0]);
  assert.ok(evidence.every(entry => entry.remainingTTLms <= 700));
  f.advance(1000);
  assert.equal(f.federation.page().total, 0);
});

test('combined capacity and evidence byte limits fail replacement without destroying retained evidence', async () => {
  const f = fixture(['kasa', 'tuya'], { maxDevices: 1 });
  f.put(0); f.put(1); await f.federation.refresh();
  assert.equal(f.federation.page().total, 1);
  assert.match(f.federation.metadata().sources[1].error, /capacity/);
  const tiny = fixture(['kasa'], { maxEvidenceBytes: 2048 });
  for (let index = 1; index <= 10; index++) tiny.put(0, index);
  await tiny.federation.refresh();
  assert.equal(tiny.federation.page().total, 0);
  assert.match(tiny.federation.metadata().sources[0].error, /byte limit/);
});

test('real ESP32 preexecution busy is bounded to three jittered retries, not unavailable or transport failures', async () => {
  const busy = '{"busy":true,"hostBindingsVersion":1,"executionModel":"single-worker"}';
  assert.equal(isPreExecutionBusy(503, busy), true);
  assert.equal(isPreExecutionBusy(503, '{"busy":true,"error":"unavailable"}'), false);
  assert.equal(isPreExecutionBusy(503, 'Service host busy or unavailable'), false);
  assert.equal(isPreExecutionBusy(200, busy), false);
  for (const response of [{ status: 503, text: busy }, { status: 503, text: 'unavailable' }, null]) {
    let calls = 0;
    const waits = [];
    const f = fixture(['kasa'], { get: async () => {
      calls++;
      if (!response) throw new Error('Transport failure');
      return response;
    }, wait: async ms => waits.push(ms), random: () => 1 - Number.EPSILON });
    await f.federation.refresh();
    assert.equal(calls, response?.text === busy ? 4 : 1);
    assert.deepEqual(waits, response?.text === busy ? [1000, 1000, 1000] : []);
    assert.equal(f.federation.metadata().completeness, false);
  }
});

test('retired boots cannot replay and unchanged observations cannot silently rewrite meaningful data', async () => {
  const f = fixture(['kasa']); f.put(0); await f.federation.refresh();
  const originalBoot = f.nodes[0].bootId;
  f.nodes[0].bootId = 'new-boot'; await f.federation.refresh();
  f.nodes[0].bootId = originalBoot; await f.federation.refresh();
  assert.match(f.federation.metadata().sources[0].error, /Retired/);
  f.nodes[0].bootId = 'new-boot';
  f.nodes[0].mutate = body => body.records ? { ...body, records: body.records.map(record =>
    ({ ...record, device: { ...record.device, address: '192.168.2.200' }, key: 'kasa:192.168.2.200' })) } : body;
  // A new stable identity is not a cross-protocol or name-based deduplication.
  await f.federation.refresh();
  assert.equal(f.federation.page().records[0].key, 'kasa:192.168.2.200');
  f.nodes[0].mutate = body => body.records ? { ...body, records: body.records.map(record =>
    ({ ...record, key: 'kasa:192.168.2.200', device: { ...record.device, address: '192.168.2.200', name: 'Forged edit' } })) } : body;
  await f.federation.refresh();
  assert.match(f.federation.metadata().sources[0].error, /without a new sequence/);
});

test('expired evidence cannot be resurrected by replaying the same observation after a boot change', async () => {
  const f = fixture(['kasa']); f.put(0, 1, 'Same', 100);
  const captured = { ...f.nodes[0].store.snapshot('devices'), collectorId: 'collector-0', bootId: 'boot-0' };
  await f.federation.refresh();
  f.advance(100);
  assert.equal(f.federation.page().total, 0);
  f.nodes[0].bootId = 'reboot';
  f.nodes[0].mutate = (body, url) => url.pathname.endsWith('/snapshot') ?
    { ...captured, bootId: 'reboot' } : body;
  await f.federation.refresh();
  assert.equal(f.federation.page().total, 0);
});
