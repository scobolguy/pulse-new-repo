import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const itemId = /^[A-Z][A-Z0-9_-]{0,15}$/;
export const INVENTORY_SEED = Object.freeze({ WIDGET: 100, SENSOR: 25, RELAY: 50 });
export const validInventoryRequestId = value =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{16,96}$/.test(value);

export function commandOf(record) {
  if (typeof record !== 'string' || record.length > 128 || !/^[\x20-\x7e]+$/.test(record)) {
    throw failure('Inventory command must be a printable ASCII record of at most 128 bytes');
  }
  const command = record.trim().toUpperCase().split(/\s+/);
  const [operation, item, amount, reservation] = command;
  if (operation === 'INQUIRE' && command.length === 2 && itemId.test(item)) return { operation, item };
  if (operation === 'RELEASE' && command.length === 2 && itemId.test(item)) return { operation, reservation: item };
  if (operation === 'RESERVE' && command.length === 4 && itemId.test(item) &&
      /^[1-9][0-9]{0,5}$/.test(amount) && itemId.test(reservation)) {
    return { operation, item, quantity: Number(amount), reservation };
  }
  throw failure('Use INQUIRE sku, RESERVE sku quantity reservation-id, or RELEASE reservation-id');
}

export async function createInventoryAuthority({ store, token, port = 0, logger = console } = {}) {
  if (!store || typeof store.apply !== 'function' || typeof token !== 'string' || token.length < 32) {
    throw failure('Inventory authority needs a store and an explicit bearer credential');
  }
  const expected = Buffer.from(`Bearer ${token}`);
  const server = http.createServer(async (request, response) => {
    try {
      const credential = Buffer.from(request.headers.authorization ?? '');
      if (credential.length !== expected.length || !timingSafeEqual(credential, expected)) {
        throw failure('Inventory authority access denied', 403);
      }
      if (request.method !== 'POST' || request.url !== '/apply') throw failure('Not found', 404);
      const chunks = [];
      let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 2048) throw failure('Inventory request exceeds 2 KiB', 413);
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw failure('Invalid inventory JSON'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw failure('Expected an inventory request object');
      const reply = await store.apply(body.requestId, body.record);
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ reply }));
    } catch (error) {
      logger.warn(`[INVENTORY] ${error.message}`);
      response.writeHead(error.status ?? 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ error: error.message }));
    }
  });
  server.requestTimeout = 5000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return { endpoint: `http://127.0.0.1:${server.address().port}/apply`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
