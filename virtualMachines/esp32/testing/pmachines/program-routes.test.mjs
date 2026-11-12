import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { registerPmachineProgramRoutes } from '../../aggregator/src/backend/modules/pmachineProgramRoutes.mjs';

const require = createRequire(new URL('../../aggregator/package.json', import.meta.url));
const express = require('express');
const encoded = value => Buffer.from(value).toString('base64');

test('installed bundle starts through the existing pmachine supervisor contract', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-program-routes-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const started = [];
  const supervisor = {
    start: async deployment => {
      started.push(deployment);
      return { state: 'running', slot: deployment.metadata.slotKind, program: deployment.serviceName };
    },
    list: () => [],
    slots: () => []
  };
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  registerPmachineProgramRoutes(app, { root, supervisor });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  const installed = await fetch(`${origin}/api/pmachine/programs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'resident-controller',
      manifest: {
        name: 'resident-controller', version: '1.0.0', type: 'resident',
        entry: 'program.pcode', programMap: 'program.map.json'
      },
      files: [
        { path: 'program.pcode', base64: encoded('program') },
        { path: 'program.map.json', base64: encoded('{}') }
      ]
    })
  });
  assert.equal(installed.status, 201);

  const startedResponse = await fetch(`${origin}/api/pmachine/programs/resident-controller/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(startedResponse.status, 201);
  assert.equal(started[0].metadata.slotKind, 'resident');
  assert.equal(started[0].metadata.serviceIndex, null);
});
