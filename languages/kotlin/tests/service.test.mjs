import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import dgram from 'node:dgram';
import test from 'node:test';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../virtualMachines/esp32/pmachines/javascript/src/service-host.mjs';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';

const source = await fs.readFile(new URL('../examples/http-service.kt', import.meta.url), 'utf8');

test('factorial service computes 1 through 10 and reports invalid input', async t => {
  const factorialSource = await fs.readFile(new URL('../examples/factorial-service.kt', import.meta.url), 'utf8');
  const compiled = compileKotlinToPcode(factorialSource, { fileName: 'factorial-service.kt', target: 'esp32' });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'factorial-test', httpPort: null, udpPort: null,
    logger: { warn() {}, error() {}, log() {} }
  });
  t.after(() => host.stop());
  await host.start();
  let expected = 1;
  for (let n = 1; n <= 10; n += 1) {
    expected *= n;
    const response = await host.dispatch({
      transport: 'http', method: 'GET', path: '/api/factorial', query: { n: String(n) }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { n, factorial: expected });
  }
  const invalid = await host.dispatch({
    transport: 'http', method: 'GET', path: '/api/factorial', query: { n: '11' }
  });
  assert.deepEqual(invalid.body, { error: 'n must be an integer from 1 through 10' });
});

test('Kotlin service exposes multiple GET endpoints through the JavaScript HTTP host', async t => {
  const compiled = compileKotlinToPcode(source, { fileName: 'kotlin_service.kt', target: 'js' });
  assert.deepEqual(compiled.programMap.runtimeUnit, { kind: 'service', id: 'kotlin_service', refreshMs: null });
  assert.equal(compiled.programMap.sourceLanguage, 'kotlin');
  assert.deepEqual(compiled.programMap.targets, ['js', 'esp32']);
  assert.deepEqual(compiled.programMap.serviceEndpoints, [
    { verb: 'GET', path: '/api/kotlin/status' },
    { verb: 'GET', path: '/api/kotlin/version' }
  ]);
  assert.ok(encodeHostedImage(compiled.pcodeText).startsWith('PHI1'));
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'kotlin-test', httpPort: 0, udpPort: 0,
    logger: { warn() {}, error() {}, log() {} }
  });
  t.after(() => host.stop());
  await host.start();
  const origin = `http://127.0.0.1:${host.getStatus().httpPort}`;
  for (const [path, expected] of [
    ['/api/kotlin/status', { status: 'ok' }],
    ['/api/kotlin/version', { version: 1 }]
  ]) {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
  }
  const missing = await fetch(`${origin}/api/kotlin/missing`, { signal: AbortSignal.timeout(5000) });
  assert.equal(missing.status, 404);
});

test('Kotlin services can target the portable native C++ host', () => {
  const compiled = compileKotlinToPcode(source, { fileName: 'native_kotlin_service.kt', target: 'native' });
  assert.equal(compiled.programMap.target, 'native');
  assert.deepEqual(compiled.programMap.targets, ['js', 'native']);
  assert.throws(() => compileKotlinToPcode(
    `import pulse.host.cacheGet
      import pulse.http.HttpGet
      @HttpGet("/health")
      fun health(): String = cacheGet("devices", "camera-1")`,
    { fileName: 'native_cache_binding.kt', target: 'native' }), /does not support binding host\.cache_get/);
  assert.throws(() => compileKotlinToPcode(
    `@Daemon(id = "native-daemon", refreshMs = 1000) class NativeDaemon {}\nfun main() {}`,
    { target: 'native' }), /hosted services only/);
});

test('Kotlin handlers read HTTP request context via host bindings', async t => {
  const compiled = compileKotlinToPcode(`import pulse.http.*
@HttpGet("/api/context")
fun context(): String = requestMethod() + "|" + requestPath() + "|" + requestQuery("name") + "|" + requestPeer() + "|" + requestBody()
`, { fileName: 'context.kt' });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'kotlin-context', httpPort: null, udpPort: null,
    logger: { warn() {}, error() {}, log() {} }
  });
  t.after(() => host.stop());
  await host.start();
  const result = await host.dispatch({
    transport: 'http', method: 'GET', path: '/api/context', query: { name: 'Kotlin' },
    peer: '192.0.2.1', body: 'payload'
  });
  assert.equal(result.status, 200);
  assert.equal(result.body, 'GET|/api/context|Kotlin|192.0.2.1|payload');
  assert.ok(encodeHostedImage(compiled.pcodeText).startsWith('PHI1'));
});

