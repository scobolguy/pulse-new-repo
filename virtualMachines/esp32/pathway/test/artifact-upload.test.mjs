import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { uploadFfsFile } from '../../aggregator/scripts/esp32-runtime-artifacts.mjs';

test('artifact uploads stream raw bytes without pooling device connections and surface errors', async () => {
  const image = 'PHI1' + 'ab'.repeat(16000);
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    assert.equal(request.headers.connection, 'close');
    assert.equal(request.headers['content-type'], 'application/octet-stream');
    if (request.url.includes('rejected')) {
      response.writeHead(503);
      response.end('Storage unavailable');
    } else {
      assert.equal(request.url, '/ffs/upload_stream?file=%2Fapplication%20image.phi');
      assert.equal(Number(request.headers['content-length']), Buffer.byteLength(image));
      assert.equal(Buffer.concat(chunks).toString(), image);
      response.end('File uploaded');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (let count = 0; count < 2; count++) {
      assert.equal(await uploadFfsFile(origin, '/application image.phi', image), 'File uploaded');
    }
    await assert.rejects(uploadFfsFile(origin, '/rejected.phi', image), /503.*Storage unavailable/);
    await assert.rejects(uploadFfsFile('file:///not-an-origin', '/bad.phi', image), /HTTP/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
