import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { descriptionTarget, descriptionName, fetchDescription, createSsdpNames } from '../../pmachines/javascript/src/ssdp-names.mjs';

const uuid = '55076f6e-6b79-1d65-a42e-788daf5fbd0f';
const other = '5d076f6e-6b79-1d65-a42e-788daf5fbd0f';
const xml = (id = uuid, name = 'Living Room &amp; Café &#x1F4FA;') =>
  `<root xmlns="urn:schemas-upnp-org:device-1-0"><device><UDN>uuid:${id}</UDN><friendlyName>${name}</friendlyName></device></root>`;
const event = (id = uuid, location = 'http://192.168.2.1:8200/root.xml', nts = 'ssdp:alive', age = 180) => ({
  method: 'UDP', peer: '192.168.2.1', body: `NOTIFY * HTTP/1.1\r\nUSN: uuid:${id}::upnp:rootdevice\r\nNTS: ${nts}\r\nCACHE-CONTROL: max-age=${age}\r\nLOCATION: ${location}\r\n\r\n`
});
const device = { name: `SSDP ${uuid}`, protocol: 'ssdp', address: '192.168.2.1', deviceType: 'unknown' };
const tick = () => new Promise(resolve => setImmediate(resolve));
const silent = { warn() {} };

test('XML selects matching direct device UDN including nested devices, namespaces, Unicode and escaped entities', () => {
  assert.equal(descriptionName(xml(), uuid), 'Living Room & Café 📺');
  const nested = `<u:root xmlns:u="urn:schemas-upnp-org:device-1-0"><u:device><u:UDN>uuid:${other}</u:UDN><u:friendlyName>Wrong root</u:friendlyName><u:deviceList><u:device><u:UDN>uuid:${uuid.toUpperCase()}</u:UDN><u:friendlyName><![CDATA[Bedroom <TV>]]></u:friendlyName></u:device></u:deviceList></u:device></u:root>`;
  assert.equal(descriptionName(nested, uuid), 'Bedroom <TV>');
  assert.throws(() => descriptionName(xml(other), uuid), /UUID/);
  assert.throws(() => descriptionName(xml().replace('</root>', xml().replace(/^<root[^>]*>|<\/root>$/g, '') + '</root>'), uuid), /ambiguous/);
});

test('malformed, external entities/DTD, overlong names, oversized/deep XML fail closed', () => {
  for (const bad of [
    xml().replace('</friendlyName>', '</wrong>'), xml().slice(0, -1),
    '<!DOCTYPE root SYSTEM "http://192.168.2.1/external">' + xml(),
    '<!ENTITY evil SYSTEM "file:///secret">' + xml(),
    xml(uuid, '&evil;'), xml(uuid, '&oops'), xml(uuid, '&#0;'),
    xml(uuid, 'é'.repeat(129)), xml(uuid, '<b>nested</b>'),
    xml().replace('</root>', '<!--' + 'x'.repeat(16384) + '--></root>'),
    '<root>' + '<device>'.repeat(40) + '</device>'.repeat(40) + '</root>',
    xml().replace('<device>', '<device a="1" a="2">')
  ]) assert.throws(() => descriptionName(bad, uuid));
});

test('URL policy refuses nonliteral/DNS/public/loopback/link-local/source mismatch/credentials/fragments/protocol/ports', () => {
  assert.equal(descriptionTarget('http://192.168.2.1:8200/root.xml', '192.168.2.1').hostname, '192.168.2.1');
  for (const url of [
    'https://192.168.2.1/root.xml', 'http://localhost/root.xml', 'http://127.0.0.1/root.xml',
    'http://169.254.1.1/root.xml', 'http://8.8.8.8/root.xml', 'http://192.168.2.2/root.xml',
    'http://user:pass@192.168.2.1/root.xml', 'http://192.168.2.1/root.xml#',
    'http://192.168.2.1:22/root.xml', 'http://0xc0a80201/root.xml', 'http://192.168.2.01/root.xml'
  ]) assert.throws(() => descriptionTarget(url, '192.168.2.1'));
  assert.equal(descriptionTarget('http://192.168.2.2/root.xml', '192.168.2.1', ['192.168.2.2']).hostname, '192.168.2.2');
  assert.throws(() => descriptionTarget('http://192.168.2.1:9000/dev0/desc.xml', '192.168.2.1'));
  assert.equal(descriptionTarget('http://192.168.2.1:9000/dev0/desc.xml', '192.168.2.1', [], [80, 9000]).port, '9000');
});

