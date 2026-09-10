/**
 * Queue Manager provider contract.
 *
 * This documents the CORE work-queue interface that backend.mjs's router/
 * claim hot path actually depends on (see queueManagers[i].<method>() call
 * sites in backend.mjs). Any provider returned by createQueueManagerProvider()
 * must implement these methods with matching return shapes so the router
 * code works unmodified regardless of which backend is selected.
 *
 * CORE (must be implemented by every provider):
 *   createQueue(queueName, queueConfig?) -> queueConfig
 *   getConfig(queueName) -> queueConfig
 *   getStatus(queueName) -> queueConfig (frozen flag)
 *   updateQueueConfig(queueName, updates) -> queueConfig
 *   deleteQueue(queueName) -> void
 *   truncateQueue(queueName) -> removedCount
 *   enqueue(queueName, message, sourceService, messageId?, messageEnvelope?) -> messageId
 *   dequeue(queueName, consumerService) -> queuedItem | null
 *   claim(queueName, workerId, leaseMs?) -> { queueName, workerId, claimToken, leaseExpiresAt, attempts, message } | null
 *   heartbeatClaim(queueName, claimToken, workerId, extendMs?) -> { queueName, claimToken, workerId, leaseExpiresAt } | null | 'forbidden'
 *   completeClaim(queueName, claimToken, workerId, completionMeta?) -> { queueName, claimToken, workerId, messageId, attempts } | null | 'forbidden'
 *   failClaim(queueName, claimToken, workerId, options?) -> { status: 'dead-letter'|'requeued', ... } | null | 'forbidden'
 *   reapExpiredClaims(queueName?, nowMs?) -> requeuedCount
 *   getQueueLength(queueName) -> number
 *   getPersistenceStatus() -> { enabled, ... }
 *
 * PULSE-REPLICATION-SPECIFIC (only meaningful for the in-house 'legacy'
 * engine's manual primary/secondary mirroring — external brokers replicate
 * natively, so these are no-ops/throw-clearly on other providers):
 *   enqueueReplicated, dequeueReplicated, getSnapshot, applySnapshot,
 *   getCurrentVersion, getOperationsSince, applyReplicatedOperation,
 *   onConfigChange, freezeQueue, thawQueue
 *
 * IMPORTANT — current limitation: the 'legacy' provider's methods are
 * synchronous (pure in-memory JS); any real external broker (RabbitMQ,
 * Kafka, IBM MQ) is inherently network I/O, so this adapter's methods
 * return Promises. backend.mjs's router/replication/metrics code
 * (queueManagers[i].enqueue/dequeue/claim/... call sites, plus
 * updateMetricsQueueDepths()) currently calls these SYNCHRONOUSLY in a
 * few places. `await`-ing a non-Promise value is a safe no-op, so those
 * call sites need `await` added (and their enclosing functions marked
 * `async`, which most already are) before selecting a non-'legacy'
 * provider is safe in the Gateway. That conversion has NOT been done yet
 * — see repo memory for the exact line numbers found during the audit.
 * `QUEUE_MANAGER_PROVIDER=rabbitmq` is verified to construct + connect the
 * adapter correctly (tested directly against this factory), but has NOT
 * been exercised through the Gateway's router hot path end-to-end.
 */
import { readEnvString } from '../../env-config.mjs';
import QueueManager from '../QueueManager.mjs';
import RabbitMqQueueManagerAdapter from './RabbitMqQueueManagerAdapter.mjs';

export const QUEUE_MANAGER_SUPPORTED_PROVIDERS = ['legacy', 'rabbitmq'];

export function normalizeQueueManagerProvider(value) {
  const normalized = String(value || 'legacy').trim().toLowerCase();
  return QUEUE_MANAGER_SUPPORTED_PROVIDERS.includes(normalized) ? normalized : 'legacy';
}

/**
 * @param {string} name - e.g. 'qm-primary'
 * @param {string|null} persistPath - only used by the 'legacy' provider
 * @param {object} [options]
 * @param {string} [options.provider] - defaults to QUEUE_MANAGER_PROVIDER env var, then 'legacy'
 */
export function createQueueManagerProvider(name, persistPath, options = {}) {
  const provider = normalizeQueueManagerProvider(
    options.provider || readEnvString('QUEUE_MANAGER_PROVIDER', 'legacy')
  );

  if (provider === 'rabbitmq') {
    return new RabbitMqQueueManagerAdapter(name, options);
  }

  // Default: unchanged in-house engine (identical behavior to before this module existed).
  return new QueueManager(name, persistPath);
}
