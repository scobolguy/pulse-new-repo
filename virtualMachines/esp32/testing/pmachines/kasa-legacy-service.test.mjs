import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import dgram from 'node:dgram';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { createNetworkBindings } from '../../pmachines/javascript/src/network-bindings.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage, HOSTED_IMAGE_OPCODES } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { parsePcode } from '../../pmachines/javascript/src/runtime.mjs';

function crypt(bytes, decrypt = false) {
  let key = 171;
  return Buffer.from([...bytes].map(byte => {
    const value = key ^ byte;
    key = decrypt ? byte : value;
    return value;
  }));
}
function frame(value) {
  const payload = crypt(Buffer.from(JSON.stringify(value)));
  const header = Buffer.alloc(4);
  header.writeUInt32BE(payload.length);
  return Buffer.concat([header, payload]);
}
const source = await fs.readFile(new URL('../../src/kasa-legacy-service.pas', import.meta.url), 'utf8');
const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });

test('legacy Kasa Pascalish cipher, framing, status, discovery and relay actions', async t => {
  let state = 0;
  let relayError = 0;
  let model = 'HS200(US)';
  let clock = 1000;
  const sysinfo = () => ({
    err_code: 0, alias: 'Fixture', model, relay_state: state,
    mac: '00:11:22:33:44:55', latitude: 43.8, longitude: -79.4,
    sw_ver: 'fixture firmware', deviceId: 'private-device-id'
  });
  const commands = [];
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let input = Buffer.alloc(0);
    socket.on('data', chunk => {
      input = Buffer.concat([input, chunk]);
      if (input.length < 4 || input.length < input.readUInt32BE(0) + 4) return;
      assert.equal(input.length, input.readUInt32BE(0) + 4);
      const command = JSON.parse(crypt(input.subarray(4), true));
      commands.push(command);
      let response;
      if (command.system.get_sysinfo) {
        response = { system: { get_sysinfo: sysinfo() } };
      } else {
        if (!relayError) state = command.system.set_relay_state.state;
        response = { system: { set_relay_state: { err_code: relayError } } };
      }
      const bytes = frame(response);
      socket.write(bytes.subarray(0, 2));
      setTimeout(() => socket.end(bytes.subarray(2)), 5);
    });
  });
  await new Promise(resolve => server.listen(9999, '127.0.0.1', resolve));
  t.after(() => { for (const socket of sockets) socket.destroy(); return new Promise(resolve => server.close(resolve)); });
  const udp = dgram.createSocket('udp4');
  await new Promise(resolve => udp.bind(9999, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => udp.close(resolve)));
  udp.on('message', (bytes, peer) => {
    assert.deepEqual(JSON.parse(crypt(bytes, true)), { system: { get_sysinfo: {} } });
    udp.send(crypt(Buffer.from(JSON.stringify({ system: { get_sysinfo: sysinfo() } }))), peer.port, peer.address);
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'kasa-test', httpPort: null, udpPort: 0,
    networkPeers: [{ ip: '127.0.0.1', port: 9999 }], maxExecutionMs: 8000,
    bindings: { 'host.observation_ttl': () => 180000 },
    clock: () => clock,
    logger: { warn() {}, error() {} }
  });
  await host.start();
  t.after(() => host.stop());
  const get = path => host.dispatch({ method: 'GET', path, query: { ip: '127.0.0.1' } });
  const action = value => host.dispatch({ method: 'POST', path: '/api/kasa/action',
    body: JSON.stringify({ ip: '127.0.0.1', action: value }) });
  const status = await get('/api/kasa/status');
  assert.equal(status.body.device?.relay_state, 0, JSON.stringify(status));
  assert.deepEqual(status.body.device, {
    deviceName: 'Fixture', ipAddress: '127.0.0.1', deviceType: 'wallSwitch', relay_state: 0
  });
  const descriptor = { deviceName: 'Fixture', ipAddress: '127.0.0.1', deviceType: 'wallSwitch' };
  assert.deepEqual((await get('/api/kasa/discover')).body, descriptor);
  for (const [nextModel, deviceType] of [
    ['KS200(US)', 'wallSwitch'], ['HS100', 'smartPlug'], ['KP115', 'smartPlug'],
    ['KP400', 'smartPlug'], ['EP10', 'smartPlug'], ['EP25', 'smartPlug'], ['EP40', 'smartPlug'],
    ['KL130', 'unknown'], ['X', 'unknown']
  ]) {
    model = nextModel;
    assert.deepEqual((await get('/api/kasa/discover')).body, { ...descriptor, deviceType });
  }
  model = 'HS200(US)';
  assert.equal((await action('on')).body.device.relay_state, 1);
  assert.equal((await action('off')).body.device.relay_state, 0);
  assert.equal((await action('toggle')).body.device.relay_state, 1);
  const before = commands.length;
  assert.equal((await action('invalid')).status, 400);
  assert.equal(commands.length, before);
  relayError = -1;
  assert.equal((await action('off')).status, 502);
  assert.equal(state, 1);
  const devices = await host.dispatch({ method: 'GET', path: '/api/kasa/devices', query: {} });
  assert.deepEqual(devices.body, { nodes: [descriptor], continuation: 'end', nextCursor: '' });
  assert.ok(Buffer.byteLength(JSON.stringify(devices.body.nodes[0])) < 100);
  await assert.rejects(host.dispatch({ method: 'GET', path: '/api/kasa/status', query: { ip: '127.0.0.2' } }),
    /Network peer is not allowed/);
  clock += 180001;
  const expired = await host.dispatch({ method: 'GET', path: '/api/kasa/devices', query: {} });
  assert.deepEqual(expired.body, { nodes: [], continuation: 'end', nextCursor: '' });
});

