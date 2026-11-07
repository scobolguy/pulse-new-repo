import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import QueueManager from '../../../aggregator/src/broker/QueueManager.mjs';

const [role, origin] = process.argv.slice(2);
const abort = new AbortController();
let server;
process.on('message', message => {
  if (message.type !== 'stop') return;
  abort.abort();
  if (server) {
    server.closeAllConnections();
    server.close(() => process.disconnect());
  } else process.disconnect();
});

async function jsonRequest(url, body) {
  const response = await fetch(url, {
    ...(body === undefined ? {} : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }),
    signal: abort.signal,
  });
  if (!response.ok) throw new Error(`Broker returned ${response.status}: ${await response.text()}`);
  return response.json();
}

if (role === 'broker') {
  const queues = new QueueManager('virtual-pmachine-proof');
  queues.createQueue('queries');
  const requests = new Set();
  const counters = { queries: 0, replies: 0, delivered: 0 };
  server = http.createServer(async (request, response) => {
    const reply = (status, value) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(value));
    };
    try {
      const url = new URL(request.url, 'http://localhost');
      let body;
      if (request.method === 'POST') {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      }
      if (url.pathname === '/request' && request.method === 'POST') {
        if (requests.has(body.id)) throw new Error('Query was sent more than once');
        requests.add(body.id);
        queues.createQueue(`reply.${body.id}`);
        queues.enqueue('queries', body, 'cobol-requester', body.id);
        counters.queries += 1;
        return reply(202, { id: body.id });
      }
      if (url.pathname === '/take') {
        return reply(200, queues.dequeue('queries', 'delayed-responder')?.message ?? null);
      }
      if (url.pathname === '/reply' && request.method === 'POST') {
        if (!requests.has(body.id)) throw new Error('Unknown reply correlation ID');
        queues.enqueue(`reply.${body.id}`, body, 'delayed-responder');
        counters.replies += 1;
        return reply(200, { ok: true });
      }
      if (url.pathname.startsWith('/reply/') && request.method === 'GET') {
        const id = url.pathname.slice('/reply/'.length);
        if (!requests.has(id)) return reply(404, { error: 'Unknown query' });
        const message = queues.dequeue(`reply.${id}`, 'cobol-requester')?.message ?? null;
        if (message) counters.delivered += 1;
        return reply(200, message);
      }
      if (url.pathname === '/status') return reply(200, counters);
      reply(404, { error: 'Not found' });
    } catch (error) {
      reply(400, { error: error.message });
    }
  });
  server.listen(0, '127.0.0.1', () => process.send({
    type: 'ready', origin: `http://127.0.0.1:${server.address().port}`,
  }));
} else if (role === 'responder') {
  process.send({ type: 'ready' });
  try {
    while (!abort.signal.aborted) {
      const query = await jsonRequest(`${origin}/take`);
      if (!query) {
        await delay(20, undefined, { signal: abort.signal });
        continue;
      }
      const startedAt = performance.now();
      process.send({ type: 'waiting', id: query.id });
      await delay(30000, undefined, { signal: abort.signal });
      const elapsedMs = performance.now() - startedAt;
      await jsonRequest(`${origin}/reply`, {
        id: query.id, code: 0, data: `REPLIED ${query.record.trim()}`.padEnd(40), elapsedMs,
      });
      process.send({ type: 'replied', id: query.id, elapsedMs });
    }
  } catch (error) {
    if (!abort.signal.aborted) throw error;
  }
} else {
  throw new Error(`Unknown fixture role: ${role}`);
}