test('Kotlin service specializes scalar generic helpers', async t => {
  const compiled = compileKotlinToPcode(`fun <T> identity(value: T): T = value
fun <T> same(left: T, right: T): Boolean = left == right
@HttpGet("/api/generic")
fun endpoint(): String {
  val number: Byte = identity<Byte>(42)
  if (same(number, identity<Byte>(42))) return identity<String>("\\"ok\\"")
  return "\\"failed\\""
}
`, { fileName: 'generic-service.kt', target: 'esp32' });
  assert.ok(encodeHostedImage(compiled.pcodeText).startsWith('PHI1'));
  const generic = Object.values(compiled.programMap.procedures).filter(proc => proc.name === 'Program.identity');
  assert.deepEqual(generic.map(proc => proc.typeArguments[0]).sort(), ['sbyte', 'string']);
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'kotlin-generic', httpPort: null, udpPort: null,
    logger: { warn() {}, error() {}, log() {} }
  });
  t.after(() => host.stop());
  await host.start();
  const result = await host.dispatch({ transport: 'http', method: 'GET', path: '/api/generic' });
  assert.equal(result.status, 200);
  assert.equal(result.body, 'ok');
});

test('Kotlin handlers route standard HTTP methods', async t => {
  const methods = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options'];
  const declarations = methods.map(method =>
    `@Http${method}("/api/method")\nfun handle${method}(): String = "\\"${method.toUpperCase()}\\""`).join('\n');
  const compiled = compileKotlinToPcode(`import pulse.http.requestHeader\n${declarations}
@HttpGet("/api/header")
fun header(): String = requestHeader("X-Test")
`, { fileName: 'methods.kt' });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'kotlin-methods', httpPort: 0, udpPort: null,
    logger: { warn() {}, error() {}, log() {} }
  });
  t.after(() => host.stop());
  await host.start();
  for (const method of methods.map(value => value.toUpperCase())) {
    const response = await fetch(`http://127.0.0.1:${host.getStatus().httpPort}/api/method`, {
      method, signal: AbortSignal.timeout(5000)
    });
    assert.equal(response.status, 200, method);
    if (method === 'HEAD') assert.equal(await response.text(), '');
    else assert.equal(await response.json(), method);
  }
  const header = await fetch(`http://127.0.0.1:${host.getStatus().httpPort}/api/header`, {
    headers: { 'X-Test': '"header-value"' }, signal: AbortSignal.timeout(5000)
  });
  assert.equal(await header.json(), 'header-value');
  assert.ok(encodeHostedImage(compiled.pcodeText).startsWith('PHI1'));
});

