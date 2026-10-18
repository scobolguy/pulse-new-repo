import fs from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import net from 'node:net';

const identifier = /^[A-Za-z0-9_.-]{1,128}$/;

export async function loadRuntimeMachineAuth({ filePath, required = false, ownerAggregatorId, serviceTransactions, logger = console }) {
  let configuration;
  try {
    configuration = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT' || required) throw error;
    logger.info('[RUNTIME-AUTH] No machine credentials configured; remote runtime requests require user sessions');
    configuration = { version: 1, credentials: [] };
  }
  if (configuration?.version !== 1 || !Array.isArray(configuration.credentials)) {
    throw new Error('Invalid runtime machine credential configuration');
  }
  const hashes = new Set();
  const credentials = configuration.credentials.map(credential => {
    if (!credential || !/^[a-f0-9]{64}$/.test(credential.tokenSha256)
      || hashes.has(credential.tokenSha256) || typeof credential.nodeId !== 'string'
      || net.isIP(credential.nodeId) !== 4 || typeof credential.serviceId !== 'string'
      || !identifier.test(credential.serviceId) || credential.ownerAggregatorId !== ownerAggregatorId
      || !Array.isArray(credential.childRequests) || !credential.childRequests.length
      || credential.childRequests.some(request => !request || typeof request.serviceId !== 'string'
        || !identifier.test(request.serviceId)
        || request.method !== 'POST' || typeof request.path !== 'string'
        || !/^\/[A-Za-z0-9_/-]+$/.test(request.path) || request.path.startsWith('//'))) {
      throw new Error('Invalid or duplicate runtime machine credential scope');
    }
    hashes.add(credential.tokenSha256);
    return { ...credential, digest: Buffer.from(credential.tokenSha256, 'hex') };
  });

  function authenticate(req) {
    const match = String(req.get('authorization') || '').match(/^Bearer ([A-Za-z0-9_-]{32,256})$/);
    if (!match) return null;
    const digest = createHash('sha256').update(match[1]).digest();
    return credentials.find(credential => timingSafeEqual(credential.digest, digest)) || null;
  }
  function guard(kind, fallback) {
    return async (req, res, next) => {
      const credential = authenticate(req);
      if (!credential) return fallback(req, res, next);
      const remoteAddress = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
      const instanceId = `${credential.serviceId}@${credential.nodeId}`;
      if (remoteAddress !== credential.nodeId) {
        return res.status(403).json({ error: 'Machine credential does not authorize this node' });
      }
      if (kind === 'report') {
        const report = req.body;
        if (report?.serviceId !== credential.serviceId || report.instanceId !== instanceId
          || report.nodeId !== credential.nodeId || report.ownerAggregatorId !== ownerAggregatorId
          || report.endpoint !== `http://${credential.nodeId}:80`
          || !Array.isArray(report.listeners) || report.listeners.some(listener =>
            !listener || listener.host !== credential.nodeId
            || !['http', 'udp'].includes(listener.protocol)
            || (listener.protocol === 'http' && listener.port !== 80))) {
          return res.status(403).json({ error: 'Machine credential does not authorize this service report' });
        }
        return next();
      }
      if (!credential.childRequests.some(request => request.serviceId === req.params.serviceId
        && request.method === req.body?.method && request.path === req.body?.path)) {
        return res.status(403).json({ error: 'Machine credential does not authorize this child request' });
      }
      try {
        const parentId = req.get('x-pulse-parent-transaction-id');
        const parent = parentId ? await serviceTransactions.get(parentId) : null;
        if (!parent || parent.status !== 'allocated' || parent.allocatedInstanceId !== instanceId
          || parent.serviceId !== credential.serviceId) {
          return res.status(403).json({ error: 'Machine child request requires a parent allocated to this instance' });
        }
        req.runtimeMachineInstanceId = instanceId;
        return next();
      } catch (error) {
        logger.error('[RUNTIME-AUTH] Parent verification failed:', error.message);
        return res.status(503).json({ error: 'Unable to verify machine parent transaction' });
      }
    };
  }
  return { guard };
}
