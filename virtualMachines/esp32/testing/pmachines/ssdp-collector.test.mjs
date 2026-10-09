import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import dgram from 'node:dgram';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr as compile } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { createBoundedTextBindings } from '../../pmachines/javascript/src/bounded-text.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';

const source = await fs.readFile(new URL('../../src/ssdp-collector-daemon.pas', import.meta.url), 'utf8');
const ssdp = compile(source, { hostServices: true });
const service = compile(await fs.readFile(new URL('../../src/device-cache-service.pas', import.meta.url), 'utf8'), { hostServices: true });
const silent = { error() {}, warn() {} };
const uuid = index => `f0000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
export function notification(id, { nts = 'ssdp:alive', age = '1800', nt = 'upnp:rootdevice', headers = '' } = {}) {
  return Buffer.from(`NOTIFY * HTTP/1.1\r\nhOsT: 239.255.255.250:1900\r\nnT: ${nt}\r\nNTS: ${nts}\r\nUsN: uuid:${id}${nt === `uuid:${id}` ? '' : `::${nt}`}\r\nCACHE-CONTROL: max-age=${age}\r\n${headers}\r\n`);
}
async function until(predicate) {
  const end = Date.now() + 5000;
  while (!predicate()) { if (Date.now() > end) throw new Error('Timed out waiting for SSDP event'); await new Promise(r => setTimeout(r, 5)); }
}
async function start(t, options = {}) {
  const host = await createPascalishServiceHost({
    compiled: service, collectorId: 'ssdp-test', httpPort: null, udpPort: null,
    daemons: [{ compiled: ssdp, udpPort: 0 }], logger: silent, ...options
  });
  await host.start(); t.after(() => host.stop());
  const socket = dgram.createSocket('udp4');
  t.after(() => new Promise(resolve => socket.close(resolve)));
  const send = async bytes => {
    const before = host.getStatus().daemonDiagnostics.at(-1).udpEvents;
    await new Promise((resolve, reject) => socket.send(bytes, host.getStatus().daemonDiagnostics.at(-1).udpPort,
      '127.0.0.1', error => error ? reject(error) : resolve()));
    await until(() => host.getStatus().daemonDiagnostics.at(-1).udpEvents > before);
  };
  return { host, send };
}
async function names(host) {
  let cursor = '', result = [];
  do {
    const response = await host.dispatch({ method: 'GET', path: '/api/devices/names', query: { cursor } });
    assert.ok(response.body.names.length <= 10);
    result.push(...response.body.names); cursor = response.body.nextCursor;
  } while (cursor);
  return result;
}

test('SSDP signed image fits existing capacity and protocol remains passive Pascalish', () => {
  assert.ok(Number.parseInt(encodeHostedImage(ssdp.pcodeText).slice(4, 12), 16) <= 512);
  assert.deepEqual(ssdp.programMap.hostCaches, service.programMap.hostCaches);
  assert.doesNotMatch(source, /host\.(tcp_exchange|udp_exchange)|M-SEARCH/);
});

test('actual NOTIFY frames deduplicate service variants, update TTL and remove byebye', async t => {
  let clock = 1000;
  const { host, send } = await start(t, { clock: () => clock });
  await send(notification(uuid(1), { age: '1' }));
  assert.deepEqual(await names(host), [`SSDP ${uuid(1)}`]);
  clock = 1500;
  await send(notification(uuid(1), { nts: 'ssdp:update', age: '999999999999999999999', nt: 'urn:schemas-upnp-org:service:ContentDirectory:1' }));
  clock = 2400;
  assert.deepEqual(await names(host), [`SSDP ${uuid(1)}`], 'update replaces the one UUID observation');
  clock = 181500;
  assert.deepEqual(await names(host), [], 'huge max-age is clamped before integer conversion');
  await send(notification(uuid(1)));
  await send(notification(uuid(1), { nt: `uuid:${uuid(1)}` }));
  assert.equal((await names(host)).length, 1);
  await send(notification(uuid(1), { nts: 'ssdp:byebye' }));
  assert.deepEqual(await names(host), []);
  assert.equal(host.getStatus().daemonDiagnostics[0].failures, 0);
});

test('auxiliary observer sees only accepted events and enqueues without delaying collector/cache snapshots', async t => {
  const seen = [];
  const { host, send } = await start(t, { onDaemonEvent: (unit, event) => {
    if (event.method === 'UDP') seen.push([unit, event.body, event.peer]);
  } });
  await send(notification(uuid(1), { headers: 'LOCATION: http://192.168.2.1:8200/root.xml\r\n' }));
  await send(Buffer.from('invalid'));
  assert.equal(seen.length, 1);
  assert.equal(seen[0][0], 'ssdp-collector');
  assert.match(seen[0][1], /LOCATION:/);
  assert.equal(seen[0][2], '127.0.0.1');
  assert.deepEqual(await names(host), [`SSDP ${uuid(1)}`]);
});

test('malformed notification frames fail explicitly without publishing or deleting a valid UUID', async t => {
  const { host, send } = await start(t);
  await send(notification(uuid(1)));
  const good = notification(uuid(1)).toString();
  const invalid = [
    good.replace('NOTIFY * HTTP/1.1', 'HTTP/1.1 200 OK'),
    good.replace('NOTIFY * HTTP/1.1', 'M-SEARCH * HTTP/1.1'),
    good.replace('239.255.255.250:1900', '239.255.255.251:1900'),
    good.replace('ssdp:alive', 'ssdp:unknown'),
    good.replace('max-age=1800', 'max-age=0'),
    good.replace('max-age=1800', 'max-age=-1'),
    good.replace('max-age=1800', 'max-age=1oops'),
    good.replace('max-age=1800', 'max-age=1, max-age=2'),
    good.replace('f0000000', 'z0000000'),
    good.replace(`::upnp:rootdevice`, '::wrong'),
    good.replace('\r\n\r\n', '\r\nUSN: uuid:duplicate\r\n\r\n'),
    good.replace('nT: ', ' nT: '),
    good.replaceAll('\r\n', '\n'),
    good + 'unexpected body',
    notification(uuid(1), { headers: `SERVER: ${'x'.repeat(257)}\r\n` }).toString()
  ];
  for (const frame of invalid) await send(Buffer.from(frame));
  assert.equal(host.getStatus().daemonDiagnostics[0].failures, invalid.length);
  assert.match(host.getStatus().daemonDiagnostics[0].lastError, /header|SSDP/i);
  assert.deepEqual(await names(host), [`SSDP ${uuid(1)}`]);
});

test('Mediaroom NOTIFY is cached per sender and other vendor frames are ignored', async t => {
  const { host, send } = await start(t);
  const mediaroom = nts => Buffer.from(`NOTIFY * HTTP/1.1\r\nHOST:239.255.255.250:1900\r\nNTS:${nts}\r\n`
    + 'NT:urn:microsoft:mediaroom:remote:1\r\nx-mediaroom-device-id: *\r\n\r\n');
  await send(mediaroom('ssdp:alive'));
  await send(mediaroom('ssdp:alive'));
  assert.deepEqual(await names(host), ['Mediaroom 127.0.0.1']);
  const records = (await host.dispatch({ method: 'GET', path: '/api/devices/snapshot', query: {} })).body;
  assert.match(JSON.stringify(records), /ssdp:mediaroom:127\.0\.0\.1/);
  assert.match(JSON.stringify(records), /urn:microsoft:mediaroom:remote:1/);
  await send(notification(uuid(2)).toString().replace(`UsN: uuid:${uuid(2)}::upnp:rootdevice`, 'USN: vendor-device'));
  await send(mediaroom('ssdp:byebye'));
  assert.equal(host.getStatus().daemonDiagnostics[0].failures, 0);
  assert.deepEqual(await names(host), []);
});

test('50 UUIDs and their variants remain bounded and the oldest put is evicted', async t => {
  const { host, send } = await start(t);
  for (let index = 0; index < 50; index++) {
    await send(notification(uuid(index)));
    await send(notification(uuid(index), { nt: 'urn:schemas-upnp-org:device:MediaServer:1' }));
  }
  const all = await names(host);
  assert.equal(all.length, 50); assert.equal(new Set(all).size, 50);
  await send(notification(uuid(50)));
  const replaced = await names(host);
  assert.equal(replaced.length, 50);
  assert.ok(!replaced.includes(`SSDP ${uuid(0)}`));
  assert.ok(replaced.includes(`SSDP ${uuid(50)}`));
  assert.equal(host.getStatus().daemonDiagnostics[0].failures, 0);
});

test('multicast configuration and port conflicts are rejected before sockets or cache are installed', async () => {
  const base = { compiled: service, collectorId: 'bad-config', httpPort: null, udpPort: null };
  for (const entry of [
    { compiled: ssdp, multicastGroup: '239.255.255.250' },
    { compiled: ssdp, udpPort: 1900, multicastGroup: '192.168.2.1' },
    { compiled: ssdp, udpPort: 1900, multicastGroup: '239.255.255.250', multicastInterface: 'invalid' }
  ]) await assert.rejects(createPascalishServiceHost({ ...base, daemons: [entry] }), /multicast/i);
  await assert.rejects(createPascalishServiceHost({ ...base, udpPort: 1900,
    daemons: [{ compiled: ssdp, udpPort: 1900 }] }), /Duplicate owned UDP/);
  await assert.rejects(createPascalishServiceHost({ ...base, daemons: Array(4).fill(ssdp) }), /daemon count/);
});

test('bounded generic text headers are case-insensitive and reject duplicate and malformed framing', () => {
  const b = createBoundedTextBindings(), frame = notification(uuid(1)).toString();
  assert.equal(b['host.text_header'](frame, 'host'), '239.255.255.250:1900');
  assert.equal(b['host.text_header'](frame, ''), 'NOTIFY * HTTP/1.1');
  assert.throws(() => b['host.text_header'](frame.replace('\r\n\r\n', '\r\nhost: x\r\n\r\n'), 'HOST'), /Duplicate/);
  assert.throws(() => b['host.text_slice']('abc', -1, 2));
  assert.throws(() => b['host.text_slice']('abc', 1, 3));
  assert.throws(() => b['host.text_lower']('é'), /ASCII/);
});

test('JavaScript HTTP installer loads three signed daemons and rejects replacement without stopping the active host', async t => {
  const machine = createJsPmachineNodeServer({ name: 'ssdp-installer-proof', logger: silent });
  await new Promise(resolve => machine.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${machine.address().port}`;
  t.after(async () => {
    await fetch(`${origin}/pmachine/service_host/stop`, { method: 'POST' });
    machine.closeAllConnections();
    await new Promise(resolve => machine.close(resolve));
  });
  const idle = id => compile(`daemon '${id}' refresh 60000 ms begin end.`, { hostServices: true });
  const units = [service, idle('idle-one'), idle('idle-two'), ssdp];
  for (let index = 0; index < units.length; index++) {
    const unit = units[index];
    for (const [file, body] of [
      [`/unit${index}.pcode`, unit.pcodeText],
      [`/unit${index}.map.json`, JSON.stringify(attachPcodeSignature(unit.programMap, unit.pcodeText))]
    ]) {
      const response = await fetch(`${origin}/ffs/upload`, { method: 'POST', body: new URLSearchParams({ file, body }) });
      assert.equal(response.status, 200);
    }
  }
  const install = values => fetch(`${origin}/pmachine/service_host/install`, {
    method: 'POST', body: new URLSearchParams({
      collectorId: 'three-signed', serviceFile: '/unit0.pcode', serviceMap: '/unit0.map.json',
      daemons: JSON.stringify([1, 2, 3].map(index => ({ file: `/unit${index}.pcode`, map: `/unit${index}.map.json` }))),
      ...values
    })
  });
  const result = await install({});
  assert.equal(result.status, 200, await result.text());
  const before = await (await fetch(`${origin}/pmachine/service_host/status`)).json();
  assert.equal(before.daemonDiagnostics.length, 3);
  const additional = await install({
    collectorId: 'additional-one', additional: 'true', httpPort: '0', udpPort: '0',
    daemons: JSON.stringify([{ file: '/unit1.pcode', map: '/unit1.map.json' }])
  });
  const additionalText = await additional.text();
  assert.equal(additional.status, 200, additionalText);
  const additionalStatus = JSON.parse(additionalText);
  assert.equal(additionalStatus.collectorId, 'additional-one');
  assert.ok(Number.isInteger(additionalStatus.httpPort));
  const registry = await (await fetch(`${origin}/api/services`)).json();
  assert.equal(registry.nodeId, 'ssdp-installer-proof');
  assert.ok(registry.services.some(item => item.serviceId === 'pmachine' && item.kind === 'runtime'));
  const hosted = registry.services.filter(item => item.kind === 'service');
  assert.deepEqual(hosted.map(item => item.instanceId).sort(), ['additional-one', 'three-signed']);
  assert.equal(hosted.find(item => item.instanceId === 'additional-one').endpoint,
    `http://127.0.0.1:${additionalStatus.httpPort}/`);
  assert.equal(registry.services.filter(item => item.kind === 'daemon').length, 4);
  const additionalHealth = await fetch(`http://127.0.0.1:${additionalStatus.httpPort}/health`);
  assert.equal(additionalHealth.status, 200);
  const selected = await (await fetch(`${origin}/pmachine/service_host/status?collectorId=additional-one`)).json();
  assert.equal(selected.bootId, additionalStatus.bootId);
  const rejected = await install({ collectorId: 'invalid-replacement', daemons: 'malformed' });
  assert.equal(rejected.status, 409);
  const after = await (await fetch(`${origin}/pmachine/service_host/status`)).json();
  assert.equal(after.bootId, before.bootId);
  assert.equal(after.running, true);
  const stopped = await fetch(`${origin}/pmachine/service_host/stop?collectorId=additional-one`, { method: 'POST' });
  assert.equal(stopped.status, 200);
  assert.equal((await (await fetch(`${origin}/pmachine/service_host/status`)).json()).bootId, before.bootId);
  assert.equal((await fetch(`${origin}/pmachine/service_host/status?collectorId=additional-one`)).status, 404);
  const afterStop = await (await fetch(`${origin}/api/services`)).json();
  assert.ok(!afterStop.services.some(item => item.instanceId.startsWith('additional-one')));
});