test('Kotlin handlers perform allowlisted TCP and UDP exchanges', async t => {
  const tcp = net.createServer(socket => socket.once('data', () => socket.end(Buffer.from([0, 1, 0x41]))));
  await new Promise((resolve, reject) => {
    tcp.once('error', reject);
    tcp.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => tcp.close(resolve)));
  const udp = dgram.createSocket('udp4');
  await new Promise((resolve, reject) => {
    udp.once('error', reject);
    udp.bind(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => udp.close(resolve)));
  udp.on('message', (message, peer) => udp.send(message, peer.port, peer.address));
  const tcpPort = tcp.address().port, udpPort = udp.address().port;
  const compiled = compileKotlinToPcode(`import pulse.net.*
@HttpGet("/api/network")
fun network(): String = tcpExchange("127.0.0.1", ${tcpPort}, "41", 2, 1000, 32) + "|" + udpExchange("127.0.0.1", ${udpPort}, "42", 1000, 32)
`, { fileName: 'network.kt' });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'kotlin-network', httpPort: null, udpPort: null,
    networkPeers: [{ ip: '127.0.0.1', port: tcpPort }, { ip: '127.0.0.1', port: udpPort }],
    logger: { warn() {}, error() {}, log() {} }
  });
  t.after(() => host.stop());
  await host.start();
  const result = await host.dispatch({ transport: 'http', method: 'GET', path: '/api/network', body: '' });
  assert.equal(result.body, '000141|42');
  assert.ok(encodeHostedImage(compiled.pcodeText).startsWith('PHI1'));
  const denied = await createPascalishServiceHost({
    compiled, collectorId: 'kotlin-denied', httpPort: null, udpPort: null,
    networkPeers: [], logger: { warn() {}, error() {}, log() {} }
  });
  t.after(() => denied.stop());
  await denied.start();
  await assert.rejects(denied.dispatch({
    transport: 'http', method: 'GET', path: '/api/network', body: ''
  }), /Network peer is not allowed/);
});

test('Kasa application sends its probe through generic UDP and reports network failures', async t => {
  const udp = dgram.createSocket('udp4');
  await new Promise((resolve, reject) => {
    udp.once('error', reject);
    udp.bind(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => udp.close(resolve)));
  let respond = true;
  const received = [];
  udp.on('message', (message, peer) => {
    received.push(message.toString('hex'));
    if (respond) udp.send(Buffer.from('1234', 'hex'), peer.port, peer.address);
  });
  const port = udp.address().port;
  const example = await fs.readFile(new URL('../examples/kasa-probe-service.kt', import.meta.url), 'utf8');
  const source = example.replace('const val KASA_DISCOVERY_PORT = 9999', `const val KASA_DISCOVERY_PORT = ${port}`);
  const compiled = compileKotlinToPcode(source, { fileName: 'kasa-probe-service.kt', target: 'esp32' });
  assert.match(compiled.pcodeText, /CALL_EXT host\.udp_exchange/);
  assert.doesNotMatch(compiled.pcodeText, /host\.kasa_discover/);
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'kotlin-kasa', httpPort: null, udpPort: null,
    networkPeers: [{ ip: '127.0.0.1', port }], logger: { warn() {}, error() {}, log() {} }
  });
  t.after(() => host.stop());
  await host.start();
  const dispatch = ip => host.dispatch({
    transport: 'http', method: 'GET', path: '/api/kasa/discover', query: { ip }
  });
  const result = await dispatch('127.0.0.1');
  assert.deepEqual(result.body, { address: '127.0.0.1', responseHex: '1234' });
  assert.deepEqual(received, ['d0f281f88bff9af7d5ef94b6d1b4c09fec95e68fe187e8caf08bf68bf6']);
  await assert.rejects(dispatch('127.0.0.2'), /Network peer is not allowed/);
  respond = false;
  await assert.rejects(dispatch('127.0.0.1'), /UDP exchange timeout/);
});

