import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import { createServiceLifecyclePolicy } from './serviceLifecyclePolicy.mjs';
import { createServiceInstancePolicy } from '../../service-lifecycle/instance-policy.mjs';

async function readBoundedResponse(response, limit = 1000000, onChunk) {
  const declared = response.headers?.get('content-length');
  if (declared && Number(declared) > limit) {
    await response.body?.cancel();
    throw new Error('Transaction response capacity exceeded');
  }
  const chunks = [];
  let length = 0;
  if (response.body) {
    for await (const chunk of response.body) {
      length += chunk.byteLength;
      if (length > limit) throw new Error('Transaction response capacity exceeded');
      chunks.push(Buffer.from(chunk));
      await onChunk?.(chunk);
    }
  }
  return Buffer.concat(chunks, length);
}

export async function createServiceTransactions({
  storageRoot, instances, fetchImpl = fetch, logger = console, intervalMs = 5000, aggregatorId,
  maxRecords = 10000,
}) {
  if (!storageRoot || typeof instances !== 'function') throw new Error('Transaction storage and instance source are required');
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1) throw new Error('Invalid transaction storage capacity');
  if (aggregatorId !== undefined && (typeof aggregatorId !== 'string'
    || !/^[A-Za-z0-9_.:-]{1,128}$/.test(aggregatorId))) throw new Error('Invalid ingress aggregator identity');
  const policy = await createServiceLifecyclePolicy({
    source: '../../../../src/service-lifecycle/transactions.pas',
    collectorId: 'pulse-service-transaction-policy', logger,
  });
  const clientPolicy = await createServiceInstancePolicy({ logger });
  const records = new Map();
  const inFlight = new Map();
  const dispatches = new Set();
  const root = path.resolve(storageRoot);
  const archiveRoot = path.join(root, 'archive');
  await fs.mkdir(archiveRoot, { recursive: true });
  let pending = Promise.resolve();
  let timer = null;
  let stopped = false;
  function enqueue(operation) {
    const result = pending.then(operation);
    pending = result.catch(error => logger.error('[SERVICE-TRANSACTION]', error.message));
    return result;
  }
  async function write(record) {
    const destination = path.join(root, `${record.transactionId}.json`);
    const temporary = `${destination}.tmp`;
    const file = await fs.open(temporary, 'w');
    try { await file.writeFile(`${JSON.stringify(record)}\n`); await file.sync(); }
    finally { await file.close(); }
    await fs.rename(temporary, destination);
    records.set(record.transactionId, record);
  }
  async function transition(record, event, extra = {}) {
    const next = await policy.dispatch('/transition', { status: record.status, event });
    const updated = { ...record, ...next, ...extra, updatedAt: new Date().toISOString() };
    await write(updated);
    return updated;
  }
  async function archiveCompleted() {
    const referenced = new Set();
    for (const record of records.values()) {
      if (record.status !== 'completed' && record.childTransactionId) referenced.add(record.childTransactionId);
    }
    let archived = 0;
    for (const record of records.values()) {
      if (record.status !== 'completed' || referenced.has(record.transactionId)) continue;
      const parent = records.get(record.parentTransactionId);
      if (parent && parent.status !== 'completed') continue;
      const name = `${record.transactionId}.json`;
      await fs.rename(path.join(root, name), path.join(archiveRoot, name));
      records.delete(record.transactionId);
      archived++;
    }
    if (archived) logger.log(`[SERVICE-TRANSACTION] Archived ${archived} completed transactions`);
  }
  async function get(id) {
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return undefined;
    const active = records.get(id);
    if (active) return active;
    let content;
    try { content = await fs.readFile(path.join(archiveRoot, `${id}.json`), 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    }
    const record = JSON.parse(content);
    if (record.transactionId !== id || record.status !== 'completed') throw new Error('Invalid archived transaction');
    return record;
  }
  for (const name of await fs.readdir(root)) {
    if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
    const record = JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
    if (`${record.transactionId}.json` !== name) throw new Error('Invalid transaction storage identity');
    records.set(record.transactionId, record);
    if (record.status !== 'completed') await transition(record, 'restore');
  }
  await archiveCompleted();
  function normalizeInstances(observations) {
    return observations.map(instance => ({
      ...instance, serviceId: instance.serviceId || instance.serviceName,
      reporting: instance.reporting || 'unobserved',
      readiness: instance.readiness || { ready: false }, draining: instance.draining === true,
      dependencyBindings: Object.entries(instance.dependencies || {}).map(([serviceId, binding]) => ({ ...binding, serviceId })),
      listeners: instance.listeners || [], inflight: inFlight.get(instance.instanceId) || 0,
    }));
  }
  async function allocate(record, observer) {
    const candidates = normalizeInstances(await instances());
    const decision = await policy.dispatch('/allocate', { serviceId: record.serviceId, instances: candidates });
    if (decision.action === 'hold') {
      return record.reason === decision.reason ? record : transition(record, 'hold', { reason: decision.reason });
    }
    const { instanceId, listener } = decision.selection;
    const { protocol, host, port, basePath = '' } = listener;
    if (!['http', 'https'].includes(protocol) || typeof host !== 'string' || !host
      || !Number.isInteger(port) || port < 1 || port > 65535
      || (net.isIP(host) === 0 && !/^[A-Za-z0-9.-]+$/.test(host))
      || typeof basePath !== 'string' || /[?#\\]/.test(basePath)) {
      throw new Error('Invalid announced service listener');
    }
    const base = new URL(`${protocol}://${net.isIP(host) === 6 ? `[${host}]` : host}:${port}`);
    const target = new URL(`${basePath.replace(/\/$/, '')}${record.request.path}`, base);
    if (target.origin !== base.origin) throw new Error('Request path escaped service listener');
    const dispatchPolicy = await policy.dispatch('/dispatch-policy', { serviceId: record.serviceId });
    const allocated = await transition(record, 'allocate', {
      allocatedInstanceId: instanceId, allocatedDependencies: decision.selection.dependencies, reason: '',
    });
    inFlight.set(instanceId, (inFlight.get(instanceId) || 0) + 1);
    const dispatch = (async () => {
      try {
        const response = await fetchImpl(target, {
          method: record.request.method, redirect: 'error', signal: AbortSignal.timeout(dispatchPolicy.timeoutMs),
          headers: {
            'content-type': 'application/json', ...record.request.headers,
            'x-pulse-transaction-id': record.transactionId,
            ...(aggregatorId ? { 'x-pulse-ingress-aggregator-id': aggregatorId } : {}),
          },
          ...(['GET', 'HEAD'].includes(record.request.method) ? {} : {
            body: record.request.bodyEncoding === 'base64'
              ? Buffer.from(record.request.body, 'base64') : JSON.stringify(record.request.body),
          }),
        });
        const contentType = response.headers.get('content-type') || 'text/plain';
        observer?.start(response.status, contentType, record.transactionId);
        const bytes = await readBoundedResponse(response, record.responseLimit, observer?.chunk);
        const textual = /^text\/|json|xml|ndjson/i.test(contentType);
        const content = bytes.toString(textual ? 'utf8' : 'base64');
        let body;
        if (textual) {
          try { body = JSON.parse(content); } catch { body = content; }
        } else body = content;
        await enqueue(async () => {
          if (body && typeof body === 'object' && Object.hasOwn(body, 'pulseContinuation')) {
            if (response.status !== 202) throw new Error('Continuation requires HTTP 202');
            const continuation = body.pulseContinuation;
            const child = records.get(continuation?.transactionId);
            if (!child) throw new Error('Unknown transaction continuation');
            await policy.dispatch('/continuation', {
              parent: allocated, child: { parentTransactionId: '', ...child }, continuation,
            });
            await transition(allocated, 'continuation', {
              childTransactionId: child.transactionId, childServiceId: child.serviceId,
            });
          } else {
            await transition(allocated, 'reply', { result: {
              status: response.status, body, contentType, ...(!textual ? { bodyEncoding: 'base64' } : {}),
            } });
          }
        });
        observer?.end();
      } catch (error) {
        await enqueue(() => transition(allocated, 'transport-failed', { transportError: error.message }));
        observer?.error(error, record.transactionId);
      } finally { inFlight.set(instanceId, Math.max(0, (inFlight.get(instanceId) || 1) - 1)); }
    })().catch(error => logger.error('[SERVICE-TRANSACTION] Completion persistence failed:', error.message));
    dispatches.add(dispatch);
    void dispatch.finally(() => dispatches.delete(dispatch));
    return allocated;
  }
  async function reconcile() {
    for (const record of records.values()) {
      if (record.status === 'held') {
        try { await allocate(record); }
        catch (error) { logger.error(`[SERVICE-TRANSACTION] ${record.transactionId}:`, error.message); }
      } else if (record.status === 'waiting-child') {
        const child = records.get(record.childTransactionId);
        if (!child || child.parentTransactionId !== record.transactionId || child.serviceId !== record.childServiceId) {
          await transition(record, 'child-uncertain', { transportError: 'Persisted continuation identity is invalid' });
        } else if (child.status === 'completed') {
          await transition(record, 'child-reply', {
            result: { status: 200, body: {
              status: child.result.status,
              body: typeof child.result.body === 'string' ? child.result.body : JSON.stringify(child.result.body),
            } },
          });
        } else if (child.status === 'uncertain') {
          await transition(record, 'child-uncertain', { transportError: child.transportError });
        }
      }
    }
    await archiveCompleted();
  }
  function schedule() {
    if (stopped) return;
    timer = setTimeout(() => {
      enqueue(reconcile).finally(schedule).catch(error => logger.error('[SERVICE-TRANSACTION] Reconcile failed:', error.message));
    }, intervalMs);
    timer.unref?.();
  }
  schedule();
  const api = {
    submit: (serviceId, request, { parentTransactionId, parentInstanceId, observer, responseLimit = 1000000 } = {}) => enqueue(async () => {
      if (stopped) throw Object.assign(new Error('Service transaction dispatcher is stopped'), { status: 503 });
      if (typeof serviceId !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(serviceId)
        || !request || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(request.method)
        || typeof request.path !== 'string' || !request.path.startsWith('/') || request.path.startsWith('//')
        || /[\\\r\n#]/.test(request.path) || request.path.length > 2048) {
        throw Object.assign(new Error('Invalid logical service transaction request'), { status: 400 });
      }
      if (request.headers && Object.entries(request.headers).some(([name, value]) =>
        !['content-type', 'x-filename'].includes(name) || typeof value !== 'string' || /[\r\n]/.test(value))) {
        throw Object.assign(new Error('Invalid transaction request headers'), { status: 400 });
      }
      if (request.bodyEncoding !== undefined && (request.bodyEncoding !== 'base64'
        || typeof request.body !== 'string' || request.body.length % 4 !== 0
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(request.body))) {
        throw Object.assign(new Error('Invalid transaction body encoding'), { status: 400 });
      }
      if (Buffer.byteLength(JSON.stringify(request)) > (request.bodyEncoding === 'base64' ? 70000000 : 65536)) {
        throw Object.assign(new Error('Transaction request capacity exceeded'), { status: 413 });
      }
      if (records.size >= maxRecords) await archiveCompleted();
      if (records.size >= maxRecords) throw Object.assign(new Error('Transaction storage capacity exceeded'), { status: 503 });
      if (parentTransactionId) {
        const parent = records.get(parentTransactionId);
        if (!parent || parent.status !== 'allocated'
          || (parentInstanceId && parent.allocatedInstanceId !== parentInstanceId)) {
          throw Object.assign(new Error('Parent transaction is not allocated'), { status: 409 });
        }
      }
      const created = { transactionId: randomUUID(), serviceId, request, responseLimit,
        ...(parentTransactionId ? { parentTransactionId } : {}),
        status: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      if (parentTransactionId) {
        await policy.dispatch('/continuation', {
          parent: records.get(parentTransactionId), child: created,
          continuation: { transactionId: created.transactionId, serviceId },
        });
      }
      const record = await transition(created, 'accept');
      try { return await allocate(record, observer); }
      catch (error) {
        logger.error('[SERVICE-TRANSACTION] Allocation deferred:', error.message);
        return transition(record, 'hold', { reason: `Allocation deferred: ${error.message}` });
      }
    }),
    get,
    clientDecision: async (transaction, elapsedMs) => {
      const settings = await clientPolicy.dispatch('/transport-policy', {});
      const decision = await clientPolicy.dispatch('/transaction-action', { transaction, elapsedMs });
      return { action: decision.action, pollMs: settings.transactionPollMs };
    },
    snapshot: async () => {
      const observations = await instances();
      const decision = await policy.dispatch('/allocate', {
        serviceId: '', instances: normalizeInstances(observations),
      });
      return observations.map(instance => ({
        ...instance, dependencyChainReady: decision.eligible[instance.instanceId] === true,
      }));
    },
    request: async (serviceId, request) => {
      const settings = await clientPolicy.dispatch('/transport-policy', {});
      const started = Date.now();
      let transaction = await api.submit(serviceId, request);
      while (true) {
        if (stopped) throw Object.assign(
          new Error(`Transaction client stopped; durable transaction ${transaction.transactionId} remains tracked`),
          { status: 503, transactionId: transaction.transactionId },
        );
        const decision = await clientPolicy.dispatch('/transaction-action', {
          transaction: { status: transaction.status }, elapsedMs: Date.now() - started,
        });
        if (decision.action === 'return') return transaction.result;
        if (decision.action !== 'poll') {
          throw Object.assign(new Error(`Service ${serviceId} transaction ${transaction.transactionId}: ${transaction.reason || decision.action}`), {
            status: 503, transactionId: transaction.transactionId,
          });
        }
        await new Promise(resolve => setTimeout(resolve, settings.transactionPollMs));
        transaction = await get(transaction.transactionId);
      }
    },
    reconcile: () => enqueue(reconcile),
    stop: async () => {
      stopped = true; clearTimeout(timer);
      await Promise.allSettled([...dispatches]); await pending; await policy.stop(); await clientPolicy.stop();
    },
  };
  return api;
}

export async function forwardServiceRequest(transactions, serviceId, request, res) {
  const observer = {
    start(status, contentType, id) {
      if (res.destroyed) return;
      res.status(status);
      res.setHeader('content-type', contentType);
      res.setHeader('x-pulse-transaction-id', id);
      if (contentType.includes('application/x-ndjson')) {
        res.setHeader('cache-control', 'no-cache, no-transform');
        res.setHeader('x-accel-buffering', 'no');
      }
      res.flushHeaders?.();
    },
    chunk: async chunk => {
      if (res.destroyed || res.write(chunk)) return;
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          res.removeListener('drain', onDrain);
          res.removeListener('close', onDrain);
          res.removeListener('error', onError);
        };
        function onDrain() { cleanup(); resolve(); }
        function onError(error) { cleanup(); reject(error); }
        res.once('drain', onDrain);
        res.once('close', onDrain);
        res.once('error', onError);
      });
    },
    end() { if (!res.destroyed) res.end(); },
    error(error, transactionId) {
      if (res.destroyed) return;
      if (res.headersSent) res.destroy(error);
      else {
        if (transactionId) res.setHeader('x-pulse-transaction-id', transactionId);
        res.status(error.status || 502).json({
          error: transactionId ? `${error.message}; durable transaction ${transactionId} is uncertain` : error.message,
          ...(transactionId ? { transactionId, status: 'uncertain', statusUrl: `/api/runtime/transactions/${transactionId}` } : {}),
        });
      }
    },
  };
  try {
    const transaction = await transactions.submit(serviceId, request, {
      observer, responseLimit: 50000000,
    });
    if (transaction.status === 'held' && !res.destroyed) {
      res.setHeader('x-pulse-transaction-id', transaction.transactionId);
      res.setHeader('x-pulse-transaction-state', 'held');
      res.status(202).json({
        transactionId: transaction.transactionId, status: transaction.status,
        statusUrl: `/api/runtime/transactions/${transaction.transactionId}`,
      });
    }
  } catch (error) {
    observer.error(error);
  }
}
