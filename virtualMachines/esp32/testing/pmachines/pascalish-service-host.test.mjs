import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import fs from 'node:fs/promises';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { runPcodeOnEsp32 } from '../../aggregator/scripts/run-pascal-on-esp32-node.mjs';
import { createDiscoveryProvider } from '../../aggregator/src/backend/modules/discoveryProvider.mjs';
import { createPascalishDiscoveryCollector } from '../../pmachines/javascript/discovery-collector.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { executeProgram, parsePcode } from '../../pmachines/javascript/src/runtime.mjs';
import { loadOpcodeMap } from '../../pmachines/javascript/src/opcodes.mjs';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';

const logger = { warn() {}, error() {}, log() {} };
const compile = source => compilePascalishProgramWithAntlr(source, { hostServices: true });
const service = body => compile(`service 'test'; get '/run'; begin ${body} end end.`);
const event = (path, body = '', method = 'GET') => ({ method, path, body, peer: '127.0.0.1' });
const node = id => ({ nodeId: id, ip: '127.0.0.1', port: 4111, runtime: 'javascript', services: ['pmachine'] });
const announce = (host, id) => host.dispatch(event('/api/pmachine/announce', JSON.stringify(node(id)), 'POST'));
const snapshot = async host => (await host.dispatch(event('/api/discovery/snapshot'))).body;
const origin = host => `http://127.0.0.1:${host.getStatus().httpPort}`;

async function collector(t, options = {}) {
  const host = await createPascalishDiscoveryCollector({
    httpPort: 0,
    udpPort: 0,
    logger,
    ...options
  });
  t.after(() => host.stop());
  await host.start();
  return host;
}

async function genericHost(t, compiled, options = {}) {
  const host = await createPascalishServiceHost({ compiled, collectorId: 'test', httpPort: 0, udpPort: 0, logger, ...options });
  t.after(() => host.stop());
  await host.start();
  return host;
}

async function udp(t) {
  const socket = dgram.createSocket('udp4');
  await new Promise(resolve => socket.bind(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => socket.close(resolve)));
  return socket;
}

async function udpReply(socket, host, body) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.removeListener('message', receive); reject(new Error('UDP reply timed out')); }, 2000);
    const receive = data => { clearTimeout(timeout); resolve(JSON.parse(data)); };
    socket.once('message', receive);
    socket.send(JSON.stringify(body), host.getStatus().udpPort, '127.0.0.1', error => {
      if (error) { clearTimeout(timeout); socket.removeListener('message', receive); reject(error); }
    });
  });
}

async function runEmitProof(target) {
  const source = await fs.readFile(new URL('../../artifactPrograms/pascalish-emit-proof.pas', import.meta.url), 'utf8');
  const compiled = compilePascalishProgramWithAntlr(source);
  for (const [file, body] of [['/proof.pcode', compiled.pcodeText], ['/proof.program.json', JSON.stringify(compiled.programMap)]]) {
    const upload = await fetch(`${target}/ffs/upload`, {
      method: 'POST', body: new URLSearchParams({ file, body }), signal: AbortSignal.timeout(5000)
    });
    assert.equal(upload.status, 200);
    assert.equal(await upload.text(), 'File uploaded');
  }
  const execution = await fetch(`${target}/pmachine/execute_file`, {
    method: 'POST', body: new URLSearchParams({ file: '/proof.pcode', programMap: '/proof.program.json' }),
    signal: AbortSignal.timeout(10000)
  });
  assert.equal(execution.status, 200);
  const result = await execution.json();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.stepLimitHit, false);
  assert.deepEqual(result.stdout, ['done']);
  assert.deepEqual(result.deliveries.map(value => [value.queueName, value.message]), [['metrics.out', '42'], ['events.out', '7']]);
}

async function launchProcess(t, script, args, env, readyPattern) {
  const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), ...args], {
    env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  const stopped = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  const destroy = async () => {
    if (child.exitCode == null && child.signalCode == null) child.kill();
    await stopped;
  };
  t.after(destroy);
  let output = '';
  let errors = '';
  const match = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Process startup timeout: ${output}\n${errors}`)), 10000);
    child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-65536); });
    child.stdout.on('data', chunk => {
      output = (output + chunk).slice(-65536);
      const ready = readyPattern.exec(output);
      if (ready) { clearTimeout(timeout); resolve(ready); }
    });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Process exited (${code}): ${errors}`)); });
  });
  return { destroy, match };
}

