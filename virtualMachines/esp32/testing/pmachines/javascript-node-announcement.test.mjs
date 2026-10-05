import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';

test('JS nodes announce on startup, repeat heartbeats and stop announcing on close', async () => {
  const announcements = [];
  let heartbeatReceived;
  const heartbeat = new Promise((resolve) => { heartbeatReceived = resolve; });
  const server = createJsPmachineNodeServer({
    name: 'test-js-node', backendUrl: 'http://127.0.0.1:4000',
    announceIntervalMs: 20,
    fetchImpl: async (url, options) => {
      assert.equal(String(url), 'http://127.0.0.1:4000/api/pmachine/announce');
      assert.equal(options.method, 'POST');
      assert.ok(options.signal instanceof AbortSignal);
      announcements.push(JSON.parse(options.body));
      if (announcements.length >= 2) heartbeatReceived();
      return new Response('{}');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await heartbeat;
    assert.equal(announcements[0].nodeId, 'test-js-node');
    assert.equal(announcements[0].port, server.address().port);
    assert.equal(announcements[0].ip, '127.0.0.1');
    assert.equal(announcements[0].runtime, 'js-pmachine');
    assert.deepEqual(announcements[0].services, [{ name: 'pmachine', endpoint: '/pmachine/execute_file' }]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const count = announcements.length;
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(announcements.length, count);
});

test('announcement failures are reported explicitly', async () => {
  let warningReceived;
  const warning = new Promise((resolve) => { warningReceived = resolve; });
  const server = createJsPmachineNodeServer({
    backendUrl: 'http://127.0.0.1:4000',
    fetchImpl: async () => new Response('offline', { status: 503 }),
    logger: { warn: (message) => warningReceived(message) }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    assert.match(await warning, /announcement.*failed: HTTP 503: offline/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
