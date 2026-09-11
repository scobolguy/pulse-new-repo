import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2);
const rootArg = args.find((arg) => arg.startsWith('--root='));
const outputArg = args.find((arg) => arg.startsWith('--output='));
const indexArg = args.find((arg) => arg.startsWith('--index='));
const resolveArg = args.find((arg) => arg.startsWith('--resolve='));
const stateArg = args.find((arg) => arg.startsWith('--state='));
const noteArg = args.find((arg) => arg.startsWith('--note='));
const managerUrlArg = args.find((arg) => arg.startsWith('--manager-url='));
const rootPath = path.resolve(rootArg ? rootArg.slice('--root='.length) : path.resolve(process.cwd(), 'pulse-operational-data'));
const outputPath = outputArg ? path.resolve(outputArg.slice('--output='.length)) : null;
const indexPath = path.resolve(indexArg ? indexArg.slice('--index='.length) : path.join(rootPath, 'transaction-rebuild.sqlite'));

function openIndex() {
  const database = new DatabaseSync(indexPath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS rebuild_runs (
      run_id TEXT PRIMARY KEY,
      generated_at TEXT NOT NULL,
      root_path TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      counts_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      message_id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      queues_json TEXT NOT NULL,
      managers_json TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      first_seen_at TEXT,
      last_seen_at TEXT,
      updated_at TEXT NOT NULL,
      resolution_state TEXT,
      resolution_note TEXT
    );
    CREATE TABLE IF NOT EXISTS transaction_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      queue_name TEXT,
      manager_id TEXT,
      source TEXT,
      line INTEGER,
      version TEXT,
      timestamp TEXT,
      persisted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS transaction_resolutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      state TEXT NOT NULL,
      note TEXT,
      resolved_at TEXT NOT NULL
    );
  `);
  return database;
}

function findPersistedMessage(messageId) {
  for (const filePath of walk(rootPath)) {
    if (!filePath.endsWith('.json') || path.basename(filePath) === 'order-counter.json') continue;
    if (!filePath.includes(`${path.sep}messages${path.sep}`)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (String(parsed?.messageId || '') === messageId) return parsed;
    } catch {
      // Ignore malformed evidence; the report remains read-only.
    }
  }
  return null;
}

async function resolveTransaction() {
  if (!resolveArg) return false;
  const messageId = resolveArg.slice('--resolve='.length).trim();
  const state = stateArg ? stateArg.slice('--state='.length).trim() : '';
  const note = noteArg ? noteArg.slice('--note='.length) : null;
  const managerUrl = managerUrlArg ? managerUrlArg.slice('--manager-url='.length).replace(/\/$/, '') : null;
  const allowedStates = new Set(['completed', 'requeue', 'ignored', 'possible-duplicate', 'manual-review']);
  if (!messageId || !allowedStates.has(state)) {
    throw new Error(`--resolve requires --state=${Array.from(allowedStates).join('|')}`);
  }
  let recoveryAttemptId = null;
  let recoveryResult = null;
  if (state === 'requeue') {
    if (!managerUrl) throw new Error('--state=requeue requires --manager-url=http://host:port');
    const record = records.get(messageId);
    const queueName = record?.queues.values().next().value;
    if (!queueName) throw new Error(`No queue evidence found for ${messageId}`);
    const persisted = findPersistedMessage(messageId);
    if (!persisted) throw new Error(`No persisted message payload found for ${messageId}`);
    recoveryAttemptId = randomUUID();
    const response = await fetch(`${managerUrl}/enqueue`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        queueName,
        message: persisted.message,
        sourceService: `recovery:${recoveryAttemptId}`,
        messageId,
        messageEnvelope: persisted.messageEnvelope || null
      })
    });
    const responseBody = await response.text();
    recoveryResult = { status: response.status, body: responseBody.slice(0, 500) };
    if (!response.ok) throw new Error(`Recovery enqueue failed with HTTP ${response.status}`);
  }

  const database = openIndex();
  const resolvedAt = new Date().toISOString();
  database.prepare(`
    INSERT INTO transaction_resolutions (message_id, state, note, resolved_at)
    VALUES (?, ?, ?, ?)
  `).run(messageId, state, [note, recoveryAttemptId ? `recoveryAttemptId=${recoveryAttemptId}` : null].filter(Boolean).join('; ') || null, resolvedAt);
  database.prepare(`
    UPDATE transactions
    SET resolution_state = ?, resolution_note = ?, updated_at = ?
    WHERE message_id = ?
  `).run(state, note, resolvedAt, messageId);
  database.close();
  console.log(JSON.stringify({ messageId, state, note, recoveryAttemptId, recoveryResult, resolvedAt, indexPath }));
  return true;
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(entryPath));
    else files.push(entryPath);
  }
  return files;
}

function readJsonLines(filePath) {
  const records = [];
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      records.push({ value: JSON.parse(line), line: index + 1 });
    } catch (error) {
      records.push({ error: error.message, line: index + 1 });
    }
  });
  return records;
}

function ensureRecord(records, messageId) {
  if (!records.has(messageId)) {
    records.set(messageId, {
      messageId,
      queues: new Set(),
      managers: new Set(),
      events: [],
      evidence: new Set(),
      malformedEvents: 0,
    });
  }
  return records.get(messageId);
}

function addEvent(records, messageId, event) {
  const record = ensureRecord(records, messageId);
  if (event.queueName) record.queues.add(event.queueName);
  if (event.managerId) record.managers.add(event.managerId);
  record.evidence.add(event.kind);
  record.events.push(event);
}

function managerNameFromPath(filePath) {
  const relative = path.relative(rootPath, filePath);
  const parts = relative.split(path.sep);
  return parts.length > 1 ? parts[0] : null;
}

function scanOperations(records, filePath) {
  const managerId = managerNameFromPath(filePath);
  for (const item of readJsonLines(filePath)) {
    if (item.error) continue;
    const operation = item.value;
    const messageId = String(operation?.messageId || '').trim();
    if (!messageId) continue;
    addEvent(records, messageId, {
      kind: operation.type || 'unknown-operation',
      queueName: operation.queueName || null,
      managerId,
      source: filePath,
      line: item.line,
      version: operation.version || null,
      timestamp: operation.timestamp || null,
    });
  }
}

function scanMessageFiles(records, filePath) {
  try {
    const message = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const messageId = String(message?.messageId || '').trim();
    if (!messageId) return;
    const relative = path.relative(rootPath, filePath);
    const parts = relative.split(path.sep);
    const queueIndex = parts.indexOf('messages');
    const queueName = queueIndex >= 0 && parts[queueIndex + 1]
      ? decodeURIComponent(parts[queueIndex + 1])
      : null;
    addEvent(records, messageId, {
      kind: 'persisted-queue-message',
      queueName,
      managerId: managerNameFromPath(filePath),
      source: filePath,
      persistedAt: message.persistedAt || null,
    });
  } catch {
    // A rebuild report should remain read-only and continue past bad evidence.
  }
}

function classify(record) {
  const evidence = record.evidence;
  const hasQueueMessage = evidence.has('persisted-queue-message');
  const hasCompletion = evidence.has('claim-complete') || evidence.has('dequeue') || evidence.has('complete');
  const hasClaim = evidence.has('claim') || evidence.has('claim-heartbeat');
  const hasFailure = evidence.has('claim-fail') || evidence.has('claim-dead-letter');
  const hasReplication = evidence.has('replicate-enqueue') || record.managers.size > 1;

  if (hasQueueMessage && hasClaim && !hasCompletion) return 'claimed-or-in-flight';
  if (hasQueueMessage) return hasReplication ? 'replicated-and-queued' : 'queued';
  if (hasCompletion) return hasReplication ? 'replicated-and-completed' : 'completed';
  if (hasFailure) return 'failed-or-dead-lettered';
  if (hasReplication) return 'possible-duplicate';
  if (evidence.has('enqueue')) return 'possible-duplicate';
  return 'unknown';
}

const records = new Map();
const files = walk(rootPath);
for (const filePath of files) {
  if (path.basename(filePath) === 'operations.jsonl') scanOperations(records, filePath);
  else if (path.basename(path.dirname(filePath)) === 'messages' || filePath.includes(`${path.sep}messages${path.sep}`)) {
    if (filePath.endsWith('.json') && path.basename(filePath) !== 'order-counter.json') scanMessageFiles(records, filePath);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  rootPath,
  readOnly: true,
  recordCount: records.size,
  counts: {},
  transactions: []
};
const counts = report.counts;
report.transactions = Array.from(records.values()).map((record) => {
    const state = classify(record);
    const transaction = {
      messageId: record.messageId,
      state,
      queues: Array.from(record.queues).sort(),
      managers: Array.from(record.managers).sort(),
      evidence: Array.from(record.evidence).sort(),
      events: record.events.sort((a, b) => Number(a.version || 0) - Number(b.version || 0)),
    };
    counts[state] = (counts[state] || 0) + 1;
    return transaction;
  }).sort((a, b) => a.messageId.localeCompare(b.messageId));

function persistReport() {
  const database = openIndex();
  const runId = randomUUID();
  database.prepare(`
    INSERT INTO rebuild_runs (run_id, generated_at, root_path, record_count, counts_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(runId, report.generatedAt, report.rootPath, report.recordCount, JSON.stringify(report.counts));
  const transactionStatement = database.prepare(`
    INSERT INTO transactions (
      message_id, state, queues_json, managers_json, evidence_json,
      first_seen_at, last_seen_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(message_id) DO UPDATE SET
      state = excluded.state,
      queues_json = excluded.queues_json,
      managers_json = excluded.managers_json,
      evidence_json = excluded.evidence_json,
      first_seen_at = excluded.first_seen_at,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at
  `);
  const eventStatement = database.prepare(`
    INSERT INTO transaction_events (
      run_id, message_id, kind, queue_name, manager_id, source, line, version, timestamp, persisted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const transaction of report.transactions) {
    const times = transaction.events
      .map((event) => event.timestamp || event.persistedAt)
      .filter(Boolean)
      .map((value) => String(value))
      .sort();
    transactionStatement.run(
      transaction.messageId,
      transaction.state,
      JSON.stringify(transaction.queues),
      JSON.stringify(transaction.managers),
      JSON.stringify(transaction.evidence),
      times[0] || null,
      times[times.length - 1] || null,
      report.generatedAt
    );
    for (const event of transaction.events) {
      eventStatement.run(
        runId,
        transaction.messageId,
        event.kind,
        event.queueName,
        event.managerId,
        event.source,
        event.line || null,
        event.version === null || event.version === undefined ? null : String(event.version),
        event.timestamp === null || event.timestamp === undefined ? null : String(event.timestamp),
        event.persistedAt === null || event.persistedAt === undefined ? null : String(event.persistedAt)
      );
    }
  }
  database.close();
  return runId;
}

if (await resolveTransaction()) process.exit(0);

const serialized = JSON.stringify(report, null, 2);
const runId = persistReport();
if (outputPath) {
  fs.writeFileSync(outputPath, `${serialized}\n`);
  console.log(JSON.stringify({ outputPath, indexPath, runId, recordCount: report.recordCount, counts: report.counts }));
} else {
  console.log(serialized);
}
