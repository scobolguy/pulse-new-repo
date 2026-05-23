import os from 'os';
import net from 'net';
import { execFileSync } from 'child_process';

const args = new Set(process.argv.slice(2));
const runOnce = args.has('--once');

const BACKEND_ORIGIN = process.env.SUPERVISOR_BACKEND_ORIGIN || 'http://127.0.0.1:4000';
const BACKEND_STATUS_URL = process.env.SUPERVISOR_BACKEND_STATUS_URL || `${BACKEND_ORIGIN}/status`;
const DEFAULT_WEB_STATUS_URL = process.env.SUPERVISOR_WEB_STATUS_URL || 'http://127.0.0.1:5173/';
const HAS_EXPLICIT_WEB_STATUS_URL = Boolean(String(process.env.SUPERVISOR_WEB_STATUS_URL || '').trim());
const EDGE_STATUS_URL = process.env.SUPERVISOR_EDGE_STATUS_URL || '';
const HEARTBEAT_URL = process.env.SUPERVISOR_HEARTBEAT_URL || `${BACKEND_ORIGIN}/api/supervisor/heartbeat`;
const INTERVAL_MS = Math.max(1000, Number(process.env.SUPERVISOR_INTERVAL_MS || 5000));
const TIMEOUT_MS = Math.max(500, Number(process.env.SUPERVISOR_TIMEOUT_MS || 3000));
const ROLE = process.env.SUPERVISOR_ROLE || 'host-supervisor-proxy';
const WEB_CHECK_MODE = String(process.env.SUPERVISOR_WEB_CHECK_MODE || 'http').trim().toLowerCase();
const WEB_AUTODETECT_ENABLED = !HAS_EXPLICIT_WEB_STATUS_URL && String(process.env.SUPERVISOR_WEB_AUTODETECT || 'true').trim().toLowerCase() !== 'false';
const WEB_PORT_CANDIDATES = String(process.env.SUPERVISOR_WEB_PORT_CANDIDATES || '5173,5174,5175,5176,5177,5178,5179,5180,5181,5182,5183,5184,5185,5186,5187,5188,5189,5190')
  .split(',')
  .map((value) => Number(String(value || '').trim()))
  .filter((value) => Number.isInteger(value) && value > 0);
let resolvedWebStatusUrl = DEFAULT_WEB_STATUS_URL;

function detectHostIp() {
  try {
    const interfaces = os.networkInterfaces();
    for (const list of Object.values(interfaces)) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || item.internal) continue;
        if (item.family === 'IPv4') return item.address;
      }
    }
  } catch {
  }
  return '127.0.0.1';
}

const nodeName = process.env.SUPERVISOR_NODE_NAME || os.hostname() || 'host-supervisor';
const nodeId = process.env.SUPERVISOR_NODE_ID || `${nodeName}-heartbeat`;
const hostIp = process.env.SUPERVISOR_NODE_IP || detectHostIp();

async function probeTarget(name, url) {
  if (!url) {
    return {
      name,
      url,
      healthy: true,
      statusCode: null,
      lastError: ''
    };
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const healthy = response.status >= 200 && response.status < 500;
    return {
      name,
      url,
      healthy,
      statusCode: response.status,
      lastError: healthy ? '' : `http ${response.status}`
    };
  } catch (error) {
    return {
      name,
      url,
      healthy: false,
      statusCode: null,
      lastError: error?.message || String(error)
    };
  }
}

function parseHostPort(targetUrl) {
  const parsed = new URL(targetUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80))
  };
}

