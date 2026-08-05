#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const args = {
    mode: 'inventory',
    config: '',
    pattern: '^Pulse-.*-Provision$',
    timeoutMs: 15000,
    settleMs: 4000,
    retries: 2,
    backoffMs: 800,
    backoffMultiplier: 2,
    ledgerPath: '',
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--mode') args.mode = String(argv[i + 1] || args.mode);
    if (token === '--config') args.config = String(argv[i + 1] || '');
    if (token === '--pattern') args.pattern = String(argv[i + 1] || args.pattern);
    if (token === '--timeout-ms') args.timeoutMs = Number.parseInt(argv[i + 1] || String(args.timeoutMs), 10);
    if (token === '--settle-ms') args.settleMs = Number.parseInt(argv[i + 1] || String(args.settleMs), 10);
    if (token === '--retries') args.retries = Number.parseInt(argv[i + 1] || String(args.retries), 10);
    if (token === '--backoff-ms') args.backoffMs = Number.parseInt(argv[i + 1] || String(args.backoffMs), 10);
    if (token === '--backoff-multiplier') args.backoffMultiplier = Number.parseFloat(argv[i + 1] || String(args.backoffMultiplier));
    if (token === '--ledger-path') args.ledgerPath = String(argv[i + 1] || '');
    if (token === '--dry-run') args.dryRun = true;
  }

  args.retries = Number.isFinite(args.retries) ? Math.max(0, args.retries) : 0;
  args.backoffMs = Number.isFinite(args.backoffMs) ? Math.max(0, args.backoffMs) : 0;
  args.backoffMultiplier = Number.isFinite(args.backoffMultiplier) ? Math.max(1, args.backoffMultiplier) : 1;

  return args;
}

function resolveDefaultLedgerPath() {
  const defaultOperationalRoot = path.resolve(
    process.env.PULSE_OPERATIONAL_DATA_ROOT
    || (process.platform === 'win32' ? 'c:/dev/pulse-operational-data' : '/opt/pulse/operational-data')
  );
  const runtimeRoot = path.resolve(
    process.env.PULSE_RUNTIME_DATA_ROOT
    || process.env.PULSE_QUEUE_DATA_ROOT
    || defaultOperationalRoot
  );
  return path.join(runtimeRoot, 'provisioning-agent', 'ledger.jsonl');
}

