import { createHash } from 'node:crypto';
import { DurableRecordJournal } from './durableRecordJournal.mjs';
import { SwarmCheckpointPair } from './swarmCheckpointStore.mjs';
import { copyCheckpointState } from './swarmTaskCoordinator.mjs';

function name(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(value))
    throw new Error(`Invalid ${label}`);
  return value;
}

function integer(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`Invalid ${label}`);
  return value;
}

function hash(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new Error('Invalid executable or checkpoint SHA-256');
  return value;
}

// This authority belongs to one aggregator. Tokens are fencing facts, not
// credentials; remote callers must be authenticated before using this API.
export class SwarmLeadershipWitness {
  constructor({ filePath, clusterId, managerIds, pair, now = Date.now, leaseMs = 30000, initialize = false }) {
    name(clusterId, 'swarm id');
    if (!Array.isArray(managerIds) || managerIds.length !== 2)
      throw new Error('Exactly two manager identities are required');
    managerIds.forEach(id => name(id, 'manager id'));
    if (managerIds[0] === managerIds[1]) throw new Error('Manager identities must be distinct');
    if (!(pair instanceof SwarmCheckpointPair) ||
        managerIds.some(id => !pair.replicas.some(replica => replica.id === id)))
      throw new Error('Witness managers must match the checkpoint pair');
    if (typeof now !== 'function') throw new Error('A witness clock is required');
    integer(leaseMs, 'witness lease duration', 1);
    if (leaseMs > 300000) throw new Error('Witness lease exceeds capacity');
    this.clusterId = clusterId;
    this.managerIds = [...managerIds].sort();
    this.pair = pair;
    this.now = now;
    this.leaseMs = leaseMs;
    this.leader = { managerId: null, epoch: 0, expiresAt: 0 };
    this.commits = new Map();
    this.poisonNotices = new Map();
    this.clockFloor = 0;
    this.journal = new DurableRecordJournal(filePath, {
      recordKey: 'witness', label: 'Witness journal',
      maxRecordBytes: 4096, maxJournalBytes: 32 * 1024 * 1024,
    });
    try {
      if (!this.journal.records.length) {
        if (initialize !== true) throw new Error('Witness enrollment requires explicit initialization');
        this.journal.append({ kind: 'config', clusterId, managerIds: this.managerIds });
      } else {
        const [config, ...records] = this.journal.records;
        if (config.kind !== 'config' || config.clusterId !== clusterId ||
            JSON.stringify(config.managerIds) !== JSON.stringify(this.managerIds))
          throw new Error('Witness journal belongs to a different swarm or manager pair');
        for (const record of records) this.apply(record);
      }
    } catch (error) {
      this.close();
      throw error;
    }
  }

  timestamp() {
    this.journal.requireAvailable();
    const timestamp = integer(this.now(), 'witness clock');
    if (timestamp < this.clockFloor || timestamp > Number.MAX_SAFE_INTEGER - this.leaseMs)
      throw new Error('Witness clock moved backwards or exceeds its range');
    this.clockFloor = timestamp;
    return timestamp;
  }

  apply(record) {
    integer(record.at, 'witness record timestamp');
    if (record.at < this.clockFloor) throw new Error('Witness journal clock history is inconsistent');
    if (record.kind === 'leader') {
      name(record.managerId, 'stored manager id');
      integer(record.epoch, 'stored leadership epoch', 1);
      integer(record.expiresAt, 'stored leadership expiry', 1);
      const renewal = record.epoch === this.leader.epoch && record.managerId === this.leader.managerId;
      const takeover = record.epoch === this.leader.epoch + 1 && record.at >= this.leader.expiresAt;
      const keepAliveSequence = record.keepAliveSequence ??
        (renewal ? this.leader.keepAliveSequence + 1 : 0);
      if (!this.managerIds.includes(record.managerId) || (!renewal && !takeover) ||
          record.expiresAt <= record.at || (renewal && (record.at >= this.leader.expiresAt ||
            record.expiresAt < this.leader.expiresAt ||
            keepAliveSequence !== this.leader.keepAliveSequence + 1)) ||
          (takeover && keepAliveSequence !== 0))
        throw new Error('Invalid witness leadership history');
      if (takeover && this.leader.managerId !== null && record.poisonNotice !== undefined) {
        const notice = record.poisonNotice;
        if (notice.managerId !== this.leader.managerId || notice.epoch !== this.leader.epoch ||
            notice.replacementManagerId !== record.managerId ||
            notice.replacementEpoch !== record.epoch || notice.issuedAt !== record.at)
          throw new Error('Invalid witness poison notice');
        this.poisonNotices.set(`${notice.managerId}:${notice.epoch}`, structuredClone(notice));
      } else if (record.poisonNotice !== undefined) {
        throw new Error('Unexpected witness poison notice');
      }
      this.leader = {
        managerId: record.managerId, epoch: record.epoch,
        expiresAt: record.expiresAt, keepAliveSequence,
      };
    } else if (record.kind === 'commit') {
      name(record.taskId, 'stored task id');
      hash(record.codeId);
      hash(record.digest);
      integer(record.sequence, 'stored checkpoint sequence', 1);
      integer(record.bytes, 'stored checkpoint bytes', 1);
      const previous = this.commits.get(record.taskId);
      if (record.managerId !== this.leader.managerId || record.epoch !== this.leader.epoch ||
          record.at >= this.leader.expiresAt || record.bytes > 65536 ||
          record.sequence !== (previous?.sequence ?? 0) + 1 ||
          (previous && previous.codeId !== record.codeId) || (!previous && this.commits.size >= 256))
        throw new Error('Invalid witness checkpoint history');
      this.commits.set(record.taskId, structuredClone(record));
    } else {
      throw new Error('Invalid witness journal record kind');
    }
    this.clockFloor = record.at;
  }

