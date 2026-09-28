import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

function sanitize(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'default';
}

function escapePowerShell(value) {
  return String(value || '').replace(/'/g, "''");
}

export default class MsmqQueueManagerAdapter {
  constructor(name, options = {}) {
    this.name = name;
    this.queuePrefix = sanitize(options.queuePrefix || process.env.MSMQ_QUEUE_PREFIX || 'pulse');
    this.baseQueuePath = String(options.baseQueuePath || process.env.MSMQ_BASE_QUEUE_PATH || '.\\private$').trim() || '.\\private$';
    this.queueConfig = {};
    this.claims = new Map();
    this.reaperTimer = setInterval(() => this.reapExpiredClaims(), 5000);
    this.reaperTimer.unref?.();
  }

  fullQueuePath(queueName) {
    const base = this.baseQueuePath.replace(/[\\/]+$/, '') || '.\\private$';
    return `${base}\\${this.queuePrefix}.${sanitize(queueName)}`;
  }

  async runPowerShell(script) {
    return new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', data => { stdout += data.toString('utf8'); });
      child.stderr.on('data', data => { stderr += data.toString('utf8'); });
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`)));
    });
  }

  async createQueue(queueName, queueConfig = {}) {
    const path = escapePowerShell(this.fullQueuePath(queueName));
    await this.runPowerShell([
      'Add-Type -AssemblyName System.Messaging',
      `$path = '${path}'`,
      'if (-not [System.Messaging.MessageQueue]::Exists($path)) { [System.Messaging.MessageQueue]::Create($path, $false) | Out-Null }'
    ].join('; '));
    this.queueConfig[queueName] = { name: queueName, createdAt: Date.now(), frozen: false, ...queueConfig };
    return this.queueConfig[queueName];
  }

  getConfig(queueName) { return this.queueConfig[queueName] || {}; }
  getStatus(queueName) { return this.queueConfig[queueName] || { frozen: false }; }
  getAllQueueConfigs() { return { configVersion: 0, operationVersion: 0, queues: { ...this.queueConfig } }; }
  updateQueueConfig(queueName, updates = {}) { this.queueConfig[queueName] = { ...(this.queueConfig[queueName] || { name: queueName }), ...updates }; return this.queueConfig[queueName]; }

  async deleteQueue(queueName) {
    const path = escapePowerShell(this.fullQueuePath(queueName));
    await this.runPowerShell(`Add-Type -AssemblyName System.Messaging; $path = '${path}'; if ([System.Messaging.MessageQueue]::Exists($path)) { [System.Messaging.MessageQueue]::Delete($path) }`);
    delete this.queueConfig[queueName];
  }

  async truncateQueue(queueName) {
    const path = escapePowerShell(this.fullQueuePath(queueName));
    const output = await this.runPowerShell(`Add-Type -AssemblyName System.Messaging; $q = New-Object System.Messaging.MessageQueue('${path}'); $n = $q.GetAllMessages().Count; $q.Purge(); $q.Dispose(); $n`);
    return Number(output) || 0;
  }

  async enqueue(queueName, message, sourceService, messageId = null, messageEnvelope = null) {
    await this.createQueue(queueName);
    const resolvedMessageId = messageId || randomUUID();
    const payload = JSON.stringify({ message, sourceService, messageId: resolvedMessageId, messageEnvelope: messageEnvelope || null });
    const encoded = Buffer.from(payload, 'utf8').toString('base64');
    const path = escapePowerShell(this.fullQueuePath(queueName));
    await this.runPowerShell([
      'Add-Type -AssemblyName System.Messaging',
      `$path = '${path}'`,
      `$body = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))`,
      '$q = New-Object System.Messaging.MessageQueue($path)',
      '$q.Send($body)',
      '$q.Dispose()'
    ].join('; '));
    return resolvedMessageId;
  }

  async receive(queueName) {
    const path = escapePowerShell(this.fullQueuePath(queueName));
    const output = await this.runPowerShell([
      'Add-Type -AssemblyName System.Messaging',
      `$q = New-Object System.Messaging.MessageQueue('${path}')`,
      '$q.Formatter = New-Object System.Messaging.XmlMessageFormatter([string])',
      'try { $m = $q.Receive([TimeSpan]::FromMilliseconds(100)); [Console]::Write($m.Body) } catch [System.Messaging.MessageQueueException] { if ($_.Exception.Message -notmatch "timeout") { throw } } finally { $q.Dispose() }'
    ].join('; '));
    return output ? JSON.parse(output) : null;
  }

  async dequeue(queueName) { return this.receive(queueName); }

  async claim(queueName, workerId, leaseMs = 30000) {
    const payload = await this.receive(queueName);
    if (!payload) return null;
    const claimToken = randomUUID();
    const attempts = Number(payload?.message?.attemptCount || 0) + 1;
    const claim = { queueName, workerId: String(workerId || 'anonymous-worker'), claimToken, leaseExpiresAt: Date.now() + Math.max(1000, Number(leaseMs || 30000)), attempts, message: { ...payload, attemptCount: attempts } };
    this.claims.set(claimToken, claim);
    return claim;
  }

  heartbeatClaim(queueName, claimToken, workerId, extendMs = 30000) {
    const claim = this.claims.get(claimToken);
    if (!claim) return null;
    if (workerId && claim.workerId !== String(workerId)) return 'forbidden';
    claim.leaseExpiresAt = Date.now() + Math.max(1000, Number(extendMs || 30000));
    return { queueName, claimToken, workerId: claim.workerId, leaseExpiresAt: claim.leaseExpiresAt };
  }

  async completeClaim(queueName, claimToken, workerId, completionMeta = null) {
    const claim = this.claims.get(claimToken);
    if (!claim) return null;
    if (workerId && claim.workerId !== String(workerId)) return 'forbidden';
    this.claims.delete(claimToken);
    return { queueName, claimToken, workerId: claim.workerId, messageId: claim.message.messageId, attempts: claim.attempts, completionMeta };
  }

  async failClaim(queueName, claimToken, workerId, options = {}) {
    const claim = this.claims.get(claimToken);
    if (!claim) return null;
    if (workerId && claim.workerId !== String(workerId)) return 'forbidden';
    this.claims.delete(claimToken);
    if (!options.deadLetter && claim.attempts < Math.max(1, Number(options.maxAttempts || 5))) await this.enqueue(queueName, claim.message.message, claim.message.sourceService, claim.message.messageId, claim.message.messageEnvelope);
    return { status: options.deadLetter || claim.attempts >= Number(options.maxAttempts || 5) ? 'dead-letter' : 'requeued', queueName, attempts: claim.attempts, reason: String(options.reason || 'worker-failed') };
  }

  reapExpiredClaims(queueName = null, nowMs = Date.now()) {
    let count = 0;
    for (const [token, claim] of this.claims) if ((!queueName || claim.queueName === queueName) && claim.leaseExpiresAt <= nowMs) { this.claims.delete(token); count += 1; void this.enqueue(claim.queueName, claim.message.message, claim.message.sourceService, claim.message.messageId, claim.message.messageEnvelope); }
    return count;
  }

  async getQueueLength(queueName) {
    const path = escapePowerShell(this.fullQueuePath(queueName));
    const output = await this.runPowerShell(`Add-Type -AssemblyName System.Messaging; $q = New-Object System.Messaging.MessageQueue('${path}'); $n = $q.GetAllMessages().Count; $q.Dispose(); $n`);
    return Number(output) || 0;
  }

  getPersistenceStatus() { return { enabled: true, backend: 'msmq', baseQueuePath: this.baseQueuePath, checkedAt: new Date().toISOString() }; }
  getSnapshot() { return { name: this.name, version: 0, configVersion: 0, queueLengths: {}, claimMetrics: {}, queueConfig: { ...this.queueConfig }, timestamp: Date.now() }; }
  getCurrentVersion() { return 0; }
  getOperationsSince() { return []; }
  onConfigChange() {}
  enqueueReplicated(...args) { return this.enqueue(...args); }
  dequeueReplicated(queueName) { return this.dequeue(queueName); }
  applySnapshot() {}
  applyReplicatedOperation() {}
  freezeQueue(queueName) { this.updateQueueConfig(queueName, { frozen: true }); }
  thawQueue(queueName) { this.updateQueueConfig(queueName, { frozen: false }); }
  close() { clearInterval(this.reaperTimer); }
}