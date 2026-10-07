import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { PROGRAM_SOURCE_ROOT, PROGRAM_OBJECT_ROOT, collectProjectDeploymentFiles } from '../../aggregator/src/backend/modules/programLayout.mjs';

const run = promisify(execFile);
const aggregatorRoot = fileURLToPath(new URL('../../aggregator/', import.meta.url));

test('program roots are independent of the process working directory', () => {
  assert.equal(PROGRAM_SOURCE_ROOT, fileURLToPath(new URL('../../src', import.meta.url)));
  assert.equal(PROGRAM_OBJECT_ROOT, fileURLToPath(new URL('../../object', import.meta.url)));
});

test('project deployment merges source and object trees without changing remote relative paths', async () => {
  await fs.mkdir(PROGRAM_OBJECT_ROOT, { recursive: true });
  const directory = await fs.mkdtemp(path.join(PROGRAM_OBJECT_ROOT, 'layout-test-'));
  const sourceRoot = path.join(directory, 'src');
  const objectRoot = path.join(directory, 'object');
  try {
    await Promise.all([
      fs.mkdir(path.join(sourceRoot, 'gateways'), { recursive: true }),
      fs.mkdir(path.join(objectRoot, 'gateways'), { recursive: true })
    ]);
    await Promise.all([
      fs.writeFile(path.join(sourceRoot, 'gateways', 'bridge.pas'), 'begin end.'),
      fs.writeFile(path.join(sourceRoot, 'gateways', 'stale.pcode'), 'HALT'),
      fs.writeFile(path.join(objectRoot, 'gateways', 'bridge.pcode'), 'HALT'),
      fs.writeFile(path.join(objectRoot, 'gateways', 'bridge.program.json'), '{}'),
      fs.writeFile(path.join(objectRoot, 'gateways', 'stale.pas'), 'begin end.')
    ]);
    const files = collectProjectDeploymentFiles(sourceRoot, objectRoot);
    assert.deepEqual(files.map(file => file.relativePath), [
      'gateways/bridge.pas', 'gateways/bridge.pcode', 'gateways/bridge.program.json'
    ]);
    assert.equal(files[0].fullPath, path.join(sourceRoot, 'gateways', 'bridge.pas'));
    assert.equal(files[1].fullPath, path.join(objectRoot, 'gateways', 'bridge.pcode'));
    assert.deepEqual(collectProjectDeploymentFiles(path.join(directory, 'missing'), objectRoot)
      .map(file => file.relativePath), ['gateways/bridge.pcode', 'gateways/bridge.program.json']);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('hello deployment compiles src inputs into object outputs and retains FFS names', async () => {
  const uploads = new Map();
  const server = http.createServer(async (request, response) => {
    if (request.url === '/ffs/upload') {
      let body = '';
      for await (const chunk of request) body += chunk;
      const form = new URLSearchParams(body);
      uploads.set(form.get('file'), form.get('body'));
      response.end('uploaded');
    } else if (request.url.startsWith('/pmachine/router/run?')) {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ serviceId: 'hello', deliveries: [
        { outputQueue: 'hello.out', message: 'hello, world' }
      ] }));
    } else {
      response.writeHead(404).end('Unexpected deployment request');
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { stdout } = await run(process.execPath, ['scripts/deploy-esp32-hello-service.mjs'], {
      cwd: aggregatorRoot,
      env: { ...process.env, ESP32_HOST: `127.0.0.1:${server.address().port}` }
    });
    assert.equal(JSON.parse(stdout).status, 'ok');
    assert.deepEqual([...uploads.keys()], ['/hrr.json', '/hdm.json']);
    assert.ok(JSON.parse(uploads.get('/hrr.json')).length > 0);
    for (const name of ['hello-router-rules.generated.json', 'hello-data-mappings.generated.json', 'hello-compiled.artifact.json']) {
      JSON.parse(await fs.readFile(path.join(PROGRAM_OBJECT_ROOT, 'pcode', name), 'utf8'));
    }
    await fs.access(path.join(PROGRAM_SOURCE_ROOT, 'hello-service.pas'));
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('mapper authoring persists editable sources and generated output in separate roots', async () => {
    const directory = await fs.mkdtemp(path.join(PROGRAM_OBJECT_ROOT, 'mapper-layout-test-'));
    const runtimeRoot = path.join(directory, 'runtime');
    const sourceRoot = path.join(directory, 'src');
    const objectRoot = path.join(directory, 'object');
    try {
      await Promise.all([
        fs.mkdir(path.join(runtimeRoot, 'services', 'librarian'), { recursive: true }),
        fs.mkdir(path.join(runtimeRoot, 'data-maps'), { recursive: true })
      ]);
      await fs.writeFile(path.join(runtimeRoot, 'services', 'librarian', 'data-types.json'), JSON.stringify([
        { id: 'source', label: 'Source', kind: 'message' },
        { id: 'target', label: 'Target', kind: 'message' }
      ]));
      await fs.writeFile(path.join(runtimeRoot, 'data-maps', 'fixture-map.map'), JSON.stringify({
        sourceTypeId: 'source', targetTypeId: 'target',
        rules: [{ sourcePath: 'source.value', targetPath: 'target.value', conversionRule: 'output := src;' }]
      }));
      const script = `
        import express from 'express';
        import { registerMapperRoutes } from './src/backend/mapperRoutes.mjs';
        const app = express();
        app.use(express.json());
        registerMapperRoutes(app);
        const server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        try {
          const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/mapper/authoring/deterministic-generate', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ intent: { sourceTypeId: 'source', targetTypeId: 'target', mapId: 'fixture_map', intentKind: 'map-message-type' } })
          });
          const payload = await response.json();
          if (response.status !== 201) throw new Error(JSON.stringify(payload));
          console.log(JSON.stringify(payload.stored));
        } finally {
          await new Promise(resolve => server.close(resolve));
        }
      `;
      const { stdout } = await run(process.execPath, ['--input-type=module', '--eval', script], {
        cwd: aggregatorRoot,
        env: {
          ...process.env, PULSE_RUNTIME_DATA_ROOT: runtimeRoot,
          PULSE_PROGRAM_SOURCE_ROOT: sourceRoot, PULSE_PROGRAM_OBJECT_ROOT: objectRoot
        }
      });
      const stored = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
      for (const key of ['mapl', 'pascalish', 'wfl']) {
        assert.ok(stored[key].startsWith(sourceRoot + path.sep), `${key} must be source-side`);
        await fs.access(stored[key]);
      }
      for (const key of ['pcode', 'programMap', 'manifest', 'intent']) {
        assert.ok(stored[key].startsWith(objectRoot + path.sep), `${key} must be object-side`);
        await fs.access(stored[key]);
      }
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
});
