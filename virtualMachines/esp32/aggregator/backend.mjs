import fs from 'fs';
import http from 'http';
import v8 from 'v8';
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err?.stack || err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason?.stack || reason);
});
// Run with: node backend.mjs
import dgram from 'dgram';
import express from 'express';
import cors from 'cors';
import os from 'os';
import path from 'path';
import { performance, monitorEventLoopDelay } from 'perf_hooks';
import { execFile, execFileSync, spawn } from 'child_process';
// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
import { fileURLToPath } from 'url';
import { createMessageBroker, createQueueManager } from './src/broker.js';
import { createFileServer } from './fileServer.js';
import { createRouterEngine } from './router-engine.mjs';
import { MetricsCollector } from './src/metrics-collector.mjs';
import {
  readEnvString,
  readEnvSecret,
  readEnvNumber,
  readEnvBoolean,
  BROKER_SUPPORTED_PROVIDERS,
  normalizeBrokerProvider
} from './src/env-config.mjs';
import {
  loadWorkerConfig as loadWorkerConfigFromFile,
  getWorkerDefaults as getWorkerDefaultsFromConfig,
  validateWorkerConfigUpdate,
  applyWorkerConfigUpdate,
  persistWorkerConfig
} from './src/worker-config.mjs';
import { createGroupProvider } from './src/group-provider.mjs';
import { createMonitorClassProvider } from './src/monitor-class-provider.mjs';
import {
  getLatencyPolicyThresholds,
  evaluateLatencyPolicies,
  validateLatencyPolicyTargetsUpdate,
  applyLatencyPolicyTargetsUpdate
} from './src/latency-policy.mjs';
import { registerLifecycleInquiryRoutes } from './src/backend/roles/lifecycleInquiryRoutes.mjs';
import { registerLifecycleWorkerGatewayRoutes } from './src/backend/roles/lifecycleWorkerGatewayRoutes.mjs';
import { registerQueueBrokerOpsRoutes } from './src/backend/roles/queueBrokerOpsRoutes.mjs';
import { registerComplianceRoutes } from './src/backend/roles/complianceRoutes.mjs';
import { registerGovernanceRolePolicyRoutes } from './src/backend/roles/governanceRolePolicyRoutes.mjs';
import { registerObservabilityRoutes } from './src/backend/roles/observabilityRoutes.mjs';
import { registerPlatformRoutes } from './src/backend/roles/platformRoutes.mjs';
import { registerReplicationRoutes } from './src/backend/roles/replicationRoutes.mjs';
import { registerQueueConfigRoutes } from './src/backend/roles/queueConfigRoutes.mjs';
import { registerQueueTransferRoutes } from './src/backend/roles/queueTransferRoutes.mjs';
import { registerAvailabilityPresenceRoutes } from './src/backend/roles/availabilityPresenceRoutes.mjs';
import { registerTopologyRuntimeRoutes } from './src/backend/roles/topologyRuntimeRoutes.mjs';
import { registerAllocatorRoutes } from './src/backend/roles/allocatorRoutes.mjs';
import { registerLibrarianProxyRoutes } from './src/backend/roles/librarianProxyRoutes.mjs';
import { registerMapperProxyRoutes } from './src/backend/roles/mapperProxyRoutes.mjs';
import { registerRuntimeRegistryRoutes } from './src/backend/roles/runtimeRegistryRoutes.mjs';
import { registerRouterLifecycleControlRoutes } from './src/backend/roles/routerLifecycleControlRoutes.mjs';
import { registerHelloServiceRoutes } from './src/backend/roles/helloServiceRoutes.mjs';
import { registerProvisioningAgentRoutes } from './src/backend/roles/provisioningAgentRoutes.mjs';
import { registerDevelopDocumentRoutes } from './src/backend/developDocumentRoutes.mjs';
import { registerProjectWorkspaceRoutes } from './src/backend/projectWorkspaceRoutes.mjs';
import { registerTransformerServiceRoutes } from './src/backend/transformerServiceRoutes.mjs';
import { registerStartupFsmRoutes } from './src/backend/startupFsmRoutes.mjs';
import { registerMapperRoutes } from './src/backend/mapperRoutes.mjs';
import { registerOllamaRoutes } from './src/backend/ollamaRoutes.mjs';
import { registerUserProvisioningRoutes } from './src/backend/modules/userProvisioningRoutes.mjs';
import { registerDeveloperGovernanceRoutes } from './src/backend/modules/developerGovernanceRoutes.mjs';
import { registerOrchestrationRegistryRoutes } from './src/backend/modules/orchestrationRegistryRoutes.mjs';
import { registerBrokerAdminRoutes } from './src/backend/modules/brokerAdminRoutes.mjs';
import { registerMediaGatewayRoutes } from './src/backend/modules/mediaGatewayRoutes.mjs';
import { registerIdentityRoutes } from './src/backend/modules/identityRoutes.mjs';
import { createRouteManifestDependencyFactories } from './src/backend/modules/routeManifestDependencies.mjs';
import { startBackendRuntime } from './src/backend/modules/startupBootstrap.mjs';
import { createLifecycleHarnessPathApi } from './src/backend/modules/lifecycleHarnessPaths.mjs';
import { createRuntimeDiagnosticsApi } from './src/backend/modules/runtimeDiagnosticsApi.mjs';
import { createMachineAvailabilityPresenceApi } from './src/backend/modules/machineAvailabilityPresenceApi.mjs';
import { createLifecycleQueueMetricsApi } from './src/backend/modules/lifecycleQueueMetricsApi.mjs';
import { createDatabaseRegistrySnapshotApi } from './src/backend/modules/databaseRegistrySnapshotApi.mjs';
import { createAuthoritativeTimeService } from './src/backend/modules/authoritativeTimeService.mjs';
import { createBusinessCalendarService } from './src/backend/modules/businessCalendarService.mjs';
import { createTemporalQueryService } from './src/backend/modules/temporalQueryService.mjs';
import { createRequestPolicyApi } from './src/backend/security/requestPolicy.mjs';
import { loadRouteManifest, registerRoutesFromManifest } from './src/backend/routeManifestLoader.mjs';
import { enumerateApiCatalog, enumerateDiscoveredNodeApiCatalog, findApiCatalogEntry } from './src/backend/apiCatalog.mjs';
import {
  listServiceProviders,
  getServiceProvider,
  getServiceProviderAction,
  getServiceProviderCategories,
  listServiceProviderActions
} from './src/backend/providers/serviceProviderRegistry.mjs';
import { compileQueueDslSpec, diffQueueConfigs } from './src/backend/queueDslCompiler.mjs';
import { createSanctionsComplianceService } from './src/compliance/sanctionsService.mjs';
import crypto from 'crypto';

// ===== ESP32 NODE REGISTRY =====
import { createNodeRegistry } from './src/esp32/nodeRegistry.mjs';
import { createNodeRegistryRoutes } from './src/esp32/nodeRegistryRoutes.mjs';

// ===== PASCAL COMPILER SERVICE =====
import { createPascalCompiler } from './src/pascal/compilerService.mjs';
import pascalCompilerRoutes from './src/pascal/compilerRoutes.mjs';

// ===== SERVICE PROXY UTILITY =====
// When services are modular, proxy requests to them
// Set MODULAR_BACKEND=1 to use separate services; else use unified backend

const MODULAR_MODE = readEnvBoolean('MODULAR_BACKEND', ['1'], false);
const BROKER_SERVICE_URL = readEnvString('BROKER_SERVICE_URL', 'http://localhost:4001').trim().replace(/\/$/, '');
const DEBUG_BACKEND = readEnvBoolean('DEBUG_BACKEND', ['true'], false);
const SHOW_UDP_LOGS = readEnvBoolean('SHOW_UDP_LOGS', ['1', 'true', 'yes'], false);
const DEFAULT_LIBRARIAN_PORT = 4300;
const LOCAL_TTS_SCRIPT_PATH = path.join(__dirname, 'scripts', 'local-tts.ps1');
const LOCAL_TTS_OUTPUT_DIR = path.join(__dirname, 'data', 'local-tts');
const PIPER_BIN_PATH = readEnvString('PIPER_BIN_PATH', path.join(__dirname, 'tools', 'piper', 'piper', 'piper.exe')).trim();
const PIPER_MODEL_PATH = readEnvString('PIPER_MODEL_PATH', path.join(__dirname, 'tools', 'piper', 'models', 'en_US-lessac-medium', 'en_US-lessac-medium.onnx')).trim();
const TIME_AUTHORITY_ID = readEnvString('TIME_AUTHORITY_ID', 'aggregator-local-clock').trim() || 'aggregator-local-clock';
const TIME_AUTHORITY_OFFSET_MS = readEnvNumber('TIME_AUTHORITY_OFFSET_MS', 0);
const TIME_NTP_ENABLED = readEnvBoolean('TIME_NTP_ENABLED', ['1', 'true', 'yes'], true);
const TIME_NTP_SERVER = readEnvString('TIME_NTP_SERVER', 'pool.ntp.org').trim() || 'pool.ntp.org';
const TIME_NTP_PORT = Math.max(1, readEnvNumber('TIME_NTP_PORT', 123));
const TIME_NTP_TIMEOUT_MS = Math.max(200, readEnvNumber('TIME_NTP_TIMEOUT_MS', 2500));
const TIME_NTP_SYNC_INTERVAL_MS = Math.max(1000, readEnvNumber('TIME_NTP_SYNC_INTERVAL_MS', 300000));
const authoritativeTimeService = createAuthoritativeTimeService({
  authorityId: TIME_AUTHORITY_ID,
  offsetMs: TIME_AUTHORITY_OFFSET_MS,
  source: 'aggregator-local'
});
const businessCalendarService = createBusinessCalendarService({
  nowProvider: () => authoritativeTimeService.nowMs(),
  defaultCalendarId: readEnvString('BUSINESS_CALENDAR_DEFAULT', 'CA-ON').trim() || 'CA-ON'
});
const authoritativeTimeSyncState = {
  running: false,
  timerId: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null
};

async function syncAuthoritativeTimeWithNtp({ reason = 'scheduled' } = {}) {
  if (authoritativeTimeSyncState.running) {
    return { skipped: true, reason: 'sync-already-running' };
  }

  authoritativeTimeSyncState.running = true;
  authoritativeTimeSyncState.lastAttemptAt = authoritativeTimeService.nowIso();
  try {
    const result = await authoritativeTimeService.syncFromNtp({
      server: TIME_NTP_SERVER,
      port: TIME_NTP_PORT,
      timeoutMs: TIME_NTP_TIMEOUT_MS
    });
    authoritativeTimeSyncState.lastSuccessAt = authoritativeTimeService.nowIso();
    authoritativeTimeSyncState.lastError = null;
    return {
      ok: true,
      reason,
      ...result
    };
  } catch (error) {
    authoritativeTimeService.markSyncError(error, {
      source: `ntp:${TIME_NTP_SERVER}`,
      ntpServer: TIME_NTP_SERVER,
      ntpPort: TIME_NTP_PORT,
      reason
    });
    authoritativeTimeSyncState.lastError = String(error?.message || error || 'ntp-sync-failed');
    return {
      ok: false,
      reason,
      error: authoritativeTimeSyncState.lastError
    };
  } finally {
    authoritativeTimeSyncState.running = false;
  }
}

function startAuthoritativeTimeSyncMonitor() {
  if (!TIME_NTP_ENABLED || authoritativeTimeSyncState.timerId) {
    return;
  }

  void syncAuthoritativeTimeWithNtp({ reason: 'startup' });
  authoritativeTimeSyncState.timerId = setInterval(() => {
    void syncAuthoritativeTimeWithNtp({ reason: 'interval' });
  }, TIME_NTP_SYNC_INTERVAL_MS);
}

function runLocalTtsScript(args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', LOCAL_TTS_SCRIPT_PATH, ...args],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const details = String(stderr || stdout || error.message || '').trim();
          return reject(new Error(details || 'Local TTS script failed'));
        }
        return resolve(String(stdout || '').trim());
      }
    );
  });
}

function resolveEsp32BluetoothAudioOrigin() {
  const explicit = readEnvString('ESP32_BT_AUDIO_ORIGIN', '').trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const host = readEnvString('EDGE_ESP32_HOST', '127.0.0.1').trim() || '127.0.0.1';
  const port = Math.max(1, readEnvNumber('EDGE_ESP32_PORT', 80));
  return `http://${host}:${port}`;
}

async function forwardEsp32BluetoothTts({ text, voice = 'default', timeoutMs = 15000, origin = '' }) {
  const base = String(origin || '').trim().replace(/\/$/, '') || resolveEsp32BluetoothAudioOrigin();
  const params = new URLSearchParams();
  params.set('text', String(text || ''));
  params.set('voice', String(voice || 'default'));
  const endpoint = `${base}/api/bluetooth-audio/tts?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal
    });
    const bodyText = await response.text();
    let payload = null;
    try {
      payload = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      payload = { raw: bodyText };
    }
    if (!response.ok) {
      throw new Error(`ESP32 Bluetooth TTS failed (${response.status}): ${bodyText}`);
    }
    return {
      ok: true,
      endpoint,
      payload
    };
  } catch (err) {
    throw new Error(err?.message || String(err));
  } finally {
    clearTimeout(timer);
  }
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function runPiperSynthesis({ text, outputFile, timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(PIPER_BIN_PATH, ['--model', PIPER_MODEL_PATH, '--output_file', outputFile], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    let stdout = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore kill errors
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk || '');
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk || '');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(err?.message || 'Failed to start Piper process'));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        return reject(new Error('Piper synthesis timed out'));
      }
      if (code !== 0) {
        const detail = String(stderr || stdout || `Piper exited with code ${code}`).trim();
        return reject(new Error(detail));
      }
      return resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });

    child.stdin.write(String(text || ''));
    child.stdin.end();
  });
}

function playWavOnHost(filePath, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const command = `$p=New-Object System.Media.SoundPlayer '${String(filePath || '').replace(/'/g, "''")}';$p.PlaySync();$p.Dispose()`;
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const details = String(stderr || stdout || error.message || '').trim();
          return reject(new Error(details || 'Failed to play wav file'));
        }
        return resolve();
      }
    );
  });
}

if (!SHOW_UDP_LOGS) {
  const originalLog = console.log.bind(console);
  const originalInfo = console.info.bind(console);
  const originalDebug = console.debug.bind(console);
  const isUdpLog = (args) => typeof args?.[0] === 'string' && args[0].startsWith('[UDP]');

  console.log = (...args) => {
    if (isUdpLog(args)) return;
    originalLog(...args);
  };

  console.info = (...args) => {
    if (isUdpLog(args)) return;
    originalInfo(...args);
  };

  console.debug = (...args) => {
    if (isUdpLog(args)) return;
    originalDebug(...args);
  };
}

function debugLog(...args) {
  if (DEBUG_BACKEND) {
    console.debug(...args);
  }
}

function formatErrorDetails(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;

  const details = {
    name: error?.name || undefined,
    message: error?.message || undefined,
    code: error?.code || undefined,
    originalMessage: error?.original?.message || undefined,
    originalCode: error?.original?.code || undefined
  };

  if (details.message) {
    if (details.code || details.originalCode) {
      return `${details.message} (code=${details.code || details.originalCode})`;
    }
    return details.message;
  }

  try {
    const compact = JSON.stringify(details);
    if (compact && compact !== '{}') return compact;
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Proxy HTTP request to another service
 */
function proxyRequest(method, path, req, res, targetUrl = BROKER_SERVICE_URL) {
  const url = new URL(targetUrl);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: path.startsWith('/') ? path : '/' + path,
    method: method,
    headers: { 'content-type': 'application/json', ...req.headers },
    timeout: 5000
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[PROXY] Error proxying to ${targetUrl}:`, err.message);
    res.status(503).json({ error: 'Service unavailable', details: err.message });
  });

  if (req.body && (method === 'POST' || method === 'PUT')) {
    proxyReq.write(JSON.stringify(req.body));
  }
  proxyReq.end();
}


const HTTP_PORT = readEnvNumber('HTTP_PORT', readEnvNumber('PORT', 4000));
const UDP_PORT = 4210;
const BROKER_SERVICE = 'broker';
const ROUTER_SERVICE = 'router';
const FILE_SERVER_SERVICE = 'file-server';
const QUEUE_SERVICE = 'queue-manager';
const BROKER_PROVIDER = normalizeBrokerProvider(readEnvString('BROKER_PROVIDER', 'legacy')) || 'legacy';
const BROKER_RABBITMQ_URL = readEnvString('RABBITMQ_URL', 'amqp://localhost');
const BROKER_RABBITMQ_EXCHANGE = readEnvString('RABBITMQ_EXCHANGE', 'pulse-broker');
const BROKER_RABBITMQ_QUEUE_PREFIX = readEnvString('RABBITMQ_QUEUE_PREFIX', 'pulse');
const BROKER_MSMQ_BASE_QUEUE_PATH = readEnvString('MSMQ_BASE_QUEUE_PATH', '.\\private$');
const BROKER_MSMQ_QUEUE_PREFIX = readEnvString('MSMQ_QUEUE_PREFIX', 'pulse');
const BROKER_KAFKA_BROKERS = readEnvString('KAFKA_BROKERS', 'localhost:9092');
const BROKER_KAFKA_CLIENT_ID = readEnvString('KAFKA_CLIENT_ID', 'pulse-broker');
const BROKER_KAFKA_TOPIC_PREFIX = readEnvString('KAFKA_TOPIC_PREFIX', 'pulse');
const BROKER_IBM_QUEUE_MANAGER = readEnvString('IBM_MQ_QUEUE_MANAGER', 'QM1');
const BROKER_IBM_CHANNEL = readEnvString('IBM_MQ_CHANNEL', 'DEV.APP.SVRCONN');
const BROKER_IBM_CONN_NAME = readEnvString('IBM_MQ_CONN_NAME', 'localhost(1414)');
const BROKER_IBM_QUEUE_PREFIX = readEnvString('IBM_MQ_QUEUE_PREFIX', 'pulse');
const BROKER_IBM_USERNAME = readEnvString('IBM_MQ_USER', '');
const BROKER_IBM_PASSWORD = readEnvSecret('IBM_MQ_PASSWORD', '');
const BROKER_APACHE_HOST = readEnvString('APACHE_BROKER_HOST', 'localhost');
const BROKER_APACHE_PORT = readEnvNumber('APACHE_BROKER_PORT', 61613);
const BROKER_APACHE_USERNAME = readEnvString('APACHE_BROKER_USER', '');
const BROKER_APACHE_PASSWORD = readEnvSecret('APACHE_BROKER_PASSWORD', '');
const BROKER_APACHE_TOPIC_PREFIX = readEnvString('APACHE_BROKER_TOPIC_PREFIX', '/topic/pulse');
const DEFAULT_OPERATIONAL_DATA_ROOT = process.platform === 'win32'
  ? 'c:/dev/pulse-operational-data'
  : '/opt/pulse/operational-data';
const DEFAULT_QUEUE_DATA_ROOT = path.resolve(readEnvString('PULSE_OPERATIONAL_DATA_ROOT', DEFAULT_OPERATIONAL_DATA_ROOT));
const UI_CARD_OVERRIDES_FILE = path.resolve(DEFAULT_QUEUE_DATA_ROOT, 'ui-card-overrides.json');
const rawQueuePersistenceFlag = String(process.env.PULSE_QUEUE_PERSISTENCE || '').trim().toLowerCase();
const PULSE_QUEUE_PERSISTENCE = true;
const PULSE_QUEUE_DATA_ROOT = PULSE_QUEUE_PERSISTENCE
  ? path.resolve(readEnvString('PULSE_QUEUE_DATA_ROOT', DEFAULT_QUEUE_DATA_ROOT))
  : null;
const RUNTIME_DATA_ROOT = path.resolve(readEnvString('PULSE_RUNTIME_DATA_ROOT', PULSE_QUEUE_DATA_ROOT || DEFAULT_QUEUE_DATA_ROOT));
const EVOLUTION_DATA_ROOT = path.resolve(
  readEnvString('PULSE_EVOLUTION_DATA_ROOT', path.join(RUNTIME_DATA_ROOT, 'evolution'))
);

function assertNotLittleFsStagingRoot(label, targetPath) {
  const resolved = path.resolve(String(targetPath || ''));
  const littleFsRoot = path.resolve(WORKSPACE_ROOT, 'data');
  if (resolved === littleFsRoot || resolved.startsWith(`${littleFsRoot}${path.sep}`)) {
    throw new Error(`${label} points to ${resolved}. Runtime writes to workspace data are disabled; use federated storage via PULSE_OPERATIONAL_DATA_ROOT/PULSE_QUEUE_DATA_ROOT/PULSE_RUNTIME_DATA_ROOT.`);
  }
}

if (PULSE_QUEUE_DATA_ROOT) assertNotLittleFsStagingRoot('PULSE_QUEUE_DATA_ROOT', PULSE_QUEUE_DATA_ROOT);
assertNotLittleFsStagingRoot('PULSE_RUNTIME_DATA_ROOT', RUNTIME_DATA_ROOT);
assertNotLittleFsStagingRoot('PULSE_EVOLUTION_DATA_ROOT', EVOLUTION_DATA_ROOT);
const temporalQueryService = createTemporalQueryService({
  nowProvider: () => authoritativeTimeService.nowMs(),
  preferencesPath: path.join(DEFAULT_QUEUE_DATA_ROOT, 'user-timezone-preferences.json'),
  defaultTimeZone: readEnvString('DEFAULT_USER_TIMEZONE', 'America/New_York').trim() || 'America/New_York'
});
const WORKER_CONFIG_PATH = path.join(RUNTIME_DATA_ROOT, 'worker-config.json');
const ROUTER_RULES_PATH = path.join(RUNTIME_DATA_ROOT, 'router-rules.json');
const DATA_MAPPINGS_PATH = path.join(RUNTIME_DATA_ROOT, 'data-mappings.json');
const TX_STATE_LOG_SHIPPING_PATH = path.resolve(PULSE_QUEUE_DATA_ROOT, 'transaction-state-log-shipping.jsonl');
const TX_TRACE_JOURNAL_PATH = path.resolve(PULSE_QUEUE_DATA_ROOT, 'transaction-trace-journal.jsonl');
const TX_SCHEDULED_DISPATCH_QUEUE_PATH = path.resolve(PULSE_QUEUE_DATA_ROOT, 'transaction-dispatch-schedule.json');
const TX_STATE_LOG_SHIPPING_BATCH_SIZE = Math.max(1, readEnvNumber('TX_STATE_LOG_SHIPPING_BATCH_SIZE', 200));
const TX_STATE_LOG_SHIPPING_INTERVAL_MS = Math.max(0, readEnvNumber('TX_STATE_LOG_SHIPPING_INTERVAL_MS', 15000));
const TX_SCHEDULED_DISPATCH_POLL_MS = Math.max(100, readEnvNumber('TX_SCHEDULED_DISPATCH_POLL_MS', 1000));
const TX_SCHEDULED_DISPATCH_MAX_PER_TICK = Math.max(1, readEnvNumber('TX_SCHEDULED_DISPATCH_MAX_PER_TICK', 50));
const LIFECYCLE_TRANSITION_TIMEOUT_MS = Math.max(0, readEnvNumber('LIFECYCLE_TRANSITION_TIMEOUT_MS', 15000));
const LIFECYCLE_ON_ERROR_QUEUE = readEnvString('LIFECYCLE_ON_ERROR_QUEUE', 'tx.lifecycle.onerror').trim() || 'tx.lifecycle.onerror';
const LIFECYCLE_ON_TIMEOUT_QUEUE = readEnvString('LIFECYCLE_ON_TIMEOUT_QUEUE', 'tx.lifecycle.ontimeout').trim() || 'tx.lifecycle.ontimeout';
const TX_LIFECYCLE_SOURCE_REPO_REL = readEnvString('TX_LIFECYCLE_SOURCE_REPO_REL', './data/transaction-lifecycle.tsl').trim() || './data/transaction-lifecycle.tsl';
const LIFECYCLE_FORCE_MAP_DELAY_MS = Math.max(0, readEnvNumber('LIFECYCLE_FORCE_MAP_DELAY_MS', 0));
const LIFECYCLE_FORCE_MAP_FAILURE = readEnvBoolean('LIFECYCLE_FORCE_MAP_FAILURE', ['1', 'true', 'yes'], false);
const rawRequireRealtimeDb = String(process.env.TX_STATE_REQUIRE_REALTIME_DB || 'true').trim().toLowerCase();
const TX_STATE_REQUIRE_REALTIME_DB = !(rawRequireRealtimeDb === '0' || rawRequireRealtimeDb === 'false' || rawRequireRealtimeDb === 'no');
const rawEmergencyLogShipping = String(process.env.TX_STATE_EMERGENCY_LOG_SHIPPING || 'false').trim().toLowerCase();
const TX_STATE_EMERGENCY_LOG_SHIPPING = (rawEmergencyLogShipping === '1' || rawEmergencyLogShipping === 'true' || rawEmergencyLogShipping === 'yes');
if (rawQueuePersistenceFlag === '0' || rawQueuePersistenceFlag === 'false' || rawQueuePersistenceFlag === 'no') {
  throw new Error('[CONFIG] PULSE_QUEUE_PERSISTENCE=false is not allowed: queue persistence is mandatory.');
}

function seedRuntimeFileIfMissing(targetPath, repoRelativeSource) {
  try {
    if (fs.existsSync(targetPath)) return;
    const sourcePath = fileURLToPath(new URL(repoRelativeSource, import.meta.url));
    if (!fs.existsSync(sourcePath)) return;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  } catch (e) {
    console.warn(`[CONFIG] Failed to seed runtime file ${targetPath}: ${e.message}`);
  }
}

function ensureLifecycleCompiledArtifact() {
  const compiledPath = path.join(RUNTIME_DATA_ROOT, 'transaction-lifecycle-compiled.json');
  if (fs.existsSync(compiledPath)) return;

  const runtimeDslPath = path.join(RUNTIME_DATA_ROOT, 'transaction-lifecycle.tsl');
  seedRuntimeFileIfMissing(runtimeDslPath, TX_LIFECYCLE_SOURCE_REPO_REL);
  if (!fs.existsSync(runtimeDslPath)) return;

  try {
    const compileScript = fileURLToPath(new URL('./scripts/compile-transaction-lifecycle-dsl.mjs', import.meta.url));
    execFileSync(process.execPath, [compileScript, '--in', runtimeDslPath], {
      stdio: 'pipe',
      cwd: fileURLToPath(new URL('.', import.meta.url))
    });
  } catch (e) {
    const detail = e?.stderr ? String(e.stderr) : e.message;
    console.warn(`[CONFIG] Failed to generate lifecycle compiled artifact: ${detail}`);
  }
}

fs.mkdirSync(RUNTIME_DATA_ROOT, { recursive: true });
seedRuntimeFileIfMissing(WORKER_CONFIG_PATH, './data/worker-config.json');
seedRuntimeFileIfMissing(ROUTER_RULES_PATH, './data/router-rules.json');
seedRuntimeFileIfMissing(DATA_MAPPINGS_PATH, './data/data-mappings.json');
seedRuntimeFileIfMissing(path.join(RUNTIME_DATA_ROOT, 'user-management.json'), './data/user-management.json');
seedRuntimeFileIfMissing(path.join(RUNTIME_DATA_ROOT, 'user-groups.json'), './data/user-groups.json');
seedRuntimeFileIfMissing(path.join(RUNTIME_DATA_ROOT, 'monitor-classes.json'), './data/monitor-classes.json');
seedRuntimeFileIfMissing(path.join(RUNTIME_DATA_ROOT, 'process-governance.json'), './data/process-governance.json');
seedRuntimeFileIfMissing(path.join(RUNTIME_DATA_ROOT, 'fsm-catalog.json'), './data/fsm-catalog.json');
seedRuntimeFileIfMissing(path.join(RUNTIME_DATA_ROOT, 'compliance', 'sanctions-cache.json'), './data/compliance/sanctions-cache.json');
ensureLifecycleCompiledArtifact();

function normalizeCardOverrides(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const hiddenMap = source.hiddenMap && typeof source.hiddenMap === 'object' ? source.hiddenMap : {};
  const renameMap = source.renameMap && typeof source.renameMap === 'object' ? source.renameMap : {};
  const runtimeMap = source.runtimeMap && typeof source.runtimeMap === 'object' ? source.runtimeMap : {};
  return {
    hiddenMap: Object.fromEntries(Object.entries(hiddenMap).map(([k, v]) => [String(k), Boolean(v)])),
    renameMap: Object.fromEntries(Object.entries(renameMap).map(([k, v]) => [String(k), String(v || '')])),
    runtimeMap: Object.fromEntries(Object.entries(runtimeMap).map(([k, v]) => [String(k), String(v || '')]))
  };
}

function loadCardOverridesFromDisk() {
  try {
    if (!fs.existsSync(UI_CARD_OVERRIDES_FILE)) {
      return { hiddenMap: {}, renameMap: {}, runtimeMap: {} };
    }
    const raw = fs.readFileSync(UI_CARD_OVERRIDES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeCardOverrides(parsed);
  } catch (e) {
    console.warn('[UI-OVERRIDES] Failed to load card overrides:', e.message);
    return { hiddenMap: {}, renameMap: {}, runtimeMap: {} };
  }
}

function saveCardOverridesToDisk(payload) {
  const normalized = normalizeCardOverrides(payload);
  try {
    fs.mkdirSync(path.dirname(UI_CARD_OVERRIDES_FILE), { recursive: true });
    fs.writeFileSync(UI_CARD_OVERRIDES_FILE, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  } catch (e) {
    throw new Error(`Unable to persist card overrides: ${e.message}`);
  }
}

let uiCardOverrides = loadCardOverridesFromDisk();

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(auditApiRequest);
app.use(applyRequestSecurityHeaders);
app.use(enforceHttpsTransport);
app.use(enforceApiPermission);
app.use(enforceTwoPersonRule);

await registerDevelopDocumentRoutes(app);
await registerProjectWorkspaceRoutes(app);
await registerTransformerServiceRoutes(app);
registerStartupFsmRoutes(app);

debugLog('[DEBUG] Creating global state...');
const queueManagerInstances = new Map(); // Maps managerId to QueueManager instance
let queueManagers = [
  (() => { 
    debugLog('[DEBUG] Creating primary QueueManager');
    const qm = createQueueManager('qm-primary', PULSE_QUEUE_DATA_ROOT);
    queueManagerInstances.set('qm-primary', qm);
    return qm;
  })(),
  (() => { 
    debugLog('[DEBUG] Creating secondary QueueManager'); 
    const qm = createQueueManager('qm-secondary', PULSE_QUEUE_DATA_ROOT);
    queueManagerInstances.set('qm-secondary', qm);
    return qm;
  })()
];
let brokerRuntimeConfig = {
  provider: BROKER_PROVIDER,
  url: BROKER_RABBITMQ_URL,
  exchangeName: BROKER_RABBITMQ_EXCHANGE,
  queuePrefix: BROKER_RABBITMQ_QUEUE_PREFIX,
  msmqBaseQueuePath: BROKER_MSMQ_BASE_QUEUE_PATH,
  msmqQueuePrefix: BROKER_MSMQ_QUEUE_PREFIX,
  kafkaBrokers: BROKER_KAFKA_BROKERS,
  kafkaClientId: BROKER_KAFKA_CLIENT_ID,
  kafkaTopicPrefix: BROKER_KAFKA_TOPIC_PREFIX,
  ibmQueueManager: BROKER_IBM_QUEUE_MANAGER,
  ibmChannel: BROKER_IBM_CHANNEL,
  ibmConnName: BROKER_IBM_CONN_NAME,
  ibmQueuePrefix: BROKER_IBM_QUEUE_PREFIX,
  ibmUsername: BROKER_IBM_USERNAME,
  ibmPassword: BROKER_IBM_PASSWORD,
  apacheHost: BROKER_APACHE_HOST,
  apachePort: BROKER_APACHE_PORT,
  apacheUsername: BROKER_APACHE_USERNAME,
  apachePassword: BROKER_APACHE_PASSWORD,
  apacheTopicPrefix: BROKER_APACHE_TOPIC_PREFIX
};

function createConfiguredBroker() {
  return createMessageBroker(undefined, {
    provider: brokerRuntimeConfig.provider,
    url: brokerRuntimeConfig.url,
    exchangeName: brokerRuntimeConfig.exchangeName,
    queuePrefix: brokerRuntimeConfig.queuePrefix,
    baseQueuePath: brokerRuntimeConfig.msmqBaseQueuePath,
    msmqQueuePrefix: brokerRuntimeConfig.msmqQueuePrefix,
    kafkaBrokers: brokerRuntimeConfig.kafkaBrokers,
    kafkaClientId: brokerRuntimeConfig.kafkaClientId,
    kafkaTopicPrefix: brokerRuntimeConfig.kafkaTopicPrefix,
    ibmQueueManager: brokerRuntimeConfig.ibmQueueManager,
    ibmChannel: brokerRuntimeConfig.ibmChannel,
    ibmConnName: brokerRuntimeConfig.ibmConnName,
    ibmQueuePrefix: brokerRuntimeConfig.ibmQueuePrefix,
    ibmUsername: brokerRuntimeConfig.ibmUsername,
    ibmPassword: brokerRuntimeConfig.ibmPassword,
    apacheHost: brokerRuntimeConfig.apacheHost,
    apachePort: brokerRuntimeConfig.apachePort,
    apacheUsername: brokerRuntimeConfig.apacheUsername,
    apachePassword: brokerRuntimeConfig.apachePassword,
    apacheTopicPrefix: brokerRuntimeConfig.apacheTopicPrefix
  });
}

function copyBrokerSubscriptions(sourceBroker, targetBroker) {
  if (!sourceBroker || !targetBroker) return;
  const subscriptions = sourceBroker.getSubscriptions ? sourceBroker.getSubscriptions() : {};
  for (const [topic, subscribers] of Object.entries(subscriptions || {})) {
    for (const subscriber of Array.isArray(subscribers) ? subscribers : []) {
      if (!subscriber || !subscriber.serviceName) continue;
      targetBroker.addSubscription(topic, subscriber.serviceName);
    }
  }
}

function rebuildBrokerInstances(nextConfig = {}) {
  const previousPrimary = primaryBroker;
  const previousSecondary = secondaryBroker;

  brokerRuntimeConfig = {
    ...brokerRuntimeConfig,
    ...nextConfig,
    provider: String(nextConfig.provider || brokerRuntimeConfig.provider || 'legacy').trim().toLowerCase(),
    url: String(nextConfig.url || brokerRuntimeConfig.url || BROKER_RABBITMQ_URL).trim() || BROKER_RABBITMQ_URL,
    exchangeName: String(nextConfig.exchangeName || brokerRuntimeConfig.exchangeName || BROKER_RABBITMQ_EXCHANGE).trim() || BROKER_RABBITMQ_EXCHANGE,
    queuePrefix: String(nextConfig.queuePrefix || brokerRuntimeConfig.queuePrefix || BROKER_RABBITMQ_QUEUE_PREFIX).trim() || BROKER_RABBITMQ_QUEUE_PREFIX,
    msmqBaseQueuePath: String(nextConfig.msmqBaseQueuePath || brokerRuntimeConfig.msmqBaseQueuePath || BROKER_MSMQ_BASE_QUEUE_PATH).trim() || BROKER_MSMQ_BASE_QUEUE_PATH,
    msmqQueuePrefix: String(nextConfig.msmqQueuePrefix || brokerRuntimeConfig.msmqQueuePrefix || BROKER_MSMQ_QUEUE_PREFIX).trim() || BROKER_MSMQ_QUEUE_PREFIX,
    kafkaBrokers: String(nextConfig.kafkaBrokers || brokerRuntimeConfig.kafkaBrokers || BROKER_KAFKA_BROKERS).trim() || BROKER_KAFKA_BROKERS,
    kafkaClientId: String(nextConfig.kafkaClientId || brokerRuntimeConfig.kafkaClientId || BROKER_KAFKA_CLIENT_ID).trim() || BROKER_KAFKA_CLIENT_ID,
    kafkaTopicPrefix: String(nextConfig.kafkaTopicPrefix || brokerRuntimeConfig.kafkaTopicPrefix || BROKER_KAFKA_TOPIC_PREFIX).trim() || BROKER_KAFKA_TOPIC_PREFIX,
    ibmQueueManager: String(nextConfig.ibmQueueManager || brokerRuntimeConfig.ibmQueueManager || BROKER_IBM_QUEUE_MANAGER).trim() || BROKER_IBM_QUEUE_MANAGER,
    ibmChannel: String(nextConfig.ibmChannel || brokerRuntimeConfig.ibmChannel || BROKER_IBM_CHANNEL).trim() || BROKER_IBM_CHANNEL,
    ibmConnName: String(nextConfig.ibmConnName || brokerRuntimeConfig.ibmConnName || BROKER_IBM_CONN_NAME).trim() || BROKER_IBM_CONN_NAME,
    ibmQueuePrefix: String(nextConfig.ibmQueuePrefix || brokerRuntimeConfig.ibmQueuePrefix || BROKER_IBM_QUEUE_PREFIX).trim() || BROKER_IBM_QUEUE_PREFIX,
    ibmUsername: String(nextConfig.ibmUsername || brokerRuntimeConfig.ibmUsername || BROKER_IBM_USERNAME).trim(),
    ibmPassword: String(nextConfig.ibmPassword || brokerRuntimeConfig.ibmPassword || BROKER_IBM_PASSWORD),
    apacheHost: String(nextConfig.apacheHost || brokerRuntimeConfig.apacheHost || BROKER_APACHE_HOST).trim() || BROKER_APACHE_HOST,
    apachePort: Number(nextConfig.apachePort || brokerRuntimeConfig.apachePort || BROKER_APACHE_PORT) || BROKER_APACHE_PORT,
    apacheUsername: String(nextConfig.apacheUsername || brokerRuntimeConfig.apacheUsername || BROKER_APACHE_USERNAME).trim(),
    apachePassword: String(nextConfig.apachePassword || brokerRuntimeConfig.apachePassword || BROKER_APACHE_PASSWORD),
    apacheTopicPrefix: String(nextConfig.apacheTopicPrefix || brokerRuntimeConfig.apacheTopicPrefix || BROKER_APACHE_TOPIC_PREFIX).trim() || BROKER_APACHE_TOPIC_PREFIX
  };

  primaryBroker = createConfiguredBroker();
  copyBrokerSubscriptions(previousPrimary, primaryBroker);

  if (previousSecondary) {
    secondaryBroker = createConfiguredBroker();
    copyBrokerSubscriptions(previousSecondary, secondaryBroker);
  }

  return {
    ...brokerRuntimeConfig,
    secondaryRunning: !!previousSecondary
  };
}

let primaryBroker = createConfiguredBroker();
registerBrokerAdminRoutes(app, {
  MODULAR_MODE,
  proxyRequest,
  requirePermission,
  BROKER_SUPPORTED_PROVIDERS,
  normalizeBrokerProvider,
  brokerRuntimeConfig,
  getPrimaryBroker: () => primaryBroker,
  hasSecondaryBroker: () => Boolean(secondaryBroker),
  rebuildBrokerInstances
});
let secondaryBroker = null;
globalThis.brokerClassDown = false;
const brokerInstances = new Map();
brokerInstances.set('primary', { instanceId: 'primary', active: true, quiesced: false });
brokerInstances.set('secondary', { instanceId: 'secondary', active: false, quiesced: false });
const discoveredNodes = new Map();
const nodeEnrichmentLastAttempt = new Map();
const queueManagerRegistry = new Map();
const queueRoutes = new Map();
const MANAGER_ACTIVE_STATES = new Set(['up', 'degraded']);
const MANAGER_SYNC_STATES = new Set(['syncing', 'sync-failed']);
const serviceInstanceRegistry = new Map();
const ffsDeploymentRegistry = new Map();
const localQueueManagerProcesses = new Map();
const pendingManagerSync = new Map();
const remoteAgentRegistry = new Map();
const remoteQueueManagerProcesses = new Map();
const queueManagerScriptPath = fileURLToPath(new URL('./queue-manager-node.mjs', import.meta.url));
const QUEUE_VALIDATION_LOG_PATH = path.join(RUNTIME_DATA_ROOT, 'queue-validation-errors.jsonl');
const DLQ_EVENT_LOG_PATH = path.join(RUNTIME_DATA_ROOT, 'dlq-events.jsonl');
const TX_LIFECYCLE_COMPILED_PATH = path.join(RUNTIME_DATA_ROOT, 'transaction-lifecycle-compiled.json');
let _txLifecycleCompiledCache = null;
let _txLifecycleCompiledMtimeMs = 0;
const SANCTIONS_CACHE_PATH = path.join(RUNTIME_DATA_ROOT, 'compliance', 'sanctions-cache.json');
const USER_MANAGEMENT_PATH = path.join(RUNTIME_DATA_ROOT, 'user-management.json');
const USER_GROUPS_PATH = path.join(RUNTIME_DATA_ROOT, 'user-groups.json');
const MONITOR_CLASSES_PATH = path.join(RUNTIME_DATA_ROOT, 'monitor-classes.json');
const PROCESS_GOVERNANCE_PATH = path.join(RUNTIME_DATA_ROOT, 'process-governance.json');
const AUDIT_LOG_PATH = path.join(RUNTIME_DATA_ROOT, 'audit-api.jsonl');
const SQL_INSTANCE_MODE = readEnvString('SQL_INSTANCE_MODE', 'sqlexpress').trim().toLowerCase();
const DEFAULT_GROUP_PROVIDER = SQL_INSTANCE_MODE === 'sqlexpress' || SQL_INSTANCE_MODE === 'default' ? 'mssql' : 'file';
const GROUP_PROVIDER = readEnvString('GROUP_PROVIDER', DEFAULT_GROUP_PROVIDER).trim().toLowerCase();
const MONITOR_CLASS_PROVIDER = readEnvString('MONITOR_CLASS_PROVIDER', 'file').trim().toLowerCase();
const SQL_SERVER_HOST = (() => {
  const configuredHost = readEnvString('SQL_SERVER_HOST', '').trim();
  if (configuredHost) return configuredHost;
  return SQL_INSTANCE_MODE === 'sqlexpress' ? '.' : 'localhost';
})();
const SQL_DATABASE = readEnvString('SQL_DATABASE', 'pulse_fsm').trim() || 'pulse_fsm';
const SQL_CONNECTION_TIMEOUT_SECONDS = readEnvNumber('SQL_CONNECTION_TIMEOUT_SECONDS', 30);

function getSqlInstanceNameFromMode(mode) {
  if (mode === 'sqlexpress') return 'SQLEXPRESS';
  if (mode === 'default') return '';
  return '';
}

const SQL_INSTANCE_NAME = getSqlInstanceNameFromMode(SQL_INSTANCE_MODE);

function buildDerivedSqlConnectionString() {
  const serverTarget = SQL_INSTANCE_NAME ? `${SQL_SERVER_HOST}\\${SQL_INSTANCE_NAME}` : SQL_SERVER_HOST;
  const timeout = Math.max(1, Number(SQL_CONNECTION_TIMEOUT_SECONDS) || 30);
  return `Server=${serverTarget};Database=${SQL_DATABASE};Trusted_Connection=true;TrustServerCertificate=true;Encrypt=false;Connection Timeout=${timeout};`;
}

function buildSqlConnectionStringWithHost(host) {
  const safeHost = String(host || '').trim() || (SQL_INSTANCE_MODE === 'sqlexpress' ? '.' : 'localhost');
  const serverTarget = SQL_INSTANCE_NAME ? `${safeHost}\\${SQL_INSTANCE_NAME}` : safeHost;
  const timeout = Math.max(1, Number(SQL_CONNECTION_TIMEOUT_SECONDS) || 30);
  return `Server=${serverTarget};Database=${SQL_DATABASE};Trusted_Connection=true;TrustServerCertificate=true;Encrypt=false;Connection Timeout=${timeout};`;
}

function toOdbcTrustedConnectionString(connectionString) {
  let cs = String(connectionString || '').trim();
  if (!cs) return cs;
  cs = cs.replace(/TrustServerCertificate\s*=\s*[^;]+;?/ig, '');
  cs = cs.replace(/Encrypt\s*=\s*[^;]+;?/ig, '');
  if (!/Driver\s*=\s*\{/i.test(cs)) {
    cs = `Driver={ODBC Driver 17 for SQL Server};${cs}`;
  }
  cs = cs.replace(/Trusted_Connection\s*=\s*true/ig, 'Trusted_Connection=Yes');
  return cs;
}

const DERIVED_MSSQL_CONNECTION_STRING = buildDerivedSqlConnectionString();
const GROUP_MSSQL_CONNECTION_STRING = readEnvSecret('GROUP_MSSQL_CONNECTION_STRING', DERIVED_MSSQL_CONNECTION_STRING);
const GROUP_MSSQL_TABLE = readEnvString('GROUP_MSSQL_TABLE', 'UserGroups').trim() || 'UserGroups';
const FSM_MSSQL_CONNECTION_STRING = readEnvSecret('FSM_MSSQL_CONNECTION_STRING', GROUP_MSSQL_CONNECTION_STRING);
const FSM_MSSQL_CURRENT_TABLE = readEnvString('FSM_MSSQL_CURRENT_TABLE', 'FsmEntityStateCurrent').trim() || 'FsmEntityStateCurrent';
const FSM_MSSQL_HISTORY_TABLE = readEnvString('FSM_MSSQL_HISTORY_TABLE', 'FsmEntityStateHistory').trim() || 'FsmEntityStateHistory';
const ENABLE_LIFECYCLE_PATH_TESTERS = readEnvBoolean('ENABLE_LIFECYCLE_PATH_TESTERS', ['1', 'true', 'yes'], true);
const USER_DIRECTORY_LOOKUP_URL = readEnvString('USER_DIRECTORY_LOOKUP_URL', '').trim();
const USER_DIRECTORY_LOOKUP_TIMEOUT_MS = readEnvNumber('USER_DIRECTORY_LOOKUP_TIMEOUT_MS', 2500);
const USER_ORGANIZATION_NAME = readEnvString('USER_ORGANIZATION_NAME', 'Pulse').trim() || 'Pulse';
const TRUST_HEADER_GROUPS = readEnvBoolean('TRUST_HEADER_GROUPS', ['1', 'true', 'yes'], false);
const GROUP_CACHE_REFRESH_MS = readEnvNumber('GROUP_CACHE_REFRESH_MS', 60 * 1000);
const NODE_ENV = readEnvString('NODE_ENV', '').trim().toLowerCase();
const IS_PRODUCTION_ENV = NODE_ENV === 'production';
const ALLOW_TEMP_QUEUES_IN_PRODUCTION = readEnvBoolean('ALLOW_TEMP_QUEUES_IN_PRODUCTION', ['1', 'true', 'yes'], false);
const REQUIRE_HTTPS = readEnvBoolean('REQUIRE_HTTPS', ['true'], false);
const APPROVAL_TTL_MS = readEnvNumber('APPROVAL_TTL_MS', 15 * 60 * 1000);
const AUTO_APPROVE_USER_IDS = new Set(
  readEnvString('AUTO_APPROVE_USER_IDS', 'SystemAdmin')
    .split(',')
    .map(value => normalizeUserIdentifier(value))
    .filter(Boolean)
);
const ALLOW_IMPLICIT_ADMIN = readEnvBoolean('ALLOW_IMPLICIT_ADMIN', ['true'], false);
const AUTH_SESSION_TTL_MS = Math.max(5 * 60 * 1000, readEnvNumber('AUTH_SESSION_TTL_MS', 12 * 60 * 60 * 1000));
const AUTH_BOOTSTRAP_VERSION = Math.max(1, readEnvNumber('AUTH_BOOTSTRAP_VERSION', 3));
const AUTH_SYSTEM_ADMIN_USER_ID = normalizeUserIdentifier(readEnvString('AUTH_SYSTEM_ADMIN_USER_ID', 'SystemAdmin').trim() || 'SystemAdmin');
const AUTH_SYSTEM_ADMIN_PASSWORD = String(readEnvSecret('AUTH_SYSTEM_ADMIN_PASSWORD', '@Pulse123') || '@Pulse123');
const AUTH_USER_ADMIN_LHS_USER_ID = normalizeUserIdentifier(readEnvString('AUTH_USER_ADMIN_LHS_USER_ID', 'UserAdminLHS').trim() || 'UserAdminLHS');
const AUTH_USER_ADMIN_LHS_PASSWORD = String(readEnvSecret('AUTH_USER_ADMIN_LHS_PASSWORD', '@Pulse123') || '@Pulse123');
const AUTH_USER_ADMIN_RHS_USER_ID = normalizeUserIdentifier(readEnvString('AUTH_USER_ADMIN_RHS_USER_ID', 'UserAdminRHS').trim() || 'UserAdminRHS');
const AUTH_USER_ADMIN_RHS_PASSWORD = String(readEnvSecret('AUTH_USER_ADMIN_RHS_PASSWORD', '@Pulse123') || '@Pulse123');
const ROLE_PULSE_SYSTEM_ADMIN = 'ROLE-PULSE-SYSTEM-ADMIN';
const ROLE_PULSE_USER_ADMIN = 'ROLE-PULSE-USER-ADMIN';
const SYSTEM_ADMIN_PERMISSIONS = Object.freeze([
  'topology.read',
  'registry.read',
  'registry.manage',
  'broker.read',
  'broker.operate',
  'broker.configure',
  'router.read',
  'router.manage',
  'queue.view',
  'queue.operate',
  'queue.configure',
  'gateway.manage',
  'gateway.read',
  'lifecycle.read',
  'lifecycle.manage',
  'lifecycle.workers.manage',
  'lifecycle.workers.read',
  'lifecycle.policy.read',
  'lifecycle.policy.manage',
  'data.read',
  'data.manage',
  'governance.read',
  'governance.manage',
  'workers.configure',
  'develop.read',
  'develop.execute'
]);
const USER_ADMIN_PERMISSIONS = Object.freeze([
  'users.read',
  'users.manage',
  'users.provision',
  'users.verify'
]);
const queueValidationErrors = [];
const MAX_QUEUE_VALIDATION_ERRORS = 500;
const dlqEvents = [];
const MAX_DLQ_EVENTS = 2000;
const MACHINE_BEACON_UNACKED_INTERVAL_MS = 30000;
const MACHINE_BEACON_ACKED_INTERVAL_MS = 5 * 60 * 1000;
const MACHINE_DRAIN_DEFAULT_TIMEOUT_MS = 60 * 1000;
const SUPERVISOR_HEARTBEAT_TTL_MS = Math.max(1000, readEnvNumber('SUPERVISOR_HEARTBEAT_TTL_MS', 15000));
const machineAvailability = {
  nodeId: os.hostname() || 'unknown-node',
  available: false,
  draining: false,
  advertisedAt: null,
  announceReason: null,
  announceTimerId: null,
  beaconAcknowledged: false,
  beaconAckAt: null,
  capabilityHash: null,
  lastBeaconAt: null,
  udpBroadcastBlocked: false
};
const machineWorkloadState = {
  inFlight: 0,
  updatedAt: null
};
const supervisorHeartbeatRegistry = new Map();

function beginMachineWorkUnit() {
  machineWorkloadState.inFlight += 1;
  machineWorkloadState.updatedAt = new Date().toISOString();
}

function endMachineWorkUnit() {
  machineWorkloadState.inFlight = Math.max(0, Number(machineWorkloadState.inFlight || 0) - 1);
  machineWorkloadState.updatedAt = new Date().toISOString();
}

function canRunQueueWorkers() {
  return machineAvailability.available && !machineAvailability.draining;
}

function getMachineAvailabilityCapabilityHash() {
  return [
    machineAvailability.nodeId,
    machineAvailability.available ? '1' : '0',
    machineAvailability.draining ? '1' : '0',
    machineAvailability.udpBroadcastBlocked ? '1' : '0',
    String(discoveredNodes.size),
    String(queueManagerRegistry.size),
    String(serviceInstanceRegistry.size)
  ].join('|');
}

function getMachineAvailabilityBeaconIntervalMs() {
  return machineAvailability.beaconAcknowledged
    ? MACHINE_BEACON_ACKED_INTERVAL_MS
    : MACHINE_BEACON_UNACKED_INTERVAL_MS;
}

function normalizeSupervisorHeartbeatPayload(payload = {}, fallbackIp = '') {
  const receivedAtMs = Date.now();
  const nodeName = String(payload.nodeName || payload.nodeId || payload.hostname || '').trim();
  const nodeId = String(payload.nodeId || nodeName || payload.ip || fallbackIp || 'unknown-supervisor').trim();
  const ip = String(payload.ip || fallbackIp || '').trim();
  const deviceRole = String(payload.deviceRole || '').trim();
  const supervisor = payload.supervisor && typeof payload.supervisor === 'object'
    ? payload.supervisor
    : {};
  const rawOverallHealthy = Object.prototype.hasOwnProperty.call(payload, 'overallHealthy')
    ? payload.overallHealthy
    : supervisor.overallHealthy;
  const overallHealthy = rawOverallHealthy === true;

  return {
    nodeId,
    nodeName,
    ip,
    deviceRole,
    overallHealthy,
    supervisor,
    receivedAt: new Date(receivedAtMs).toISOString(),
    receivedAtMs
  };
}

function isSupervisorHeartbeatFresh(entry) {
  if (!entry || !Number.isFinite(entry.receivedAtMs)) return false;
  return (Date.now() - Number(entry.receivedAtMs)) <= SUPERVISOR_HEARTBEAT_TTL_MS;
}

function getSupervisorHeartbeatSnapshot() {
  const now = Date.now();
  const supervisors = Array.from(supervisorHeartbeatRegistry.values())
    .map((entry) => ({
      ...entry,
      stale: (now - Number(entry.receivedAtMs || 0)) > SUPERVISOR_HEARTBEAT_TTL_MS
    }))
    .sort((a, b) => String(a.nodeId || '').localeCompare(String(b.nodeId || '')));

  const healthyFreshCount = supervisors.filter((entry) => !entry.stale && entry.overallHealthy).length;
  const lastHeartbeatAt = supervisors.reduce((latest, entry) => {
    if (!latest) return entry.receivedAt || null;
    return (String(entry.receivedAt || '') > String(latest)) ? entry.receivedAt : latest;
  }, null);

  return {
    ttlMs: SUPERVISOR_HEARTBEAT_TTL_MS,
    supervisorCount: supervisors.length,
    healthyFreshCount,
    anyHealthyFresh: healthyFreshCount > 0,
    lastHeartbeatAt,
    supervisors
  };
}

function getSupervisorHeartbeatEntry(nodeId) {
  const key = String(nodeId || '').trim();
  if (!key) return null;
  return supervisorHeartbeatRegistry.get(key) || null;
}

const lifecycleHarness = {
  active: null,
  history: []
};
const evolutionTestRuntime = {
  child: null,
  runId: 0,
  status: 'idle',
  startedAt: null,
  stoppedAt: null,
  params: null,
  lastExitCode: null,
  lastSignal: null,
  lastError: null,
  logs: []
};
let txMssql = null;
let txMssqlPoolPromise = null;
let txStateDbWarned = false;
let txStateShippingActive = false;
const txStatePersistenceStats = {
  realtimeWrites: 0,
  queuedForShipping: 0,
  shippedWrites: 0,
  shippingFailures: 0,
  lastRealtimeWriteAt: null,
  lastQueuedAt: null,
  lastShippedAt: null,
  lastShipAttemptAt: null,
  lastShipFailureAt: null,
  lastShipError: null
};
const scheduledDispatchRuntime = {
  timerId: null,
  running: false,
  processed: 0,
  failures: 0,
  lastRunAt: null,
  lastError: null
};
const txAttemptStateByEntity = new Map();

function ensureDataRootExists() {
  fs.mkdirSync(PULSE_QUEUE_DATA_ROOT, { recursive: true });
}

function parseEvolutionInteger(value, fallback, minValue = 1, maxValue = 1000000) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minValue, Math.min(maxValue, parsed));
}

function normalizeEvolutionRootId(organismId) {
  const match = String(organismId || '').match(/^(organism-\d+)/i);
  return match ? String(match[1]).toLowerCase() : String(organismId || '').trim().toLowerCase();
}

function appendEvolutionRuntimeLog(source, text) {
  const line = String(text || '').trim();
  if (!line) return;
  evolutionTestRuntime.logs.push({
    at: new Date().toISOString(),
    source,
    line
  });
  if (evolutionTestRuntime.logs.length > 300) {
    evolutionTestRuntime.logs = evolutionTestRuntime.logs.slice(-300);
  }
}

function resetEvolutionRuntimeState() {
  evolutionTestRuntime.runId = 0;
  evolutionTestRuntime.status = 'idle';
  evolutionTestRuntime.startedAt = null;
  evolutionTestRuntime.stoppedAt = null;
  evolutionTestRuntime.params = null;
  evolutionTestRuntime.lastExitCode = null;
  evolutionTestRuntime.lastSignal = null;
  evolutionTestRuntime.lastError = null;
  evolutionTestRuntime.logs = [];
}

function clearEvolutionRunArtifacts(generationStart, cycles) {
  const start = Number.parseInt(generationStart, 10) || 0;
  const count = Math.max(0, Number.parseInt(cycles, 10) || 0);
  if (count <= 0) return 0;

  let removed = 0;
  for (let generation = start; generation < start + count; generation += 1) {
    const files = [
      path.join(EVOLUTION_DATA_ROOT, `evolution-selector-g${generation}.json`),
      path.join(EVOLUTION_DATA_ROOT, `evolution-fitness-g${generation}.jsonl`),
      path.join(EVOLUTION_DATA_ROOT, `evolution-generation-${generation}.json`)
    ];

    for (const filePath of files) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          removed += 1;
        }
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  return removed;
}

function resolveEvolutionPath(inputPath = '') {
  const requested = String(inputPath || '').trim();
  if (!requested) return '';

  const candidates = [
    path.resolve(process.cwd(), requested),
    path.resolve(WORKSPACE_ROOT, requested),
    path.resolve(EVOLUTION_DATA_ROOT, requested)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function computeEvolutionDriftSnapshot(params = null) {
  const generationStart = parseEvolutionInteger(params?.generation, 0, 0, 5000000);
  const cycles = parseEvolutionInteger(params?.cycles, 0, 0, 5000000);
  let replacementInterval = parseEvolutionInteger(params?.replacementInterval, 100, 1, 1000000);
  let maxPopulation = parseEvolutionInteger(params?.maxPopulation, 200, 1, 2000);
  let birthLimit = parseEvolutionInteger(params?.birthLimit, 25, 1, 1000000);
  let deathLimit = parseEvolutionInteger(params?.deathLimit, 100, 1, 1000000);
  let organismIdleTtlMs = parseEvolutionInteger(params?.organismIdleTtlMs, 60000, 1000, 86400000);
  let replacementCount = 0;
  let birthCount = 0;
  let deathCount = 0;
  let activePopulationSize = 0;
  let lastReplacement = null;
  let lastBirth = null;
  let lastDeath = null;
  if (cycles <= 0) {
    return {
      generationStart,
      cycles,
      availableCycles: 0,
      summary: null,
      series: [],
      ancestorFrequency: {},
      selectorChanges: 0,
      maxPopulation,
      birthLimit,
      deathLimit,
      organismIdleTtlMs,
      replacementInterval,
      replacementCount,
      birthCount,
      deathCount,
      activePopulationSize,
      lastReplacement,
      lastBirth,
      lastDeath,
      latency: null,
      score: null
    };
  }

  const rows = [];
  for (let generation = generationStart; generation < generationStart + cycles; generation += 1) {
    const selectorPath = path.join(EVOLUTION_DATA_ROOT, `evolution-selector-g${generation}.json`);
    if (!fs.existsSync(selectorPath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(selectorPath, 'utf8'));
      if (parsed?.replacementInterval != null && !Number.isFinite(Number(replacementInterval))) {
        replacementInterval = parseEvolutionInteger(parsed.replacementInterval, replacementInterval, 1, 1000000);
      }
      if (Number.isFinite(Number(parsed?.replacementInterval || NaN))) {
        replacementInterval = parseEvolutionInteger(parsed.replacementInterval, replacementInterval, 1, 1000000);
      }
      if (Number.isFinite(Number(parsed?.maxPopulation || NaN))) {
        maxPopulation = parseEvolutionInteger(parsed.maxPopulation, maxPopulation, 1, 2000);
      }
      if (Number.isFinite(Number(parsed?.birthLimit || NaN))) {
        birthLimit = parseEvolutionInteger(parsed.birthLimit, birthLimit, 1, 1000000);
      }
      if (Number.isFinite(Number(parsed?.deathLimit || NaN))) {
        deathLimit = parseEvolutionInteger(parsed.deathLimit, deathLimit, 1, 1000000);
      }
      if (Number.isFinite(Number(parsed?.organismIdleTtlMs || NaN))) {
        organismIdleTtlMs = parseEvolutionInteger(parsed.organismIdleTtlMs, organismIdleTtlMs, 1000, 86400000);
      }
      if (Array.isArray(parsed?.replacements) && parsed.replacements.length > 0) {
        replacementCount += parsed.replacements.length;
        const lastEvent = parsed.replacements[parsed.replacements.length - 1];
        lastReplacement = {
          generation,
          transactionCount: Number(lastEvent?.transactionCount || 0),
          weakestOrganismId: String(lastEvent?.weakestOrganismId || ''),
          strongestOrganismId: String(lastEvent?.strongestOrganismId || ''),
          replacementOrganismId: String(lastEvent?.replacementOrganismId || '')
        };
      }
      if (Array.isArray(parsed?.births) && parsed.births.length > 0) {
        birthCount += parsed.births.length;
        const lastEvent = parsed.births[parsed.births.length - 1];
        lastBirth = {
          generation,
          transactionCount: Number(lastEvent?.transactionCount || 0),
          parentOrganismId: String(lastEvent?.parentOrganismId || ''),
          childOrganismId: String(lastEvent?.childOrganismId || ''),
          childSlot: Number(lastEvent?.childSlot || 0)
        };
      }
      if (Array.isArray(parsed?.deaths) && parsed.deaths.length > 0) {
        deathCount += parsed.deaths.length;
        const lastEvent = parsed.deaths[parsed.deaths.length - 1];
        lastDeath = {
          generation,
          transactionCount: Number(lastEvent?.transactionCount || 0),
          organismId: String(lastEvent?.organismId || ''),
          slotIndex: Number(lastEvent?.slotIndex || 0)
        };
      }
      if (Number.isFinite(Number(parsed?.activePopulationSize || NaN))) {
        activePopulationSize = Number(parsed.activePopulationSize || 0);
      }
      const best = Array.isArray(parsed?.selector) ? parsed.selector[0] : null;
      if (!best) continue;
      rows.push({
        generation,
        organismId: String(best.organismId || ''),
        ancestorId: normalizeEvolutionRootId(best.organismId),
        latencyMs: Number(best.latencyMs || 0),
        score: Number(best.score || 0)
      });
    } catch {
      // Skip malformed snapshot files.
    }
  }

  if (rows.length === 0) {
    return {
      generationStart,
      cycles,
      availableCycles: 0,
      summary: null,
      series: [],
      ancestorFrequency: {},
      selectorChanges: 0,
      maxPopulation,
      birthLimit,
      deathLimit,
      organismIdleTtlMs,
      replacementInterval,
      replacementCount,
      birthCount,
      deathCount,
      activePopulationSize,
      lastReplacement,
      lastBirth,
      lastDeath,
      latency: null,
      score: null
    };
  }

  const ancestorFrequency = {};
  for (const row of rows) {
    ancestorFrequency[row.ancestorId] = (ancestorFrequency[row.ancestorId] || 0) + 1;
  }

  let selectorChanges = 0;
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index].ancestorId !== rows[index - 1].ancestorId) {
      selectorChanges += 1;
    }
  }

  const latencies = rows.map((row) => row.latencyMs);
  const scores = rows.map((row) => row.score);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const stdev = (values) => {
    const avg = mean(values);
    const variance = values.reduce((sum, value) => sum + ((value - avg) * (value - avg)), 0) / values.length;
    return Math.sqrt(variance);
  };

  return {
    generationStart,
    cycles,
    availableCycles: rows.length,
    series: rows,
    summary: {
      bestAncestor: Object.entries(ancestorFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      selectorChanges
    },
    ancestorFrequency,
    selectorChanges,
    maxPopulation,
    birthLimit,
    deathLimit,
    organismIdleTtlMs,
    replacementInterval,
    replacementCount,
    birthCount,
    deathCount,
    activePopulationSize,
    lastReplacement,
    lastBirth,
    lastDeath,
    latency: {
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      mean: Number(mean(latencies).toFixed(3)),
      stdev: Number(stdev(latencies).toFixed(3))
    },
    score: {
      min: Math.min(...scores),
      max: Math.max(...scores),
      mean: Number(mean(scores).toFixed(3)),
      stdev: Number(stdev(scores).toFixed(3))
    }
  };
}

function getTxStateQueuedCount() {
  try {
    if (!fs.existsSync(TX_STATE_LOG_SHIPPING_PATH)) return 0;
    const raw = fs.readFileSync(TX_STATE_LOG_SHIPPING_PATH, 'utf-8');
    if (!raw) return 0;
    return raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean).length;
  } catch {
    return 0;
  }
}

function getTxStatePersistenceSummary() {
  return {
    realtime: {
      writes: txStatePersistenceStats.realtimeWrites,
      lastWriteAt: txStatePersistenceStats.lastRealtimeWriteAt
    },
    logShipping: {
      queued: getTxStateQueuedCount(),
      queuedWrites: txStatePersistenceStats.queuedForShipping,
      shippedWrites: txStatePersistenceStats.shippedWrites,
      failures: txStatePersistenceStats.shippingFailures,
      active: txStateShippingActive,
      batchSize: TX_STATE_LOG_SHIPPING_BATCH_SIZE,
      intervalMs: TX_STATE_LOG_SHIPPING_INTERVAL_MS,
      path: TX_STATE_LOG_SHIPPING_PATH,
      lastQueuedAt: txStatePersistenceStats.lastQueuedAt,
      lastShippedAt: txStatePersistenceStats.lastShippedAt,
      lastShipAttemptAt: txStatePersistenceStats.lastShipAttemptAt,
      lastShipFailureAt: txStatePersistenceStats.lastShipFailureAt,
      lastShipError: txStatePersistenceStats.lastShipError
    }
  };
}

function queueTransactionStateForLogShipping(entry, reason) {
  ensureDataRootExists();
  const record = {
    queuedAt: authoritativeTimeService.nowIso(),
    reason: reason || 'db-unavailable',
    entry
  };
  fs.appendFileSync(TX_STATE_LOG_SHIPPING_PATH, `${JSON.stringify(record)}\n`, 'utf-8');
  txStatePersistenceStats.queuedForShipping += 1;
  txStatePersistenceStats.lastQueuedAt = record.queuedAt;
}

function appendTransactionTraceEvent(event) {
  if (!event || typeof event !== 'object') return;
  ensureDataRootExists();
  fs.appendFileSync(TX_TRACE_JOURNAL_PATH, `${JSON.stringify(event)}\n`, 'utf-8');
}

function appendTransactionJournalComment(entityId, comment, {
  eventKind = 'journal-comment',
  relation = null,
  queueName = null,
  details = null,
  machineId = 'transaction-journal'
} = {}) {
  const key = String(entityId || '').trim();
  const note = String(comment || '').trim();
  if (!key || !note) return;

  appendTransactionTraceEvent({
    occurredAt: authoritativeTimeService.nowIso(),
    entityId: key,
    machineId,
    eventKind,
    payloadType: 'json',
    transition: {
      fromState: null,
      toState: null,
      toStateLabel: null,
      eventName: null,
      queueName: String(queueName || '').trim() || null,
      isTerminal: false
    },
    worker: {
      workerId: null,
      sourceService: 'transaction-journal',
      consumerService: null,
      workerKind: 'journal'
    },
    coordination: {
      queueName: String(queueName || '').trim() || null,
      managerId: null,
      nodeId: null,
      mode: null,
      replicaOf: null,
      syncSourceManagerId: null,
      managerStatus: null
    },
    comment: note,
    relation: relation && typeof relation === 'object' ? relation : null,
    details: details && typeof details === 'object' ? details : null
  });
}

function parseIsoTimestampMs(value) {
  const ms = Date.parse(String(value || '').trim());
  return Number.isFinite(ms) ? ms : NaN;
}

function normalizeScheduledDispatchItem(item) {
  const raw = item && typeof item === 'object' ? item : {};
  const dueAtIso = String(raw.dueAt || '').trim() || new Date().toISOString();
  const dueAtMs = parseIsoTimestampMs(dueAtIso);
  return {
    id: String(raw.id || crypto.randomUUID()).trim(),
    status: String(raw.status || 'pending').trim().toLowerCase(),
    createdAt: String(raw.createdAt || new Date().toISOString()).trim(),
    dueAt: Number.isFinite(dueAtMs) ? new Date(dueAtMs).toISOString() : new Date().toISOString(),
    queueName: String(raw.queueName || '').trim(),
    sourceService: String(raw.sourceService || 'scheduled-dispatch').trim(),
    comment: String(raw.comment || '').trim() || null,
    targetManagerId: String(raw.targetManagerId || '').trim() || null,
    targetNodeId: String(raw.targetNodeId || '').trim() || null,
    parentEntityId: String(raw.parentEntityId || '').trim() || null,
    childEntityId: String(raw.childEntityId || '').trim() || null,
    attempts: Math.max(0, Number(raw.attempts) || 0),
    lastError: raw.lastError ? String(raw.lastError) : null,
    dispatchedAt: raw.dispatchedAt ? String(raw.dispatchedAt) : null,
    deliveredTo: raw.deliveredTo ? String(raw.deliveredTo) : null,
    message: raw.message
  };
}

function readScheduledDispatchQueue() {
  ensureDataRootExists();
  if (!fs.existsSync(TX_SCHEDULED_DISPATCH_QUEUE_PATH)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(TX_SCHEDULED_DISPATCH_QUEUE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed?.items) ? parsed.items : []);
    return items
      .map(normalizeScheduledDispatchItem)
      .filter((item) => item.queueName);
  } catch (e) {
    console.warn(`[SCHEDULED-DISPATCH] Failed to read queue file: ${e.message}`);
    return [];
  }
}

function writeScheduledDispatchQueue(items) {
  ensureDataRootExists();
  const normalized = Array.isArray(items)
    ? items.map(normalizeScheduledDispatchItem)
    : [];
  normalized.sort((a, b) => parseIsoTimestampMs(a.dueAt) - parseIsoTimestampMs(b.dueAt));
  fs.writeFileSync(
    TX_SCHEDULED_DISPATCH_QUEUE_PATH,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), items: normalized }, null, 2)}\n`,
    'utf-8'
  );
}

function getScheduledDispatchQueueSummary() {
  const items = readScheduledDispatchQueue();
  const pending = items.filter((item) => item.status === 'pending').length;
  const dispatched = items.filter((item) => item.status === 'dispatched').length;
  const failed = items.filter((item) => item.lastError && item.status !== 'dispatched').length;
  return {
    path: TX_SCHEDULED_DISPATCH_QUEUE_PATH,
    pollMs: TX_SCHEDULED_DISPATCH_POLL_MS,
    maxPerTick: TX_SCHEDULED_DISPATCH_MAX_PER_TICK,
    pending,
    dispatched,
    failed,
    total: items.length,
    runtime: {
      running: scheduledDispatchRuntime.running,
      processed: scheduledDispatchRuntime.processed,
      failures: scheduledDispatchRuntime.failures,
      lastRunAt: scheduledDispatchRuntime.lastRunAt,
      lastError: scheduledDispatchRuntime.lastError
    }
  };
}

function resolveScheduledDispatchRoute(item) {
  const queueName = String(item?.queueName || '').trim();
  if (!queueName) {
    throw new Error('queueName is required for scheduled dispatch');
  }

  const targetManagerId = String(item?.targetManagerId || '').trim();
  if (targetManagerId) {
    const manager = queueManagerRegistry.get(targetManagerId);
    if (!manager) {
      throw new Error(`Scheduled target manager not found: ${targetManagerId}`);
    }
    if (!MANAGER_ACTIVE_STATES.has(manager.status)) {
      throw new Error(`Scheduled target manager ${targetManagerId} is not active`);
    }
    return { queueName, managerId: targetManagerId, assignedAt: new Date().toISOString() };
  }

  const targetNodeId = String(item?.targetNodeId || '').trim();
  if (targetNodeId) {
    const byNode = Array.from(queueManagerRegistry.values()).find(
      (manager) => String(manager?.nodeId || '').trim() === targetNodeId && MANAGER_ACTIVE_STATES.has(manager.status)
    );
    if (!byNode) {
      throw new Error(`Scheduled target node has no active manager: ${targetNodeId}`);
    }
    return { queueName, managerId: byNode.managerId, assignedAt: new Date().toISOString() };
  }

  const route = ensureRoute(queueName);
  if (!route) {
    throw new Error(`No available queue managers for scheduled queue ${queueName}`);
  }
  return route;
}

function schedulePersistentDispatch({
  queueName,
  message,
  sourceService = 'scheduled-dispatch',
  dueAt = null,
  delayMs = 0,
  comment = null,
  targetManagerId = null,
  targetNodeId = null,
  parentEntityId = null,
  childEntityId = null
} = {}) {
  const queue = String(queueName || '').trim();
  if (!queue) {
    throw new Error('queueName is required');
  }

  const delay = Math.max(0, Number(delayMs) || 0);
  const dueAtIso = dueAt
    ? new Date(parseIsoTimestampMs(dueAt)).toISOString()
    : new Date(Date.now() + delay).toISOString();
  if (!Number.isFinite(parseIsoTimestampMs(dueAtIso))) {
    throw new Error('Invalid dueAt value');
  }

  const item = normalizeScheduledDispatchItem({
    id: crypto.randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    dueAt: dueAtIso,
    queueName: queue,
    sourceService,
    comment,
    targetManagerId,
    targetNodeId,
    parentEntityId,
    childEntityId,
    message,
    attempts: 0,
    lastError: null
  });

  const items = readScheduledDispatchQueue();
  items.push(item);
  writeScheduledDispatchQueue(items);
  return item;
}

async function processScheduledDispatchQueueTick() {
  if (scheduledDispatchRuntime.running) {
    return 0;
  }
  scheduledDispatchRuntime.running = true;
  scheduledDispatchRuntime.lastRunAt = new Date().toISOString();

  try {
    const items = readScheduledDispatchQueue();
    const nowMs = Date.now();
    const dueItems = items
      .filter((item) => item.status === 'pending' && parseIsoTimestampMs(item.dueAt) <= nowMs)
      .sort((a, b) => parseIsoTimestampMs(a.dueAt) - parseIsoTimestampMs(b.dueAt))
      .slice(0, TX_SCHEDULED_DISPATCH_MAX_PER_TICK);

    if (dueItems.length === 0) {
      scheduledDispatchRuntime.lastError = null;
      return 0;
    }

    for (const dueItem of dueItems) {
      const item = items.find((candidate) => candidate.id === dueItem.id);
      if (!item) continue;
      try {
        const route = resolveScheduledDispatchRoute(item);
        const delivery = await enqueueViaRoute(
          route,
          item.queueName,
          item.message,
          item.sourceService || 'scheduled-dispatch',
          null,
          inferQueueDataTypeIds(item.queueName)
        );

        item.status = 'dispatched';
        item.dispatchedAt = new Date().toISOString();
        item.deliveredTo = String(delivery?.deliveredTo || route.managerId || '').trim() || null;
        item.lastError = null;
        item.attempts = Math.max(0, Number(item.attempts) || 0) + 1;

        appendCoordinationTraceFromMessage(item.message, {
          eventKind: 'scheduled-dispatch',
          queueName: item.queueName,
          managerId: item.deliveredTo || route.managerId,
          sourceService: item.sourceService || 'scheduled-dispatch',
          mode: 'scheduled',
          details: {
            dispatchId: item.id,
            comment: item.comment,
            parentEntityId: item.parentEntityId,
            childEntityId: item.childEntityId,
            dueAt: item.dueAt
          }
        });

        if (item.parentEntityId && item.comment) {
          appendTransactionJournalComment(item.parentEntityId, item.comment, {
            eventKind: 'scheduled-dispatch-comment',
            queueName: item.queueName,
            relation: item.childEntityId ? { childEntityId: item.childEntityId } : null,
            details: {
              dispatchId: item.id,
              dueAt: item.dueAt,
              deliveredTo: item.deliveredTo
            }
          });
        }
      } catch (e) {
        item.attempts = Math.max(0, Number(item.attempts) || 0) + 1;
        item.lastError = e.message;
        item.dueAt = new Date(Date.now() + Math.min(30000, Math.max(1000, item.attempts * 1000))).toISOString();
        scheduledDispatchRuntime.failures += 1;
      }
    }

    writeScheduledDispatchQueue(items);
    scheduledDispatchRuntime.processed += dueItems.length;
    scheduledDispatchRuntime.lastError = null;
    return dueItems.length;
  } catch (e) {
    scheduledDispatchRuntime.lastError = e.message;
    throw e;
  } finally {
    scheduledDispatchRuntime.running = false;
  }
}

function startScheduledDispatchWatcher() {
  if (scheduledDispatchRuntime.timerId) {
    return;
  }
  scheduledDispatchRuntime.timerId = setInterval(() => {
    void processScheduledDispatchQueueTick().catch((e) => {
      console.warn(`[SCHEDULED-DISPATCH] Worker tick failed: ${e.message}`);
    });
  }, TX_SCHEDULED_DISPATCH_POLL_MS);
}

function getTransactionTrace(entityId, { limit = 200 } = {}) {
  const key = String(entityId || '').trim();
  if (!key) return [];
  if (!fs.existsSync(TX_TRACE_JOURNAL_PATH)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(TX_TRACE_JOURNAL_PATH, 'utf-8');
    const lines = raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const events = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (String(parsed?.entityId || '').trim() === key) {
          events.push(parsed);
        }
      } catch {
        // Ignore malformed trace records to preserve trace availability.
      }
    }

    return events.slice(-Math.max(1, Math.min(1000, Number(limit) || 200)));
  } catch (e) {
    console.warn(`[TX-TRACE] Failed to read trace journal: ${e.message}`);
    return [];
  }
}

function normalizeSiteToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'primary-site';
}

function resolveSiteIdForNode(nodeId, ip = null) {
  const normalizedNodeId = normalizeNodeId(nodeId);
  const normalizedIp = normalizePresenceIp(ip);

  for (const node of discoveredNodes.values()) {
    const candidateNodeId = normalizeNodeId(node?.nodeId || node?.nodeName);
    const candidateIp = normalizePresenceIp(node?.ip);
    if (
      (normalizedNodeId && candidateNodeId && normalizedNodeId === candidateNodeId)
      || (normalizedIp && candidateIp && normalizedIp === candidateIp)
    ) {
      const fromNested = String(node?.details?.site?.siteId || '').trim();
      const fromFlat = String(node?.details?.siteId || '').trim();
      const fromTopLevel = String(node?.siteId || '').trim();
      return normalizeSiteToken(fromNested || fromFlat || fromTopLevel || 'primary-site');
    }
  }

  return 'primary-site';
}

function deriveTransactionAttemptIdentity({
  entityId,
  queueName = null,
  traceContext = null,
  explicitAttemptId = null,
  explicitSiteId = null,
  explicitDuplicatePossible = null
} = {}) {
  const txEntityId = String(entityId || '').trim();
  if (!txEntityId) return null;

  const resolvedQueueName = String(queueName || traceContext?.queueName || '').trim() || null;
  const route = resolvedQueueName ? queueRoutes.get(resolvedQueueName) : null;
  const managerId = String(traceContext?.managerId || route?.managerId || '').trim() || null;
  const manager = managerId ? queueManagerRegistry.get(managerId) : null;

  const siteFromTrace = String(traceContext?.siteId || '').trim();
  const siteFromExplicit = String(explicitSiteId || '').trim();
  const inferredSiteId = resolveSiteIdForNode(traceContext?.nodeId || manager?.nodeId || null, manager?.ip || null);
  const siteId = normalizeSiteToken(siteFromExplicit || siteFromTrace || inferredSiteId || 'primary-site');

  const previous = txAttemptStateByEntity.get(txEntityId) || null;
  let attemptNumber = Number(previous?.attemptNumber || 1);
  let previousSiteId = previous?.siteId || null;
  let failoverDetected = false;

  if (!previous) {
    attemptNumber = 1;
    previousSiteId = null;
  } else if (previous.siteId && previous.siteId !== siteId) {
    failoverDetected = true;
    previousSiteId = previous.siteId;
    attemptNumber = Number(previous.attemptNumber || 1) + 1;
  }

  const duplicatePossible = explicitDuplicatePossible == null
    ? failoverDetected
    : Boolean(explicitDuplicatePossible) || failoverDetected;

  const computedAttemptId = `${siteId}:${txEntityId}:${attemptNumber}`;
  const attemptId = String(explicitAttemptId || computedAttemptId).trim() || computedAttemptId;

  txAttemptStateByEntity.set(txEntityId, {
    siteId,
    attemptNumber,
    attemptId,
    duplicatePossible,
    failoverDetected,
    previousSiteId,
    managerId,
    updatedAt: authoritativeTimeService.nowIso()
  });

  return {
    siteId,
    previousSiteId,
    attemptNumber,
    attemptId,
    duplicatePossible,
    failoverDetected,
    managerId
  };
}

function buildTxStateDbWriteEntry(compiled, {
  message,
  fromState = null,
  toState,
  eventName = null,
  queueName = null,
  traceContext = null
} = {}) {
  if (!toState) return null;
  const entityId = extractSwiftReferenceFromMessage(message);
  if (!entityId) return null;

  const nowIso = authoritativeTimeService.nowIso();
  const machineId = String(compiled?.transactionId || 'fsm-machine').trim() || 'fsm-machine';
  const toStateInfo = getLifecycleStateByName(compiled, toState);
  const resolvedQueueName = String(queueName || toStateInfo?.queueName || '').trim() || null;
  const toStateLabel = String(toStateInfo?.label || toState || '').trim() || null;
  const isTerminal = getLifecycleOutgoingTransitions(compiled, String(toState || '').trim()).length === 0;
  const messageMeta = message && typeof message === 'object' ? message.transactionMeta : null;
  const txIdentity = deriveTransactionAttemptIdentity({
    entityId,
    queueName: resolvedQueueName,
    traceContext,
    explicitAttemptId: messageMeta?.attemptId || null,
    explicitSiteId: messageMeta?.siteId || null,
    explicitDuplicatePossible: messageMeta?.duplicate_possible
  });

  return {
    entityId,
    machineId,
    fromState: String(fromState || '').trim() || null,
    toState: String(toState || '').trim(),
    toStateLabel,
    queueName: resolvedQueueName,
    eventName: String(eventName || '').trim() || null,
    isTerminal,
    payloadType: inferMessageType(message),
    updatedAt: nowIso,
    txIdentity
  };
}

function buildTransactionTraceEvent(writeEntry, traceContext = {}) {
  if (!writeEntry?.entityId) return null;

  const resolvedQueueName = String(writeEntry.queueName || traceContext.queueName || '').trim() || null;
  const route = resolvedQueueName ? queueRoutes.get(resolvedQueueName) : null;
  const manager = route?.managerId ? queueManagerRegistry.get(route.managerId) : null;

  return {
    occurredAt: String(writeEntry.updatedAt || authoritativeTimeService.nowIso()),
    entityId: writeEntry.entityId,
    machineId: writeEntry.machineId,
    eventKind: String(traceContext.eventKind || 'fsm-transition'),
    payloadType: writeEntry.payloadType,
    transition: {
      fromState: writeEntry.fromState,
      toState: writeEntry.toState,
      toStateLabel: writeEntry.toStateLabel,
      eventName: writeEntry.eventName,
      queueName: writeEntry.queueName,
      isTerminal: Boolean(writeEntry.isTerminal)
    },
    worker: {
      workerId: traceContext.workerId ? String(traceContext.workerId) : null,
      sourceService: traceContext.sourceService ? String(traceContext.sourceService) : null,
      consumerService: traceContext.consumerService ? String(traceContext.consumerService) : null,
      workerKind: traceContext.workerKind ? String(traceContext.workerKind) : null
    },
    coordination: {
      queueName: resolvedQueueName,
      managerId: route?.managerId || traceContext.managerId || null,
      nodeId: manager?.nodeId || traceContext.nodeId || null,
      mode: manager ? (manager.local ? 'local' : 'remote') : (traceContext.mode || null),
      replicaOf: manager?.replicaOf || null,
      syncSourceManagerId: manager?.syncSourceManagerId || null,
      managerStatus: manager?.status || null
    },
    transaction: writeEntry?.txIdentity ? {
      transactionId: writeEntry.entityId,
      attemptId: writeEntry.txIdentity.attemptId,
      attemptNumber: writeEntry.txIdentity.attemptNumber,
      siteId: writeEntry.txIdentity.siteId,
      previousSiteId: writeEntry.txIdentity.previousSiteId,
      failoverDetected: Boolean(writeEntry.txIdentity.failoverDetected),
      duplicate_possible: Boolean(writeEntry.txIdentity.duplicatePossible)
    } : null
  };
}

function appendCoordinationTraceFromMessage(message, {
  eventKind,
  queueName = null,
  managerId = null,
  nodeId = null,
  mode = null,
  sourceService = null,
  consumerService = null,
  workerId = null,
  workerKind = null,
  details = null
} = {}) {
  const entityId = extractSwiftReferenceFromMessage(message);
  if (!entityId) return;

  const resolvedQueueName = String(queueName || '').trim() || null;
  const resolvedManagerId = String(managerId || '').trim() || null;
  const manager = resolvedManagerId ? queueManagerRegistry.get(resolvedManagerId) : null;

  appendTransactionTraceEvent({
    occurredAt: authoritativeTimeService.nowIso(),
    entityId,
    machineId: 'queue-coordination',
    eventKind: String(eventKind || 'coordination'),
    payloadType: inferMessageType(message),
    transition: {
      fromState: null,
      toState: null,
      toStateLabel: null,
      eventName: null,
      queueName: resolvedQueueName,
      isTerminal: false
    },
    worker: {
      workerId: workerId ? String(workerId) : null,
      sourceService: sourceService ? String(sourceService) : null,
      consumerService: consumerService ? String(consumerService) : null,
      workerKind: workerKind ? String(workerKind) : null
    },
    coordination: {
      queueName: resolvedQueueName,
      managerId: resolvedManagerId,
      nodeId: manager?.nodeId || nodeId || null,
      mode: mode || (manager ? (manager.local ? 'local' : 'remote') : null),
      replicaOf: manager?.replicaOf || null,
      syncSourceManagerId: manager?.syncSourceManagerId || null,
      managerStatus: manager?.status || null
    },
    details: details && typeof details === 'object' ? details : null
  });
}

async function writeTransactionStateToDb(entry) {
  const pool = await getTransactionStateMssqlPool();
  const now = new Date(String(entry.updatedAt || new Date().toISOString()));

  await pool.request()
    .input('entity_id', txMssql.NVarChar(128), entry.entityId)
    .input('machine_id', txMssql.NVarChar(128), entry.machineId)
    .input('state_id', txMssql.NVarChar(128), entry.toState)
    .input('state_label', txMssql.NVarChar(256), entry.toStateLabel)
    .input('queue_name', txMssql.NVarChar(256), entry.queueName)
    .input('last_event_id', txMssql.NVarChar(128), entry.eventName)
    .input('is_terminal', txMssql.Bit, entry.isTerminal ? 1 : 0)
    .input('payload_type', txMssql.NVarChar(64), entry.payloadType)
    .input('updated_at', txMssql.DateTime2, now)
    .query(`
MERGE ${FSM_MSSQL_CURRENT_TABLE_SQL} WITH (HOLDLOCK) AS t
USING (SELECT @entity_id AS entity_id) AS s
ON t.entity_id = s.entity_id
WHEN MATCHED THEN
  UPDATE SET
    machine_id = @machine_id,
    state_id = @state_id,
    state_label = @state_label,
    queue_name = @queue_name,
    last_event_id = @last_event_id,
    is_terminal = @is_terminal,
    payload_type = @payload_type,
    updated_at = @updated_at
WHEN NOT MATCHED THEN
  INSERT (entity_id, machine_id, state_id, state_label, queue_name, last_event_id, is_terminal, payload_type, updated_at)
  VALUES (@entity_id, @machine_id, @state_id, @state_label, @queue_name, @last_event_id, @is_terminal, @payload_type, @updated_at);
`);

  await pool.request()
    .input('entity_id', txMssql.NVarChar(128), entry.entityId)
    .input('machine_id', txMssql.NVarChar(128), entry.machineId)
    .input('from_state', txMssql.NVarChar(128), entry.fromState)
    .input('to_state', txMssql.NVarChar(128), entry.toState)
    .input('to_state_label', txMssql.NVarChar(256), entry.toStateLabel)
    .input('queue_name', txMssql.NVarChar(256), entry.queueName)
    .input('event_name', txMssql.NVarChar(128), entry.eventName)
    .input('is_terminal', txMssql.Bit, entry.isTerminal ? 1 : 0)
    .input('updated_at', txMssql.DateTime2, now)
    .query(`
INSERT INTO ${FSM_MSSQL_HISTORY_TABLE_SQL}
  (entity_id, machine_id, from_state, to_state, to_state_label, queue_name, event_name, is_terminal, updated_at)
VALUES
  (@entity_id, @machine_id, @from_state, @to_state, @to_state_label, @queue_name, @event_name, @is_terminal, @updated_at);
`);
}

async function shipQueuedTransactionStateLogs({ maxEntries = TX_STATE_LOG_SHIPPING_BATCH_SIZE } = {}) {
  if (txStateShippingActive) {
    return { shipped: 0, remaining: getTxStateQueuedCount(), skipped: true, reason: 'already-running' };
  }

  txStateShippingActive = true;
  txStatePersistenceStats.lastShipAttemptAt = new Date().toISOString();
  let shipped = 0;

  try {
    if (!fs.existsSync(TX_STATE_LOG_SHIPPING_PATH)) {
      return { shipped: 0, remaining: 0 };
    }

    const raw = fs.readFileSync(TX_STATE_LOG_SHIPPING_PATH, 'utf-8');
    const lines = raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      return { shipped: 0, remaining: 0 };
    }

    const parsed = [];
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line));
      } catch (e) {
        console.warn(`[TX-STATE] Dropping malformed log-shipping line: ${e.message}`);
      }
    }

    const keep = [];
    for (let i = 0; i < parsed.length; i += 1) {
      const item = parsed[i];
      const entry = item?.entry;
      if (!entry) continue;

      if (shipped >= maxEntries) {
        keep.push(item);
        continue;
      }

      try {
        await writeTransactionStateToDb(entry);
        shipped += 1;
      } catch (e) {
        keep.push(item, ...parsed.slice(i + 1));
        txStatePersistenceStats.shippingFailures += 1;
        txStatePersistenceStats.lastShipFailureAt = new Date().toISOString();
        txStatePersistenceStats.lastShipError = formatErrorDetails(e);
        break;
      }
    }

    ensureDataRootExists();
    if (keep.length > 0) {
      fs.writeFileSync(
        TX_STATE_LOG_SHIPPING_PATH,
        `${keep.map(item => JSON.stringify(item)).join('\n')}\n`,
        'utf-8'
      );
    } else {
      fs.writeFileSync(TX_STATE_LOG_SHIPPING_PATH, '', 'utf-8');
    }

    if (shipped > 0) {
      txStatePersistenceStats.shippedWrites += shipped;
      txStatePersistenceStats.lastShippedAt = new Date().toISOString();
      txStatePersistenceStats.lastShipError = null;
    }

    return { shipped, remaining: keep.length };
  } finally {
    txStateShippingActive = false;
  }
}

function toSqlIdentifier(name) {
  const parts = String(name || '').trim().split('.').filter(Boolean);
  if (!parts.length || parts.some(part => !/^[A-Za-z0-9_]+$/.test(part))) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return parts.map(part => `[${part}]`).join('.');
}

const FSM_MSSQL_CURRENT_TABLE_SQL = toSqlIdentifier(FSM_MSSQL_CURRENT_TABLE);
const FSM_MSSQL_HISTORY_TABLE_SQL = toSqlIdentifier(FSM_MSSQL_HISTORY_TABLE);
const NLP_MSSQL_INTERACTION_TABLE = 'NlpInteractionLog';
const NLP_MSSQL_USER_PROFILE_TABLE = 'NlpUserProfile';
const NLP_MSSQL_INTERACTION_TABLE_SQL = toSqlIdentifier(NLP_MSSQL_INTERACTION_TABLE);
const NLP_MSSQL_USER_PROFILE_TABLE_SQL = toSqlIdentifier(NLP_MSSQL_USER_PROFILE_TABLE);

async function getTransactionStateMssqlPool() {
  if (txMssqlPoolPromise) return txMssqlPoolPromise;

  txMssqlPoolPromise = (async () => {
    if (!FSM_MSSQL_CONNECTION_STRING) {
      throw new Error('FSM_MSSQL_CONNECTION_STRING is not configured');
    }

    let mssql;
    try {
      mssql = await import('mssql');
    } catch {
      throw new Error('MSSQL transaction state provider requires the mssql package to be installed');
    }

    // mssql is a CJS package; under ESM dynamic import the exports may be
    // wrapped under .default — normalise to whichever shape is present.
    txMssql = mssql.default ?? mssql;

    const connectionCandidates = [];
    const addConnectionCandidate = (value) => {
      const normalized = String(value || '').trim();
      if (!normalized) return;
      if (!connectionCandidates.includes(normalized)) {
        connectionCandidates.push(normalized);
      }
    };

    addConnectionCandidate(FSM_MSSQL_CONNECTION_STRING);

    if (SQL_INSTANCE_MODE === 'sqlexpress') {
      const explicitFsm = Boolean(process.env.FSM_MSSQL_CONNECTION_STRING);
      const explicitGroup = Boolean(process.env.GROUP_MSSQL_CONNECTION_STRING);

      if (!explicitFsm && !explicitGroup) {
        addConnectionCandidate(buildSqlConnectionStringWithHost('.'));
        addConnectionCandidate(buildSqlConnectionStringWithHost('localhost'));
      }

      if (/localhost\\SQLEXPRESS/i.test(FSM_MSSQL_CONNECTION_STRING)) {
        addConnectionCandidate(FSM_MSSQL_CONNECTION_STRING.replace(/localhost\\SQLEXPRESS/ig, '.\\SQLEXPRESS'));
      }
      if (/\.\\SQLEXPRESS/i.test(FSM_MSSQL_CONNECTION_STRING)) {
        addConnectionCandidate(FSM_MSSQL_CONNECTION_STRING.replace(/\.\\SQLEXPRESS/ig, 'localhost\\SQLEXPRESS'));
      }
    }

    let pool = null;
    let lastError = null;
    for (const candidate of connectionCandidates) {
      try {
        pool = await txMssql.connect(candidate);
        if (candidate !== String(FSM_MSSQL_CONNECTION_STRING || '').trim()) {
          console.warn('[FSM-SQL] Primary connection string failed; connected using local fallback target.');
        }
        break;
      } catch (e) {
        lastError = e;
      }
    }

    // Fallback: use native Windows SQL driver for trusted local instances.
    if (!pool) {
      try {
        const mssqlNative = await import('mssql/msnodesqlv8.js');
        txMssql = mssqlNative.default ?? mssqlNative;
        for (const candidate of connectionCandidates) {
          try {
            pool = await txMssql.connect({ connectionString: toOdbcTrustedConnectionString(candidate) });
            console.warn('[FSM-SQL] Using native msnodesqlv8 fallback driver for SQL connectivity.');
            break;
          } catch (e) {
            lastError = e;
          }
        }
      } catch (e) {
        lastError = e;
      }
    }

    if (!pool) {
      throw lastError || new Error('Unable to connect to SQL Server');
    }

    await pool.request().query(`
IF OBJECT_ID('${FSM_MSSQL_CURRENT_TABLE.replace(/'/g, "''")}', 'U') IS NULL
BEGIN
  CREATE TABLE ${FSM_MSSQL_CURRENT_TABLE_SQL} (
    entity_id NVARCHAR(128) NOT NULL PRIMARY KEY,
    machine_id NVARCHAR(128) NOT NULL,
    state_id NVARCHAR(128) NOT NULL,
    state_label NVARCHAR(256) NULL,
    queue_name NVARCHAR(256) NULL,
    last_event_id NVARCHAR(128) NULL,
    is_terminal BIT NOT NULL DEFAULT 0,
    payload_type NVARCHAR(64) NULL,
    updated_at DATETIME2 NOT NULL
  )
END
IF OBJECT_ID('${FSM_MSSQL_HISTORY_TABLE.replace(/'/g, "''")}', 'U') IS NULL
BEGIN
  CREATE TABLE ${FSM_MSSQL_HISTORY_TABLE_SQL} (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    entity_id NVARCHAR(128) NOT NULL,
    machine_id NVARCHAR(128) NOT NULL,
    from_state NVARCHAR(128) NULL,
    to_state NVARCHAR(128) NOT NULL,
    to_state_label NVARCHAR(256) NULL,
    queue_name NVARCHAR(256) NULL,
    event_name NVARCHAR(128) NULL,
    is_terminal BIT NOT NULL DEFAULT 0,
    updated_at DATETIME2 NOT NULL
  )
  CREATE INDEX IX_FsmStateHistory_Entity_Id ON ${FSM_MSSQL_HISTORY_TABLE_SQL}(entity_id, id DESC)
END
IF OBJECT_ID('${NLP_MSSQL_INTERACTION_TABLE.replace(/'/g, "''")}', 'U') IS NULL
BEGIN
  CREATE TABLE ${NLP_MSSQL_INTERACTION_TABLE_SQL} (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    actor_user_id NVARCHAR(128) NOT NULL,
    language_code NVARCHAR(32) NULL,
    user_message NVARCHAR(MAX) NOT NULL,
    normalized_intent NVARCHAR(64) NULL,
    intent_confidence DECIMAL(5,4) NULL,
    response_kind NVARCHAR(64) NULL,
    clarification_requested BIT NOT NULL DEFAULT 0,
    was_successful BIT NOT NULL DEFAULT 1,
    screen_context_json NVARCHAR(MAX) NULL,
    suggestions_json NVARCHAR(MAX) NULL,
    metadata_json NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  )
  CREATE INDEX IX_NlpInteractionLog_Actor_CreatedAt ON ${NLP_MSSQL_INTERACTION_TABLE_SQL}(actor_user_id, created_at DESC)
END
IF OBJECT_ID('${NLP_MSSQL_USER_PROFILE_TABLE.replace(/'/g, "''")}', 'U') IS NULL
BEGIN
  CREATE TABLE ${NLP_MSSQL_USER_PROFILE_TABLE_SQL} (
    actor_user_id NVARCHAR(128) NOT NULL PRIMARY KEY,
    preferred_language NVARCHAR(32) NULL,
    preferred_prompt_style NVARCHAR(64) NULL,
    learned_preferences_json NVARCHAR(MAX) NULL,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  )
END
`);

    return pool;
  })().catch((e) => {
    txMssqlPoolPromise = null;
    throw e;
  });

  return txMssqlPoolPromise;
}

async function logNlpInteractionToSql(payload = {}) {
  try {
    const pool = await getTransactionStateMssqlPool();
    const actorUserId = String(payload.actorUserId || DEFAULT_ACTOR_USER_ID || 'system-admin').slice(0, 128);
    const languageCode = payload.languageCode == null ? null : String(payload.languageCode).slice(0, 32);
    const userMessage = String(payload.userMessage || '').trim();
    if (!userMessage) return;
    const normalizedIntent = payload.normalizedIntent == null ? null : String(payload.normalizedIntent).slice(0, 64);
    const intentConfidence = Number(payload.intentConfidence);
    const responseKind = payload.responseKind == null ? null : String(payload.responseKind).slice(0, 64);
    const clarificationRequested = payload.clarificationRequested ? 1 : 0;
    const wasSuccessful = payload.wasSuccessful === false ? 0 : 1;
    const screenContextJson = payload.screenContext == null ? null : JSON.stringify(payload.screenContext);
    const suggestionsJson = payload.suggestions == null ? null : JSON.stringify(payload.suggestions);
    const metadataJson = payload.metadata == null ? null : JSON.stringify(payload.metadata);

    await pool.request()
      .input('actor_user_id', txMssql.NVarChar(128), actorUserId)
      .input('language_code', txMssql.NVarChar(32), languageCode)
      .input('user_message', txMssql.NVarChar(txMssql.MAX), userMessage)
      .input('normalized_intent', txMssql.NVarChar(64), normalizedIntent)
      .input('intent_confidence', txMssql.Decimal(5, 4), Number.isFinite(intentConfidence) ? Math.max(0, Math.min(1, intentConfidence)) : null)
      .input('response_kind', txMssql.NVarChar(64), responseKind)
      .input('clarification_requested', txMssql.Bit, clarificationRequested)
      .input('was_successful', txMssql.Bit, wasSuccessful)
      .input('screen_context_json', txMssql.NVarChar(txMssql.MAX), screenContextJson)
      .input('suggestions_json', txMssql.NVarChar(txMssql.MAX), suggestionsJson)
      .input('metadata_json', txMssql.NVarChar(txMssql.MAX), metadataJson)
      .query(`
INSERT INTO ${NLP_MSSQL_INTERACTION_TABLE_SQL} (
  actor_user_id,
  language_code,
  user_message,
  normalized_intent,
  intent_confidence,
  response_kind,
  clarification_requested,
  was_successful,
  screen_context_json,
  suggestions_json,
  metadata_json,
  created_at
) VALUES (
  @actor_user_id,
  @language_code,
  @user_message,
  @normalized_intent,
  @intent_confidence,
  @response_kind,
  @clarification_requested,
  @was_successful,
  @screen_context_json,
  @suggestions_json,
  @metadata_json,
  SYSUTCDATETIME()
)
`);
  } catch (error) {
    console.warn('[NLP-SQL] Unable to persist interaction:', formatErrorDetails(error));
  }
}

function tryParseJsonObject(raw, fallback = {}) {
  try {
    if (raw == null) return fallback;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

async function updateNlpUserProfileFromFeedback(payload = {}) {
  try {
    const actorUserId = String(payload.actorUserId || DEFAULT_ACTOR_USER_ID || 'system-admin').slice(0, 128);
    const selectedOptionId = String(payload.selectedOptionId || '').trim().slice(0, 64);
    if (!selectedOptionId) return;

    const pool = await getTransactionStateMssqlPool();
    const existingRs = await pool.request()
      .input('actor_user_id', txMssql.NVarChar(128), actorUserId)
      .query(`SELECT TOP 1 learned_preferences_json FROM ${NLP_MSSQL_USER_PROFILE_TABLE_SQL} WHERE actor_user_id = @actor_user_id`);

    const existingPrefsRaw = existingRs.recordset?.[0]?.learned_preferences_json || null;
    const existingPrefs = tryParseJsonObject(existingPrefsRaw, {});
    const optionSelectionCounts = tryParseJsonObject(existingPrefs.optionSelectionCounts, {});
    const priorCount = Number(optionSelectionCounts[selectedOptionId]) || 0;
    optionSelectionCounts[selectedOptionId] = priorCount + 1;

    const learnedPreferences = {
      ...existingPrefs,
      optionSelectionCounts,
      lastSelectedOptionId: selectedOptionId,
      lastOriginalMessage: payload.originalMessage == null ? null : String(payload.originalMessage).slice(0, 512),
      lastRewrite: payload.rewrittenMessage == null ? null : String(payload.rewrittenMessage).slice(0, 512),
      lastFeedbackAt: new Date().toISOString()
    };

    const preferredLanguage = payload.languageCode == null ? null : String(payload.languageCode).slice(0, 32);
    const preferredPromptStyle = payload.preferredPromptStyle == null ? null : String(payload.preferredPromptStyle).slice(0, 64);

    await pool.request()
      .input('actor_user_id', txMssql.NVarChar(128), actorUserId)
      .input('preferred_language', txMssql.NVarChar(32), preferredLanguage)
      .input('preferred_prompt_style', txMssql.NVarChar(64), preferredPromptStyle)
      .input('learned_preferences_json', txMssql.NVarChar(txMssql.MAX), JSON.stringify(learnedPreferences))
      .query(`
MERGE ${NLP_MSSQL_USER_PROFILE_TABLE_SQL} AS target
USING (SELECT @actor_user_id AS actor_user_id) AS source
ON target.actor_user_id = source.actor_user_id
WHEN MATCHED THEN
  UPDATE SET
    preferred_language = COALESCE(@preferred_language, target.preferred_language),
    preferred_prompt_style = COALESCE(@preferred_prompt_style, target.preferred_prompt_style),
    learned_preferences_json = @learned_preferences_json,
    updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (actor_user_id, preferred_language, preferred_prompt_style, learned_preferences_json, updated_at)
  VALUES (@actor_user_id, @preferred_language, @preferred_prompt_style, @learned_preferences_json, SYSUTCDATETIME());
`);
  } catch (error) {
    console.warn('[NLP-SQL] Unable to persist profile feedback:', formatErrorDetails(error));
  }
}

function buildFsmClarificationOptions(userMessage) {
  const text = String(userMessage || '').toLowerCase();
  const options = [
    {
      id: 'status-by-reference',
      label: 'Look up a specific transaction by reference',
      example: 'where is transaction REF202605180001'
    },
    {
      id: 'history-by-reference',
      label: 'Show transition history for a specific reference',
      example: 'show history for reference REF202605180001'
    },
    {
      id: 'state-explanation',
      label: 'Explain what a state means in the lifecycle',
      example: 'what does reconciled mean in the payment lifecycle'
    }
  ];

  if (text.includes('all') || text.includes('settled') || text.includes('summary')) {
    options.unshift({
      id: 'settlement-summary',
      label: 'Summarize whether a batch of transactions is settled',
      example: 'are these references settled: REF1, REF2, REF3'
    });
  }

  return options.slice(0, 4);
}
const lifecycleStateCumulativeCounts = new Map();
const lifecycleActionPolicy = {
  allowDbSync: false,
  allowDbAsync: false
};
const lifecycleTesterStats = {
  happy: {
    runs: 0,
    completed: 0,
    failed: 0,
    totalTransitions: 0,
    lastRunAt: null,
    lastStatus: null,
    lastTransactionId: null,
    lastError: null
  },
  sad: {
    runs: 0,
    completed: 0,
    failed: 0,
    totalTransitions: 0,
    lastRunAt: null,
    lastStatus: null,
    lastTransactionId: null,
    lastError: null
  }
};
const DEFAULT_ACTOR_USER_ID = AUTH_SYSTEM_ADMIN_USER_ID;
const TOXIC_ROLE_COMBINATIONS = Object.freeze([
  {
    id: 'four-eyes-creator-authorizer',
    roles: ['txn-creator', 'txn-authorizer'],
    reason: 'A single actor cannot create and authorize the same transaction.'
  }
]);

function getToxicRoleCombinationPolicy() {
  return {
    version: 1,
    source: process.env.IAM_POLICY_SOURCE || 'local',
    combinations: TOXIC_ROLE_COMBINATIONS
  };
}

function detectToxicRoleViolations(profileIds = []) {
  const assigned = new Set((profileIds || []).map(value => String(value || '').trim()).filter(Boolean));
  const violations = [];
  for (const combo of TOXIC_ROLE_COMBINATIONS) {
    const roles = Array.isArray(combo.roles) ? combo.roles : [];
    if (roles.length < 2) continue;
    if (roles.every(role => assigned.has(role))) {
      violations.push({
        id: combo.id,
        roles,
        reason: combo.reason,
        principle: 'four-eyes'
      });
    }
  }
  return violations;
}

function getIamIntegrationPaths() {
  return {
    iamSource: process.env.IAM_SOURCE || 'local',
    targetAuthoritativeSource: process.env.IAM_TARGET_SOURCE || 'sailpoint',
    auditMode: 'strict',
    migrationStages: [
      { id: 'stage-1', name: 'Mirror identities', status: 'planned', description: 'Ingest SailPoint identities and compare to local user directory.' },
      { id: 'stage-2', name: 'Mirror entitlements', status: 'planned', description: 'Ingest role/entitlement assignments and evaluate drift.' },
      { id: 'stage-3', name: 'Read-authoritative', status: 'planned', description: 'Use SailPoint as read authority while retaining local emergency writes.' },
      { id: 'stage-4', name: 'Write-authoritative', status: 'planned', description: 'Block local IAM writes except break-glass operations with dual approval.' }
    ],
    integrationPaths: [
      {
        id: 'scim-pull',
        system: 'SailPoint',
        direction: 'pull',
        transport: 'scim',
        purpose: 'Identity and role synchronization'
      },
      {
        id: 'event-push',
        system: 'SailPoint',
        direction: 'push',
        transport: 'webhook',
        purpose: 'Near-real-time entitlement change notifications'
      }
    ]
  };
}
const pendingApprovalRequests = new Map();
let auditChainHead = 'GENESIS';
const LIFECYCLE_HEARTBEAT_INACTIVITY_MS = readEnvNumber('LIFECYCLE_HEARTBEAT_INACTIVITY_MS', 30 * 1000);
const LIFECYCLE_HEARTBEAT_CHECK_INTERVAL_MS = readEnvNumber('LIFECYCLE_HEARTBEAT_CHECK_INTERVAL_MS', 5 * 1000);
const LIFECYCLE_HEARTBEAT_ENABLED = readEnvBoolean('LIFECYCLE_HEARTBEAT_ENABLED', ['1', 'true', 'yes'], true);
const BACKEND_WORKER_AUTOSTART = readEnvBoolean('BACKEND_WORKER_AUTOSTART', ['1', 'true', 'yes'], false);
const BACKEND_AUX_SERVICES_AUTOSTART = readEnvBoolean('BACKEND_AUX_SERVICES_AUTOSTART', ['1', 'true', 'yes'], false);
const PULSE_MCP_AUTOSTART = readEnvBoolean('PULSE_MCP_AUTOSTART', ['1', 'true', 'yes'], true);
const ROUTER_WORKER_MAX_BACKOFF_MULTIPLIER = Math.max(1.5, readEnvNumber('ROUTER_WORKER_MAX_BACKOFF_MULTIPLIER', 3.5));
const LIFECYCLE_WORKER_MAX_BACKOFF_MULTIPLIER = Math.max(1.5, readEnvNumber('LIFECYCLE_WORKER_MAX_BACKOFF_MULTIPLIER', 4.5));
const BRIDGE_WORKER_MAX_BACKOFF_MULTIPLIER = Math.max(1.5, readEnvNumber('BRIDGE_WORKER_MAX_BACKOFF_MULTIPLIER', 4));
const WORKER_STARTUP_STAGGER_CAP_MS = Math.max(20, readEnvNumber('WORKER_STARTUP_STAGGER_CAP_MS', 180));
const EDGE_ESP32_ENABLED = readEnvBoolean('EDGE_ESP32_ENABLED', ['1', 'true', 'yes'], false);
const EDGE_ESP32_AUTO_INGEST = readEnvBoolean('EDGE_ESP32_AUTO_INGEST', ['1', 'true', 'yes'], true);
const EDGE_ESP32_HOST = readEnvString('EDGE_ESP32_HOST', '127.0.0.1').trim() || '127.0.0.1';
const EDGE_ESP32_PORT = Math.max(1, readEnvNumber('EDGE_ESP32_PORT', 80));
const EDGE_ESP32_TIMEOUT_MS = Math.max(100, readEnvNumber('EDGE_ESP32_TIMEOUT_MS', 1200));
const EDGE_ESP32_PATH = readEnvString('EDGE_ESP32_PATH', '/pmachine/edge_ingress_stage').trim() || '/pmachine/edge_ingress_stage';
const EDGE_ESP32_CONVERT_PATH = readEnvString('EDGE_ESP32_CONVERT_PATH', '/api/convert').trim() || '/api/convert';
const EDGE_ESP32_MAP_REGISTER_PATH = readEnvString('EDGE_ESP32_MAP_REGISTER_PATH', '/pmachine/map_service/register').trim() || '/pmachine/map_service/register';
const EDGE_ESP32_ROUTER_FILE = readEnvString('EDGE_ESP32_ROUTER_FILE', '/router-mapper.pcode').trim() || '/router-mapper.pcode';
const EDGE_ESP32_PROGRAM_MAP = readEnvString('EDGE_ESP32_PROGRAM_MAP', '/router-mapper.program.json').trim() || '/router-mapper.program.json';
const EDGE_ESP32_LARGE_MESSAGE_THRESHOLD_BYTES = Math.max(1024, readEnvNumber('EDGE_ESP32_LARGE_MESSAGE_THRESHOLD_BYTES', 8192));
const EDGE_ESP32_FORCED_EVOLUTION_RATE = Math.min(1, Math.max(0, readEnvNumber('EDGE_ESP32_FORCED_EVOLUTION_RATE', 0)));
const MAP_PLACEMENT_REGISTRY_PATH = path.join(RUNTIME_DATA_ROOT, 'map-placement-registry.json');
const MAP_PLACEMENT_ASSIGNMENT_TTL_MS = Math.max(10 * 1000, readEnvNumber('MAP_PLACEMENT_ASSIGNMENT_TTL_MS', 60 * 1000));
const MAP_PLACEMENT_REGISTRATION_TTL_MS = Math.max(30 * 1000, readEnvNumber('MAP_PLACEMENT_REGISTRATION_TTL_MS', 10 * 60 * 1000));

function parseEdgeNodeList(rawList = '') {
  return String(rawList || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      let host = entry;
      let port = EDGE_ESP32_PORT;
      if (entry.startsWith('http://') || entry.startsWith('https://')) {
        try {
          const parsed = new URL(entry);
          host = parsed.hostname;
          port = Number(parsed.port) > 0 ? Number(parsed.port) : EDGE_ESP32_PORT;
        } catch {
          host = EDGE_ESP32_HOST;
          port = EDGE_ESP32_PORT;
        }
      } else if (entry.includes(':')) {
        const [hostPart, portPart] = entry.split(':');
        host = String(hostPart || '').trim() || EDGE_ESP32_HOST;
        const parsedPort = Number(String(portPart || '').trim());
        port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : EDGE_ESP32_PORT;
      }
      return {
        host,
        port,
        label: `${host}:${port}`
      };
    });
}

const EDGE_ESP32_DEFAULT_NODE = {
  host: EDGE_ESP32_HOST,
  port: EDGE_ESP32_PORT,
  label: `${EDGE_ESP32_HOST}:${EDGE_ESP32_PORT}`
};
const EDGE_ESP32_GENERAL_NODES = parseEdgeNodeList(readEnvString('EDGE_ESP32_NODES', ''));
const EDGE_ESP32_BONECRUSHER_NODES = parseEdgeNodeList(readEnvString('EDGE_ESP32_BONECRUSHER_NODES', ''));
const EDGE_ESP32_DRONE_NODES = parseEdgeNodeList(readEnvString('EDGE_ESP32_DRONE_NODES', ''));
const EDGE_ESP32_FALLBACK_NODES = EDGE_ESP32_GENERAL_NODES.length > 0 ? EDGE_ESP32_GENERAL_NODES : [EDGE_ESP32_DEFAULT_NODE];
const ESP32_DISCOVERY_PROBE_ENABLED = readEnvBoolean('ESP32_DISCOVERY_PROBE_ENABLED', ['1', 'true', 'yes'], true);
const ESP32_DISCOVERY_PROBE_INTERVAL_MS = Math.max(5000, readEnvNumber('ESP32_DISCOVERY_PROBE_INTERVAL_MS', 15000));
const ESP32_DISCOVERY_PROBE_TIMEOUT_MS = Math.max(300, readEnvNumber('ESP32_DISCOVERY_PROBE_TIMEOUT_MS', 1500));
const ESP32_DISCOVERY_SEED_NODES = parseEdgeNodeList(readEnvString('ESP32_DISCOVERY_SEED_NODES', ''));
const edgeNodeRoundRobinByRole = new Map();
const mapPlacementState = {
  version: 1,
  updatedAt: null,
  maps: new Map(),
  assignmentByPlacement: new Map(),
  inflightByPlacement: new Map(),
  registrationByPlacement: new Map(),
  lastDecision: null
};

loadMapPlacementRegistry();

function normalizeMapKey(value) {
  const text = String(value || '').trim().toUpperCase();
  return text;
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildMapKeyFromParts({ mapKey = null, sourceType = null, destinationType = null } = {}) {
  const direct = normalizeMapKey(mapKey);
  if (direct) return direct;
  const src = normalizeMapKey(sourceType);
  const dst = normalizeMapKey(destinationType);
  if (src && dst) return `${src}->${dst}`;
  return '';
}

function normalizePlacementRecord(mapKey, placement = {}) {
  const tierRaw = String(placement.tier || placement.runtimeTier || 'esp32').trim().toLowerCase();
  const tier = tierRaw === 'jsvm' || tierRaw === 'javascript' || tierRaw === 'node' ? 'jsvm' : 'esp32';
  const host = String(placement.host || '').trim();
  const port = Math.max(1, toFiniteNumber(placement.port, EDGE_ESP32_PORT));
  const id = String(placement.id || placement.nodeId || placement.label || '').trim() || (host ? `${host}:${port}` : `${tier}:${mapKey}`);
  const maxConcurrent = Math.max(1, toFiniteNumber(placement.maxConcurrent, tier === 'esp32' ? 1 : 8));
  const maxMessageBytes = Math.max(0, toFiniteNumber(placement.maxMessageBytes, tier === 'esp32' ? EDGE_ESP32_LARGE_MESSAGE_THRESHOLD_BYTES * 8 : 0));
  const weight = Math.max(1, toFiniteNumber(placement.weight, 1));
  return {
    id,
    tier,
    host: host || null,
    port,
    label: String(placement.label || '').trim() || (host ? `${host}:${port}` : id),
    role: normalizeEdgeRole(placement.role) || null,
    path: String(placement.path || EDGE_ESP32_PATH).trim() || EDGE_ESP32_PATH,
    convertPath: String(placement.convertPath || EDGE_ESP32_CONVERT_PATH).trim() || EDGE_ESP32_CONVERT_PATH,
    registerPath: String(placement.registerPath || EDGE_ESP32_MAP_REGISTER_PATH).trim() || EDGE_ESP32_MAP_REGISTER_PATH,
    file: String(placement.file || EDGE_ESP32_ROUTER_FILE).trim() || EDGE_ESP32_ROUTER_FILE,
    programMap: String(placement.programMap || EDGE_ESP32_PROGRAM_MAP).trim() || EDGE_ESP32_PROGRAM_MAP,
    maxConcurrent,
    maxMessageBytes,
    weight,
    healthy: placement.healthy !== false,
    warm: placement.warm === true,
    enabled: placement.enabled !== false,
    metadata: placement.metadata && typeof placement.metadata === 'object' ? placement.metadata : {}
  };
}

function normalizeMapPlacementEntry(raw = {}, fallbackMapKey = '') {
  const sourceType = normalizeMapKey(raw.sourceType || raw.fromType || '');
  const destinationType = normalizeMapKey(raw.destinationType || raw.toType || '');
  const mapKey = buildMapKeyFromParts({
    mapKey: raw.mapKey || fallbackMapKey,
    sourceType,
    destinationType
  });
  const placements = Array.isArray(raw.placements)
    ? raw.placements.map((item) => normalizePlacementRecord(mapKey, item)).filter((item) => item.enabled)
    : [];
  return {
    mapKey,
    sourceType,
    destinationType,
    strategy: String(raw.strategy || 'balanced').trim().toLowerCase() || 'balanced',
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
    placements
  };
}

function mapPlacementEntryToJson(entry) {
  return {
    mapKey: entry.mapKey,
    sourceType: entry.sourceType,
    destinationType: entry.destinationType,
    strategy: entry.strategy,
    updatedAt: entry.updatedAt,
    placements: entry.placements
  };
}

function persistMapPlacementRegistry() {
  try {
    const payload = {
      version: mapPlacementState.version,
      updatedAt: new Date().toISOString(),
      maps: Array.from(mapPlacementState.maps.values()).map(mapPlacementEntryToJson)
    };
    fs.writeFileSync(MAP_PLACEMENT_REGISTRY_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
    mapPlacementState.updatedAt = payload.updatedAt;
  } catch (e) {
    console.warn(`[MAP-PLACEMENT] Failed to persist registry: ${e.message}`);
  }
}

function loadMapPlacementRegistry() {
  try {
    if (!fs.existsSync(MAP_PLACEMENT_REGISTRY_PATH)) {
      mapPlacementState.maps.clear();
      persistMapPlacementRegistry();
      return;
    }
    const raw = fs.readFileSync(MAP_PLACEMENT_REGISTRY_PATH, 'utf-8');
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    mapPlacementState.maps.clear();
    const records = Array.isArray(parsed.maps) ? parsed.maps : [];
    for (const item of records) {
      const normalized = normalizeMapPlacementEntry(item);
      if (!normalized.mapKey) continue;
      mapPlacementState.maps.set(normalized.mapKey, normalized);
    }
    mapPlacementState.updatedAt = String(parsed.updatedAt || new Date().toISOString());
  } catch (e) {
    console.warn(`[MAP-PLACEMENT] Failed to load registry: ${e.message}`);
    mapPlacementState.maps.clear();
  }
}

function pruneMapPlacementRuntimeState(nowMs = Date.now()) {
  const assignmentCutoff = nowMs - MAP_PLACEMENT_ASSIGNMENT_TTL_MS;
  const registrationCutoff = nowMs - MAP_PLACEMENT_REGISTRATION_TTL_MS;
  for (const [key, value] of mapPlacementState.assignmentByPlacement.entries()) {
    if (toFiniteNumber(value, 0) < assignmentCutoff) {
      mapPlacementState.assignmentByPlacement.delete(key);
    }
  }
  for (const [key, value] of mapPlacementState.registrationByPlacement.entries()) {
    if (toFiniteNumber(value, 0) < registrationCutoff) {
      mapPlacementState.registrationByPlacement.delete(key);
    }
  }
}

function getPlacementInflight(placementId) {
  return Math.max(0, toFiniteNumber(mapPlacementState.inflightByPlacement.get(placementId), 0));
}

function markPlacementInflight(placementId, delta) {
  if (!placementId) return;
  const next = Math.max(0, getPlacementInflight(placementId) + Number(delta || 0));
  if (next <= 0) {
    mapPlacementState.inflightByPlacement.delete(placementId);
    return;
  }
  mapPlacementState.inflightByPlacement.set(placementId, next);
}

function recordMapPlacementDecision(mapKey, placement, reason = 'unknown', score = null, candidates = []) {
  mapPlacementState.assignmentByPlacement.set(placement.id, Date.now());
  mapPlacementState.lastDecision = {
    at: new Date().toISOString(),
    mapKey,
    placementId: placement.id,
    tier: placement.tier,
    reason,
    score: Number.isFinite(score) ? Number(score.toFixed(4)) : null,
    candidates: candidates.slice(0, 8).map((candidate) => ({
      id: candidate.id,
      tier: candidate.tier,
      score: Number.isFinite(candidate.__score) ? Number(candidate.__score.toFixed(4)) : null,
      healthy: candidate.healthy,
      warm: candidate.warm,
      inflight: getPlacementInflight(candidate.id),
      maxConcurrent: candidate.maxConcurrent
    }))
  };
}

function chooseMapPlacement({ mapKey = '', sourceType = null, destinationType = null, message = null, requestedRole = null } = {}) {
  const normalizedKey = buildMapKeyFromParts({ mapKey, sourceType, destinationType });
  if (!normalizedKey) {
    return { ok: false, reason: 'missing-map-key', mapKey: '' };
  }

  const entry = mapPlacementState.maps.get(normalizedKey);
  if (!entry || !Array.isArray(entry.placements) || entry.placements.length === 0) {
    return { ok: false, reason: 'no-placement', mapKey: normalizedKey };
  }

  const nowMs = Date.now();
  pruneMapPlacementRuntimeState(nowMs);
  const estimatedMessageBytes = estimateMessageSizeBytes(message);
  const role = normalizeEdgeRole(requestedRole);

  const candidates = entry.placements
    .filter((placement) => placement.enabled !== false)
    .filter((placement) => placement.healthy !== false)
    .filter((placement) => (role ? placement.role === role : true))
    .filter((placement) => {
      if (!placement.maxMessageBytes || placement.maxMessageBytes <= 0) return true;
      return estimatedMessageBytes <= placement.maxMessageBytes;
    })
    .map((placement) => {
      const inflight = getPlacementInflight(placement.id);
      const saturation = inflight / Math.max(1, placement.maxConcurrent || 1);
      const recentlyAssignedAt = toFiniteNumber(mapPlacementState.assignmentByPlacement.get(placement.id), 0);
      const recentlyAssignedPenalty = recentlyAssignedAt > 0
        ? Math.max(0, 1 - ((nowMs - recentlyAssignedAt) / MAP_PLACEMENT_ASSIGNMENT_TTL_MS))
        : 0;
      const warmBonus = placement.warm ? -0.15 : 0.1;
      const tierPenalty = placement.tier === 'esp32' ? 0 : 0.7;
      const weightFactor = 1 / Math.max(1, toFiniteNumber(placement.weight, 1));
      const score = tierPenalty + saturation + (recentlyAssignedPenalty * 0.35) + warmBonus + weightFactor;
      return {
        ...placement,
        __score: score,
        __inflight: inflight
      };
    })
    .sort((a, b) => a.__score - b.__score);

  if (candidates.length === 0) {
    return { ok: false, reason: 'no-healthy-candidate', mapKey: normalizedKey, estimatedMessageBytes };
  }

  const selected = candidates[0];
  recordMapPlacementDecision(normalizedKey, selected, 'balanced-score', selected.__score, candidates);
  return {
    ok: true,
    reason: 'balanced-score',
    mapKey: normalizedKey,
    estimatedMessageBytes,
    selected,
    candidates
  };
}

async function tryRegisterMapOnEdgeNode({ placement, mapKey, sourceType = null, destinationType = null } = {}) {
  if (!placement || placement.tier !== 'esp32' || !placement.host) return;
  const cacheKey = `${placement.id}::${mapKey}`;
  const nowMs = Date.now();
  const recent = toFiniteNumber(mapPlacementState.registrationByPlacement.get(cacheKey), 0);
  if (recent > 0 && (nowMs - recent) < MAP_PLACEMENT_REGISTRATION_TTL_MS) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EDGE_ESP32_TIMEOUT_MS);
  try {
    const endpoint = `http://${placement.host}:${placement.port}${placement.registerPath || EDGE_ESP32_MAP_REGISTER_PATH}`;
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceType: sourceType || placement.sourceType || mapKey.split('->')[0] || '',
        destinationType: destinationType || placement.destinationType || mapKey.split('->')[1] || '',
        file: placement.file || EDGE_ESP32_ROUTER_FILE,
        programMap: placement.programMap || EDGE_ESP32_PROGRAM_MAP,
        preload: false,
        enabled: true
      }),
      signal: controller.signal
    });
    mapPlacementState.registrationByPlacement.set(cacheKey, nowMs);
    placement.warm = true;
  } catch {
    // Best effort registration; selection falls back if invocation fails.
  } finally {
    clearTimeout(timeout);
  }
}

function getMapPlacementSummary() {
  pruneMapPlacementRuntimeState(Date.now());
  const maps = Array.from(mapPlacementState.maps.values()).map((entry) => ({
    ...mapPlacementEntryToJson(entry),
    placements: entry.placements.map((placement) => ({
      ...placement,
      inflight: getPlacementInflight(placement.id),
      recentlyAssignedAtMs: toFiniteNumber(mapPlacementState.assignmentByPlacement.get(placement.id), 0)
    }))
  }));
  return {
    version: mapPlacementState.version,
    updatedAt: mapPlacementState.updatedAt,
    mapCount: maps.length,
    maps,
    lastDecision: mapPlacementState.lastDecision
  };
}

function isLoopbackHost(host = '') {
  const normalized = String(host || '').trim().toLowerCase();
  return normalized === '' || normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0';
}

function readPlatformIoUploadSeeds() {
  const backendDir = path.dirname(fileURLToPath(import.meta.url));
  const platformIoPath = path.join(backendDir, '..', 'platformio.ini');
  const seeds = [];
  try {
    if (!fs.existsSync(platformIoPath)) return seeds;
    const raw = fs.readFileSync(platformIoPath, 'utf-8');
    const lines = String(raw || '').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*upload_port\s*=\s*([^\s#;]+)\s*$/i);
      if (!match) continue;
      const host = String(match[1] || '').trim();
      if (!host || isLoopbackHost(host)) continue;
      seeds.push({ host, port: 80, label: `${host}:80` });
    }
  } catch {
    // Ignore platformio.ini parse errors; UDP discovery remains primary.
  }
  return seeds;
}

const ESP32_DISCOVERY_PROBE_NODES = (() => {
  const merged = [
    ...EDGE_ESP32_GENERAL_NODES,
    ...EDGE_ESP32_BONECRUSHER_NODES,
    ...EDGE_ESP32_DRONE_NODES,
    ...ESP32_DISCOVERY_SEED_NODES,
    ...readPlatformIoUploadSeeds()
  ];
  const dedup = new Map();
  for (const node of merged) {
    const host = String(node?.host || '').trim();
    const port = Number(node?.port) > 0 ? Number(node.port) : 80;
    if (!host || isLoopbackHost(host)) continue;
    dedup.set(`${host}:${port}`, { host, port, label: `${host}:${port}` });
  }
  return Array.from(dedup.values());
})();

function estimateMessageSizeBytes(message) {
  if (message == null) return 0;
  if (typeof message === 'string') return Buffer.byteLength(message, 'utf8');
  try {
    return Buffer.byteLength(JSON.stringify(message), 'utf8');
  } catch {
    return Buffer.byteLength(String(message), 'utf8');
  }
}

function normalizeEdgeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'bonecrusher' || normalized === 'drone') return normalized;
  return null;
}

function chooseEdgeRole({ preferredRole = null, message = null } = {}) {
  const normalizedPreferredRole = normalizeEdgeRole(preferredRole);
  if (normalizedPreferredRole) return normalizedPreferredRole;
  const estimatedBytes = estimateMessageSizeBytes(message);
  if (estimatedBytes >= EDGE_ESP32_LARGE_MESSAGE_THRESHOLD_BYTES) {
    return 'bonecrusher';
  }
  return 'drone';
}

function chooseEdgeNode({ requestedRole = null, message = null } = {}) {
  let role = chooseEdgeRole({ preferredRole: requestedRole, message });
  let strategy = requestedRole ? 'explicit-role' : 'auto-role';

  const canEvolve = EDGE_ESP32_BONECRUSHER_NODES.length > 0 && EDGE_ESP32_DRONE_NODES.length > 0;
  if (canEvolve && EDGE_ESP32_FORCED_EVOLUTION_RATE > 0 && Math.random() < EDGE_ESP32_FORCED_EVOLUTION_RATE) {
    role = role === 'bonecrusher' ? 'drone' : 'bonecrusher';
    strategy = 'forced-evolution';
  }

  let pool = role === 'bonecrusher' ? EDGE_ESP32_BONECRUSHER_NODES : EDGE_ESP32_DRONE_NODES;
  if (!pool.length) {
    pool = EDGE_ESP32_FALLBACK_NODES;
    if (strategy === 'auto-role') strategy = 'fallback-pool';
  }

  const rrKey = `${role}:${strategy}`;
  const currentIndex = edgeNodeRoundRobinByRole.get(rrKey) || 0;
  const selected = pool[currentIndex % pool.length] || EDGE_ESP32_DEFAULT_NODE;
  edgeNodeRoundRobinByRole.set(rrKey, (currentIndex + 1) % Math.max(pool.length, 1));

  return {
    requestedRole: chooseEdgeRole({ preferredRole: requestedRole, message }),
    selectedRole: role,
    strategy,
    estimatedMessageBytes: estimateMessageSizeBytes(message),
    node: selected
  };
}
const lifecycleHeartbeat = {
  enabled: LIFECYCLE_HEARTBEAT_ENABLED,
  inactivityMs: Number.isFinite(LIFECYCLE_HEARTBEAT_INACTIVITY_MS) && LIFECYCLE_HEARTBEAT_INACTIVITY_MS > 0
    ? LIFECYCLE_HEARTBEAT_INACTIVITY_MS
    : 30 * 1000,
  checkIntervalMs: Number.isFinite(LIFECYCLE_HEARTBEAT_CHECK_INTERVAL_MS) && LIFECYCLE_HEARTBEAT_CHECK_INTERVAL_MS > 0
    ? LIFECYCLE_HEARTBEAT_CHECK_INTERVAL_MS
    : 5 * 1000,
  lastActivityMs: Date.now(),
  lastHeartbeatMs: 0,
  lastHeartbeatTxId: null,
  lastError: null,
  autoRuns: 0,
  manualRuns: 0,
  timerId: null,
  running: false
};
const STEP3_INGRESS_QUEUE = 'swift.mt103.inbound';
const STEP3_TARGET_QUEUE = 'tx.lynx.pending';
const sanctionsComplianceService = createSanctionsComplianceService({
  cachePath: SANCTIONS_CACHE_PATH,
  logger: console
});
const step3LatencyTracker = {
  pendingByTxId: new Map(),
  samples: [],
  maxPending: 20000,
  maxSamples: 2000,
  lastUpdatedAt: null,
  lastSample: null
};

const queueEnqueueLatencyTracker = {
  byQueue: new Map(),
  maxQueues: 200,
  maxSamplesPerQueue: 500,
  lastUpdatedAt: null
};

const edgeOffloadTracker = {
  enabled: EDGE_ESP32_ENABLED,
  configuredNode: 'dynamic',
  configuredPools: {
    bonecrusher: EDGE_ESP32_BONECRUSHER_NODES.map((n) => n.label),
    drone: EDGE_ESP32_DRONE_NODES.map((n) => n.label),
    fallback: EDGE_ESP32_FALLBACK_NODES.map((n) => n.label)
  },
  attempted: 0,
  succeeded: 0,
  fallback: 0,
  failedNoFallback: 0,
  recentLatenciesMs: [],
  maxRecentLatencies: 300,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastFallbackAt: null,
  lastError: null,
  lastResult: null
};

function readNestedValueByPath(obj, path) {
  let current = obj;
  for (const segment of path) {
    if (!current || typeof current !== 'object') return null;
    current = current[segment];
  }
  return current == null ? null : current;
}

function toNonEmptyString(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function findFirstKeyValue(value, keys, depth = 0, maxDepth = 8) {
  if (!value || depth > maxDepth) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstKeyValue(item, keys, depth + 1, maxDepth);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== 'object') return null;

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const normalized = toNonEmptyString(value[key]);
      if (normalized) return normalized;
    }
  }

  for (const child of Object.values(value)) {
    const found = findFirstKeyValue(child, keys, depth + 1, maxDepth);
    if (found) return found;
  }
  return null;
}

function extractTransactionIdForStep3(message) {
  if (typeof message === 'string') {
    const txIdMatch = message.match(/:20:([^\s\r\n]+)/i);
    const txId = toNonEmptyString(txIdMatch?.[1]);
    return txId;
  }

  if (!message || typeof message !== 'object') {
    return null;
  }

  const exactPaths = [
    ['Document', 'FIToFICstmrCdtTrf', 'GrpHdr', 'MsgId'],
    ['Document', 'FIToFICstmrCdtTrf', 'CdtTrfTxInf', 0, 'PmtId', 'TxId'],
    ['Document', 'FIToFICstmrCdtTrf', 'CdtTrfTxInf', 0, 'PmtId', 'EndToEndId'],
    ['Document', 'FIToFICstmrCdtTrf', 'CdtTrfTxInf', 0, 'PmtId', 'InstrId']
  ];
  for (const path of exactPaths) {
    const value = toNonEmptyString(readNestedValueByPath(message, path));
    if (value) return value;
  }

  return findFirstKeyValue(message, ['TxId', 'EndToEndId', 'InstrId', 'MsgId', 'transactionId', 'txId']);
}

function trimStep3PendingIfNeeded() {
  while (step3LatencyTracker.pendingByTxId.size > step3LatencyTracker.maxPending) {
    const oldestKey = step3LatencyTracker.pendingByTxId.keys().next().value;
    if (!oldestKey) break;
    step3LatencyTracker.pendingByTxId.delete(oldestKey);
  }
}

function trackStep3IngressEnqueue(queueName, message) {
  if (String(queueName || '') !== STEP3_INGRESS_QUEUE) return;
  const txId = extractTransactionIdForStep3(message);
  if (!txId) return;
  if (!step3LatencyTracker.pendingByTxId.has(txId)) {
    step3LatencyTracker.pendingByTxId.set(txId, Date.now());
    trimStep3PendingIfNeeded();
    step3LatencyTracker.lastUpdatedAt = new Date().toISOString();
  }
}

function trackStep3Arrival(queueName, message) {
  if (String(queueName || '') !== STEP3_TARGET_QUEUE) return null;

  const txId = extractTransactionIdForStep3(message);
  if (!txId) return null;
  const enqueueMs = Number(step3LatencyTracker.pendingByTxId.get(txId));
  if (!Number.isFinite(enqueueMs)) return null;

  const nowMs = Date.now();
  const latencyMs = Math.max(0, nowMs - enqueueMs);
  step3LatencyTracker.pendingByTxId.delete(txId);

  const sample = {
    txId,
    latencyMs,
    enqueuedAtMs: enqueueMs,
    step3AtMs: nowMs,
    measuredAt: new Date(nowMs).toISOString()
  };
  step3LatencyTracker.samples.push(sample);
  while (step3LatencyTracker.samples.length > step3LatencyTracker.maxSamples) {
    step3LatencyTracker.samples.shift();
  }
  step3LatencyTracker.lastSample = sample;
  step3LatencyTracker.lastUpdatedAt = sample.measuredAt;
  return sample;
}

function percentileFromSorted(sortedValues, ratio) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
  const clamped = Math.min(Math.max(Number(ratio), 0), 1);
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.ceil(clamped * sortedValues.length) - 1));
  return sortedValues[index];
}

function trimQueueLatencyQueuesIfNeeded() {
  while (queueEnqueueLatencyTracker.byQueue.size > queueEnqueueLatencyTracker.maxQueues) {
    const oldestQueue = queueEnqueueLatencyTracker.byQueue.keys().next().value;
    if (!oldestQueue) break;
    queueEnqueueLatencyTracker.byQueue.delete(oldestQueue);
  }
}

function getOrCreateQueueLatencyEntry(queueName) {
  const key = String(queueName || 'unknown');
  let entry = queueEnqueueLatencyTracker.byQueue.get(key);
  if (!entry) {
    entry = {
      samples: [],
      total: 0,
      failed: 0,
      lastSample: null,
      lastUpdatedAt: null
    };
    queueEnqueueLatencyTracker.byQueue.set(key, entry);
    trimQueueLatencyQueuesIfNeeded();
  }
  return { key, entry };
}

function trackQueueEnqueueLatency(queueName, latencyMs, { managerId = null, mode = null, ok = true, error = null } = {}) {
  const numericLatencyMs = Number(latencyMs);
  if (!Number.isFinite(numericLatencyMs) || numericLatencyMs < 0) return;

  const nowIso = new Date().toISOString();
  const sample = {
    latencyMs: Number(numericLatencyMs.toFixed(3)),
    ok: Boolean(ok),
    managerId: managerId ? String(managerId) : null,
    mode: mode ? String(mode) : null,
    error: error ? String(error).slice(0, 200) : null,
    measuredAt: nowIso
  };

  const { entry } = getOrCreateQueueLatencyEntry(queueName);
  entry.total += 1;
  if (!sample.ok) {
    entry.failed += 1;
  }
  entry.samples.push(sample);
  while (entry.samples.length > queueEnqueueLatencyTracker.maxSamplesPerQueue) {
    entry.samples.shift();
  }
  entry.lastSample = sample;
  entry.lastUpdatedAt = nowIso;
  queueEnqueueLatencyTracker.lastUpdatedAt = nowIso;
}

function summarizeQueueEnqueueLatencyEntry(queueName, entry, recentLimit = 5) {
  const samples = Array.isArray(entry?.samples) ? entry.samples : [];
  const latencies = samples
    .map((sample) => Number(sample?.latencyMs))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);

  const count = latencies.length;
  const sum = latencies.reduce((acc, value) => acc + value, 0);
  const avgMs = count > 0 ? Number((sum / count).toFixed(3)) : null;
  const total = Number(entry?.total) || 0;
  const failed = Number(entry?.failed) || 0;

  return {
    queueName,
    totalSamples: total,
    failureCount: failed,
    failureRatePct: total > 0 ? Number(((failed / total) * 100).toFixed(2)) : 0,
    sampleCountWindow: count,
    avgMs,
    minMs: count > 0 ? latencies[0] : null,
    p50Ms: percentileFromSorted(latencies, 0.5),
    p95Ms: percentileFromSorted(latencies, 0.95),
    p99Ms: percentileFromSorted(latencies, 0.99),
    maxMs: count > 0 ? latencies[count - 1] : null,
    lastUpdatedAt: entry?.lastUpdatedAt || null,
    lastSample: entry?.lastSample || null,
    recentSamples: samples.slice(-Math.max(1, Number(recentLimit) || 5))
  };
}

function getQueueEnqueueLatencySummary({ queueName = null, recentLimit = 5 } = {}) {
  if (queueName) {
    const key = String(queueName);
    const entry = queueEnqueueLatencyTracker.byQueue.get(key);
    return {
      enabled: true,
      trackedQueues: queueEnqueueLatencyTracker.byQueue.size,
      lastUpdatedAt: queueEnqueueLatencyTracker.lastUpdatedAt,
      queues: entry ? [summarizeQueueEnqueueLatencyEntry(key, entry, recentLimit)] : []
    };
  }

  const queues = [];
  for (const [name, entry] of queueEnqueueLatencyTracker.byQueue.entries()) {
    queues.push(summarizeQueueEnqueueLatencyEntry(name, entry, recentLimit));
  }
  queues.sort((a, b) => (b.p95Ms || 0) - (a.p95Ms || 0));

  return {
    enabled: true,
    trackedQueues: queueEnqueueLatencyTracker.byQueue.size,
    lastUpdatedAt: queueEnqueueLatencyTracker.lastUpdatedAt,
    queues
  };
}

function parseBooleanLike(value, defaultValue = false) {
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function buildEdgeEnvelopeMeta({ edgeProcessed, edgeFallback, edgeNode, edgeLatencyMs, edgeMessageType = null, edgePublishedCount = null } = {}) {
  return {
    edgeProcessed: Boolean(edgeProcessed),
    edgeFallback: Boolean(edgeFallback),
    edgeNode: edgeNode || edgeOffloadTracker.configuredNode,
    edgeLatencyMs: Number.isFinite(edgeLatencyMs) ? Number(edgeLatencyMs.toFixed(2)) : null,
    edgeMessageType: edgeMessageType || null,
    edgePublishedCount: Number.isFinite(edgePublishedCount) ? edgePublishedCount : null,
    edgeTimestamp: new Date().toISOString()
  };
}

function recordEdgeOffloadAttemptResult({ ok, fallbackUsed, latencyMs, error = null, result = null } = {}) {
  edgeOffloadTracker.attempted += 1;
  edgeOffloadTracker.lastAttemptAt = new Date().toISOString();

  if (ok) {
    edgeOffloadTracker.succeeded += 1;
    edgeOffloadTracker.lastSuccessAt = edgeOffloadTracker.lastAttemptAt;
  } else if (fallbackUsed) {
    edgeOffloadTracker.fallback += 1;
    edgeOffloadTracker.lastFallbackAt = edgeOffloadTracker.lastAttemptAt;
  } else {
    edgeOffloadTracker.failedNoFallback += 1;
  }

  if (Number.isFinite(latencyMs) && latencyMs >= 0) {
    edgeOffloadTracker.recentLatenciesMs.push(Number(latencyMs.toFixed(3)));
    while (edgeOffloadTracker.recentLatenciesMs.length > edgeOffloadTracker.maxRecentLatencies) {
      edgeOffloadTracker.recentLatenciesMs.shift();
    }
  }

  edgeOffloadTracker.lastError = error ? String(error?.message || error) : null;
  edgeOffloadTracker.lastResult = result || null;
}

function getEdgeOffloadMetricsSummary() {
  const samples = edgeOffloadTracker.recentLatenciesMs
    .filter(v => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  const count = samples.length;
  const total = samples.reduce((acc, value) => acc + value, 0);
  return {
    enabled: edgeOffloadTracker.enabled,
    configuredNode: edgeOffloadTracker.configuredNode,
    configuredPools: edgeOffloadTracker.configuredPools,
    forcedEvolutionRate: EDGE_ESP32_FORCED_EVOLUTION_RATE,
    largeMessageThresholdBytes: EDGE_ESP32_LARGE_MESSAGE_THRESHOLD_BYTES,
    attempted: edgeOffloadTracker.attempted,
    succeeded: edgeOffloadTracker.succeeded,
    fallback: edgeOffloadTracker.fallback,
    failedNoFallback: edgeOffloadTracker.failedNoFallback,
    successRatePct: edgeOffloadTracker.attempted > 0
      ? Number((((edgeOffloadTracker.succeeded + edgeOffloadTracker.fallback) / edgeOffloadTracker.attempted) * 100).toFixed(2))
      : 0,
    avgLatencyMs: count > 0 ? Number((total / count).toFixed(3)) : null,
    p95LatencyMs: percentileFromSorted(samples, 0.95),
    p99LatencyMs: percentileFromSorted(samples, 0.99),
    lastAttemptAt: edgeOffloadTracker.lastAttemptAt,
    lastSuccessAt: edgeOffloadTracker.lastSuccessAt,
    lastFallbackAt: edgeOffloadTracker.lastFallbackAt,
    lastError: edgeOffloadTracker.lastError,
    lastResult: edgeOffloadTracker.lastResult
  };
}

async function invokeEsp32EdgeIngressStage({
  inputQueue,
  message,
  runRouter = true,
  convertMtToXml = false,
  preferredEdgeRole = null,
  mapKey = null,
  sourceType = null,
  destinationType = null
} = {}) {
  const startMs = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EDGE_ESP32_TIMEOUT_MS);
  const mapSelection = chooseMapPlacement({
    mapKey,
    sourceType,
    destinationType,
    message,
    requestedRole: preferredEdgeRole
  });
  const selection = mapSelection.ok
    ? {
        requestedRole: preferredEdgeRole,
        selectedRole: mapSelection.selected.role || preferredEdgeRole || null,
        strategy: `map-placement:${mapSelection.reason}`,
        estimatedMessageBytes: mapSelection.estimatedMessageBytes,
        node: {
          host: mapSelection.selected.host,
          port: mapSelection.selected.port,
          label: mapSelection.selected.label
        },
        placement: mapSelection.selected,
        mapSelection
      }
    : {
        ...chooseEdgeNode({ requestedRole: preferredEdgeRole, message }),
        placement: null,
        mapSelection
      };
  try {
    if (selection.placement?.tier === 'esp32') {
      await tryRegisterMapOnEdgeNode({
        placement: selection.placement,
        mapKey: selection.mapSelection?.mapKey || mapKey || '',
        sourceType,
        destinationType
      });
    }

    const placementConvertPath = selection.placement?.convertPath || EDGE_ESP32_CONVERT_PATH;
    const placementStagePath = selection.placement?.path || EDGE_ESP32_PATH;
    const shouldUseGenericConvert = Boolean(selection.placement && sourceType && destinationType);
    const endpoint = shouldUseGenericConvert
      ? `http://${selection.node.host}:${selection.node.port}${placementConvertPath}`
      : `http://${selection.node.host}:${selection.node.port}${placementStagePath}`;

    const queryParams = new URLSearchParams({
      inputQueue: String(inputQueue || ''),
      message: String(message || ''),
      runRouter: runRouter ? '1' : '0',
      convertMtToXml: convertMtToXml ? '1' : '0',
      file: selection.placement?.file || EDGE_ESP32_ROUTER_FILE,
      programMap: selection.placement?.programMap || EDGE_ESP32_PROGRAM_MAP
    });

    if (shouldUseGenericConvert) {
      queryParams.set('sourceType', String(sourceType || ''));
      queryParams.set('destinationType', String(destinationType || ''));
      queryParams.set('requireDelivery', '1');
      queryParams.set('maxBytes', String(selection.placement?.maxMessageBytes || EDGE_ESP32_LARGE_MESSAGE_THRESHOLD_BYTES * 8));
    }

    if (selection.placement?.id) {
      markPlacementInflight(selection.placement.id, +1);
    }
    const responseUrl = `${endpoint}?${queryParams.toString()}`;
    const queryResponse = await fetch(responseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal
    });
    if (!queryResponse.ok) {
      throw new Error(`edge endpoint status=${queryResponse.status}`);
    }
    const result = await queryResponse.json();
    const latencyMs = Math.max(0, performance.now() - startMs);
    recordEdgeOffloadAttemptResult({
      ok: true,
      fallbackUsed: false,
      latencyMs,
      result: {
        mode: 'edge',
        messageType: result?.messageType || null,
        publishedCount: Number(result?.publishedCount || 0),
        selectedRole: selection.selectedRole,
        strategy: selection.strategy,
        mapKey: selection.mapSelection?.mapKey || null,
        placementId: selection.placement?.id || null
      }
    });
    return {
      ok: true,
      edgeNode: selection.node.label,
      edgeRole: selection.selectedRole,
      edgeRoleRequested: selection.requestedRole,
      edgeStrategy: selection.strategy,
      estimatedMessageBytes: selection.estimatedMessageBytes,
      mapSelection: selection.mapSelection,
      placementId: selection.placement?.id || null,
      latencyMs,
      result
    };
  } catch (error) {
    const latencyMs = Math.max(0, performance.now() - startMs);
    recordEdgeOffloadAttemptResult({
      ok: false,
      fallbackUsed: false,
      latencyMs,
      error,
      result: { mode: 'fallback-ready' }
    });
    return {
      ok: false,
      edgeNode: selection.node.label,
      edgeRole: selection.selectedRole,
      edgeRoleRequested: selection.requestedRole,
      edgeStrategy: selection.strategy,
      estimatedMessageBytes: selection.estimatedMessageBytes,
      mapSelection: selection.mapSelection,
      placementId: selection.placement?.id || null,
      latencyMs,
      error
    };
  } finally {
    if (selection.placement?.id) {
      markPlacementInflight(selection.placement.id, -1);
    }
    clearTimeout(timeout);
  }
}

async function ingestWithEdgeFallback({
  inputQueue,
  message,
  sourceService = 'webapi',
  forceEdge = false,
  convertMtToXml = false,
  preferredEdgeRole = null,
  mapKey = null,
  sourceType = null,
  destinationType = null
} = {}) {
  async function enqueueToSingleQueue(singleMessage, envelope, sourceSuffix = 'single-queue') {
    const queueName = String(inputQueue || '').trim();
    if (!queueName) {
      throw new Error('inputQueue is required for single-queue ingest');
    }
    const route = ensureRoute(queueName);
    if (!route) {
      throw new Error(`No available queue managers for queue ${queueName}`);
    }
    const delivery = await enqueueViaRoute(
      route,
      queueName,
      singleMessage,
      `${sourceService}:${sourceSuffix}`,
      envelope,
      inferQueueDataTypeIds(queueName)
    );
    return {
      inputQueue: queueName,
      sourceService,
      matchedRuleCount: 1,
      publishedCount: 1,
      deliveries: [{ queueName, delivery }]
    };
  }

  const shouldUseEdge = Boolean(EDGE_ESP32_ENABLED && (EDGE_ESP32_AUTO_INGEST || forceEdge));
  if (!shouldUseEdge) {
    const fallbackEnvelope = buildEdgeEnvelopeMeta({
      edgeProcessed: false,
      edgeFallback: false,
      edgeNode: EDGE_ESP32_DEFAULT_NODE.label,
      edgeLatencyMs: 0
    });
    const result = await enqueueToSingleQueue(message, fallbackEnvelope, 'single-queue-local');
    return { mode: 'local', edge: { attempted: false, ...fallbackEnvelope }, result };
  }

  const edgeAttempt = await invokeEsp32EdgeIngressStage({
    inputQueue,
    message,
    runRouter: true,
    convertMtToXml,
    preferredEdgeRole,
    mapKey,
    sourceType,
    destinationType
  });
  if (edgeAttempt.ok) {
    const edgeResult = edgeAttempt.result || {};
    const deliveries = Array.isArray(edgeResult.deliveries) ? edgeResult.deliveries : [];
    const edgeEnvelope = buildEdgeEnvelopeMeta({
      edgeProcessed: true,
      edgeFallback: false,
      edgeNode: edgeAttempt.edgeNode,
      edgeLatencyMs: edgeAttempt.latencyMs,
      edgeMessageType: edgeResult?.messageType || null,
      edgePublishedCount: Number(edgeResult?.publishedCount || deliveries.length || 0)
    });
    const singleQueueMessage = edgeResult?.normalizedMessage || message;
    const localResult = await enqueueToSingleQueue(singleQueueMessage, edgeEnvelope, 'single-queue-edge');
    return {
      mode: 'edge+single-queue',
      edge: {
        ...edgeEnvelope,
        edgeRole: edgeAttempt.edgeRole,
        edgeRoleRequested: edgeAttempt.edgeRoleRequested,
        edgeStrategy: edgeAttempt.edgeStrategy,
        estimatedMessageBytes: edgeAttempt.estimatedMessageBytes,
        mapSelection: edgeAttempt.mapSelection || null,
        placementId: edgeAttempt.placementId || null
      },
      result: localResult
    };
  }

  const fallbackEnvelope = buildEdgeEnvelopeMeta({
    edgeProcessed: false,
    edgeFallback: true,
    edgeNode: edgeAttempt.edgeNode,
    edgeLatencyMs: edgeAttempt.latencyMs
  });
  const fallbackResult = await enqueueToSingleQueue(message, fallbackEnvelope, 'single-queue-fallback');
  recordEdgeOffloadAttemptResult({
    ok: false,
    fallbackUsed: true,
    latencyMs: edgeAttempt.latencyMs,
    result: {
      mode: 'fallback-local-router',
      edgeError: edgeAttempt.error?.message || null
    }
  });
  return {
    mode: 'local-fallback',
    edge: {
      ...fallbackEnvelope,
      edgeRole: edgeAttempt.edgeRole,
      edgeRoleRequested: edgeAttempt.edgeRoleRequested,
      edgeStrategy: edgeAttempt.edgeStrategy,
      estimatedMessageBytes: edgeAttempt.estimatedMessageBytes,
      mapSelection: edgeAttempt.mapSelection || null,
      placementId: edgeAttempt.placementId || null,
      edgeError: edgeAttempt.error?.message || String(edgeAttempt.error || '')
    },
    result: fallbackResult
  };
}

function getStep3LatencySummary({ recentLimit = 10 } = {}) {
  const samples = step3LatencyTracker.samples;
  const latencies = samples
    .map(s => Number(s?.latencyMs))
    .filter(v => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  const count = latencies.length;
  const sum = latencies.reduce((acc, value) => acc + value, 0);
  const avgMs = count > 0 ? Math.round(sum / count) : null;
  const recent = samples.slice(-Math.max(1, Number(recentLimit) || 10));

  return {
    enabled: true,
    definition: `${STEP3_INGRESS_QUEUE} enqueue to first ${STEP3_TARGET_QUEUE} enqueue`,
    sampleCount: count,
    pendingTracked: step3LatencyTracker.pendingByTxId.size,
    avgMs,
    minMs: count > 0 ? latencies[0] : null,
    p50Ms: percentileFromSorted(latencies, 0.5),
    p95Ms: percentileFromSorted(latencies, 0.95),
    p99Ms: percentileFromSorted(latencies, 0.99),
    maxMs: count > 0 ? latencies[count - 1] : null,
    lastUpdatedAt: step3LatencyTracker.lastUpdatedAt,
    lastSample: step3LatencyTracker.lastSample,
    recentSamples: recent
  };
}

function createDefaultUserManagement() {
  return {
    bootstrapVersion: AUTH_BOOTSTRAP_VERSION,
    version: 1,
    updatedAt: new Date().toISOString(),
    profiles: [
      {
        profileId: ROLE_PULSE_SYSTEM_ADMIN,
        label: 'ROLE-PULSE-SYSTEM-ADMIN',
        description: 'System-wide access to all screens except user administration.',
        permissions: [...SYSTEM_ADMIN_PERMISSIONS]
      },
      {
        profileId: ROLE_PULSE_USER_ADMIN,
        label: 'ROLE-PULSE-USER-ADMIN',
        description: 'User administration only. Create-user actions require approval by a second user admin.',
        permissions: [...USER_ADMIN_PERMISSIONS]
      }
    ],
    users: [
      {
        userId: AUTH_SYSTEM_ADMIN_USER_ID,
        email: null,
        displayName: 'SystemAdmin',
        enabled: true,
        profileIds: [ROLE_PULSE_SYSTEM_ADMIN],
        groupIds: [],
        employer: USER_ORGANIZATION_NAME,
        department: 'Operations',
        jobTitle: 'System Administrator',
        officeLocation: 'HQ',
        country: null,
        managerEmail: null,
        auth: createPasswordRecord(AUTH_SYSTEM_ADMIN_PASSWORD)
      },
      {
        userId: AUTH_USER_ADMIN_LHS_USER_ID,
        email: null,
        displayName: 'UserAdminLHS',
        enabled: true,
        profileIds: [ROLE_PULSE_USER_ADMIN],
        groupIds: [],
        employer: USER_ORGANIZATION_NAME,
        department: 'Identity Administration',
        jobTitle: 'User Administrator',
        officeLocation: 'HQ',
        country: null,
        managerEmail: null,
        auth: createPasswordRecord(AUTH_USER_ADMIN_LHS_PASSWORD)
      },
      {
        userId: AUTH_USER_ADMIN_RHS_USER_ID,
        email: null,
        displayName: 'UserAdminRHS',
        enabled: true,
        profileIds: [ROLE_PULSE_USER_ADMIN],
        groupIds: [],
        employer: USER_ORGANIZATION_NAME,
        department: 'Identity Administration',
        jobTitle: 'User Administrator',
        officeLocation: 'HQ',
        country: null,
        managerEmail: null,
        auth: createPasswordRecord(AUTH_USER_ADMIN_RHS_PASSWORD)
      }
    ]
  };
}

function sanitizePermissions(items) {
  const result = [];
  for (const value of Array.isArray(items) ? items : []) {
    const permission = String(value || '').trim();
    if (!permission) continue;
    if (!result.includes(permission)) result.push(permission);
  }
  return result;
}

function sanitizeProfileIds(items) {
  const result = [];
  for (const value of Array.isArray(items) ? items : []) {
    const profileId = String(value || '').trim();
    if (!profileId) continue;
    if (!result.includes(profileId)) result.push(profileId);
  }
  return result;
}

function sanitizeGroupIds(items) {
  const result = [];
  for (const value of Array.isArray(items) ? items : []) {
    const groupId = String(value || '').trim();
    if (!groupId) continue;
    if (!result.includes(groupId)) result.push(groupId);
  }
  return result;
}

function normalizeUserIdentifier(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('@')) return normalized;
  return normalized.replace(/[^a-z0-9]/g, '');
}

function isValidEmailIdentifier(value) {
  const input = normalizeUserIdentifier(value);
  if (!input) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function isAcceptedUserIdentifier(value) {
  const input = normalizeUserIdentifier(value);
  if (!input) return false;
  return input === DEFAULT_ACTOR_USER_ID
    || input === AUTH_USER_ADMIN_LHS_USER_ID
    || input === AUTH_USER_ADMIN_RHS_USER_ID
    || isValidEmailIdentifier(input)
    || /^[a-z0-9][a-z0-9._-]{2,127}$/.test(input);
}

function toTitleCaseFromEmail(email) {
  const local = String(email || '').split('@')[0] || '';
  if (!local) return 'Unknown User';
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function getDefaultDirectoryProfile(email) {
  return {
    displayName: toTitleCaseFromEmail(email),
    department: 'Operations',
    jobTitle: 'Operations Analyst',
    officeLocation: 'HQ',
    managerEmail: null
  };
}

async function lookupDirectoryProfile(email) {
  if (!USER_DIRECTORY_LOOKUP_URL || !isValidEmailIdentifier(email)) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(250, Number(USER_DIRECTORY_LOOKUP_TIMEOUT_MS) || 2500));
  try {
    const separator = USER_DIRECTORY_LOOKUP_URL.includes('?') ? '&' : '?';
    const url = `${USER_DIRECTORY_LOOKUP_URL}${separator}email=${encodeURIComponent(email)}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') return null;

    return {
      displayName: String(payload.displayName || payload.name || '').trim() || null,
      department: String(payload.department || '').trim() || null,
      jobTitle: String(payload.jobTitle || payload.title || '').trim() || null,
      officeLocation: String(payload.officeLocation || payload.location || '').trim() || null,
      managerEmail: isValidEmailIdentifier(payload.managerEmail)
        ? normalizeUserIdentifier(payload.managerEmail)
        : null
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveDirectoryProfile(email) {
  const fallback = getDefaultDirectoryProfile(email);
  const directory = await lookupDirectoryProfile(email);
  if (!directory) return fallback;
  return {
    displayName: directory.displayName || fallback.displayName,
    department: directory.department || fallback.department,
    jobTitle: directory.jobTitle || fallback.jobTitle,
    officeLocation: directory.officeLocation || fallback.officeLocation,
    managerEmail: directory.managerEmail || fallback.managerEmail
  };
}

function sanitizeAuthRecord(authRecord) {
  if (!authRecord || typeof authRecord !== 'object') return null;
  const algorithm = String(authRecord.algorithm || 'scrypt').trim().toLowerCase();
  const salt = String(authRecord.salt || '').trim();
  const hash = String(authRecord.hash || '').trim();
  if (!salt || !hash) return null;
  return {
    algorithm: algorithm || 'scrypt',
    salt,
    hash,
    createdAt: String(authRecord.createdAt || '').trim() || new Date().toISOString(),
    updatedAt: String(authRecord.updatedAt || '').trim() || new Date().toISOString()
  };
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return {
    algorithm: 'scrypt',
    salt,
    hash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function verifyPasswordRecord(password, authRecord) {
  if (!authRecord || authRecord.algorithm !== 'scrypt') return false;
  const salt = String(authRecord.salt || '').trim();
  const expectedHashHex = String(authRecord.hash || '').trim();
  if (!salt || !expectedHashHex) return false;
  try {
    const derived = crypto.scryptSync(String(password || ''), salt, 64);
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function sanitizeUserForApi(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    userId: user.userId,
    email: user.email || null,
    displayName: user.displayName || user.userId,
    enabled: user.enabled !== false,
    profileIds: sanitizeProfileIds(user.profileIds),
    groupIds: sanitizeGroupIds(user.groupIds),
    employer: user.employer || USER_ORGANIZATION_NAME,
    department: user.department || 'Operations',
    jobTitle: user.jobTitle || 'System Administrator',
    officeLocation: user.officeLocation || 'HQ',
    country: user.country || null,
    managerEmail: user.managerEmail || null
  };
}

function normalizeUserManagement(raw) {
  const fallback = createDefaultUserManagement();
  const profiles = Array.isArray(raw?.profiles) ? raw.profiles : fallback.profiles;
  const users = Array.isArray(raw?.users) ? raw.users : fallback.users;

  const normalizedProfiles = profiles
    .map(profile => ({
      profileId: String(profile?.profileId || '').trim(),
      label: String(profile?.label || profile?.profileId || '').trim(),
      description: String(profile?.description || '').trim(),
      permissions: sanitizePermissions(profile?.permissions)
    }))
    .filter(profile => profile.profileId);

  const normalizedUsers = users
    .map(user => ({
      userId: normalizeUserIdentifier(user?.userId || user?.email),
      email: isValidEmailIdentifier(user?.email || user?.userId)
        ? normalizeUserIdentifier(user?.email || user?.userId)
        : null,
      displayName: String(user?.displayName || user?.userId || '').trim(),
      enabled: user?.enabled !== false,
      profileIds: sanitizeProfileIds(user?.profileIds),
      groupIds: sanitizeGroupIds(user?.groupIds),
      employer: String(user?.employer || user?.organization || user?.company || USER_ORGANIZATION_NAME).trim() || USER_ORGANIZATION_NAME,
      department: String(user?.department || 'Operations').trim() || 'Operations',
      jobTitle: String(user?.jobTitle || user?.title || 'System Administrator').trim() || 'System Administrator',
      officeLocation: String(user?.officeLocation || user?.location || 'HQ').trim() || 'HQ',
      country: String(user?.country || user?.countryCode || '').trim() || null,
      managerEmail: isValidEmailIdentifier(user?.managerEmail)
        ? normalizeUserIdentifier(user?.managerEmail)
        : null,
      auth: sanitizeAuthRecord(user?.auth)
    }))
    .filter(user => user.userId);

  return {
    bootstrapVersion: Number(raw?.bootstrapVersion || 0),
    version: Number(raw?.version || 1),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
    profiles: normalizedProfiles,
    users: normalizedUsers
  };
}

function loadUserManagement() {
  try {
    if (!fs.existsSync(USER_MANAGEMENT_PATH)) {
      const defaultStore = createDefaultUserManagement();
      fs.writeFileSync(USER_MANAGEMENT_PATH, `${JSON.stringify(defaultStore, null, 2)}\n`, 'utf-8');
      return normalizeUserManagement(defaultStore);
    }

    const rawText = fs.readFileSync(USER_MANAGEMENT_PATH, 'utf-8');
    const parsed = rawText.trim() ? JSON.parse(rawText) : createDefaultUserManagement();
    return normalizeUserManagement(parsed);
  } catch (e) {
    console.warn(`[AUTHZ] Failed loading user management file: ${e.message}`);
    return normalizeUserManagement(createDefaultUserManagement());
  }
}

let userManagementStore = loadUserManagement();

function ensureBootstrapUserManagement() {
  if (Number(userManagementStore.bootstrapVersion || 0) >= AUTH_BOOTSTRAP_VERSION) {
    return;
  }

  const bootstrapStore = createDefaultUserManagement();

  for (const bootstrapProfile of bootstrapStore.profiles) {
    const existingProfile = userManagementStore.profiles.find((profile) => profile.profileId === bootstrapProfile.profileId);
    if (!existingProfile) {
      userManagementStore.profiles.push({ ...bootstrapProfile });
      continue;
    }

    existingProfile.label = bootstrapProfile.label;
    existingProfile.description = bootstrapProfile.description;
    existingProfile.permissions = [...bootstrapProfile.permissions];
  }

  for (const bootstrapUser of bootstrapStore.users) {
    const existingUser = userManagementStore.users.find((user) => user.userId === bootstrapUser.userId);
    if (!existingUser) {
      userManagementStore.users.push({ ...bootstrapUser });
      continue;
    }

    existingUser.email = bootstrapUser.email || null;
    existingUser.displayName = bootstrapUser.displayName;
    existingUser.enabled = true;
    existingUser.profileIds = [...bootstrapUser.profileIds];
    existingUser.groupIds = [...bootstrapUser.groupIds];
    existingUser.employer = bootstrapUser.employer;
    existingUser.department = bootstrapUser.department;
    existingUser.jobTitle = bootstrapUser.jobTitle;
    existingUser.officeLocation = bootstrapUser.officeLocation;
    existingUser.country = bootstrapUser.country;
    existingUser.managerEmail = bootstrapUser.managerEmail;
    existingUser.auth = bootstrapUser.auth;
  }

  userManagementStore.bootstrapVersion = AUTH_BOOTSTRAP_VERSION;
  saveUserManagement();
}

ensureBootstrapUserManagement();
const authSessionStore = new Map();

function createAuthSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  authSessionStore.set(token, {
    token,
    userId: String(userId || '').trim(),
    createdAt: now,
    expiresAt: now + AUTH_SESSION_TTL_MS
  });
  return token;
}

function getSessionFromToken(token) {
  const key = String(token || '').trim();
  if (!key) return null;
  const session = authSessionStore.get(key);
  if (!session) return null;
  if (Date.now() > Number(session.expiresAt || 0)) {
    authSessionStore.delete(key);
    return null;
  }
  return session;
}

function clearSessionFromToken(token) {
  const key = String(token || '').trim();
  if (!key) return false;
  return authSessionStore.delete(key);
}

function getBearerTokenFromRequest(req) {
  const raw = String(req.get('authorization') || '').trim();
  if (!raw) return '';
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || '').trim() : '';
}

function getSessionUserIdFromRequest(req) {
  const token = getBearerTokenFromRequest(req);
  const session = getSessionFromToken(token);
  if (!session) return '';
  return String(session.userId || '').trim();
}

function cleanupExpiredAuthSessions() {
  const now = Date.now();
  for (const [token, session] of authSessionStore.entries()) {
    if (now > Number(session.expiresAt || 0)) {
      authSessionStore.delete(token);
    }
  }
}

setInterval(cleanupExpiredAuthSessions, 60 * 1000);

let groupProvider;
try {
  groupProvider = createGroupProvider({
    provider: GROUP_PROVIDER,
    filePath: USER_GROUPS_PATH,
    mssql: {
      connectionString: GROUP_MSSQL_CONNECTION_STRING,
      tableName: GROUP_MSSQL_TABLE
    }
  });
  console.log(`[GROUPS] Provider: ${GROUP_PROVIDER}`);
} catch (e) {
  console.warn(`[GROUPS] Failed initializing provider ${GROUP_PROVIDER}: ${e.message}. Falling back to file provider.`);
  groupProvider = createGroupProvider({ provider: 'file', filePath: USER_GROUPS_PATH });
}

const groupPrivilegeCache = {
  loadedAt: null,
  groupsById: new Map()
};

async function refreshGroupPrivilegeCache() {
  try {
    const groups = await groupProvider.listGroups({ includeDeleted: false });
    const next = new Map();
    for (const group of Array.isArray(groups) ? groups : []) {
      const groupId = String(group?.groupId || '').trim();
      if (!groupId) continue;
      next.set(groupId, {
        groupId,
        label: String(group?.label || groupId).trim(),
        privileges: Array.isArray(group?.privileges) ? group.privileges.map(value => String(value || '').trim()).filter(Boolean) : []
      });
    }
    groupPrivilegeCache.groupsById = next;
    groupPrivilegeCache.loadedAt = new Date().toISOString();
  } catch (e) {
    console.warn(`[GROUPS] Failed refreshing group cache: ${e.message}`);
  }
}

refreshGroupPrivilegeCache();
setInterval(refreshGroupPrivilegeCache, Math.max(5000, Number(GROUP_CACHE_REFRESH_MS) || 60000));

let monitorClassProvider;
try {
  monitorClassProvider = createMonitorClassProvider({
    provider: MONITOR_CLASS_PROVIDER,
    filePath: MONITOR_CLASSES_PATH
  });
  console.log(`[MONITOR-CLASSES] Provider: ${MONITOR_CLASS_PROVIDER}`);
} catch (e) {
  console.warn(`[MONITOR-CLASSES] Failed initializing provider ${MONITOR_CLASS_PROVIDER}: ${e.message}. Falling back to file provider.`);
  monitorClassProvider = createMonitorClassProvider({ provider: 'file', filePath: MONITOR_CLASSES_PATH });
}

function saveUserManagement() {
  userManagementStore.updatedAt = new Date().toISOString();
  fs.writeFileSync(USER_MANAGEMENT_PATH, `${JSON.stringify(userManagementStore, null, 2)}\n`, 'utf-8');
}

function createDefaultProcessGovernance() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    processes: [
      {
        processId: 'queue-control',
        label: 'Queue Control Operations',
        requiresTwoPersonRule: true,
      },
      {
        processId: 'broker-control',
        label: 'Broker Operations',
        requiresTwoPersonRule: true,
      },
      {
        processId: 'payment-authorization',
        label: 'Payment Authorization Flow',
        requiresTwoPersonRule: true,
      },
      {
        processId: 'gateway-control',
        label: 'Gateway Operations',
        requiresTwoPersonRule: false,
      },
      {
        processId: 'routing-control',
        label: 'Routing Rules Management',
        requiresTwoPersonRule: false,
      },
      {
        processId: 'identity-control',
        label: 'Identity and Profile Management',
        requiresTwoPersonRule: true,
      }
    ]
  };
}

function normalizeProcessGovernance(raw) {
  const fallback = createDefaultProcessGovernance();
  const processes = Array.isArray(raw?.processes) ? raw.processes : fallback.processes;
  const normalizedProcesses = processes
    .map(item => ({
      processId: String(item?.processId || '').trim(),
      label: String(item?.label || item?.processId || '').trim(),
      requiresTwoPersonRule: item?.requiresTwoPersonRule === true
    }))
    .filter(item => item.processId);

  for (const required of fallback.processes) {
    if (!normalizedProcesses.some(item => item.processId === required.processId)) {
      normalizedProcesses.push(required);
    }
  }

  return {
    version: Number(raw?.version || 1),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
    processes: normalizedProcesses
  };
}

function loadProcessGovernance() {
  try {
    if (!fs.existsSync(PROCESS_GOVERNANCE_PATH)) {
      const defaultStore = createDefaultProcessGovernance();
      fs.writeFileSync(PROCESS_GOVERNANCE_PATH, `${JSON.stringify(defaultStore, null, 2)}\n`, 'utf-8');
      return normalizeProcessGovernance(defaultStore);
    }

    const rawText = fs.readFileSync(PROCESS_GOVERNANCE_PATH, 'utf-8');
    const parsed = rawText.trim() ? JSON.parse(rawText) : createDefaultProcessGovernance();
    return normalizeProcessGovernance(parsed);
  } catch (e) {
    console.warn(`[GOVERNANCE] Failed loading process governance file: ${e.message}`);
    return normalizeProcessGovernance(createDefaultProcessGovernance());
  }
}

let processGovernanceStore = loadProcessGovernance();

function saveProcessGovernance() {
  processGovernanceStore.updatedAt = new Date().toISOString();
  fs.writeFileSync(PROCESS_GOVERNANCE_PATH, `${JSON.stringify(processGovernanceStore, null, 2)}\n`, 'utf-8');
}

function getProcessPolicyById(processId) {
  const key = String(processId || '').trim();
  if (!key) return null;
  return processGovernanceStore.processes.find(item => item.processId === key) || null;
}

const requestPolicyApi = createRequestPolicyApi({ requireHttps: REQUIRE_HTTPS });

function applyRequestSecurityHeaders(req, res, next) {
  return requestPolicyApi.applyRequestSecurityHeaders(req, res, next);
}

function enforceHttpsTransport(req, res, next) {
  return requestPolicyApi.enforceHttpsTransport(req, res, next);
}

function stableStringify(value) {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf-8').digest('hex');
}

function redactSensitiveValue(value, depth = 0) {
  if (depth > 4) return '[max-depth]';
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(item => redactSensitiveValue(item, depth + 1));
  if (typeof value !== 'object') return value;

  const result = {};
  const sensitiveKeyPattern = /(password|token|secret|authorization|api[-_]?key|private[-_]?key)/i;
  for (const [key, itemValue] of Object.entries(value)) {
    if (sensitiveKeyPattern.test(key)) {
      result[key] = '[redacted]';
      continue;
    }
    result[key] = redactSensitiveValue(itemValue, depth + 1);
  }
  return result;
}

function sanitizeQueryForAudit(query) {
  if (!query || typeof query !== 'object') return {};
  const copy = { ...query };
  if (Object.prototype.hasOwnProperty.call(copy, 'userId')) {
    copy.userId = '[redacted]';
  }
  return redactSensitiveValue(copy);
}

function loadAuditChainHead() {
  try {
    if (!fs.existsSync(AUDIT_LOG_PATH)) return 'GENESIS';
    const rawText = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
    const lines = rawText.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return 'GENESIS';
    const lastEvent = JSON.parse(lines[lines.length - 1]);
    return String(lastEvent.chainHash || 'GENESIS');
  } catch {
    return 'GENESIS';
  }
}

auditChainHead = loadAuditChainHead();

function appendAuditEvent(event) {
  const timestamp = new Date().toISOString();
  const entry = {
    ...event,
    timestamp,
    previousChainHash: auditChainHead
  };
  const chainHash = hashText(`${auditChainHead}:${stableStringify(entry)}`);
  entry.chainHash = chainHash;
  fs.appendFileSync(AUDIT_LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf-8');
  auditChainHead = chainHash;
}

function auditApiRequest(req, res, next) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  req.requestId = requestId;

  res.on('finish', () => {
    const actor = req.actor || resolveActor(req);
    appendAuditEvent({
      eventType: 'api-request',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      actorUserId: actor.userId,
      actorKnown: Boolean(actor.user),
      ip: req.ip,
      processId: req.governedProcessId || null,
      approvalId: req.approvalContext?.approvalId || null,
      approvedByUserId: req.approvalContext?.approvedByUserId || null,
      query: sanitizeQueryForAudit(req.query),
      body: redactSensitiveValue(req.body)
    });
  });

  next();
}

function resolveGovernedProcessId(req) {
  const path = String(req.path || '').trim();
  const explicit = String(req.body?.processId || req.query?.processId || '').trim();
  if (explicit && getProcessPolicyById(explicit)) {
    return explicit;
  }

  if (path.startsWith('/api/registry/queue-managers')
    || path.startsWith('/api/registry/databases')
    || path.startsWith('/api/local-queue-managers')
    || path.startsWith('/api/remote-queue-managers')
    || path.startsWith('/api/queues')
    || path.startsWith('/api/queue/')) {
    return 'queue-control';
  }

  if (path.startsWith('/api/broker')) {
    return 'broker-control';
  }

  if (path.startsWith('/api/lifecycle')) {
    return 'payment-authorization';
  }

  if (path.startsWith('/api/gateways')) {
    return 'gateway-control';
  }

  if (path.startsWith('/api/router')) {
    return 'routing-control';
  }

  if (path === '/api/users' && String(req.method || 'GET').toUpperCase() === 'POST') {
    return 'identity-control';
  }

  return null;
}

function createGovernedActionFingerprint(req, processId) {
  const payload = {
    processId,
    method: String(req.method || '').toUpperCase(),
    path: String(req.path || ''),
    params: req.params || {},
    query: sanitizeQueryForAudit(req.query),
    body: redactSensitiveValue(req.body)
  };
  return hashText(stableStringify(payload));
}

function enforceTwoPersonRule(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  if (!String(req.path || '').startsWith('/api/')) {
    return next();
  }

  if (String(req.path || '').startsWith('/api/authz/me')) {
    return next();
  }

  // Allow enqueue/dequeue without two-person rule for testing
  if (String(req.path || '').match(/^\/api\/queue\/[^/]+\/(enqueue|dequeue)$/)) {
    return next();
  }

  const processId = resolveGovernedProcessId(req);
  req.governedProcessId = processId;
  if (!processId) {
    return next();
  }

  const policy = getProcessPolicyById(processId);
  if (!policy || policy.requiresTwoPersonRule !== true) {
    return next();
  }

  const actor = req.actor || resolveActor(req);
  req.actor = actor;
  if (!actor.user || actor.user.enabled === false) {
    return res.status(401).json({
      error: 'Known enabled user is required for two-person-controlled actions',
      processId
    });
  }

  if (AUTO_APPROVE_USER_IDS.has(normalizeUserIdentifier(actor.userId))) {
    req.approvalContext = {
      approvalId: `auto-${Date.now()}`,
      processId,
      requestedByUserId: actor.userId,
      approvedByUserId: actor.userId,
      selfApproved: true,
      autoApproved: true
    };
    appendAuditEvent({
      eventType: 'approval-auto-approved',
      requestId: req.requestId || null,
      processId,
      userId: actor.userId,
      method: String(req.method).toUpperCase(),
      path: req.path,
      note: 'Two-person rule bypassed via AUTO_APPROVE_USER_IDS'
    });
    return next();
  }

  // Self-approve bypass: user must have explicit broker.self-approve permission
  const selfApprove = req.body?.selfApprove === true || req.get('x-self-approve') === 'true';
  if (selfApprove) {
    const selfApproveAllowed = actor.permissions?.includes('*') ||
      actor.permissions?.includes('broker.self-approve');
    if (!selfApproveAllowed) {
      return res.status(403).json({
        error: 'Self-approval requires broker.self-approve permission',
        processId
      });
    }
    req.approvalContext = {
      approvalId: `self-${Date.now()}`,
      processId,
      requestedByUserId: actor.userId,
      approvedByUserId: actor.userId,
      selfApproved: true
    };
    appendAuditEvent({
      eventType: 'approval-self-approved',
      requestId: req.requestId || null,
      processId,
      userId: actor.userId,
      method: String(req.method).toUpperCase(),
      path: req.path,
      note: 'Two-person rule bypassed via self-approve'
    });
    return next();
  }

  const fingerprint = createGovernedActionFingerprint(req, processId);
  const approvalId = String(req.get('x-approval-id') || req.body?.approvalId || req.query?.approvalId || '').trim();
  if (!approvalId) {
    const generatedApprovalId = `apr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = Date.now() + APPROVAL_TTL_MS;
    pendingApprovalRequests.set(generatedApprovalId, {
      approvalId: generatedApprovalId,
      processId,
      fingerprint,
      requestedByUserId: actor.userId,
      requestedAt: new Date().toISOString(),
      expiresAt,
      method,
      path: req.path,
      body: redactSensitiveValue(req.body)
    });

    appendAuditEvent({
      eventType: 'approval-requested',
      requestId: req.requestId || null,
      approvalId: generatedApprovalId,
      processId,
      requestedByUserId: actor.userId,
      expiresAt: new Date(expiresAt).toISOString(),
      method,
      path: req.path
    });

    return res.status(202).json({
      status: 'approval-required',
      processId,
      approvalId: generatedApprovalId,
      requestedByUserId: actor.userId,
      expiresAt: new Date(expiresAt).toISOString(),
      message: 'Second authorized user must replay the same request with x-approval-id.'
    });
  }

  const approval = pendingApprovalRequests.get(approvalId);
  if (!approval) {
    return res.status(409).json({
      error: 'Approval request not found',
      processId,
      approvalId
    });
  }

  if (Date.now() > Number(approval.expiresAt || 0)) {
    pendingApprovalRequests.delete(approvalId);
    return res.status(410).json({
      error: 'Approval request expired',
      processId,
      approvalId
    });
  }

  if (approval.processId !== processId || approval.fingerprint !== fingerprint) {
    return res.status(409).json({
      error: 'Approval request does not match this action payload',
      processId,
      approvalId
    });
  }

  if (approval.requestedByUserId === actor.userId) {
    return res.status(403).json({
      error: 'Second approver must be a different user',
      processId,
      approvalId,
      requestedByUserId: approval.requestedByUserId
    });
  }

  req.approvalContext = {
    approvalId,
    processId,
    requestedByUserId: approval.requestedByUserId,
    approvedByUserId: actor.userId
  };

  res.on('finish', () => {
    if (res.statusCode < 400) {
      pendingApprovalRequests.delete(approvalId);
      appendAuditEvent({
        eventType: 'approval-executed',
        requestId: req.requestId || null,
        approvalId,
        processId,
        requestedByUserId: approval.requestedByUserId,
        approvedByUserId: actor.userId,
        statusCode: res.statusCode,
        method,
        path: req.path
      });
    }
  });

  return next();
}

function getProfilesById() {
  return new Map(userManagementStore.profiles.map(profile => [profile.profileId, profile]));
}

function parseHeaderGroupIds(req) {
  if (!TRUST_HEADER_GROUPS) return [];
  const raw = String(req.get('x-user-groups') || '').trim();
  if (!raw) return [];
  return sanitizeGroupIds(raw.split(',').map(value => value.trim()));
}

function resolveEffectiveAccessForUser(userId, { headerGroupIds = [] } = {}) {
  const user = getUserById(userId);
  if (!user || user.enabled === false) {
    return { user: null, profileIds: [], groupIds: [], permissions: [], toxicRoleViolations: [], iamSource: process.env.IAM_SOURCE || 'local' };
  }

  const profilesById = getProfilesById();
  const knownProfileIds = new Set(userManagementStore.profiles.map(profile => profile.profileId));
  const effectiveGroupIds = sanitizeGroupIds([...(user.groupIds || []), ...(headerGroupIds || [])]);
  const derivedProfileIds = new Set();
  const directGroupPermissions = new Set();

  for (const groupId of effectiveGroupIds) {
    const group = groupPrivilegeCache.groupsById.get(groupId);
    if (!group) continue;
    for (const privilegeRaw of group.privileges || []) {
      const privilege = String(privilegeRaw || '').trim();
      if (!privilege) continue;
      const lower = privilege.toLowerCase();
      if (lower.startsWith('profile:') || lower.startsWith('role:')) {
        const profileId = privilege.split(':').slice(1).join(':').trim();
        if (profileId && knownProfileIds.has(profileId)) derivedProfileIds.add(profileId);
        continue;
      }
      if (knownProfileIds.has(privilege)) {
        derivedProfileIds.add(privilege);
        continue;
      }
      directGroupPermissions.add(privilege);
    }
  }

  const effectiveProfileIds = sanitizeProfileIds([...(user.profileIds || []), ...Array.from(derivedProfileIds)]);
  const toxicRoleViolations = detectToxicRoleViolations(effectiveProfileIds);
  const permissions = [];
  for (const profileId of effectiveProfileIds) {
    const profile = profilesById.get(profileId);
    if (!profile) continue;
    for (const permission of profile.permissions || []) {
      if (!permissions.includes(permission)) permissions.push(permission);
    }
  }
  for (const permission of directGroupPermissions) {
    if (!permissions.includes(permission)) permissions.push(permission);
  }

  const effectivePermissions = toxicRoleViolations.length > 0 ? [] : permissions;

  return {
    user,
    profileIds: effectiveProfileIds,
    groupIds: effectiveGroupIds,
    permissions: effectivePermissions,
    toxicRoleViolations,
    iamSource: process.env.IAM_SOURCE || 'local'
  };
}

function getUserById(userId) {
  const key = normalizeUserIdentifier(userId);
  if (!key) return null;
  return userManagementStore.users.find(user => user.userId === key) || null;
}

function getEffectivePermissionsForUser(userId) {
  return resolveEffectiveAccessForUser(userId).permissions;
}

function deriveUserPersona({ user, permissions, profileLabels }) {
  const perms = Array.isArray(permissions) ? permissions : [];
  const labels = Array.isArray(profileLabels) ? profileLabels.map(v => String(v || '').toLowerCase()) : [];
  const title = String(user?.jobTitle || '').toLowerCase();
  const department = String(user?.department || '').toLowerCase();

  const signals = {
    isTechnical: false,
    isOperational: false,
    isProjectManager: false
  };

  if (perms.some(p => /^topology\.|^registry\.|^broker\.|^queue\./.test(String(p || '')))) {
    signals.isTechnical = true;
  }
  if (perms.some(p => /^lifecycle\.|^gateway\.|^router\.|^governance\./.test(String(p || '')))) {
    signals.isOperational = true;
  }
  if (perms.includes('users.manage') || perms.includes('governance.manage') || /project manager|program manager|pm\b/.test(title)) {
    signals.isProjectManager = true;
  }
  if (/engineering|platform|it|technology/.test(department)) signals.isTechnical = true;
  if (/operations|ops|payments|settlement/.test(department)) signals.isOperational = true;
  if (/project|program|portfolio/.test(department)) signals.isProjectManager = true;
  if (labels.some(label => /operator|operations/.test(label))) signals.isOperational = true;
  if (labels.some(label => /admin|configuration|configurator/.test(label))) signals.isTechnical = true;

  const entries = Object.entries(signals).filter(([, value]) => value);
  if (!entries.length) {
    return { kind: 'general', confidence: 0.45, signals };
  }

  const [strongest] = entries.sort((a, b) => Number(b[1]) - Number(a[1]));
  const labelToKind = {
    isTechnical: 'technical',
    isOperational: 'operational',
    isProjectManager: 'project-manager'
  };
  const confidence = entries.length > 1 ? 0.68 : 0.82;
  return { kind: labelToKind[strongest[0]] || 'general', confidence, signals };
}

function buildUserRoleContext(userId) {
  const user = getUserById(userId);
  if (!user || user.enabled === false) return null;

  const access = resolveEffectiveAccessForUser(user.userId);

  const profilesById = getProfilesById();
  const assignedProfiles = (access.profileIds || [])
    .map(profileId => profilesById.get(profileId))
    .filter(Boolean)
    .map(profile => ({
      profileId: profile.profileId,
      label: profile.label,
      description: profile.description
    }));
  const permissions = access.permissions || [];
  const profileLabels = assignedProfiles.map(profile => profile.label);
  const persona = deriveUserPersona({ user, permissions, profileLabels });

  return {
    userId: user.userId,
    displayName: user.displayName || user.userId,
    email: user.email || null,
    enabled: user.enabled !== false,
    employment: {
      employer: user.employer || USER_ORGANIZATION_NAME,
      department: user.department || null,
      jobTitle: user.jobTitle || null,
      officeLocation: user.officeLocation || null,
      country: user.country || null,
      managerEmail: user.managerEmail || null
    },
    roles: assignedProfiles,
    groups: access.groupIds || [],
    permissions,
    persona
  };
}

function hasPermission(userPermissions, requiredPermission) {
  if (!requiredPermission) return true;
  if (!Array.isArray(userPermissions)) return false;
  if (userPermissions.includes('*')) return true;
  if (userPermissions.includes(requiredPermission)) return true;

  const parts = String(requiredPermission).split('.');
  if (parts.length > 1) {
    const wildcard = `${parts[0]}.*`;
    if (userPermissions.includes(wildcard)) return true;
  }
  return false;
}

function resolveActor(req) {
  const tokenUserId = getSessionUserIdFromRequest(req);
  const headerUserId = String(req.get('x-user-id') || '').trim();
  const queryUserId = String(req.query?.userId || '').trim();
  const fallbackUserId = ALLOW_IMPLICIT_ADMIN ? DEFAULT_ACTOR_USER_ID : '';
  const actorUserId = tokenUserId || headerUserId || queryUserId || fallbackUserId;
  const headerGroupIds = parseHeaderGroupIds(req);
  const access = resolveEffectiveAccessForUser(actorUserId, { headerGroupIds });

  // Keep local admin access stable even when group/profile providers are degraded.
  if (String(actorUserId || '').toLowerCase() === String(DEFAULT_ACTOR_USER_ID || '').toLowerCase()) {
    const adminUser = access.user || {
      userId: DEFAULT_ACTOR_USER_ID,
      displayName: 'SystemAdmin',
      enabled: true,
      profileIds: [ROLE_PULSE_SYSTEM_ADMIN],
      groupIds: []
    };

    return {
      userId: DEFAULT_ACTOR_USER_ID,
      user: adminUser,
      permissions: Array.isArray(access.permissions) && access.permissions.length > 0 ? access.permissions : [...SYSTEM_ADMIN_PERMISSIONS],
      profileIds: Array.isArray(access.profileIds) && access.profileIds.length > 0 ? access.profileIds : [ROLE_PULSE_SYSTEM_ADMIN],
      groupIds: access.groupIds || []
    };
  }

  return {
    userId: actorUserId,
    user: access.user,
    permissions: access.permissions,
    profileIds: access.profileIds,
    groupIds: access.groupIds,
    toxicRoleViolations: access.toxicRoleViolations,
    iamSource: access.iamSource
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    const actor = resolveActor(req);
    req.actor = actor;
    const processId = resolveGovernedProcessId(req);
    const roleSignals = {
      hasTxnCreatorRole: Array.isArray(actor.profileIds) && actor.profileIds.includes('txn-creator'),
      hasTxnAuthorizerRole: Array.isArray(actor.profileIds) && actor.profileIds.includes('txn-authorizer')
    };

    const shouldAuditToxicDecision =
      String(req.path || '').startsWith('/api/') &&
      (processId === 'payment-authorization' || roleSignals.hasTxnCreatorRole || roleSignals.hasTxnAuthorizerRole);

    if (Array.isArray(actor.toxicRoleViolations) && actor.toxicRoleViolations.length > 0) {
      if (shouldAuditToxicDecision) {
        appendAuditEvent({
          eventType: 'toxic-role-decision',
          decision: 'denied',
          requestId: req.requestId || null,
          method: String(req.method || 'GET').toUpperCase(),
          path: req.path,
          processId,
          actorUserId: actor.userId,
          iamSource: actor.iamSource || process.env.IAM_SOURCE || 'local',
          requiredPermission: permission,
          toxicRoleViolations: actor.toxicRoleViolations
        });
      }

      return res.status(403).json({
        error: 'Toxic role combination detected',
        code: 'TOXIC_ROLE_COMBINATION',
        actorUserId: actor.userId,
        toxicRoleViolations: actor.toxicRoleViolations,
        requiredPermission: permission
      });
    }

    if (!actor.user) {
      return res.status(401).json({
        error: 'Unknown user',
        requiredPermission: permission,
        actorUserId: actor.userId
      });
    }

    if (actor.user.enabled === false) {
      return res.status(403).json({
        error: 'User is disabled',
        requiredPermission: permission,
        actorUserId: actor.userId
      });
    }

    if (!hasPermission(actor.permissions, permission)) {
      return res.status(403).json({
        error: 'Permission denied',
        requiredPermission: permission,
        actorUserId: actor.userId,
        actorPermissions: actor.permissions
      });
    }

    if (shouldAuditToxicDecision) {
      appendAuditEvent({
        eventType: 'toxic-role-decision',
        decision: 'approved',
        requestId: req.requestId || null,
        method: String(req.method || 'GET').toUpperCase(),
        path: req.path,
        processId,
        actorUserId: actor.userId,
        iamSource: actor.iamSource || process.env.IAM_SOURCE || 'local',
        requiredPermission: permission,
        roleSignals
      });
    }

    return next();
  };
}

function resolvePermissionForApiRequest(req) {
  return requestPolicyApi.resolvePermissionForApiRequest(req);
}

function enforceApiPermission(req, res, next) {
  const requestPath = String(req.path || '').trim();
  if (requestPath === '/api/auth/login'
    || requestPath === '/api/auth/logout'
    || requestPath === '/api/auth/session'
    || requestPath === '/api/authz/me') {
    return next();
  }

  return requestPolicyApi.enforceApiPermission(req, res, next, {
    resolveActor,
    requirePermission
  });
}

const EXPLICIT_QUEUE_TYPE_HINTS = {
  'swift.mt103.parsed': ['swift-mt103'],
  'correspondent.pacs008.outbound': ['pacs'],
  'lynx.pacs009.outbound': ['pacs'],
  'pacs.outbound': ['pacs']
};

function normalizeNodeId(value) {
  return (value || '').toString().trim();
}

function inferQueueDataTypeIds(queueName) {
  const normalizedName = String(queueName || '').trim().toLowerCase();
  if (!normalizedName) return ['text-string'];

  if (EXPLICIT_QUEUE_TYPE_HINTS[normalizedName]) {
    return EXPLICIT_QUEUE_TYPE_HINTS[normalizedName];
  }

  if (normalizedName.includes('pacs')) return ['pacs'];
  if (normalizedName.includes('mt103')) return ['swift-mt103'];
  if (normalizedName.includes('mt202cov')) return ['swift-mt202cov'];
  if (normalizedName.includes('mt202')) return ['swift-mt202'];

  return ['text-string'];
}

function detectMessageShape(message) {
  if (message == null) return 'null';
  if (typeof message === 'string') return 'string';
  if (Array.isArray(message)) return 'array';
  if (typeof message !== 'object') return typeof message;
  if (message.Document && typeof message.Document === 'object') return 'iso20022-document';
  if (message.finEnvelope && typeof message.finEnvelope === 'object') return 'swift-fin-envelope';
  return 'object';
}

function summarizeMessage(message) {
  try {
    const json = JSON.stringify(message);
    if (!json) return '';
    return json.length > 600 ? `${json.slice(0, 600)}...` : json;
  } catch {
    return '[unserializable-message]';
  }
}

function validateMessageAgainstDataType(typeId, message) {
  const normalizedType = String(typeId || '').trim().toLowerCase();
  if (!normalizedType || normalizedType === 'text-string') {
    return { valid: true };
  }

  if (normalizedType === 'pacs') {
    const ok = (
      message
      && typeof message === 'object'
      && message.Document
      && typeof message.Document === 'object'
    );
    return {
      valid: ok,
      reason: ok ? null : 'Expected ISO 20022 PACS object with top-level Document'
    };
  }

  if (normalizedType === 'swift-mt103') {
    const ok = (
      (typeof message === 'string' && message.toUpperCase().startsWith('MT103'))
      || (
        message
        && typeof message === 'object'
        && message.finEnvelope
        && message.finEnvelope.block4
        && message.finEnvelope.block4.fields
      )
    );
    return {
      valid: ok,
      reason: ok ? null : 'Expected MT103 string starting with MT103 or parsed swift finEnvelope.block4.fields'
    };
  }

  if (normalizedType === 'swift-mt202' || normalizedType === 'swift-mt202cov') {
    const prefix = normalizedType === 'swift-mt202cov' ? 'MT202COV' : 'MT202';
    const ok = (
      (typeof message === 'string' && message.toUpperCase().startsWith(prefix))
      || (
        message
        && typeof message === 'object'
        && message.finEnvelope
        && message.finEnvelope.block4
        && message.finEnvelope.block4.fields
      )
    );
    return {
      valid: ok,
      reason: ok ? null : `Expected ${prefix} string or parsed swift finEnvelope.block4.fields`
    };
  }

  return { valid: true };
}

function defaultFormatTokenForDataType(typeId) {
  const normalizedType = String(typeId || '').trim().toLowerCase();
  if (normalizedType === 'pacs') return 'pacs.unknown';
  if (normalizedType === 'swift-mt103') return 'mt103';
  if (normalizedType === 'swift-mt202') return 'mt202';
  if (normalizedType === 'swift-mt202cov') return 'mt202cov';
  return 'text';
}

function inferMediaTypeFromMessage(message) {
  if (Buffer.isBuffer(message)) return 'application/octet-stream';
  if (typeof message === 'string') return 'text/plain';
  if (message && typeof message === 'object') return 'application/json';
  return 'application/octet-stream';
}

function normalizeMessageEnvelope({ message, messageEnvelope, dataTypeIds }) {
  const envelope = messageEnvelope && typeof messageEnvelope === 'object' ? { ...messageEnvelope } : {};
  const primaryType = Array.isArray(dataTypeIds) && dataTypeIds.length > 0 ? dataTypeIds[0] : 'text-string';
  const hasExplicitType = Boolean(
    envelope && (
      (typeof envelope.formatToken === 'string' && envelope.formatToken.trim())
      || (typeof envelope.mediaType === 'string' && envelope.mediaType.trim())
    )
  );

  // Greenfield rule: if message is untyped, treat it as raw bytes.
  if (!envelope.formatToken) {
    envelope.formatToken = hasExplicitType ? defaultFormatTokenForDataType(primaryType) : 'bytes';
  }
  if (!envelope.mediaType) {
    envelope.mediaType = hasExplicitType ? inferMediaTypeFromMessage(message) : 'application/octet-stream';
  }
  if (!envelope.contentEncoding) {
    envelope.contentEncoding = 'base64';
  }

  if (typeof envelope.payloadBase64 !== 'string') {
    if (message == null) {
      envelope.payloadBase64 = '';
    } else if (Buffer.isBuffer(message)) {
      envelope.payloadBase64 = message.toString('base64');
    } else if (typeof message === 'string') {
      envelope.payloadBase64 = Buffer.from(message, 'utf-8').toString('base64');
    } else {
      envelope.payloadBase64 = Buffer.from(JSON.stringify(message), 'utf-8').toString('base64');
    }
  }

  envelope.message = message;
  return envelope;
}

function validateEnvelopeFormatAgainstDataType(typeId, envelope) {
  const normalizedType = String(typeId || '').trim().toLowerCase();
  const token = String(envelope?.formatToken || '').trim().toLowerCase();
  if (!normalizedType || !token) return { valid: true };

  if (token === 'bytes' || token === 'binary') {
    return { valid: true };
  }

  if (normalizedType === 'text-string') {
    return { valid: true };
  }

  if (normalizedType === 'pacs') {
    const ok = token.startsWith('pacs');
    return { valid: ok, reason: ok ? null : `formatToken ${envelope.formatToken} is incompatible with data type pacs` };
  }

  if (normalizedType === 'swift-mt103') {
    const ok = token === 'mt103' || token === 'swift.mt103';
    return { valid: ok, reason: ok ? null : `formatToken ${envelope.formatToken} is incompatible with data type swift-mt103` };
  }

  if (normalizedType === 'swift-mt202') {
    const ok = token === 'mt202' || token === 'swift.mt202';
    return { valid: ok, reason: ok ? null : `formatToken ${envelope.formatToken} is incompatible with data type swift-mt202` };
  }

  if (normalizedType === 'swift-mt202cov') {
    const ok = token === 'mt202cov' || token === 'swift.mt202cov';
    return { valid: ok, reason: ok ? null : `formatToken ${envelope.formatToken} is incompatible with data type swift-mt202cov` };
  }

  return { valid: true };
}

function logQueueValidationError(entry) {
  const item = {
    timestamp: new Date().toISOString(),
    ...entry
  };

  queueValidationErrors.push(item);
  if (queueValidationErrors.length > MAX_QUEUE_VALIDATION_ERRORS) {
    queueValidationErrors.splice(0, queueValidationErrors.length - MAX_QUEUE_VALIDATION_ERRORS);
  }

  try {
    fs.mkdirSync('./data', { recursive: true });
    fs.appendFileSync(QUEUE_VALIDATION_LOG_PATH, `${JSON.stringify(item)}\n`, 'utf-8');
  } catch (e) {
    console.warn(`[QUEUE-VALIDATION] Failed to persist validation error log: ${e.message}`);
  }

  logDlqEvent({
    workerId: 'ingress-validation',
    sourceQueue: item.queueName || '',
    targetQueue: item.queueName || '',
    messageShape: item.detectedShape || detectMessageShape(item.message),
    errorReason: item.reason || 'Queue type validation failed',
    messageSummary: item.messageSummary || summarizeMessage(item.message),
    managerId: item.managerId || null,
    sourceService: item.sourceService || null,
    expectedType: item.expectedType || null,
    channel: 'ingress-reject'
  });

  console.warn(`[QUEUE-VALIDATION] ${item.queueName} expected=${item.expectedType} shape=${item.detectedShape}: ${item.reason}`);
}

function logDlqEvent(entry) {
  const item = {
    timestamp: new Date().toISOString(),
    ...entry
  };

  dlqEvents.push(item);
  if (dlqEvents.length > MAX_DLQ_EVENTS) {
    dlqEvents.splice(0, dlqEvents.length - MAX_DLQ_EVENTS);
  }

  try {
    fs.mkdirSync('./data', { recursive: true });
    fs.appendFileSync(DLQ_EVENT_LOG_PATH, `${JSON.stringify(item)}\n`, 'utf-8');
  } catch (e) {
    console.warn(`[DLQ] Failed to persist DLQ log: ${e.message}`);
  }

  console.warn(`[DLQ] worker=${item.workerId} source=${item.sourceQueue} target=${item.targetQueue} shape=${item.messageShape} reason=${item.errorReason}`);
}

function summarizeDlqEvents(items) {
  const byWorker = {};
  const bySourceQueue = {};
  const byTargetQueue = {};
  const byShape = {};
  const byReason = {};

  for (const item of items || []) {
    const worker = String(item?.workerId || 'unknown');
    const sourceQueue = String(item?.sourceQueue || 'unknown');
    const targetQueue = String(item?.targetQueue || 'unknown');
    const shape = String(item?.messageShape || 'unknown');
    const reason = String(item?.errorReason || 'unknown');

    byWorker[worker] = Number(byWorker[worker] || 0) + 1;
    bySourceQueue[sourceQueue] = Number(bySourceQueue[sourceQueue] || 0) + 1;
    byTargetQueue[targetQueue] = Number(byTargetQueue[targetQueue] || 0) + 1;
    byShape[shape] = Number(byShape[shape] || 0) + 1;
    byReason[reason] = Number(byReason[reason] || 0) + 1;
  }

  return {
    byWorker,
    bySourceQueue,
    byTargetQueue,
    byShape,
    byReason
  };
}

function ensureMessageMatchesQueueType({ queueName, message, messageEnvelope, sourceService, managerId, dataTypeIds }) {
  const normalizedTypes = Array.isArray(dataTypeIds) && dataTypeIds.length > 0 ? dataTypeIds : ['text-string'];

  for (const typeId of normalizedTypes) {
    const check = validateMessageAgainstDataType(typeId, message);
    const formatCheck = validateEnvelopeFormatAgainstDataType(typeId, messageEnvelope);
    if (check.valid && formatCheck.valid) continue;

    const details = {
      queueName,
      expectedType: String(typeId || ''),
      reason: check.reason || formatCheck.reason || 'Message did not match expected queue type',
      managerId: managerId || null,
      sourceService: sourceService || null,
      formatToken: messageEnvelope?.formatToken || null,
      mediaType: messageEnvelope?.mediaType || null,
      detectedShape: detectMessageShape(message),
      messageSummary: summarizeMessage(message),
      message
    };

    logQueueValidationError(details);

    const err = new Error(`Queue ${queueName} rejected message for type ${typeId}: ${details.reason}`);
    err.statusCode = 422;
    err.code = 'QUEUE_TYPE_VALIDATION_FAILED';
    err.validation = details;
    throw err;
  }
}

function getOrCreateBrokerInstance(instanceId) {
  const id = String(instanceId || '').toLowerCase();
  const existing = brokerInstances.get(id);
  if (existing) return existing;
  const created = { instanceId: id, active: false, quiesced: false };
  brokerInstances.set(id, created);
  return created;
}

function setBrokerInstanceState(instanceId, patch) {
  const current = getOrCreateBrokerInstance(instanceId);
  const next = { ...current, ...patch, instanceId: String(instanceId || '').toLowerCase() };
  brokerInstances.set(next.instanceId, next);
  return next;
}

function getActiveBrokerInstances() {
  return Array.from(brokerInstances.values()).filter(i => i.active && !i.quiesced);
}

function getBrokerStateLabel() {
  if (globalThis.brokerClassDown) return 'class-down';
  const activeIds = getActiveBrokerInstances().map(i => i.instanceId).sort();
  if (activeIds.length === 0) return 'no-active-instances';
  if (activeIds.length === 1 && activeIds[0] === 'primary') return 'primary-only';
  if (activeIds.length === 2 && activeIds.includes('primary') && activeIds.includes('secondary')) return 'primary+secondary';
  return `${activeIds.length}-active-instances`;
}

function getBrokerInstancesPayload() {
  const payload = {};
  for (const [id, instance] of Array.from(brokerInstances.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    payload[id] = { active: !!instance.active, quiesced: !!instance.quiesced };
  }
  return payload;
}

function registerLocalQueueManagers() {
  queueManagerRegistry.set('qm-primary', {
    managerId: 'qm-primary',
    name: 'primary',
    nodeId: '127.0.0.1',
    ip: '127.0.0.1',
    port: HTTP_PORT,
    status: 'up',
    local: true,
    localIndex: 0,
    lastHeartbeat: Date.now(),
    queues: [],
    replicaOf: null,        // null means it's the primary
    replicas: [],           // list of replica managerId
    operationVersion: 0     // current operation log version
  });
  queueManagerRegistry.set('qm-secondary', {
    managerId: 'qm-secondary',
    name: 'secondary',
    nodeId: '127.0.0.1',
    ip: '127.0.0.1',
    port: HTTP_PORT,
    status: 'up',
    local: true,
    localIndex: 1,
    lastHeartbeat: Date.now(),
    queues: [],
    replicaOf: null,        // null means it's the primary
    replicas: [],           // list of replica managerId
    operationVersion: 0     // current operation log version
  });
}

registerLocalQueueManagers();

function upsertRemoteQueueManager({ managerId, name, nodeId, ip, port, status, queues, replicaOf, operationVersion }) {
  if (!managerId) return;
  const prev = queueManagerRegistry.get(managerId) || {};
  const requestedStatus = status || prev.status || 'up';
  const syncMarker = pendingManagerSync.get(managerId);
  const nextStatus = syncMarker ? 'syncing' : requestedStatus;
  const effectiveNodeId = normalizeNodeId(nodeId || ip || prev.nodeId);
  queueManagerRegistry.set(managerId, {
    ...prev,
    managerId,
    name: name || prev.name || managerId,
    nodeId: effectiveNodeId,
    ip: ip || prev.ip,
    port: Number(port || prev.port || HTTP_PORT),
    status: nextStatus,
    local: false,
    lastHeartbeat: Date.now(),
    queues: Array.isArray(queues) ? queues : (prev.queues || []),
    replicaOf: replicaOf || prev.replicaOf || null,
    replicas: prev.replicas || [],
    operationVersion: operationVersion || prev.operationVersion || 0,
    syncState: syncMarker ? 'syncing' : (prev.syncState || 'ready'),
    syncSourceManagerId: syncMarker?.sourceManagerId || prev.syncSourceManagerId || null,
    lastSyncError: prev.lastSyncError || null,
    persistence: prev.persistence || null,
  });
}

function upsertServiceInstance({ serviceName, instanceId, nodeId, ip, port, status, metadata }) {
  if (!serviceName) return;
  const effectiveInstanceId = instanceId || `${serviceName}:${nodeId || ip || 'unknown'}:${port || ''}`;
  const prev = serviceInstanceRegistry.get(effectiveInstanceId) || {};
  const effectiveNodeId = normalizeNodeId(nodeId || ip || prev.nodeId);
  const nextStatus = status || prev.status || 'up';
  serviceInstanceRegistry.set(effectiveInstanceId, {
    ...prev,
    instanceId: effectiveInstanceId,
    serviceName,
    nodeId: effectiveNodeId,
    ip: ip || prev.ip,
    port: Number(port || prev.port || HTTP_PORT),
    status: nextStatus,
    metadata: metadata || prev.metadata || {},
    lastHeartbeat: Date.now()
  });
}

function registerLocalServiceHeartbeats() {
  const localNodeId = os.hostname() || '127.0.0.1';
  const localIp = '127.0.0.1';

  const localServices = [
    {
      serviceName: BROKER_SERVICE,
      instanceId: `${BROKER_SERVICE}:local:${HTTP_PORT}`,
      metadata: { api: '/api/broker', label: 'Message Broker' }
    },
    {
      serviceName: ROUTER_SERVICE,
      instanceId: `${ROUTER_SERVICE}:local:${HTTP_PORT}`,
      metadata: { api: '/api/router', label: 'Router Service' }
    },
    {
      serviceName: QUEUE_SERVICE,
      instanceId: `${QUEUE_SERVICE}:local:${HTTP_PORT}`,
      metadata: { api: '/api/queue', label: 'Queue Manager' }
    },
    {
      serviceName: FILE_SERVER_SERVICE,
      instanceId: `${FILE_SERVER_SERVICE}:local:${HTTP_PORT}`,
      metadata: { api: '/api/fileserver', label: 'File Server' }
    }
  ];

  for (const svc of localServices) {
    upsertServiceInstance({
      serviceName: svc.serviceName,
      instanceId: svc.instanceId,
      nodeId: localNodeId,
      ip: localIp,
      port: HTTP_PORT,
      status: 'up',
      metadata: svc.metadata
    });
  }
}

const {
  getNodeRuntimeDiagnosticsSnapshot,
  setNodeLifecycleState,
  getNodeDrainStatus,
  getBrokerNodeDetails,
  getSystemPerformanceSnapshot
} = createRuntimeDiagnosticsApi({
  os,
  v8,
  performance,
  monitorEventLoopDelay,
  execFileSync,
  processRef: process,
  queueManagerInstances,
  queueManagerRegistry,
  serviceInstanceRegistry,
  queueRoutes,
  getQueueManagers: () => queueManagers,
  normalizeNodeId,
  BROKER_SERVICE,
  SQL_INSTANCE_NAME,
  SQL_SERVER_HOST
});

function getAvailableServiceInstances(serviceName) {
  return Array.from(serviceInstanceRegistry.values()).filter(i => i.serviceName === serviceName && MANAGER_ACTIVE_STATES.has(i.status));
}

function getLocalQueueManagerLaunchers() {
  return Array.from(localQueueManagerProcesses.values()).map(entry => ({
    managerId: entry.managerId,
    nodeId: entry.nodeId,
    port: entry.port,
    advertiseIp: entry.advertiseIp,
    aggregatorUrl: entry.aggregatorUrl,
    pid: entry.child.pid,
    status: entry.status,
    startedAt: entry.startedAt,
    stoppedAt: entry.stoppedAt || null,
    exitCode: entry.exitCode ?? null,
    signal: entry.signal ?? null,
    lastError: entry.lastError || null,
  }));
}

function launchLocalQueueManager({ managerId, nodeId, port, advertiseIp, aggregatorUrl }) {
  const existing = localQueueManagerProcesses.get(managerId);
  if (existing && existing.status === 'running') {
    throw new Error(`Queue manager ${managerId} is already running`);
  }

  const args = [
    queueManagerScriptPath,
    `--aggregator=${aggregatorUrl}`,
    `--port=${port}`,
    `--manager-id=${managerId}`,
    `--node-id=${nodeId}`,
    `--advertise-ip=${advertiseIp}`,
  ];

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PULSE_QUEUE_PERSISTENCE: PULSE_QUEUE_PERSISTENCE ? '1' : '0', PULSE_QUEUE_DATA_ROOT: PULSE_QUEUE_DATA_ROOT || '' },
  });

  const entry = {
    managerId,
    nodeId,
    port,
    advertiseIp,
    aggregatorUrl,
    child,
    status: 'running',
    startedAt: new Date().toISOString(),
    logs: [],
    lastError: null,
  };

  child.stdout.on('data', chunk => {
    entry.logs.push(chunk.toString());
    entry.logs = entry.logs.slice(-50);
  });
  child.stderr.on('data', chunk => {
    entry.lastError = chunk.toString();
    entry.logs.push(chunk.toString());
    entry.logs = entry.logs.slice(-50);
  });
  child.on('exit', (code, signal) => {
    entry.status = 'stopped';
    entry.exitCode = code;
    entry.signal = signal;
    entry.stoppedAt = new Date().toISOString();
  });

  localQueueManagerProcesses.set(managerId, entry);
  return entry;
}

function stopLocalQueueManager(managerId) {
  const entry = localQueueManagerProcesses.get(managerId);
  if (!entry) return null;
  if (entry.status === 'running') {
    entry.child.kill();
    entry.status = 'stopping';
  }
  return entry;
}

function normalizeRemoteAgentUrl(baseUrl) {
  const value = String(baseUrl || '').trim();
  if (!value) throw new Error('baseUrl is required');
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('baseUrl must start with http:// or https://');
  }
  return normalized;
}

function getRemoteAgentsPayload() {
  return Array.from(remoteAgentRegistry.values())
    .map(agent => ({
      agentId: agent.agentId,
      baseUrl: agent.baseUrl,
      hasToken: !!agent.token,
      allowedManagerPrefix: agent.allowedManagerPrefix,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt || null,
      lastPingAt: agent.lastPingAt || null,
      lastPingError: agent.lastPingError || null,
      lastKnownHealth: agent.lastKnownHealth || null,
    }))
    .sort((a, b) => a.agentId.localeCompare(b.agentId));
}

function getRemoteAgentOrThrow(agentId) {
  const id = String(agentId || '').trim();
  if (!id) throw new Error('agentId is required');
  const agent = remoteAgentRegistry.get(id);
  if (!agent) throw new Error(`Remote agent ${id} not found`);
  return agent;
}

function getRemoteLaunchersPayload() {
  return Array.from(remoteQueueManagerProcesses.values())
    .map(item => ({
      managerId: item.managerId,
      agentId: item.agentId,
      nodeId: item.nodeId,
      port: item.port,
      advertiseIp: item.advertiseIp,
      aggregatorUrl: item.aggregatorUrl,
      status: item.status,
      startedAt: item.startedAt || null,
      stoppedAt: item.stoppedAt || null,
      lastError: item.lastError || null,
      remote: item.remote || null,
    }))
    .sort((a, b) => a.managerId.localeCompare(b.managerId));
}

async function callRemoteAgent(agent, endpoint, method = 'GET', body = null) {
  const url = `${agent.baseUrl}${endpoint}`;
  const headers = {
    'content-type': 'application/json',
    'x-qm-agent-token': agent.token,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const details = payload?.error || payload?.message || `HTTP ${response.status}`;
    throw new Error(`Agent call failed ${method} ${endpoint}: ${details}`);
  }

  return payload;
}

function resolveServiceInstance(serviceName) {
  const candidates = getAvailableServiceInstances(serviceName);
  if (candidates.length === 0) return null;
  let selected = candidates[0];
  for (const c of candidates) {
    if ((c.lastHeartbeat || 0) > (selected.lastHeartbeat || 0)) selected = c;
  }
  return selected;
}

function isManagerNodeAvailableForNewWork(manager) {
  if (!manager) return false;
  const managerNodeId = normalizeNodeId(manager.nodeId);
  const managerIp = normalizePresenceIp(manager.ip);

  for (const node of discoveredNodes.values()) {
    const availability = node?.availability;
    if (!availability || typeof availability.available === 'undefined') continue;

    const nodeNodeId = normalizeNodeId(node.nodeId);
    const nodeIp = normalizePresenceIp(node.ip);
    const nodeMatches = (managerNodeId && nodeNodeId && managerNodeId === nodeNodeId)
      || (managerIp && nodeIp && managerIp === nodeIp);
    if (!nodeMatches) continue;

    if (availability.draining) return false;
    return Boolean(availability.available);
  }

  // If the manager has no discovered availability record yet, keep current behavior.
  return true;
}

function getAvailableQueueManagers() {
  return Array.from(queueManagerRegistry.values()).filter(
    m => MANAGER_ACTIVE_STATES.has(m.status) && isManagerNodeAvailableForNewWork(m)
  );
}

function getManagerGroupId(managerId) {
  return String(managerId || '').replace(/-\d+$/, '');
}

function pickSyncSourceManager(newManagerId) {
  const targetGroup = getManagerGroupId(newManagerId);
  const candidates = Array.from(queueManagerRegistry.values()).filter(manager => (
    manager.managerId !== newManagerId &&
    getManagerGroupId(manager.managerId) === targetGroup &&
    MANAGER_ACTIVE_STATES.has(manager.status)
  ));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.lastHeartbeat || 0) - (a.lastHeartbeat || 0));
  return candidates[0];
}

async function waitForManagerRegistration(managerId, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const manager = queueManagerRegistry.get(managerId);
    if (manager && manager.ip && manager.port && manager.lastHeartbeat) {
      return manager;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for manager ${managerId} registration`);
}

async function getManagerSnapshot(managerId) {
  const qm = queueManagerInstances.get(managerId);
  if (qm) {
    return qm.getSnapshot();
  }

  const manager = queueManagerRegistry.get(managerId);
  if (!manager || !manager.ip || !manager.port) {
    throw new Error(`Manager ${managerId} not found for snapshot`);
  }

  const response = await fetch(`http://${manager.ip}:${manager.port}/snapshot`, { method: 'GET' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Snapshot fetch failed (${response.status}) for ${managerId}: ${text.slice(0, 200)}`);
  }
  const payload = await response.json();
  return payload.snapshot;
}

async function applyManagerSnapshot(managerId, snapshot) {
  const qm = queueManagerInstances.get(managerId);
  if (qm) {
    qm.applySnapshot(snapshot);
    return { mode: 'local' };
  }

  const manager = queueManagerRegistry.get(managerId);
  if (!manager || !manager.ip || !manager.port) {
    throw new Error(`Manager ${managerId} not found for snapshot apply`);
  }

  const response = await fetch(`http://${manager.ip}:${manager.port}/replication/apply-snapshot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ snapshot })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Snapshot apply failed (${response.status}) for ${managerId}: ${text.slice(0, 200)}`);
  }
  return { mode: 'remote' };
}

async function syncManagerBeforeActivation(targetManagerId, sourceManagerId) {
  const source = queueManagerRegistry.get(sourceManagerId);
  const target = queueManagerRegistry.get(targetManagerId);
  if (!source || !target) {
    throw new Error('Source or target manager unavailable for sync');
  }

  // First pass: apply a full snapshot from source.
  const initialSnapshot = await getManagerSnapshot(sourceManagerId);
  await applyManagerSnapshot(targetManagerId, initialSnapshot);

  // Second pass: close race window for writes that landed during first snapshot/apply.
  let finalSnapshot = initialSnapshot;
  const catchupSnapshot = await getManagerSnapshot(sourceManagerId);
  const initialVersion = Number(initialSnapshot?.version || 0);
  const catchupVersion = Number(catchupSnapshot?.version || 0);
  if (catchupVersion > initialVersion) {
    await applyManagerSnapshot(targetManagerId, catchupSnapshot);
    finalSnapshot = catchupSnapshot;
  }

  const finalTarget = queueManagerRegistry.get(targetManagerId) || target;
  finalTarget.status = 'up';
  finalTarget.syncState = 'ready';
  finalTarget.syncSourceManagerId = sourceManagerId;
  finalTarget.lastSyncAt = new Date().toISOString();
  finalTarget.lastSyncVersion = Number(finalSnapshot?.version || 0);
  finalTarget.lastSyncError = null;
  queueManagerRegistry.set(targetManagerId, finalTarget);
  pendingManagerSync.delete(targetManagerId);

  appendTransactionTraceEvent({
    occurredAt: new Date().toISOString(),
    entityId: `${targetManagerId}:${sourceManagerId}:${Number(finalSnapshot?.version || 0)}`,
    machineId: 'queue-manager-sync',
    eventKind: 'manager-sync-ready',
    payloadType: 'system',
    transition: {
      fromState: null,
      toState: null,
      toStateLabel: null,
      eventName: null,
      queueName: null,
      isTerminal: false
    },
    worker: {
      workerId: null,
      sourceService: sourceManagerId,
      consumerService: targetManagerId,
      workerKind: 'manager-sync'
    },
    coordination: {
      queueName: null,
      managerId: targetManagerId,
      nodeId: finalTarget.nodeId || null,
      mode: finalTarget.local ? 'local' : 'remote',
      replicaOf: finalTarget.replicaOf || null,
      syncSourceManagerId: sourceManagerId,
      managerStatus: finalTarget.status || null
    },
    details: {
      sourceManagerId,
      targetManagerId,
      syncedVersion: Number(finalSnapshot?.version || 0)
    }
  });
}

function setQueueManagerStatus(managerId, status) {
  const manager = queueManagerRegistry.get(managerId);
  if (!manager) return null;
  manager.status = status;
  manager.updatedAt = new Date().toISOString();
  queueManagerRegistry.set(managerId, manager);
  return manager;
}

function ensureRoute(queueName) {
  const existing = queueRoutes.get(queueName);
  if (existing) {
    const manager = queueManagerRegistry.get(existing.managerId);
    if (manager && MANAGER_ACTIVE_STATES.has(manager.status) && isManagerNodeAvailableForNewWork(manager)) {
      return existing;
    }
  }

  const available = getAvailableQueueManagers();
  if (available.length === 0) {
    return null;
  }

  let selected = available[0];
  let selectedCount = Number.MAX_SAFE_INTEGER;
  for (const manager of available) {
    let count = 0;
    for (const route of queueRoutes.values()) {
      if (route.managerId === manager.managerId) count += 1;
    }
    if (count < selectedCount) {
      selected = manager;
      selectedCount = count;
    }
  }

  const route = {
    queueName,
    managerId: selected.managerId,
    assignedAt: new Date().toISOString()
  };
  queueRoutes.set(queueName, route);
  return route;
}

async function enqueueViaRoute(route, queueName, message, sourceService, messageEnvelope = null, preferredDataTypeIds = null) {
  const startedAt = performance.now();
  let enqueueMode = null;
  let succeeded = false;
  let enqueueError = null;
  const manager = queueManagerRegistry.get(route.managerId);
  if (!manager) throw new Error(`Route manager ${route.managerId} not found`);

  const messageId = crypto.randomUUID();

  try {
    if (manager.local) {
      enqueueMode = 'local';
      const qm = queueManagers[manager.localIndex];
      let dataTypeIds = Array.isArray(preferredDataTypeIds) && preferredDataTypeIds.length > 0
        ? preferredDataTypeIds
        : inferQueueDataTypeIds(queueName);
      const persistMessages = shouldPersistQueueMessages(queueName, message);
      if (!qm.getConfig(queueName)?.name) {
        qm.createQueue(queueName, {
          dataTypeId: dataTypeIds[0],
          dataTypeIds,
          queueClass: 'permanent',
          persistMessages,
          createdByUser: false
        });
      } else {
        const cfg = qm.getConfig(queueName) || {};
        if (cfg.persistMessages !== persistMessages) {
          qm.updateQueueConfig(queueName, { persistMessages });
        }
        const configured = cfg.dataTypeIds || cfg.dataTypeId;
        dataTypeIds = Array.isArray(configured) ? configured : (configured ? [configured] : dataTypeIds);
      }

      const normalizedEnvelope = normalizeMessageEnvelope({ message, messageEnvelope, dataTypeIds });
      ensureMessageMatchesQueueType({ queueName, message, messageEnvelope: normalizedEnvelope, sourceService, managerId: manager.managerId, dataTypeIds });

      // Record enqueue for metrics
      metricsCollector.recordEnqueue(messageId, queueName);

      qm.enqueue(queueName, message, sourceService || 'unknown', messageId, normalizedEnvelope);
      appendCoordinationTraceFromMessage(message, {
        eventKind: 'queue-enqueue',
        queueName,
        managerId: manager.managerId,
        sourceService: sourceService || 'unknown',
        mode: 'local',
        details: { messageId }
      });
      trackStep3IngressEnqueue(queueName, message);
      trackStep3Arrival(queueName, message);
      incrementLifecycleCumulativeByQueue(queueName, 1);
      replicateEnqueueToFollowers(queueName, message, sourceService, route.managerId, messageId, normalizedEnvelope)
        .catch(e => console.warn(`[REPLICATION] Fan-out error: ${e.message}`));
      succeeded = true;
      return { deliveredTo: manager.managerId, mode: 'local', messageId };
    }

    enqueueMode = 'remote';
    const url = `http://${manager.ip}:${manager.port}/enqueue`;
    const dataTypeIds = Array.isArray(preferredDataTypeIds) && preferredDataTypeIds.length > 0
      ? preferredDataTypeIds
      : inferQueueDataTypeIds(queueName);
    const persistMessages = shouldPersistQueueMessages(queueName, message);
    const normalizedEnvelope = normalizeMessageEnvelope({ message, messageEnvelope, dataTypeIds });
    ensureMessageMatchesQueueType({ queueName, message, messageEnvelope: normalizedEnvelope, sourceService, managerId: manager.managerId, dataTypeIds });
    await fetch(`http://${manager.ip}:${manager.port}/apply-config-change`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'createQueue',
        queueName,
        config: {
          dataTypeId: dataTypeIds[0],
          dataTypeIds,
          queueClass: 'permanent',
          persistMessages,
          createdByUser: false
        }
      })
    }).catch(() => null);
    const remoteRes = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueName, message, sourceService: sourceService || 'unknown', messageId, messageEnvelope: normalizedEnvelope })
    });
    if (!remoteRes.ok) {
      throw new Error(`Remote enqueue failed at ${url} with status ${remoteRes.status}`);
    }
    appendCoordinationTraceFromMessage(message, {
      eventKind: 'queue-enqueue',
      queueName,
      managerId: manager.managerId,
      sourceService: sourceService || 'unknown',
      mode: 'remote',
      details: { messageId, url }
    });
    trackStep3IngressEnqueue(queueName, message);
    trackStep3Arrival(queueName, message);
    incrementLifecycleCumulativeByQueue(queueName, 1);
    replicateEnqueueToFollowers(queueName, message, sourceService, route.managerId, messageId, normalizedEnvelope)
      .catch(e => console.warn(`[REPLICATION] Fan-out error: ${e.message}`));
    succeeded = true;
    return { deliveredTo: manager.managerId, mode: 'remote', url, messageId };
  } catch (error) {
    enqueueError = error;
    throw error;
  } finally {
    const latencyMs = Math.max(0, performance.now() - startedAt);
    trackQueueEnqueueLatency(queueName, latencyMs, {
      managerId: manager.managerId,
      mode: enqueueMode,
      ok: succeeded,
      error: enqueueError?.message || null
    });
  }
}

async function replicateEnqueueToFollowers(queueName, message, sourceService, leaderManagerId, messageId, messageEnvelope = null) {
  const followers = Array.from(queueManagerRegistry.values()).filter(
    m => MANAGER_ACTIVE_STATES.has(m.status) && m.managerId !== leaderManagerId
  );
  for (const follower of followers) {
    try {
      if (follower.local) {
        queueManagers[follower.localIndex].enqueueReplicated(queueName, message, sourceService, messageId, messageEnvelope);
      } else {
        await fetch(`http://${follower.ip}:${follower.port}/replicate-enqueue`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ queueName, message, sourceService, messageId, messageEnvelope })
        });
      }
      appendCoordinationTraceFromMessage(message, {
        eventKind: 'queue-replicated',
        queueName,
        managerId: follower.managerId,
        sourceService: sourceService || 'unknown',
        mode: follower.local ? 'local' : 'remote',
        details: { leaderManagerId, messageId }
      });
    } catch (e) {
      console.warn(`[REPLICATION] Failed to replicate to ${follower.managerId}: ${e.message}`);
    }
  }
}

function unwrapQueueItemMessage(item) {
  if (!item || typeof item !== 'object') return item;
  if (!Object.prototype.hasOwnProperty.call(item, 'message')) return item;

  const hasQueueMetadata = (
    Object.prototype.hasOwnProperty.call(item, 'messageId')
    || Object.prototype.hasOwnProperty.call(item, 'messageEnvelope')
    || Object.prototype.hasOwnProperty.call(item, 'sourceService')
    || Object.prototype.hasOwnProperty.call(item, 'filePath')
  );

  if (!hasQueueMetadata) return item;
  return item.message;
}

function shouldPersistQueueMessages(queueName, message = null) {
  const normalizedQueueName = String(queueName || '').trim().toLowerCase();
  if (!normalizedQueueName) return true;

  if (normalizedQueueName === 'correspondent.pacs008.outbound') return false;
  if (normalizedQueueName === 'tx.reconciled') return false;
  if (normalizedQueueName === 'tx.completed') return false;

  if (message && typeof message === 'object' && message.lifecycleStatus?.terminal === true) {
    return false;
  }

  if (typeof message === 'string' && /(?:^|\n):79:STATE=.*;TERMINAL=true(?:\n|$)/.test(message)) {
    return false;
  }

  return true;
}

async function dequeueViaRoute(queueName, consumerService) {
  let route = ensureRoute(queueName);
  if (!route) return null;

  const manager = queueManagerRegistry.get(route.managerId);
  if (!manager) {
    queueRoutes.delete(queueName);
    return null;
  }

  if (manager.local) {
    const item = queueManagers[manager.localIndex].dequeue(queueName, consumerService || 'unknown');
    if (item !== null) {
      const unwrappedItem = unwrapQueueItemMessage(item);
      appendCoordinationTraceFromMessage(unwrappedItem, {
        eventKind: 'queue-dequeue',
        queueName,
        managerId: manager.managerId,
        consumerService: consumerService || 'unknown',
        mode: 'local'
      });
      // Record dequeue for metrics
      if (item.metadata?.messageId) {
        metricsCollector.recordDequeue(item.metadata.messageId);
      }
      replicateDequeueToFollowers(queueName, item, route.managerId)
        .catch(e => console.warn(`[REPLICATION] Dequeue fan-out error: ${e.message}`));
    }
    return unwrapQueueItemMessage(item);
  }

  try {
    const url = `http://${manager.ip}:${manager.port}/dequeue`;
    const remoteRes = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueName, consumerService: consumerService || 'unknown' })
    });
    if (remoteRes.status === 404) return null;
    if (!remoteRes.ok) throw new Error(`Remote dequeue failed: ${remoteRes.status}`);
    const data = await remoteRes.json();
    const item = data.message || null;
    if (item !== null) {
      const unwrappedItem = unwrapQueueItemMessage(item);
      appendCoordinationTraceFromMessage(unwrappedItem, {
        eventKind: 'queue-dequeue',
        queueName,
        managerId: manager.managerId,
        consumerService: consumerService || 'unknown',
        mode: 'remote'
      });
      replicateDequeueToFollowers(queueName, item, route.managerId)
        .catch(e => console.warn(`[REPLICATION] Dequeue fan-out error: ${e.message}`));
    }
    return unwrapQueueItemMessage(item);
  } catch (e) {
    // Leader failed → auto-promote next available manager
    console.warn(`[FAILOVER] Leader ${route.managerId} failed for queue ${queueName}: ${e.message}`);
    appendTransactionTraceEvent({
      occurredAt: new Date().toISOString(),
      entityId: `failover:${queueName}:${route.managerId}`,
      machineId: 'queue-failover',
      eventKind: 'queue-failover',
      payloadType: 'system',
      transition: {
        fromState: null,
        toState: null,
        toStateLabel: null,
        eventName: null,
        queueName,
        isTerminal: false
      },
      worker: {
        workerId: null,
        sourceService: route.managerId,
        consumerService: consumerService || 'unknown',
        workerKind: 'failover'
      },
      coordination: {
        queueName,
        managerId: route.managerId,
        nodeId: manager.nodeId || null,
        mode: manager.local ? 'local' : 'remote',
        replicaOf: manager.replicaOf || null,
        syncSourceManagerId: manager.syncSourceManagerId || null,
        managerStatus: 'down'
      },
      details: { error: e.message }
    });
    manager.status = 'down';
    queueManagerRegistry.set(route.managerId, manager);
    queueRoutes.delete(queueName);

    route = ensureRoute(queueName);
    if (!route) return null;

    const newManager = queueManagerRegistry.get(route.managerId);
    if (!newManager) return null;
    console.log(`[FAILOVER] Promoted ${route.managerId} as new leader for queue ${queueName}`);

    if (newManager.local) {
      return queueManagers[newManager.localIndex].dequeue(queueName, consumerService || 'unknown');
    }
    try {
      const url = `http://${newManager.ip}:${newManager.port}/dequeue`;
      const res2 = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queueName, consumerService: consumerService || 'unknown' })
      });
      if (res2.status === 404) return null;
      if (!res2.ok) return null;
      const d2 = await res2.json();
      const message = d2.message || null;
      if (message !== null) {
        replicateDequeueToFollowers(queueName, message, route.managerId)
          .catch(err => console.warn(`[REPLICATION] Dequeue fan-out error: ${err.message}`));
      }
      return message;
    } catch {
      return null;
    }
  }
}

async function replicateDequeueToFollowers(queueName, removedMessage, leaderManagerId) {
  const followers = Array.from(queueManagerRegistry.values()).filter(
    m => MANAGER_ACTIVE_STATES.has(m.status) && m.managerId !== leaderManagerId
  );
  for (const follower of followers) {
    try {
      if (follower.local) {
        queueManagers[follower.localIndex].dequeueReplicated(queueName, removedMessage || null);
      } else {
        await fetch(`http://${follower.ip}:${follower.port}/replicate-dequeue`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ queueName, removedMessage: removedMessage || null })
        });
      }
    } catch (e) {
      console.warn(`[REPLICATION] Failed to replicate dequeue to ${follower.managerId}: ${e.message}`);
    }
  }
}

let messageRouter;
messageRouter = createRouterEngine({
  rulesPath: ROUTER_RULES_PATH,
  mappingsPath: DATA_MAPPINGS_PATH,
  compiledArtifactPath: path.join(RUNTIME_DATA_ROOT, 'router-mapper-compiled.json'),
  serviceId: 'aggregator-router-service',
  publishToQueue: async ({ queueName, message, sourceService, messageEnvelope = null, dataTypeIds }) => {
    let route = ensureRoute(queueName);
    if (!route) {
      throw new Error(`No available queue managers for queue ${queueName}`);
    }

    try {
      return await enqueueViaRoute(route, queueName, message, sourceService || 'router', messageEnvelope, dataTypeIds || null);
    } catch (e) {
      const manager = queueManagerRegistry.get(route.managerId);
      if (manager) {
        manager.status = 'down';
        queueManagerRegistry.set(route.managerId, manager);
      }
      queueRoutes.delete(queueName);
      route = ensureRoute(queueName);
      if (!route) {
        throw new Error(`Publish failed and no failover route for queue ${queueName}: ${e.message}`);
      }
      return enqueueViaRoute(route, queueName, message, sourceService || 'router', messageEnvelope, dataTypeIds || null);
    }
  },
  dequeueFromQueue: async ({ inputQueue, consumerService }) => {
    return dequeueViaRoute(inputQueue, consumerService || 'router');
  },
  invokeSubflow: async ({ subflowId, nodeId, payload, timeoutMs, parentRequestContext }) => {
    const normalizedSubflowId = String(subflowId || '').trim();
    if (!normalizedSubflowId) {
      return {
        success: false,
        errorCode: 'invalid_subflow_id',
        errorMessage: 'subflowId is required',
        response: null
      };
    }

    const params = new URLSearchParams();
    if (nodeId) params.set('nodeId', String(nodeId));
    if (timeoutMs) params.set('timeoutMs', String(timeoutMs));
    params.set('inputQueue', `${normalizedSubflowId}.in`);
    const qs = params.toString();
    const url = `http://127.0.0.1:${HTTP_PORT}/api/services/${encodeURIComponent(normalizedSubflowId)}${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': String(parentRequestContext?.headers?.['x-user-id'] || parentRequestContext?.headers?.['X-User-Id'] || 'system-admin')
      },
      body: JSON.stringify(payload ?? null)
    });

    let body;
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => '');
    }

    if (!res.ok) {
      return {
        success: false,
        errorCode: `http_${res.status}`,
        errorMessage: typeof body === 'object' ? (body?.error || `Subflow ${normalizedSubflowId} failed`) : String(body || `Subflow ${normalizedSubflowId} failed`),
        response: body
      };
    }

    return {
      success: true,
      response: typeof body === 'object' && body ? (Object.prototype.hasOwnProperty.call(body, 'response') ? body.response : body) : body,
      timeoutMs: timeoutMs || null
    };
  }
});

// Initialize metrics collector
console.log('[DEBUG] Initializing metrics collector...');
const metricsCollector = new MetricsCollector({
  collectionIntervalMs: 10000,  // 10 seconds
  metricsFilePath: path.join(RUNTIME_DATA_ROOT, 'worker-metrics.jsonl'),
  performanceFilePath: path.join(RUNTIME_DATA_ROOT, 'worker-performance.jsonl'),
  maxFileSizeMB: 100,
  retentionDays: 7
});

/**
 * Update queue depths in metrics collector from queue managers
 */
function updateMetricsQueueDepths() {
  try {
    const allQueues = new Set();
    
    // Collect from all queue managers
    for (const qm of queueManagers) {
      if (qm && qm.queueConfig) {
        for (const queueName of Object.keys(qm.queueConfig)) {
          const depth = qm.getQueueLength(queueName);
          metricsCollector.recordQueueDepth(queueName, depth);
          allQueues.add(queueName);
        }
      }
    }
    
    // Ensure we track all priority queues
    const priorityQueues = ['swift.mt103.inbound', 'ops.validation.deadletter', 'pacs.inbound', 'mt202.inbound'];
    for (const queueName of priorityQueues) {
      const depth = queueManagers[0].getQueueLength(queueName) + queueManagers[1].getQueueLength(queueName);
      metricsCollector.recordQueueDepth(queueName, depth);
    }
  } catch (e) {
    console.warn(`[METRICS] Failed to update queue depths: ${e.message}`);
  }
}

// Update queue depths every 5 seconds (twice per collection cycle)
setInterval(updateMetricsQueueDepths, 5000);

const routerWorkers = new Map();
const lifecycleWorkers = new Map();
const queueBridgeWorkers = new Map();

// Load worker configuration from file
let workerConfig = {};
function loadWorkerConfig() {
  workerConfig = loadWorkerConfigFromFile(WORKER_CONFIG_PATH);
  return workerConfig;
}

function getWorkerDefaults() {
  return getWorkerDefaultsFromConfig(workerConfig);
}

function validateRouterRuleCoverageForWorkerQueues() {
  const strictMode = String(process.env.ROUTER_STRICT_INPUT_RULES || 'true').toLowerCase() !== 'false';
  if (!strictMode) {
    return { ok: true, missingQueues: [], strictMode };
  }

  const defaults = getWorkerDefaults();
  const configuredQueues = Array.isArray(defaults.priorityQueues) ? defaults.priorityQueues : [];
  const workerQueues = configuredQueues
    .map(q => String(q || '').trim())
    .filter(Boolean);

  const rulesPath = ROUTER_RULES_PATH;
  let rules = [];
  try {
    const raw = fs.readFileSync(rulesPath, 'utf-8');
    const parsed = JSON.parse(raw);
    rules = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    throw new Error(`Router preflight failed: unable to read ${rulesPath}: ${e.message}`);
  }

  const enabledInputQueues = new Set(
    rules
      .filter(r => r && r.enabled !== false)
      .map(r => String(r.inputQueue || '').trim())
      .filter(Boolean)
  );

  const missingQueues = workerQueues.filter(q => !enabledInputQueues.has(q));
  if (missingQueues.length > 0) {
    throw new Error(
      `Router preflight failed: worker input queue(s) missing enabled router rule(s): ${missingQueues.join(', ')}. ` +
      `Add matching inputQueue rule(s) to ${rulesPath} or set ROUTER_STRICT_INPUT_RULES=false to bypass.`
    );
  }

  return { ok: true, missingQueues: [], strictMode };
}

function ensurePriorityInputQueuesConfigured() {
  const defaults = getWorkerDefaults();
  const priorityQueues = Array.isArray(defaults.priorityQueues)
    ? defaults.priorityQueues.map(q => String(q || '').trim()).filter(Boolean)
    : [];
  const created = [];

  if (priorityQueues.length === 0) {
    return created;
  }

  for (const [managerId, qm] of queueManagerInstances.entries()) {
    for (const queueName of priorityQueues) {
      try {
        const existing = qm.getConfig(queueName);
        if (existing?.name) {
          continue;
        }

        const dataTypeIds = inferQueueDataTypeIds(queueName);
        qm.createQueue(queueName, {
          dataTypeId: dataTypeIds[0],
          dataTypeIds,
          queueClass: 'permanent',
          createdByUser: false,
        });
        created.push({ managerId, queueName });
      } catch (e) {
        console.warn(`[PRECHECK] Failed to ensure queue ${queueName} on ${managerId}: ${e.message}`);
      }
    }
  }

  return created;
}

function startDefaultRouterWorkers({ intervalMs, batchSize, numWorkers } = {}) {
  // Load config if not already loaded
  if (Object.keys(workerConfig).length === 0) {
    loadWorkerConfig();
  }

  const defaults = getWorkerDefaults();
  const actualIntervalMs = intervalMs ?? defaults.intervalMs;
  const actualBatchSize = batchSize ?? defaults.batchSize;
  const actualNumWorkers = numWorkers ?? defaults.numWorkers;
  const results = [];
  const priorityQueues = defaults.priorityQueues;

  for (const queueName of priorityQueues) {
    for (let i = 0; i < actualNumWorkers; i++) {
      try {
        const workerId = `${queueName}-worker-${i + 1}`;
        const worker = startRouterWorker({
          inputQueue: queueName,
          intervalMs: actualIntervalMs,
          batchSize: actualBatchSize,
          consumerService: `router-worker-${i + 1}`
        });
        results.push({
          workerId,
          queue: queueName,
          instance: i + 1,
          intervalMs: actualIntervalMs,
          batchSize: actualBatchSize
        });
      } catch (e) {
        console.warn(`[AUTOSTART] Failed to start router worker for ${queueName}: ${e.message}`);
      }
    }
  }

  return results;
}

const SWIFT_GATEWAY_WORKER_IDS = [
  'gateway-swift-received-to-pacs',
  'gateway-swift-pacs-to-lynx-pending',
  'gateway-swift-approved-to-correspondent'
];
const BOC_GATEWAY_WORKER_IDS = [
  'gateway-boc-submit-pending-to-lynx-outbound',
  'gateway-boc-auto-approve-pending-to-approved'
];
const FED_GATEWAY_WORKER_IDS = [
  'gateway-fed-auto-approve-pending-to-approved'
];
const gatewayQuiesceState = {
  swift: false,
  boc: false,
  fed: false
};
const gatewayModeState = {
  boc: 'live',
  fed: 'test'
};
const GATEWAY_IDS = ['swift', 'boc', 'fed'];

function createDefaultGatewayRuntimeConfig() {
  return {
    controlPlane: 'local',
    remoteApi: {
      enabled: false,
      baseUrl: '',
      timeoutMs: 5000,
      fallbackToLocal: true,
      authType: 'none',
      authHeader: 'Authorization',
      token: '',
      apiKeyHeader: 'x-api-key',
      apiKey: '',
      actionPaths: {
        start: '/api/control/start',
        stop: '/api/control/stop',
        quiesce: '/api/control/quiesce'
      }
    }
  };
}

const gatewayRuntimeConfig = {
  swift: createDefaultGatewayRuntimeConfig(),
  boc: createDefaultGatewayRuntimeConfig(),
  fed: createDefaultGatewayRuntimeConfig()
};

const gatewayControlState = {
  swift: { lastAction: null, lastAt: null, lastControlSource: 'local', lastError: null },
  boc: { lastAction: null, lastAt: null, lastControlSource: 'local', lastError: null },
  fed: { lastAction: null, lastAt: null, lastControlSource: 'local', lastError: null }
};

function normalizeGatewayRuntimeConfig(nextValue, currentValue = createDefaultGatewayRuntimeConfig()) {
  const defaults = createDefaultGatewayRuntimeConfig();
  const current = currentValue && typeof currentValue === 'object' ? currentValue : defaults;
  const next = nextValue && typeof nextValue === 'object' ? nextValue : {};

  const remoteCurrent = current.remoteApi && typeof current.remoteApi === 'object' ? current.remoteApi : defaults.remoteApi;
  const remoteNext = next.remoteApi && typeof next.remoteApi === 'object' ? next.remoteApi : {};
  const actionPathsCurrent = remoteCurrent.actionPaths && typeof remoteCurrent.actionPaths === 'object'
    ? remoteCurrent.actionPaths
    : defaults.remoteApi.actionPaths;
  const actionPathsNext = remoteNext.actionPaths && typeof remoteNext.actionPaths === 'object'
    ? remoteNext.actionPaths
    : {};

  const controlPlaneRaw = String(next.controlPlane ?? current.controlPlane ?? defaults.controlPlane).trim().toLowerCase();
  const controlPlane = controlPlaneRaw === 'remote-api' ? 'remote-api' : 'local';

  return {
    controlPlane,
    remoteApi: {
      enabled: Boolean(remoteNext.enabled ?? remoteCurrent.enabled ?? defaults.remoteApi.enabled),
      baseUrl: String(remoteNext.baseUrl ?? remoteCurrent.baseUrl ?? defaults.remoteApi.baseUrl).trim(),
      timeoutMs: Number(remoteNext.timeoutMs ?? remoteCurrent.timeoutMs ?? defaults.remoteApi.timeoutMs) > 0
        ? Number(remoteNext.timeoutMs ?? remoteCurrent.timeoutMs ?? defaults.remoteApi.timeoutMs)
        : defaults.remoteApi.timeoutMs,
      fallbackToLocal: Boolean(remoteNext.fallbackToLocal ?? remoteCurrent.fallbackToLocal ?? defaults.remoteApi.fallbackToLocal),
      authType: String(remoteNext.authType ?? remoteCurrent.authType ?? defaults.remoteApi.authType).trim().toLowerCase() || 'none',
      authHeader: String(remoteNext.authHeader ?? remoteCurrent.authHeader ?? defaults.remoteApi.authHeader).trim() || defaults.remoteApi.authHeader,
      token: String(remoteNext.token ?? remoteCurrent.token ?? defaults.remoteApi.token),
      apiKeyHeader: String(remoteNext.apiKeyHeader ?? remoteCurrent.apiKeyHeader ?? defaults.remoteApi.apiKeyHeader).trim() || defaults.remoteApi.apiKeyHeader,
      apiKey: String(remoteNext.apiKey ?? remoteCurrent.apiKey ?? defaults.remoteApi.apiKey),
      actionPaths: {
        start: String(actionPathsNext.start ?? actionPathsCurrent.start ?? defaults.remoteApi.actionPaths.start).trim() || defaults.remoteApi.actionPaths.start,
        stop: String(actionPathsNext.stop ?? actionPathsCurrent.stop ?? defaults.remoteApi.actionPaths.stop).trim() || defaults.remoteApi.actionPaths.stop,
        quiesce: String(actionPathsNext.quiesce ?? actionPathsCurrent.quiesce ?? defaults.remoteApi.actionPaths.quiesce).trim() || defaults.remoteApi.actionPaths.quiesce
      }
    }
  };
}

function updateGatewayControlState(gatewayId, patch = {}) {
  if (!gatewayControlState[gatewayId]) return;
  gatewayControlState[gatewayId] = {
    ...gatewayControlState[gatewayId],
    ...patch,
    lastAt: patch.lastAt || new Date().toISOString()
  };
}

function shouldUseRemoteGatewayControl(gatewayId) {
  const runtime = gatewayRuntimeConfig[gatewayId] || createDefaultGatewayRuntimeConfig();
  return runtime.controlPlane === 'remote-api' && runtime.remoteApi.enabled && Boolean(runtime.remoteApi.baseUrl);
}

function resolveGatewayRemoteActionUrl(gatewayId, action) {
  const runtime = gatewayRuntimeConfig[gatewayId] || createDefaultGatewayRuntimeConfig();
  const baseUrl = String(runtime.remoteApi.baseUrl || '').trim();
  const actionPath = String(runtime.remoteApi.actionPaths?.[action] || '').trim();
  if (!baseUrl) {
    throw new Error(`Gateway ${gatewayId} remote API is missing baseUrl`);
  }
  if (!actionPath) {
    throw new Error(`Gateway ${gatewayId} remote API is missing action path for ${action}`);
  }
  return new URL(actionPath, baseUrl).toString();
}

async function executeGatewayRemoteAction(gatewayId, action, payload = {}) {
  const runtime = gatewayRuntimeConfig[gatewayId] || createDefaultGatewayRuntimeConfig();
  const url = resolveGatewayRemoteActionUrl(gatewayId, action);
  const controller = new AbortController();
  const timeoutMs = Number(runtime.remoteApi.timeoutMs) > 0 ? Number(runtime.remoteApi.timeoutMs) : 5000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers = { 'content-type': 'application/json' };
  const authType = String(runtime.remoteApi.authType || 'none').trim().toLowerCase();
  if (authType === 'bearer' && runtime.remoteApi.token) {
    headers[String(runtime.remoteApi.authHeader || 'Authorization')] = `Bearer ${runtime.remoteApi.token}`;
  }
  if (authType === 'apikey' && runtime.remoteApi.apiKey) {
    headers[String(runtime.remoteApi.apiKeyHeader || 'x-api-key')] = runtime.remoteApi.apiKey;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    if (!res.ok) {
      throw new Error(data?.error || `Remote API returned ${res.status}`);
    }
    updateGatewayControlState(gatewayId, {
      lastAction: action,
      lastControlSource: 'remote-api',
      lastError: null
    });
    return {
      controlSource: 'remote-api',
      remoteUrl: url,
      remoteResult: data
    };
  } finally {
    clearTimeout(timeout);
  }
}

function executeGatewayLocalAction(gatewayId, action, options = {}) {
  const intervalMs = Number(options.intervalMs) > 0 ? Number(options.intervalMs) : 500;
  const batchSize = Number(options.batchSize) > 0 ? Number(options.batchSize) : 25;

  if (gatewayId === 'swift') {
    if (action === 'start') {
      ensureWorkerStartsEnabled();
      startSwiftGateway({ intervalMs, batchSize });
      gatewayQuiesceState.swift = false;
    }
    if (action === 'stop') {
      stopSwiftGateway();
      gatewayQuiesceState.swift = false;
    }
    if (action === 'quiesce') {
      stopSwiftGateway();
      gatewayQuiesceState.swift = true;
    }
  }

  if (gatewayId === 'boc') {
    if (action === 'start') {
      ensureWorkerStartsEnabled();
      const resolvedMode = String(options.mode || options.approvalMode || gatewayModeState.boc || 'live').trim().toLowerCase() || 'live';
      startBocGateway({ intervalMs, batchSize, approvalMode: resolvedMode });
      gatewayQuiesceState.boc = false;
    }
    if (action === 'stop') {
      stopBocGateway();
      gatewayQuiesceState.boc = false;
    }
    if (action === 'quiesce') {
      stopBocGateway();
      gatewayQuiesceState.boc = true;
    }
  }

  if (gatewayId === 'fed') {
    if (action === 'start') {
      ensureWorkerStartsEnabled();
      startFedGateway({ intervalMs, batchSize });
      gatewayQuiesceState.fed = false;
    }
    if (action === 'stop') {
      stopFedGateway();
      gatewayQuiesceState.fed = false;
    }
    if (action === 'quiesce') {
      stopFedGateway();
      gatewayQuiesceState.fed = true;
    }
  }

  updateGatewayControlState(gatewayId, {
    lastAction: action,
    lastControlSource: 'local',
    lastError: null
  });

  return { controlSource: 'local' };
}

async function executeGatewayAction(gatewayId, action, options = {}) {
  if (!GATEWAY_IDS.includes(gatewayId)) {
    throw new Error('Gateway instance not found');
  }
  if (!['start', 'stop', 'quiesce'].includes(action)) {
    throw new Error('Unsupported gateway action');
  }

  const useRemote = shouldUseRemoteGatewayControl(gatewayId);
  if (useRemote) {
    try {
      return await executeGatewayRemoteAction(gatewayId, action, {
        gatewayId,
        action,
        mode: options.mode,
        approvalMode: options.approvalMode,
        intervalMs: Number(options.intervalMs) > 0 ? Number(options.intervalMs) : undefined,
        batchSize: Number(options.batchSize) > 0 ? Number(options.batchSize) : undefined
      });
    } catch (e) {
      const runtime = gatewayRuntimeConfig[gatewayId] || createDefaultGatewayRuntimeConfig();
      updateGatewayControlState(gatewayId, {
        lastAction: action,
        lastControlSource: 'remote-api',
        lastError: e.message
      });
      if (!runtime.remoteApi.fallbackToLocal) {
        throw e;
      }
      const localResult = executeGatewayLocalAction(gatewayId, action, options);
      updateGatewayControlState(gatewayId, {
        lastAction: action,
        lastControlSource: 'local-fallback',
        lastError: e.message
      });
      return {
        ...localResult,
        fallbackFrom: 'remote-api',
        fallbackReason: e.message
      };
    }
  }

  return executeGatewayLocalAction(gatewayId, action, options);
}
const workerRuntimeControl = {
  autoRestartEnabled: BACKEND_WORKER_AUTOSTART,
  hardResetAt: null,
  hardResetReason: BACKEND_WORKER_AUTOSTART ? null : 'autostart-disabled'
};
const queueTriggeredAutostartState = {
  lastTriggeredAt: null,
  lastQueueName: null
};
function ensureWorkerStartsEnabled() {
  if (!workerRuntimeControl.autoRestartEnabled) {
    throw new Error('Worker/gateway starts are disabled after hard reset. Re-enable via /api/lifecycle/auto-restart.');
  }
}

function isQueueTriggeredAutostartCandidate(queueName) {
  const q = String(queueName || '').trim().toLowerCase();
  if (!q) return false;
  return [
    'swift.mt103.inbound',
    'swift.mt103.parsed',
    'tx.pacs.created',
    'lynx.pacs009.outbound',
    'tx.lynx.pending',
    'tx.lynx.approved',
    'correspondent.pacs008.outbound',
    'pacs.inbound',
    'mt202.inbound'
  ].includes(q);
}

function ensureQueueTriggeredFlowForQueue(queueName) {
  if (!workerRuntimeControl.autoRestartEnabled) {
    return { attempted: false, triggered: false, reason: 'auto-restart-disabled' };
  }
  if (!isQueueTriggeredAutostartCandidate(queueName)) {
    return { attempted: false, triggered: false, reason: 'queue-not-configured-for-trigger' };
  }

  const hadAnyLifecycle = lifecycleWorkers.size > 0;
  const hadAnyBridge = queueBridgeWorkers.size > 0;
  const hadAnyWorkers = hadAnyLifecycle || hadAnyBridge;
  const swiftRunning = SWIFT_GATEWAY_WORKER_IDS.some((id) => lifecycleWorkers.has(id));
  const bocRunning = BOC_GATEWAY_WORKER_IDS.some((id) => lifecycleWorkers.has(id) || queueBridgeWorkers.has(id));

  let workersStarted = false;
  let swiftStarted = false;
  let bocStarted = false;

  // Queue-triggered mode only cold-starts when the flow is down.
  if (!hadAnyWorkers) {
    startDefaultQueueDrivenLifecycleWorkers({ intervalMs: 250, batchSize: 50 });
    workersStarted = true;
    try {
      startDefaultSubflowBridgeWorkers({ intervalMs: 500, batchSize: 25 });
    } catch {
      // Subflows are optional and may be absent in compiled lifecycle.
    }
  }

  if (!swiftRunning) {
    startSwiftGateway({ intervalMs: 500, batchSize: 25 });
    gatewayQuiesceState.swift = false;
    swiftStarted = true;
  }

  if (!bocRunning) {
    startBocGateway({ intervalMs: 500, batchSize: 25, approvalMode: gatewayModeState.boc });
    gatewayQuiesceState.boc = false;
    bocStarted = true;
  }

  const triggered = workersStarted || swiftStarted || bocStarted;
  if (triggered) {
    queueTriggeredAutostartState.lastTriggeredAt = new Date().toISOString();
    queueTriggeredAutostartState.lastQueueName = String(queueName || '');
  }

  return {
    attempted: true,
    triggered,
    workersStarted,
    swiftStarted,
    bocStarted,
    lastTriggeredAt: queueTriggeredAutostartState.lastTriggeredAt,
    lastQueueName: queueTriggeredAutostartState.lastQueueName
  };
}

function applyHardReset({ reason = 'manual' } = {}) {
  workerRuntimeControl.autoRestartEnabled = false;
  workerRuntimeControl.hardResetAt = new Date().toISOString();
  workerRuntimeControl.hardResetReason = String(reason || 'manual').trim() || 'manual';

  stopAllQueueDrivenWorkers();
  stopSubflowBridgeWorkers();
  stopSwiftGateway();
  stopBocGateway();
  gatewayQuiesceState.swift = false;
  gatewayQuiesceState.boc = false;
}

function getRouterWorkersPayload() {
  return Array.from(routerWorkers.values()).map(worker => ({
    inputQueue: worker.inputQueue,
    intervalMs: worker.intervalMs,
    batchSize: worker.batchSize,
    consumerService: worker.consumerService,
    processedMessages: worker.processedMessages,
    lastRunAt: worker.lastRunAt,
    lastError: worker.lastError || null,
    startedAt: worker.startedAt
  }));
}

function stopRouterWorker(inputQueue) {
  const key = String(inputQueue || '');
  const worker = routerWorkers.get(key);
  if (!worker) return false;
  if (typeof worker.stopScheduler === 'function') {
    worker.stopScheduler();
  } else {
    clearInterval(worker.intervalId);
  }
  routerWorkers.delete(key);
  return true;
}

function startRouterWorker({ inputQueue, intervalMs = 200, batchSize = 100, consumerService = 'router-worker' }) {
  const key = String(inputQueue || '').trim();
  if (!key) {
    throw new Error('inputQueue is required');
  }

  stopRouterWorker(key);

  const workerState = {
    inputQueue: key,
    intervalMs: Number(intervalMs) > 0 ? Number(intervalMs) : 200,
    batchSize: Number(batchSize) > 0 ? Number(batchSize) : 100,
    consumerService,
    processedMessages: 0,
    lastRunAt: null,
    lastError: null,
    lastNotConfiguredLogAt: 0,
    startedAt: new Date().toISOString(),
    intervalId: null,
    stopScheduler: null
  };

  const startupDelayMs = computeWorkerStartupDelayMs(workerState.intervalMs, `router:${workerState.inputQueue}`);
  workerState.stopScheduler = createAdaptiveWorkerScheduler({
    intervalMs: workerState.intervalMs,
    initialDelayMs: startupDelayMs,
    maxBackoffMultiplier: ROUTER_WORKER_MAX_BACKOFF_MULTIPLIER,
    onTickError: () => 2,
    runTick: async () => {
      if (!canRunQueueWorkers()) {
        workerState.lastRunAt = new Date().toISOString();
        workerState.lastError = machineAvailability.draining
          ? 'Node draining; not accepting new work'
          : 'Node unavailable; worker paused';
        return 0;
      }
      beginMachineWorkUnit();
      try {
        const result = await messageRouter.processFromQueue(workerState.inputQueue, {
          maxMessages: workerState.batchSize,
          consumerService: workerState.consumerService
        });
        const processed = Number(result.processed || 0);
        workerState.processedMessages += processed;
        workerState.lastRunAt = new Date().toISOString();
        workerState.lastError = null;
        return processed;
      } catch (e) {
        workerState.lastError = e.message;
        workerState.lastRunAt = new Date().toISOString();
        const isQueueNotConfigured = /not configured/i.test(String(e.message || ''));
        if (isQueueNotConfigured) {
          const now = Date.now();
          if (now - workerState.lastNotConfiguredLogAt >= 30000) {
            workerState.lastNotConfiguredLogAt = now;
            console.warn(`[ROUTER] Worker ${workerState.inputQueue} waiting for queue configuration: ${e.message}`);
          }
        } else {
          console.warn(`[ROUTER] Worker ${workerState.inputQueue} error: ${e.message}`);
        }
        throw e;
      } finally {
        endMachineWorkUnit();
      }
    }
  });

  routerWorkers.set(key, workerState);
  return workerState;
}

function getLifecycleWorkersPayload() {
  return Array.from(lifecycleWorkers.values()).map(worker => ({
    workerId: worker.workerId,
    fromState: worker.fromState,
    eventName: worker.eventName,
    context: worker.context,
    intervalMs: worker.intervalMs,
    batchSize: worker.batchSize,
    processingDelayMs: worker.processingDelayMs,
    consumerService: worker.consumerService,
    sourceService: worker.sourceService,
    processedMessages: worker.processedMessages,
    lastRunAt: worker.lastRunAt,
    lastError: worker.lastError || null,
    startedAt: worker.startedAt
  }));
}

function getLifecycleWorkerPayloadById(workerId) {
  const worker = lifecycleWorkers.get(String(workerId || '').trim());
  if (!worker) return null;
  return {
    workerId: worker.workerId,
    fromState: worker.fromState,
    eventName: worker.eventName,
    context: worker.context,
    intervalMs: worker.intervalMs,
    batchSize: worker.batchSize,
    processingDelayMs: worker.processingDelayMs,
    consumerService: worker.consumerService,
    sourceService: worker.sourceService,
    processedMessages: worker.processedMessages,
    lastRunAt: worker.lastRunAt,
    lastError: worker.lastError || null,
    startedAt: worker.startedAt
  };
}

function stopLifecycleWorker(workerId) {
  const key = String(workerId || '').trim();
  const worker = lifecycleWorkers.get(key);
  if (!worker) return false;
  if (typeof worker.stopScheduler === 'function') {
    worker.stopScheduler();
  } else {
    clearInterval(worker.intervalId);
  }
  lifecycleWorkers.delete(key);
  return true;
}

function resolveLifecycleWorkerTransition(compiled, fromState, eventName, context = {}) {
  const outgoing = getLifecycleOutgoingTransitions(compiled, fromState);
  if (outgoing.length === 0) {
    throw new Error(`State ${fromState} has no outgoing transitions`);
  }

  const candidates = eventName
    ? outgoing.filter(t => t.event === eventName)
    : outgoing;

  const transition = candidates.find(t => evaluateLifecycleTransitionGuard(t, context));
  if (!transition) {
    const eventText = eventName ? ` for event ${eventName}` : '';
    throw new Error(`No eligible transition from ${fromState}${eventText}`);
  }
  return transition;
}

async function delayMs(ms) {
  const duration = Number(ms || 0);
  if (duration <= 0) return;
  await new Promise(resolve => setTimeout(resolve, duration));
}

function computeWorkerStartupDelayMs(intervalMs, seedText = '') {
  const base = Number(intervalMs) > 0 ? Number(intervalMs) : 200;
  const spread = Math.max(20, Math.min(WORKER_STARTUP_STAGGER_CAP_MS, Math.floor(base * 0.8)));
  let hash = 0;
  const text = String(seedText || 'worker');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % spread;
}

function createAdaptiveWorkerScheduler({ intervalMs, initialDelayMs = 0, maxBackoffMultiplier = 4, onTickError = null, runTick }) {
  const baseInterval = Math.max(25, Number(intervalMs) || 200);
  const maxMultiplier = Math.max(1, Number(maxBackoffMultiplier) || 4);
  let timerId = null;
  let stopped = false;
  let idleStreak = 0;

  const scheduleNext = (delayMsValue) => {
    if (stopped) return;
    const delay = Math.max(10, Number(delayMsValue) || baseInterval);
    timerId = setTimeout(tick, delay);
  };

  const computeNextDelay = (processedCount) => {
    const processed = Number(processedCount) || 0;
    if (processed > 0) {
      idleStreak = 0;
      return baseInterval;
    }
    idleStreak = Math.min(idleStreak + 1, 6);
    const multiplier = Math.min(maxMultiplier, 1 + (idleStreak * 0.5));
    return Math.round(baseInterval * multiplier);
  };

  const tick = async () => {
    if (stopped) return;
    try {
      const processed = await runTick();
      scheduleNext(computeNextDelay(processed));
    } catch (error) {
      const multiplier = typeof onTickError === 'function' ? Number(onTickError(error)) : 2;
      const normalizedMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 2;
      scheduleNext(Math.round(baseInterval * normalizedMultiplier));
    }
  };

  scheduleNext(initialDelayMs > 0 ? initialDelayMs : baseInterval);

  return () => {
    stopped = true;
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
}

function resolveLifecycleFailureQueueName(transition, kind) {
  const fallback = kind === 'timeout' ? LIFECYCLE_ON_TIMEOUT_QUEUE : LIFECYCLE_ON_ERROR_QUEUE;
  const key = kind === 'timeout' ? 'onTimeoutQueue' : 'onErrorQueue';
  const configured = String(transition?.[key] || '').trim();
  return configured || fallback;
}

function resolveLifecycleTransitionTimeoutMs(transition, workerState) {
  const fromTransition = Number(transition?.timeoutMs);
  if (Number.isFinite(fromTransition) && fromTransition > 0) {
    return Math.max(1, Math.round(fromTransition));
  }

  const fromWorker = Number(workerState?.transitionTimeoutMs);
  if (Number.isFinite(fromWorker) && fromWorker > 0) {
    return Math.max(1, Math.round(fromWorker));
  }

  if (Number(LIFECYCLE_TRANSITION_TIMEOUT_MS) > 0) {
    return Math.max(1, Math.round(Number(LIFECYCLE_TRANSITION_TIMEOUT_MS)));
  }

  return 0;
}

function withTimeout(promiseOrFactory, timeoutMs, timeoutMessage = 'Operation timed out') {
  const limit = Math.max(0, Number(timeoutMs) || 0);
  if (limit <= 0) {
    return typeof promiseOrFactory === 'function' ? promiseOrFactory() : promiseOrFactory;
  }

  const taskPromise = typeof promiseOrFactory === 'function' ? promiseOrFactory() : promiseOrFactory;
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(timeoutMessage);
      error.code = 'LIFECYCLE_TRANSITION_TIMEOUT';
      error.isTimeout = true;
      error.timeoutMs = limit;
      reject(error);
    }, limit);
  });

  return Promise.race([taskPromise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function emitLifecycleFailureEvent({
  compiled,
  workerState,
  dequeueResult,
  transition,
  runtimeContext,
  error,
  kind = 'error',
  timeoutMs = null
} = {}) {
  const queueName = resolveLifecycleFailureQueueName(transition, kind);
  const route = ensureRoute(queueName);
  if (!route) {
    console.warn(`[LIFECYCLE] Unable to route ${kind} event: no route for ${queueName}`);
    return { emitted: false, reason: 'no-route', queueName };
  }

  const sourceMessage = runtimeContext?.inputMessage ?? dequeueResult?.message ?? null;
  const entityId = extractSwiftReferenceFromMessage(sourceMessage) || extractSwiftReferenceFromMessage(runtimeContext?.message) || null;
  const payload = {
    reference: entityId,
    entityId,
    eventName: kind === 'timeout' ? 'onTimeout' : 'onError',
    eventKind: kind,
    workerId: workerState?.workerId || null,
    sourceService: workerState?.sourceService || null,
    consumerService: workerState?.consumerService || null,
    fromState: workerState?.fromState || null,
    transitionEvent: transition?.event || null,
    transitionToState: transition?.to || null,
    sourceQueue: dequeueResult?.queueName || null,
    timeoutMs: timeoutMs == null ? null : Number(timeoutMs),
    errorCode: error?.code || null,
    errorMessage: String(error?.message || error || 'unknown lifecycle failure'),
    occurredAt: new Date().toISOString(),
    message: sourceMessage,
    runtimeContext: {
      lifecycleOutcome: kind,
      machineId: String(compiled?.transactionId || 'mt103-payment-lifecycle')
    }
  };

  try {
    await enqueueViaRoute(
      route,
      queueName,
      payload,
      `${workerState?.sourceService || 'lifecycle-worker'}:${kind}`,
      null,
      inferQueueDataTypeIds(queueName)
    );
    appendCoordinationTraceFromMessage(payload, {
      eventKind: kind === 'timeout' ? 'lifecycle-ontimeout' : 'lifecycle-onerror',
      queueName,
      managerId: route.managerId,
      sourceService: workerState?.sourceService || 'lifecycle-worker',
      workerId: workerState?.workerId || null,
      workerKind: 'lifecycle-worker',
      details: {
        sourceQueue: dequeueResult?.queueName || null,
        transitionEvent: transition?.event || null,
        transitionToState: transition?.to || null,
        timeoutMs: timeoutMs == null ? null : Number(timeoutMs),
        errorCode: error?.code || null,
        errorMessage: String(error?.message || error || 'unknown lifecycle failure')
      }
    });
    return { emitted: true, queueName, route };
  } catch (enqueueError) {
    console.warn(`[LIFECYCLE] Failed to emit ${kind} event to ${queueName}: ${enqueueError.message}`);
    return { emitted: false, queueName, reason: enqueueError.message };
  }
}

async function runLifecycleWorkerTick(workerState) {
  beginMachineWorkUnit();
  try {
    const compiled = readTransactionLifecycleCompiled();
    if (!compiled) {
      throw new Error('Lifecycle compiled artifact not found');
    }

    let moved = 0;
    for (let i = 0; i < workerState.batchSize; i += 1) {
      if (workerState.processingDelayMs > 0) {
        await delayMs(workerState.processingDelayMs);
      }
      const deq = await dequeueLifecycleStateMessage(compiled, workerState.fromState, workerState.consumerService);
      if (!deq.dequeued) break;
      const inboundMessage = deq.message;

      const runtimeContext = {
        ...workerState.context,
        message: deq.message,
        inputMessage: deq.message,
        worker: {
          workerId: workerState.workerId,
          fromState: workerState.fromState
        }
      };

      let transition = null;

      try {
        transition = resolveLifecycleWorkerTransition(
          compiled,
          workerState.fromState,
          workerState.eventName,
          runtimeContext
        );

        if (String(transition?.event || '').trim() === 'statement_matched') {
          const reference = extractSwiftReferenceFromMessage(runtimeContext.message);
          runtimeContext.message = buildMt940ForReference(reference);
        }

        const transitionTimeoutMs = resolveLifecycleTransitionTimeoutMs(transition, workerState);
        await withTimeout(
          () => runLifecycleTransitionAction(transition.action, runtimeContext, workerState),
          transitionTimeoutMs,
          `Lifecycle transition timed out after ${transitionTimeoutMs}ms`
        );
        await enqueueLifecycleStateMessage(
          compiled,
          transition.to,
          runtimeContext.message,
          workerState.sourceService,
          transition.event
        );

        if (String(transition?.event || '').trim() === 'mapped_to_pacs') {
          const parentEntityId = extractSwiftReferenceFromMessage(inboundMessage);
          const childEntityId = extractSwiftReferenceFromMessage(runtimeContext.message);
          if (parentEntityId && childEntityId && parentEntityId !== childEntityId) {
            appendTransactionJournalComment(parentEntityId, `Mapped MT103 ${parentEntityId} to PACS transaction ${childEntityId}.`, {
              eventKind: 'transaction-spawn-parent',
              relation: { childEntityId },
              queueName: deq.queueName,
              details: {
                transition: transition.event,
                fromState: workerState.fromState,
                toState: transition.to,
                workerId: workerState.workerId
              }
            });
            appendTransactionJournalComment(childEntityId, `Spawned from MT103 parent transaction ${parentEntityId}.`, {
              eventKind: 'transaction-spawn-child',
              relation: { parentEntityId },
              queueName: String(getLifecycleStateByName(compiled, transition.to)?.queueName || '').trim() || null,
              details: {
                transition: transition.event,
                fromState: workerState.fromState,
                toState: transition.to,
                workerId: workerState.workerId
              }
            });
          }
        }

        const stateMessage = String(transition?.event || '').trim() === 'mapped_to_pacs'
          ? inboundMessage
          : runtimeContext.message;
        await recordTransactionStateTransition(compiled, {
          message: stateMessage,
          fromState: workerState.fromState,
          toState: transition.to,
          eventName: transition.event,
          traceContext: {
            eventKind: 'lifecycle-transition',
            workerId: workerState.workerId,
            sourceService: workerState.sourceService,
            consumerService: workerState.consumerService,
            workerKind: 'lifecycle-worker'
          }
        });
        moved += 1;
      } catch (e) {
        if (isQueueValidationRejectionError(e)) {
          await enqueueValidationDeadLetter({
            workerId: workerState.workerId,
            sourceQueue: deq.queueName,
            targetQueue: String(getLifecycleStateByName(compiled, transition?.to)?.queueName || transition?.to || workerState.fromState || ''),
            message: deq.message,
            error: e
          });
          console.warn(`[LIFECYCLE] Worker ${workerState.workerId} moved invalid message to dead-letter queue: ${e.message}`);
          continue;
        }

        const failureKind = e?.isTimeout || e?.code === 'LIFECYCLE_TRANSITION_TIMEOUT' ? 'timeout' : 'error';
        const timeoutMs = failureKind === 'timeout'
          ? resolveLifecycleTransitionTimeoutMs(transition, workerState)
          : null;
        await emitLifecycleFailureEvent({
          compiled,
          workerState,
          dequeueResult: deq,
          transition,
          runtimeContext,
          error: e,
          kind: failureKind,
          timeoutMs
        });
        console.warn(`[LIFECYCLE] Worker ${workerState.workerId} emitted ${failureKind} event: ${e.message}`);
        continue;
      }
    }

    workerState.processedMessages += moved;
    workerState.lastRunAt = new Date().toISOString();
    workerState.lastError = null;
    if (moved > 0) {
      touchLifecycleActivity();
    }
    return moved;
  } finally {
    endMachineWorkUnit();
  }
}

function startLifecycleWorker({
  workerId,
  fromState,
  eventName,
  context = {},
  intervalMs = 1000,
  batchSize = 10,
  processingDelayMs = 0,
  consumerService = 'lifecycle-worker',
  sourceService = 'lifecycle-worker'
}) {
  const id = String(workerId || '').trim();
  const from = String(fromState || '').trim();
  if (!id) throw new Error('workerId is required');
  if (!from) throw new Error('fromState is required');

  stopLifecycleWorker(id);

  const workerState = {
    workerId: id,
    fromState: from,
    eventName: eventName || null,
    context: context || {},
    intervalMs: Number(intervalMs) > 0 ? Number(intervalMs) : 1000,
    batchSize: Number(batchSize) > 0 ? Number(batchSize) : 10,
    processingDelayMs: Number(processingDelayMs) > 0 ? Number(processingDelayMs) : 0,
    consumerService: String(consumerService || 'lifecycle-worker').trim(),
    sourceService: String(sourceService || 'lifecycle-worker').trim(),
    transitionTimeoutMs: Number(LIFECYCLE_TRANSITION_TIMEOUT_MS) > 0 ? Number(LIFECYCLE_TRANSITION_TIMEOUT_MS) : 0,
    processedMessages: 0,
    lastRunAt: null,
    lastError: null,
    lastNotConfiguredLogAt: 0,
    startedAt: new Date().toISOString(),
    intervalId: null,
    stopScheduler: null
  };

  const startupDelayMs = computeWorkerStartupDelayMs(workerState.intervalMs, `lifecycle:${workerState.workerId}`);
  workerState.stopScheduler = createAdaptiveWorkerScheduler({
    intervalMs: workerState.intervalMs,
    initialDelayMs: startupDelayMs,
    maxBackoffMultiplier: LIFECYCLE_WORKER_MAX_BACKOFF_MULTIPLIER,
    onTickError: () => 2,
    runTick: async () => {
      if (!canRunQueueWorkers()) {
        workerState.lastRunAt = new Date().toISOString();
        workerState.lastError = machineAvailability.draining
          ? 'Node draining; not accepting new work'
          : 'Node unavailable; worker paused';
        return 0;
      }
      try {
        return await runLifecycleWorkerTick(workerState);
      } catch (e) {
        workerState.lastError = e.message;
        workerState.lastRunAt = new Date().toISOString();
        if (isQueueNotConfiguredError(e)) {
          const now = Date.now();
          if (now - workerState.lastNotConfiguredLogAt >= 30000) {
            workerState.lastNotConfiguredLogAt = now;
            console.warn(`[LIFECYCLE] Worker ${workerState.workerId} waiting for queue configuration: ${e.message}`);
          }
        } else {
          console.warn(`[LIFECYCLE] Worker ${workerState.workerId} error: ${e.message}`);
        }
        throw e;
      }
    }
  });

  lifecycleWorkers.set(id, workerState);
  return workerState;
}

function getQueueBridgeWorkersPayload() {
  return Array.from(queueBridgeWorkers.values()).map(worker => ({
    workerId: worker.workerId,
    inputQueue: worker.inputQueue,
    outputQueue: worker.outputQueue,
    intervalMs: worker.intervalMs,
    batchSize: worker.batchSize,
    processingDelayMs: worker.processingDelayMs,
    consumerService: worker.consumerService,
    sourceService: worker.sourceService,
    processedMessages: worker.processedMessages,
    lastRunAt: worker.lastRunAt,
    lastError: worker.lastError || null,
    startedAt: worker.startedAt
  }));
}

function getQueueBridgeWorkerPayloadById(workerId) {
  const worker = queueBridgeWorkers.get(String(workerId || '').trim());
  if (!worker) return null;
  return {
    workerId: worker.workerId,
    inputQueue: worker.inputQueue,
    outputQueue: worker.outputQueue,
    intervalMs: worker.intervalMs,
    batchSize: worker.batchSize,
    processingDelayMs: worker.processingDelayMs,
    consumerService: worker.consumerService,
    sourceService: worker.sourceService,
    processedMessages: worker.processedMessages,
    lastRunAt: worker.lastRunAt,
    lastError: worker.lastError || null,
    startedAt: worker.startedAt
  };
}

function stopQueueBridgeWorker(workerId) {
  const key = String(workerId || '').trim();
  const worker = queueBridgeWorkers.get(key);
  if (!worker) return false;
  if (typeof worker.stopScheduler === 'function') {
    worker.stopScheduler();
  } else {
    clearInterval(worker.intervalId);
  }
  queueBridgeWorkers.delete(key);
  return true;
}

function isQueueValidationRejectionError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('rejected message for type') || msg.includes('queue-validation');
}

function isQueueNotConfiguredError(error) {
  return /not configured/i.test(String(error?.message || error || ''));
}

async function enqueueValidationDeadLetter({ workerId, sourceQueue, targetQueue, message, error }) {
  const deadLetterQueue = 'ops.validation.deadletter';
  const route = ensureRoute(deadLetterQueue);
  if (!route) {
    console.warn(`[DLQ] No route available for ${deadLetterQueue}; dropping invalid message from ${workerId}`);
    return false;
  }

  const payload = {
    at: new Date().toISOString(),
    workerId: String(workerId || 'unknown'),
    sourceQueue: String(sourceQueue || ''),
    targetQueue: String(targetQueue || ''),
    error: String(error?.message || error || 'validation rejection'),
    messageShape: detectMessageShape(message),
    message
  };

  logDlqEvent({
    workerId: payload.workerId,
    sourceQueue: payload.sourceQueue,
    targetQueue: payload.targetQueue,
    messageShape: payload.messageShape,
    errorReason: payload.error,
    messageSummary: summarizeMessage(message)
  });

  await enqueueViaRoute(route, deadLetterQueue, payload, 'lifecycle-dlq', null, ['text-string']);
  return true;
}

async function runQueueBridgeWorkerTick(workerState) {
  beginMachineWorkUnit();
  try {
    const compiled = readTransactionLifecycleCompiled();
    let moved = 0;
    for (let i = 0; i < workerState.batchSize; i += 1) {
      if (workerState.processingDelayMs > 0) {
        await delayMs(workerState.processingDelayMs);
      }
      const message = await dequeueViaRoute(workerState.inputQueue, workerState.consumerService);
      if (message == null) break;

      const route = ensureRoute(workerState.outputQueue);
      if (!route) {
        throw new Error(`No available queue managers for queue ${workerState.outputQueue}`);
      }
      try {
        let outputMessage = message;
        const outputState = compiled ? getLifecycleStateByQueueName(compiled, workerState.outputQueue) : null;
        if (outputState?.name) {
          outputMessage = annotateLifecycleMessageForState(compiled, outputState.name, message, 'queue_bridge');
        }

        await enqueueViaRoute(route, workerState.outputQueue, outputMessage, workerState.sourceService, null, workerState.dataTypeIds);
        if (outputState?.name) {
          const inputState = compiled ? getLifecycleStateByQueueName(compiled, workerState.inputQueue) : null;
          await recordTransactionStateTransition(compiled, {
            message: outputMessage,
            fromState: inputState?.name || null,
            toState: outputState.name,
            eventName: 'queue_bridge',
            queueName: workerState.outputQueue,
            traceContext: {
              eventKind: 'queue-bridge',
              workerId: workerState.workerId,
              sourceService: workerState.sourceService,
              consumerService: workerState.consumerService,
              workerKind: 'queue-bridge-worker'
            }
          });
        }
        moved += 1;
      } catch (e) {
        if (isQueueValidationRejectionError(e)) {
          await enqueueValidationDeadLetter({
            workerId: workerState.workerId,
            sourceQueue: workerState.inputQueue,
            targetQueue: workerState.outputQueue,
            message,
            error: e
          });
          console.warn(`[BRIDGE] Worker ${workerState.workerId} moved invalid message to dead-letter queue: ${e.message}`);
          continue;
        }
        throw e;
      }
    }

    workerState.processedMessages += moved;
    workerState.lastRunAt = new Date().toISOString();
    workerState.lastError = null;
    if (moved > 0) {
      touchLifecycleActivity();
    }
    return moved;
  } finally {
    endMachineWorkUnit();
  }
}

function startQueueBridgeWorker({
  workerId,
  inputQueue,
  outputQueue,
  intervalMs = 1000,
  batchSize = 10,
  processingDelayMs = 0,
  consumerService = 'queue-bridge-worker',
  sourceService = 'queue-bridge-worker',
  dataTypeIds = null
}) {
  const id = String(workerId || '').trim();
  const input = String(inputQueue || '').trim();
  const output = String(outputQueue || '').trim();
  if (!id) throw new Error('workerId is required');
  if (!input) throw new Error('inputQueue is required');
  if (!output) throw new Error('outputQueue is required');

  stopQueueBridgeWorker(id);

  const workerState = {
    workerId: id,
    inputQueue: input,
    outputQueue: output,
    intervalMs: Number(intervalMs) > 0 ? Number(intervalMs) : 1000,
    batchSize: Number(batchSize) > 0 ? Number(batchSize) : 10,
    processingDelayMs: Number(processingDelayMs) > 0 ? Number(processingDelayMs) : 0,
    consumerService: String(consumerService || 'queue-bridge-worker').trim(),
    sourceService: String(sourceService || 'queue-bridge-worker').trim(),
    dataTypeIds: Array.isArray(dataTypeIds) && dataTypeIds.length > 0 ? dataTypeIds : inferQueueDataTypeIds(output),
    processedMessages: 0,
    lastRunAt: null,
    lastError: null,
    lastNotConfiguredLogAt: 0,
    startedAt: new Date().toISOString(),
    intervalId: null,
    stopScheduler: null
  };

  const startupDelayMs = computeWorkerStartupDelayMs(workerState.intervalMs, `bridge:${workerState.workerId}`);
  workerState.stopScheduler = createAdaptiveWorkerScheduler({
    intervalMs: workerState.intervalMs,
    initialDelayMs: startupDelayMs,
    maxBackoffMultiplier: BRIDGE_WORKER_MAX_BACKOFF_MULTIPLIER,
    onTickError: () => 2,
    runTick: async () => {
      if (!canRunQueueWorkers()) {
        workerState.lastRunAt = new Date().toISOString();
        workerState.lastError = machineAvailability.draining
          ? 'Node draining; not accepting new work'
          : 'Node unavailable; worker paused';
        return 0;
      }
      try {
        return await runQueueBridgeWorkerTick(workerState);
      } catch (e) {
        workerState.lastError = e.message;
        workerState.lastRunAt = new Date().toISOString();
        if (isQueueNotConfiguredError(e)) {
          const now = Date.now();
          if (now - workerState.lastNotConfiguredLogAt >= 30000) {
            workerState.lastNotConfiguredLogAt = now;
            console.warn(`[BRIDGE] Worker ${workerState.workerId} waiting for queue configuration: ${e.message}`);
          }
        } else {
          console.warn(`[BRIDGE] Worker ${workerState.workerId} error: ${e.message}`);
        }
        throw e;
      }
    }
  });

  queueBridgeWorkers.set(id, workerState);
  return workerState;
}

function stopAllQueueDrivenWorkers() {
  for (const workerId of Array.from(lifecycleWorkers.keys())) {
    stopLifecycleWorker(workerId);
  }
  for (const workerId of Array.from(queueBridgeWorkers.keys())) {
    stopQueueBridgeWorker(workerId);
  }
}

function startDefaultQueueDrivenLifecycleWorkers({ intervalMs = 250, batchSize = 50 } = {}) {
  const shared = { intervalMs, batchSize };
  const started = [];

  started.push(startLifecycleWorker({
    workerId: 'lifecycle-received-to-pacs',
    fromState: 'received_mt103',
    eventName: 'mapped_to_pacs',
    processingDelayMs: 0,
    consumerService: 'lifecycle-received-to-pacs',
    sourceService: 'lifecycle-received-to-pacs',
    ...shared
  }));

  started.push(startLifecycleWorker({
    workerId: 'lifecycle-pacs-to-lynx-pending',
    fromState: 'pacs_created',
    eventName: 'submitted_to_lynx',
    processingDelayMs: 0,
    consumerService: 'lifecycle-pacs-to-lynx-pending',
    sourceService: 'lifecycle-pacs-to-lynx-pending',
    ...shared
  }));

  started.push(startQueueBridgeWorker({
    ...shared,
    workerId: 'bridge-lynx-outbound-to-pending',
    inputQueue: 'lynx.pacs009.outbound',
    outputQueue: 'tx.lynx.pending',
    intervalMs: Math.min(Number(intervalMs) > 0 ? Number(intervalMs) : 250, 100),
    batchSize: Math.max(Number(batchSize) > 0 ? Number(batchSize) : 50, 50),
    processingDelayMs: 0,
    consumerService: 'bridge-lynx-outbound-to-pending',
    sourceService: 'bridge-lynx-outbound-to-pending',
    dataTypeIds: ['pacs'],
  }));

  started.push(startLifecycleWorker({
    workerId: 'lifecycle-lynx-pending-to-approved',
    fromState: 'lynx_pending',
    eventName: 'lynx_approved',
    context: { status: 'approved' },
    processingDelayMs: 420,
    consumerService: 'lifecycle-lynx-pending-to-approved',
    sourceService: 'lifecycle-lynx-pending-to-approved',
    ...shared
  }));

  started.push(startLifecycleWorker({
    workerId: 'lifecycle-approved-to-correspondent',
    fromState: 'lynx_approved',
    eventName: 'sent_to_correspondent',
    processingDelayMs: 520,
    consumerService: 'lifecycle-approved-to-correspondent',
    sourceService: 'lifecycle-approved-to-correspondent',
    ...shared
  }));

  started.push(startLifecycleWorker({
    workerId: 'lifecycle-correspondent-to-reconciled',
    fromState: 'sent_correspondent_unreconciled',
    eventName: 'statement_matched',
    context: { statement_match: true, statementMatch: true },
    processingDelayMs: 650,
    consumerService: 'lifecycle-correspondent-to-reconciled',
    sourceService: 'lifecycle-correspondent-to-reconciled',
    ...shared
  }));

  return started;
}

function sanitizeQueueToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-');
}

function getSubflowBridgeWorkersPayload() {
  return Array.from(queueBridgeWorkers.values())
    .filter(worker => String(worker.workerId || '').startsWith('subflow-'));
}

function stopSubflowBridgeWorkers() {
  for (const workerId of Array.from(queueBridgeWorkers.keys())) {
    if (String(workerId).startsWith('subflow-')) {
      stopQueueBridgeWorker(workerId);
    }
  }
}

function startDefaultSubflowBridgeWorkers({ intervalMs = 500, batchSize = 25 } = {}) {
  const compiled = readTransactionLifecycleCompiled();
  if (!compiled) {
    throw new Error('Lifecycle compiled artifact not found');
  }

  const started = [];
  const states = Array.isArray(compiled.states) ? compiled.states : [];
  const transitions = Array.isArray(compiled.transitions) ? compiled.transitions : [];

  for (const state of states) {
    const subflowIdRaw = String(state?.subflow || '').trim();
    const stateQueue = String(state?.queueName || '').trim();
    if (!subflowIdRaw || !stateQueue) continue;

    const subflowId = sanitizeQueueToken(subflowIdRaw);
    const stateToken = sanitizeQueueToken(state.name);

    const dispatchWorkerId = `subflow-${stateToken}-dispatch`;
    started.push(startQueueBridgeWorker({
      workerId: dispatchWorkerId,
      inputQueue: stateQueue,
      outputQueue: `subflow.${subflowId}.inbound`,
      consumerService: dispatchWorkerId,
      sourceService: dispatchWorkerId,
      intervalMs,
      batchSize
    }));

    const outgoing = transitions.filter(t => t.from === state.name && String(t.event || '').trim());
    for (const t of outgoing) {
      const toState = getLifecycleStateByName(compiled, t.to);
      const toQueue = String(toState?.queueName || '').trim();
      if (!toQueue) continue;

      const eventToken = sanitizeQueueToken(t.event);
      const resultWorkerId = `subflow-${stateToken}-event-${eventToken}`;
      started.push(startQueueBridgeWorker({
        workerId: resultWorkerId,
        inputQueue: `subflow.${subflowId}.${eventToken}`,
        outputQueue: toQueue,
        consumerService: resultWorkerId,
        sourceService: resultWorkerId,
        intervalMs,
        batchSize
      }));
    }
  }

  return started;
}

function startSwiftGateway({ intervalMs = 500, batchSize = 25 } = {}) {
  const shared = { intervalMs, batchSize };

  startLifecycleWorker({
    workerId: 'gateway-swift-received-to-pacs',
    fromState: 'received_mt103',
    eventName: 'mapped_to_pacs',
    consumerService: 'gateway-swift-received-to-pacs',
    sourceService: 'gateway-swift-received-to-pacs',
    ...shared
  });

  startLifecycleWorker({
    workerId: 'gateway-swift-pacs-to-lynx-pending',
    fromState: 'pacs_created',
    eventName: 'submitted_to_lynx',
    consumerService: 'gateway-swift-pacs-to-lynx-pending',
    sourceService: 'gateway-swift-pacs-to-lynx-pending',
    ...shared
  });

  startLifecycleWorker({
    workerId: 'gateway-swift-approved-to-correspondent',
    fromState: 'lynx_approved',
    eventName: 'sent_to_correspondent',
    consumerService: 'gateway-swift-approved-to-correspondent',
    sourceService: 'gateway-swift-approved-to-correspondent',
    ...shared
  });

  return SWIFT_GATEWAY_WORKER_IDS
    .map(id => lifecycleWorkers.get(id))
    .filter(Boolean);
}

function stopSwiftGateway() {
  for (const workerId of SWIFT_GATEWAY_WORKER_IDS) {
    stopLifecycleWorker(workerId);
  }
}

function startBocGateway({ intervalMs = 500, batchSize = 25, approvalMode = 'approved' } = {}) {
  const shared = { intervalMs, batchSize };
  const requestedMode = String(approvalMode || '').trim().toLowerCase();
  const mode = requestedMode === 'approved' || requestedMode === 'test' ? 'test' : 'live';
  gatewayModeState.boc = mode;

  stopQueueBridgeWorker('gateway-boc-submit-pending-to-lynx-outbound');
  stopLifecycleWorker('gateway-boc-auto-approve-pending-to-approved');

  if (mode === 'test') {
    startLifecycleWorker({
      workerId: 'gateway-boc-auto-approve-pending-to-approved',
      fromState: 'lynx_pending',
      eventName: 'lynx_approved',
      context: { status: 'approved' },
      consumerService: 'gateway-boc-auto-approve-pending-to-approved',
      sourceService: 'gateway-boc-auto-approve-pending-to-approved',
      ...shared
    });
  } else {
    startQueueBridgeWorker({
      workerId: 'gateway-boc-submit-pending-to-lynx-outbound',
      inputQueue: 'tx.lynx.pending',
      outputQueue: 'lynx.pacs009.outbound',
      consumerService: 'gateway-boc-submit-pending-to-lynx-outbound',
      sourceService: 'gateway-boc-submit-pending-to-lynx-outbound',
      dataTypeIds: ['pacs'],
      ...shared
    });
  }

  return BOC_GATEWAY_WORKER_IDS
    .map(id => queueBridgeWorkers.get(id) || lifecycleWorkers.get(id))
    .filter(Boolean);
}

function stopBocGateway() {
  for (const workerId of BOC_GATEWAY_WORKER_IDS) {
    stopQueueBridgeWorker(workerId);
    stopLifecycleWorker(workerId);
  }
}

function startFedGateway({ intervalMs = 500, batchSize = 25 } = {}) {
  const shared = { intervalMs, batchSize };
  gatewayModeState.fed = 'test';

  stopLifecycleWorker('gateway-fed-auto-approve-pending-to-approved');

  startLifecycleWorker({
    workerId: 'gateway-fed-auto-approve-pending-to-approved',
    fromState: 'lynx_pending',
    eventName: 'lynx_approved',
    context: { status: 'approved', rail: 'fedwire' },
    consumerService: 'gateway-fed-auto-approve-pending-to-approved',
    sourceService: 'gateway-fed-auto-approve-pending-to-approved',
    ...shared
  });

  return FED_GATEWAY_WORKER_IDS
    .map(id => lifecycleWorkers.get(id))
    .filter(Boolean);
}

function stopFedGateway() {
  for (const workerId of FED_GATEWAY_WORKER_IDS) {
    stopQueueBridgeWorker(workerId);
    stopLifecycleWorker(workerId);
  }
}

function getGatewayStatusPayload() {
  const compiled = readTransactionLifecycleCompiled();
  const swiftWorkers = SWIFT_GATEWAY_WORKER_IDS.map(id => getLifecycleWorkerPayloadById(id)).filter(Boolean);
  const bocWorkers = BOC_GATEWAY_WORKER_IDS
    .map(id => getLifecycleWorkerPayloadById(id) || getQueueBridgeWorkerPayloadById(id))
    .filter(Boolean);
  const fedWorkers = FED_GATEWAY_WORKER_IDS.map(id => getLifecycleWorkerPayloadById(id)).filter(Boolean);

  const swiftRunning = SWIFT_GATEWAY_WORKER_IDS
    .some(id => lifecycleWorkers.has(id));
  const bocRunning = BOC_GATEWAY_WORKER_IDS
    .some(id => lifecycleWorkers.has(id) || queueBridgeWorkers.has(id));
  const fedRunning = FED_GATEWAY_WORKER_IDS
    .some(id => lifecycleWorkers.has(id));

  const swiftRuntime = gatewayRuntimeConfig.swift || createDefaultGatewayRuntimeConfig();
  const bocRuntime = gatewayRuntimeConfig.boc || createDefaultGatewayRuntimeConfig();
  const fedRuntime = gatewayRuntimeConfig.fed || createDefaultGatewayRuntimeConfig();

  return {
    swift: {
      running: swiftRunning,
      quiesced: Boolean(gatewayQuiesceState.swift),
      mode: 'live',
      workerIds: SWIFT_GATEWAY_WORKER_IDS,
      workers: swiftWorkers,
      queueMetrics: getGatewayQueueMetrics(swiftWorkers, compiled),
      control: {
        plane: swiftRuntime.controlPlane,
        remoteEnabled: Boolean(swiftRuntime.remoteApi?.enabled),
        remoteUrlConfigured: Boolean(swiftRuntime.remoteApi?.baseUrl),
        fallbackToLocal: Boolean(swiftRuntime.remoteApi?.fallbackToLocal),
        lastAction: gatewayControlState.swift?.lastAction || null,
        lastAt: gatewayControlState.swift?.lastAt || null,
        lastControlSource: gatewayControlState.swift?.lastControlSource || 'local',
        lastError: gatewayControlState.swift?.lastError || null
      }
    },
    boc: {
      running: bocRunning,
      quiesced: Boolean(gatewayQuiesceState.boc),
      mode: gatewayModeState.boc,
      workerIds: BOC_GATEWAY_WORKER_IDS,
      workers: bocWorkers,
      queueMetrics: getGatewayQueueMetrics(bocWorkers, compiled),
      control: {
        plane: bocRuntime.controlPlane,
        remoteEnabled: Boolean(bocRuntime.remoteApi?.enabled),
        remoteUrlConfigured: Boolean(bocRuntime.remoteApi?.baseUrl),
        fallbackToLocal: Boolean(bocRuntime.remoteApi?.fallbackToLocal),
        lastAction: gatewayControlState.boc?.lastAction || null,
        lastAt: gatewayControlState.boc?.lastAt || null,
        lastControlSource: gatewayControlState.boc?.lastControlSource || 'local',
        lastError: gatewayControlState.boc?.lastError || null
      }
    },
    fed: {
      running: fedRunning,
      quiesced: Boolean(gatewayQuiesceState.fed),
      mode: gatewayModeState.fed,
      workerIds: FED_GATEWAY_WORKER_IDS,
      workers: fedWorkers,
      queueMetrics: getGatewayQueueMetrics(fedWorkers, compiled),
      control: {
        plane: fedRuntime.controlPlane,
        remoteEnabled: Boolean(fedRuntime.remoteApi?.enabled),
        remoteUrlConfigured: Boolean(fedRuntime.remoteApi?.baseUrl),
        fallbackToLocal: Boolean(fedRuntime.remoteApi?.fallbackToLocal),
        lastAction: gatewayControlState.fed?.lastAction || null,
        lastAt: gatewayControlState.fed?.lastAt || null,
        lastControlSource: gatewayControlState.fed?.lastControlSource || 'local',
        lastError: gatewayControlState.fed?.lastError || null
      }
    }
  };
}

function buildGatewayStreamPayload() {
  const gateways = getGatewayStatusPayload();
  const processedTotal = ['swift', 'boc', 'fed']
    .map(name => Number(gateways?.[name]?.queueMetrics?.cumulativeProcessedCount || 0))
    .reduce((sum, value) => sum + value, 0);

  return {
    timestamp: Date.now(),
    processedTotal,
    gateways
  };
}

// --- UDP Node Discovery ---
const udpServer = dgram.createSocket('udp4');

function getLocalAdvertiseIp() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces || {})) {
    for (const item of entries || []) {
      if (!item || item.internal || item.family !== 'IPv4') continue;
      return item.address;
    }
  }
  return '127.0.0.1';
}

function buildMachineAvailabilityAnnouncement() {
  const capabilityHash = getMachineAvailabilityCapabilityHash();
  const capabilitiesChanged = machineAvailability.capabilityHash !== capabilityHash;
  return {
    kind: 'nodeBeacon',
    nodeId: machineAvailability.nodeId,
    nodeName: machineAvailability.nodeId,
    capabilityHash,
    capabilitiesChanged,
    needsDetails: capabilitiesChanged || !machineAvailability.beaconAcknowledged,
    ackRequired: true,
    port: HTTP_PORT,
    available: machineAvailability.available,
    draining: machineAvailability.draining,
    status: machineAvailability.available ? 'available' : (machineAvailability.draining ? 'draining' : 'unavailable'),
    ts: Date.now()
  };
}

function sendUdpJsonMessage(targetHost, targetPort, payload, label = 'UDP') {
  if (!targetHost || !targetPort) return;
  const message = Buffer.from(JSON.stringify(payload), 'utf-8');
  udpServer.send(message, 0, message.length, targetPort, targetHost, (error) => {
    if (error) {
      console.warn(`[${label}] Failed to send UDP message to ${targetHost}:${targetPort}: ${error.message}`);
    }
  });
}

function sendNodeBeaconAck(targetHost, targetPort, beaconPayload = {}) {
  sendUdpJsonMessage(targetHost, targetPort, {
    kind: 'nodeBeaconAck',
    nodeId: machineAvailability.nodeId,
    capabilityHash: machineAvailability.capabilityHash,
    requestDetails: Boolean(beaconPayload?.capabilitiesChanged || beaconPayload?.needsDetails),
    ackedAt: Date.now()
  }, 'UDP-ACK');
}

function requestNodeDetails(targetHost, targetPort, beaconPayload = {}) {
  sendUdpJsonMessage(targetHost, targetPort, {
    kind: 'nodeDetailsRequest',
    nodeId: machineAvailability.nodeId,
    capabilityHash: machineAvailability.capabilityHash,
    requestedFields: ['status', 'services', 'topology'],
    reason: beaconPayload?.capabilitiesChanged ? 'capabilities-changed' : 'initial-discovery',
    requestedAt: Date.now()
  }, 'UDP-DETAILS');
}

function markBeaconAcknowledged() {
  machineAvailability.beaconAcknowledged = true;
  machineAvailability.beaconAckAt = new Date().toISOString();
}

const {
  getMachineAvailabilityPayload,
  normalizePresenceIp,
  upsertBrowserPresenceNode,
  setBrowserPresenceUnavailable,
  getBrowserPresence,
  setMachineAvailable,
  setMachineUnavailable,
  drainMachineAndSetUnavailable
} = createMachineAvailabilityPresenceApi({
  machineAvailability,
  discoveredNodes,
  buildMachineAvailabilityAnnouncement,
  udpServer,
  UDP_PORT,
  getMachineAvailabilityBeaconIntervalMs,
  machineWorkloadState,
  machineDrainDefaultTimeoutMs: MACHINE_DRAIN_DEFAULT_TIMEOUT_MS,
  setTimeoutFn: setTimeout,
  clearTimeoutFn: clearTimeout
});

udpServer.on('message', (msg, rinfo) => {
  console.log(`[UDP] Packet from ${rinfo.address}:${rinfo.port} — ${msg.toString().slice(0, 120)}`);
  const ip = rinfo.address;
  const now = Date.now();
  let node = discoveredNodes.get(ip) || {};
  try {
    const raw = msg.toString();
    const data = JSON.parse(raw);

    if (data && data.kind === 'nodeBeaconAck' && String(data.nodeId || '').trim() === machineAvailability.nodeId) {
      markBeaconAcknowledged();
      machineAvailability.announceReason = 'acknowledged';
      console.log(`[UDP] Beacon acknowledged by ${rinfo.address}:${rinfo.port}`);
      return;
    }

    if (data && (data.kind === 'nodeDetailsRequest')) {
      sendUdpJsonMessage(rinfo.address, rinfo.port, {
        kind: 'nodeDetails',
        nodeId: machineAvailability.nodeId,
        ip: getLocalAdvertiseIp(),
        httpPort: HTTP_PORT,
        statusUrl: `http://${getLocalAdvertiseIp()}:${HTTP_PORT}/status`,
        servicesUrl: `http://${getLocalAdvertiseIp()}:${HTTP_PORT}/services/describe`,
        capabilityHash: machineAvailability.capabilityHash || getMachineAvailabilityCapabilityHash(),
        beaconAcknowledged: machineAvailability.beaconAcknowledged,
        requestedAt: data.requestedAt || null
      }, 'UDP-DETAILS');
      return;
    }

    if (data && data.kind === 'nodeDetails') {
      discoveredNodes.set(ip, {
        ...node,
        ip,
        nodeName: data.nodeName || data.nodeId || node.nodeName || ip,
        lastSeen: now,
        raw,
        details: {
          ...(node.details || {}),
          ...data
        }
      });
      return;
    }

    if (data && (data.kind === 'nodeBeacon' || data.kind === 'machineAvailability')) {
      const beaconKind = data.kind;
      const capabilityHash = String(data.capabilityHash || '').trim();
      const capabilitiesChanged = Boolean(data.capabilitiesChanged) || (capabilityHash && node?.details?.capabilityHash !== capabilityHash);
      node = {
        ...node,
        ...data,
        ip,
        lastSeen: now,
        raw,
        availability: {
          available: Boolean(data.available),
          draining: Boolean(data.draining),
          status: data.status || (data.available ? 'available' : 'unavailable')
        },
        beacon: {
          kind: beaconKind,
          ackRequired: Boolean(data.ackRequired),
          needsDetails: Boolean(data.needsDetails),
          capabilitiesChanged,
          capabilityHash,
          seenAt: now
        },
        details: {
          ...(node.details || {}),
          capabilityHash,
          needsDetails: Boolean(data.needsDetails)
        }
      };
      discoveredNodes.set(ip, node);
      sendNodeBeaconAck(rinfo.address, rinfo.port, data);
      if (data.needsDetails || capabilitiesChanged) {
        requestNodeDetails(rinfo.address, rinfo.port, data);
      }
      scheduleNodeEnrichment(ip);
      return;
    }

    if (data && (data.kind === 'queueManagerHeartbeat' || data.service === 'queue-manager')) {
      upsertRemoteQueueManager({
        managerId: data.managerId || `${ip}:${data.port || HTTP_PORT}:${data.name || 'qm'}`,
        name: data.name || data.managerName,
        nodeId: data.nodeId || ip,
        ip,
        port: data.port || data.httpPort || HTTP_PORT,
        status: data.status || 'up',
        queues: data.queues
      });
    }
    if (data && data.serviceName) {
      upsertServiceInstance({
        serviceName: data.serviceName,
        instanceId: data.instanceId,
        nodeId: data.nodeId || ip,
        ip,
        port: data.port || data.httpPort || HTTP_PORT,
        status: data.status || 'up',
        metadata: data.metadata
      });
    }
    const availability = data && data.kind === 'machineAvailability'
      ? {
          available: Boolean(data.available),
          draining: Boolean(data.draining),
          status: data.status || (data.available ? 'available' : 'unavailable')
        }
      : (node.availability || null);

    node = {
      ...node,
      ...data,
      ip,
      lastSeen: now,
      availability,
      raw
    };
  } catch (e) {
    // Not JSON, treat as plain text
    node = {
      ...node,
      ip,
      lastSeen: now,
      raw: msg.toString(),
      nodeName: msg.toString().substring(0, 32),
    };
  }
  discoveredNodes.set(ip, node);
  scheduleNodeEnrichment(ip);
});
udpServer.bind(UDP_PORT, () => {
  try {
    udpServer.setBroadcast(true);
  } catch (error) {
    console.warn(`[UDP] Could not enable broadcast mode: ${error.message}`);
  }
  console.log(`[UDP] Listening for node broadcasts on port ${UDP_PORT}`);
});

async function probeEsp32Node(node, visited = new Set()) {
  const host = String(node?.host || '').trim();
  const port = Number(node?.port) > 0 ? Number(node.port) : 80;
  if (!host || visited.has(host)) return;
  visited.add(host);

  const statusUrl = `http://${host}:${port}/status`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ESP32_DISCOVERY_PROBE_TIMEOUT_MS);
  try {
    const statusRes = await fetch(statusUrl, { signal: controller.signal });
    if (!statusRes.ok) return;
    const statusPayload = await statusRes.json();
    if (String(statusPayload?.hardware || '').toUpperCase() !== 'ESP32') return;

    const ip = host;
    const now = Date.now();
    const previous = discoveredNodes.get(ip) || {};
    discoveredNodes.set(ip, {
      ...previous,
      ip,
      nodeName: statusPayload?.nodeName || previous.nodeName || ip,
      lastSeen: now,
      raw: previous.raw || 'active-probe',
      details: {
        ...(previous.details || {}),
        ...statusPayload
      }
    });

    const peers = Array.isArray(statusPayload?.discoveredNodes) ? statusPayload.discoveredNodes : [];
    for (const peer of peers) {
      const peerIp = String(peer?.ip || '').trim();
      if (!peerIp || isLoopbackHost(peerIp)) continue;
      await probeEsp32Node({ host: peerIp, port: 80 }, visited);
    }
  } catch {
    // Ignore transient probe failures.
  } finally {
    clearTimeout(timeout);
  }
}

async function runEsp32DiscoveryProbe() {
  if (!ESP32_DISCOVERY_PROBE_ENABLED) return;
  const visited = new Set();
  for (const node of ESP32_DISCOVERY_PROBE_NODES) {
    await probeEsp32Node(node, visited);
  }
}

if (ESP32_DISCOVERY_PROBE_ENABLED && ESP32_DISCOVERY_PROBE_NODES.length > 0) {
  runEsp32DiscoveryProbe().catch(() => {});
  setInterval(() => {
    runEsp32DiscoveryProbe().catch(() => {});
  }, ESP32_DISCOVERY_PROBE_INTERVAL_MS);
}

// --- Node Cleanup ---
setInterval(() => {
  const now = Date.now();
  for (const [ip, node] of discoveredNodes.entries()) {
    if (now - node.lastSeen > 10 * 60 * 1000) { // 10 min timeout
      discoveredNodes.delete(ip);
      console.log(`[TOPOLOGY] Removed inactive node: ${ip}`);
    }
  }

  for (const [managerId, manager] of queueManagerRegistry.entries()) {
    if (manager.local) {
      manager.lastHeartbeat = now;
      if (MANAGER_ACTIVE_STATES.has(manager.status)) {
        manager.status = 'up';
      }
      queueManagerRegistry.set(managerId, manager);
      continue;
    }
    if (MANAGER_ACTIVE_STATES.has(manager.status) && now - manager.lastHeartbeat > 30 * 1000) {
      manager.status = 'down';
      queueManagerRegistry.set(managerId, manager);
    }
    if (MANAGER_SYNC_STATES.has(manager.status) && now - (manager.lastHeartbeat || 0) > 30 * 1000) {
      manager.status = 'sync-failed';
      manager.syncState = 'failed';
      manager.lastSyncError = 'Manager heartbeat timed out during sync';
      pendingManagerSync.delete(managerId);
      queueManagerRegistry.set(managerId, manager);
    }
  }

  for (const [instanceId, instance] of serviceInstanceRegistry.entries()) {
    if (MANAGER_ACTIVE_STATES.has(instance.status) && now - (instance.lastHeartbeat || 0) > 30 * 1000) {
      instance.status = 'down';
      serviceInstanceRegistry.set(instanceId, instance);
    }
  }
}, 60 * 1000);

// --- Service Topology Enrichment ---
import fetch from 'node-fetch';
function scheduleNodeEnrichment(ip) {
  const key = String(ip || '').trim();
  if (!key) return;
  const now = Date.now();
  const last = nodeEnrichmentLastAttempt.get(key) || 0;
  if (now - last < 5000) return;
  nodeEnrichmentLastAttempt.set(key, now);
  enrichNodeDetails(key).catch(() => {});
}

async function enrichNodeDetails(ip) {
  try {
    const servicesRes = await fetch(`http://${ip}:80/services/describe`);
    const statusRes = await fetch(`http://${ip}:80/status`);
    let details = {};
    if (servicesRes.ok) {
      details = await servicesRes.json();
    }
    if (statusRes.ok) {
      details = { ...details, ...(await statusRes.json()) };
    }
    const node = discoveredNodes.get(ip);
    if (node) {
      node.details = details;
      discoveredNodes.set(ip, node);
    }
  } catch (e) {
    // Ignore unreachable nodes
  }
}

function getActiveQueueManagers() {
  return queueManagers;
}
function getNextQueueManager() {
  // Simple round-robin or always primary for demo
  return queueManagers[0];
}
function updateVirtualNodes() {
  // Dummy implementation
}

function readTransactionLifecycleCompiled() {
  if (!fs.existsSync(TX_LIFECYCLE_COMPILED_PATH)) {
    _txLifecycleCompiledCache = null;
    _txLifecycleCompiledMtimeMs = 0;
    return null;
  }

  try {
    const mtimeMs = fs.statSync(TX_LIFECYCLE_COMPILED_PATH).mtimeMs;
    if (_txLifecycleCompiledCache && mtimeMs === _txLifecycleCompiledMtimeMs) {
      return _txLifecycleCompiledCache;
    }
    const raw = fs.readFileSync(TX_LIFECYCLE_COMPILED_PATH, 'utf-8');
    _txLifecycleCompiledCache = JSON.parse(raw);
    _txLifecycleCompiledMtimeMs = mtimeMs;
    return _txLifecycleCompiledCache;
  } catch (e) {
    console.warn(`[TX-LIFECYCLE] Failed to read compiled file: ${e.message}`);
    return null;
  }
}

const {
  getQueueLengthForLifecycleState,
  incrementLifecycleStateCumulativeCount,
  getLifecycleStateCumulativeCount,
  incrementLifecycleCumulativeByQueue,
  getGatewayQueueMetrics,
  getLifecycleQueueTransformErrorSummary,
  buildTransactionLifecycleDashboardPayload,
  getLifecycleTesterStatsPayload,
  recordLifecycleTesterRun,
  getLifecycleStateByName,
  getLifecycleStateByQueueName,
  getLifecycleOutgoingTransitions
} = createLifecycleQueueMetricsApi({
  queueRoutes,
  queueManagerRegistry,
  queueManagers,
  lifecycleStateCumulativeCounts,
  readTransactionLifecycleCompiled,
  dlqEvents,
  lifecycleHarness,
  getLifecycleHeartbeatPayload,
  lifecycleTesterStats
});

function resolvePathValue(root, pathExpr) {
  const raw = String(pathExpr || '').trim();
  if (!raw) return undefined;
  const normalized = raw.startsWith('$.') ? raw.slice(2) : raw;
  const parts = normalized.split('.').filter(Boolean);

  let current = root;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function parseGuardLiteral(raw) {
  const text = String(raw || '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  const lowered = text.toLowerCase();
  if (lowered === 'true') return true;
  if (lowered === 'false') return false;
  if (!Number.isNaN(Number(text)) && text !== '') return Number(text);
  return text;
}

function valuesEqual(left, right) {
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return Boolean(left) === Boolean(right);
  }
  if (typeof left === 'number' || typeof right === 'number') {
    const ln = Number(left);
    const rn = Number(right);
    if (!Number.isNaN(ln) && !Number.isNaN(rn)) {
      return ln === rn;
    }
  }
  return String(left ?? '').trim().toLowerCase() === String(right ?? '').trim().toLowerCase();
}

function evaluateGuardClause(clause, context = {}) {
  const text = String(clause || '').trim();
  if (!text) return true;

  const match = text.match(/^([A-Za-z0-9_.$-]+)\s*(==|=|!=)\s*(.+)$/);
  if (!match) {
    const v = resolvePathValue(context, text);
    return Boolean(v);
  }

  const [, leftPath, op, rightRaw] = match;
  const leftValue = resolvePathValue(context, leftPath);
  const rightValue = parseGuardLiteral(rightRaw);
  const eq = valuesEqual(leftValue, rightValue);
  return op === '!=' ? !eq : eq;
}

function evaluateLifecycleTransitionGuard(transition, context = {}) {
  const when = String(transition?.when || '').trim();
  if (!when) return true;

  const groups = when.split(/\s+or\s+/i).map(group => group.trim()).filter(Boolean);
  if (groups.length === 0) return true;

  return groups.some(group => {
    const clauses = group.split(/\s+and\s+/i).map(c => c.trim()).filter(Boolean);
    if (clauses.length === 0) return false;
    return clauses.every(clause => evaluateGuardClause(clause, context));
  });
}

function interpolateActionTemplate(raw, context = {}) {
  const input = String(raw || '');
  return input.replace(/\$\{([^}]+)\}/g, (_m, expr) => {
    const v = resolvePathValue(context, String(expr || '').trim());
    return v == null ? '' : String(v);
  });
}

function parseLifecycleAction(action, context = {}) {
  const text = interpolateActionTemplate(action, context).trim();
  if (!text) return { kind: 'none' };

  const mapMatch = text.match(/^map\s+([^\s]+)$/i);
  if (mapMatch) {
    return { kind: 'map', mappingId: String(mapMatch[1] || '').trim().toLowerCase() };
  }

  const enqueueMatch = text.match(/^enqueue\s+([^\s]+)(?:\s+after_ms=(\d+)|\s+after=(\d+)(ms|s|m))?$/i);
  if (enqueueMatch) {
    let delayMs = 0;
    if (enqueueMatch[2]) {
      delayMs = Math.max(0, Number(enqueueMatch[2]) || 0);
    } else if (enqueueMatch[3]) {
      const amount = Math.max(0, Number(enqueueMatch[3]) || 0);
      const unit = String(enqueueMatch[4] || 'ms').toLowerCase();
      if (unit === 's') delayMs = amount * 1000;
      else if (unit === 'm') delayMs = amount * 60000;
      else delayMs = amount;
    }

    return {
      kind: 'enqueue',
      queueName: String(enqueueMatch[1] || '').trim(),
      delayMs
    };
  }

  const httpMatch = text.match(/^http_(sync|async)\s+([A-Za-z]+)\s+("[^"]+"|'[^']+'|[^\s]+)(?:\s+timeout_ms=(\d+))?$/i);
  if (httpMatch) {
    const mode = String(httpMatch[1] || '').toLowerCase();
    const method = String(httpMatch[2] || 'POST').toUpperCase();
    let url = String(httpMatch[3] || '').trim();
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
      url = url.slice(1, -1);
    }

    return {
      kind: mode === 'sync' ? 'http_sync' : 'http_async',
      method,
      url,
      timeoutMs: httpMatch[4] ? Number(httpMatch[4]) : 10000
    };
  }

  const dbMatch = text.match(/^db_(sync|async)\s+(.+)$/i);
  if (dbMatch) {
    const mode = String(dbMatch[1] || '').toLowerCase();
    const spec = String(dbMatch[2] || '').trim();
    return {
      kind: mode === 'sync' ? 'db_sync' : 'db_async',
      spec
    };
  }

  throw new Error(`Unsupported lifecycle action: ${text}`);
}

function toPacsFromMt103(message, fallbackTxId = null, forcedTxId = null) {
  const text = typeof message === 'string' ? message : String(message || '');
  const txIdMatch = text.match(/:20:([^\s\r\n]+)/i);
  const amountMatch = text.match(/:32A:(\d{6})([A-Z]{3})([0-9.,]+)/i);
  const txId = String(forcedTxId || (txIdMatch && txIdMatch[1]) || fallbackTxId || `TX-${Date.now()}`).trim();
  const ccy = (amountMatch && amountMatch[2]) ? String(amountMatch[2]).trim() : 'USD';
  const rawAmount = (amountMatch && amountMatch[3]) ? String(amountMatch[3]).trim() : '0';
  const normalizedAmount = rawAmount.replace(',', '.');

  return {
    Document: {
      FIToFICstmrCdtTrf: {
        GrpHdr: {
          MsgId: txId,
          CreDtTm: new Date().toISOString()
        },
        CdtTrfTxInf: [
          {
            PmtId: {
              InstrId: txId,
              EndToEndId: txId,
              TxId: txId
            },
            IntrBkSttlmAmt: {
              '@Ccy': ccy,
              '#text': normalizedAmount
            }
          }
        ]
      }
    }
  };
}

function toPacsFromMt202(message, fallbackTxId = null, forcedTxId = null) {
  const text = typeof message === 'string' ? message : String(message || '');
  const txIdMatch = text.match(/:20:([^\s\r\n]+)/i);
  const relatedMatch = text.match(/:21:([^\s\r\n]+)/i);
  const amountMatch = text.match(/:32A:(\d{6})([A-Z]{3})([0-9.,]+)/i);
  const txId = String(forcedTxId || (txIdMatch && txIdMatch[1]) || fallbackTxId || `TX-${Date.now()}`).trim();
  const relatedRef = String((relatedMatch && relatedMatch[1]) || txId).trim();
  const ccy = (amountMatch && amountMatch[2]) ? String(amountMatch[2]).trim() : 'USD';
  const rawAmount = (amountMatch && amountMatch[3]) ? String(amountMatch[3]).trim() : '0';
  const normalizedAmount = rawAmount.replace(',', '.');

  return {
    Document: {
      FIToFICstmrCdtTrf: {
        GrpHdr: {
          MsgId: txId,
          CreDtTm: new Date().toISOString()
        },
        CdtTrfTxInf: [
          {
            PmtId: {
              InstrId: txId,
              EndToEndId: relatedRef,
              TxId: txId
            },
            IntrBkSttlmAmt: {
              '@Ccy': ccy,
              '#text': normalizedAmount
            }
          }
        ]
      }
    }
  };
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function objectToXml(name, value, indent = '') {
  if (value == null) {
    return `${indent}<${name}></${name}>`;
  }

  if (typeof value !== 'object') {
    return `${indent}<${name}>${xmlEscape(value)}</${name}>`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => objectToXml(name, item, indent)).join('\n');
  }

  const attrs = [];
  const childEntries = [];
  let textValue = null;

  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('@')) {
      attrs.push(`${k.slice(1)}="${xmlEscape(v)}"`);
    } else if (k === '#text') {
      textValue = v;
    } else {
      childEntries.push([k, v]);
    }
  }

  const attrText = attrs.length ? ` ${attrs.join(' ')}` : '';
  if (childEntries.length === 0) {
    return `${indent}<${name}${attrText}>${xmlEscape(textValue)}</${name}>`;
  }

  const childXml = childEntries
    .map(([childName, childVal]) => objectToXml(childName, childVal, `${indent}  `))
    .join('\n');
  const textSegment = textValue == null ? '' : xmlEscape(textValue);
  if (textSegment) {
    return `${indent}<${name}${attrText}>${textSegment}\n${childXml}\n${indent}</${name}>`;
  }
  return `${indent}<${name}${attrText}>\n${childXml}\n${indent}</${name}>`;
}

function messageObjectToXml(messageObject) {
  if (!messageObject || typeof messageObject !== 'object') {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Document/>`;
  }
  const xmlBody = Object.entries(messageObject)
    .map(([rootName, rootValue]) => objectToXml(rootName, rootValue, ''))
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBody}`;
}

function maybeConvertMtMessageToXml({ inputQueue, message, convertToXml = false }) {
  if (!convertToXml) {
    return { message, converted: false, format: 'original' };
  }

  const text = typeof message === 'string' ? message : String(message || '');
  const queue = String(inputQueue || '').toLowerCase();
  const header = text.trim().slice(0, 20).toUpperCase();
  const looksMt103 = header.startsWith('MT103') || text.toUpperCase().includes(':23B:');
  const looksMt202 = header.startsWith('MT202') || queue.includes('mt202');

  if (!looksMt103 && !looksMt202) {
    return { message, converted: false, format: 'original' };
  }

  const pacsObject = looksMt103
    ? toPacsFromMt103(text)
    : toPacsFromMt202(text);
  return {
    message: messageObjectToXml(pacsObject),
    converted: true,
    format: looksMt103 ? 'mt103->pacs-xml' : 'mt202->pacs-xml'
  };
}

const {
  getDatabaseRegistrySnapshot
} = createDatabaseRegistrySnapshotApi({
  processRef: process,
  SQL_INSTANCE_NAME,
  SQL_SERVER_HOST,
  execFileSync
});

function applyLifecycleMapping(mappingId, message, runtimeContext = {}) {
  const id = String(mappingId || '').trim().toLowerCase();
  if (!id) return message;

  const readPath = (root, pathExpr) => {
    const raw = String(pathExpr || '').trim();
    if (!raw) return undefined;
    const normalized = raw.startsWith('$.') ? raw.slice(2) : raw;
    const parts = normalized.split('.').filter(Boolean);
    let current = root;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  };

  const writePath = (root, pathExpr, value) => {
    const raw = String(pathExpr || '').trim();
    if (!raw) return root;
    const normalized = raw.startsWith('$.') ? raw.slice(2) : raw;
    const parts = normalized.split('.').filter(Boolean);
    if (parts.length === 0) return root;

    let current = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    current[parts[parts.length - 1]] = value;
    return root;
  };

  const toLowerTrim = (value) => String(value == null ? '' : value).trim().toLowerCase();
  const toUpperTrim = (value) => String(value == null ? '' : value).trim().toUpperCase();
  const toTrim = (value) => String(value == null ? '' : value).trim();

  const applyObjectPathMappings = (inputMessage, mappingSpec = []) => {
    const source = (inputMessage && typeof inputMessage === 'object' && !Array.isArray(inputMessage))
      ? inputMessage
      : { value: inputMessage };
    const target = {};

    for (const row of mappingSpec) {
      const sourceValue = readPath(source, row.from);
      const transformed = typeof row.transform === 'function' ? row.transform(sourceValue, source) : sourceValue;
      writePath(target, row.to, transformed);
    }

    return target;
  };

  if (id === 'mt103-to-pacs') {
    if (message && typeof message === 'object' && message.Document && typeof message.Document === 'object') {
      return message;
    }
    const parentEntityId = extractSwiftReferenceFromMessage(message);
    const generatedChildId = runtimeContext?.worker?.workerId
      ? `${runtimeContext.worker.workerId}-${Date.now()}-PACS`
      : `PACS-${Date.now()}`;
    const childEntityId = parentEntityId ? `${parentEntityId}-PACS` : generatedChildId;
    const mapped = toPacsFromMt103(message, childEntityId, childEntityId);
    if (mapped && typeof mapped === 'object') {
      mapped.journalRelation = {
        parentEntityId: parentEntityId || null,
        childEntityId,
        comment: parentEntityId
          ? `Mapped MT103 ${parentEntityId} into PACS ${childEntityId}`
          : `Mapped MT103 into PACS ${childEntityId}`
      };
    }
    return mapped;
  }

  if (id === 'payment-to-transaction-inquiry') {
    return applyObjectPathMappings(message, [
      { from: 'payment.reference', to: 'reference', transform: toTrim },
      { from: 'payment.reference', to: 'entityId', transform: toTrim },
      { from: 'payment.reference', to: 'transaction.id', transform: toTrim },
      { from: 'payment.receivedAt', to: 'transaction.receivedAt', transform: toTrim },
      { from: 'payment.amount', to: 'payment.amount' },
      { from: 'payment.currency', to: 'payment.currency', transform: toUpperTrim },
      { from: 'payment.sender', to: 'payment.sender', transform: toTrim },
      { from: 'payment.receiver', to: 'payment.receiver', transform: toTrim },
      { from: 'gateway.rtgs', to: 'gateway.rtgs', transform: toLowerTrim },
      { from: 'gateway.swift', to: 'gateway.swift', transform: toLowerTrim },
      { from: 'lifecycle.stage', to: 'lifecycle.stage', transform: toLowerTrim },
      { from: 'lifecycle.outcome', to: 'lifecycle.outcome', transform: toLowerTrim }
    ]);
  }

  if (id === 'transaction-to-support-response') {
    return applyObjectPathMappings(message, [
      { from: 'reference', to: 'paymentReference', transform: toTrim },
      { from: 'entityId', to: 'transactionId', transform: toTrim },
      { from: 'transaction.receivedAt', to: 'receivedAt', transform: toTrim },
      { from: 'transaction.replySentAt', to: 'replySentAt', transform: toTrim },
      { from: 'lifecycle.currentStatus', to: 'currentStatus', transform: toLowerTrim },
      { from: 'lifecycle.blockingReason', to: 'blockingReason', transform: toTrim },
      { from: 'lifecycle.nextAction', to: 'nextAction', transform: toTrim }
    ]);
  }

  throw new Error(`Unsupported lifecycle mapping: ${id}`);
}

async function runLifecycleTransitionAction(action, runtimeContext, workerState) {
  const parsed = parseLifecycleAction(action, runtimeContext);
  if (parsed.kind === 'none') return;

  if (parsed.kind === 'map') {
    if (LIFECYCLE_FORCE_MAP_DELAY_MS > 0) {
      await delayMs(LIFECYCLE_FORCE_MAP_DELAY_MS);
    }
    if (LIFECYCLE_FORCE_MAP_FAILURE) {
      const forcedError = new Error('Forced map failure (LIFECYCLE_FORCE_MAP_FAILURE=true)');
      forcedError.code = 'LIFECYCLE_FORCE_MAP_FAILURE';
      throw forcedError;
    }
    runtimeContext.message = applyLifecycleMapping(parsed.mappingId, runtimeContext.message, runtimeContext);
    return;
  }

  if (parsed.kind === 'enqueue') {
    if (!parsed.queueName) return;
    if (Number(parsed.delayMs) > 0) {
      const parentEntityId = extractSwiftReferenceFromMessage(runtimeContext?.inputMessage || runtimeContext.message);
      const childEntityId = extractSwiftReferenceFromMessage(runtimeContext.message);
      const scheduled = schedulePersistentDispatch({
        queueName: parsed.queueName,
        message: runtimeContext.message,
        sourceService: `${workerState.sourceService}:action`,
        delayMs: Number(parsed.delayMs),
        comment: `Scheduled lifecycle enqueue after ${Number(parsed.delayMs)}ms for queue ${parsed.queueName}`,
        parentEntityId,
        childEntityId
      });
      appendTransactionJournalComment(parentEntityId, `Scheduled child dispatch to ${parsed.queueName} after ${Number(parsed.delayMs)}ms.`, {
        eventKind: 'scheduled-dispatch-queued',
        queueName: parsed.queueName,
        relation: childEntityId ? { childEntityId } : null,
        details: {
          dispatchId: scheduled.id,
          dueAt: scheduled.dueAt,
          delayMs: Number(parsed.delayMs)
        }
      });
      return;
    }
    const actionRoute = ensureRoute(parsed.queueName);
    if (!actionRoute) {
      throw new Error(`No available queue managers for action queue ${parsed.queueName}`);
    }
    await enqueueViaRoute(
      actionRoute,
      parsed.queueName,
      runtimeContext.message,
      `${workerState.sourceService}:action`,
      null,
      inferQueueDataTypeIds(parsed.queueName)
    );
    return;
  }

  if (parsed.kind === 'http_sync' || parsed.kind === 'http_async') {
    const method = parsed.method || 'POST';
    const bodyAllowed = !['GET', 'HEAD', 'DELETE'].includes(method);
    const options = {
      method,
      headers: {
        'content-type': 'application/json'
      }
    };
    if (bodyAllowed) {
      options.body = JSON.stringify(runtimeContext.message);
    }

    if (parsed.kind === 'http_async') {
      fetch(parsed.url, options).catch(e => {
        console.warn(`[LIFECYCLE] Async HTTP action failed (${parsed.url}): ${e.message}`);
      });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(parsed.timeoutMs) || 10000);
    try {
      const response = await fetch(parsed.url, { ...options, signal: controller.signal });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP_SYNC ${parsed.url} failed (${response.status}): ${errBody.slice(0, 300)}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (parsed.kind === 'db_sync' || parsed.kind === 'db_async') {
    const isSync = parsed.kind === 'db_sync';
    const allowed = isSync ? lifecycleActionPolicy.allowDbSync : lifecycleActionPolicy.allowDbAsync;
    if (!allowed) {
      throw new Error(
        `${parsed.kind.toUpperCase()} is disabled by policy. Use HTTP_SYNC/HTTP_ASYNC to an approved data service or enable policy explicitly.`
      );
    }

    throw new Error(
      `${parsed.kind.toUpperCase()} is enabled by policy but no DB adapter is configured. Spec: ${parsed.spec}`
    );
  }
}

async function enqueueLifecycleStateMessage(compiled, stateName, message, sourceService = 'lifecycle-harness', eventName = null) {
  const state = getLifecycleStateByName(compiled, stateName);
  const queueName = String(state?.queueName || '').trim();
  if (!queueName) {
    return { enqueued: false, reason: 'state has no queue binding' };
  }
  const route = ensureRoute(queueName);
  if (!route) {
    throw new Error(`No available queue managers for lifecycle queue ${queueName}`);
  }

  const statusStampedMessage = annotateLifecycleMessageForState(compiled, stateName, message, eventName);
  const delivery = await enqueueViaRoute(route, queueName, statusStampedMessage, sourceService, null, inferQueueDataTypeIds(queueName));
  return { enqueued: true, queueName, delivery };
}

async function dequeueLifecycleStateMessage(compiled, stateName, consumerService = 'lifecycle-harness') {
  const state = getLifecycleStateByName(compiled, stateName);
  const queueName = String(state?.queueName || '').trim();
  if (!queueName) {
    return { dequeued: false, reason: 'state has no queue binding', message: null };
  }

  const message = await dequeueViaRoute(queueName, consumerService);
  if (message == null) {
    return { dequeued: false, queueName, message: null };
  }
  return { dequeued: true, queueName, message };
}

function buildDefaultMt103Message(txId) {
  return `MT103\n:20:${txId}\n:32A:260514USD12500,\n:50K:APPLICANT CORP\n:57A:BKTRUS33\n:59:/000123456\nBENEFICIARY LTD`;
}

function extractSwiftReferenceFromMessage(message) {
  if (typeof message === 'string') {
    const match = message.match(/^:20:(.+)$/m);
    return match ? String(match[1] || '').trim() : null;
  }

  if (message && typeof message === 'object') {
    const refs = [
      message?.reference,
      message?.transactionRef,
      message?.txId,
      message?.paymentRef,
      message?.Document?.FIToFICstmrCdtTrf?.GrpHdr?.MsgId,
      message?.Document?.FIToFICstmrCdtTrf?.CdtTrfTxInf?.[0]?.PmtId?.EndToEndId,
      message?.Document?.FIToFICstmrCdtTrf?.CdtTrfTxInf?.[0]?.PmtId?.TxId,
      message?.Document?.FIToFICstmrCdtTrf?.CdtTrfTxInf?.[0]?.PmtId?.InstrId
    ];
    const found = refs.find(v => String(v || '').trim());
    return found ? String(found).trim() : null;
  }

  return null;
}

function buildMt940ForReference(reference) {
  const ref = String(reference || `REF-${Date.now()}`).trim();
  const yyMMdd = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `MT940\n:20:${ref}\n:25:CORR-ACCOUNT-001\n:61:${yyMMdd}C12500,NTRFNONREF//${ref}\n:86:Settlement confirmed for ${ref}`;
}

function annotateLifecycleMessageForState(compiled, stateName, message, eventName = null) {
  const state = getLifecycleStateByName(compiled, stateName);
  const stateId = String(state?.name || stateName || '').trim();
  const stateLabel = String(state?.label || stateId).trim();
  const queueName = String(state?.queueName || '').trim();
  const now = new Date().toISOString();
  if (!stateId) return message;

  const isTerminal = getLifecycleOutgoingTransitions(compiled, stateId).length === 0;

  if (typeof message === 'string') {
    const statusLine = `:79:STATE=${stateId};LABEL=${stateLabel};EVENT=${String(eventName || '').trim()};AT=${now};QUEUE=${queueName};TERMINAL=${isTerminal ? 'true' : 'false'}`;
    const withoutPriorStatus = message
      .split('\n')
      .filter(line => !line.startsWith(':79:STATE='))
      .join('\n');
    return `${withoutPriorStatus}\n${statusLine}`;
  }

  if (message && typeof message === 'object') {
    return {
      ...message,
      lifecycleStatus: {
        state: stateId,
        label: stateLabel,
        queueName,
        eventName: String(eventName || '').trim() || null,
        terminal: isTerminal,
        updatedAt: now
      }
    };
  }

  return message;
}

function inferMessageType(message) {
  if (typeof message === 'string') {
    const head = String(message || '').trim().toUpperCase();
    if (head.startsWith('MT103')) return 'MT103';
    if (head.startsWith('MT940')) return 'MT940';
    return 'text';
  }
  if (message && typeof message === 'object') return 'json';
  return 'unknown';
}

async function recordTransactionStateTransition(compiled, {
  message,
  fromState = null,
  toState,
  eventName = null,
  queueName = null,
  traceContext = null
} = {}) {
  const writeEntry = buildTxStateDbWriteEntry(compiled, {
    message,
    fromState,
    toState,
    eventName,
    queueName,
    traceContext
  });
  if (!writeEntry) return;

  appendTransactionTraceEvent(buildTransactionTraceEvent(writeEntry, traceContext || {}));

  try {
    await writeTransactionStateToDb(writeEntry);
    txStatePersistenceStats.realtimeWrites += 1;
    txStatePersistenceStats.lastRealtimeWriteAt = new Date().toISOString();
  } catch (e) {
    if (!txStateDbWarned) {
      txStateDbWarned = true;
      console.warn(`[TX-STATE] MSSQL transaction-state persistence unavailable: ${formatErrorDetails(e)}`);
    }
    if (TX_STATE_EMERGENCY_LOG_SHIPPING) {
      queueTransactionStateForLogShipping(writeEntry, formatErrorDetails(e));
      return;
    }
    throw new Error(`[TX-STATE] Realtime DB write required and fallback disabled: ${formatErrorDetails(e)}`);
  }
}

function getLifecycleTransitionOptions(compiled, currentState) {
  const outgoing = getLifecycleOutgoingTransitions(compiled, currentState);
  return outgoing.map((transition) => {
    const toInfo = getLifecycleStateByName(compiled, transition.to);
    return {
      eventName: String(transition?.event || '').trim() || null,
      toState: String(transition?.to || '').trim() || null,
      toStateLabel: String(toInfo?.label || transition?.to || '').trim() || null,
      guard: transition?.when || null,
      action: transition?.action || null
    };
  });
}

async function getFsmEntityStateFromSql(entityId, { historyLimit = 50 } = {}) {
  const pool = await getTransactionStateMssqlPool();
  const limit = Math.max(1, Math.min(500, Number(historyLimit) || 50));

  const currentRs = await pool.request()
    .input('entity_id', txMssql.NVarChar(128), String(entityId || '').trim())
    .query(`SELECT TOP 1 * FROM ${FSM_MSSQL_CURRENT_TABLE_SQL} WHERE entity_id = @entity_id`);

  const current = currentRs.recordset?.[0] || null;
  if (!current) return null;

  const historyRs = await pool.request()
    .input('entity_id', txMssql.NVarChar(128), String(entityId || '').trim())
    .input('limit', txMssql.Int, limit)
    .query(`SELECT TOP (@limit) * FROM ${FSM_MSSQL_HISTORY_TABLE_SQL} WHERE entity_id = @entity_id ORDER BY id DESC`);

  return {
    current,
    history: historyRs.recordset || []
  };
}

async function getFsmTransactionSummaryFromSql({ windowMinutes = 60 } = {}) {
  const pool = await getTransactionStateMssqlPool();
  const minutes = Math.max(1, Math.min(7 * 24 * 60, Number(windowMinutes) || 60));

  const rs = await pool.request()
    .input('window_minutes', txMssql.Int, minutes)
    .query(`
DECLARE @since DATETIME2 = DATEADD(minute, -@window_minutes, SYSUTCDATETIME());
SELECT
  @since AS since_utc,
  (SELECT COUNT(DISTINCT entity_id)
   FROM ${FSM_MSSQL_HISTORY_TABLE_SQL}
   WHERE updated_at >= @since) AS processed_count,
  (SELECT COUNT(*)
   FROM ${FSM_MSSQL_CURRENT_TABLE_SQL}
   WHERE updated_at >= @since
     AND (
       LOWER(state_id) IN ('reconciled', 'settled')
       OR LOWER(ISNULL(queue_name, '')) = 'tx.reconciled'
       OR is_terminal = 1
     )) AS settled_count,
  (SELECT COUNT(*)
   FROM ${FSM_MSSQL_CURRENT_TABLE_SQL}
   WHERE updated_at >= @since
     AND LOWER(state_id) = 'reconciled') AS reconciled_count,
  (SELECT COUNT(*)
   FROM ${FSM_MSSQL_CURRENT_TABLE_SQL}
   WHERE updated_at >= @since
     AND is_terminal = 1) AS terminal_count
`);

  const row = rs.recordset?.[0] || {};
  return {
    windowMinutes: minutes,
    sinceUtc: row.since_utc || null,
    processedCount: Number(row.processed_count) || 0,
    settledCount: Number(row.settled_count) || 0,
    reconciledCount: Number(row.reconciled_count) || 0,
    terminalCount: Number(row.terminal_count) || 0
  };
}

function extractEntityIdFromInquiry(queryText) {
  const text = String(queryText || '').trim();
  if (!text) return null;

  const stopwords = new Set([
    'transaction',
    'transactions',
    'entity',
    'entities',
    'reference',
    'references',
    'ref',
    'all',
    'settled',
    'reconciled',
    'status',
    'state',
    'states',
    'summary',
    'where',
    'what',
    'show',
    'list'
  ]);

  const patterns = [
    /\b(?:transactions?|tx|entities?|references?|ref)\b\s*[:#-]?\s*([A-Za-z0-9._-]{4,128})/i,
    /\b([A-Za-z]{2,10}\d{4,64})\b/,
    /\b([A-Za-z0-9._-]{6,128})\b/
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = String(match[1]).trim();
      const candidateLower = candidate.toLowerCase();
      if (!candidate) continue;
      if (stopwords.has(candidateLower)) continue;

      // The generic fallback pattern should not promote plain words to entity IDs.
      if (i === 2) {
        const hasDigit = /\d/.test(candidate);
        const hasDelimiter = /[-_.]/.test(candidate);
        if (!hasDigit && !hasDelimiter) continue;
      }

      return candidate;
    }
  }

  return null;
}

function isSettlementSummaryInquiry(queryText) {
  const text = String(queryText || '').toLowerCase();
  if (!text) return false;
  if (/\bare\s+all\s+transactions?\b/.test(text)) return true;
  if (/\bare\s+these\s+references?\s+settled\b/.test(text)) return true;
  if (/\breferences?\b/.test(text) && /\bsettled|reconciled\b/.test(text)) return true;
  if (/\b(all|overall|summary)\b/.test(text) && /\b(transactions?|payments?)\b/.test(text) && /\b(settled|reconciled|complete|final)\b/.test(text)) return true;
  return false;
}

function extractEntityRefsFromInquiry(queryText) {
  const text = String(queryText || '');
  const candidates = text.match(/\b[A-Za-z]{2,10}\d{4,64}\b/g) || [];
  const normalized = Array.from(new Set(candidates.map(v => String(v || '').trim()).filter(Boolean)));
  return normalized.slice(0, 100);
}

function buildDefaultPacsMessage(txId) {
  const id = String(txId || `PACS-${Date.now()}`);
  return {
    Document: {
      FIToFICstmrCdtTrf: {
        GrpHdr: {
          MsgId: id,
          CreDtTm: new Date().toISOString()
        },
        CdtTrfTxInf: [
          {
            PmtId: {
              InstrId: id,
              EndToEndId: id,
              TxId: id
            },
            IntrBkSttlmAmt: {
              '@Ccy': 'USD',
              '#text': '12500.00'
            }
          }
        ]
      }
    }
  };
}

function touchLifecycleActivity() {
  lifecycleHeartbeat.lastActivityMs = Date.now();
}

function getLifecycleHeartbeatPayload() {
  return {
    enabled: lifecycleHeartbeat.enabled,
    inactivityMs: lifecycleHeartbeat.inactivityMs,
    checkIntervalMs: lifecycleHeartbeat.checkIntervalMs,
    lastActivityAt: lifecycleHeartbeat.lastActivityMs ? new Date(lifecycleHeartbeat.lastActivityMs).toISOString() : null,
    lastHeartbeatAt: lifecycleHeartbeat.lastHeartbeatMs ? new Date(lifecycleHeartbeat.lastHeartbeatMs).toISOString() : null,
    lastHeartbeatTxId: lifecycleHeartbeat.lastHeartbeatTxId,
    autoRuns: lifecycleHeartbeat.autoRuns,
    manualRuns: lifecycleHeartbeat.manualRuns,
    lastError: lifecycleHeartbeat.lastError
  };
}

async function enqueueLifecycleHeartbeat(compiled, { reason = 'manual', sourceService = 'lifecycle-heartbeat:manual' } = {}) {
  const initialState = String(compiled?.initialState || '').trim();
  if (!initialState) {
    throw new Error('Compiled lifecycle has no initialState');
  }

  const txId = `HB-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payload = buildDefaultMt103Message(txId);
  await enqueueLifecycleStateMessage(compiled, initialState, payload, sourceService);
  touchLifecycleActivity();

  lifecycleHarness.history.push({
    at: new Date().toISOString(),
    kind: 'heartbeat',
    reason,
    transactionId: txId,
    state: initialState
  });

  lifecycleHeartbeat.lastHeartbeatMs = Date.now();
  lifecycleHeartbeat.lastHeartbeatTxId = txId;
  lifecycleHeartbeat.lastError = null;
  return { txId, state: initialState };
}

async function maybeRunLifecycleHeartbeat() {
  if (!lifecycleHeartbeat.enabled || lifecycleHeartbeat.running) {
    return;
  }
  lifecycleHeartbeat.running = true;
  try {
    const now = Date.now();
    if (now - lifecycleHeartbeat.lastActivityMs < lifecycleHeartbeat.inactivityMs) {
      return;
    }
    if (lifecycleHeartbeat.lastHeartbeatMs > 0 && now - lifecycleHeartbeat.lastHeartbeatMs < lifecycleHeartbeat.inactivityMs) {
      return;
    }

    const compiled = readTransactionLifecycleCompiled();
    if (!compiled) {
      return;
    }
    const heartbeat = await enqueueLifecycleHeartbeat(compiled, {
      reason: 'auto-idle-timeout',
      sourceService: 'lifecycle-heartbeat:auto'
    });
    lifecycleHeartbeat.autoRuns += 1;
    console.log(`[LIFECYCLE] Auto heartbeat queued: ${heartbeat.txId}`);
  } catch (e) {
    lifecycleHeartbeat.lastError = e.message;
    console.warn(`[LIFECYCLE] Heartbeat monitor error: ${e.message}`);
  } finally {
    lifecycleHeartbeat.running = false;
  }
}

function startLifecycleHeartbeatMonitor() {
  if (lifecycleHeartbeat.timerId) {
    return;
  }
  lifecycleHeartbeat.timerId = setInterval(() => {
    void maybeRunLifecycleHeartbeat();
  }, lifecycleHeartbeat.checkIntervalMs);
}

const {
  lifecycleHarnessStartTransaction,
  lifecycleHarnessAdvance,
  deriveLifecycleHappyPath,
  deriveLifecycleSadPath,
  runLifecycleHappyPath,
  runLifecycleSadPath
} = createLifecycleHarnessPathApi({
  lifecycleHarness,
  touchLifecycleActivity,
  getLifecycleOutgoingTransitions,
  evaluateLifecycleTransitionGuard,
  buildDefaultMt103Message,
  buildDefaultPacsMessage,
  dequeueLifecycleStateMessage,
  enqueueLifecycleStateMessage,
  runLifecycleTransitionAction,
  recordTransactionStateTransition
});

function registerRoutes(app) {
  function startSecondaryBroker() {
    if (globalThis.brokerClassDown) {
      throw new Error('Broker class is down. Bring class up before starting secondary broker.');
    }
    const secondary = getOrCreateBrokerInstance('secondary');
    if (secondaryBroker && secondary.active) {
      return { status: 'already running' };
    }
    if (!secondaryBroker) {
      secondaryBroker = createConfiguredBroker();
    }
    setBrokerInstanceState('secondary', { active: true, quiesced: false });
    return { status: 'secondary broker started' };
  }

  app.get('/api/time/authority', (req, res) => {
    res.json({
      status: 'ok',
      time: authoritativeTimeService.getSnapshot(),
      sync: {
        enabled: TIME_NTP_ENABLED,
        server: TIME_NTP_SERVER,
        port: TIME_NTP_PORT,
        intervalMs: TIME_NTP_SYNC_INTERVAL_MS,
        timeoutMs: TIME_NTP_TIMEOUT_MS,
        running: authoritativeTimeSyncState.running,
        lastAttemptAt: authoritativeTimeSyncState.lastAttemptAt,
        lastSuccessAt: authoritativeTimeSyncState.lastSuccessAt,
        lastError: authoritativeTimeSyncState.lastError
      }
    });
  });

  app.post('/api/time/query', (req, res) => {
    try {
      const userId = String(req.get('x-user-id') || req.body?.userId || DEFAULT_ACTOR_USER_ID || 'system-admin').trim();
      res.json({ status: 'ok', ...temporalQueryService.query({ query: req.body?.query, userId }) });
    } catch (error) {
      res.status(400).json({ status: 'error', error: error?.message || String(error) });
    }
  });

  app.get('/api/users/timezone', (req, res) => {
    const userId = String(req.get('x-user-id') || req.query?.userId || DEFAULT_ACTOR_USER_ID || 'system-admin').trim();
    res.json({ status: 'ok', userId, timeZone: temporalQueryService.getUserTimeZone(userId) });
  });

  app.put('/api/users/timezone', (req, res) => {
    try {
      const userId = String(req.get('x-user-id') || req.body?.userId || DEFAULT_ACTOR_USER_ID || 'system-admin').trim();
      const timeZone = temporalQueryService.setUserTimeZone(userId, req.body?.timeZone || req.body?.location);
      res.json({ status: 'ok', userId, timeZone });
    } catch (error) {
      res.status(400).json({ status: 'error', error: error?.message || String(error) });
    }
  });

  app.get('/api/calendars', (req, res) => {
    res.json({ status: 'ok', calendars: businessCalendarService.listCalendars() });
  });

  app.get('/api/calendar/month', (req, res) => {
    try {
      res.json({
        status: 'ok',
        ...businessCalendarService.getMonth({
          query: String(req.query?.query || ''),
          calendarId: String(req.query?.calendarId || ''),
          year: req.query?.year,
          month: req.query?.month
        })
      });
    } catch (error) {
      res.status(400).json({ status: 'error', error: error?.message || String(error) });
    }
  });

  app.get('/api/evolution-test/status', (req, res) => {
    const runtime = {
      runId: evolutionTestRuntime.runId,
      status: evolutionTestRuntime.status,
      running: Boolean(evolutionTestRuntime.child),
      pid: evolutionTestRuntime.child?.pid || null,
      startedAt: evolutionTestRuntime.startedAt,
      stoppedAt: evolutionTestRuntime.stoppedAt,
      lastExitCode: evolutionTestRuntime.lastExitCode,
      lastSignal: evolutionTestRuntime.lastSignal,
      lastError: evolutionTestRuntime.lastError,
      params: evolutionTestRuntime.params,
      logs: evolutionTestRuntime.logs.slice(-120)
    };

    res.json({
      status: 'ok',
      runtime,
      drift: computeEvolutionDriftSnapshot(evolutionTestRuntime.params)
    });
  });

  app.post('/api/evolution-test/start', (req, res) => {
    if (evolutionTestRuntime.child) {
      return res.status(409).json({ error: 'Evolution test is already running.' });
    }

    const body = req.body || {};
    const manifestInput = String(body.manifest || 'data/evolution-manifest-4.json').trim();
    const manifestPath = resolveEvolutionPath(manifestInput);
    if (!fs.existsSync(manifestPath)) {
      return res.status(400).json({ error: `Manifest not found: ${manifestInput}` });
    }

    const cycles = parseEvolutionInteger(body.cycles, 10, 1, 200000);
    const transactions = parseEvolutionInteger(body.transactions ?? body.runs, 10000, 1, 1000000);
    const concurrency = parseEvolutionInteger(body.concurrency, 4, 1, 64);
    const generation = parseEvolutionInteger(body.generation, 7000, 0, 5000000);
    const replacementInterval = parseEvolutionInteger(body.replacementInterval, 100, 1, 1000000);
    const maxPopulation = parseEvolutionInteger(body.maxPopulation, 200, 1, 2000);
    const birthLimit = parseEvolutionInteger(body.birthLimit, 25, 1, 1000000);
    const deathLimit = parseEvolutionInteger(body.deathLimit, 100, 1, 1000000);
    const organismIdleTtlMs = parseEvolutionInteger(body.organismIdleTtlMs, 60000, 1000, 86400000);
    const executionTarget = String(body.executionTarget || 'js').trim().toLowerCase() || 'js';
    const backendUrl = String(body.backendUrl || process.env.BACKEND_URL || 'http://127.0.0.1:4000').trim() || 'http://127.0.0.1:4000';
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'evolution-first-slice.mjs');

    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({ error: 'Evolution script not found.' });
    }

    resetEvolutionRuntimeState();
    clearEvolutionRunArtifacts(generation, cycles);

    const args = [
      scriptPath,
      '--manifest', manifestPath,
      '--transactions', String(transactions),
      '--cycles', String(cycles),
      '--generation', String(generation),
      '--concurrency', String(concurrency),
      '--replacement-interval', String(replacementInterval),
      '--max-population', String(maxPopulation),
      '--birth-limit', String(birthLimit),
      '--death-limit', String(deathLimit),
      '--organism-idle-ttl-ms', String(organismIdleTtlMs),
      '--execution-target', executionTarget,
      '--backend-url', backendUrl
    ];

    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    evolutionTestRuntime.runId = 1;
    evolutionTestRuntime.child = child;
    evolutionTestRuntime.status = 'running';
    evolutionTestRuntime.startedAt = new Date().toISOString();
    evolutionTestRuntime.stoppedAt = null;
    evolutionTestRuntime.lastExitCode = null;
    evolutionTestRuntime.lastSignal = null;
    evolutionTestRuntime.lastError = null;
    evolutionTestRuntime.params = {
      manifest: manifestInput,
      transactions,
      cycles,
      concurrency,
      generation,
      replacementInterval,
      maxPopulation,
      birthLimit,
      deathLimit,
      organismIdleTtlMs,
      executionTarget,
      backendUrl
    };
    evolutionTestRuntime.logs = [];

    child.stdout.on('data', (chunk) => {
      const lines = String(chunk || '').split(/\r?\n/);
      for (const line of lines) appendEvolutionRuntimeLog('stdout', line);
    });

    child.stderr.on('data', (chunk) => {
      const lines = String(chunk || '').split(/\r?\n/);
      for (const line of lines) appendEvolutionRuntimeLog('stderr', line);
    });

    child.on('error', (error) => {
      evolutionTestRuntime.lastError = String(error?.message || error || 'spawn-error');
      evolutionTestRuntime.status = 'error';
      evolutionTestRuntime.stoppedAt = new Date().toISOString();
      evolutionTestRuntime.child = null;
      appendEvolutionRuntimeLog('system', `spawn error: ${evolutionTestRuntime.lastError}`);
    });

    child.on('exit', (code, signal) => {
      evolutionTestRuntime.lastExitCode = Number.isFinite(code) ? code : null;
      evolutionTestRuntime.lastSignal = signal || null;
      evolutionTestRuntime.status = code === 0 ? 'completed' : 'stopped';
      evolutionTestRuntime.stoppedAt = new Date().toISOString();
      evolutionTestRuntime.child = null;
      appendEvolutionRuntimeLog('system', `process exited code=${code} signal=${signal || 'none'}`);
    });

    return res.status(202).json({
      status: 'started',
      runId: evolutionTestRuntime.runId,
      pid: child.pid,
      params: evolutionTestRuntime.params
    });
  });

  app.post('/api/evolution-test/stop', (req, res) => {
    if (!evolutionTestRuntime.child) {
      return res.json({ status: 'not-running' });
    }

    const pid = evolutionTestRuntime.child.pid;
    evolutionTestRuntime.status = 'stopping';
    const stopped = evolutionTestRuntime.child.kill('SIGTERM');
    appendEvolutionRuntimeLog('system', `stop requested for pid=${pid}`);
    return res.json({ status: stopped ? 'stopping' : 'stop-failed', pid });
  });

  app.post('/api/time/authority/sync', async (req, res) => {
    const result = await syncAuthoritativeTimeWithNtp({ reason: 'manual-api' });
    if (!result.ok && !result.skipped) {
      return res.status(502).json({
        status: 'error',
        error: result.error,
        time: authoritativeTimeService.getSnapshot()
      });
    }

    return res.json({
      status: result.skipped ? 'skipped' : 'ok',
      result,
      time: authoritativeTimeService.getSnapshot()
    });
  });

  app.get('/api/journal/dispatch-queue', requirePermission('lifecycle.read'), (_req, res) => {
    const items = readScheduledDispatchQueue();
    res.json({
      status: 'ok',
      summary: getScheduledDispatchQueueSummary(),
      items
    });
  });

  app.post('/api/journal/dispatch-queue', requirePermission('lifecycle.manage'), (req, res) => {
    try {
      const item = schedulePersistentDispatch({
        queueName: req?.body?.queueName,
        message: req?.body?.message,
        sourceService: req?.body?.sourceService || 'api:scheduled-dispatch',
        dueAt: req?.body?.dueAt || null,
        delayMs: req?.body?.delayMs || 0,
        comment: req?.body?.comment || null,
        targetManagerId: req?.body?.targetManagerId || null,
        targetNodeId: req?.body?.targetNodeId || null,
        parentEntityId: req?.body?.parentEntityId || null,
        childEntityId: req?.body?.childEntityId || null
      });
      res.status(201).json({ status: 'scheduled', item });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  registerMediaGatewayRoutes(app, {
    parseJson: express.json,
    pathJoin: path.join,
    getMapPlacementSummary,
    normalizeMapPlacementEntry,
    mapPlacementState,
    persistMapPlacementRegistry,
    buildMapKeyFromParts,
    chooseMapPlacement,
    pruneMapPlacementRuntimeState,
    toFiniteNumber,
    LOCAL_TTS_SCRIPT_PATH,
    LOCAL_TTS_OUTPUT_DIR,
    runLocalTtsScript,
    clampInteger,
    PIPER_BIN_PATH,
    PIPER_MODEL_PATH,
    runPiperSynthesis,
    playWavOnHost,
    forwardEsp32BluetoothTts
  });

  registerOllamaRoutes(app);

  registerIdentityRoutes(app, {
    normalizeUserIdentifier,
    getUserById,
    verifyPasswordRecord,
    createAuthSession,
    getSessionFromToken,
    resolveActor,
    AUTH_SESSION_TTL_MS,
    getBearerTokenFromRequest,
    clearSessionFromToken,
    getProfilesById,
    USER_ORGANIZATION_NAME,
    requirePermission,
    buildUserRoleContext,
    userManagementStore,
    groupProvider,
    refreshGroupPrivilegeCache,
    sanitizePermissions,
    saveUserManagement,
    sanitizeProfileIds,
    sanitizeUserForApi,
    monitorClassProvider,
    isAcceptedUserIdentifier,
    resolveDirectoryProfile,
    isValidEmailIdentifier,
    sanitizeGroupIds,
    createPasswordRecord,
    DEFAULT_ACTOR_USER_ID
  });
  registerUserProvisioningRoutes(app, {
    requirePermission,
    resolveActor,
    normalizeUserIdentifier,
    isValidEmailIdentifier,
    sanitizeProfileIds,
    userManagementStore,
    USER_ORGANIZATION_NAME,
    saveUserManagement,
    sanitizeUserForApi,
    dataRoot: path.join(__dirname, 'data')
  });

  registerDeveloperGovernanceRoutes(app, {
    requirePermission,
    enumerateApiCatalog,
    processGovernanceStore,
    getProcessPolicyById,
    saveProcessGovernance,
    pendingApprovalRequests,
    appendAuditEvent
  });

  registerOrchestrationRegistryRoutes(app, {
    HTTP_PORT,
    SUPERVISOR_HEARTBEAT_TTL_MS,
    queueManagerRegistry,
    pendingManagerSync,
    remoteAgentRegistry,
    remoteQueueManagerProcesses,
    queueRoutes,
    queueManagers,
    MANAGER_ACTIVE_STATES,
    upsertRemoteQueueManager,
    upsertServiceInstance,
    normalizeSupervisorHeartbeatPayload,
    isSupervisorHeartbeatFresh,
    getSupervisorHeartbeatSnapshot,
    getSupervisorHeartbeatEntry,
    getDatabaseRegistrySnapshot,
    getLocalQueueManagerLaunchers,
    getRemoteAgentsPayload,
    normalizeRemoteAgentUrl,
    getRemoteAgentOrThrow,
    callRemoteAgent,
    getRemoteLaunchersPayload,
    pickSyncSourceManager,
    waitForManagerRegistration,
    syncManagerBeforeActivation,
    launchLocalQueueManager,
    stopLocalQueueManager,
    setNodeLifecycleState,
    getNodeDrainStatus,
    setQueueManagerStatus,
    supervisorHeartbeatRegistry
  });

  const ROUTE_ROLE_MANIFEST = loadRouteManifest();
  registerRoutesFromManifest({
    app,
    manifest: ROUTE_ROLE_MANIFEST,
    registrars: {
      registerLifecycleInquiryRoutes,
      registerLifecycleWorkerGatewayRoutes,
      registerQueueBrokerOpsRoutes,
      registerComplianceRoutes,
      registerGovernanceRolePolicyRoutes,
      registerObservabilityRoutes,
      registerPlatformRoutes,
      registerReplicationRoutes,
      registerQueueConfigRoutes,
      registerQueueTransferRoutes,
      registerAvailabilityPresenceRoutes,
      registerTopologyRuntimeRoutes,
      registerAllocatorRoutes,
      registerLibrarianProxyRoutes,
      registerMapperProxyRoutes,
      registerRuntimeRegistryRoutes,
      registerRouterLifecycleControlRoutes,
      registerHelloServiceRoutes,
      registerProvisioningAgentRoutes
    },
    dependencyFactories: createRouteManifestDependencyFactories({
      requirePermission,
      readTransactionLifecycleCompiled,
      getFsmEntityStateFromSql,
      getTransactionTrace,
      getFsmTransactionSummaryFromSql,
      getLifecycleTransitionOptions,
      formatErrorDetails,
      extractEntityIdFromInquiry,
      resolveActor,
      isSettlementSummaryInquiry,
      extractEntityRefsFromInquiry,
      buildFsmClarificationOptions,
      logNlpInteractionToSql,
      DEFAULT_ACTOR_USER_ID,
      updateNlpUserProfileFromFeedback,
      getLifecycleWorkersPayload,
      getQueueBridgeWorkersPayload,
      ensureWorkerStartsEnabled,
      startLifecycleWorker,
      getLifecycleWorkerPayloadById,
      stopLifecycleWorker,
      startQueueBridgeWorker,
      getQueueBridgeWorkerPayloadById,
      stopQueueBridgeWorker,
      startDefaultQueueDrivenLifecycleWorkers,
      applyHardReset,
      workerRuntimeControl,
      stopAllQueueDrivenWorkers,
      getSubflowBridgeWorkersPayload,
      startDefaultSubflowBridgeWorkers,
      stopSubflowBridgeWorkers,
      getGatewayStatusPayload,
      buildGatewayStreamPayload,
      startRouterWorker,
      stopRouterWorker,
      queueRoutes,
      queueManagerRegistry,
      queueManagers,
      resolveServiceInstance,
      getBrokerStateLabel,
      getActiveBrokerInstances,
      getBrokerInstancesPayload,
      getAvailableQueueManagers,
      setBrokerInstanceState,
      brokerInstances,
      getOrCreateBrokerInstance,
      startSecondaryBroker,
      ensureRoute,
      enqueueViaRoute,
      messageRouter,
      getActiveQueueManagers,
      ensureQueueTriggeredFlowForQueue,
      queueValidationErrors,
      dlqEvents,
      summarizeDlqEvents,
      dequeueViaRoute,
      sanctionsComplianceService,
      getToxicRoleCombinationPolicy,
      getIamIntegrationPaths,
      getUserById,
      resolveEffectiveAccessForUser,
      metricsCollector,
      evaluateLatencyPolicies,
      getWorkerConfig: () => workerConfig,
      getStep3LatencySummary,
      getQueueEnqueueLatencySummary,
      getEdgeOffloadMetricsSummary,
      getTxStatePersistenceSummary,
      getNodeRuntimeDiagnosticsSnapshot,
      enumerateApiCatalog,
      enumerateDiscoveredNodeApiCatalog,
      findApiCatalogEntry,
      resolvePermissionForApiRequest,
      routeRoleManifest: ROUTE_ROLE_MANIFEST,  // loaded from data/route-manifest.json at startup
      listServiceProviders,
      getServiceProvider,
      getServiceProviderAction,
      getServiceProviderCategories,
      listServiceProviderActions,
      discoveredNodes,
      queueManagerInstances,
      express,
      inferQueueDataTypeIds,
      compileQueueDslSpec,
      diffQueueConfigs,
      resolveLibrarianOrigin,
      IS_PRODUCTION_ENV,
      ALLOW_TEMP_QUEUES_IN_PRODUCTION,
      machineWorkloadState,
      getMachineAvailabilityPayload,
      setMachineAvailable,
      drainMachineAndSetUnavailable,
      machineDrainDefaultTimeoutMs: MACHINE_DRAIN_DEFAULT_TIMEOUT_MS,
      getBrowserPresence,
      normalizePresenceIp,
      upsertBrowserPresenceNode,
      setBrowserPresenceUnavailable,
      discoveredNodes,
      getBrokerNodeDetails,
      getSystemPerformanceSnapshot,
      services: [BROKER_SERVICE, ROUTER_SERVICE, QUEUE_SERVICE, FILE_SERVER_SERVICE],
      serviceInstanceRegistry,
      upsertServiceInstance,
      ffsDeploymentRegistry,
      setNodeLifecycleState,
      getUiCardOverrides: () => uiCardOverrides,
      setUiCardOverrides: (payload) => {
        uiCardOverrides = saveCardOverridesToDisk(payload || {});
        return uiCardOverrides;
      },
      hasPermission,
      setQueueManagerStatus,
      getNodeDrainStatus,
      GATEWAY_IDS,
      executeGatewayAction,
      brokerRuntimeConfig,
      gatewayRuntimeConfig,
      createDefaultGatewayRuntimeConfig,
      rebuildBrokerInstances,
      gatewayModeState,
      gatewayQuiesceState,
      normalizeGatewayRuntimeConfig,
      parseBooleanLike,
      ingestWithEdgeFallback,
      getRouterWorkersPayload,
      buildTransactionLifecycleDashboardPayload,
      enableLifecyclePathTesters: ENABLE_LIFECYCLE_PATH_TESTERS,
      deriveLifecycleHappyPath,
      deriveLifecycleSadPath,
      runLifecycleHappyPath,
      runLifecycleSadPath,
      recordLifecycleTesterRun,
      getLifecycleHeartbeatPayload,
      enqueueLifecycleHeartbeat,
      lifecycleHeartbeat,
      lifecycleHarnessStartTransaction,
      lifecycleHarnessAdvance,
      lifecycleActionPolicy,
      getLatencyPolicyThresholds,
      workerConfigRef: {
        get current() { return workerConfig; },
        set current(next) { workerConfig = next; }
      },
      validateLatencyPolicyTargetsUpdate,
      applyLatencyPolicyTargetsUpdate,
      persistWorkerConfig,
      workerConfigPath: WORKER_CONFIG_PATH,
      shipQueuedTransactionStateLogs,
      txStateLogShippingBatchSize: TX_STATE_LOG_SHIPPING_BATCH_SIZE,
      getWorkerDefaults,
      validateWorkerConfigUpdate,
      applyWorkerConfigUpdate,
      routerWorkers,
      resolveMapperOrigin
    })
  });

  debugLog('[DEBUG] Registering routes...');

  // Queue configuration synchronization endpoints for distributed config management

  function resolveLibrarianOrigin() {
    return readEnvString('LIBRARIAN_URL', `http://127.0.0.1:${DEFAULT_LIBRARIAN_PORT}`);
  }

  function resolveMapperOrigin() {
    return readEnvString('MAPPER_URL', 'http://127.0.0.1:4200');
  }

  // TEST ENDPOINT (dev/debug only)
  if (DEBUG_BACKEND) {
    debugLog('[DEBUG] About to register replication endpoints');
    app.get('/api/replication-test', (req, res) => {
      debugLog('[DEBUG] REPLICATION-TEST ENDPOINT CALLED');
      res.json({ status: 'replication endpoints loaded' });
    });
    debugLog('[DEBUG] Registered replication-test endpoint');
  }
  
  const federatedFfsRoot = path.join(RUNTIME_DATA_ROOT, 'federated-ffs');
  const fileServer = createFileServer({
    ffsConfig: {
      root: federatedFfsRoot
    },
    federatedConfig: {
      packageRoot: path.join(federatedFfsRoot, 'packages'),
      deploymentIndexPath: path.join(federatedFfsRoot, 'service-deployments.json'),
      deploymentRegistry: ffsDeploymentRegistry
    }
  });
  debugLog('[DEBUG] File server routes registered');
  app.use('/api/fileserver', fileServer.router);

  registerLocalServiceHeartbeats();
  setInterval(registerLocalServiceHeartbeats, 10000);
  setInterval(updateVirtualNodes, 3000);
  startAuthoritativeTimeSyncMonitor();
  startLifecycleHeartbeatMonitor();
  startScheduledDispatchWatcher();
  setMachineAvailable();
  debugLog('[DEBUG] All routes registered');
  // Catch-all error handler for uncaught errors in Express (MUST BE LAST)
  app.use((err, req, res, next) => {
    const errorMsg = '[EXPRESS ERROR] ' + (err && err.stack ? err.stack : err.toString());
    if (typeof logToFile === 'function') {
      try {
        logToFile(errorMsg);
      } catch {
        // Ignore logger failures in fallback environments.
      }
    }
    console.error(errorMsg);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error', details: errorMsg });
  });
}

try {
  await startBackendRuntime({
    debugLog,
    app,
    HTTP_PORT,
    queueManagerInstances,
    registerMapperRoutes,
    registerRoutes,
    createNodeRegistry,
    RUNTIME_DATA_ROOT,
    pathJoin: path.join,
    createNodeRegistryRoutes,
    esp32SeedNodes: [
      ...EDGE_ESP32_GENERAL_NODES,
      ...EDGE_ESP32_BONECRUSHER_NODES,
      ...EDGE_ESP32_DRONE_NODES,
      ...ESP32_DISCOVERY_SEED_NODES
    ],
    createPascalCompiler,
    pascalCompilerRoutes,
    express,
    publicRoot: path.join(__dirname, 'public'),
    openApiPath: path.join(__dirname, 'openapi-powerapp-connector.json'),
    pascalGrammarPath: path.join(__dirname, '../dsl/languages/PulseSys'),
    loadWorkerConfig,
    validateRouterRuleCoverageForWorkerQueues,
    ensurePriorityInputQueuesConfigured,
    metricsCollector,
    SQL_INSTANCE_NAME,
    SQL_INSTANCE_MODE,
    SQL_SERVER_HOST,
    SQL_DATABASE,
    TX_STATE_REQUIRE_REALTIME_DB,
    getTransactionStateMssqlPool,
    FSM_MSSQL_CURRENT_TABLE,
    FSM_MSSQL_HISTORY_TABLE,
    formatErrorDetails,
    TX_STATE_EMERGENCY_LOG_SHIPPING,
    TX_STATE_LOG_SHIPPING_INTERVAL_MS,
    shipQueuedTransactionStateLogs,
    TX_STATE_LOG_SHIPPING_BATCH_SIZE,
    txStatePersistenceStats,
    BACKEND_WORKER_AUTOSTART,
    startDefaultRouterWorkers,
    startDefaultQueueDrivenLifecycleWorkers,
    startDefaultSubflowBridgeWorkers,
    startSwiftGateway,
    startBocGateway,
    gatewayModeState,
    startFedGateway,
    BACKEND_AUX_SERVICES_AUTOSTART,
    PULSE_MCP_AUTOSTART,
    spawn,
    librarianScriptPath: fileURLToPath(new URL('./data-librarian.mjs', import.meta.url)),
    mapperScriptPath: fileURLToPath(new URL('./data-mapper.mjs', import.meta.url)),
    mcpScriptPath: fileURLToPath(new URL('./src/mcp/pulseMcpServer.mjs', import.meta.url))
  });
} catch (err) {
  console.error('[ERROR] Backend failed to start:', err);
}