test('Kotlin Kasa daemon sends a discovery packet and publishes a decoded device', async t => {
  const peer = dgram.createSocket('udp4');
  await new Promise((resolve, reject) => {
    peer.once('error', reject);
    peer.bind(0, '127.0.0.2', resolve);
  });
  t.after(() => new Promise(resolve => peer.close(resolve)));
  const port = peer.address().port;
  const source = (await fs.readFile(new URL('../examples/kasa-discovery-daemon.kt', import.meta.url), 'utf8'))
    .replace('const val KASA_PORT = 9999', `const val KASA_PORT = ${port}`)
    .replace('localIpv4Subnets()',
      '"[{\\"address\\":\\"127.0.0.1\\",\\"broadcast\\":\\"127.0.0.2\\"}]"');
  const daemon = compileKotlinToPcode(source, {
    fileName: 'kasa-discovery-daemon.kt', target: 'esp32', daemonId: 'kasa-collector', daemonRefreshMs: 300000
  });
  const compiled = compileKotlinToPcode(
    await fs.readFile(new URL('../examples/kasa-device-service.kt', import.meta.url), 'utf8'),
    { fileName: 'kasa-device-service.kt', target: 'esp32', serviceId: 'kasa-service' }
  );
  const schema = [{ name: 'devices', capacity: 50, fields: ['name', 'protocol', 'address', 'deviceType']
    .map(name => ({ name, type: 'string' })) }];
  compiled.programMap.hostCaches = schema;
  daemon.programMap.hostCaches = schema;
  let probe, encrypted;
  peer.on('message', (message, remote) => {
    probe = message.toString('hex');
    let key = 171;
    const response = Buffer.from(JSON.stringify({ system: { get_sysinfo: {
      err_code: 0, alias: 'Kitchen', model: 'HS200'
    } } }));
    encrypted = Buffer.from([...response].map(byte => { key ^= byte; return key; }));
    for (let i = 0; i < 3; i++) peer.send(encrypted, remote.port, remote.address);
  });
  const host = await createPascalishServiceHost({
    compiled, daemons: [{ compiled: daemon, udpPort: port, udpBindAddress: '127.0.0.1', udpQueueLimit: 50 }],
    collectorId: 'kasa-test', host: '127.0.0.1', httpPort: null, udpPort: null,
    networkPeers: [{ ip: '127.0.0.2', port }], logger: { warn() {}, error() {}, log() {} }
  });
  t.after(() => host.stop());
  await host.start();
  const deadline = Date.now() + 12000;
  while (host.getStatus().daemonDiagnostics[0].udpEvents < 3 && Date.now() < deadline)
    await new Promise(resolve => setTimeout(resolve, 10));
  const stats = host.getStatus().daemonDiagnostics[0];
  assert.equal(stats.failures, 0, stats.lastError);
  assert.equal(stats.udpEvents, 3);
  assert.equal(stats.shedDatagrams, 0);
  assert.equal(probe, 'd0f281f88bff9af7d5ef94b6d1b4c09fec95e68fe187e8caf08bf68bf6');
  const snapshot = await host.dispatch({ method: 'GET', path: '/api/devices/snapshot', query: {} });
  assert.equal(snapshot.body.total, 1);
  assert.deepEqual(snapshot.body.records[0].device, {
    name: 'Kitchen', protocol: 'kasa', address: '127.0.0.2', deviceType: 'HS200'
  });
  assert.ok(snapshot.body.records[0].remainingTTLms > 300000);
  const unrelated = dgram.createSocket('udp4');
  t.after(() => new Promise(resolve => unrelated.close(resolve)));
  await new Promise((resolve, reject) => unrelated.send(Buffer.from('unrelated'), port, '127.0.0.1',
    error => error ? reject(error) : resolve()));
  while (host.getStatus().daemonDiagnostics[0].udpEvents < 4 && Date.now() < deadline)
    await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(host.getStatus().daemonDiagnostics[0].udpEvents, 4);
  assert.equal(host.getStatus().daemonDiagnostics[0].failures, 0);
  await new Promise((resolve, reject) => peer.send(Buffer.from(probe, 'hex'), port, '127.0.0.1',
    error => error ? reject(error) : resolve()));
  while (host.getStatus().daemonDiagnostics[0].udpEvents < 5 && Date.now() < deadline)
    await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(host.getStatus().daemonDiagnostics[0].udpEvents, 5);
  assert.equal(host.getStatus().daemonDiagnostics[0].failures, 0);
  await new Promise((resolve, reject) => peer.send(Buffer.from('invalid'), port, '127.0.0.1',
    error => error ? reject(error) : resolve()));
  while (host.getStatus().daemonDiagnostics[0].failures < 1 && Date.now() < deadline)
    await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(host.getStatus().daemonDiagnostics[0].failures, 1);
  assert.notEqual(host.getStatus().daemonDiagnostics[0].lastError, '');
  const afterError = await host.dispatch({ method: 'GET', path: '/api/devices/snapshot', query: {} });
  assert.equal(afterError.body.total, 1);
  await Promise.all(Array.from({ length: 60 }, () => new Promise((resolve, reject) =>
    peer.send(encrypted, port, '127.0.0.1', error => error ? reject(error) : resolve()))));
  const overflowDeadline = Date.now() + 5000;
  while (host.getStatus().daemonDiagnostics[0].shedDatagrams === 0 && Date.now() < overflowDeadline)
    await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(host.getStatus().daemonDiagnostics[0].shedDatagrams > 0, 'Queue overflow must be reported');
});

