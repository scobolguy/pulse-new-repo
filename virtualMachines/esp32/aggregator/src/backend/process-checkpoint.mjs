const MAX_CONTEXT_BYTES = 65536;

function requiredText(value, label) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 256)
    throw new Error(`Invalid ${label}`);
  return value;
}

function jsonBytes(value, label) {
  let text;
  try { text = JSON.stringify(value); } catch (error) {
    throw new Error(`${label} is not serializable`, { cause: error });
  }
  const bytes = Buffer.from(text);
  if (bytes.length < 1 || bytes.length > MAX_CONTEXT_BYTES)
    throw new Error(`${label} exceeds ${MAX_CONTEXT_BYTES} bytes`);
  return { text, bytes };
}

/**
 * Application-level checkpoint API over the existing two-replica checkpoint
 * store. The pmachine only executes the caller; ownership and durability stay
 * with the coordinator.
 */
export class ProcessCheckpointCoordinator {
  constructor({ pair, processId, codeId, nodeId, executionEpoch = 0, now = () => Date.now() }) {
    if (!pair || typeof pair.replicate !== 'function' || typeof pair.read !== 'function')
      throw new Error('A replicated checkpoint pair is required');
    this.pair = pair;
    this.processId = requiredText(processId, 'process ID');
    this.codeId = requiredText(codeId, 'code ID');
    this.nodeId = requiredText(nodeId, 'node ID');
    if (!Number.isSafeInteger(executionEpoch) || executionEpoch < 0)
      throw new Error('Invalid execution epoch');
    this.executionEpoch = executionEpoch;
    this.now = now;
    this.sequence = 0;
  }

  async checkpointProcess(state, {
    screenState = null,
    transactionContext = { active: [], completed: [] },
    lastCompletedTransactionId = null,
  } = {}) {
    const envelope = {
      formatVersion: 1,
      sequence: ++this.sequence,
      processId: this.processId,
      codeId: this.codeId,
      nodeId: this.nodeId,
      executionEpoch: this.executionEpoch,
      createdAt: new Date(this.now()).toISOString(),
      state,
      screenState,
      transactionContext,
      lastCompletedTransactionId,
    };
    const { bytes } = jsonBytes(envelope, 'checkpoint');
    const receipt = await this.pair.replicate(bytes);
    return {
      checkpointId: receipt.digest,
      sequence: envelope.sequence,
      processId: this.processId,
      executionEpoch: this.executionEpoch,
      bytes: receipt.bytes,
      replicas: receipt.replicas,
    };
  }

  async restoreCheckpoint(checkpointId, { executionEpoch, nodeId = this.nodeId } = {}) {
    requiredText(checkpointId, 'checkpoint ID');
    if (!Number.isSafeInteger(executionEpoch) || executionEpoch !== this.executionEpoch)
      throw new Error('Restore epoch does not match the recovery owner');
    requiredText(nodeId, 'node ID');
    const result = await this.pair.read(checkpointId);
    let envelope;
    try { envelope = JSON.parse(result.data.toString('utf8')); } catch (error) {
      throw new Error('Checkpoint envelope is invalid JSON', { cause: error });
    }
    if (envelope.formatVersion !== 1 || envelope.processId !== this.processId ||
        envelope.codeId !== this.codeId || envelope.executionEpoch >= executionEpoch) {
      throw new Error('Checkpoint is incompatible with the recovery owner');
    }
    return {
      ...result,
      checkpointId,
      processId: this.processId,
      nodeId,
      executionEpoch,
      state: envelope.state,
      screenState: envelope.screenState,
      transactionContext: envelope.transactionContext,
      lastCompletedTransactionId: envelope.lastCompletedTransactionId,
      transactionsToAbort: envelope.transactionContext?.active || [],
    };
  }
}

export const checkpointProcess = (coordinator, ...args) =>
  coordinator.checkpointProcess(...args);

export const restoreCheckpoint = (coordinator, ...args) =>
  coordinator.restoreCheckpoint(...args);