test('transport bounds absolute time and XML bytes; never follows redirects', async t => {
  let externalCalls = 0;
  const server = http.createServer((request, response) => {
    if (request.url === '/redirect') response.writeHead(302, { Location: '/external' }).end();
    else if (request.url === '/external') { externalCalls++; response.end(xml()); }
    else if (request.url === '/big') response.end('x'.repeat(16385));
    else if (request.url === '/slow') {
      response.writeHead(200); response.write('<root>');
      const timer = setInterval(() => response.write(' '), 5);
      response.on('close', () => clearInterval(timer));
    } else response.end(xml());
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal(descriptionName(await fetchDescription(new URL(origin)), uuid), 'Living Room & Café 📺');
  await assert.rejects(fetchDescription(new URL('/redirect', origin)), /302/);
  assert.equal(externalCalls, 0);
  await assert.rejects(fetchDescription(new URL('/big', origin)), /byte limit/);
  await assert.rejects(fetchDescription(new URL('/slow', origin), { timeoutMs: 50 }), /timeout/);
});

test('dedup lookup cache, negative backoff, identity/location invalidation and advertisement-only expiry', async () => {
  let time = 1000, calls = 0;
  const names = createSsdpNames({ clock: () => time, logger: silent, get: async () => { calls++; return xml(); } });
  names.observe('ssdp-collector', event(uuid, undefined, undefined, 1));
  for (let i = 0; i < 8; i++) names.observe('ssdp-collector', event(uuid, undefined, undefined, 1));
  await tick();
  assert.equal(calls, 1);
  assert.equal(names.resolve(`ssdp:${uuid}`, device).name, 'Living Room & Café 📺');
  time = 1999;
  assert.equal(names.resolve(`ssdp:${uuid}`, device).status, 'resolved');
  time = 2000;
  assert.equal(names.resolve(`ssdp:${uuid}`, device).status, 'fallback', 'lookup did not extend advertisement TTL');
  names.observe('ssdp-collector', event());
  await tick();
  assert.equal(names.resolve(`ssdp:${uuid}`, { ...device, address: '192.168.2.2' }).status, 'fallback');
  const duplicate = event();
  duplicate.body = duplicate.body.replace('\r\n\r\n', '\r\nLOCATION: http://192.168.2.1/other.xml\r\n\r\n');
  names.observe('ssdp-collector', duplicate);
  assert.equal(names.resolve(`ssdp:${uuid}`, device).status, 'fallback');
  assert.match(names.resolve(`ssdp:${uuid}`, device).error, /Duplicate/);
  names.observe('ssdp-collector', event(uuid, 'http://192.168.2.2/root.xml'));
  assert.equal(names.resolve(`ssdp:${uuid}`, device).status, 'fallback');
  assert.match(names.resolve(`ssdp:${uuid}`, device).error, /denied/);
  assert.equal(calls, 2, 'denied source never fetched');
  names.observe('ssdp-collector', event(uuid, undefined, 'ssdp:byebye'));
  assert.equal(names.stats().entries, 0);
  names.stop();
  const negative = createSsdpNames({ clock: () => time, logger: silent, get: async () => { calls++; throw new Error('offline'); } });
  negative.observe('ssdp-collector', event()); await tick();
  const before = calls;
  negative.observe('ssdp-collector', event()); await tick();
  assert.equal(calls, before);
  assert.match(negative.resolve(`ssdp:${uuid}`, device).error, /offline/);
  time += 30000; negative.observe('ssdp-collector', event()); await tick();
  assert.equal(calls, before + 1);
  negative.stop();
});

test('description queue is bounded to fifty entries and two active reads; obsolete completion cannot relabel', async () => {
  const pending = [];
  const names = createSsdpNames({ logger: silent, get: () => new Promise(resolve => pending.push(resolve)) });
  for (let i = 0; i < 60; i++) names.observe('ssdp-collector', event(`00000000-0000-0000-0000-${String(i).padStart(12, '0')}`));
  await tick();
  assert.equal(pending.length, 2);
  assert.deepEqual(names.stats(), { entries: 50, active: 2 });
  names.stop();
  for (const resolve of pending) resolve(xml());
  await tick();
  assert.equal(names.stats().entries, 0);
  const callbacks = [];
  const changing = createSsdpNames({ logger: silent, get: () => new Promise(resolve => callbacks.push(resolve)) });
  changing.observe('ssdp-collector', event()); await tick();
  changing.observe('ssdp-collector', event(uuid, 'http://192.168.2.1/new.xml')); await tick();
  callbacks[0](xml(uuid, 'obsolete')); await tick();
  assert.equal(changing.resolve(`ssdp:${uuid}`, device).status, 'fallback');
  callbacks[1](xml(uuid, 'current')); await tick();
  assert.equal(changing.resolve(`ssdp:${uuid}`, device).name, 'current');
  changing.stop();
});
