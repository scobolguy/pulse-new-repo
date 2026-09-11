import assert from 'node:assert/strict';
import express from 'express';
import { registerOllamaRoutes } from '../src/backend/ollamaRoutes.mjs';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
registerOllamaRoutes(app);

const server = await new Promise(resolve => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});

try {
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/nli/query`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-agent-test': '1'
    },
    body: JSON.stringify({ message: 'Show me office' })
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result._intentId, 'network-camera-feed');
  assert.match(result.output, /\/api\/cameras\/office\/viewer/i);
  assert.match(result.voiceReply, /showing office/i);
  console.log(JSON.stringify({
    status: response.status,
    intentId: result._intentId,
    viewer: '/api/cameras/office/viewer',
    voiceReply: result.voiceReply
  }, null, 2));
} finally {
  await new Promise(resolve => server.close(resolve));
}
