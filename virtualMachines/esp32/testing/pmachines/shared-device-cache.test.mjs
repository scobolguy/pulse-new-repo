import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import dgram from 'node:dgram';
import { createCipheriv, createHash } from 'node:crypto';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { createHostCacheStore } from '../../pmachines/javascript/src/host-cache.mjs';
import { createNetworkBindings } from '../../pmachines/javascript/src/network-bindings.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';

const read = name => fs.readFile(new URL(`../../src/${name}`, import.meta.url), 'utf8');
const compileUnit = text => compilePascalishProgramWithAntlr(text, { hostServices: true });
const service = compileUnit(await read('device-cache-service.pas'));
const kasaSource = await read('kasa-collector-daemon.pas');
const kasa = compileUnit(kasaSource);
const tuya = compileUnit(await read('tuya-collector-daemon.pas'));
const ssdp = compileUnit(await read('ssdp-collector-daemon.pas'));
// Test-only variant: loopback peers stand in for the two configured LAN devices and the refresh is shortened.
const kasaLoopback = compileUnit(kasaSource.replace('refresh 30000 ms', 'refresh 20 ms')
  .replace("'192.168.2.28'", "'127.0.0.2'").replace("'192.168.2.29'", "'127.0.0.3'"));
const kasaPeers = [{ ip: '127.0.0.2', port: 9999 }, { ip: '127.0.0.3', port: 9999 }];
const deviceType = 'type Device = record name: string; protocol: string; address: string; deviceType: string; end;';
const silent = { warn() {}, error() {} };
const ttl = { 'host.observation_ttl': () => 180000 };

function kasaCrypt(bytes, decrypt = false) {
  let key = 171;
  return Buffer.from([...bytes].map(byte => { const value = key ^ byte; key = decrypt ? byte : value; return value; }));
}
async function kasaPeer(t, address, reply) {
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let input = Buffer.alloc(0);
    socket.on('data', chunk => {
      input = Buffer.concat([input, chunk]);
      if (input.length < 4 || input.length < input.readUInt32BE(0) + 4) return;
      assert.deepEqual(JSON.parse(kasaCrypt(input.subarray(4), true)), { system: { get_sysinfo: {} } }, 'collector must stay read-only');
      const payload = kasaCrypt(Buffer.from(JSON.stringify(reply())));
      const header = Buffer.alloc(4);
      header.writeUInt32BE(payload.length);
      socket.end(Buffer.concat([header, payload]));
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(9999, address, resolve); });
  t.after(() => { for (const socket of sockets) socket.destroy(); return new Promise(resolve => server.close(resolve)); });
}

