import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPmachineBundleStore } from '../../aggregator/src/backend/modules/pmachineBundleStore.mjs';

const encoded = value => Buffer.from(value).toString('base64');

test('program bundle installation validates and atomically activates support files', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-programs-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = createPmachineBundleStore(root);
  const manifest = await store.install({
    name: 'payment-service',
    manifest: {
      name: 'payment-service', version: '1.0.0', type: 'service', serviceIndex: 2,
      entry: 'program.pcode', programMap: 'program.map.json'
    },
    files: [
      { path: 'program.pcode', base64: encoded('PUSH_INT 1') },
      { path: 'program.map.json', base64: encoded('{"version":1}') },
      { path: 'support/schema.json', base64: encoded('{}') }
    ]
  });
  assert.equal(manifest.name, 'payment-service');
  assert.equal(manifest.serviceIndex, 2);
  assert.equal((await store.read('payment-service')).version, '1.0.0');
  const stagingEntries = await fs.readdir(path.join(root, 'staging'));
  assert.deepEqual(stagingEntries, []);
});

test('program bundle installation rejects traversal and incomplete entries', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-programs-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = createPmachineBundleStore(root);
  const base = {
    name: 'bad', version: '1', type: 'resident', entry: 'program.pcode',
    programMap: 'program.map.json'
  };
  await assert.rejects(store.install({
    name: 'bad', manifest: base,
    files: [
      { path: '../escape', base64: encoded('bad') },
      { path: 'program.pcode', base64: encoded('ok') },
      { path: 'program.map.json', base64: encoded('{}') }
    ]
  }), /Invalid bundle path/);
  await assert.rejects(store.install({
    name: 'bad', manifest: base,
    files: [{ path: 'support.txt', base64: encoded('missing entry') }]
  }), /Manifest entry is missing/);
});

test('daemon bundle requires its paired hosted service artifacts', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-programs-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = createPmachineBundleStore(root);
  const manifest = {
    name: 'payment-daemon', version: '1.0.0', type: 'daemon', serviceIndex: 3,
    entry: 'daemon.pcode', programMap: 'daemon.map.json',
    serviceEntry: 'service.pcode', serviceProgramMap: 'service.map.json'
  };
  await assert.rejects(store.install({
    name: manifest.name,
    manifest,
    files: [
      { path: manifest.entry, base64: encoded('daemon') },
      { path: manifest.programMap, base64: encoded('{}') }
    ]
  }), /service entry and program map must be included/);
  const installed = await store.install({
    name: manifest.name,
    manifest,
    files: [
      { path: manifest.entry, base64: encoded('daemon') },
      { path: manifest.programMap, base64: encoded('{}') },
      { path: manifest.serviceEntry, base64: encoded('service') },
      { path: manifest.serviceProgramMap, base64: encoded('{}') }
    ]
  });
  assert.equal(installed.serviceEntry, 'service.pcode');
  assert.equal(installed.udpPort, 0);
});
