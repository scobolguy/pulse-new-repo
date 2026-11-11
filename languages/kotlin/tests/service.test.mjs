import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import dgram from 'node:dgram';
import test from 'node:test';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../virtualMachines/esp32/pmachines/javascript/src/service-host.mjs';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';

const source = await fs.readFile(new URL('../examples/http-service.kt', import.meta.url), 'utf8');

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
  ['unavailable scalar library binding', '@HttpGet("/api/a") fun a(): String { val n = 4\n return "n=" + n\n}', /do not yet support scalar library calls/]
]) {
  test(`Kotlin service rejects ${description}`, () => {
    assert.throws(() => compileKotlinToPcode(sourceText, { fileName: 'service.kt' }), expected);
  });
}

test('Kotlin ignores unknown annotations on functions', () => {
  const compiled = compileKotlinToPcode('@Unknown fun main() { println("ok") }', { fileName: 'service.kt' });
  assert.ok(compiled.pcodeText.includes('PUSH_STR "ok"'));
});