test('real HTTP service responds with protocol v1 and never renews observations on polling', async t => {
  let time = 1000;
  const host = await collector(t, { clock: () => time, collectorId: 'collector-a' });
  const response = await fetch(`${origin(host)}/api/pmachine/announce`, { method: 'POST', body: JSON.stringify(node('js-1')) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
  const first = await snapshot(host);
  assert.equal(first.protocolVersion, 1);
  assert.equal(first.collectorId, 'collector-a');
  assert.equal(first.bootId, host.getStatus().bootId);
  assert.equal(first.nodes[0].remainingTtlMs, 180000);
  assert.equal(first.nodes[0].details.runtime, 'javascript');
  assert.equal(first.nodes[0].details.services[0].name, 'pmachine');
  time += 179999;
  const secondResponse = await fetch(`${origin(host)}/api/discovery/snapshot`);
  assert.equal(secondResponse.headers.get('cache-control'), 'no-store');
  const second = await secondResponse.json();
  assert.equal(second.sequence, first.sequence + 1);
  assert.equal(second.nodes[0].remainingTtlMs, 1);
  time += 1;
  assert.deepEqual((await snapshot(host)).nodes, []);
});

test('Pascalish Data Librarian imports compile as a read-only import list', async () => {
  const compiled = compile(`service 'import-test';
import dataTypes, schemas, "pacs.008.001.08" from data librarian;
var paymentMessage: payment;
begin end.`);
  assert.deepEqual(compiled.programMap.librarianImports, [
    { name: 'dataTypes' },
    { name: 'schemas' },
    { name: 'pacs.008.001.08' }
  ]);
  assert.equal(compiled.programMap.localVariableDeclarations[0].dataType.id, 'payment');
  assert.throws(() => compile(`service 'bad-import';
import dataTypes, from data librarian;
begin end.`), /non-empty item list/);

  const collectorSource = await fs.readFile(new URL('../../artifactPrograms/discovery-collector-service.pas', import.meta.url), 'utf8');
  const collector = compile(collectorSource);
  assert.deepEqual(collector.programMap.librarianImports, [{ name: 'dataTypes' }, { name: 'schemas' }]);
});

test('Pascalish compiles dotted record field reads and writes', async () => {
  const compiled = compile(`daemon 'field-access' refresh 1 s;
import payment from data librarian;
var paymentMessage: payment;
begin
  paymentMessage.amount := 42;
  writeln(paymentMessage.amount);
end.`);
  assert.match(compiled.pcodeText, /REC_SET "paymentMessage" "amount"/);
  assert.match(compiled.pcodeText, /REC_GET "paymentMessage" "amount"/);

  const opcodeMap = await loadOpcodeMap();
  const result = await executeProgram({
    instructions: parsePcode(compiled.pcodeText),
    opcodeMap,
    mappingsById: new Map(),
    inputQueue: '',
    sourceMessage: ''
  });
  assert.deepEqual(result.stdout, ['42']);
});

test('discovery collector compilation preserves imports without attaching runtime catalog data', async () => {
  const source = await fs.readFile(new URL('../../artifactPrograms/discovery-collector-service.pas', import.meta.url), 'utf8');
  const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });
  assert.deepEqual(compiled.programMap.librarianImports, [{ name: 'dataTypes' }, { name: 'schemas' }]);
  assert.equal(compiled.programMap.librarianImportData, undefined);
});

test('scheduled Pascalish daemon expires shared tables without a snapshot request', async t => {
  let time = 100;
  const host = await collector(t, { clock: () => time });
  await announce(host, 'board');
  assert.equal(host.getStatus().entries, 1);
  assert.equal(host.getStatus().daemons, 1);
  time += 180000;
  const deadline = Date.now() + 3000;
  while (host.getStatus().entries && Date.now() < deadline) await delay(25);
  assert.equal(host.getStatus().entries, 0);
  assert.equal(host.getStatus().storageBytes, 0);
});

