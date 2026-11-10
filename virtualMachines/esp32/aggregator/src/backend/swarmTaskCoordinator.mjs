import { randomUUID } from 'node:crypto';
import { scoreCandidates } from './allocator/economicAllocator.mjs';
import { DurableRecordJournal } from './durableRecordJournal.mjs';

const MAX_STATE_BYTES = 65536;
const MAX_RECORD_BYTES = 3 * MAX_STATE_BYTES;
const MAX_JOURNAL_BYTES = 32 * 1024 * 1024;
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

function requireInteger(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new Error(`Invalid ${label}`);
  return value;
}

function requireName(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(value))
    throw new Error(`Invalid ${label}`);
  return value;
}

function requireCodeId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new Error('codeId must be a SHA-256 of the executable bundle');
  return value;
}

export function copyCheckpointState(value) {
  const ancestors = new Set();
  function validate(item, depth) {
    if (depth > 32) throw new Error('Checkpoint data is too deeply nested');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item) &&
        (!Number.isInteger(item) || Number.isSafeInteger(item))) return;
    if (typeof item !== 'object' || ancestors.has(item) ||
        (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype))
      throw new Error('Checkpoint data must contain only portable JSON values');
    ancestors.add(item);
    for (const key of Reflect.ownKeys(item)) {
      if (Array.isArray(item) && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor))
        throw new Error('Checkpoint data must not contain accessors or hidden properties');
      validate(descriptor.value, depth + 1);
    }
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length ||
          Object.keys(item).some((key, index) => key !== String(index)))
        throw new Error('Checkpoint arrays must be dense without extra properties');
    }
    ancestors.delete(item);
  }
  validate(value, 0);
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) > MAX_STATE_BYTES) throw new Error('Checkpoint data exceeds capacity');
  return JSON.parse(text);
}

const copyState = copyCheckpointState;

// One authoritative writer. An abandoned lock requires operator recovery, not
// automatic lock stealing; this is not a consensus store for multiple aggregators.
export class SwarmTaskJournal extends DurableRecordJournal {
  constructor(filePath) {
    super(filePath, {
      recordKey: 'task', label: 'Task journal',
      maxRecordBytes: MAX_RECORD_BYTES, maxJournalBytes: MAX_JOURNAL_BYTES,
    });
  }
}

export class SwarmTaskCoordinator {
  constructor({
    journal, now = Date.now, maxTasks = 256, leaseMs = 30000, reportMaxAgeMs = 30000,
    authorizeMutation,
  } = {}) {
    if (!(journal instanceof SwarmTaskJournal)) throw new Error('A durable task journal is required');
    if (journal.coordinatorAttached) throw new Error('Task journal already has an authoritative coordinator');
    if (typeof now !== 'function') throw new Error('A clock is required');
    this.journal = journal;
    if (authorizeMutation !== undefined && typeof authorizeMutation !== 'function')
      throw new Error('Task mutation authority must be a function');
    this.authorizeMutation = authorizeMutation;
    this.now = now;
    this.maxTasks = requireInteger(maxTasks, 'task capacity', 1, 4096);
    this.leaseMs = requireInteger(leaseMs, 'lease duration', 1, 300000);
    this.reportMaxAgeMs = requireInteger(reportMaxAgeMs, 'report age', 1, 300000);
    this.tasks = new Map();
    for (const record of journal.records) {
      this.validateRecord(record);
      const previous = this.tasks.get(record.id);
      if (previous && (record.epoch < previous.epoch ||
          record.checkpoint.sequence < previous.checkpoint.sequence ||
          (previous.leadershipEpoch !== undefined &&
            (record.leadershipEpoch === undefined || record.leadershipEpoch < previous.leadershipEpoch)) ||
          record.codeId !== previous.codeId || record.clusterId !== previous.clusterId))
        throw new Error('Task journal contains an inconsistent history');
      this.tasks.set(record.id, structuredClone(record));
    }
    if (this.tasks.size > this.maxTasks) throw new Error('Stored tasks exceed configured capacity');
    journal.coordinatorAttached = true;
  }