  persist(record) {
    this.journal.append(record);
    this.apply(record);
  }

  grant(managerId) {
    name(managerId, 'manager id');
    if (!this.managerIds.includes(managerId)) throw new Error('Manager is not enrolled in this swarm');
    const at = this.timestamp();
    if (this.leader.expiresAt > at) throw new Error('Swarm leadership lease is still active');
    const epoch = integer(this.leader.epoch + 1, 'next leadership epoch', 1);
    const poisonNotice = this.leader.managerId === null ? undefined : {
      managerId: this.leader.managerId, epoch: this.leader.epoch,
      replacementManagerId: managerId, replacementEpoch: epoch, issuedAt: at,
    };
    this.persist({
      kind: 'leader', managerId, epoch, expiresAt: at + this.leaseMs,
      keepAliveSequence: 0, poisonNotice, at,
    });
    return { ...this.token(), ...(poisonNotice ? { poisonNotice: structuredClone(poisonNotice) } : {}) };
  }

  token() {
    return { clusterId: this.clusterId, ...this.leader };
  }

  getPoisonNotice(managerId, epoch) {
    name(managerId, 'manager id');
    integer(epoch, 'leadership epoch', 1);
    const notice = this.poisonNotices.get(`${managerId}:${epoch}`);
    return notice ? structuredClone(notice) : null;
  }

  authorize(token) {
    const at = this.timestamp();
    if (token?.clusterId !== this.clusterId || token.managerId !== this.leader.managerId ||
        token.epoch !== this.leader.epoch || this.leader.expiresAt <= at)
      throw new Error('Stale or expired swarm leadership');
    return at;
  }

  renew(token, keepAliveSequence) {
    const at = this.authorize(token);
    integer(keepAliveSequence, 'keep-alive sequence', 1);
    if (keepAliveSequence === this.leader.keepAliveSequence) return this.token();
    if (keepAliveSequence !== this.leader.keepAliveSequence + 1)
      throw new Error('Stale or out-of-order swarm keep-alive');
    this.persist({
      kind: 'leader', ...this.leader,
      expiresAt: Math.max(this.leader.expiresAt, at + this.leaseMs),
      keepAliveSequence, at,
    });
    return this.token();
  }

  async publish(token, { taskId, codeId, expectedSequence, state }, { authorizeWorker } = {}) {
    if (authorizeWorker !== undefined && typeof authorizeWorker !== 'function')
      throw new Error('Worker authorization must be synchronous');
    const checkWorker = () => {
      if (authorizeWorker && authorizeWorker() !== true)
        throw new Error('Worker authorization must synchronously confirm ownership');
    };
    this.authorize(token);
    checkWorker();
    name(taskId, 'task id');
    hash(codeId);
    integer(expectedSequence, 'expected checkpoint sequence');
    integer(expectedSequence + 1, 'next checkpoint sequence', 1);
    // Snapshot fencing facts before awaiting untrusted transport.
    const ownership = { clusterId: token.clusterId, managerId: token.managerId, epoch: token.epoch };
    const data = Buffer.from(JSON.stringify({
      version: 1, taskId, codeId, sequence: expectedSequence + 1, state: copyCheckpointState(state),
    }));
    const digest = createHash('sha256').update(data).digest('hex');
    const checkSequence = () => {
      const current = this.commits.get(taskId);
      if (current && current.codeId !== codeId) throw new Error('Task executable identity changed');
      if (current?.sequence === expectedSequence + 1 && current.digest === digest)
        return structuredClone(current);
      if ((current?.sequence ?? 0) !== expectedSequence) throw new Error('Stale witnessed checkpoint sequence');
      if (!current && this.commits.size >= 256) throw new Error('Witness task capacity exhausted');
      return null;
    };
    const existing = checkSequence();
    if (existing) return existing;
    const receipt = await this.pair.replicate(data);
    checkWorker();
    const at = this.authorize(ownership);
    const concurrent = checkSequence();
    if (concurrent) return concurrent;
    const record = {
      kind: 'commit', taskId, codeId, sequence: expectedSequence + 1,
      digest: receipt.digest, bytes: receipt.bytes, managerId: ownership.managerId, epoch: ownership.epoch, at,
    };
    this.persist(record);
    return structuredClone(record);
  }

  async readCommitted(token, taskId, codeId) {
    this.authorize(token);
    name(taskId, 'task id');
    hash(codeId);
    const ownership = { clusterId: token.clusterId, managerId: token.managerId, epoch: token.epoch };
    const commit = this.commits.get(taskId);
    if (!commit) throw new Error('No witnessed checkpoint exists');
    if (commit.codeId !== codeId) throw new Error('Checkpoint executable is incompatible');
    const result = await this.pair.read(commit.digest);
    this.authorize(ownership);
    if (this.commits.get(taskId).digest !== commit.digest)
      throw new Error('Witnessed checkpoint changed during restore');
    const checkpoint = JSON.parse(result.data.toString('utf8'));
    if (checkpoint.version !== 1 || checkpoint.taskId !== taskId || checkpoint.codeId !== codeId ||
        checkpoint.sequence !== commit.sequence || result.data.length !== commit.bytes)
      throw new Error('Witnessed checkpoint metadata is inconsistent');
    return {
      commit: structuredClone(commit), state: copyCheckpointState(checkpoint.state),
      degraded: result.degraded, failures: result.failures,
    };
  }

  close() {
    this.journal.close();
  }
}
