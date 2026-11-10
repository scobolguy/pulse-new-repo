import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MAX_CHECKPOINT_BYTES = 65536;
const MAX_STORE_BYTES = 32 * 1024 * 1024;
const MAX_CHECKPOINTS = 256;
const HEADER_BYTES = 36;

function requireDigest(digest) {
  if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest))
    throw new Error('Invalid checkpoint SHA-256');
}

function copyBytes(data) {
  if (!(data instanceof Uint8Array) || data.byteLength < 1 || data.byteLength > MAX_CHECKPOINT_BYTES)
    throw new Error('Checkpoint must contain 1..65536 bytes');
  return Buffer.from(data);
}

function digestBytes(data) {
  return createHash('sha256').update(data).digest('hex');
}

function requireReplicaId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(id))
    throw new Error('Invalid checkpoint replica id');
}

export class SwarmCheckpointStore {
  constructor({ id, filePath }) {
    requireReplicaId(id);
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath))
      throw new Error('An absolute checkpoint store path is required');
    this.id = id;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.filePath = path.join(fs.realpathSync(path.dirname(filePath)), path.basename(filePath));
    this.lockPath = `${this.filePath}.lock`;
    this.lock = fs.openSync(this.lockPath, 'wx');
    this.entries = new Map();
    try {
      this.fd = fs.openSync(this.filePath, fs.constants.O_RDWR | fs.constants.O_CREAT);
      this.bytes = fs.fstatSync(this.fd).size;
      if (this.bytes > MAX_STORE_BYTES) throw new Error('Checkpoint store exceeds capacity');
      let offset = 0;
      while (offset < this.bytes) {
        if (this.bytes - offset < HEADER_BYTES) break;
        const header = this.readBytes(offset, HEADER_BYTES);
        const length = header.readUInt32BE(0);
        if (length < 1 || length > MAX_CHECKPOINT_BYTES)
          throw new Error('Invalid checkpoint store record length');
        if (this.bytes - offset - HEADER_BYTES < length) break;
        const digest = header.subarray(4).toString('hex');
        const data = this.readBytes(offset + HEADER_BYTES, length);
        if (digestBytes(data) !== digest) throw new Error('Checkpoint store integrity check failed');
        if (this.entries.has(digest)) throw new Error('Duplicate checkpoint store record');
        if (this.entries.size >= MAX_CHECKPOINTS) throw new Error('Checkpoint count exceeds capacity');
        this.entries.set(digest, { offset: offset + HEADER_BYTES, length });
        offset += HEADER_BYTES + length;
      }
      // Partial appends are unpublished data, never committed checkpoints.
      fs.ftruncateSync(this.fd, offset);
      fs.fsyncSync(this.fd);
      this.bytes = offset;
    } catch (error) {
      this.close();
      throw error;
    }
  }

  readBytes(offset, length) {
    const data = Buffer.alloc(length);
    let read = 0;
    while (read < length) {
      const count = fs.readSync(this.fd, data, read, length - read, offset + read);
      if (!count) throw new Error('Checkpoint store read was incomplete');
      read += count;
    }
    return data;
  }

  requireAvailable() {
    if (this.fd === undefined || this.poisoned) throw new Error('Checkpoint store is unavailable');
  }

  get(digest) {
    requireDigest(digest);
    this.requireAvailable();
    const entry = this.entries.get(digest);
    if (!entry) throw new Error('Checkpoint not found');
    const data = this.readBytes(entry.offset, entry.length);
    if (digestBytes(data) !== digest) throw new Error('Checkpoint integrity check failed');
    return data;
  }

  put(digest, bytes) {
    requireDigest(digest);
    const data = copyBytes(bytes);
    if (digestBytes(data) !== digest) throw new Error('Checkpoint digest does not match its data');
    this.requireAvailable();
    if (this.entries.has(digest)) {
      this.get(digest);
      return { replicaId: this.id, digest, bytes: data.length };
    }
    if (this.entries.size >= MAX_CHECKPOINTS ||
        this.bytes + HEADER_BYTES + data.length > MAX_STORE_BYTES)
      throw new Error('Checkpoint store capacity exhausted');
    const record = Buffer.alloc(HEADER_BYTES + data.length);
    record.writeUInt32BE(data.length, 0);
    Buffer.from(digest, 'hex').copy(record, 4);
    data.copy(record, HEADER_BYTES);
    try {
      let offset = 0;
      while (offset < record.length) {
        const count = fs.writeSync(this.fd, record, offset, record.length - offset, this.bytes + offset);
        if (!count) throw new Error('Checkpoint store write was incomplete');
        offset += count;
      }
      fs.fsyncSync(this.fd);
    } catch (error) {
      this.poisoned = true;
      throw error;
    }
    this.entries.set(digest, { offset: this.bytes + HEADER_BYTES, length: data.length });
    this.bytes += record.length;
    return { replicaId: this.id, digest, bytes: data.length };
  }

  close() {
    try {
      if (this.fd !== undefined) fs.closeSync(this.fd);
    } finally {
      this.fd = undefined;
      if (this.lock !== undefined) {
        fs.closeSync(this.lock);
        this.lock = undefined;
        fs.unlinkSync(this.lockPath);
      }
    }
  }
}

