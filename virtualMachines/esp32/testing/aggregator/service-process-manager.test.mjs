import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { createServiceProcessManager } from '../../aggregator/src/backend/modules/serviceProcessManager.mjs';

test('manager executes Pascalish dependency order, deduplicates starts and keeps blocked children alive', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-lifecycle-manager-'));
  const manifestPath = path.join(directory, 'manifest.json');
  const services = [
    { id: 'mapper', dependencies: ['librarian'], port: 4200 },
    { id: 'librarian', dependencies: ['filesystem'], port: 4300 },
    { id: 'filesystem', dependencies: [], port: 4302 },
  ].map(service => ({ ...service, command: 'node', args: [service.id],
    healthUrl: `http://${service.id}/health`, readinessUrl: `http://${service.id}/ready` }));
  await fs.writeFile(manifestPath, JSON.stringify({ version: 1, services }));
  const probes = new Map(services.map(service => [service.id, { alive: false, ready: false }]));
  const started = [];
  const children = [];
  const stopOrder = [];
  const environments = [];
  const manager = await createServiceProcessManager({
    manifestPath, appRoot: directory, logger: { log() {}, warn() {}, error() {} },
    aggregatorUrls: ['http://aggregator'],
    fetchImpl: async url => {
      const target = new URL(url);
      const observation = probes.get(target.hostname);
      return { ok: observation.alive, status: observation.alive ? 200 : 503, json: async () => ({ ready: observation.ready }) };
    },
    spawn: (_command, args, options) => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      child.pid = children.length + 1; child.exitCode = null;
      child.kill = () => {
        stopOrder.push(args[0]); probes.set(args[0], { alive: false, ready: false });
        child.exitCode = 0; child.emit('exit', 0, null); return true;
      };
      environments.push(options.env);
      children.push(child); started.push(args[0]);
      probes.set(args[0], { alive: true, ready: true });
      return child;
    },
  });
  t.after(async () => { await manager.shutdown(); await fs.rm(directory, { recursive: true, force: true }); });
  await Promise.all([manager.startService('mapper'), manager.startService('mapper')]);
  assert.deepEqual(started, ['filesystem', 'librarian', 'mapper']);
  probes.set('filesystem', { alive: true, ready: false });
  const snapshot = await manager.listServices();
  assert.equal(snapshot.find(service => service.id === 'mapper').readiness.ready, false);
  assert.equal(snapshot.find(service => service.id === 'mapper').readiness.state, 'blocked');
  assert.equal(children.every(child => child.exitCode === null), true);
  probes.set('filesystem', { alive: true, ready: true });
  assert.equal((await manager.listServices()).find(service => service.id === 'mapper').readiness.ready, true);
  assert.equal(started.length, 3);
  assert.deepEqual(JSON.parse(environments[0].PULSE_AGGREGATOR_URLS), ['http://aggregator']);
  await assert.rejects(manager.stopService('filesystem'), /in use/);
  assert.equal(stopOrder.length, 0);
  await manager.stopService('filesystem', { cascade: true });
  assert.deepEqual(stopOrder, ['mapper', 'librarian', 'filesystem']);
  assert.equal((await manager.listServices()).every(service => service.desiredState === 'stopped'), true);
});

test('external bound instance is not started or replaced by the observing aggregator', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-lifecycle-external-'));
  const manifestPath = path.join(directory, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify({ services: [{
    id: 'remote', dependencies: [], management: 'external',
    healthUrl: 'http://board/health', readinessUrl: 'http://board/ready',
  }] }));
  let starts = 0;
  const manager = await createServiceProcessManager({
    manifestPath, logger: { log() {}, warn() {}, error() {} },
    fetchImpl: async () => ({ ok: false, status: 503 }), spawn: () => { starts++; },
  });
  t.after(async () => { await manager.shutdown(); await fs.rm(directory, { recursive: true, force: true }); });
  await assert.rejects(manager.startService('remote'), /stopped/);
  assert.equal(starts, 0);
});

test('desired intent survives owner restart and an operator stop is persisted', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-lifecycle-intent-'));
  const manifestPath = path.join(directory, 'manifest.json');
  const statePath = path.join(directory, 'intent.json');
  await fs.writeFile(manifestPath, JSON.stringify({ services: [{
    id: 'files', dependencies: [], command: 'node', args: ['files'], healthUrl: 'http://files/health',
  }] }));
  let running = false;
  let starts = 0;
  const options = { manifestPath, statePath, ownerAggregatorId: 'owner', checkIntervalMs: 60000,
    logger: { log() {}, warn() {}, error() {} },
    fetchImpl: async () => ({ ok: running, status: running ? 200 : 503 }),
    spawn: () => {
      starts++; running = true;
      const child = new EventEmitter();
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      child.exitCode = null;
      child.kill = () => { running = false; child.exitCode = 0; child.emit('exit', 0, null); return true; };
      return child;
    },
  };
  let manager = await createServiceProcessManager(options);
  await manager.startService('files');
  await manager.shutdown();
  manager = await createServiceProcessManager(options);
  assert.equal((await manager.getService('files')).desiredState, 'running');
  await manager.supervise([]);
  assert.equal(starts, 2);
  await manager.stopService('files');
  await manager.shutdown();
  assert.deepEqual(JSON.parse(await fs.readFile(statePath, 'utf8')).desired, []);
  manager = await createServiceProcessManager(options);
  assert.equal((await manager.getService('files')).desiredState, 'stopped');
  await manager.shutdown();
  await fs.rm(directory, { recursive: true, force: true });
});

test('readiness timeout preserves a live child and a queued stop wins over startup', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-lifecycle-timeout-'));
  const manifestPath = path.join(directory, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify({ services: [{
    id: 'files', dependencies: [], command: 'node', args: [],
    healthUrl: 'http://files/health', readinessUrl: 'http://files/ready',
  }] }));
  let alive = false;
  let killed = 0;
  const manager = await createServiceProcessManager({
    manifestPath, startupTimeoutMs: 10, checkIntervalMs: 60000,
    logger: { log() {}, warn() {}, error() {} },
    fetchImpl: async url => ({
      ok: alive, status: alive ? 200 : 503, json: async () => ({ ready: false }),
    }),
    spawn: () => {
      alive = true;
      const child = new EventEmitter();
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.exitCode = null;
      child.kill = () => { killed++; alive = false; child.exitCode = 0; child.emit('exit', 0, null); return true; };
      return child;
    },
  });
  t.after(async () => { await manager.shutdown(); await fs.rm(directory, { recursive: true, force: true }); });
  await assert.rejects(manager.startService('files'), /readiness/);
  assert.equal(killed, 0);
  assert.equal((await manager.listServices())[0].readiness.state, 'not-ready');
  const starting = manager.startService('files');
  const stopping = manager.stopService('files');
  await assert.rejects(starting, /readiness/);
  await stopping;
  assert.equal(killed, 1);
  assert.equal((await manager.getService('files')).desiredState, 'stopped');
});