function detectVitePortWindows() {
  try {
    const psScript = [
      "$vitePids = Get-CimInstance Win32_Process | Where-Object { $_.Name -ieq 'node.exe' -and $_.CommandLine -match 'vite' } | Select-Object -ExpandProperty ProcessId",
      "$ports = @()",
      "foreach ($procId in $vitePids) {",
      "  $ports += Get-NetTCPConnection -State Listen -OwningProcess $procId -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort",
      "}",
      "$ports | Sort-Object -Unique | ForEach-Object { Write-Output $_ }"
    ].join('; ');

    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', psScript], { encoding: 'utf8' });
    const ports = output
      .split(/\r?\n/)
      .map((line) => Number(String(line || '').trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (!ports.length) return null;
    const preferred = ports.find((port) => port >= 5173 && port <= 5190);
    return preferred || ports[0] || null;
  } catch {
    return null;
  }
}

async function detectWebStatusUrl() {
  if (!WEB_AUTODETECT_ENABLED) return resolvedWebStatusUrl;

  const activePorts = [];
  for (const port of WEB_PORT_CANDIDATES) {
    const check = await probeTcpTarget('web-port-scan', `http://127.0.0.1:${port}/`);
    if (check.healthy) {
      activePorts.push(port);
    }
  }

  if (activePorts.length > 0) {
    const selected = Math.max(...activePorts);
    return `http://127.0.0.1:${selected}/`;
  }

  if (process.platform === 'win32') {
    const port = detectVitePortWindows();
    if (port) return `http://127.0.0.1:${port}/`;
  }

  return resolvedWebStatusUrl;
}

function probeTcpTarget(name, url) {
  return new Promise((resolve) => {
    try {
      const { host, port } = parseHostPort(url);
      const socket = new net.Socket();
      let settled = false;

      const done = (result) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch {
        }
        resolve(result);
      };

      socket.setTimeout(TIMEOUT_MS);
      socket.once('connect', () => {
        done({
          name,
          url,
          healthy: true,
          statusCode: 200,
          lastError: ''
        });
      });
      socket.once('timeout', () => {
        done({
          name,
          url,
          healthy: false,
          statusCode: null,
          lastError: 'tcp timeout'
        });
      });
      socket.once('error', (error) => {
        done({
          name,
          url,
          healthy: false,
          statusCode: null,
          lastError: error?.message || String(error)
        });
      });
      socket.connect(port, host);
    } catch (error) {
      resolve({
        name,
        url,
        healthy: false,
        statusCode: null,
        lastError: error?.message || String(error)
      });
    }
  });
}

async function sendHeartbeat() {
  resolvedWebStatusUrl = await detectWebStatusUrl();

  let webCheck = WEB_CHECK_MODE === 'tcp'
    ? await probeTcpTarget('web', resolvedWebStatusUrl)
    : await probeTarget('web', resolvedWebStatusUrl);

  if (!webCheck.healthy && WEB_AUTODETECT_ENABLED) {
    const refreshedUrl = await detectWebStatusUrl();
    if (refreshedUrl !== resolvedWebStatusUrl) {
      resolvedWebStatusUrl = refreshedUrl;
      webCheck = WEB_CHECK_MODE === 'tcp'
        ? await probeTcpTarget('web', resolvedWebStatusUrl)
        : await probeTarget('web', resolvedWebStatusUrl);
    }
  }

  const checks = [
    await probeTarget('backend', BACKEND_STATUS_URL),
    webCheck
  ];

  if (EDGE_STATUS_URL) {
    checks.push(await probeTarget('edge', EDGE_STATUS_URL));
  }

  const overallHealthy = checks.every((item) => item.healthy);
  const nowIso = new Date().toISOString();

  const payload = {
    nodeId,
    nodeName,
    ip: hostIp,
    deviceRole: ROLE,
    overallHealthy,
    supervisor: {
      generatedBy: 'host-heartbeat-loop',
      overallHealthy,
      checkIntervalMs: INTERVAL_MS,
      checkedAt: nowIso,
      targets: checks.map((item) => ({
        name: item.name,
        url: item.url,
        healthy: item.healthy,
        statusCode: item.statusCode,
        lastError: item.lastError
      }))
    }
  };

  try {
    const response = await fetch(HEARTBEAT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    const text = await response.text();
    console.log(JSON.stringify({
      at: nowIso,
      overallHealthy,
      heartbeatStatus: response.status,
      heartbeatUrl: HEARTBEAT_URL,
      checks,
      backendResponse: text
    }));
  } catch (error) {
    console.error(JSON.stringify({
      at: nowIso,
      overallHealthy,
      heartbeatStatus: 'failed',
      heartbeatUrl: HEARTBEAT_URL,
      checks,
      error: error?.message || String(error)
    }));
  }
}

if (runOnce) {
  await sendHeartbeat();
  process.exit(0);
}

console.log(`[SUPERVISOR] host heartbeat loop started nodeId=${nodeId} intervalMs=${INTERVAL_MS}`);
await sendHeartbeat();
setInterval(() => {
  sendHeartbeat().catch((error) => {
    console.error('[SUPERVISOR] heartbeat loop error', error?.message || String(error));
  });
}, INTERVAL_MS);