test('generic byte bindings validate indexes and capacities', () => {
  const bindings = createNetworkBindings();
  assert.equal(bindings['host.bytes_from_text']('ABC'), '414243');
  assert.equal(bindings['host.bytes_text']('414243'), 'ABC');
  assert.equal(bindings['host.byte_xor'](171, 123), 208);
  assert.throws(() => bindings['host.bytes_get']('00', 1), /index/);
  assert.throws(() => bindings['host.bytes_length']('0'), /hex/);
  assert.throws(() => bindings['host.bytes_append']('', 256), /byte/);
  assert.throws(() => bindings['host.bytes_slice']('00', 0, 2), /count/);
  assert.equal(bindings['host.bytes_join']('00', 'ff'), '00ff');
  assert.throws(() => createNetworkBindings([{ ip: 'device.local', port: 9999 }]), /IPv4/);
});

test('compact hosted metadata retains only required procedure signatures', () => {
  const map = compactServiceHostProgramMap(compiled.programMap);
  assert.deepEqual(map.procedures.PROC_EXCHANGE, { params: ['address', 'command'] });
  assert.ok(JSON.stringify(map).length < 1200);
  const image = encodeHostedImage(compiled.pcodeText);
  assert.ok(Number.parseInt(image.slice(4, 12), 16) <= 512);
  assert.ok(image.length <= 32768);
});