async function appendLedgerEntry(ledgerPath, entry) {
  const target = path.resolve(ledgerPath || resolveDefaultLedgerPath());
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.appendFile(target, `${JSON.stringify(entry)}\n`, 'utf8');
  return target;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function runNetsh(args) {
  const { stdout } = await execFileAsync('netsh', args, { windowsHide: true });
  return stdout || '';
}

async function listVisibleSsids() {
  const out = await runNetsh(['wlan', 'show', 'networks', 'mode=bssid']);
  const lines = out.split(/\r?\n/);
  const ssids = [];
  for (const raw of lines) {
    const line = raw.trim();
    const match = line.match(/^SSID\s+\d+\s*:\s*(.*)$/i);
    if (!match) continue;
    const ssid = String(match[1] || '').trim();
    if (!ssid) continue;
    if (!ssids.includes(ssid)) ssids.push(ssid);
  }
  return ssids;
}

async function connectSsid(ssid) {
  await runNetsh(['wlan', 'connect', `name=${ssid}`]);
}

async function connectProfile(profileName) {
  await runNetsh(['wlan', 'connect', `name=${profileName}`]);
}

async function withRetries(taskLabel, runtimeArgs, operation) {
  const retries = Number(runtimeArgs?.retries || 0);
  const baseBackoffMs = Number(runtimeArgs?.backoffMs || 0);
  const backoffMultiplier = Number(runtimeArgs?.backoffMultiplier || 1);

  const errors = [];
  let attempt = 0;
  let nextDelayMs = baseBackoffMs;

  while (attempt <= retries) {
    attempt += 1;
    try {
      const value = await operation(attempt);
      return { ok: true, value, attempts: attempt, errors };
    } catch (error) {
      const message = String(error?.message || error || `${taskLabel} failed`);
      errors.push(message);
      if (attempt > retries) {
        return { ok: false, error: message, attempts: attempt, errors };
      }
      if (nextDelayMs > 0) {
        await sleep(nextDelayMs);
      }
      nextDelayMs = Math.round(nextDelayMs * backoffMultiplier);
    }
  }

  return { ok: false, error: `${taskLabel} failed`, attempts: attempt, errors };
}

function normalizeAuthMode(raw) {
  const mode = String(raw || '').trim().toLowerCase();
  if (!mode) return 'wpa2-psk';
  if (mode === 'wpa2-enterprise' || mode === 'enterprise' || mode === 'wpa-eap') return 'wpa2-enterprise';
  return 'wpa2-psk';
}

function buildTargetLanProfile(targetLan = {}, overrides = {}) {
  const profile = {
    ssid: String(overrides.ssid ?? targetLan.ssid ?? '').trim(),
    password: String(overrides.password ?? targetLan.password ?? ''),
    authMode: normalizeAuthMode(overrides.authMode ?? targetLan.authMode),
    eapMethod: String(overrides.eapMethod ?? targetLan.eapMethod ?? '').trim(),
    identity: String(overrides.identity ?? targetLan.identity ?? '').trim(),
    username: String(overrides.username ?? targetLan.username ?? '').trim(),
    enterprisePassword: String(overrides.enterprisePassword ?? targetLan.enterprisePassword ?? ''),
    hostname: String(overrides.hostname ?? targetLan.hostname ?? '').trim(),
    dhcp: overrides.dhcp !== undefined ? overrides.dhcp !== false : targetLan.dhcp !== false,
    staticIP: String(overrides.staticIP ?? targetLan.staticIP ?? '').trim(),
    gateway: String(overrides.gateway ?? targetLan.gateway ?? '').trim(),
    subnet: String(overrides.subnet ?? targetLan.subnet ?? '').trim(),
    dns1: String(overrides.dns1 ?? targetLan.dns1 ?? '').trim(),
    dns2: String(overrides.dns2 ?? targetLan.dns2 ?? '').trim(),
  };

  if (profile.authMode === 'wpa2-enterprise') {
    if (!profile.enterprisePassword) {
      profile.enterprisePassword = profile.password;
    }
    if (!profile.identity && profile.username) {
      profile.identity = profile.username;
    }
    if (!profile.username && profile.identity) {
      profile.username = profile.identity;
    }
  }

  return profile;
}

function validateTargetLanProfile(profile) {
  if (!profile.ssid) {
    throw new Error('config.targetLan.ssid is required');
  }

  if (profile.authMode === 'wpa2-enterprise') {
    const secret = profile.enterprisePassword || profile.password;
    if (!profile.identity || !profile.username || !secret) {
      throw new Error('enterprise targetLan profile requires identity, username, and password or enterprisePassword');
    }
    return;
  }

  if (!profile.password) {
    throw new Error('config.targetLan.password is required for wpa2-psk mode');
  }
}

async function provisionNodeOverAp({ targetNodeApSsid, profile, nodeName = '', reboot = true, timeoutMs = 15000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    const body = new URLSearchParams();
    body.set('ssid', profile.ssid);
    body.set('password', profile.password || '');
    body.set('authMode', profile.authMode || 'wpa2-psk');
    if (profile.eapMethod) body.set('eapMethod', profile.eapMethod);
    if (profile.identity) body.set('identity', profile.identity);
    if (profile.username) body.set('username', profile.username);
    if (profile.enterprisePassword) body.set('enterprisePassword', profile.enterprisePassword);
    if (profile.hostname) body.set('hostname', profile.hostname);
    body.set('dhcp', profile.dhcp === false ? 'false' : 'true');
    if (profile.dhcp === false) {
      if (profile.staticIP) body.set('staticIP', profile.staticIP);
      if (profile.gateway) body.set('gateway', profile.gateway);
      if (profile.subnet) body.set('subnet', profile.subnet);
      if (profile.dns1) body.set('dns1', profile.dns1);
      if (profile.dns2) body.set('dns2', profile.dns2);
    }
    if (nodeName) body.set('nodeName', nodeName);
    body.set('reboot', reboot ? '1' : '0');

    const response = await fetch('http://192.168.4.1/api/wifi/provision', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });

    const text = await response.text().catch(() => '');
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    return {
      ok: response.ok,
      status: response.status,
      body: payload,
      apSsid: targetNodeApSsid,
    };
  } finally {
    clearTimeout(timer);
  }
}

function deriveNodeNameFromApSsid(apSsid, fallbackPrefix = 'node') {
  const trimmed = String(apSsid || '').trim();
  const noPrefix = trimmed.replace(/^Pulse-/, '').replace(/-Provision$/i, '');
  const candidate = noPrefix.replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return candidate || `${fallbackPrefix}-${Date.now()}`;
}

async function runInventory({ pattern }) {
  const regex = new RegExp(pattern);
  const ssids = await listVisibleSsids();
  const provisioningSsids = ssids.filter((name) => regex.test(name));
  return {
    seenCount: ssids.length,
    provisioningCount: provisioningSsids.length,
    provisioningSsids,
  };
}

