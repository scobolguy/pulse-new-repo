import { applySolutionDeliveries } from './solutionRuntimeBindings.mjs';

function required(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

export function createEsp32PmachineExecutor({
  baseUrl,
  pcodeFile,
  programMapFile,
  inputQueue,
  max = 65536
} = {}) {
  const normalizedBaseUrl = required(baseUrl, 'baseUrl').replace(/\/+$/, '');
  const file = required(pcodeFile, 'pcodeFile');
  const programMap = required(programMapFile, 'programMapFile');
  const queue = required(inputQueue, 'inputQueue');

  return async function executeOnEsp32(message) {
    const url = new URL('/pmachine/edge_ingress_stage', normalizedBaseUrl);
    const params = {
      file,
      programMap,
      inputQueue: queue,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      runRouter: '1',
      async: '0',
      max: String(max)
    };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(30000) });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`ESP32 returned non-JSON (${response.status}): ${text.slice(0, 240)}`);
    }
    if (!response.ok) throw new Error(`ESP32 PMachine failed (${response.status}): ${text.slice(0, 240)}`);
    if (!Array.isArray(payload.deliveries)) throw new Error('ESP32 PMachine response has no deliveries array');
    return payload;
  };
}

export function createPortableDaemonRuntime({
  queueManager,
  databaseManagers,
  conversionRuntime,
  bindingManifest,
  databaseSchemas = {},
  queues = { input: 'IncomingMessages', output: 'OutgoingPayments' },
  physicalQueues = { input: queues.input, output: queues.output },
  sourceService = 'MessageDaemon',
  workerId = sourceService,
  leaseMs = 30000,
  now = () => new Date().toISOString()
} = {}) {
  if (!queueManager) throw new Error('queueManager is required');
  if (!databaseManagers) throw new Error('databaseManagers is required');
  if (typeof conversionRuntime !== 'function') throw new Error('conversionRuntime is required');
  if (!bindingManifest) throw new Error('bindingManifest is required');

  async function processOnce() {
    const inputQueue = required(queues.input, 'queues.input');
    const physicalInputQueue = required(physicalQueues.input, 'physicalQueues.input');
    const claim = await queueManager.claim(physicalInputQueue, workerId, leaseMs);
    if (!claim) return { status: 'idle' };

    const envelope = claim.message?.messageEnvelope || {};
    const payload = claim.message?.message ?? claim.message;
    const messageId = String(claim.message?.messageId || envelope.messageId || `claim-${claim.claimToken}`).trim();
    const correlationId = String(envelope.correlationId || payload?.correlationId || messageId).trim();

    try {
      const execution = await conversionRuntime(payload);
      const applied = await applySolutionDeliveries({
        deliveries: execution.deliveries || [],
        bindingManifest,
        databaseManagers,
        queueManagers: new Map([[bindingManifest.bySymbol[queues.output]?.managerId, queueManager]]),
        databaseSchemas
      });
      await queueManager.completeClaim(physicalInputQueue, claim.claimToken, workerId, { correlationId, messageId, applied });
      return { status: 'completed', correlationId, messageId, applied, execution };
    } catch (error) {
      const detail = String(error?.message || error);
      await queueManager.failClaim(physicalInputQueue, claim.claimToken, workerId, { reason: detail });
      return { status: 'failed', correlationId, messageId, error: detail };
    }
  }

  return { processOnce, sourceService, workerId, now, outputQueue: queues.output };
}