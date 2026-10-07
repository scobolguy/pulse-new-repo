import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { requestEsp32 } from './esp32-http.mjs';

const base = new URL(process.argv[2] ?? 'http://192.168.2.115');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function readStatus() {
  const response = await requestEsp32(new URL('/status', base));
  assert.equal(response.status, 200, 'status must remain responsive');
  const status = JSON.parse(await response.text());
  assert(status.udpIngress, 'firmware must expose UDP ingress diagnostics');
  return status.udpIngress;
}

async function waitFor(predicate) {
  const deadline = Date.now() + 10000;
  do {
    const stats = await readStatus();
    if (predicate(stats)) return stats;
    await sleep(200);
  } while (Date.now() < deadline);
  throw new Error('UDP ingress counters did not reach the expected values within 10 seconds');
}

const initial = await readStatus();
const ports = [...new Set([initial.boundParentPort, initial.boundSiblingPort].filter(port => port > 0))];
assert(ports.length > 0, 'discovery sockets must be bound');
const socket = dgram.createSocket('udp4');
const send = (packet, port) => new Promise((resolve, reject) => {
  socket.send(packet, port, base.hostname, error => error ? reject(error) : resolve());
});
const boundaryPacket = Buffer.from('{"kind":"ingress-probe"}'.padEnd(1024, ' '));
try {
  for (const port of ports) {
    const before = await readStatus();
    await send(boundaryPacket, port);
    const boundary = await waitFor(stats => stats.received > before.received);
    for (const field of ['droppedOversized', 'droppedLowMemory', 'droppedIncomplete', 'droppedAllocation']) {
      assert.equal(boundary[field], before[field], `1024-byte packet must be admitted (${field})`);
    }
    for (let i = 0; i < 5; i++) {
      await send(Buffer.alloc(1025, 32), port);
      await sleep(250);
    }
    const after = await waitFor(stats => stats.droppedOversized >= before.droppedOversized + 5);
    await send(boundaryPacket, port);
    const recovery = await waitFor(stats => stats.received > after.received);
    assert.equal(recovery.droppedOversized, after.droppedOversized, 'valid packet after drops must be admitted');
    assert.equal(recovery.droppedLowMemory, after.droppedLowMemory, 'recovery must not hit the memory guard');
    console.log(`PASS UDP port ${port}: size boundary, five drops, HTTP responsiveness and recovery`,
      JSON.stringify({ before, boundary, after, recovery }));
  }
} finally {
  socket.close();
}
