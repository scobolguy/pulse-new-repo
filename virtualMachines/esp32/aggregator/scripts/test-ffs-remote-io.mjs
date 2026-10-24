import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import http from 'node:http';
import { createFileServer } from '../fileServer.js';

test('remote FFS supports bounded binary, positioned reads/writes and directories', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-ffs-remote-'));
  const app = express();
  app.use(express.json());
  app.use(createFileServer({ ffsConfig: { root } }).router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/ffs`;
  async function write(query, data = Buffer.alloc(0)) {
    return fetch(`${base}/io?path=nested/test.bin&${query}`, {
      method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: data
    });
  }
  try {
    assert.deepEqual(await (await fetch(`${base}/storage`)).json(), { protocol: 'ffs-seek-v1' });
    const emptyCreate = await new Promise((resolve, reject) => {
      const request = http.request(`${base}/io?path=arduino-empty.bin&offset=0&truncate=true`, {
        method: 'POST',
        headers: { host: new URL(base).host, 'content-type': 'application/octet-stream' },
        setDefaultHeaders: false,
      }, response => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      });
      request.on('error', reject);
      request.end();
    });
    assert.equal(emptyCreate, 200);
    assert.equal((await (await fetch(`${base}/stat?path=arduino-empty.bin`)).json()).size, 0);
    let response = await write('offset=0&truncate=true');
    assert.equal(response.status, 200, await response.text());
    const bytes = Buffer.from([0, 255, 128, 13, 10, 42]);
    response = await write('offset=0', bytes);
    assert.equal(response.status, 200, await response.text());
    response = await write('offset=2', Buffer.from([1, 2]));
    assert.equal(response.status, 200);
    const read = await fetch(`${base}/io?path=nested/test.bin&offset=1&length=4`);
    assert.deepEqual(Buffer.from(await read.arrayBuffer()), Buffer.from([255, 1, 2, 10]));
    const stat = await (await fetch(`${base}/stat?path=nested/test.bin`)).json();
    assert.equal(stat.size, 6);
    assert.equal(stat.directory, false);
    assert.ok(stat.updatedAt > 0);
    response = await write('offset=0&truncate=false');
    assert.equal(response.status, 200);
    assert.equal((await (await fetch(`${base}/stat?path=nested/test.bin`)).json()).size, 6);
    for (const query of ['offset=-1&length=1', 'offset=0&length=1025', 'offset=NaN&length=2']) {
      assert.equal((await fetch(`${base}/io?path=nested/test.bin&${query}`)).status, 400);
    }
    assert.equal((await write('offset=-1', bytes)).status, 400);
    assert.equal((await write('offset=0', Buffer.alloc(1025))).status, 413);
    assert.equal((await fetch(`${base}/stat?path=missing`)).status, 404);
    response = await write('offset=0&truncate=true');
    assert.equal(response.status, 200);
    assert.equal((await (await fetch(`${base}/stat?path=nested/test.bin`)).json()).size, 0);
    const dir = await fetch(`${base}/create`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'empty', type: 'directory' })
    });
    assert.equal(dir.status, 200);
    const removed = await fetch(`${base}/rmdir`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'empty' })
    });
    assert.equal(removed.status, 200);
    assert.deepEqual((await (await fetch(`${base}/list?path=nested`)).json()).files,
      [{ name: 'test.bin', type: 'file' }]);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  }
});
