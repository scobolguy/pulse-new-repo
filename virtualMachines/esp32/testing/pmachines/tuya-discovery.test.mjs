import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createCipheriv, createHash } from 'node:crypto';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { createNetworkBindings } from '../../pmachines/javascript/src/network-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';

const compiled = compilePascalishProgramWithAntlr(
  await fs.readFile(new URL('../../src/tuya-discovery-service.pas', import.meta.url), 'utf8'),
  { hostServices: true });
const key = createHash('md5').update('yGAdlopoPVldABfn').digest();
const bindings = createNetworkBindings();
function packet(kind, id) {
  const json = Buffer.from(JSON.stringify({ gwId: id, ip: '192.168.2.99', version: '3.3' }));
  if (kind === 'ecb') {
    const cipher = createCipheriv('aes-128-ecb', key, null);
    const encrypted = Buffer.concat([cipher.update(json), cipher.final()]);
    const header = Buffer.alloc(20);
    header.writeUInt32BE(0x55aa, 0);
    header.writeUInt32BE(19, 8);
    header.writeUInt32BE(encrypted.length + 12, 12);
    const frame = Buffer.concat([header, encrypted]);
    return Buffer.concat([frame, Buffer.from(bindings['host.bytes_crc32'](frame.toString('hex')), 'hex'),
      Buffer.from('0000aa55', 'hex')]);
  }
  const header = Buffer.alloc(18);
  header.writeUInt32BE(0x6699, 0);
  header.writeUInt32BE(19, 10);
  header.writeUInt32BE(json.length + 4 + 12 + 16, 14);
  const nonce = Buffer.from('012345678901');
  const cipher = createCipheriv('aes-128-gcm', key, nonce);
  cipher.setAAD(header.subarray(4));
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([Buffer.alloc(4), json])), cipher.final()]);
  return Buffer.concat([header, nonce, encrypted, cipher.getAuthTag(), Buffer.from('00009966', 'hex')]);
}
async function host(t) {
  const instance = await createPascalishServiceHost({
    compiled, collectorId: 'tuya-discovery', httpPort: null, udpPort: 0,
    bindings: { 'host.observation_ttl': () => 180000 }
  });
  await instance.start();
  t.after(() => instance.stop());
  return instance;
}
const dispatch = (instance, bytes) => instance.dispatch({
  method: 'POST', path: '/events/udp', bytes, peer: '192.168.2.14', body: ''
});
const devices = instance => instance.dispatch({ method: 'GET', path: '/api/tuya/devices', query: {} });

test('Tuya service fits the signed ESP32 image instruction ceiling', () => {
  const image = encodeHostedImage(compiled.pcodeText);
  assert.ok(Number.parseInt(image.slice(4, 12), 16) <= 512);
});

test('Tuya Pascalish discovery decodes ECB and authenticated GCM, uses source IP and deduplicates', async t => {
  const instance = await host(t);
  for (const kind of ['ecb', 'gcm']) {
    assert.equal((await dispatch(instance, packet(kind, 'device-abcdef'))).status, 200);
  }
  const result = await devices(instance);
  assert.deepEqual(result.body.nodes, [{
    deviceId: 'device-abcdef', deviceName: 'Tuya abcdef',
    ipAddress: '192.168.2.14', deviceType: 'unknown'
  }]);
});

test('Tuya discovery rejects truncation, length, suffix, command, CRC and authentication failures without storing', async t => {
  const instance = await host(t);
  const frame = packet('ecb', 'device-abcdef');
  const malformed = [frame.subarray(0, 12)];
  for (const offset of [0, 8, 15, frame.length - 8, frame.length - 1]) {
    const copy = Buffer.from(frame); copy[offset] ^= 1; malformed.push(copy);
  }
  for (const bytes of malformed) assert.equal((await dispatch(instance, bytes)).status, 400);
  const gcm = packet('gcm', 'device-abcdef');
  gcm[gcm.length - 20] ^= 1;
  await assert.rejects(dispatch(instance, gcm), /authenticate|authentication|Unsupported state/i);
  assert.deepEqual((await devices(instance)).body.nodes, []);
});

test('generic crypto bindings validate CRC, padding, hex and AES argument sizes', () => {
  assert.equal(bindings['host.bytes_crc32'](Buffer.from('123456789').toString('hex')), 'cbf43926');
  assert.throws(() => bindings['host.bytes_crc32']('zz'), /hex/);
  assert.throws(() => bindings['host.bytes_aes_ecb_decrypt']('00', key.toString('hex')), /ciphertext/);
  assert.throws(() => bindings['host.bytes_aes_gcm_decrypt']('', key.toString('hex'), '', '', ''), /nonce/);
});

test('Tuya discovery pages observations two at a time without loss', async t => {
  const instance = await host(t);
  for (let index = 0; index < 7; index++) {
    await dispatch(instance, packet('ecb', `device-abcde${index}`));
  }
  let cursor = '';
  const ids = [];
  do {
    const result = await instance.dispatch({
      method: 'GET', path: '/api/tuya/devices', query: { cursor }
    });
    assert.ok(result.body.nodes.length <= 2);
    ids.push(...result.body.nodes.map(node => node.deviceId));
    cursor = result.body.continuation === 'continue' ? result.body.nextCursor : '';
  } while (cursor);
  assert.equal(new Set(ids).size, 7);
  assert.equal(ids.length, 7);
});