test('UDP beacon produces targeted ACK and control packets do not become nodes or replies', async t => {
  const host = await collector(t);
  const socket = await udp(t);
  await announce(host, 'board');
  const ack = await udpReply(socket, host, { nodeId: 'board', kind: 'nodeBeacon', httpPort: 4111 });
  assert.equal(ack.kind, 'nodeBeaconAck');
  assert.equal(ack.nodeId, 'board');
  assert.equal(ack.collectorId, host.getStatus().collectorId);
  let replies = 0;
  socket.on('message', () => { replies += 1; });
  socket.send(JSON.stringify({ kind: 'nodeBeaconAck', nodeId: 'not-a-node' }), host.getStatus().udpPort, '127.0.0.1');
  await delay(75);
  assert.equal(replies, 0);
  assert.deepEqual((await snapshot(host)).nodes.map(value => value.nodeId), ['board']);
  assert.equal((await snapshot(host)).nodes[0].details.services[0].name, 'pmachine');
});

test('invalid announcements, oversize bodies and private paths produce explicit HTTP failures', async t => {
  const host = await collector(t, { maxBodyBytes: 1024 });
  for (const [body, status] of [['{', 400], [JSON.stringify({ ...node('bad'), port: 0 }), 400], ['x'.repeat(1025), 413]]) {
    const response = await fetch(`${origin(host)}/api/pmachine/announce`, { method: 'POST', body });
    assert.equal(response.status, status);
    assert.ok((await response.json()).error);
  }
  for (const path of ['/missing', '/events/udp', '/events/start']) {
    const response = await fetch(`${origin(host)}${path}`, { method: 'POST', body: '{}' });
    assert.equal(response.status, 404);
    assert.ok((await response.json()).error);
  }
  assert.deepEqual((await snapshot(host)).nodes, []);
});

test('stable IDs retain same-IP nodes and entry overflow does not corrupt existing observations', async t => {
  const host = await collector(t, { maxEntries: 2 });
  await announce(host, 'one');
  await announce(host, 'two');
  await assert.rejects(announce(host, 'three'), /entry capacity/);
  await announce(host, 'one');
  assert.deepEqual((await snapshot(host)).nodes.map(value => value.nodeId), ['one', 'two']);
});

test('Pascalish hosted table declarations are emitted and enforce per-table capacity', async t => {
  const compiled = compile(`service 'declared-table';
    table nodes capacity 1;
    post '/first'; begin host.table_put('nodes', 'one', '{}', 1000); return '{}' end
    post '/second'; begin host.table_put('nodes', 'two', '{}', 1000); return '{}' end
    post '/other'; begin host.table_expire('other'); return '{}' end end.`);
  assert.deepEqual(compiled.programMap.hostTables, [{ name: 'nodes', capacity: 1 }]);
  const host = await genericHost(t, compiled);
  await host.dispatch(event('/first', '', 'POST'));
  await assert.rejects(host.dispatch(event('/second', '', 'POST')), /entry capacity/);
  await assert.rejects(host.dispatch(event('/other', '', 'POST')), /Undeclared table/);
  assert.equal(host.getStatus().entries, 1);
});

test('Pascalish hosted table declarations accept capacity 255', async t => {
  const compiled = compile(`service 'wide-table';
    table nodes capacity 255;
    post '/put'; begin host.table_put('nodes', 'one', '{}', 1000); return '{}' end end.`);
  assert.deepEqual(compiled.programMap.hostTables, [{ name: 'nodes', capacity: 255 }]);
  const host = await genericHost(t, compiled);
  await host.dispatch(event('/put', '', 'POST'));
  assert.equal(host.getStatus().entries, 1);
});

test('hosted table snapshots page five entries with a stable continuation cursor', async t => {
  const compiled = compile(`service 'paged-table';
    table nodes capacity 255;
    post '/put'; begin
      host.table_put('nodes', host.json_text(host.event_body(), 'nodeId'), host.event_body(), 10000);
      return '{}'
    end
    get '/page'; begin
      return host.table_snapshot('nodes', host.event_query('cursor'), 5)
    end end.`);
  const host = await genericHost(t, compiled);
  for (let index = 0; index < 12; index += 1) {
    const entry = node(`node-${String(index).padStart(2, '0')}`);
    await host.dispatch(event('/put', JSON.stringify(entry), 'POST'));
  }
  const first = (await host.dispatch({ ...event('/page'), query: {} })).body;
  assert.equal(first.nodes.length, 5);
  assert.equal(first.continuation, 'continue');
  const second = (await host.dispatch({ ...event('/page'), query: { cursor: first.nextCursor } })).body;
  assert.equal(second.nodes.length, 5);
  assert.equal(second.continuation, 'continue');
  const third = (await host.dispatch({ ...event('/page'), query: { cursor: second.nextCursor } })).body;
  assert.equal(third.nodes.length, 2);
  assert.equal(third.continuation, 'end');
  assert.equal(new Set([...first.nodes, ...second.nodes, ...third.nodes].map(value => value.nodeId)).size, 12);
});

