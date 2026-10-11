#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fork } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../shared/contracts/service-host-bindings.mjs';
import { createJsPmachineNodeServer } from './server.mjs';
import { createFileDatastoreAdapter, createDistributedTableAuthority, serveDistributedTableAuthority }
  from './src/distributed-datastore.mjs';

const script = fileURLToPath(import.meta.url);

function startMachine(port, id, binding) {
  const child = fork(script, ['--worker'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  let ready = false;
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  const started = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Starting ${id} timed out`)), 15000);
    function finish(error, origin) {
      clearTimeout(timeout);
      child.removeListener('message', message);
      if (error) reject(error);
      else { ready = true; resolve(origin); }
    }
    function message(value) {
      if (value?.error) finish(new Error(`${id}: ${value.error}`));
      else if (value?.origin) finish(null, value.origin);
    }
    child.on('message', message);
    child.once('error', error => finish(error));
    child.once('exit', (code, signal) => {
      if (!ready) finish(new Error(`${id} exited before readiness (${code ?? signal})`));
    });
    child.send({ port, id, binding });
  });
  return {
    child, started,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      if (ready && child.connected) child.send({ stop: true });
      else child.kill();
      let timer;
      await Promise.race([
        exited,
        new Promise((resolve, reject) => {
          timer = setTimeout(() => {
            child.kill();
            reject(new Error('JS PMachine shutdown timed out; terminated owned child'));
          }, 10000);
        })
      ]).finally(() => clearTimeout(timer));
    }
  };
}

export async function deployReplicatedCache({
  file, authorityPort = 4340, machinePorts = [4341, 4342], logger = console
} = {}) {
  if (!path.isAbsolute(file || '') || !Array.isArray(machinePorts) || machinePorts.length !== 2 ||
      [authorityPort, ...machinePorts].some(port => !Number.isInteger(port) || port < 0 || port > 65535) ||
      new Set([authorityPort, ...machinePorts].filter(Boolean)).size !== [authorityPort, ...machinePorts].filter(Boolean).length) {
    throw new Error('Provide an absolute datastore file and three distinct ports (or 0 for automatic ports)');
  }
  const source = await fs.readFile(new URL('../../src/replicated-device-directory.pas', import.meta.url), 'utf8');
  const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });
  const map = attachPcodeSignature(compactServiceHostProgramMap(compiled.programMap), compiled.pcodeText);
  const token = randomBytes(32).toString('hex');
  let authority, transport, closing;
  const machines = [];
  const stop = () => closing ??= (async () => {
    const errors = [];
    for (const machine of machines) {
      try { await machine.stop(); } catch (error) { errors.push(error); }
    }
    if (transport) {
      try { await transport.close(); } catch (error) { errors.push(error); }
    }
    if (authority) {
      try { await authority.close(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Replicated-cache cleanup failed');
  })();
  try {
    authority = await createDistributedTableAuthority({
      adapter: await createFileDatastoreAdapter(file), tables: compiled.programMap.distributedTables
    });
    transport = await serveDistributedTableAuthority(authority, { token, port: authorityPort });
    for (const [index, port] of machinePorts.entries()) {
      const id = `directory-replica-${index + 1}`;
      const machine = startMachine(port, id, { origin: transport.origin, token, replicaId: id });
      machines.push(machine);
      machine.origin = await machine.started;
      async function post(route, values) {
        const response = await fetch(`${machine.origin}${route}`, {
          method: 'POST', body: new URLSearchParams(values), signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`${id} ${route}: HTTP ${response.status}: ${await response.text()}`);
        return response.text();
      }
      await post('/ffs/upload', { file: '/directory.pcode', body: compiled.pcodeText });
      await post('/ffs/upload', { file: '/directory.map.json', body: JSON.stringify(map) });
      await post('/pmachine/service_host/install', {
        collectorId: id, serviceFile: '/directory.pcode', serviceMap: '/directory.map.json', udpPort: '0'
      });
      const status = await (await fetch(`${machine.origin}/pmachine/service_host/status`, {
        signal: AbortSignal.timeout(5000)
      })).json();
      if (!status.running || !status.replicas?.[0]?.synchronized) throw new Error(`${id} failed replica readiness`);
      logger.log(`[DEPLOY] ${id}: ${machine.origin}, PID ${machine.child.pid}, synchronized`);
    }
    logger.log(`[DEPLOY] Durable directory: ${file}; no discovery-registry data is copied.`);
    return { stop, origins: machines.map(machine => machine.origin), pids: machines.map(machine => machine.child.pid),
      status: () => authority.status() };
  } catch (error) {
    try { await stop(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Deployment and cleanup failed'); }
    throw error;
  }
}

async function worker() {
  let server, origin, stopping;
  const stop = () => stopping ??= (async () => {
    if (server?.listening) {
      const response = await fetch(`${origin}/pmachine/service_host/stop`, {
        method: 'POST', signal: AbortSignal.timeout(6000)
      });
      if (!response.ok) throw new Error(`Stopping hosted service: HTTP ${response.status}`);
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    if (process.connected) process.disconnect();
  })();
  process.on('message', async message => {
    try {
      if (message.stop) { await stop(); return; }
      if (server) throw new Error('Worker already started');
      server = createJsPmachineNodeServer({
        name: message.id, distributedGrants: { [message.id]: { devicedirectory: message.binding } }
      });
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(message.port, '127.0.0.1', resolve);
      });
      origin = `http://127.0.0.1:${server.address().port}`;
      process.send({ origin });
    } catch (error) {
      console.error(`[DIRECTORY] ${error.message}`);
      process.exitCode = 1;
      if (process.connected) process.send({ error: error.message });
      if (server?.listening) { server.closeAllConnections(); server.close(); }
      if (process.connected) process.disconnect();
    }
  });
  process.once('disconnect', () => {
    if (!stopping) stop().catch(error => { console.error(error); process.exitCode = 1; });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (process.argv.includes('--worker')) await worker();
  else {
    const index = process.argv.indexOf('--file');
    if (index < 0 || !process.argv[index + 1]) throw new Error('Usage: node deploy-replicated-cache.mjs --file <absolute-file>');
    const runtime = await deployReplicatedCache({ file: process.argv[index + 1] });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      runtime.stop().catch(error => { console.error(error); process.exitCode = 1; });
    });
  }
}