test('FFS hosted image preserves resolved instructions and deduplicated UTF-8 constants', () => {
  for (const text of [compiled.pcodeText, 'PUSH_STR "café"\nPUSH_STR "café"\nPUSH_INT -2147483648\nHALT']) {
    const image = encodeHostedImage(text);
    assert.equal(image.slice(0, 4), 'PHI1');
    const count = Number.parseInt(image.slice(4, 12), 16);
    const bytes = Number.parseInt(image.slice(12, 20), 16);
    const instructions = parsePcode(text);
    assert.equal(count, instructions.length);
    const pool = Buffer.from(image.slice(20 + count * 24), 'hex');
    assert.equal(pool.length, bytes);
    instructions.forEach((instruction, index) => {
      const record = Buffer.from(image.slice(20 + index * 24, 44 + index * 24), 'hex');
      assert.equal(record[0], HOSTED_IMAGE_OPCODES[instruction.mnemonic]);
      const value = record.readInt32BE(2);
      if (['JMP', 'JZ', 'CALL'].includes(instruction.mnemonic)) assert.equal(value, instruction.targetIndex);
      if (instruction.mnemonic === 'PUSH_INT') assert.equal(value, instruction.operand);
      const constant = pool.subarray(record.readUInt32BE(6),
        record.readUInt32BE(6) + record.readUInt16BE(10)).toString('utf8');
      if (instruction.mnemonic === 'CALL' || instruction.mnemonic === 'CALL_EXT') {
        assert.equal(record[1], instruction.operand.argc);
        assert.equal(constant, instruction.operand.label);
      } else if (typeof instruction.operand === 'string' && !['JMP', 'JZ'].includes(instruction.mnemonic))
        assert.equal(constant, instruction.operand);
    });
    if (text !== compiled.pcodeText) assert.equal(bytes, Buffer.byteLength('café'));
  }
  assert.throws(() => encodeHostedImage('JMP missing\nHALT'), /branch target/);
  assert.throws(() => encodeHostedImage('CALL_EXT "host.missing" 0\nHALT'), /binding/);
  assert.throws(() => encodeHostedImage('PUSH_INT 2147483648\nHALT'), /integer/);
  assert.throws(() => encodeHostedImage('PRINT\nHALT'), /opcode/);
});

test('single-worker hardware probe preserves sequential action counts and encodes for ESP32', async t => {
  const probeSource = await fs.readFile(new URL('./fixtures/single-worker-probe.pas', import.meta.url), 'utf8');
  const probe = compilePascalishProgramWithAntlr(probeSource, { hostServices: true });
  assert.ok(encodeHostedImage(probe.pcodeText).startsWith('PHI1'));
  const host = await createPascalishServiceHost({
    compiled: probe, collectorId: 'worker-probe', httpPort: null, udpPort: 0,
    bindings: { 'host.observation_ttl': () => 180000 }
  });
  await host.start();
  t.after(() => host.stop());
  for (let count = 1; count <= 3; count++) {
    const result = await host.dispatch({ method: 'GET', path: '/health', query: {} });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { count });
  }
  const result = await host.dispatch({ method: 'GET', path: '/api/discovery/snapshot', query: {} });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { count: 3 });
});

test('generic TCP exchange rejects malformed frames, timeout and cancellation', async t => {
  let mode = 'oversized';
  const sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('data', () => {
      if (mode === 'oversized') socket.end(Buffer.from('00001000', 'hex'));
      if (mode === 'truncated') socket.end(Buffer.from('00000002ff', 'hex'));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { for (const socket of sockets) socket.destroy(); return new Promise(resolve => server.close(resolve)); });
  const port = server.address().port;
  const bindings = createNetworkBindings([{ ip: '127.0.0.1', port }]);
  const exchange = signal => bindings['host.tcp_exchange']('127.0.0.1', port, '00', 4,
    mode === 'timeout' ? 50 : 1000, 64, { signal });
  await assert.rejects(exchange(new AbortController().signal), /Invalid TCP frame length/);
  mode = 'truncated';
  await assert.rejects(exchange(new AbortController().signal), /Incomplete TCP frame/);
  mode = 'timeout';
  await assert.rejects(exchange(new AbortController().signal), /timeout/);
  const abort = new AbortController();
  const pending = exchange(abort.signal);
  abort.abort();
  await assert.rejects(pending, /cancelled/);
});

test('generic UDP exchange rejects oversized replies and missing replies', async t => {
  const socket = dgram.createSocket('udp4');
  await new Promise(resolve => socket.bind(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => socket.close(resolve)));
  let respond = true;
  socket.on('message', (data, peer) => {
    if (respond) socket.send(Buffer.alloc(65), peer.port, peer.address);
  });
  const port = socket.address().port;
  const bindings = createNetworkBindings([{ ip: '127.0.0.1', port }]);
  const exchange = () => bindings['host.udp_exchange']('127.0.0.1', port, '00', respond ? 1000 : 50, 64,
    { signal: new AbortController().signal });
  await assert.rejects(exchange(), /capacity/);
  respond = false;
  await assert.rejects(exchange(), /timeout/);
});