test('storage and response byte budgets fail explicitly', async t => {
  const storageHost = await collector(t, { maxStorageBytes: 1 });
  await assert.rejects(announce(storageHost, 'one'), /storage capacity/);
  assert.equal(storageHost.getStatus().storageBytes, 0);
  const responseHost = await collector(t, { maxResponseBytes: 32 });
  await assert.rejects(snapshot(responseHost), /result capacity/);
  const tableHost = await genericHost(t, service("host.table_expire('one'); host.table_expire('two'); return '{}'"), { maxTables: 1 });
  await assert.rejects(tableHost.dispatch(event('/run')), /Table capacity/);
});

test('finite instruction budget stops a runaway handler and leaves service usable', async t => {
  const compiled = compile(`service 'bounded';
    get '/loop'; begin while true do begin end end
    get '/ok'; begin return '{"status":"ok"}' end end.`);
  const host = await genericHost(t, compiled, { maxSteps: 500 });
  await assert.rejects(host.dispatch(event('/loop')), /instruction limit/);
  assert.deepEqual((await host.dispatch(event('/ok'))).body, { status: 'ok' });
});

test('queue is bounded and queued observations retain ingress time', async t => {
  let time = 0;
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const host = await genericHost(t, service("return host.announcement(host.event_body(), host.event_peer())"), {
    maxEvents: 2, clock: () => time,
    bindings: { 'host.announcement': async () => { await blocked; return '{}'; } }
  });
  const first = host.dispatch(event('/run'));
  const second = host.dispatch(event('/run'));
  await assert.rejects(host.dispatch(event('/run')), /queue full/);
  release();
  await Promise.all([first, second]);
  assert.equal(host.getStatus().pending, 0);
  const expiryHost = await genericHost(t, compile(`service 'expiry';
    get '/block'; begin return host.announcement('', '') end
    post '/put'; begin host.table_put('nodes', 'one', '{}', 10); return '{}' end end.`), {
    clock: () => time,
    bindings: { 'host.announcement': () => { time += 11; return '{}'; } }
  });
  const block = expiryHost.dispatch(event('/block'));
  const queued = expiryHost.dispatch(event('/put', '', 'POST'));
  await block;
  await assert.rejects(queued, /expired before execution/);
  assert.equal(expiryHost.getStatus().entries, 0);
});

test('compiler checks hosted ABI, schedules and endpoint uniqueness without changing legacy artifacts', () => {
  assert.throws(() => service('return host.unknown()'), /Unknown host binding/);
  assert.throws(() => service("return host.clock('bad')"), /requires 0 arguments/);
  assert.throws(() => compile("service 'duplicate'; get '/x'; begin return '' end get '/x'; begin return '' end end."), /Duplicate endpoint/);
  assert.throws(() => compile("daemon 'bad' every 0 ms; begin end."), /constant schedule/);
  assert.throws(() => compile("program 'bad'; begin end."), /requires a service/);
  assert.equal(compile("daemon 'd' every 2 seconds; begin end.").programMap.runtimeUnit.refreshMs, 2000);
  const legacy = compilePascalishProgramWithAntlr("service 'legacy'; get '/health'; begin return 'ok'; end end.");
  assert.equal(legacy.programMap.hostBindingsVersion, undefined);
  assert.equal(legacy.pcodeText.includes('CALL_EXT'), false);
  assert.equal(legacy.programMap.serviceEndpoints[0].returnExpr, "'ok'");
});