  validateRecord(task) {
    requireName(task.id, 'task id');
    requireName(task.clusterId, 'cluster id');
    requireName(task.capability, 'task capability');
    requireCodeId(task.codeId);
    requireInteger(task.memoryBytes, 'task memory', 1, 1024 * 1024 * 1024);
    requireInteger(task.epoch, 'task epoch', 0, Number.MAX_SAFE_INTEGER);
    if (task.leadershipEpoch !== undefined)
      requireInteger(task.leadershipEpoch, 'task leadership epoch', 1, Number.MAX_SAFE_INTEGER);
    if (this.authorizeMutation && task.leadershipEpoch === undefined)
      throw new Error('Witnessed admission cannot load unfenced task history');
    requireInteger(task.checkpoint?.sequence, 'checkpoint sequence', 0, Number.MAX_SAFE_INTEGER);
    copyState(task.checkpoint.state);
    if (!['ready', 'running', ...TERMINAL].includes(task.status)) throw new Error('Invalid stored task status');
    if (task.status === 'running') {
      requireName(task.owner, 'task owner');
      requireInteger(task.leaseExpiresAt, 'lease expiry', 1, Number.MAX_SAFE_INTEGER);
      if (!task.epoch) throw new Error('Running task has no ownership epoch');
    } else if (task.owner !== null || task.leaseExpiresAt !== 0) {
      throw new Error('Inactive task retains an ownership lease');
    }
    if (task.lastFailedNode !== null) requireName(task.lastFailedNode, 'failed node');
    copyState(task.result);
    copyState(task.failure);
  }

  timestamp() {
    return requireInteger(this.now(), 'clock timestamp', 0, Number.MAX_SAFE_INTEGER - this.leaseMs);
  }

  persist(task) {
    if (this.authorizeMutation) {
      const leadership = this.authorizeMutation();
      if (task.clusterId !== leadership.clusterId) throw new Error('Task belongs to a different witnessed swarm');
      task = { ...task, leadershipEpoch: leadership.epoch };
    }
    this.validateRecord(task);
    this.journal.append(task);
    this.tasks.set(task.id, task);
    return structuredClone(task);
  }

  get(taskId) {
    const task = this.tasks.get(requireName(taskId, 'task id'));
    if (!task) throw new Error('Task not found');
    return structuredClone(task);
  }

  submit({ id = randomUUID(), clusterId, codeId, capability = 'pmachine', memoryBytes, state }) {
    requireName(id, 'task id');
    if (this.tasks.has(id)) throw new Error('Task id already exists');
    if (this.tasks.size >= this.maxTasks) throw new Error('Task capacity exhausted');
    return this.persist({
      id, clusterId, codeId, capability, memoryBytes, checkpoint: { sequence: 0, state: copyState(state) },
      epoch: 0, status: 'ready', owner: null, leaseExpiresAt: 0,
      lastFailedNode: null, result: null, failure: null,
    });
  }

  expireLeases() {
    const timestamp = this.timestamp();
    for (const task of this.tasks.values()) {
      if (task.status === 'running' && task.leaseExpiresAt <= timestamp) {
        this.persist({
          ...task, status: 'ready', owner: null, leaseExpiresAt: 0, lastFailedNode: task.owner,
          failure: { kind: 'board-loss', reason: 'Ownership lease expired', nodeId: task.owner },
        });
      }
    }
  }

