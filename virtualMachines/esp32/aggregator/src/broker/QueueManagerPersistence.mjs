// QueueManagerPersistence.mjs
// Handles persistence for QueueManager (configs and operations)
import fs from 'fs';
import path from 'path';

function sleepSync(ms) {
  const waitMs = Math.max(0, Number(ms) || 0);
  if (waitMs <= 0) return;
  const sab = new SharedArrayBuffer(4);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, waitMs);
}

function isRetryableFsError(error) {
  const code = String(error?.code || '').toUpperCase();
  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY' || code === 'ENOTEMPTY';
}

export class QueueManagerPersistence {
  constructor(queueManagerName = 'default', basePath = './data') {
    this.queueManagerName = queueManagerName;
    this.basePath = path.join(basePath, queueManagerName);
    this.configPath = path.join(this.basePath, 'config.json');
    this.operationsPath = path.join(this.basePath, 'operations.jsonl');
    this.snapshotPath = path.join(this.basePath, 'state.snapshot.json');
    this.messagesRoot = path.join(this.basePath, 'messages');
    this.quarantineRoot = path.join(this.basePath, 'quarantine');
    this.maxSeq = (1n << 64n) - 1n;
    this.seqPadWidth = String(this.maxSeq).length;
    this.counterCache = new Map();
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
    if (!fs.existsSync(this.messagesRoot)) {
      fs.mkdirSync(this.messagesRoot, { recursive: true });
    }
    if (!fs.existsSync(this.quarantineRoot)) {
      fs.mkdirSync(this.quarantineRoot, { recursive: true });
    }
  }

