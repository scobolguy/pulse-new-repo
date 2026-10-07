import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import Ajv from 'ajv';
import { descriptorFilename, descriptorSchemaUrl, registerDeviceDescriptor } from './register-device-descriptor.mjs';
import { buildPascalishLibrarianContracts } from '../src/librarianSchemaContracts.js';

const schema = JSON.parse(await fs.readFile(descriptorSchemaUrl, 'utf8'));

test('vendor-neutral descriptor schema accepts only compact IPv4 device identities', () => {
  const ajv = new Ajv();
  ajv.addFormat('ipv4', value => new RegExp(schema.properties.ipAddress.pattern).test(value));
  const validate = ajv.compile(schema);
  for (const example of schema.examples) assert.equal(validate(example), true, JSON.stringify(validate.errors));
  assert.equal(validate({ deviceName: '', ipAddress: '0.0.0.0', deviceType: 'unknown' }), true);
  const valid = schema.examples[0];
  for (const invalid of [
    { ...valid, relay_state: 1 }, { ...valid, mac: 'vendor-specific' },
    { ...valid, deviceType: 'HS200' }, { ...valid, deviceType: 'switch' },
    { ...valid, ipAddress: 'device.local' }, { ...valid, ipAddress: '256.1.2.3' },
    { ...valid, ipAddress: '192.168.002.28' }, { ...valid, ipAddress: '::1' },
    { ...valid, deviceName: 'x'.repeat(257) },
    { deviceName: 'Bedroom', ipAddress: '192.168.2.28' }
  ]) assert.equal(validate(invalid), false, JSON.stringify(invalid));
});

test('descriptor registers idempotently and exposes Pascalish librarian fields', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-device-descriptor-'));
  const portServer = net.createServer();
  await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
  const port = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  const child = spawn(process.execPath, ['data-librarian.mjs'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, LIBRARIAN_DATA_ROOT: root, LIBRARIAN_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await exited;
    }
    await fs.rm(root, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 300; attempt++) {
    assert.equal(child.exitCode, null, logs);
    try {
      ready = (await fetch(`${origin}/api/librarian/data-types`, { signal: AbortSignal.timeout(1000) })).ok;
    } catch (error) {
      if (error.cause?.code !== 'ECONNREFUSED' && error.name !== 'TimeoutError') throw error;
    }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, logs);
  const registered = await registerDeviceDescriptor(origin);
  assert.equal(registered.version, 1);
  await registerDeviceDescriptor(origin);
  const { types } = await (await fetch(`${origin}/api/librarian/data-types`)).json();
  assert.equal(types.filter(type => type.id === 'device-descriptor').length, 1);
  const { schemas } = await (await fetch(`${origin}/api/librarian/schemas`)).json();
  assert.equal(schemas.filter(item => item.path === descriptorFilename).length, 1);
  const contracts = buildPascalishLibrarianContracts(types, schemas);
  assert.deepEqual(contracts.typeFieldMap['device-descriptor'], ['deviceName', 'deviceType', 'ipAddress']);
  const storedPath = path.join(root, 'services', 'librarian', 'schemas', descriptorFilename);
  const incompatible = { ...schema, additionalProperties: true };
  await fs.writeFile(storedPath, JSON.stringify(incompatible));
  await assert.rejects(registerDeviceDescriptor(origin), /publish a new version/);
  assert.deepEqual(JSON.parse(await fs.readFile(storedPath, 'utf8')), incompatible);
});
