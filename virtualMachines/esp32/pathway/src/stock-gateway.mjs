import net from 'node:net';
import { timingSafeEqual } from 'node:crypto';

export async function createStockGateway({ store, host = '127.0.0.1', port = 0,
  allowedClients = ['127.0.0.1'], logger = console, transactionToken = null } = {}) {
  if (!store || typeof store.stock !== 'function' || net.isIP(host) !== 4 ||
      !Array.isArray(allowedClients) || !allowedClients.length ||
      allowedClients.some(ip => net.isIP(ip) !== 4) ||
      !Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid stock gateway configuration');
  if (transactionToken !== null && (typeof transactionToken !== 'string' ||
      transactionToken.length < 32 || transactionToken.length > 128 || typeof store.exchange !== 'function')) {
    throw new Error('Invalid inventory transaction gateway grant');
  }
  const maxRequest = transactionToken === null ? 128 : 2048;
  const allowed = new Set(allowedClients);
  const sockets = new Set();
  const server = net.createServer(socket => {
    if (!allowed.has(socket.remoteAddress?.replace(/^::ffff:/, '')) || sockets.size >= 16) {
      logger.warn('[STOCK] Rejected ungranted client or excess gateway connection');
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    socket.on('error', error => logger.warn(`[STOCK] Socket: ${error.message}`));
    socket.setTimeout(2500, () => {
      logger.warn('[STOCK] Gateway connection timed out');
      socket.destroy();
    });
    let input = Buffer.alloc(0);
    let submitted = false;
    const respond = value => {
      if (socket.destroyed) return;
      const body = Buffer.from(JSON.stringify(value));
      const header = Buffer.alloc(4);
      header.writeUInt32BE(body.length);
      socket.end(Buffer.concat([header, body]));
    };
    socket.on('data', async chunk => {
      if (submitted) {
        logger.warn('[STOCK] Only one query is allowed per connection');
        socket.destroy();
        return;
      }
      if (input.length + chunk.length > maxRequest + 4) {
        logger.warn('[STOCK] Oversized query');
        socket.destroy();
        return;
      }
      input = Buffer.concat([input, chunk]);
      if (input.length < 4) return;
      const length = input.readUInt32BE(0);
      if (!length || length > maxRequest || input.length > length + 4) {
        logger.warn('[STOCK] Invalid query frame');
        socket.destroy();
        return;
      }
      if (input.length < length + 4) return;
      submitted = true;
      try {
        let query;
        try { query = JSON.parse(input.subarray(4).toString('utf8')); }
        catch { throw Object.assign(new Error('Invalid stock query JSON'), { status: 400 }); }
        if (transactionToken !== null) {
          const credential = Buffer.from(typeof query?.inventoryToken === 'string' ? query.inventoryToken : '');
          const expected = Buffer.from(transactionToken);
          if (credential.length !== expected.length || !timingSafeEqual(credential, expected)) {
            throw Object.assign(new Error('Inventory gateway access denied'), { status: 403 });
          }
          if (!query || typeof query !== 'object' || Array.isArray(query)) {
            throw Object.assign(new Error('Invalid inventory transaction request'), { status: 400 });
          }
          const { inventoryToken: credentialValue, ...databaseQuery } = query;
          respond(await store.exchange(databaseQuery));
          return;
        }
        if (!query || typeof query !== 'object' || Array.isArray(query) ||
            Object.keys(query).length !== 1 || typeof query.item !== 'string') {
          throw Object.assign(new Error('Expected only an inventory item'), { status: 400 });
        }
        const counts = await store.stock(query.item);
        respond({ status: 200, ...counts });
      } catch (error) {
        logger.warn(`[STOCK] ${error.message}`);
        respond({ status: error.status ?? 503,
          error: [400, 403, 404, 409, 507].includes(error.status) ? error.message : 'Inventory database unavailable' });
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return {
    port: server.address().port,
    close: () => new Promise((resolve, reject) => {
      for (const socket of sockets) socket.destroy();
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}
