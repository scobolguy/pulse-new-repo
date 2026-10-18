import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import config from '../../aggregator/vite.config.js';

test('supervised frontend launches Vite directly without a platform-specific npm shell', async () => {
  const manifest = JSON.parse(await fs.readFile(
    new URL('../../aggregator/data/service-manifest.json', import.meta.url), 'utf8'));
  const frontend = manifest.services.find(service => service.id === 'frontend');
  assert.equal(frontend.command, 'node');
  assert.deepEqual(frontend.args, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0']);
  await fs.access(new URL('../../aggregator/node_modules/vite/bin/vite.js', import.meta.url));
});

test('frontend announces its actual listener and exposes policy readiness without launching anything', async t => {
  const reports = [];
  const collector = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    reports.push(JSON.parse(Buffer.concat(chunks)));
    res.setHeader('content-type', 'application/json');
    res.end('{}');
  });
  collector.listen(0, '127.0.0.1');
  await once(collector, 'listening');
  const environment = {
    PULSE_AGGREGATOR_URLS: JSON.stringify([`http://127.0.0.1:${collector.address().port}`]),
    PULSE_SERVICE_INSTANCE_ID: 'frontend-test', PULSE_OWNER_AGGREGATOR_ID: 'test-owner',
    PULSE_SERVICE_BINDINGS: '{}', PULSE_SERVICE_ENDPOINT: '', PULSE_SERVICE_ADVERTISE_HOST: '',
  };
  const previous = Object.fromEntries(Object.keys(environment).map(name => [name, process.env[name]]));
  Object.assign(process.env, environment);
  const middleware = [];
  const server = http.createServer((req, res) => {
    const dispatch = index => middleware[index]
      ? middleware[index](req, res, () => dispatch(index + 1))
      : res.end('frontend');
    dispatch(0);
  });
  t.after(async () => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => collector.close(resolve));
  });
  const plugin = config.plugins.find(plugin => plugin.name === 'pulse-frontend-lifecycle');
  await plugin.configureServer({
    httpServer: server, middlewares: { use: handler => middleware.push(handler) },
    close: () => new Promise(resolve => server.close(resolve)),
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const deadline = Date.now() + 5000;
  while (!reports.length || (await fetch(`${origin}/ready`)).status !== 200) {
    if (Date.now() > deadline) assert.fail('Frontend did not report or become ready');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(reports[0].serviceId, 'pulse-frontend');
  assert.equal(reports[0].listeners[0].port, server.address().port);
  assert.equal(reports[0].endpoint, origin);
  assert.equal((await fetch(`${origin}/health`)).status, 200);
  assert.equal(await (await fetch(origin)).text(), 'frontend');
});