test('Kotlin daemon schedules its next run after exactly five minutes', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const compiled = compileKotlinToPcode('@HttpGet("/api/test") fun test(): String = "{}"', {
    fileName: 'service.kt', serviceId: 'schedule-service'
  });
  const daemon = compileKotlinToPcode('fun main() {}', {
    fileName: 'daemon.kt', daemonId: 'schedule-daemon', daemonRefreshMs: 300000
  });
  assert.throws(() => compileKotlinToPcode('fun main() {}', {
    daemonId: 'invalid', daemonRefreshMs: 300001
  }), /between 10 and 300000/);
  const host = await createPascalishServiceHost({
    compiled, daemons: [daemon], collectorId: 'schedule-test', httpPort: null, udpPort: null,
    logger: { warn() {}, error() {}, log() {} }
  });
  t.after(() => host.stop());
  await host.start();
  assert.equal(host.getStatus().daemonDiagnostics[0].timerRuns, 1);
  t.mock.timers.tick(299999);
  assert.equal(host.getStatus().daemonDiagnostics[0].timerRuns, 1);
  t.mock.timers.tick(1);
  const deadline = Date.now() + 5000;
  while (host.getStatus().daemonDiagnostics[0].timerRuns < 2 && Date.now() < deadline)
    await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(host.getStatus().daemonDiagnostics[0].timerRuns, 2);
});

for (const [description, sourceText, expected] of [
  ['non-string result', '@HttpGet("/api/a") fun endpoint(): Int = 1', /return String/],
  ['handler parameters', '@HttpGet("/api/a") fun endpoint(x: Int): String = "ok"', /take no parameters/],
  ['missing path', '@HttpGet() fun endpoint(): String = "ok"', /one literal path string/],
  ['nonliteral path', '@HttpGet(path) fun endpoint(): String = "ok"', /one literal path string/],
  ['invalid ESP32 path', '@HttpGet("/private") fun endpoint(): String = "ok"', /paths must be/],
  ['duplicate route', '@HttpGet("/api/a") fun a(): String = "a"\n@HttpGet("/api/a") fun b(): String = "b"', /Duplicate service endpoint/],
  ['mixed main and service', '@HttpGet("/api/a") fun a(): String = "a"\nfun main() {}', /cannot declare fun main/],
  ['overloaded handler', '@HttpGet("/api/a") fun a(): String = "a"\nfun a(x: Int): String = "b"', /must not be overloaded/],
  ['wrong host binding argument type', 'import pulse.http.requestQuery\n@HttpGet("/api/a") fun a(): String = requestQuery(1)', /Cannot use 'int' where 'string'/],
  ['host bindings outside services', 'import pulse.http.requestBody\nfun main() { println(requestBody()) }', /Unknown static method 'requestBody'/],
  ['unsupported annotation shape', '@HttpGet<Int>("/api/a") fun a(): String = "a"', /does not accept type arguments/],
  ['unavailable scalar library binding', 'import pulse.http.requestQuery\n@HttpGet("/api/a") fun a(): String { val n = requestQuery("n").length\n val half = n / 2\n return "n=$half"\n}', /do not yet support scalar library calls/]
]) {
  test(`Kotlin service rejects ${description}`, () => {
    assert.throws(() => compileKotlinToPcode(sourceText, { fileName: 'service.kt' }), expected);
  });
}

test('Kotlin ignores unknown annotations on functions', () => {
  const compiled = compileKotlinToPcode('@Unknown fun main() { println("ok") }', { fileName: 'service.kt' });
  assert.ok(compiled.pcodeText.includes('PUSH_STR "ok"'));
});