const tuyaKey = createHash('md5').update('yGAdlopoPVldABfn').digest();
const crc = createNetworkBindings()['host.bytes_crc32'];
function tuyaPacket(kind, id) {
  const json = Buffer.from(JSON.stringify({ gwId: id, ip: '192.168.2.99', version: '3.3' }));
  if (kind === 'ecb') {
    const cipher = createCipheriv('aes-128-ecb', tuyaKey, null);
    const encrypted = Buffer.concat([cipher.update(json), cipher.final()]);
    const header = Buffer.alloc(20);
    header.writeUInt32BE(0x55aa, 0); header.writeUInt32BE(19, 8); header.writeUInt32BE(encrypted.length + 12, 12);
    const frame = Buffer.concat([header, encrypted]);
    return Buffer.concat([frame, Buffer.from(crc(frame.toString('hex')), 'hex'), Buffer.from('0000aa55', 'hex')]);
  }
  const header = Buffer.alloc(18);
  header.writeUInt32BE(0x6699, 0); header.writeUInt32BE(19, 10); header.writeUInt32BE(json.length + 4 + 12 + 16, 14);
  const nonce = Buffer.from('012345678901');
  const cipher = createCipheriv('aes-128-gcm', tuyaKey, nonce);
  cipher.setAAD(header.subarray(4));
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([Buffer.alloc(4), json])), cipher.final()]);
  return Buffer.concat([header, nonce, encrypted, cipher.getAuthTag(), Buffer.from('00009966', 'hex')]);
}
async function sendUdp(t, port, bytes) {
  const socket = dgram.createSocket('udp4');
  t.after(() => new Promise(resolve => { try { socket.close(resolve); } catch { resolve(); } }));
  await new Promise((resolve, reject) => socket.send(bytes, port, '127.0.0.1', error => error ? reject(error) : resolve()));
}
const page = (host, cursor) => host.dispatch({ method: 'GET', path: '/api/devices/names', body: '', query: cursor ? { cursor } : {} });
// Client aggregation of the paged names endpoint: follow nextCursor until continuation is 'end'.
async function names(host) {
  const pages = [];
  let cursor = '';
  do {
    const result = await page(host, cursor);
    if (result.status !== 200) return { status: result.status, body: result.body, pages };
    pages.push(result.body);
    assert.ok(result.body.names.length <= 10, 'pages hold at most 10 names');
    assert.equal(result.body.continuation === 'end', result.body.nextCursor === '');
    cursor = result.body.nextCursor;
    assert.ok(pages.length <= 6, 'aggregation terminates');
  } while (cursor);
  return { status: 200, pages, body: { count: pages[0].count, names: pages.flatMap(entry => entry.names) } };
}
async function until(predicate, ms = 4000) {
  const end = Date.now() + ms;
  while (!(await predicate())) {
    if (Date.now() > end) throw new Error('Timed out waiting for condition');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('shared device units fit signed images and declare one identical typed cache', () => {
  for (const unit of [service, kasa, tuya, ssdp]) {
    assert.ok(Number.parseInt(encodeHostedImage(unit.pcodeText).slice(4, 12), 16) <= 512);
    assert.deepEqual(compactServiceHostProgramMap(unit.programMap).hostCaches, service.programMap.hostCaches);
  }
  assert.deepEqual(service.programMap.hostCaches, [{ name: 'devices', capacity: 50, fields: [
    { name: 'name', type: 'string' }, { name: 'protocol', type: 'string' },
    { name: 'address', type: 'string' }, { name: 'deviceType', type: 'string' }] }]);
  assert.deepEqual([kasa, tuya].map(unit => [unit.programMap.runtimeUnit.kind, unit.programMap.runtimeUnit.refreshMs]),
    [['daemon', 30000], ['daemon', 60000]]);
});

test('typed enumeration is bytewise ordered, pinned to reads and preserves eviction without read refresh', () => {
  let time = 1000;
  const store = createHostCacheStore([{ name: 'devices', capacity: 50, fields: [{ name: 'n', type: 'string' }] }], { clock: () => time });
  const key = index => `k${String(index).padStart(2, '0')}`;
  for (let index = 0; index < 50; index++) { store.put('devices', key(index), JSON.stringify({ n: key(index) }), 1000 + index); time += 1; }
  const walk = () => { const keys = []; let cursor = ''; while ((cursor = store.next('devices', cursor, time)) !== '') keys.push(cursor); return keys; };
  assert.equal(store.count('devices', time), 50);
  assert.deepEqual(walk(), Array.from({ length: 50 }, (_, index) => key(index)));
  for (let pass = 0; pass < 3; pass++) store.get('devices', key(0), time);
  store.put('devices', 'k50', JSON.stringify({ n: 'k50' }), 5000);
  assert.equal(store.count('devices', time), 50);
  assert.equal(walk().includes(key(0)), false, 'oldest observation is evicted even after reads');
  time = 2002;
  assert.equal(walk().includes(key(1)), false, 'expired entries are skipped by enumeration');
  assert.equal(store.count('devices', time), 49);
  assert.throws(() => store.next('devices', 'x'.repeat(257), time), /cursor/i);
});

test('service returns every one of 50 cached names at the capacity boundary across bounded pages', async t => {
  const filler = compileUnit(await fs.readFile(new URL('./fixtures/device-cache-filler-daemon.pas', import.meta.url), 'utf8'));
  assert.ok(Number.parseInt(encodeHostedImage(filler.pcodeText).slice(4, 12), 16) <= 512);
  const host = await createPascalishServiceHost({ compiled: service, daemons: [filler], collectorId: 'names-50',
    httpPort: null, udpPort: null, bindings: ttl, logger: silent });
  await host.start();
  t.after(() => host.stop());
  await until(() => host.getStatus().daemonDiagnostics[0].timerRuns >= 80);
  const result = await names(host);
  assert.equal(result.status, 200);
  assert.equal(result.body.count, 50);
  assert.equal(result.body.names.length, 50, 'all names, not a first page');
  assert.deepEqual(result.pages.map(entry => [entry.names.length, entry.continuation]),
    [[10, 'continue'], [10, 'continue'], [10, 'continue'], [10, 'continue'], [10, 'end']]);
  for (const entry of result.pages) assert.ok(Buffer.byteLength(JSON.stringify(entry)) <= 1024);
  const tail = await page(host, result.pages[3].nextCursor);
  assert.deepEqual(tail.body.names, result.pages[4].names, 'cursor resumes after the last emitted key');
  assert.deepEqual((await page(host, result.pages[4].nextCursor || '\u007f')).body,
    { count: 50, names: [], continuation: 'end', nextCursor: '' });
  assert.equal(new Set(result.body.names).size, 50);
  assert.equal(host.getStatus().cache.entries, 50);
  assert.ok(host.getStatus().cache.bytes <= 16384);
});

test('Kasa, Tuya and SSDP daemons share one context cache; the service lists all protocol labels', async t => {
  const replies = {
    '127.0.0.2': () => ({ system: { get_sysinfo: { err_code: 0, alias: 'Kitchen Switch', model: 'HS200(US)' } } }),
    '127.0.0.3': () => ({ system: { get_sysinfo: { err_code: 0, alias: 'Porch Plug', model: 'KP115(US)' } } })
  };
  for (const [address, reply] of Object.entries(replies)) await kasaPeer(t, address, () => reply());
  const host = await createPascalishServiceHost({ compiled: service,
    daemons: [kasaLoopback, { compiled: tuya, udpPort: 0 }, { compiled: ssdp, udpPort: 0 }],
    collectorId: 'shared', httpPort: null, udpPort: null, networkPeers: kasaPeers, bindings: ttl, logger: silent });
  await host.start();
  t.after(() => host.stop());
  const tuyaPort = host.getStatus().daemonDiagnostics[1].udpPort;
  assert.ok(tuyaPort > 0);
  await sendUdp(t, tuyaPort, tuyaPacket('ecb', 'bf00aa11abcdef'));
  await until(() => host.getStatus().daemonDiagnostics[1].udpEvents === 1);
  await sendUdp(t, tuyaPort, tuyaPacket('gcm', 'bf00aa22fedcba'));
  await until(() => host.getStatus().daemonDiagnostics[1].udpEvents === 2);
  const uuid = 'f0000000-0000-4000-8000-000000000001';
  await sendUdp(t, host.getStatus().daemonDiagnostics[2].udpPort, Buffer.from(
    `NOTIFY * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nNT: upnp:rootdevice\r\nNTS: ssdp:alive\r\nUSN: uuid:${uuid}::upnp:rootdevice\r\nCACHE-CONTROL: max-age=1800\r\n\r\n`));
  const expected = ['Kitchen Switch', 'Porch Plug', `SSDP ${uuid}`, 'Tuya abcdef', 'Tuya fedcba'];
  await until(async () => { const listed = (await names(host)).body.names; return expected.every(name => listed.includes(name)); });
  const result = (await names(host)).body;
  assert.equal(result.count, 5);
  assert.deepEqual([...result.names].sort(), expected);
  const [kasaStats, tuyaStats, ssdpStats] = host.getStatus().daemonDiagnostics;
  assert.equal(kasaStats.udpPort, null);
  assert.ok(kasaStats.timerRuns >= 2 && kasaStats.failures === 0, JSON.stringify(kasaStats));
  assert.equal(tuyaStats.udpEvents, 2, JSON.stringify(tuyaStats));
  assert.equal(ssdpStats.udpEvents, 1);
  assert.equal(ssdpStats.failures, 0);
});

test('Kasa errors surface in diagnostics and keep the previous record until its TTL', async t => {
  let failing = false;
  await kasaPeer(t, '127.0.0.2', () => (failing
    ? { system: { get_sysinfo: { err_code: -1 } } }
    : { system: { get_sysinfo: { err_code: 0, alias: 'Hall Light', model: 'KS200' } } }));
  await kasaPeer(t, '127.0.0.3', () => ({ system: { get_sysinfo: { err_code: 0, alias: '', model: 'HS100' } } }));
  const host = await createPascalishServiceHost({ compiled: service, daemons: [kasaLoopback], collectorId: 'kasa-errors',
    httpPort: null, udpPort: null, networkPeers: kasaPeers, bindings: ttl, logger: silent });
  await host.start();
  t.after(() => host.stop());
  await until(async () => (await names(host)).body.names.includes('Hall Light'));
  await until(() => /alias must be 1\.\.32 bytes for 127\.0\.0\.3/.test(host.getStatus().daemonDiagnostics[0].lastError || ''));
  failing = true;
  await until(() => /Program failure: Kasa get_sysinfo failed for 127\.0\.0\.2/.test(host.getStatus().daemonDiagnostics[0].lastError || ''));
  assert.deepEqual((await names(host)).body, { count: 1, names: ['Hall Light'] });
  assert.ok(host.getStatus().daemonDiagnostics[0].failures >= 2);
});

test('Tuya daemon UDP intake rejects invalid frames visibly and drops oversized datagrams', async t => {
  const host = await createPascalishServiceHost({ compiled: service, daemons: [{ compiled: tuya, udpPort: 0 }],
    collectorId: 'tuya-errors', httpPort: null, udpPort: null, bindings: ttl, maxDaemonDatagramBytes: 512, logger: silent });
  await host.start();
  t.after(() => host.stop());
  const port = host.getStatus().daemonDiagnostics[0].udpPort;
  const corrupt = tuyaPacket('ecb', 'bf00aa11abcdef');
  corrupt[corrupt.length - 6] ^= 1;
  await sendUdp(t, port, corrupt);
  await sendUdp(t, port, Buffer.alloc(600, 1));
  await until(() => host.getStatus().daemonDiagnostics[0].failures === 1 && host.getStatus().daemonDiagnostics[0].droppedDatagrams === 1);
  assert.match(host.getStatus().daemonDiagnostics[0].lastError, /Program failure: Invalid or unsupported Tuya/);
  assert.equal(host.getStatus().daemonDiagnostics[0].timerRuns, 1, 'startup timer turn is a no-op success');
  assert.deepEqual((await names(host)).body, { count: 0, names: [] });
});

test('hosts reject daemon cache schema mismatches and the compiler keeps cache bindings internal', async () => {
  const other = compileUnit(`daemon 'other' refresh 1000 ms
type Device = record name: string; protocol: string; address: string; end;
var devices: cache of Device;
begin end.`);
  await assert.rejects(createPascalishServiceHost({ compiled: service, daemons: [other], collectorId: 'bad',
    httpPort: null, udpPort: null, logger: silent }).then(host => host.start()), /must match/);
  assert.throws(() => compileUnit(`service 'leak';
${deviceType}
var devices: cache of Device;
get '/x'; begin return host.cache_next('devices', '') end end.`), /internal/);
});