test('runtime rejects unavailable, wrong-arity and wrong-result host bindings', async () => {
  const opcodeMap = await loadOpcodeMap();
  const run = (pcode, runtimeContext = {}) => executeProgram({
    instructions: parsePcode(pcode), opcodeMap, mappingsById: new Map(), inputQueue: '', sourceMessage: '', runtimeContext
  });
  await assert.rejects(run('CALL_EXT host.clock 0\nHALT'), /unavailable/);
  await assert.rejects(run('CALL_EXT host.clock 1\nHALT', { callHost: () => 0 }), /Invalid host binding/);
  await assert.rejects(run('CALL_EXT host.clock 0\nHALT', { callHost: () => 'wrong' }), /Invalid host result/);
  await assert.rejects(run('CALL_EXT host.json_text 2\nHALT', { callHost: () => '' }), /stack underflow/);
  await assert.rejects(run('PUSH_INT 1\nPUSH_STR "key"\nCALL_EXT host.json_text 2\nHALT', { callHost: () => '' }), /Invalid host argument/);
  await assert.rejects(run('PUSH_INT 1\nPUSH_INT 2\nPUSH_INT 3\nHALT', { maxStack: 2 }), /stack capacity/);
  await assert.rejects(run('CALL LOOP 0\nHALT\nLOOP:\nCALL LOOP 0\nRET', { maxCallDepth: 1, maxSteps: 20 }), /call depth capacity/);
});

test('timed-out host adapter cannot later mutate tables and queue resumes', async t => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const host = await genericHost(t, compile(`service 'timeout';
    get '/slow'; begin host.announcement('', ''); host.table_put('nodes', 'late', '{}', 1000); return '{}' end
    get '/ok'; begin return '{}' end end.`), {
    maxExecutionMs: 30, bindings: { 'host.announcement': () => blocked }
  });
  await assert.rejects(host.dispatch(event('/slow')), /execution timeout/);
  assert.deepEqual((await host.dispatch(event('/ok'))).body, {});
  release('{}');
  await delay(10);
  assert.equal(host.getStatus().entries, 0);
});

test('daemon cycles coalesce while busy and scheduled errors are logged', async t => {
  let calls = 0;
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const logs = [];
  const daemon = compile("daemon 'tick' every 10 ms; begin host.announcement('', '') end.");
  const host = await genericHost(t, service("return '{}'"), {
    daemons: [daemon], maxExecutionMs: 1000,
    logger: { warn: value => logs.push(value), error: value => logs.push(value) },
    bindings: {
      'host.announcement': async () => {
        calls += 1;
        if (calls === 2) await blocked;
        if (calls >= 3) throw new Error('maintenance failed');
        return '{}';
      }
    }
  });
  await delay(60);
  assert.equal(calls, 2);
  assert.equal(host.getStatus().pending, 1);
  release();
  await delay(40);
  assert.ok(logs.some(value => value.includes('maintenance failed')));
});

test('concurrent startup and shutdown close sockets and cancel pending work', async t => {
  const host = await createPascalishDiscoveryCollector({ httpPort: 0, udpPort: 0, logger });
  t.after(() => host.stop());
  await Promise.all([host.start(), host.start()]);
  assert.ok(host.getStatus().httpPort);
  await Promise.all([host.stop(), host.stop()]);
  assert.equal(host.getStatus().running, false);
  assert.equal(host.getStatus().httpPort, null);
  assert.equal(host.getStatus().udpPort, null);
  const cancelled = await createPascalishDiscoveryCollector({ httpPort: 0, udpPort: 0, logger });
  t.after(() => cancelled.stop());
  const startup = cancelled.start();
  const rejection = assert.rejects(startup, /stopped/);
  await cancelled.stop();
  await rejection;
  assert.equal(cancelled.getStatus().httpPort, null);
});

test('daemon capacity, clock reversal, failed binds and shutdown are explicit and clean', async t => {
  const compiled = service("return '{}'");
  const daemon = compile("daemon 'd' every 1 second; begin end.");
  await assert.rejects(genericHost(t, compiled, { daemons: [daemon, daemon] }), /Duplicate daemon/);
  let time = 10;
  const host = await collector(t, { clock: () => time });
  time -= 1;
  await assert.rejects(snapshot(host), /clock moved backwards/);
  const conflicting = await createPascalishDiscoveryCollector({ httpPort: host.getStatus().httpPort, udpPort: 0, logger });
  t.after(() => conflicting.stop());
  await assert.rejects(conflicting.start(), { code: 'EADDRINUSE' });
  assert.equal(conflicting.getStatus().running, false);
  await host.stop();
  assert.equal(host.getStatus().timers, 0);
  assert.equal(host.getStatus().entries, 0);
  await assert.rejects(snapshot(host), /stopped/);
  await assert.rejects(host.start(), /cannot be restarted/);
});

