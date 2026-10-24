import express from 'express';
import path from 'node:path';
import { createFileServer } from '../fileServer.js';

const port = Number(process.env.FFS_PORT || 4015);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('FFS_PORT must be an integer from 1 to 65535');
}
const root = path.resolve(process.env.FFS_ROOT || 'ffs-root');
const app = express();
app.use(express.json());
app.use(createFileServer({ ffsConfig: { root } }).router);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[FFS] Standalone service listening on port ${port}; root=${root}`);
});
server.on('error', error => {
  console.error('[FFS] Listener failed:', error);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close());
}
