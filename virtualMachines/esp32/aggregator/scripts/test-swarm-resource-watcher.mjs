import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('periodic reporter persists sequence across process restart', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-resource-watcher-'));
  t.after(() => fs.rm(directory, { recursive: true }));
  const sequences = [];
  let requestCount = 0;
  const server = http.createServer(async (request, response) => {
    requestCount += 1;
    if (request.method === 'GET' && request.url === '/status') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        runtime: 'js-pmachine', nodeName: '127.0.0.1',
        resourceCapacity: { status: 'online', estimatedFreeSlots: 1, freeMemoryBytes: 1024 },
      }));
      return;
    }
    if (request.method === 'POST' && request.url === '/api/swarm/resources/report') {
      let body = '';
      for await (const chunk of request) body += chunk;
      const report = JSON.parse(body);
      sequences.push(report.sequence);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok', nodeId: report.nodeId }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  server.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => {
    server.close(() => resolve());
    server.closeAllConnections();
  }));
  await once(server, 'listening');

  const origin = `http://127.0.0.1:${server.address().port}`;
  const sequenceFile = path.join(directory, 'resource-sequence.txt');
  const script = fileURLToPath(new URL('./report-swarm-resources.mjs', import.meta.url));
  const aggregatorDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const baseEnvironment = {
    ...process.env,
    PULSE_SWARM_REPORT_URL: `${origin}/api/swarm/resources/report`,
    PULSE_SWARM_NODE_ID: '127.0.0.1',
    PULSE_SWARM_SERVICE_ID: 'worker',
    PULSE_OWNER_AGGREGATOR_ID: 'aggregator-a',
    PULSE_SWARM_MACHINE_TOKEN: 'test-machine-token-123456',
    PULSE_SWARM_RESOURCE_SOURCE: 'js-pmachine',
    PULSE_SWARM_SOURCE_URL: origin,
    PULSE_SWARM_REPORT_SEQUENCE_FILE: sequenceFile,
    PULSE_SWARM_REPORT_INTERVAL_MS: '1000',
  };

  async function runWatcher(environment, expectedCount) {
    const childEnvironment = { ...environment };
    delete childEnvironment.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, [script, '--watch'], {
      cwd: aggregatorDirectory,
      env: childEnvironment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(
          `Watcher timed out (pid ${child.pid}, ${requestCount} HTTP requests): ${output}`,
        )), 15000);
        const check = () => {
          if (sequences.length >= expectedCount) {
            clearTimeout(timeout);
            resolve();
          }
        };
        const interval = setInterval(check, 20);
        child.once('error', error => {
          clearTimeout(timeout);
          clearInterval(interval);
          reject(error);
        });
        child.once('exit', (code, signal) => {
          clearTimeout(timeout);
          clearInterval(interval);
          if (sequences.length < expectedCount)
            reject(new Error(`Watcher exited early (${code ?? signal}): ${output}`));
        });
        check();
      });
      child.kill('SIGINT');
      const [code, signal] = await once(child, 'exit');
      if (process.platform === 'win32') {
        assert.equal(signal, 'SIGINT', output);
      } else {
        assert.equal(signal, null, output);
        assert.equal(code, 0, output);
      }
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill('SIGKILL');
        await exited;
      }
    }
  }

  await runWatcher({ ...baseEnvironment, PULSE_SWARM_REPORT_SEQUENCE: '5' }, 2);
  assert.deepEqual(sequences, [5, 6]);
  assert.equal(await fs.readFile(sequenceFile, 'utf8'), '6\n');

  const restartedEnvironment = { ...baseEnvironment };
  delete restartedEnvironment.PULSE_SWARM_REPORT_SEQUENCE;
  await runWatcher(restartedEnvironment, 3);
  assert.deepEqual(sequences, [5, 6, 7]);
  assert.equal(await fs.readFile(sequenceFile, 'utf8'), '7\n');
});
