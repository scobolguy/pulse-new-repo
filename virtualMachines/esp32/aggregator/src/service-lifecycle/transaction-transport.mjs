import { setTimeout as delay } from 'node:timers/promises';
import { createServiceInstancePolicy } from './instance-policy.mjs';

export function createLogicalServiceTransport({
  aggregatorUrls, serviceId, policy: suppliedPolicy, fetchImpl = fetch, token = '', maxResponseBytes = 1000000,
} = {}) {
  if (!Array.isArray(aggregatorUrls) || !aggregatorUrls.length) {
    throw new Error('Logical service transactions require configured PULSE_AGGREGATOR_URLS');
  }
  const base = new URL(aggregatorUrls[0]);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Invalid aggregator transaction endpoint');
  }
  const origin = base.href.replace(/\/$/, '');
  let ownedPolicy;
  async function policy() {
    if (suppliedPolicy) return suppliedPolicy;
    ownedPolicy ??= createServiceInstancePolicy();
    return ownedPolicy;
  }

  async function json(url, { body, signal, timeoutMs }) {
    const response = await fetchImpl(url, {
      method: body !== undefined ? 'POST' : 'GET', redirect: 'error',
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body ?? []) {
      bytes += chunk.length;
      if (bytes > maxResponseBytes) throw new Error('Aggregator transaction response exceeds byte limit');
      chunks.push(Buffer.from(chunk));
    }
    const document = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!response.ok) throw Object.assign(new Error(document.error || `Aggregator HTTP ${response.status}`), { status: response.status });
    return document;
  }

  return {
    async request({ method = 'GET', path, body }, { signal } = {}) {
      const dispatch = await policy();
      const settings = await dispatch.dispatch('/transport-policy', {});
      const started = Date.now();
      let transaction;
      try {
        transaction = await json(`${origin}/api/runtime/services/${encodeURIComponent(serviceId)}/transactions`, {
          body: { method, path, ...(body !== undefined ? { body } : {}) },
          signal, timeoutMs: settings.timeoutMs,
        });
      } catch (error) {
        throw Object.assign(new Error(`Logical service ${serviceId} submission outcome is uncertain; not retried: ${error.message}`), {
          status: 503, uncertain: true,
        });
      }
      const transactionId = transaction.transactionId;
      if (typeof transactionId !== 'string' || !transactionId) throw new Error('Aggregator did not supply a transactionId');
      const statusUrl = new URL(transaction.statusUrl, `${origin}/`);
      if (statusUrl.origin !== base.origin || statusUrl.username || statusUrl.password ||
          !statusUrl.pathname.startsWith('/api/runtime/transactions/')) {
        throw Object.assign(new Error(`Invalid statusUrl for transaction ${transactionId}`), { transactionId });
      }
      while (true) {
        const decision = await dispatch.dispatch('/transaction-action', {
          transaction, elapsedMs: Date.now() - started,
        });
        if (decision.action === 'return') {
          if (!transaction.result || !Number.isInteger(transaction.result.status)) {
            throw Object.assign(new Error(`Missing result for transaction ${transactionId}`), { transactionId });
          }
          return transaction.result;
        }
        if (decision.action !== 'poll') {
          throw Object.assign(new Error(`Logical service ${serviceId} transaction ${transactionId}: ${decision.action === 'timeout' ? 'still pending after 30 seconds' : transaction.reason || transaction.transportError || transaction.status}`), {
            status: 503, transactionId, uncertain: transaction.status === 'uncertain',
          });
        }
        try {
          await delay(Math.min(settings.transactionPollMs,
            Math.max(0, settings.transactionTimeoutMs - (Date.now() - started))), null, { signal });
          const remaining = settings.transactionTimeoutMs - (Date.now() - started);
          if (remaining > 0) {
            transaction = await json(statusUrl.href, { signal, timeoutMs: Math.min(remaining, settings.timeoutMs) });
            if (transaction.transactionId !== transactionId) throw new Error('Transaction status identity mismatch');
          }
        } catch (error) {
          throw Object.assign(new Error(`Status transport failed for durable transaction ${transactionId}: ${error.message}`), {
            status: 503, transactionId,
          });
        }
      }
    },
    async stop() {
      if (ownedPolicy) await (await ownedPolicy).stop();
    },
  };
}
