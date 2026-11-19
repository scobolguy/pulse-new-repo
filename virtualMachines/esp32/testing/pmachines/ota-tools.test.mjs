import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createEnvelope, envelope } from '../../scripts/ota-sign-release.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..', '..');

test('release envelopes sign target, pair, version, length and payload digest', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const payload = Buffer.from('small boot image fixture');
  const result = createEnvelope(payload, {
    kind: 'bootfs',
    board: 'esp32s3-pm-n8',
    runtimeAbi: 'pm-abi-1',
    pairId: 'bundle-42',
    version: 42,
    privateKey,
  });

  assert.equal(result.toString('ascii', 0, 4), 'POTA');
  assert.equal(result[4], 1);
  assert.equal(result[5], envelope.kinds.bootfs);
  assert.equal(result.readUInt32BE(56), 42);
  assert.equal(result.readUInt32BE(60), payload.length);
  assert.deepEqual(result.subarray(64, 96), createHash('sha256').update(payload).digest());

  const signedInput = Buffer.concat([envelope.domain, result.subarray(0, 96)]);
  const key = createPublicKey(publicKey);
  assert.equal(verify('RSA-SHA256', signedInput, key,
    result.subarray(envelope.headerSize, envelope.headerSize + envelope.signatureSize)), true);

  result[40] ^= 1;
  assert.equal(verify('RSA-SHA256', Buffer.concat([envelope.domain, result.subarray(0, 96)]),
    key, result.subarray(envelope.headerSize, envelope.headerSize + envelope.signatureSize)), false);
  const changedPayload = Buffer.from(result.subarray(envelope.headerSize + envelope.signatureSize));
  changedPayload[0] ^= 1;
  assert.notDeepEqual(createHash('sha256').update(changedPayload).digest(), result.subarray(64, 96));
});

test('bootFS image contains only the local boot closure', (t) => {
  const output = path.join(project, '.pio', `ota-bootfs-test-${process.pid}.bin`);
  const script = path.join(project, 'scripts', 'buildbootfs.mjs');
  const imageTool = process.env.PIO_MKLITTLEFS ||
    path.join(process.env.USERPROFILE || '', '.platformio', 'packages', 'tool-mklittlefs',
      process.platform === 'win32' ? 'mklittlefs.exe' : 'mklittlefs');
  if (!existsSync(imageTool)) {
    t.skip('mklittlefs is not installed');
    return;
  }

  try {
    execFileSync(process.execPath, [
      script, '--profile', 'n8', '--pair-id', 'bundle-test42', '--out', output,
    ], { cwd: project, stdio: 'pipe' });
    assert.equal(existsSync(output), true);
    const listing = execFileSync(imageTool, [
      '-l', '-p', '256', '-b', '4096', '-s', String(0x50000), output,
    ], { encoding: 'utf8' });
    assert.match(listing, /boot\/pmachine-boot/);
    assert.match(listing, /boot\/pmachine-provisioning/);
    assert.match(listing, /boot\/ota-pair-id/);
    assert.match(listing, /web\/provisioning\.html/);
    assert.doesNotMatch(listing, /payments|legacy|data\/web/i);
  } finally {
    rmSync(output, { force: true });
  }
});
