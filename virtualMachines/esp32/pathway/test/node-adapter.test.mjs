import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import { createNodeAdapter } from '../src/node-adapter.mjs';
import { compileCobolishToPcode } from '../../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs';
import { signPcodeText } from '../../aggregator/scripts/pcode-signing.mjs';
const artifact = compileCobolishToPcode(await fs.readFile(new URL('../examples/echo.cob', import.meta.url), 'utf8'), { hostServices: true });

test('native adapter uploads signed PHI1 metadata for both units and transports JSON records', async t => {
  const files = new Map();
  let running = false;
  const errors = [];
  const server = http.createServer(async (req, res) => {
    try {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const params = new URLSearchParams(raw);
      let body = {};
      if (req.url === '/status') body = { nodeName: 'native-board' };
      else if (req.url === '/pmachine/service_host/status') body = {
        running, collectorId: 'native-test', hostBindingsVersion: 1, runtime: 'pascalish-esp32',
      };
      else if (req.url === '/ffs/upload') files.set(params.get('file'), params.get('body'));
      else if (req.url === '/pmachine/service_host/install') {
        const daemon = JSON.parse(params.get('daemons'))[0];
        for (const [file, mapFile] of [[params.get('serviceFile'), params.get('serviceMap')], [daemon.file, daemon.map]]) {
          const text = files.get(file);
          const map = JSON.parse(files.get(mapFile));
          assert.match(text, /^PHI1/);
          assert.equal(map.hostImageFormat, 'PHI1');
          assert.equal(map.signing.signature, signPcodeText(text));
        }
        running = true;
      } else if (req.url === '/api/pathway/echo') {
        assert.match(req.headers['content-type'], /application\/json/);
        const request = JSON.parse(raw);
        assert.equal(typeof request.data, 'string');
        body = { code: 0, data: request.data };
      } else throw new Error(`Unexpected route ${req.url}`);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    } catch (error) {
      errors.push(error);
      res.writeHead(400).end(error.message);
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const node = { origin: `http://127.0.0.1:${server.address().port}`, runtime: 'esp32' };
  const adapter = createNodeAdapter();
  assert.deepEqual(await adapter.describe(node), { runtime: 'esp32' });
  await adapter.install(node, { artifact }, 'native-test');
  assert.equal(files.size, 4);
  assert.deepEqual(await adapter.send(node, { path: '/api/pathway/echo' }, 'quote " slash \\'),
    { code: 0, data: 'quote " slash \\' });
  assert.deepEqual(errors, []);
});