async function runApBatch(config, runtimeArgs) {
  const regex = new RegExp(config.scanPattern || runtimeArgs.pattern || '^Pulse-.*-Provision$');
  const targetLanProfile = buildTargetLanProfile(config.targetLan);
  validateTargetLanProfile(targetLanProfile);

  const controlProfileName = String(config.controlProfileName || '').trim();
  const useDerivedNodeName = config.useDerivedNodeName !== false;

  const inventory = await runInventory({ pattern: regex.source });
  const results = [];

  for (const apSsid of inventory.provisioningSsids) {
    const plannedNodeName = useDerivedNodeName ? deriveNodeNameFromApSsid(apSsid, 'pulse-node') : '';

    if (runtimeArgs.dryRun) {
      results.push({ apSsid, skipped: true, reason: 'dry-run', plannedNodeName });
      continue;
    }

    const attempt = await withRetries(`ap-batch:${apSsid}`, runtimeArgs, async () => {
      await connectSsid(apSsid);
      await sleep(runtimeArgs.settleMs);
      return provisionNodeOverAp({
        targetNodeApSsid: apSsid,
        profile: targetLanProfile,
        nodeName: plannedNodeName,
        reboot: true,
        timeoutMs: runtimeArgs.timeoutMs,
      });
    });

    if (attempt.ok) {
      results.push({ apSsid, nodeName: plannedNodeName, ...attempt.value, attempts: attempt.attempts, retryErrors: attempt.errors });
    } else {
      results.push({ apSsid, nodeName: plannedNodeName, ok: false, attempts: attempt.attempts, retryErrors: attempt.errors, error: attempt.error });
    }
  }

  if (!runtimeArgs.dryRun && controlProfileName) {
    try {
      await connectProfile(controlProfileName);
      await sleep(runtimeArgs.settleMs);
    } catch {
      // best effort
    }
  }

  return {
    mode: 'ap-batch',
    scanned: inventory.seenCount,
    matched: inventory.provisioningCount,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => r.ok === false).length,
    results,
  };
}

async function runAggregatorBatch(config, runtimeArgs) {
  const baseUrl = String(config.aggregator?.baseUrl || 'http://127.0.0.1:4000').replace(/\/$/, '');
  const actorUserId = String(config.aggregator?.actorUserId || 'system-admin').trim();
  const targetLanProfile = buildTargetLanProfile(config.targetLan);
  const nodes = Array.isArray(config.nodeIds) ? config.nodeIds.map((v) => String(v || '').trim()).filter(Boolean) : [];

  validateTargetLanProfile(targetLanProfile);
  if (nodes.length === 0) {
    throw new Error('config.nodeIds must contain at least one node id for aggregator-batch mode');
  }

  const results = [];
  for (const nodeId of nodes) {
    const nodeProfile = buildTargetLanProfile(targetLanProfile, {
      hostname: String(config.hostnameById?.[nodeId] || '').trim() || targetLanProfile.hostname,
      staticIP: String(config.staticIPById?.[nodeId] || '').trim() || targetLanProfile.staticIP,
    });
    const payload = {
      profiles: [nodeProfile],
      nodeName: String(config.nodeNameById?.[nodeId] || '').trim() || undefined,
      replaceExisting: true,
      rebootAfter: true,
    };

    if (runtimeArgs.dryRun) {
      results.push({ nodeId, skipped: true, reason: 'dry-run', payload });
      continue;
    }

    const attempt = await withRetries(`aggregator-batch:${nodeId}`, runtimeArgs, async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(1000, runtimeArgs.timeoutMs));
      try {
        const response = await fetch(`${baseUrl}/api/nodes/${encodeURIComponent(nodeId)}/provision/wifi`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-user-id': actorUserId,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const text = await response.text().catch(() => '');
        let data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { raw: text };
        }
        return { ok: response.ok, status: response.status, body: data };
      } finally {
        clearTimeout(timer);
      }
    });

    if (attempt.ok) {
      results.push({ nodeId, ...attempt.value, attempts: attempt.attempts, retryErrors: attempt.errors });
    } else {
      results.push({ nodeId, ok: false, attempts: attempt.attempts, retryErrors: attempt.errors, error: attempt.error });
    }
  }

  return {
    mode: 'aggregator-batch',
    targetCount: nodes.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => r.ok === false).length,
    results,
  };
}

async function readConfig(configPath) {
  if (!configPath) return {};
  const absolute = path.resolve(configPath);
  const text = await fs.readFile(absolute, 'utf8');
  return JSON.parse(text);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await readConfig(args.config);
  const mode = String(args.mode || 'inventory').trim().toLowerCase();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  let result;
  if (mode === 'inventory') {
    result = await runInventory({ pattern: args.pattern });
  } else if (mode === 'ap-batch') {
    result = await runApBatch(config, args);
  } else if (mode === 'aggregator-batch') {
    result = await runAggregatorBatch(config, args);
  } else {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const finishedAt = new Date().toISOString();
  const completed = {
    runId,
    startedAt,
    finishedAt,
    durationMs: Date.now() - startedMs,
    mode,
    dryRun: Boolean(args.dryRun),
    retryPolicy: {
      retries: args.retries,
      backoffMs: args.backoffMs,
      backoffMultiplier: args.backoffMultiplier,
    },
    result,
  };

  const ledgerPath = await appendLedgerEntry(args.ledgerPath, completed);
  completed.ledgerPath = ledgerPath;

  process.stdout.write(`${JSON.stringify(completed, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`[provisioning-lan-agent] ${String(error?.message || error)}\n`);
  process.exit(1);
});