  quarantineCorruptFile(filePath, reason = 'invalid-json') {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      const quarantineDir = path.join(this.quarantineRoot, reason);
      if (!fs.existsSync(quarantineDir)) {
        fs.mkdirSync(quarantineDir, { recursive: true });
      }

      const baseName = path.basename(filePath);
      const targetPath = path.join(
        quarantineDir,
        `${Date.now()}-${process.pid}-${baseName}`
      );
      fs.renameSync(filePath, targetPath);
      return targetPath;
    } catch (error) {
      console.error(`[QueueManagerPersistence] Failed to quarantine ${filePath}:`, error?.message || String(error));
      return null;
    }
  }

  getQueueDir(queueName) {
    return path.join(this.messagesRoot, encodeURIComponent(String(queueName || '')));
  }

  getCounterPath(queueName) {
    return path.join(this.getQueueDir(queueName), 'order-counter.json');
  }

  ensureQueueDir(queueName) {
    const queueDir = this.getQueueDir(queueName);
    if (!fs.existsSync(queueDir)) {
      fs.mkdirSync(queueDir, { recursive: true });
    }
    return queueDir;
  }

  writeJsonAtomic(filePath, payload) {
    const targetDir = path.dirname(filePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const maxAttempts = 8;
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const tmpPath = path.join(targetDir, `${fileName}.${process.pid}.${Date.now()}.${attempt}.tmp`);
      try {
        fs.writeFileSync(tmpPath, serialized);
        try {
          fs.renameSync(tmpPath, filePath);
        } catch (renameError) {
          if (!isRetryableFsError(renameError) && renameError?.code !== 'EEXIST') {
            throw renameError;
          }
          // Some sync providers lock the destination briefly; copy over it as a fallback.
          fs.copyFileSync(tmpPath, filePath);
          fs.unlinkSync(tmpPath);
        }
        return;
      } catch (error) {
        lastError = error;
        try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch { /* ignore cleanup errors */ }

        if (error?.code === 'ENOENT' && !fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        if (!isRetryableFsError(error) && error?.code !== 'ENOENT' && error?.code !== 'EEXIST') {
          throw error;
        }

        if (attempt < maxAttempts) {
          sleepSync(25 * attempt);
        }
      }
    }

    throw lastError || new Error(`Failed to atomically write ${filePath}`);
  }

  parseMessageFileName(fileName) {
    const match = String(fileName || '').match(/^(\d+)-(\d+)-([0-9a-fA-F-]{8,})\.json$/);
    if (!match) return null;
    const era = Number(match[1]);
    const seq = BigInt(match[2]);
    const messageId = match[3];
    return { era, seq, messageId };
  }

  formatSeq(seq) {
    return seq.toString().padStart(this.seqPadWidth, '0');
  }

  getLatestOrderFromDisk(queueName) {
    const queueDir = this.ensureQueueDir(queueName);
    const files = fs.readdirSync(queueDir).filter(name => name.endsWith('.json') && name !== 'order-counter.json');
    let latest = null;

    for (const file of files) {
      const parsed = this.parseMessageFileName(file);
      if (!parsed) continue;
      if (!latest) {
        latest = parsed;
        continue;
      }
      if (parsed.era > latest.era || (parsed.era === latest.era && parsed.seq > latest.seq)) {
        latest = parsed;
      }
    }

    return latest;
  }

  loadOrderCounter(queueName) {
    const cacheKey = String(queueName || '');
    if (this.counterCache.has(cacheKey)) {
      return this.counterCache.get(cacheKey);
    }

    const counterPath = this.getCounterPath(queueName);
    let state = null;

    if (fs.existsSync(counterPath)) {
      try {
        const content = fs.readFileSync(counterPath, 'utf-8');
        const parsed = JSON.parse(content);
        state = {
          era: Number(parsed.era || 0),
          nextSeq: BigInt(parsed.nextSeq || '0')
        };
      } catch (e) {
        console.error(`Error loading order counter for ${this.queueManagerName}/${queueName}:`, e.message);
        const quarantinedPath = this.quarantineCorruptFile(counterPath, 'order-counter-invalid-json');
        if (quarantinedPath) {
          console.warn(`[QueueManagerPersistence] Quarantined corrupt order counter to ${quarantinedPath}`);
        }
      }
    }

    if (!state) {
      const latest = this.getLatestOrderFromDisk(queueName);
      if (latest) {
        let era = latest.era;
        let nextSeq = latest.seq + 1n;
        if (nextSeq > this.maxSeq) {
          era += 1;
          nextSeq = 0n;
        }
        state = { era, nextSeq };
      } else {
        state = { era: 0, nextSeq: 0n };
      }
      this.saveOrderCounter(queueName, state);
    }

    this.counterCache.set(cacheKey, state);
    return state;
  }

  saveOrderCounter(queueName, state) {
    const queueDir = this.ensureQueueDir(queueName);
    const counterPath = path.join(queueDir, 'order-counter.json');
    const serializable = {
      era: Number(state.era || 0),
      nextSeq: BigInt(state.nextSeq || 0n).toString()
    };
    this.writeJsonAtomic(counterPath, JSON.stringify(serializable, null, 2));
    this.counterCache.set(String(queueName || ''), { era: serializable.era, nextSeq: BigInt(serializable.nextSeq) });
  }

  allocateOrder(queueName) {
    const state = this.loadOrderCounter(queueName);
    const current = { era: state.era, seq: state.nextSeq };

    let nextEra = state.era;
    let nextSeq = state.nextSeq + 1n;
    if (nextSeq > this.maxSeq) {
      nextEra += 1;
      nextSeq = 0n;
    }

    this.saveOrderCounter(queueName, { era: nextEra, nextSeq });
    return current;
  }

  persistQueueMessage(queueName, payload) {
    const { era, seq } = this.allocateOrder(queueName);
    const messageId = String(payload.messageId || '');
    const fileName = `${String(era).padStart(6, '0')}-${this.formatSeq(seq)}-${messageId}.json`;
    const queueDir = this.ensureQueueDir(queueName);
    const filePath = path.join(queueDir, fileName);

    const record = {
      message: payload.message,
      sourceService: payload.sourceService,
      messageId,
      messageEnvelope: payload.messageEnvelope || null,
      persistedAt: Date.now()
    };

    this.writeJsonAtomic(filePath, JSON.stringify(record));

    return {
      ...record,
      era,
      seq: seq.toString(),
      fileName,
      filePath
    };
  }

  loadQueueMessages(queueName) {
    const queueDir = this.ensureQueueDir(queueName);
    const files = fs.readdirSync(queueDir).filter(name => name.endsWith('.json') && name !== 'order-counter.json');

    const parsedFiles = files
      .map(fileName => ({ fileName, parsed: this.parseMessageFileName(fileName) }))
      .filter(entry => !!entry.parsed)
      .sort((a, b) => {
        if (a.parsed.era !== b.parsed.era) return a.parsed.era - b.parsed.era;
        if (a.parsed.seq < b.parsed.seq) return -1;
        if (a.parsed.seq > b.parsed.seq) return 1;
        return 0;
      });

    const messages = [];
    for (const entry of parsedFiles) {
      const filePath = path.join(queueDir, entry.fileName);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        messages.push({
          message: parsed.message,
          sourceService: parsed.sourceService,
          messageId: parsed.messageId || entry.parsed.messageId,
          messageEnvelope: parsed.messageEnvelope || null,
          era: entry.parsed.era,
          seq: entry.parsed.seq.toString(),
          fileName: entry.fileName,
          filePath
        });
      } catch (e) {
        console.error(`Error loading persisted message ${filePath}:`, e.message);
        const quarantinedPath = this.quarantineCorruptFile(filePath, 'message-invalid-json');
        if (quarantinedPath) {
          console.warn(`[QueueManagerPersistence] Quarantined corrupt message file to ${quarantinedPath}`);
        }
      }
    }

    return messages;
  }

  removeMessageFile(filePath) {
    if (!filePath) return;
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        if (error && error.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  removeQueueStorage(queueName) {
    const queueDir = this.getQueueDir(queueName);
    if (fs.existsSync(queueDir)) {
      fs.rmSync(queueDir, { recursive: true, force: true });
    }
    this.counterCache.delete(String(queueName || ''));
  }

  // Save queue manager configuration to disk
  saveConfig(queueConfig, configVersion) {
    const data = { queueConfig, configVersion, timestamp: Date.now() };
    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
  }

  // Load queue manager configuration from disk
  loadConfig() {
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(content);
      } catch (e) {
        console.error(`Error loading config for ${this.queueManagerName}:`, e.message);
        return null;
      }
    }
    return null;
  }

  // Append an operation to the operation log
  appendOperation(operation) {
    try {
      const line = JSON.stringify(operation) + '\n';
      fs.appendFileSync(this.operationsPath, line);
    } catch (e) {
      console.error(`Error appending operation for ${this.queueManagerName}:`, e.message);
    }
  }

  // Load all operations from disk
  loadOperations() {
    const operations = [];
    if (fs.existsSync(this.operationsPath)) {
      try {
        const content = fs.readFileSync(this.operationsPath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            operations.push(JSON.parse(line));
          } catch (e) {
            console.error(`Error parsing operation line: ${e.message}`);
          }
        }
      } catch (e) {
        console.error(`Error loading operations for ${this.queueManagerName}:`, e.message);
      }
    }
    return operations;
  }

  // Load operations since a specific version
  loadOperationsSince(version) {
    return this.loadOperations().filter(op => op.version && op.version > version);
  }

  saveSnapshot(snapshot) {
    try {
      this.writeJsonAtomic(this.snapshotPath, JSON.stringify(snapshot, null, 2));
    } catch (e) {
      console.error(`Error saving snapshot for ${this.queueManagerName}:`, e.message);
    }
  }

  loadSnapshot() {
    if (!fs.existsSync(this.snapshotPath)) return null;
    try {
      const content = fs.readFileSync(this.snapshotPath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error(`Error loading snapshot for ${this.queueManagerName}:`, e.message);
      return null;
    }
  }

  replaceOperations(operations = []) {
    try {
      const lines = operations.map(op => JSON.stringify(op)).join('\n');
      fs.writeFileSync(this.operationsPath, lines ? `${lines}\n` : '');
    } catch (e) {
      console.error(`Error compacting operations for ${this.queueManagerName}:`, e.message);
    }
  }

  // Clear all data (for cleanup or reset)
  clearAll() {
    try {
      if (fs.existsSync(this.configPath)) fs.unlinkSync(this.configPath);
      if (fs.existsSync(this.operationsPath)) fs.unlinkSync(this.operationsPath);
      if (fs.existsSync(this.snapshotPath)) fs.unlinkSync(this.snapshotPath);
      if (fs.existsSync(this.messagesRoot)) fs.rmSync(this.messagesRoot, { recursive: true, force: true });
      this.counterCache.clear();
    } catch (e) {
      console.error(`Error clearing data for ${this.queueManagerName}:`, e.message);
    }
  }

  getFileAttributes(filePath) {
    if (!fs.existsSync(filePath)) {
      return {
        exists: false,
        sizeBytes: 0,
        mtimeMs: null,
        mtimeIso: null,
      };
    }

    const stat = fs.statSync(filePath);
    return {
      exists: true,
      sizeBytes: Number(stat.size || 0),
      mtimeMs: Number(stat.mtimeMs || 0),
      mtimeIso: stat.mtime ? stat.mtime.toISOString() : null,
    };
  }

  getPersistenceStatus() {
    return {
      queueManagerName: this.queueManagerName,
      basePath: this.basePath,
      config: this.getFileAttributes(this.configPath),
      operations: this.getFileAttributes(this.operationsPath),
      snapshot: this.getFileAttributes(this.snapshotPath),
      checkedAt: new Date().toISOString(),
    };
  }
}