  claim(taskId, nodes) {
    if (!Array.isArray(nodes)) throw new Error('Node resource reports are required');
    this.expireLeases();
    const task = this.get(taskId);
    if (task.status !== 'ready') throw new Error(`Task is ${task.status}, not ready`);
    const timestamp = this.timestamp();
    const reservations = new Map();
    for (const active of this.tasks.values()) {
      if (active.status !== 'running') continue;
      const reserved = reservations.get(active.owner) || { slots: 0, memoryBytes: 0 };
      reserved.slots += 1;
      reserved.memoryBytes += active.memoryBytes;
      reservations.set(active.owner, reserved);
    }
    const seen = new Set();
    const candidates = [];
    for (const node of nodes) {
      requireName(node.nodeId, 'node id');
      if (seen.has(node.nodeId)) throw new Error('Duplicate node resource report');
      seen.add(node.nodeId);
      requireInteger(node.observedAt, 'node report timestamp', 0, Number.MAX_SAFE_INTEGER);
      requireInteger(node.estimatedFreeSlots, 'node free slots', 0, 4096);
      requireInteger(node.freeMemoryBytes, 'node free memory', 0, 1024 * 1024 * 1024);
      if (node.clusterId !== task.clusterId || node.status !== 'online' ||
          node.nodeId === task.lastFailedNode || node.observedAt > timestamp ||
          timestamp - node.observedAt > this.reportMaxAgeMs ||
          !Array.isArray(node.codeIds) || !node.codeIds.includes(task.codeId)) continue;
      const reserved = reservations.get(node.nodeId) || { slots: 0, memoryBytes: 0 };
      if (node.freeMemoryBytes - reserved.memoryBytes < task.memoryBytes) continue;
      candidates.push({
        ...node, id: node.nodeId,
        estimatedFreeSlots: Math.max(0, node.estimatedFreeSlots - reserved.slots),
      });
    }
    const selected = scoreCandidates({ requiredCapability: task.capability }, candidates)
      .candidates.find(candidate => candidate.accepted);
    if (!selected) throw new Error('No compatible swarm node has available capacity');
    requireInteger(task.epoch + 1, 'next task epoch', 1, Number.MAX_SAFE_INTEGER);
    return this.persist({
      ...task, epoch: task.epoch + 1, status: 'running', owner: selected.nodeId,
      leaseExpiresAt: timestamp + this.leaseMs,
    });
  }

  owned(token) {
    this.journal.requireAvailable();
    const task = this.get(token?.id);
    if (this.authorizeMutation) {
      const leadership = this.authorizeMutation();
      if (task.leadershipEpoch !== leadership.epoch || token.leadershipEpoch !== task.leadershipEpoch)
        throw new Error('Task ownership belongs to a superseded swarm leader');
    }
    if (task.status !== 'running' || task.owner !== token.owner || task.epoch !== token.epoch ||
        task.leaseExpiresAt <= this.timestamp()) throw new Error('Stale task ownership lease');
    return task;
  }

  renew(token) {
    const task = this.owned(token);
    return this.persist({ ...task, leaseExpiresAt: this.timestamp() + this.leaseMs });
  }

  commit(token, expectedSequence, state) {
    const task = this.owned(token);
    requireInteger(expectedSequence, 'expected checkpoint sequence', 0, Number.MAX_SAFE_INTEGER - 1);
    if (task.checkpoint.sequence !== expectedSequence) throw new Error('Stale checkpoint sequence');
    return this.persist({
      ...task, checkpoint: { sequence: expectedSequence + 1, state: copyState(state) },
    });
  }

  complete(token, result) {
    const task = this.owned(token);
    return this.persist({
      ...task, status: 'completed', owner: null, leaseExpiresAt: 0, result: copyState(result),
    });
  }

  fail(token, { kind, reason }) {
    if (!['runtime-crash', 'application-fault'].includes(kind) ||
        typeof reason !== 'string' || !reason.trim() || reason.length > 4096)
      throw new Error('A classified task failure and reason are required');
    const task = this.owned(token);
    return this.persist({
      ...task, status: kind === 'runtime-crash' ? 'ready' : 'failed',
      owner: null, leaseExpiresAt: 0, lastFailedNode: task.owner,
      failure: { kind, reason, nodeId: task.owner },
    });
  }

  cancel(taskId) {
    const task = this.get(taskId);
    if (TERMINAL.has(task.status)) throw new Error(`Task is already ${task.status}`);
    return this.persist({ ...task, status: 'cancelled', owner: null, leaseExpiresAt: 0 });
  }
}