test('two real Pascalish collectors feed remote Aggregator and fail over without renewing stale presence', async t => {
  let time = 1000;
  const a = await collector(t, { collectorId: 'a', clock: () => time });
  const b = await collector(t, { collectorId: 'b', clock: () => time });
  const provider = createDiscoveryProvider({
    config: { mode: 'remote', collectorUrls: [origin(a), origin(b)], timeoutMs: 1000, pollIntervalMs: 60000 },
    discoveredNodes: new Map(), now: () => time, wallNow: () => 1000000 + time, logger,
    createLocalRuntime: () => { throw new Error('Remote mode must not open local discovery'); }
  });

  t.after(() => provider.stop());
  await provider.announce(node('shared'));
  await provider.refresh();
  assert.equal(provider.getStatus().status, 'healthy');
  assert.equal(provider.getNodes().length, 1);
  await a.stop();
  time += 100000;
  await provider.refresh();
  assert.equal(provider.getStatus().status, 'degraded');
  assert.equal(provider.getNodes()[0].discovery.remainingTtlMs, 80000);
  time += 80000;
  await provider.refresh();
  assert.deepEqual(provider.getNodes(), []);
});

test('short real-time TTL exceeds UDP heartbeat period, keeps active nodes and expires stopped senders', async t => {
  const announcementIntervalMs = 100;
  const observationTtlMs = 1500;
  const host = await collector(t, { announcementIntervalMs, observationTtlMs });
  const socket = await udp(t);
  const beacon = { ...node('udp-live-proof'), kind: 'nodeBeacon' };
  await udpReply(socket, host, beacon);
  let sent = 1;
  const heartbeat = setInterval(() => {
    socket.send(JSON.stringify(beacon), host.getStatus().udpPort, '127.0.0.1');
    sent += 1;
  }, announcementIntervalMs);
  t.after(() => clearInterval(heartbeat));
  await delay(observationTtlMs + 200);
  assert.ok(sent >= 3);
  const active = (await snapshot(host)).nodes;
  assert.equal(active[0]?.nodeId, 'udp-live-proof');
  assert.ok(active[0].remainingTtlMs > 0 && active[0].remainingTtlMs <= observationTtlMs);
  clearInterval(heartbeat);
  await delay(observationTtlMs + 100);
  assert.deepEqual((await snapshot(host)).nodes, []);
});

test('test TTL rejects values at or below the announced heartbeat interval', async () => {
  for (const observationTtlMs of [99, 100, 180001]) {
    await assert.rejects(createPascalishDiscoveryCollector({ observationTtlMs, announcementIntervalMs: 100 }),
      /longer than the announcement interval/);
  }
});

test('create real JS PMachine, discover it, upload/run the emit proof over HTTP, destroy it and expire presence', async t => {
  let time = 1000;
  const host = await collector(t, { clock: () => time });
  const machine = createJsPmachineNodeServer({
    name: 'service-host-proof-node', backendUrl: origin(host), announceIntervalMs: 60000, logger
  });
  const destroy = async () => {
    if (!machine.listening) return;
    machine.closeAllConnections();
    await new Promise((resolve, reject) => machine.close(error => error ? reject(error) : resolve()));
  };
  t.after(destroy);
  await new Promise((resolve, reject) => {
    machine.once('error', reject);
    machine.listen(0, '127.0.0.1', () => { machine.removeListener('error', reject); resolve(); });
  });
  const target = `http://127.0.0.1:${machine.address().port}`;
  assert.equal((await (await fetch(`${target}/status`)).json()).runtime, 'js-pmachine');
  const deadline = Date.now() + 3000;
  while (!(await snapshot(host)).nodes.length && Date.now() < deadline) await delay(10);
  const presence = (await snapshot(host)).nodes[0];
  assert.equal(presence.nodeId, 'service-host-proof-node');
  assert.equal(presence.port, machine.address().port);
  await runEmitProof(target);
  await destroy();
  await assert.rejects(fetch(`${target}/status`, { signal: AbortSignal.timeout(1000) }), /fetch failed/);
  time += 180000;
  assert.deepEqual((await snapshot(host)).nodes, []);
});