// Immutable storage does not grant leadership or make a task commit authoritative.
// Network adapters must authenticate each independently identified replica.
export class SwarmCheckpointPair {
  constructor(replicas) {
    if (!Array.isArray(replicas) || replicas.length !== 2)
      throw new Error('Exactly two checkpoint replicas are required');
    for (const replica of replicas) {
      requireReplicaId(replica?.id);
      if (typeof replica.put !== 'function' || typeof replica.get !== 'function')
        throw new Error('Checkpoint replica requires put and get operations');
    }
    if (replicas[0].id === replicas[1].id ||
        (replicas[0].filePath && replicas[0].filePath === replicas[1].filePath))
      throw new Error('Checkpoint replicas must be independent');
    this.replicas = replicas.map(replica => ({
      id: replica.id, put: replica.put.bind(replica), get: replica.get.bind(replica),
    }));
  }

  async replicate(bytes) {
    const data = copyBytes(bytes);
    const digest = digestBytes(data);
    const results = await Promise.allSettled(this.replicas.map(async replica => {
      const receipt = await replica.put(digest, Buffer.from(data));
      if (receipt?.replicaId !== replica.id || receipt.digest !== digest || receipt.bytes !== data.length)
        throw new Error('Invalid checkpoint replication receipt');
      const stored = copyBytes(await replica.get(digest));
      if (!stored.equals(data)) throw new Error('Replica read-back differs from checkpoint data');
      return receipt;
    }));
    const errors = results.flatMap((result, index) => result.status === 'rejected'
      ? [new Error(`Checkpoint replica ${this.replicas[index].id} failed`, { cause: result.reason })] : []);
    if (errors.length) throw new AggregateError(errors, 'Checkpoint replication requires both managers');
    return { digest, bytes: data.length, replicas: this.replicas.map(replica => replica.id) };
  }

  async read(digest) {
    requireDigest(digest);
    const results = await Promise.allSettled(this.replicas.map(async replica => {
      const data = copyBytes(await replica.get(digest));
      if (digestBytes(data) !== digest) throw new Error('Replica checkpoint integrity check failed');
      return data;
    }));
    const failures = results.flatMap((result, index) => result.status === 'rejected'
      ? [{ replicaId: this.replicas[index].id, error: result.reason }] : []);
    const available = results.find(result => result.status === 'fulfilled');
    if (!available) throw new AggregateError(failures.map(failure => failure.error), 'Both checkpoint replicas failed');
    return { data: available.value, degraded: failures.length > 0, failures };
  }
}