test('direct JS PMachine installs and serves the hosted discovery collector', async t => {
  const servicePath = fileURLToPath(new URL('../../artifactPrograms/discovery-collector-service.pas', import.meta.url));
  const daemonPath = fileURLToPath(new URL('../../artifactPrograms/discovery-maintenance-daemon.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(servicePath, 'utf8'), {
    fileName: servicePath, hostServices: true,
  });
  const daemon = compilePascalishProgramWithAntlr(await fs.readFile(daemonPath, 'utf8'), {
    fileName: daemonPath, hostServices: true,
  });
  const machine = createJsPmachineNodeServer({ name: 'hosted-service-direct-proof', logger });
  t.after(async () => {
    if (machine.listening) {
      await fetch(`http://127.0.0.1:${machine.address().port}/pmachine/service_host/stop`, { method: 'POST' }).catch(() => {});
    }
    if (!machine.listening) return;
    machine.closeAllConnections();
    await new Promise((resolve, reject) => machine.close(error => error ? reject(error) : resolve()));
  });
  await new Promise((resolve, reject) => {
    machine.once('error', reject);
    machine.listen(0, '127.0.0.1', () => { machine.removeListener('error', reject); resolve(); });
  });
  const target = `127.0.0.1:${machine.address().port}`;
  const install = await runPcodeOnEsp32({
    pcodeText: compiled.pcodeText,
    programMap: compiled.programMap,
    daemonPcodeText: daemon.pcodeText,
    daemonProgramMap: daemon.programMap,
    node: target,
    sourceFileName: servicePath,
  });
  assert.equal(install.hosted, true);
  assert.equal(install.result.running, true);
  assert.ok(install.result.udpPort > 0);

  const healthResponse = await fetch(`http://${target}/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {
    status: 'ok', role: 'discovery-collector', protocolVersion: 1, runtime: 'pascalish-hosted',
  });

  const announceResponse = await fetch(`http://${target}/api/pmachine/announce`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nodeId: 'direct-hosted-proof', nodeName: 'direct-hosted-proof', ip: '192.0.2.7', port: 4123 }),
  });
  assert.equal(announceResponse.status, 200);
  const snapshotResponse = await fetch(`http://${target}/api/discovery/snapshot`);
  const snapshotBody = await snapshotResponse.json();
  assert.equal(snapshotBody.nodes[0]?.nodeId, 'direct-hosted-proof');

  const serviceStatus = await (await fetch(`http://${target}/pmachine/service_host/status`)).json();
  assert.equal(serviceStatus.running, true);
  await runEmitProof(`http://${target}`);
  const stopped = await fetch(`http://${target}/pmachine/service_host/stop`, { method: 'POST' });
  assert.equal(stopped.status, 200);
  assert.equal((await (await fetch(`http://${target}/pmachine/service_host/status`)).json()).running, false);
});

test('separate OS-process collector and PMachine boot, announce, run proof and are destroyed', async t => {
  const collectorProcess = await launchProcess(t, '../../pmachines/javascript/discovery-collector.mjs', [], {
    DISCOVERY_HOST: '127.0.0.1', DISCOVERY_HTTP_PORT: '0', UDP_PORT: '0',
    PULSE_DISCOVERY_COLLECTOR_ID: 'process-proof-collector'
  }, /httpPort:\s*(\d+)/);
  const collectorOrigin = `http://127.0.0.1:${collectorProcess.match[1]}`;
  const machine = await launchProcess(t, '../../pmachines/javascript/server.mjs', [
    '--port', '0', '--host', '127.0.0.1', '--name', 'process-proof-node',
    '--backend', collectorOrigin, '--advertise-host', '127.0.0.1'
  ], {}, /listening on (http:\/\/127\.0\.0\.1:\d+)/);
  const target = machine.match[1];
  const status = await (await fetch(`${target}/status`)).json();
  assert.equal(status.nodeName, 'process-proof-node');
  assert.equal(status.port, Number(new URL(target).port));
  let nodes = [];
  const deadline = Date.now() + 3000;
  while (!nodes.length && Date.now() < deadline) {
    nodes = (await (await fetch(`${collectorOrigin}/api/discovery/snapshot`)).json()).nodes;
    if (!nodes.length) await delay(20);
  }
  assert.equal(nodes[0]?.nodeId, 'process-proof-node');
  assert.equal(nodes[0]?.port, status.port);
  await runEmitProof(target);
  await machine.destroy();
  await assert.rejects(fetch(`${target}/status`, { signal: AbortSignal.timeout(1000) }), /fetch failed/);
  await collectorProcess.destroy();
  await assert.rejects(fetch(`${collectorOrigin}/health`, { signal: AbortSignal.timeout(1000) }), /fetch failed/);
});
