import fs from 'fs';
import http from 'http';
import v8 from 'v8';
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
// Run with: node backend.mjs
import dgram from 'dgram';
import express from 'express';
import cors from 'cors';
import os from 'os';
import path from 'path';
import { performance, monitorEventLoopDelay } from 'perf_hooks';
import { execFileSync, spawn } from 'child_process';
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
import { registerObservabilityRoutes } from './src/backend/roles/observabilityRoutes.mjs';
import { registerPlatformRoutes } from './src/backend/roles/platformRoutes.mjs';
import { registerReplicationRoutes } from './src/backend/roles/replicationRoutes.mjs';
import { registerQueueConfigRoutes } from './src/backend/roles/queueConfigRoutes.mjs';
import { registerQueueTransferRoutes } from './src/backend/roles/queueTransferRoutes.mjs';
import { createRequestPolicyApi } from './src/backend/security/requestPolicy.mjs';
import { ROUTE_ROLE_MANIFEST } from './src/backend/routes.manifest.mjs';
import { registerRoutesFromManifest } from './src/backend/routeManifestLoader.mjs';
import { enumerateApiCatalog } from './src/backend/apiCatalog.mjs';
import { createSanctionsComplianceService } from './src/compliance/sanctionsService.mjs';
import crypto from 'crypto';

// ===== SERVICE PROXY UTILITY =====
// When services are modular, proxy requests to them
// Set MODULAR_BACKEND=1 to use separate services; else use unified backend

const MODULAR_MODE = readEnvBoolean('MODULAR_BACKEND', ['1'], false);
const BROKER_SERVICE_URL = 'http://localhost:4001';
const DEBUG_BACKEND = readEnvBoolean('DEBUG_BACKEND', ['true'], false);

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


const HTTP_PORT = 4000;
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
const DEFAULT_QUEUE_DATA_ROOT = fileURLToPath(new URL('./data', import.meta.url));
const UI_CARD_OVERRIDES_FILE = path.resolve(DEFAULT_QUEUE_DATA_ROOT, 'ui-card-overrides.json');
const rawQueuePersistenceFlag = String(process.env.PULSE_QUEUE_PERSISTENCE || '').trim().toLowerCase();
const PULSE_QUEUE_PERSISTENCE = true;
const PULSE_QUEUE_DATA_ROOT = PULSE_QUEUE_PERSISTENCE
  ? path.resolve(readEnvString('PULSE_QUEUE_DATA_ROOT', DEFAULT_QUEUE_DATA_ROOT))
  : null;
const RUNTIME_DATA_ROOT = path.resolve(readEnvString('PULSE_RUNTIME_DATA_ROOT', PULSE_QUEUE_DATA_ROOT || DEFAULT_QUEUE_DATA_ROOT));
const WORKER_CONFIG_PATH = path.join(RUNTIME_DATA_ROOT, 'worker-config.json');
const ROUTER_RULES_PATH = path.join(RUNTIME_DATA_ROOT, 'router-rules.json');
const DATA_MAPPINGS_PATH = path.join(RUNTIME_DATA_ROOT, 'data-mappings.json');
const TX_STATE_LOG_SHIPPING_PATH = path.resolve(PULSE_QUEUE_DATA_ROOT, 'transaction-state-log-shipping.jsonl');
const TX_STATE_LOG_SHIPPING_BATCH_SIZE = Math.max(1, readEnvNumber('TX_STATE_LOG_SHIPPING_BATCH_SIZE', 200));
const TX_STATE_LOG_SHIPPING_INTERVAL_MS = Math.max(0, readEnvNumber('TX_STATE_LOG_SHIPPING_INTERVAL_MS', 15000));
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
  seedRuntimeFileIfMissing(runtimeDslPath, './data/transaction-lifecycle.tsl');
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

const nodeRuntimeStartedAt = Date.now();
const eventLoopDelayHistogram = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelayHistogram.enable();
let lastCpuUsageSample = process.cpuUsage();
let lastCpuSampleHrtimeNs = process.hrtime.bigint();

function bytesToMb(value) {
  return Number.isFinite(value) ? Number((value / (1024 * 1024)).toFixed(2)) : 0;
}

function toMsFromNs(value) {
  return Number.isFinite(value) ? Number((value / 1e6).toFixed(3)) : 0;
}

function getNodeRuntimeDiagnosticsSnapshot() {
  const mem = process.memoryUsage();
  const heap = v8.getHeapStatistics();
  const elu = performance.eventLoopUtilization();
  const handles = typeof process._getActiveHandles === 'function' ? process._getActiveHandles().length : null;
  const requests = typeof process._getActiveRequests === 'function' ? process._getActiveRequests().length : null;
  const nowHrtimeNs = process.hrtime.bigint();
  const cpuDiff = process.cpuUsage(lastCpuUsageSample);
  const elapsedSampleMs = Number(nowHrtimeNs - lastCpuSampleHrtimeNs) / 1e6;
  lastCpuUsageSample = process.cpuUsage();
  lastCpuSampleHrtimeNs = nowHrtimeNs;
  const cpuTotalMs = (cpuDiff.user + cpuDiff.system) / 1000;
  const cpuPercentSingleCore = elapsedSampleMs > 0 ? Number(((cpuTotalMs / elapsedSampleMs) * 100).toFixed(2)) : 0;
  const cpuCount = Math.max(1, os.cpus().length || 1);
  const cpuPercentAllCores = Number((cpuPercentSingleCore / cpuCount).toFixed(2));

  return {
    timestamp: Date.now(),
    uptimeSeconds: Math.round(process.uptime()),
    process: {
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
      rssMb: bytesToMb(mem.rss),
      heapUsedMb: bytesToMb(mem.heapUsed),
      heapTotalMb: bytesToMb(mem.heapTotal),
      externalMb: bytesToMb(mem.external),
      arrayBuffersMb: bytesToMb(mem.arrayBuffers),
      heapUsedPercent: mem.heapTotal > 0 ? Number(((mem.heapUsed / mem.heapTotal) * 100).toFixed(2)) : 0,
      activeHandles: handles,
      activeRequests: requests
    },
    v8: {
      heapLimitMb: bytesToMb(heap.heap_size_limit),
      mallocedMb: bytesToMb(heap.malloced_memory),
      peakMallocedMb: bytesToMb(heap.peak_malloced_memory),
      nativeContexts: Number(heap.number_of_native_contexts || 0),
      detachedContexts: Number(heap.number_of_detached_contexts || 0)
    },
    eventLoop: {
      utilization: Number((elu.utilization || 0).toFixed(4)),
      activeMs: Number((elu.active || 0).toFixed(3)),
      idleMs: Number((elu.idle || 0).toFixed(3)),
      delayMeanMs: toMsFromNs(eventLoopDelayHistogram.mean),
      delayStddevMs: toMsFromNs(eventLoopDelayHistogram.stddev),
      delayP95Ms: toMsFromNs(eventLoopDelayHistogram.percentile(95)),
      delayP99Ms: toMsFromNs(eventLoopDelayHistogram.percentile(99)),
      delayMaxMs: toMsFromNs(eventLoopDelayHistogram.max)
    },
    cpu: {
      sampleWindowMs: Number(elapsedSampleMs.toFixed(3)),
      usagePercentSingleCore: cpuPercentSingleCore,
      usagePercentAllCores: cpuPercentAllCores,
      cpuCount,
      loadAvg1m: Number((os.loadavg()[0] || 0).toFixed(3)),
      loadAvg5m: Number((os.loadavg()[1] || 0).toFixed(3)),
      loadAvg15m: Number((os.loadavg()[2] || 0).toFixed(3))
    },
    sinceStart: {
      startedAt: nodeRuntimeStartedAt,
      elapsedSeconds: Math.round((Date.now() - nodeRuntimeStartedAt) / 1000)
    }
  };
}

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(auditApiRequest);
app.use(applyRequestSecurityHeaders);
app.use(enforceHttpsTransport);
app.use(enforceApiPermission);
app.use(enforceTwoPersonRule);

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
// --- MessageBroker Subscription API ---
app.get('/api/broker/subscriptions', (req, res) => {
  if (MODULAR_MODE) {
    proxyRequest('GET', '/broker/subscriptions', req, res);
  } else {
    try {
      res.json({ subscriptions: primaryBroker.getSubscriptions() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
});

app.get('/api/broker/config', requirePermission('broker.read'), (req, res) => {
  if (MODULAR_MODE) {
    proxyRequest('GET', '/broker/config', req, res);
  } else {
    res.json({
      broker: {
        provider: brokerRuntimeConfig.provider,
        supportedProviders: BROKER_SUPPORTED_PROVIDERS,
        rabbitmq: {
          exchangeName: brokerRuntimeConfig.exchangeName,
          queuePrefix: brokerRuntimeConfig.queuePrefix,
          urlConfigured: brokerRuntimeConfig.provider === 'rabbitmq' ? true : Boolean(brokerRuntimeConfig.url)
        },
        msmq: {
          baseQueuePath: brokerRuntimeConfig.msmqBaseQueuePath,
          queuePrefix: brokerRuntimeConfig.msmqQueuePrefix
        },
        kafka: {
          brokers: brokerRuntimeConfig.kafkaBrokers,
          clientId: brokerRuntimeConfig.kafkaClientId,
          topicPrefix: brokerRuntimeConfig.kafkaTopicPrefix
        },
        ibm: {
          queueManager: brokerRuntimeConfig.ibmQueueManager,
          channel: brokerRuntimeConfig.ibmChannel,
          connName: brokerRuntimeConfig.ibmConnName,
          queuePrefix: brokerRuntimeConfig.ibmQueuePrefix,
          username: brokerRuntimeConfig.ibmUsername,
          passwordConfigured: Boolean(brokerRuntimeConfig.ibmPassword)
        },
        apache: {
          host: brokerRuntimeConfig.apacheHost,
          port: brokerRuntimeConfig.apachePort,
          topicPrefix: brokerRuntimeConfig.apacheTopicPrefix,
          username: brokerRuntimeConfig.apacheUsername,
          passwordConfigured: Boolean(brokerRuntimeConfig.apachePassword)
        },
        secondaryRunning: Boolean(secondaryBroker)
      }
    });
  }
});

app.post('/api/broker/config', requirePermission('broker.configure'), (req, res) => {
  if (MODULAR_MODE) {
    proxyRequest('POST', '/broker/config', req, res);
  } else {
    try {
      const nextProvider = normalizeBrokerProvider(req.body?.provider);
      const nextUrl = String(req.body?.url || '').trim();
      const nextExchangeName = String(req.body?.exchangeName || '').trim();
      const nextQueuePrefix = String(req.body?.queuePrefix || '').trim();
      const nextMsmqBaseQueuePath = String(req.body?.msmqBaseQueuePath || '').trim();
      const nextMsmqQueuePrefix = String(req.body?.msmqQueuePrefix || '').trim();
      const nextKafkaBrokers = String(req.body?.kafkaBrokers || '').trim();
      const nextKafkaClientId = String(req.body?.kafkaClientId || '').trim();
      const nextKafkaTopicPrefix = String(req.body?.kafkaTopicPrefix || '').trim();
      const nextIbmQueueManager = String(req.body?.ibmQueueManager || '').trim();
      const nextIbmChannel = String(req.body?.ibmChannel || '').trim();
      const nextIbmConnName = String(req.body?.ibmConnName || '').trim();
      const nextIbmQueuePrefix = String(req.body?.ibmQueuePrefix || '').trim();
      const nextIbmUsername = String(req.body?.ibmUsername || '').trim();
      const hasIbmPassword = Object.prototype.hasOwnProperty.call(req.body || {}, 'ibmPassword');
      const nextIbmPassword = hasIbmPassword ? String(req.body?.ibmPassword || '') : '';
      const nextApacheHost = String(req.body?.apacheHost || '').trim();
      const nextApachePort = Number(req.body?.apachePort || 0);
      const nextApacheUsername = String(req.body?.apacheUsername || '').trim();
      const hasApachePassword = Object.prototype.hasOwnProperty.call(req.body || {}, 'apachePassword');
      const nextApachePassword = hasApachePassword ? String(req.body?.apachePassword || '') : '';
      const nextApacheTopicPrefix = String(req.body?.apacheTopicPrefix || '').trim();

      if (!nextProvider) {
        return res.status(400).json({ error: 'provider is required' });
      }
      if (!BROKER_SUPPORTED_PROVIDERS.includes(nextProvider)) {
        return res.status(400).json({ error: `Unsupported provider: ${nextProvider}` });
      }

      const nextConfig = { provider: nextProvider };
      if (nextUrl) nextConfig.url = nextUrl;
      if (nextExchangeName) nextConfig.exchangeName = nextExchangeName;
      if (nextQueuePrefix) nextConfig.queuePrefix = nextQueuePrefix;
      if (nextMsmqBaseQueuePath) nextConfig.msmqBaseQueuePath = nextMsmqBaseQueuePath;
      if (nextMsmqQueuePrefix) nextConfig.msmqQueuePrefix = nextMsmqQueuePrefix;
      if (nextKafkaBrokers) nextConfig.kafkaBrokers = nextKafkaBrokers;
      if (nextKafkaClientId) nextConfig.kafkaClientId = nextKafkaClientId;
      if (nextKafkaTopicPrefix) nextConfig.kafkaTopicPrefix = nextKafkaTopicPrefix;
      if (nextIbmQueueManager) nextConfig.ibmQueueManager = nextIbmQueueManager;
      if (nextIbmChannel) nextConfig.ibmChannel = nextIbmChannel;
      if (nextIbmConnName) nextConfig.ibmConnName = nextIbmConnName;
      if (nextIbmQueuePrefix) nextConfig.ibmQueuePrefix = nextIbmQueuePrefix;
      if (nextIbmUsername) nextConfig.ibmUsername = nextIbmUsername;
      if (hasIbmPassword) nextConfig.ibmPassword = nextIbmPassword;
      if (nextApacheHost) nextConfig.apacheHost = nextApacheHost;
      if (nextApachePort > 0) nextConfig.apachePort = nextApachePort;
      if (nextApacheUsername) nextConfig.apacheUsername = nextApacheUsername;
      if (hasApachePassword) nextConfig.apachePassword = nextApachePassword;
      if (nextApacheTopicPrefix) nextConfig.apacheTopicPrefix = nextApacheTopicPrefix;

      const runtime = rebuildBrokerInstances(nextConfig);
      res.json({
        status: 'updated',
        broker: runtime
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
});

app.post('/api/broker/subscriptions', (req, res) => {
  if (MODULAR_MODE) {
    proxyRequest('POST', '/broker/subscriptions', req, res);
  } else {
    try {
      const { topic, serviceName } = req.body || {};
      if (!topic || !serviceName) {
        return res.status(400).json({ error: 'topic and serviceName are required' });
      }
      primaryBroker.addSubscription(topic, serviceName);
      res.json({ status: 'added', topic, serviceName });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
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
  readEnvString('AUTO_APPROVE_USER_IDS', 'system-admin')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
);
const ALLOW_IMPLICIT_ADMIN = readEnvBoolean('ALLOW_IMPLICIT_ADMIN', ['true'], true);
const queueValidationErrors = [];
const MAX_QUEUE_VALIDATION_ERRORS = 500;
const dlqEvents = [];
const MAX_DLQ_EVENTS = 2000;
const MACHINE_ANNOUNCE_INTERVAL_MS = 5000;
const MACHINE_DRAIN_DEFAULT_TIMEOUT_MS = 60 * 1000;
const SUPERVISOR_HEARTBEAT_TTL_MS = Math.max(1000, readEnvNumber('SUPERVISOR_HEARTBEAT_TTL_MS', 15000));
const machineAvailability = {
  nodeId: os.hostname() || 'unknown-node',
  available: false,
  draining: false,
  advertisedAt: null,
  announceReason: null,
  announceTimerId: null,
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

function ensureDataRootExists() {
  fs.mkdirSync(PULSE_QUEUE_DATA_ROOT, { recursive: true });
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
    queuedAt: new Date().toISOString(),
    reason: reason || 'db-unavailable',
    entry
  };
  fs.appendFileSync(TX_STATE_LOG_SHIPPING_PATH, `${JSON.stringify(record)}\n`, 'utf-8');
  txStatePersistenceStats.queuedForShipping += 1;
  txStatePersistenceStats.lastQueuedAt = record.queuedAt;
}

function buildTxStateDbWriteEntry(compiled, {
  message,
  fromState = null,
  toState,
  eventName = null,
  queueName = null
} = {}) {
  if (!toState) return null;
  const entityId = extractSwiftReferenceFromMessage(message);
  if (!entityId) return null;

  const nowIso = new Date().toISOString();
  const machineId = String(compiled?.transactionId || 'fsm-machine').trim() || 'fsm-machine';
  const toStateInfo = getLifecycleStateByName(compiled, toState);
  const resolvedQueueName = String(queueName || toStateInfo?.queueName || '').trim() || null;
  const toStateLabel = String(toStateInfo?.label || toState || '').trim() || null;
  const isTerminal = getLifecycleOutgoingTransitions(compiled, String(toState || '').trim()).length === 0;

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
    updatedAt: nowIso
  };
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
const DEFAULT_ACTOR_USER_ID = 'system-admin';
const pendingApprovalRequests = new Map();
let auditChainHead = 'GENESIS';
const LIFECYCLE_HEARTBEAT_INACTIVITY_MS = readEnvNumber('LIFECYCLE_HEARTBEAT_INACTIVITY_MS', 30 * 1000);
const LIFECYCLE_HEARTBEAT_CHECK_INTERVAL_MS = readEnvNumber('LIFECYCLE_HEARTBEAT_CHECK_INTERVAL_MS', 5 * 1000);
const LIFECYCLE_HEARTBEAT_ENABLED = readEnvBoolean('LIFECYCLE_HEARTBEAT_ENABLED', ['1', 'true', 'yes'], true);
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
const EDGE_ESP32_ROUTER_FILE = readEnvString('EDGE_ESP32_ROUTER_FILE', '/router-mapper.pcode').trim() || '/router-mapper.pcode';
const EDGE_ESP32_PROGRAM_MAP = readEnvString('EDGE_ESP32_PROGRAM_MAP', '/router-mapper.program.json').trim() || '/router-mapper.program.json';
const EDGE_ESP32_LARGE_MESSAGE_THRESHOLD_BYTES = Math.max(1024, readEnvNumber('EDGE_ESP32_LARGE_MESSAGE_THRESHOLD_BYTES', 8192));
const EDGE_ESP32_FORCED_EVOLUTION_RATE = Math.min(1, Math.max(0, readEnvNumber('EDGE_ESP32_FORCED_EVOLUTION_RATE', 0)));

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

async function invokeEsp32EdgeIngressStage({ inputQueue, message, runRouter = true, convertMtToXml = false, preferredEdgeRole = null } = {}) {
  const startMs = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EDGE_ESP32_TIMEOUT_MS);
  const selection = chooseEdgeNode({ requestedRole: preferredEdgeRole, message });
  try {
    const payload = {
      inputQueue,
      message,
      runRouter: runRouter ? '1' : '0',
      convertMtToXml: convertMtToXml ? '1' : '0',
      file: EDGE_ESP32_ROUTER_FILE,
      programMap: EDGE_ESP32_PROGRAM_MAP
    };
    const endpoint = `http://${selection.node.host}:${selection.node.port}${EDGE_ESP32_PATH}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`edge endpoint status=${response.status}`);
    }
    const result = await response.json();
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
        strategy: selection.strategy
      }
    });
    return {
      ok: true,
      edgeNode: selection.node.label,
      edgeRole: selection.selectedRole,
      edgeRoleRequested: selection.requestedRole,
      edgeStrategy: selection.strategy,
      estimatedMessageBytes: selection.estimatedMessageBytes,
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
      latencyMs,
      error
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function ingestWithEdgeFallback({ inputQueue, message, sourceService = 'webapi', forceEdge = false, convertMtToXml = false, preferredEdgeRole = null } = {}) {
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
    preferredEdgeRole
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
        estimatedMessageBytes: edgeAttempt.estimatedMessageBytes
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
    version: 1,
    updatedAt: new Date().toISOString(),
    profiles: [
      {
        profileId: 'admin',
        label: 'Administrator',
        description: 'Full access to all operations',
        permissions: ['*']
      },
      {
        profileId: 'operator',
        label: 'Operations',
        description: 'Can run lifecycle and gateway operations',
        permissions: [
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
          'gateway.manage',
          'gateway.read',
          'lifecycle.read',
          'lifecycle.manage',
          'lifecycle.workers.manage',
          'lifecycle.workers.read',
          'lifecycle.policy.read',
          'data.read',
          'governance.read'
        ]
      },
      {
        profileId: 'configurator',
        label: 'Configuration Admin',
        description: 'Can alter queue and policy configuration',
        permissions: [
          'topology.read',
          'registry.read',
          'queue.view',
          'queue.configure',
          'broker.read',
          'broker.configure',
          'router.read',
          'router.manage',
          'lifecycle.read',
          'lifecycle.policy.read',
          'lifecycle.policy.manage',
          'users.read',
          'users.manage',
          'data.read',
          'data.manage',
          'governance.read',
          'governance.manage'
        ]
      },
      {
        profileId: 'viewer',
        label: 'Read-only Viewer',
        description: 'Read-only access',
        permissions: [
          'topology.read',
          'registry.read',
          'broker.read',
          'router.read',
          'queue.view',
          'gateway.read',
          'lifecycle.read',
          'lifecycle.workers.read',
          'lifecycle.policy.read',
          'users.read',
          'data.read',
          'governance.read'
        ]
      }
    ],
    users: [
      {
        userId: DEFAULT_ACTOR_USER_ID,
        displayName: 'System Admin',
        enabled: true,
        profileIds: ['admin'],
        groupIds: ['administrators']
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
  return String(value || '').trim().toLowerCase();
}

function isValidEmailIdentifier(value) {
  const input = normalizeUserIdentifier(value);
  if (!input) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function isAcceptedUserIdentifier(value) {
  const input = normalizeUserIdentifier(value);
  return input === DEFAULT_ACTOR_USER_ID || isValidEmailIdentifier(input);
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
        : null
    }))
    .filter(user => user.userId);

  if (!normalizedProfiles.some(profile => profile.profileId === 'admin')) {
    normalizedProfiles.push(fallback.profiles[0]);
  }
  if (!normalizedUsers.some(user => user.userId === DEFAULT_ACTOR_USER_ID)) {
    normalizedUsers.push(fallback.users[0]);
  }

  return {
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

  if (path.startsWith('/api/users')) {
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

  if (AUTO_APPROVE_USER_IDS.has(String(actor.userId || '').trim())) {
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
    return { user: null, profileIds: [], groupIds: [], permissions: [] };
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

  return {
    user,
    profileIds: effectiveProfileIds,
    groupIds: effectiveGroupIds,
    permissions
  };
}

function getUserById(userId) {
  const key = String(userId || '').trim();
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
  const headerUserId = String(req.get('x-user-id') || '').trim();
  const queryUserId = String(req.query?.userId || '').trim();
  const fallbackUserId = ALLOW_IMPLICIT_ADMIN ? DEFAULT_ACTOR_USER_ID : '';
  const actorUserId = headerUserId || queryUserId || fallbackUserId;
  const headerGroupIds = parseHeaderGroupIds(req);
  const access = resolveEffectiveAccessForUser(actorUserId, { headerGroupIds });

  // Keep local admin access stable even when group/profile providers are degraded.
  if (String(actorUserId || '').toLowerCase() === String(DEFAULT_ACTOR_USER_ID || '').toLowerCase()) {
    const adminUser = access.user || {
      userId: DEFAULT_ACTOR_USER_ID,
      displayName: 'System Administrator',
      enabled: true,
      profileIds: ['admin'],
      groupIds: []
    };

    return {
      userId: DEFAULT_ACTOR_USER_ID,
      user: adminUser,
      permissions: ['*'],
      profileIds: Array.isArray(access.profileIds) && access.profileIds.length > 0 ? access.profileIds : ['admin'],
      groupIds: access.groupIds || []
    };
  }

  return {
    userId: actorUserId,
    user: access.user,
    permissions: access.permissions,
    profileIds: access.profileIds,
    groupIds: access.groupIds
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    const actor = resolveActor(req);
    req.actor = actor;

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

    return next();
  };
}

function resolvePermissionForApiRequest(req) {
  return requestPolicyApi.resolvePermissionForApiRequest(req);
}

function enforceApiPermission(req, res, next) {
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

function setNodeLifecycleState(nodeId, state) {
  const normalized = normalizeNodeId(nodeId);
  if (!normalized) return false;
  let changed = false;

  for (const [managerId, manager] of queueManagerRegistry.entries()) {
    if (normalizeNodeId(manager.nodeId || manager.ip) === normalized) {
      manager.status = state;
      manager.updatedAt = new Date().toISOString();
      queueManagerRegistry.set(managerId, manager);
      changed = true;
    }
  }

  for (const [instanceId, instance] of serviceInstanceRegistry.entries()) {
    if (normalizeNodeId(instance.nodeId || instance.ip) === normalized) {
      instance.status = state;
      instance.updatedAt = new Date().toISOString();
      serviceInstanceRegistry.set(instanceId, instance);
      changed = true;
    }
  }

  return changed;
}

function getNodeQueueManagers(nodeId) {
  const normalized = normalizeNodeId(nodeId);
  return Array.from(queueManagerRegistry.values()).filter(m => normalizeNodeId(m.nodeId || m.ip) === normalized);
}

function getNodeDrainStatus(nodeId) {
  const managers = getNodeQueueManagers(nodeId);
  const managerIds = new Set(managers.map(m => m.managerId));
  const queueAssignments = [];

  let pendingMessagesKnown = 0;
  let unknownQueueDepthCount = 0;

  for (const route of queueRoutes.values()) {
    if (!managerIds.has(route.managerId)) continue;
    const manager = queueManagerRegistry.get(route.managerId);
    let queueLength = null;
    if (manager?.local) {
      queueLength = queueManagers[manager.localIndex].getQueueLength(route.queueName);
      pendingMessagesKnown += queueLength;
    } else {
      unknownQueueDepthCount += 1;
    }
    queueAssignments.push({
      queueName: route.queueName,
      managerId: route.managerId,
      queueLength
    });
  }

  const drainReady = pendingMessagesKnown === 0 && unknownQueueDepthCount === 0;
  return {
    nodeId,
    managerCount: managers.length,
    managers,
    queueAssignments,
    pendingMessagesKnown,
    unknownQueueDepthCount,
    drainReady
  };
}

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
      if (!qm.getConfig(queueName)?.name) {
        qm.createQueue(queueName, {
          dataTypeId: dataTypeIds[0],
          dataTypeIds,
          queueClass: 'permanent',
          createdByUser: false
        });
      } else {
        const cfg = qm.getConfig(queueName) || {};
        const configured = cfg.dataTypeIds || cfg.dataTypeId;
        dataTypeIds = Array.isArray(configured) ? configured : (configured ? [configured] : dataTypeIds);
      }

      const normalizedEnvelope = normalizeMessageEnvelope({ message, messageEnvelope, dataTypeIds });
      ensureMessageMatchesQueueType({ queueName, message, messageEnvelope: normalizedEnvelope, sourceService, managerId: manager.managerId, dataTypeIds });

      // Record enqueue for metrics
      metricsCollector.recordEnqueue(messageId, queueName);

      qm.enqueue(queueName, message, sourceService || 'unknown', messageId, normalizedEnvelope);
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
      replicateDequeueToFollowers(queueName, item, route.managerId)
        .catch(e => console.warn(`[REPLICATION] Dequeue fan-out error: ${e.message}`));
    }
    return unwrapQueueItemMessage(item);
  } catch (e) {
    // Leader failed → auto-promote next available manager
    console.warn(`[FAILOVER] Leader ${route.managerId} failed for queue ${queueName}: ${e.message}`);
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

const messageRouter = createRouterEngine({
  rulesPath: ROUTER_RULES_PATH,
  mappingsPath: DATA_MAPPINGS_PATH,
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
  autoRestartEnabled: true,
  hardResetAt: null,
  hardResetReason: null
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

      const runtimeContext = {
        ...workerState.context,
        message: deq.message,
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

        await runLifecycleTransitionAction(transition.action, runtimeContext, workerState);
        await enqueueLifecycleStateMessage(
          compiled,
          transition.to,
          runtimeContext.message,
          workerState.sourceService,
          transition.event
        );
        await recordTransactionStateTransition(compiled, {
          message: runtimeContext.message,
          fromState: workerState.fromState,
          toState: transition.to,
          eventName: transition.event
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
        await enqueueLifecycleStateMessage(compiled, workerState.fromState, deq.message, `${workerState.sourceService}:retry`);
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
            queueName: workerState.outputQueue
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
  return {
    kind: 'machineAvailability',
    serviceName: 'machine-availability',
    nodeId: machineAvailability.nodeId,
    nodeName: machineAvailability.nodeId,
    ip: getLocalAdvertiseIp(),
    port: HTTP_PORT,
    available: machineAvailability.available,
    draining: machineAvailability.draining,
    status: machineAvailability.available ? 'available' : (machineAvailability.draining ? 'draining' : 'unavailable'),
    ts: Date.now()
  };
}

function sendMachineAvailabilityAnnouncement(reason = 'manual') {
  if (machineAvailability.udpBroadcastBlocked) {
    return;
  }
  const payload = buildMachineAvailabilityAnnouncement();
  payload.reason = reason;
  machineAvailability.advertisedAt = new Date().toISOString();
  machineAvailability.announceReason = reason;
  const message = Buffer.from(JSON.stringify(payload), 'utf-8');
  udpServer.send(message, 0, message.length, UDP_PORT, '255.255.255.255', (error) => {
    if (error) {
      if (error.code === 'EACCES') {
        machineAvailability.udpBroadcastBlocked = true;
        stopMachineAvailabilityAnnouncer();
        console.warn(`[UDP] Broadcast announcements disabled: ${error.message}`);
      } else {
        console.warn(`[UDP] Failed to send availability announcement: ${error.message}`);
      }
      return;
    }
    console.log(`[UDP] Availability announced: ${payload.status} (${reason})`);
  });
}

function stopMachineAvailabilityAnnouncer() {
  if (!machineAvailability.announceTimerId) return;
  clearInterval(machineAvailability.announceTimerId);
  machineAvailability.announceTimerId = null;
}

function getMachineAvailabilityPayload() {
  return {
    nodeId: machineAvailability.nodeId,
    available: machineAvailability.available,
    draining: machineAvailability.draining,
    advertisedAt: machineAvailability.advertisedAt,
    announceReason: machineAvailability.announceReason,
    status: machineAvailability.available ? 'available' : (machineAvailability.draining ? 'draining' : 'unavailable')
  };
}

function normalizePresenceIp(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown';
  if (raw.startsWith('::ffff:')) return raw.substring(7);
  return raw;
}

function upsertBrowserPresenceNode({ clientId, nodeName, ip, userAgent, available = true }) {
  const key = `web:${String(clientId || '').trim()}`;
  if (!key || key === 'web:') return null;
  const now = Date.now();
  const previous = discoveredNodes.get(key) || {};
  const next = {
    ...previous,
    id: key,
    source: 'web-client',
    clientId: String(clientId || '').trim(),
    nodeName: String(nodeName || previous.nodeName || 'Web Client').trim(),
    ip: normalizePresenceIp(ip || previous.ip),
    userAgent: String(userAgent || previous.userAgent || '').trim(),
    availability: {
      available: Boolean(available),
      draining: false,
      status: available ? 'available' : 'unavailable'
    },
    lastSeen: now,
    raw: JSON.stringify({ kind: 'browserPresence', clientId, nodeName, ip, available })
  };
  discoveredNodes.set(key, next);
  return next;
}

function setBrowserPresenceUnavailable(clientId) {
  const key = `web:${String(clientId || '').trim()}`;
  const previous = discoveredNodes.get(key);
  if (!previous) return null;
  const next = {
    ...previous,
    availability: {
      available: false,
      draining: false,
      status: 'unavailable'
    },
    lastSeen: Date.now()
  };
  discoveredNodes.set(key, next);
  return next;
}

function getBrowserPresence(clientId) {
  const key = `web:${String(clientId || '').trim()}`;
  return discoveredNodes.get(key) || null;
}

function startMachineAvailabilityAnnouncer() {
  stopMachineAvailabilityAnnouncer();
  machineAvailability.announceTimerId = setInterval(() => {
    if (machineAvailability.available) {
      sendMachineAvailabilityAnnouncement('heartbeat');
    }
  }, MACHINE_ANNOUNCE_INTERVAL_MS);
}

function setMachineAvailable() {
  machineAvailability.available = true;
  machineAvailability.draining = false;
  sendMachineAvailabilityAnnouncement('available');
  startMachineAvailabilityAnnouncer();
  return getMachineAvailabilityPayload();
}

function setMachineUnavailable() {
  machineAvailability.available = false;
  machineAvailability.draining = false;
  stopMachineAvailabilityAnnouncer();
  sendMachineAvailabilityAnnouncement('unavailable');
  return getMachineAvailabilityPayload();
}

async function drainMachineAndSetUnavailable({ timeoutMs = MACHINE_DRAIN_DEFAULT_TIMEOUT_MS } = {}) {
  machineAvailability.available = false;
  machineAvailability.draining = true;
  sendMachineAvailabilityAnnouncement('draining');

  const startedAt = Date.now();
  const hardTimeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : MACHINE_DRAIN_DEFAULT_TIMEOUT_MS;
  while (machineWorkloadState.inFlight > 0 && (Date.now() - startedAt) < hardTimeout) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const timedOut = machineWorkloadState.inFlight > 0;
  const next = setMachineUnavailable();
  return {
    availability: next,
    drain: {
      timedOut,
      timeoutMs: hardTimeout,
      inFlightAtCompletion: machineWorkloadState.inFlight
    }
  };
}

udpServer.on('message', (msg, rinfo) => {
  console.log(`[UDP] Packet from ${rinfo.address}:${rinfo.port} — ${msg.toString().slice(0, 120)}`);
  const ip = rinfo.address;
  const now = Date.now();
  let node = discoveredNodes.get(ip) || {};
  let parsed = false;
  try {
    const data = JSON.parse(msg.toString());
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
      raw: msg.toString()
    };
    parsed = true;
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
function getBrokerNodeDetails() {
  return { status: 'ok', service: BROKER_SERVICE };
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

function getQueueLengthForLifecycleState(queueName) {
  const q = String(queueName || '').trim();
  if (!q) return 0;

  const routed = queueRoutes.get(q);
  if (routed) {
    const manager = queueManagerRegistry.get(routed.managerId);
    if (manager?.local) {
      return queueManagers[manager.localIndex].getQueueLength(q);
    }
  }

  // If not explicitly routed, choose the max local observed queue length.
  // This avoids double-counting replicated queues across local managers.
  let maxObserved = 0;
  for (const qm of queueManagers) {
    maxObserved = Math.max(maxObserved, qm.getQueueLength(q));
  }
  return maxObserved;
}

function incrementLifecycleStateCumulativeCount(stateName, amount = 1) {
  const key = String(stateName || '').trim();
  if (!key) return;
  const next = Number(lifecycleStateCumulativeCounts.get(key) || 0) + Number(amount || 0);
  lifecycleStateCumulativeCounts.set(key, next < 0 ? 0 : next);
}

function getLifecycleStateCumulativeCount(stateName) {
  const key = String(stateName || '').trim();
  if (!key) return 0;
  return Number(lifecycleStateCumulativeCounts.get(key) || 0);
}

function incrementLifecycleCumulativeByQueue(queueName, amount = 1) {
  const q = String(queueName || '').trim();
  if (!q) return;

  const compiled = readTransactionLifecycleCompiled();
  const states = Array.isArray(compiled?.states) ? compiled.states : [];
  for (const state of states) {
    if (String(state?.queueName || '').trim() === q) {
      incrementLifecycleStateCumulativeCount(state.name, amount);
    }
  }
}

function getGatewayQueueMetrics(workers, compiled) {
  const queueNames = new Set();
  let cumulativeProcessedCount = 0;

  for (const worker of workers || []) {
    cumulativeProcessedCount += Number(worker?.processedMessages || 0);

    const fromState = String(worker?.fromState || '').trim();
    if (fromState) {
      const state = getLifecycleStateByName(compiled, fromState);
      const queueName = String(state?.queueName || '').trim();
      if (queueName) queueNames.add(queueName);
    }

    const inputQueue = String(worker?.inputQueue || '').trim();
    if (inputQueue) {
      queueNames.add(inputQueue);
    }
  }

  const queues = Array.from(queueNames).map(queueName => ({
    queueName,
    currentCount: getQueueLengthForLifecycleState(queueName)
  }));
  const currentQueueCount = queues.reduce((sum, q) => sum + Number(q.currentCount || 0), 0);

  return {
    currentQueueCount,
    cumulativeProcessedCount,
    queues
  };
}

function getLifecycleQueueTransformErrorSummary(queueName, { limit = 500 } = {}) {
  const key = String(queueName || '').trim();
  if (!key) {
    return {
      count: 0,
      latestReason: null,
      latestAt: null
    };
  }

  const items = dlqEvents
    .slice(-Math.max(1, Number(limit) || 500))
    .filter(item => String(item?.sourceQueue || '').trim() === key || String(item?.targetQueue || '').trim() === key);

  const latest = items.length > 0 ? items[items.length - 1] : null;
  return {
    count: items.length,
    latestReason: latest?.errorReason || null,
    latestAt: latest?.timestamp || null
  };
}

function buildTransactionLifecycleDashboardPayload(compiled) {
  if (!compiled || !Array.isArray(compiled.states)) {
    return null;
  }

  const states = compiled.states.map(state => {
    const queueName = state.queueName || null;
    const queueLength = queueName ? getQueueLengthForLifecycleState(queueName) : 0;
    return {
      stateName: state.name,
      label: state.label || state.name,
      queueName,
      subflow: state.subflow || null,
      layer: Number(state.layer || 0),
      isInitial: Boolean(state.initial),
      queueLength,
      cumulativeCount: getLifecycleStateCumulativeCount(state.name),
      transformErrors: getLifecycleQueueTransformErrorSummary(queueName)
    };
  });

  const totalsByLayer = {};
  for (const state of states) {
    totalsByLayer[state.layer] = (totalsByLayer[state.layer] || 0) + state.queueLength;
  }

  return {
    version: compiled.version || 1,
    transactionId: compiled.transactionId || null,
    description: compiled.description || '',
    initialState: compiled.initialState || null,
    topology: compiled.topology || { order: [], layers: [] },
    transitions: Array.isArray(compiled.transitions) ? compiled.transitions : [],
    harness: {
      active: lifecycleHarness.active,
      historyTail: lifecycleHarness.history.slice(-20)
    },
    heartbeat: getLifecycleHeartbeatPayload(),
    testers: getLifecycleTesterStatsPayload(),
    states,
    totalsByLayer,
    totalMessagesAcrossStates: states.reduce((sum, state) => sum + state.queueLength, 0),
    generatedAt: new Date().toISOString()
  };
}

function getLifecycleTesterStatsPayload() {
  return {
    happy: { ...lifecycleTesterStats.happy },
    sad: { ...lifecycleTesterStats.sad }
  };
}

function recordLifecycleTesterRun(testerType, { status = 'completed', transitionCount = 0, transactionId = null, error = null } = {}) {
  const key = testerType === 'sad' ? 'sad' : 'happy';
  const stats = lifecycleTesterStats[key];
  stats.runs += 1;
  stats.lastRunAt = new Date().toISOString();
  stats.lastStatus = status;
  stats.lastTransactionId = transactionId || null;
  stats.lastError = error || null;

  if (status === 'completed') {
    stats.completed += 1;
    stats.totalTransitions += Number(transitionCount || 0);
  } else {
    stats.failed += 1;
  }
}

function getLifecycleStateByName(compiled, stateName) {
  const states = Array.isArray(compiled?.states) ? compiled.states : [];
  return states.find(s => s.name === stateName) || null;
}

function getLifecycleStateByQueueName(compiled, queueName) {
  const states = Array.isArray(compiled?.states) ? compiled.states : [];
  const target = String(queueName || '').trim().toLowerCase();
  if (!target) return null;
  return states.find(s => String(s?.queueName || '').trim().toLowerCase() === target) || null;
}

function getLifecycleOutgoingTransitions(compiled, fromState) {
  const transitions = Array.isArray(compiled?.transitions) ? compiled.transitions : [];
  return transitions.filter(t => t.from === fromState);
}

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

  const enqueueMatch = text.match(/^enqueue\s+([^\s]+)$/i);
  if (enqueueMatch) {
    return { kind: 'enqueue', queueName: String(enqueueMatch[1] || '').trim() };
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

function toPacsFromMt103(message, fallbackTxId = null) {
  const text = typeof message === 'string' ? message : String(message || '');
  const txIdMatch = text.match(/:20:([^\s\r\n]+)/i);
  const amountMatch = text.match(/:32A:(\d{6})([A-Z]{3})([0-9.,]+)/i);
  const txId = String((txIdMatch && txIdMatch[1]) || fallbackTxId || `TX-${Date.now()}`).trim();
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

function toPacsFromMt202(message, fallbackTxId = null) {
  const text = typeof message === 'string' ? message : String(message || '');
  const txIdMatch = text.match(/:20:([^\s\r\n]+)/i);
  const relatedMatch = text.match(/:21:([^\s\r\n]+)/i);
  const amountMatch = text.match(/:32A:(\d{6})([A-Z]{3})([0-9.,]+)/i);
  const txId = String((txIdMatch && txIdMatch[1]) || fallbackTxId || `TX-${Date.now()}`).trim();
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

const systemPerformanceCache = {
  sampledAt: 0,
  value: null
};

function getWindowsPerformanceSnapshot() {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    const script = `
      $process = Get-Process -Id $PID | Select-Object Id,ProcessName,CPU,WorkingSet64,Handles,StartTime
      $os = Get-CimInstance Win32_OperatingSystem | Select-Object CSName,Caption,Version,FreePhysicalMemory,TotalVisibleMemorySize,LastBootUpTime
      $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace,VolumeName
      [ordered]@{
        process = $process
        os = $os
        disks = $disks
      } | ConvertTo-Json -Depth 4 -Compress
    `;

    const raw = execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      encoding: 'utf8',
      timeout: 2500,
      windowsHide: true
    });

    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return { error: e.message };
  }
}

function getDatabaseRegistrySnapshot() {
  if (process.platform !== 'win32') {
    return [];
  }

  const serviceName = SQL_INSTANCE_NAME ? `MSSQL$${SQL_INSTANCE_NAME}` : 'MSSQLSERVER';
  const serviceDisplayName = SQL_INSTANCE_NAME ? `SQL Server (${SQL_INSTANCE_NAME})` : 'SQL Server (MSSQLSERVER)';
  const serverId = SQL_INSTANCE_NAME ? `db-mssql-${String(SQL_INSTANCE_NAME).toLowerCase()}` : 'db-mssql-default';
  const dbName = SQL_INSTANCE_NAME ? `SQL Server ${SQL_INSTANCE_NAME}` : 'SQL Server Default Instance';
  try {
    const script = [
      `      $svc = Get-CimInstance Win32_Service -Filter \"Name='${serviceName.replace('$', '`$')}'\" | Select-Object Name,DisplayName,State,StartMode,Status`,
      '      if ($null -eq $svc) {',
      '        [ordered]@{',
      '          installed = $false',
      `          name = '${serviceName}'`,
      `          displayName = '${serviceDisplayName}'`,
      "          state = 'NotInstalled'",
      "          startMode = 'Disabled'",
      "          status = 'Unknown'",
      '        } | ConvertTo-Json -Compress',
      '      } else {',
      '        [ordered]@{',
      '          installed = $true',
      '          name = [string]$svc.Name',
      '          displayName = [string]$svc.DisplayName',
      '          state = [string]$svc.State',
      '          startMode = [string]$svc.StartMode',
      '          status = [string]$svc.Status',
      '        } | ConvertTo-Json -Compress',
      '      }'
    ].join('\n');

    const raw = execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      encoding: 'utf8',
      timeout: 2500,
      windowsHide: true
    });
    const service = raw ? JSON.parse(raw) : null;
    const serviceState = String(service?.state || '').toLowerCase();
    const status = !service?.installed
      ? 'not-installed'
      : serviceState === 'running'
        ? 'up'
        : serviceState === 'stopped'
          ? 'down'
          : 'degraded';

    return [{
      serverId,
      name: dbName,
      engine: 'mssql',
      instanceName: SQL_INSTANCE_NAME || 'MSSQLSERVER',
      serviceName,
      status,
      installed: Boolean(service?.installed),
      host: SQL_SERVER_HOST,
      port: 1433,
      serviceState: String(service?.state || 'Unknown'),
      startMode: String(service?.startMode || 'Unknown')
    }];
  } catch (e) {
    return [{
      serverId,
      name: dbName,
      engine: 'mssql',
      instanceName: SQL_INSTANCE_NAME || 'MSSQLSERVER',
      serviceName,
      status: 'unknown',
      installed: false,
      host: SQL_SERVER_HOST,
      port: 1433,
      serviceState: 'Unknown',
      startMode: 'Unknown',
      error: String(e.message || e)
    }];
  }
}

function getSystemPerformanceSnapshot() {
  const now = Date.now();
  if (systemPerformanceCache.value && now - systemPerformanceCache.sampledAt < 5000) {
    return systemPerformanceCache.value;
  }

  const cpuSamples = os.cpus();
  const cpuModel = cpuSamples[0] ? cpuSamples[0].model : null;
  const cpuSpeedMHz = cpuSamples[0] ? cpuSamples[0].speed : null;
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsed = Math.max(totalMemory - freeMemory, 0);
  const queueManagersSummary = Array.from(queueManagerInstances.entries()).map(([managerId, qm]) => ({
    managerId,
    queueCount: Object.keys(qm.queueConfig || {}).length,
    totalQueuedMessages: Object.keys(qm.queueConfig || {}).reduce((sum, queueName) => sum + qm.getQueueLength(queueName), 0),
    configVersion: Number(qm.configVersion || 0)
  }));

  const value = {
    sampledAt: new Date(now).toISOString(),
    platform: process.platform,
    arch: process.arch,
    node: {
      version: process.version,
      pid: process.pid,
      uptimeSeconds: Number(process.uptime().toFixed(3)),
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage()
    },
    os: {
      hostname: os.hostname(),
      type: os.type(),
      release: os.release(),
      uptimeSeconds: Number(os.uptime().toFixed(3)),
      loadAverage: typeof os.loadavg === 'function' ? os.loadavg() : [],
      totalMemory,
      freeMemory,
      memoryUsed,
      memoryUsedPercent: totalMemory > 0 ? Number(((memoryUsed / totalMemory) * 100).toFixed(2)) : 0,
      cpuCount: cpuSamples.length,
      cpuModel,
      cpuSpeedMHz
    },
    queueManagers: queueManagersSummary,
    windows: getWindowsPerformanceSnapshot()
  };

  systemPerformanceCache.sampledAt = now;
  systemPerformanceCache.value = value;
  return value;
}

function applyLifecycleMapping(mappingId, message, runtimeContext = {}) {
  const id = String(mappingId || '').trim().toLowerCase();
  if (!id) return message;

  if (id === 'mt103-to-pacs') {
    if (message && typeof message === 'object' && message.Document && typeof message.Document === 'object') {
      return message;
    }
    const txId = runtimeContext?.worker?.workerId
      ? `${runtimeContext.worker.workerId}-${Date.now()}`
      : null;
    return toPacsFromMt103(message, txId);
  }

  throw new Error(`Unsupported lifecycle mapping: ${id}`);
}

async function runLifecycleTransitionAction(action, runtimeContext, workerState) {
  const parsed = parseLifecycleAction(action, runtimeContext);
  if (parsed.kind === 'none') return;

  if (parsed.kind === 'map') {
    runtimeContext.message = applyLifecycleMapping(parsed.mappingId, runtimeContext.message, runtimeContext);
    return;
  }

  if (parsed.kind === 'enqueue') {
    if (!parsed.queueName) return;
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
  queueName = null
} = {}) {
  const writeEntry = buildTxStateDbWriteEntry(compiled, {
    message,
    fromState,
    toState,
    eventName,
    queueName
  });
  if (!writeEntry) return;

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

async function lifecycleHarnessStartTransaction(compiled, { txId, message } = {}) {
  const transactionId = String(txId || `TX-${Date.now()}`);
  const initialState = String(compiled?.initialState || '').trim();
  if (!initialState) {
    throw new Error('Compiled lifecycle has no initialState');
  }

  const payload = message || buildDefaultMt103Message(transactionId);
  await enqueueLifecycleStateMessage(compiled, initialState, payload, 'lifecycle-harness:start');
  await recordTransactionStateTransition(compiled, {
    message: payload,
    fromState: null,
    toState: initialState,
    eventName: 'start'
  });

  lifecycleHarness.active = {
    transactionId,
    currentState: initialState,
    message: payload,
    startedAt: new Date().toISOString(),
    lastEvent: null
  };
  lifecycleHarness.history.push({
    at: new Date().toISOString(),
    kind: 'start',
    transactionId,
    state: initialState
  });
  touchLifecycleActivity();

  return lifecycleHarness.active;
}

async function lifecycleHarnessAdvance(compiled, { eventName, context = {}, replacementMessage = null } = {}) {
  if (!lifecycleHarness.active) {
    throw new Error('No active lifecycle test transaction. Start one first.');
  }

  const fromState = lifecycleHarness.active.currentState;
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

  await dequeueLifecycleStateMessage(compiled, fromState, 'lifecycle-harness:step');
  if (replacementMessage != null) {
    lifecycleHarness.active.message = replacementMessage;
  }

  if (transition.action) {
    const runtimeContext = {
      ...context,
      message: lifecycleHarness.active.message,
      worker: { workerId: 'lifecycle-harness' }
    };
    const harnessWorkerState = { sourceService: 'lifecycle-harness' };
    await runLifecycleTransitionAction(transition.action, runtimeContext, harnessWorkerState);
    lifecycleHarness.active.message = runtimeContext.message;
  }

  await enqueueLifecycleStateMessage(compiled, transition.to, lifecycleHarness.active.message, 'lifecycle-harness:step', transition.event);
  await recordTransactionStateTransition(compiled, {
    message: lifecycleHarness.active.message,
    fromState,
    toState: transition.to,
    eventName: transition.event
  });

  lifecycleHarness.active.currentState = transition.to;
  lifecycleHarness.active.lastEvent = transition.event;

  lifecycleHarness.history.push({
    at: new Date().toISOString(),
    kind: 'transition',
    transactionId: lifecycleHarness.active.transactionId,
    from: transition.from,
    to: transition.to,
    event: transition.event
  });
  touchLifecycleActivity();

  return {
    transition,
    active: lifecycleHarness.active
  };
}

function isLikelyRejectTransition(transition) {
  const to = String(transition?.to || '').toLowerCase();
  const event = String(transition?.event || '').toLowerCase();
  const when = String(transition?.when || '').toLowerCase();
  return to.includes('reject') || event.includes('reject') || when.includes('rejected');
}

function deriveLifecycleHappyPath(compiled, { startState = null } = {}) {
  const initialState = String(startState || compiled?.initialState || '').trim();
  if (!initialState) {
    throw new Error('Compiled lifecycle has no initialState');
  }

  const happyContext = {
    status: 'approved',
    statement_match: true,
    statementMatch: true
  };

  const path = [];
  const seen = new Set();
  let current = initialState;
  let guard = 0;
  const maxSteps = Math.max(10, (Array.isArray(compiled?.states) ? compiled.states.length : 0) + 5);

  while (guard < maxSteps) {
    guard += 1;
    const key = `${current}#${guard}`;
    if (seen.has(key)) break;
    seen.add(key);

    const outgoing = getLifecycleOutgoingTransitions(compiled, current);
    if (!outgoing.length) break;

    const nonReject = outgoing.filter(t => !isLikelyRejectTransition(t));
    const preferred = nonReject.find(t => evaluateLifecycleTransitionGuard(t, happyContext));
    const fallbackPreferred = nonReject.find(t => evaluateLifecycleTransitionGuard(t, {}));
    const picked = preferred || fallbackPreferred || nonReject[0] || outgoing[0];
    if (!picked) break;

    path.push({
      from: picked.from,
      to: picked.to,
      event: picked.event,
      when: picked.when || null,
      action: picked.action || null
    });
    current = picked.to;
  }

  return {
    initialState,
    terminalState: current,
    transitionCount: path.length,
    context: happyContext,
    transitions: path
  };
}

function deriveLifecycleSadPath(compiled, { startState = null } = {}) {
  const initialState = String(startState || compiled?.initialState || '').trim();
  if (!initialState) {
    throw new Error('Compiled lifecycle has no initialState');
  }

  const sadContext = {
    status: 'rejected',
    statement_match: false,
    statementMatch: false
  };

  const path = [];
  let current = initialState;
  let guard = 0;
  const maxSteps = Math.max(10, (Array.isArray(compiled?.states) ? compiled.states.length : 0) + 5);

  while (guard < maxSteps) {
    guard += 1;
    const outgoing = getLifecycleOutgoingTransitions(compiled, current);
    if (!outgoing.length) break;

    const rejectCandidates = outgoing.filter(t => isLikelyRejectTransition(t));
    const preferredReject = rejectCandidates.find(t => evaluateLifecycleTransitionGuard(t, sadContext));
    const fallbackReject = rejectCandidates.find(t => evaluateLifecycleTransitionGuard(t, {}));
    const fallbackAny = outgoing.find(t => evaluateLifecycleTransitionGuard(t, sadContext))
      || outgoing.find(t => evaluateLifecycleTransitionGuard(t, {}));
    const picked = preferredReject || fallbackReject || fallbackAny || outgoing[0];
    if (!picked) break;

    path.push({
      from: picked.from,
      to: picked.to,
      event: picked.event,
      when: picked.when || null,
      action: picked.action || null
    });
    current = picked.to;

    if (isLikelyRejectTransition(picked)) {
      break;
    }
  }

  return {
    initialState,
    terminalState: current,
    transitionCount: path.length,
    context: sadContext,
    transitions: path
  };
}

async function runLifecycleHappyPath(compiled, { txId = null, message = null } = {}) {
  const derived = deriveLifecycleHappyPath(compiled);
  const transactionId = String(txId || `HAPPY-${Date.now()}`);
  const active = await lifecycleHarnessStartTransaction(compiled, {
    txId: transactionId,
    message: message || buildDefaultMt103Message(transactionId)
  });

  const steps = [];
  for (const transition of derived.transitions) {
    const result = await lifecycleHarnessAdvance(compiled, {
      eventName: transition.event,
      context: derived.context
    });
    steps.push({
      event: transition.event,
      from: transition.from,
      to: transition.to,
      currentState: result?.active?.currentState || transition.to
    });
  }

  return {
    transactionId: active.transactionId,
    initialState: derived.initialState,
    terminalState: lifecycleHarness.active?.currentState || derived.terminalState,
    transitionCount: steps.length,
    steps,
    context: derived.context
  };
}

async function runLifecycleSadPath(compiled, { txId = null, message = null } = {}) {
  const derived = deriveLifecycleSadPath(compiled);
  const transactionId = String(txId || `SAD-${Date.now()}`);
  const active = await lifecycleHarnessStartTransaction(compiled, {
    txId: transactionId,
    message: message || buildDefaultMt103Message(transactionId)
  });

  const steps = [];
  for (const transition of derived.transitions) {
    const replacementMessage = transition.to === 'rejected'
      ? buildDefaultPacsMessage(transactionId)
      : null;
    const result = await lifecycleHarnessAdvance(compiled, {
      eventName: transition.event,
      context: derived.context,
      replacementMessage
    });
    steps.push({
      event: transition.event,
      from: transition.from,
      to: transition.to,
      currentState: result?.active?.currentState || transition.to
    });
  }

  return {
    transactionId: active.transactionId,
    initialState: derived.initialState,
    terminalState: lifecycleHarness.active?.currentState || derived.terminalState,
    transitionCount: steps.length,
    steps,
    context: derived.context
  };
}

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

  app.get('/api/authz/me', (req, res) => {
    const actor = resolveActor(req);
    const profileMap = getProfilesById();
    const profiles = (actor.profileIds || [])
      .map(profileId => profileMap.get(profileId))
      .filter(Boolean);

    res.json({
      actor: {
        userId: actor.userId,
        displayName: actor.user?.displayName || null,
        enabled: actor.user?.enabled === true,
        profileIds: actor.profileIds || [],
        groupIds: actor.groupIds || [],
        employer: actor.user?.employer || USER_ORGANIZATION_NAME,
        department: actor.user?.department || null,
        jobTitle: actor.user?.jobTitle || null,
        officeLocation: actor.user?.officeLocation || null,
        country: actor.user?.country || null,
        managerEmail: actor.user?.managerEmail || null
      },
      profiles,
      permissions: actor.permissions
    });
  });

  app.get('/api/events/mermaid', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    let phase = 0;
    const send = () => {
      phase = (phase + 1) % 1024;
      res.write(`event: mermaid\n`);
      res.write(`data: ${JSON.stringify({ phase, at: Date.now() })}\n\n`);
    };

    send();
    const timer = setInterval(send, 1000);

    const close = () => {
      clearInterval(timer);
      try {
        res.end();
      } catch {
        // ignore close errors on disconnected clients
      }
    };

    req.on('close', close);
    req.on('aborted', close);
  });

  app.get('/api/authz/context', requirePermission('lifecycle.read'), (req, res) => {
    const actor = req.actor || resolveActor(req);
    const context = buildUserRoleContext(actor.userId);
    if (!context) {
      return res.status(404).json({ error: 'User context not found' });
    }
    return res.json({ context });
  });

  app.get('/api/users/:userId/context', requirePermission('users.read'), (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const context = buildUserRoleContext(userId);
    if (!context) {
      return res.status(404).json({ error: 'User context not found' });
    }
    return res.json({ context });
  });

  app.get('/api/users/:userId/employer', requirePermission('users.read'), (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const context = buildUserRoleContext(userId);
    if (!context) {
      return res.status(404).json({ error: 'User context not found' });
    }
    return res.json({
      userId: context.userId,
      employer: context.employment?.employer || USER_ORGANIZATION_NAME,
      department: context.employment?.department || null,
      country: context.employment?.country || null,
      officeLocation: context.employment?.officeLocation || null
    });
  });

  app.get('/api/users/:userId/roles', requirePermission('users.read'), (req, res) => {
    const userId = String(req.params.userId || '').trim();
    const context = buildUserRoleContext(userId);
    if (!context) {
      return res.status(404).json({ error: 'User context not found' });
    }
    return res.json({
      userId: context.userId,
      roles: context.roles,
      permissions: context.permissions,
      persona: context.persona
    });
  });

  app.get('/api/users/profiles', requirePermission('users.read'), (req, res) => {
    res.json({ profiles: userManagementStore.profiles });
  });

  app.get('/api/users/groups', requirePermission('users.read'), async (req, res) => {
    try {
      const includeDeletedValue = String(req.query.includeDeleted || '').trim().toLowerCase();
      const includeDeleted = includeDeletedValue === '1' || includeDeletedValue === 'true' || includeDeletedValue === 'yes';
      const groups = await groupProvider.listGroups({ includeDeleted });
      res.json({ groups });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/users/groups', requirePermission('users.manage'), async (req, res) => {
    try {
      const { groupId, label, description, privileges } = req.body || {};
      const id = String(groupId || '').trim();
      if (!id) {
        return res.status(400).json({ error: 'groupId is required' });
      }

      const group = await groupProvider.createGroup({
        groupId: id,
        label: String(label || id).trim(),
        description: String(description || '').trim(),
        privileges: Array.isArray(privileges) ? privileges : []
      });
      await refreshGroupPrivilegeCache();

      res.json({ status: 'created', group });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('already exists')) {
        return res.status(409).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/users/groups/:groupId', requirePermission('users.manage'), async (req, res) => {
    try {
      const groupId = String(req.params.groupId || '').trim();
      if (!groupId) {
        return res.status(400).json({ error: 'groupId is required' });
      }

      const updates = req.body || {};
      const group = await groupProvider.updateGroup(groupId, {
        label: updates.label,
        description: updates.description,
        privileges: updates.privileges
      });
      await refreshGroupPrivilegeCache();

      res.json({ status: 'updated', group });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: message });
      }
      if (message.toLowerCase().includes('soft-deleted')) {
        return res.status(409).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/users/groups/:groupId', requirePermission('users.manage'), async (req, res) => {
    try {
      const groupId = String(req.params.groupId || '').trim();
      if (!groupId) {
        return res.status(400).json({ error: 'groupId is required' });
      }

      const actor = resolveActor(req);
      const group = await groupProvider.softDeleteGroup(groupId, {
        deletedBy: actor?.userId || 'system-admin'
      });
      await refreshGroupPrivilegeCache();

      res.json({ status: 'soft-deleted', group });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/users/profiles', requirePermission('users.manage'), (req, res) => {
    const { profileId, label, description, permissions } = req.body || {};
    const id = String(profileId || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'profileId is required' });
    }
    if (userManagementStore.profiles.some(profile => profile.profileId === id)) {
      return res.status(409).json({ error: 'Profile already exists' });
    }

    const profile = {
      profileId: id,
      label: String(label || id).trim(),
      description: String(description || '').trim(),
      permissions: sanitizePermissions(permissions)
    };

    userManagementStore.profiles.push(profile);
    saveUserManagement();
    res.json({ status: 'created', profile });
  });

  app.patch('/api/users/profiles/:profileId', requirePermission('users.manage'), (req, res) => {
    const profileId = String(req.params.profileId || '').trim();
    const profile = userManagementStore.profiles.find(item => item.profileId === profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const updates = req.body || {};
    if (Object.prototype.hasOwnProperty.call(updates, 'label')) {
      profile.label = String(updates.label || profile.profileId).trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
      profile.description = String(updates.description || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'permissions')) {
      profile.permissions = sanitizePermissions(updates.permissions);
    }

    saveUserManagement();
    res.json({ status: 'updated', profile });
  });

  app.delete('/api/users/profiles/:profileId', requirePermission('users.manage'), (req, res) => {
    const profileId = String(req.params.profileId || '').trim();
    if (profileId === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin profile' });
    }

    const beforeCount = userManagementStore.profiles.length;
    userManagementStore.profiles = userManagementStore.profiles.filter(profile => profile.profileId !== profileId);
    if (userManagementStore.profiles.length === beforeCount) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    for (const user of userManagementStore.users) {
      user.profileIds = sanitizeProfileIds((user.profileIds || []).filter(id => id !== profileId));
    }

    saveUserManagement();
    res.json({ status: 'deleted', profileId });
  });

  app.get('/api/users', requirePermission('users.read'), (req, res) => {
    res.json({ users: userManagementStore.users });
  });

  app.get('/api/operations/monitor/classes', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const includeDisabledValue = String(req.query.includeDisabled || '').trim().toLowerCase();
      const includeDeletedValue = String(req.query.includeDeleted || '').trim().toLowerCase();
      const includeDisabled = includeDisabledValue === '1' || includeDisabledValue === 'true' || includeDisabledValue === 'yes';
      const includeDeleted = includeDeletedValue === '1' || includeDeletedValue === 'true' || includeDeletedValue === 'yes';
      const classes = await monitorClassProvider.listClasses({ includeDisabled, includeDeleted });
      res.json({ classes });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/operations/monitor/classes', requirePermission('lifecycle.manage'), async (req, res) => {
    try {
      const { classId, label, description, enabled, sortOrder } = req.body || {};
      const created = await monitorClassProvider.createClass({
        classId,
        label,
        description,
        enabled,
        sortOrder
      });
      res.json({ status: 'created', class: created });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('exists')) {
        return res.status(409).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/operations/monitor/classes/:classId', requirePermission('lifecycle.manage'), async (req, res) => {
    try {
      const classId = String(req.params.classId || '').trim();
      if (!classId) {
        return res.status(400).json({ error: 'classId is required' });
      }
      const updates = req.body || {};
      const updated = await monitorClassProvider.updateClass(classId, updates);
      res.json({ status: 'updated', class: updated });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: message });
      }
      if (message.toLowerCase().includes('deleted')) {
        return res.status(409).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/operations/monitor/classes/:classId', requirePermission('lifecycle.manage'), async (req, res) => {
    try {
      const classId = String(req.params.classId || '').trim();
      if (!classId) {
        return res.status(400).json({ error: 'classId is required' });
      }
      const actor = resolveActor(req);
      const deleted = await monitorClassProvider.softDeleteClass(classId, {
        deletedBy: actor?.userId || 'system-admin'
      });
      res.json({ status: 'soft-deleted', class: deleted });
    } catch (e) {
      const message = String(e.message || 'Unknown error');
      if (message.toLowerCase().includes('not found')) {
        return res.status(404).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/users', requirePermission('users.manage'), async (req, res) => {
    const { userId, email, displayName, enabled, profileIds, groupIds } = req.body || {};
    const id = normalizeUserIdentifier(email || userId);
    if (!id) {
      return res.status(400).json({ error: 'email is required' });
    }
    if (!isAcceptedUserIdentifier(id)) {
      return res.status(400).json({ error: 'User identifier must be a valid email address' });
    }
    if (userManagementStore.users.some(user => user.userId === id)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const knownProfiles = new Set(userManagementStore.profiles.map(profile => profile.profileId));
    const normalizedProfileIds = sanitizeProfileIds(profileIds).filter(profileId => knownProfiles.has(profileId));
    const directoryProfile = await resolveDirectoryProfile(id);

    const user = {
      userId: id,
      email: isValidEmailIdentifier(id) ? id : null,
      displayName: String(displayName || directoryProfile.displayName || id).trim(),
      enabled: enabled !== false,
      employer: USER_ORGANIZATION_NAME,
      department: String(directoryProfile.department || 'Operations').trim() || 'Operations',
      jobTitle: String(directoryProfile.jobTitle || 'Operations Analyst').trim() || 'Operations Analyst',
      officeLocation: String(directoryProfile.officeLocation || 'HQ').trim() || 'HQ',
      country: null,
      managerEmail: directoryProfile.managerEmail,
      profileIds: normalizedProfileIds,
      groupIds: sanitizeGroupIds(groupIds)
    };

    userManagementStore.users.push(user);
    saveUserManagement();
    res.json({ status: 'created', user });
  });

  app.patch('/api/users/:userId', requirePermission('users.manage'), async (req, res) => {
    const userId = normalizeUserIdentifier(req.params.userId);
    const user = userManagementStore.users.find(item => item.userId === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = req.body || {};
    if (Object.prototype.hasOwnProperty.call(updates, 'displayName')) {
      user.displayName = String(updates.displayName || user.userId).trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
      const nextEmail = normalizeUserIdentifier(updates.email);
      if (!isValidEmailIdentifier(nextEmail)) {
        return res.status(400).json({ error: 'email must be a valid email address' });
      }
      if (nextEmail !== user.userId && userManagementStore.users.some(item => item.userId === nextEmail)) {
        return res.status(409).json({ error: 'User already exists' });
      }
      user.email = nextEmail;
      if (user.userId !== DEFAULT_ACTOR_USER_ID) {
        user.userId = nextEmail;
      }
    } else {
      user.email = isValidEmailIdentifier(user.userId) ? user.userId : (user.email || null);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'enabled')) {
      user.enabled = updates.enabled === true;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'department')) {
      user.department = String(updates.department || '').trim() || 'Operations';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'employer')) {
      user.employer = String(updates.employer || USER_ORGANIZATION_NAME).trim() || USER_ORGANIZATION_NAME;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'jobTitle')) {
      user.jobTitle = String(updates.jobTitle || '').trim() || 'Operations Analyst';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'officeLocation')) {
      user.officeLocation = String(updates.officeLocation || '').trim() || 'HQ';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'managerEmail')) {
      const managerEmail = String(updates.managerEmail || '').trim().toLowerCase();
      user.managerEmail = managerEmail && isValidEmailIdentifier(managerEmail) ? managerEmail : null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'country')) {
      const country = String(updates.country || '').trim();
      user.country = country || null;
    }
    if (updates.refreshDirectory === true) {
      const lookupEmail = normalizeUserIdentifier(
        updates.email || user.email || (isValidEmailIdentifier(user.userId) ? user.userId : '')
      );
      if (!isValidEmailIdentifier(lookupEmail)) {
        return res.status(400).json({ error: 'Cannot refresh directory data without a valid email address' });
      }
      const directoryProfile = await resolveDirectoryProfile(lookupEmail);
      user.email = lookupEmail;
      if (user.userId !== DEFAULT_ACTOR_USER_ID) {
        user.userId = lookupEmail;
      }
      user.displayName = String(directoryProfile.displayName || user.displayName || lookupEmail).trim();
      user.department = String(directoryProfile.department || 'Operations').trim() || 'Operations';
      user.jobTitle = String(directoryProfile.jobTitle || 'Operations Analyst').trim() || 'Operations Analyst';
      user.officeLocation = String(directoryProfile.officeLocation || 'HQ').trim() || 'HQ';
      user.managerEmail = directoryProfile.managerEmail || null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'profileIds')) {
      const knownProfiles = new Set(userManagementStore.profiles.map(profile => profile.profileId));
      user.profileIds = sanitizeProfileIds(updates.profileIds).filter(profileId => knownProfiles.has(profileId));
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'groupIds')) {
      user.groupIds = sanitizeGroupIds(updates.groupIds);
    }

    saveUserManagement();
    res.json({ status: 'updated', user });
  });

  app.delete('/api/users/:userId', requirePermission('users.manage'), (req, res) => {
    const userId = normalizeUserIdentifier(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (userId === DEFAULT_ACTOR_USER_ID) {
      return res.status(400).json({ error: 'Cannot delete system admin user' });
    }

    const beforeCount = userManagementStore.users.length;
    userManagementStore.users = userManagementStore.users.filter(user => user.userId !== userId);
    if (userManagementStore.users.length === beforeCount) {
      return res.status(404).json({ error: 'User not found' });
    }

    saveUserManagement();
    res.json({ status: 'deleted', userId });
  });

  app.get('/api/governance/processes', requirePermission('governance.read'), (req, res) => {
    res.json({
      processes: processGovernanceStore.processes,
      updatedAt: processGovernanceStore.updatedAt,
      version: processGovernanceStore.version
    });
  });

  app.patch('/api/governance/processes/:processId', requirePermission('governance.manage'), (req, res) => {
    const processId = String(req.params.processId || '').trim();
    const process = getProcessPolicyById(processId);
    if (!process) {
      return res.status(404).json({ error: 'Process policy not found' });
    }

    const updates = req.body || {};
    if (Object.prototype.hasOwnProperty.call(updates, 'label')) {
      process.label = String(updates.label || process.processId).trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'requiresTwoPersonRule')) {
      process.requiresTwoPersonRule = updates.requiresTwoPersonRule === true;
    }

    saveProcessGovernance();
    res.json({ status: 'updated', process });
  });

  app.get('/api/governance/approvals', requirePermission('governance.read'), (req, res) => {
    const now = Date.now();
    const approvals = Array.from(pendingApprovalRequests.values())
      .filter(item => Number(item.expiresAt || 0) > now)
      .map(item => ({
        approvalId: item.approvalId,
        processId: item.processId,
        requestedByUserId: item.requestedByUserId,
        requestedAt: item.requestedAt,
        expiresAt: new Date(Number(item.expiresAt)).toISOString(),
        method: item.method,
        path: item.path,
        body: item.body
      }))
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

    res.json({ approvals, count: approvals.length });
  });

  app.delete('/api/governance/approvals/:approvalId', requirePermission('governance.manage'), (req, res) => {
    const approvalId = String(req.params.approvalId || '').trim();
    if (!pendingApprovalRequests.has(approvalId)) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    pendingApprovalRequests.delete(approvalId);
    appendAuditEvent({
      eventType: 'approval-cancelled',
      requestId: req.requestId || null,
      approvalId,
      cancelledByUserId: req.actor?.userId || null
    });
    res.json({ status: 'cancelled', approvalId });
  });

  app.post('/api/registry/heartbeat', (req, res) => {
    try {
      const { managerId, name, ip, port, status, queues, persistence } = req.body || {};
      const effectiveIp = ip || req.ip?.replace('::ffff:', '') || '127.0.0.1';
      upsertRemoteQueueManager({ managerId, name, nodeId: effectiveIp, ip: effectiveIp, port, status, queues });
      if (managerId && queueManagerRegistry.has(managerId)) {
        const current = queueManagerRegistry.get(managerId);
        current.persistence = persistence || current.persistence || null;
        queueManagerRegistry.set(managerId, current);
      }
      res.json({ status: 'ok' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/registry/service-instances/heartbeat', (req, res) => {
    try {
      const { serviceName, instanceId, nodeId, ip, port, status, metadata } = req.body || {};
      const effectiveIp = ip || req.ip?.replace('::ffff:', '') || '127.0.0.1';
      upsertServiceInstance({
        serviceName,
        instanceId,
        nodeId: nodeId || effectiveIp,
        ip: effectiveIp,
        port,
        status,
        metadata
      });
      res.json({ status: 'ok' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/supervisor/heartbeat', (req, res) => {
    try {
      const fallbackIp = String(req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '').trim();
      const heartbeat = normalizeSupervisorHeartbeatPayload(req.body || {}, fallbackIp);
      supervisorHeartbeatRegistry.set(heartbeat.nodeId, heartbeat);

      res.json({
        status: 'ok',
        nodeId: heartbeat.nodeId,
        overallHealthy: heartbeat.overallHealthy,
        stale: !isSupervisorHeartbeatFresh(heartbeat),
        receivedAt: heartbeat.receivedAt
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/supervisor/status', (req, res) => {
    res.json(getSupervisorHeartbeatSnapshot());
  });

  app.get('/api/supervisor/green', (req, res) => {
    const requiredNodeId = String(req.query?.nodeId || '').trim();
    const snapshot = getSupervisorHeartbeatSnapshot();

    if (requiredNodeId) {
      const entry = getSupervisorHeartbeatEntry(requiredNodeId);
      const fresh = isSupervisorHeartbeatFresh(entry);
      const healthy = Boolean(entry?.overallHealthy) && fresh;
      return res.status(healthy ? 200 : 503).json({
        healthy,
        requiredNodeId,
        entry: entry ? { ...entry, stale: !fresh } : null,
        ttlMs: SUPERVISOR_HEARTBEAT_TTL_MS
      });
    }

    const healthy = snapshot.anyHealthyFresh;
    return res.status(healthy ? 200 : 503).json({
      healthy,
      snapshot
    });
  });

  app.get('/api/registry/queue-managers', (req, res) => {
    const managers = Array.from(queueManagerRegistry.values()).sort((a, b) => a.managerId.localeCompare(b.managerId));
    res.json({ queueManagers: managers });
  });

  app.get('/api/registry/databases', (req, res) => {
    res.json({ databases: getDatabaseRegistrySnapshot() });
  });

  app.get('/api/replication/manager-sync-status', (req, res) => {
    const items = Array.from(queueManagerRegistry.values())
      .map(manager => {
        const pending = pendingManagerSync.get(manager.managerId) || null;
        return {
          managerId: manager.managerId,
          status: manager.status,
          syncState: manager.syncState || (MANAGER_ACTIVE_STATES.has(manager.status) ? 'ready' : 'unknown'),
          syncSourceManagerId: manager.syncSourceManagerId || null,
          lastSyncAt: manager.lastSyncAt || null,
          lastSyncVersion: Number(manager.lastSyncVersion || 0),
          lastSyncError: manager.lastSyncError || null,
          pendingSync: !!pending,
          pendingSince: pending ? new Date(pending.startedAt).toISOString() : null,
          pendingSourceManagerId: pending?.sourceManagerId || null,
        };
      })
      .sort((a, b) => a.managerId.localeCompare(b.managerId));

    res.json({ managers: items });
  });

  app.get('/api/replication/manager-sync-status/:managerId', (req, res) => {
    const manager = queueManagerRegistry.get(req.params.managerId);
    if (!manager) {
      return res.status(404).json({ error: 'Queue manager not found' });
    }

    const pending = pendingManagerSync.get(manager.managerId) || null;
    res.json({
      managerId: manager.managerId,
      status: manager.status,
      syncState: manager.syncState || (MANAGER_ACTIVE_STATES.has(manager.status) ? 'ready' : 'unknown'),
      syncSourceManagerId: manager.syncSourceManagerId || null,
      lastSyncAt: manager.lastSyncAt || null,
      lastSyncVersion: Number(manager.lastSyncVersion || 0),
      lastSyncError: manager.lastSyncError || null,
      pendingSync: !!pending,
      pendingSince: pending ? new Date(pending.startedAt).toISOString() : null,
      pendingSourceManagerId: pending?.sourceManagerId || null,
    });
  });

  app.get('/api/local-queue-managers', (req, res) => {
    res.json({ launchers: getLocalQueueManagerLaunchers() });
  });

  app.get('/api/remote-agents', (req, res) => {
    res.json({ agents: getRemoteAgentsPayload() });
  });

  app.post('/api/remote-agents/register', (req, res) => {
    try {
      const { agentId, baseUrl, token, allowedManagerPrefix } = req.body || {};
      const id = String(agentId || '').trim();
      const secret = String(token || '').trim();
      if (!id || !baseUrl || !secret) {
        return res.status(400).json({ error: 'agentId, baseUrl, and token are required' });
      }

      const entry = {
        agentId: id,
        baseUrl: normalizeRemoteAgentUrl(baseUrl),
        token: secret,
        allowedManagerPrefix: String(allowedManagerPrefix || 'qm-primary').trim() || 'qm-primary',
        createdAt: remoteAgentRegistry.get(id)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastPingAt: remoteAgentRegistry.get(id)?.lastPingAt || null,
        lastPingError: remoteAgentRegistry.get(id)?.lastPingError || null,
        lastKnownHealth: remoteAgentRegistry.get(id)?.lastKnownHealth || null,
      };

      remoteAgentRegistry.set(id, entry);
      res.json({ status: 'registered', agent: { ...entry, token: undefined, hasToken: true } });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/remote-agents/:agentId/ping', async (req, res) => {
    try {
      const agent = getRemoteAgentOrThrow(req.params.agentId);
      const health = await callRemoteAgent(agent, '/agent/health', 'GET');
      agent.lastPingAt = new Date().toISOString();
      agent.lastPingError = null;
      agent.lastKnownHealth = health;
      remoteAgentRegistry.set(agent.agentId, agent);
      res.json({ status: 'ok', agentId: agent.agentId, health });
    } catch (e) {
      const agent = remoteAgentRegistry.get(req.params.agentId);
      if (agent) {
        agent.lastPingAt = new Date().toISOString();
        agent.lastPingError = e.message;
        remoteAgentRegistry.set(agent.agentId, agent);
      }
      res.status(502).json({ error: e.message });
    }
  });

  app.get('/api/remote-queue-managers', (req, res) => {
    res.json({ launchers: getRemoteLaunchersPayload() });
  });

  app.post('/api/remote-queue-managers/start', async (req, res) => {
    try {
      const {
        agentId,
        managerId,
        nodeId,
        port,
        advertiseIp,
        aggregatorUrl,
      } = req.body || {};

      if (!agentId || !managerId || !port || !advertiseIp) {
        return res.status(400).json({ error: 'agentId, managerId, port, and advertiseIp are required' });
      }

      const agent = getRemoteAgentOrThrow(agentId);
      if (!String(managerId).startsWith(agent.allowedManagerPrefix)) {
        return res.status(400).json({
          error: `managerId must start with ${agent.allowedManagerPrefix} for agent ${agent.agentId}`
        });
      }

      const sourceManager = pickSyncSourceManager(managerId);
      if (sourceManager) {
        pendingManagerSync.set(managerId, {
          sourceManagerId: sourceManager.managerId,
          startedAt: Date.now(),
        });
      }

      upsertRemoteQueueManager({
        managerId,
        name: managerId,
        nodeId: nodeId || agent.agentId,
        ip: advertiseIp,
        port: Number(port),
        status: sourceManager ? 'syncing' : 'up',
        queues: []
      });

      if (sourceManager) {
        const pendingManager = queueManagerRegistry.get(managerId);
        if (pendingManager) {
          pendingManager.lastHeartbeat = 0;
          queueManagerRegistry.set(managerId, pendingManager);
        }
      }

      const remoteLaunch = await callRemoteAgent(agent, '/agent/qm/start', 'POST', {
        managerId,
        nodeId: nodeId || agent.agentId,
        port: Number(port),
        advertiseIp,
        aggregatorUrl: aggregatorUrl || `http://127.0.0.1:${HTTP_PORT}`,
      });

      remoteQueueManagerProcesses.set(managerId, {
        managerId,
        agentId: agent.agentId,
        nodeId: nodeId || agent.agentId,
        port: Number(port),
        advertiseIp,
        aggregatorUrl: aggregatorUrl || `http://127.0.0.1:${HTTP_PORT}`,
        status: 'running',
        startedAt: new Date().toISOString(),
        stoppedAt: null,
        lastError: null,
        remote: remoteLaunch || null,
      });

      if (!sourceManager) {
        const manager = queueManagerRegistry.get(managerId);
        if (manager) {
          manager.status = 'up';
          manager.syncState = 'ready';
          manager.lastSyncAt = new Date().toISOString();
          manager.lastSyncError = null;
          queueManagerRegistry.set(managerId, manager);
        }
        return res.json({
          status: 'started',
          remote: remoteLaunch,
          sync: { required: false }
        });
      }

      waitForManagerRegistration(managerId)
        .then(() => syncManagerBeforeActivation(managerId, sourceManager.managerId))
        .catch((error) => {
          const manager = queueManagerRegistry.get(managerId);
          if (manager) {
            manager.status = 'sync-failed';
            manager.syncState = 'failed';
            manager.lastSyncError = error.message;
            queueManagerRegistry.set(managerId, manager);
          }
          const launcher = remoteQueueManagerProcesses.get(managerId);
          if (launcher) {
            launcher.status = 'error';
            launcher.lastError = error.message;
            remoteQueueManagerProcesses.set(managerId, launcher);
          }
          pendingManagerSync.delete(managerId);
          console.error(`[SYNC] Failed initial remote sync for ${managerId}: ${error.message}`);
        });

      res.json({
        status: 'started',
        remote: remoteLaunch,
        sync: {
          required: true,
          state: 'syncing',
          sourceManagerId: sourceManager.managerId,
        }
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/remote-queue-managers/:managerId/stop', async (req, res) => {
    try {
      const managerId = req.params.managerId;
      const launcher = remoteQueueManagerProcesses.get(managerId);
      if (!launcher) {
        return res.status(404).json({ error: 'Remote queue manager launcher not found' });
      }

      const bodyAgentId = String(req.body?.agentId || '').trim();
      const targetAgentId = bodyAgentId || launcher.agentId;
      const agent = getRemoteAgentOrThrow(targetAgentId);
      const remoteStop = await callRemoteAgent(agent, `/agent/qm/${encodeURIComponent(managerId)}/stop`, 'POST');

      launcher.status = 'stopping';
      launcher.stoppedAt = new Date().toISOString();
      launcher.remote = remoteStop || launcher.remote;
      remoteQueueManagerProcesses.set(managerId, launcher);

      const manager = queueManagerRegistry.get(managerId);
      if (manager) {
        manager.status = 'down';
        manager.updatedAt = new Date().toISOString();
        queueManagerRegistry.set(managerId, manager);
      }

      pendingManagerSync.delete(managerId);
      res.json({ status: 'stopping', managerId, remote: remoteStop || null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/remote-queue-managers/:managerId/status', async (req, res) => {
    try {
      const managerId = req.params.managerId;
      const launcher = remoteQueueManagerProcesses.get(managerId);
      if (!launcher) {
        return res.status(404).json({ error: 'Remote queue manager launcher not found' });
      }
      const agent = getRemoteAgentOrThrow(launcher.agentId);
      const remoteStatus = await callRemoteAgent(agent, `/agent/qm/${encodeURIComponent(managerId)}/status`, 'GET');
      res.json({ managerId, launcher, remoteStatus });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/local-queue-managers/start', (req, res) => {
    try {
      const defaultIp = req.ip?.replace('::ffff:', '') || '127.0.0.1';
      const {
        managerId,
        nodeId,
        port,
        advertiseIp,
        aggregatorUrl,
      } = req.body || {};

      if (!managerId || !port) {
        return res.status(400).json({ error: 'managerId and port are required' });
      }

      const sourceManager = pickSyncSourceManager(managerId);
      if (sourceManager) {
        pendingManagerSync.set(managerId, {
          sourceManagerId: sourceManager.managerId,
          startedAt: Date.now(),
        });
      }

      upsertRemoteQueueManager({
        managerId,
        name: managerId,
        nodeId: nodeId || os.hostname(),
        ip: advertiseIp || defaultIp,
        port: Number(port),
        status: sourceManager ? 'syncing' : 'up',
        queues: []
      });

      // Force waitForManagerRegistration to wait for a real heartbeat from the spawned process.
      if (sourceManager) {
        const pendingManager = queueManagerRegistry.get(managerId);
        if (pendingManager) {
          pendingManager.lastHeartbeat = 0;
          queueManagerRegistry.set(managerId, pendingManager);
        }
      }

      const entry = launchLocalQueueManager({
        managerId,
        nodeId: nodeId || os.hostname(),
        port: Number(port),
        advertiseIp: advertiseIp || defaultIp,
        aggregatorUrl: aggregatorUrl || `http://127.0.0.1:${HTTP_PORT}`,
      });

      if (!sourceManager) {
        const manager = queueManagerRegistry.get(managerId);
        if (manager) {
          manager.status = 'up';
          manager.syncState = 'ready';
          manager.lastSyncAt = new Date().toISOString();
          manager.lastSyncError = null;
          queueManagerRegistry.set(managerId, manager);
        }
        return res.json({
          status: 'started',
          launcher: getLocalQueueManagerLaunchers().find(x => x.managerId === entry.managerId),
          sync: { required: false }
        });
      }

      // Run initial sync in background. Manager remains non-routable while status is 'syncing'.
      waitForManagerRegistration(managerId)
        .then(() => syncManagerBeforeActivation(managerId, sourceManager.managerId))
        .catch((error) => {
          const manager = queueManagerRegistry.get(managerId);
          if (manager) {
            manager.status = 'sync-failed';
            manager.syncState = 'failed';
            manager.lastSyncError = error.message;
            queueManagerRegistry.set(managerId, manager);
          }
          pendingManagerSync.delete(managerId);
          console.error(`[SYNC] Failed initial sync for ${managerId}: ${error.message}`);
        });

      res.json({
        status: 'started',
        launcher: getLocalQueueManagerLaunchers().find(x => x.managerId === entry.managerId),
        sync: {
          required: true,
          state: 'syncing',
          sourceManagerId: sourceManager.managerId,
        }
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/local-queue-managers/:managerId/stop', (req, res) => {
    const entry = stopLocalQueueManager(req.params.managerId);
    if (!entry) {
      return res.status(404).json({ error: 'Queue manager launcher not found' });
    }
    res.json({ status: 'stopping', managerId: req.params.managerId });
  });

  app.get('/api/registry/services', (req, res) => {
    const services = {};
    for (const instance of serviceInstanceRegistry.values()) {
      if (!services[instance.serviceName]) services[instance.serviceName] = [];
      services[instance.serviceName].push(instance);
    }
    res.json({ services });
  });

  app.get('/api/ui/card-overrides', requirePermission('lifecycle.read'), (req, res) => {
    res.json({
      hiddenMap: uiCardOverrides.hiddenMap || {},
      renameMap: uiCardOverrides.renameMap || {},
      runtimeMap: uiCardOverrides.runtimeMap || {}
    });
  });

  app.put('/api/ui/card-overrides', requirePermission('lifecycle.manage'), (req, res) => {
    try {
      uiCardOverrides = saveCardOverridesToDisk(req.body || {});
      res.json({
        status: 'ok',
        hiddenMap: uiCardOverrides.hiddenMap,
        renameMap: uiCardOverrides.renameMap,
        runtimeMap: uiCardOverrides.runtimeMap || {}
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  function parseRuntimeInstanceId(rawInstanceId) {
    const text = String(rawInstanceId || '').trim();
    const [rawClassId, ...rest] = text.split(':');
    const classId = String(rawClassId || '').trim().toLowerCase();
    const instanceKey = rest.join(':').trim();
    return { classId, instanceKey };
  }

  function requireRuntimePermission(req, permission) {
    const permissions = Array.isArray(req?.authz?.permissions) ? req.authz.permissions : [];
    return hasPermission(permissions, permission);
  }

  app.post('/api/runtime/classes/database/actions/:action', requirePermission('queue.operate'), (req, res) => {
    const action = String(req.params.action || '').toLowerCase();
    const statusMap = {
      quiesce: 'quiesced',
      maintenance: 'maintenance',
      'return-service': 'up',
      up: 'up'
    };

    const nextStatus = statusMap[action];
    if (!nextStatus) {
      return res.status(400).json({ error: 'Unsupported action. Use quiesce, maintenance, return-service, or up.' });
    }

    const changed = [];
    for (const manager of queueManagerRegistry.values()) {
      const updated = setQueueManagerStatus(manager.managerId, nextStatus);
      if (updated) changed.push(updated.managerId);
    }

    res.json({ status: 'ok', classId: 'database', action, affectedInstanceIds: changed });
  });

  app.post('/api/runtime/classes/broker/actions/:action', requirePermission('broker.operate'), (req, res) => {
    const action = String(req.params.action || '').toLowerCase();
    if (!['up', 'down', 'quiesce', 'unquiesce'].includes(action)) {
      return res.status(400).json({ error: 'Unsupported action. Use up, down, quiesce, or unquiesce.' });
    }

    try {
      if (action === 'up') {
        globalThis.brokerClassDown = false;
        setBrokerInstanceState('primary', { active: true, quiesced: false });
      }

      if (action === 'down') {
        globalThis.brokerClassDown = true;
        for (const instanceId of brokerInstances.keys()) {
          setBrokerInstanceState(instanceId, { active: false, quiesced: false });
        }
      }

      if (action === 'quiesce' || action === 'unquiesce') {
        if (globalThis.brokerClassDown) {
          return res.status(409).json({ error: 'Broker class is down. Use action=up first.' });
        }
        const shouldQuiesce = action === 'quiesce';
        for (const [instanceId, instance] of brokerInstances.entries()) {
          if (instance.active) {
            setBrokerInstanceState(instanceId, { quiesced: shouldQuiesce });
          }
        }
      }

      res.json({
        status: 'ok',
        classId: 'broker',
        action,
        classState: getBrokerStateLabel(),
        brokers: getBrokerInstancesPayload()
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/runtime/classes/gateway/actions/:action', requirePermission('gateway.manage'), async (req, res) => {
    const action = String(req.params.action || '').toLowerCase();
    if (!['start', 'stop', 'quiesce'].includes(action)) {
      return res.status(400).json({ error: 'Unsupported action. Use start, stop, or quiesce.' });
    }

    try {
      const requestedConfig = req.body && typeof req.body === 'object' ? req.body : {};
      const requestedTargets = Array.isArray(requestedConfig.targets)
        ? requestedConfig.targets.map((v) => String(v || '').trim().toLowerCase()).filter((v) => GATEWAY_IDS.includes(v))
        : [];
      const keyedTargets = GATEWAY_IDS.filter((gatewayId) => requestedConfig[gatewayId] && typeof requestedConfig[gatewayId] === 'object');
      const targetGatewayIds = requestedTargets.length > 0
        ? requestedTargets
        : (keyedTargets.length > 0 ? keyedTargets : GATEWAY_IDS);

      const operationResults = [];
      for (const gatewayId of targetGatewayIds) {
        const gatewayConfig = requestedConfig[gatewayId] && typeof requestedConfig[gatewayId] === 'object'
          ? requestedConfig[gatewayId]
          : requestedConfig;
        const result = await executeGatewayAction(gatewayId, action, gatewayConfig);
        operationResults.push({ gatewayId, ...result });
      }

      res.json({ status: 'ok', classId: 'gateway', action, operations: operationResults, gateways: getGatewayStatusPayload() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/runtime/instances/:instanceId/config', requirePermission('registry.read'), (req, res) => {
    const { classId, instanceKey } = parseRuntimeInstanceId(req.params.instanceId);

    if (classId === 'database') {
      const manager = queueManagerRegistry.get(instanceKey);
      if (!manager) {
        return res.status(404).json({ error: 'Database server instance not found' });
      }

      const provider = String(manager?.persistence?.provider || manager?.provider || 'queue-manager');
      const config = manager?.persistence?.config && typeof manager.persistence.config === 'object'
        ? manager.persistence.config
        : {};

      return res.json({
        instanceId: `database:${manager.managerId}`,
        classId: 'database',
        provider,
        configurable: true,
        config: {
          managerId: manager.managerId,
          nodeId: manager.nodeId,
          ip: manager.ip,
          port: manager.port,
          status: manager.status,
          ...config
        }
      });
    }

    if (classId === 'broker') {
      if (instanceKey === 'class' || instanceKey === 'network') {
        return res.json({
          instanceId: 'broker:class',
          classId: 'broker',
          provider: brokerRuntimeConfig.provider,
          configurable: true,
          config: {
            provider: brokerRuntimeConfig.provider,
            url: brokerRuntimeConfig.url,
            exchangeName: brokerRuntimeConfig.exchangeName,
            queuePrefix: brokerRuntimeConfig.queuePrefix,
            msmqBaseQueuePath: brokerRuntimeConfig.msmqBaseQueuePath,
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
          }
        });
      }

      const instance = brokerInstances.get(instanceKey);
      if (!instance) {
        return res.status(404).json({ error: 'Broker instance not found' });
      }

      return res.json({
        instanceId: `broker:${instanceKey}`,
        classId: 'broker',
        provider: brokerRuntimeConfig.provider,
        configurable: true,
        config: {
          instanceId: instanceKey,
          active: Boolean(instance.active),
          quiesced: Boolean(instance.quiesced),
          provider: brokerRuntimeConfig.provider
        }
      });
    }

    if (classId === 'gateway') {
      const gateways = getGatewayStatusPayload();
      const gateway = gateways[instanceKey];
      if (!gateway) {
        return res.status(404).json({ error: 'Gateway instance not found' });
      }

      const runtime = gatewayRuntimeConfig[instanceKey] || createDefaultGatewayRuntimeConfig();

      return res.json({
        instanceId: `gateway:${instanceKey}`,
        classId: 'gateway',
        provider: 'gateway-adapter',
        configurable: true,
        config: {
          gatewayId: instanceKey,
          running: Boolean(gateway.running),
          quiesced: Boolean(gateway.quiesced),
          mode: String(gateway.mode || 'live'),
          workerIds: Array.isArray(gateway.workerIds) ? gateway.workerIds : [],
          controlPlane: runtime.controlPlane,
          remoteApi: {
            enabled: Boolean(runtime.remoteApi?.enabled),
            baseUrl: String(runtime.remoteApi?.baseUrl || ''),
            timeoutMs: Number(runtime.remoteApi?.timeoutMs || 5000),
            fallbackToLocal: Boolean(runtime.remoteApi?.fallbackToLocal),
            authType: String(runtime.remoteApi?.authType || 'none'),
            authHeader: String(runtime.remoteApi?.authHeader || 'Authorization'),
            token: String(runtime.remoteApi?.token || ''),
            apiKeyHeader: String(runtime.remoteApi?.apiKeyHeader || 'x-api-key'),
            apiKey: String(runtime.remoteApi?.apiKey || ''),
            actionPaths: {
              start: String(runtime.remoteApi?.actionPaths?.start || '/api/control/start'),
              stop: String(runtime.remoteApi?.actionPaths?.stop || '/api/control/stop'),
              quiesce: String(runtime.remoteApi?.actionPaths?.quiesce || '/api/control/quiesce')
            }
          }
        }
      });
    }

    return res.status(400).json({ error: 'Unknown runtime instance class' });
  });

  app.put('/api/runtime/instances/:instanceId/config', requirePermission('registry.manage'), (req, res) => {
    const { classId, instanceKey } = parseRuntimeInstanceId(req.params.instanceId);
    const payload = req.body || {};

    if (classId === 'database') {
      const manager = queueManagerRegistry.get(instanceKey);
      if (!manager) {
        return res.status(404).json({ error: 'Database server instance not found' });
      }
      const provider = String(payload?.provider || manager?.persistence?.provider || manager?.provider || 'queue-manager').trim() || 'queue-manager';
      const nextConfig = payload?.config && typeof payload.config === 'object' ? payload.config : {};
      manager.persistence = {
        provider,
        config: nextConfig
      };
      manager.updatedAt = new Date().toISOString();
      queueManagerRegistry.set(manager.managerId, manager);
      return res.json({ status: 'updated', instanceId: `database:${manager.managerId}`, provider, config: nextConfig });
    }

    if (classId === 'broker') {
      if (instanceKey === 'class' || instanceKey === 'network') {
        if (!requireRuntimePermission(req, 'broker.configure')) {
          return res.status(403).json({ error: 'Permission denied: broker.configure is required.' });
        }

        const nextConfig = payload?.config && typeof payload.config === 'object' ? payload.config : {};
        try {
          const runtime = rebuildBrokerInstances(nextConfig);
          return res.json({ status: 'updated', instanceId: 'broker:class', broker: runtime });
        } catch (e) {
          return res.status(400).json({ error: e.message });
        }
      }

      if (!requireRuntimePermission(req, 'broker.operate')) {
        return res.status(403).json({ error: 'Permission denied: broker.operate is required.' });
      }

      const instance = brokerInstances.get(instanceKey);
      if (!instance) {
        return res.status(404).json({ error: 'Broker instance not found' });
      }

      const nextConfig = payload?.config && typeof payload.config === 'object' ? payload.config : {};
      const active = Object.prototype.hasOwnProperty.call(nextConfig, 'active') ? Boolean(nextConfig.active) : Boolean(instance.active);
      const quiesced = Object.prototype.hasOwnProperty.call(nextConfig, 'quiesced') ? Boolean(nextConfig.quiesced) : Boolean(instance.quiesced);
      setBrokerInstanceState(instanceKey, { active, quiesced });
      return res.json({ status: 'updated', instanceId: `broker:${instanceKey}`, config: { active, quiesced } });
    }

    if (classId === 'gateway') {
      if (!requireRuntimePermission(req, 'gateway.manage')) {
        return res.status(403).json({ error: 'Permission denied: gateway.manage is required.' });
      }

      if (!GATEWAY_IDS.includes(instanceKey)) {
        return res.status(404).json({ error: 'Gateway instance not found' });
      }

      const nextConfig = payload?.config && typeof payload.config === 'object' ? payload.config : {};
      if (Object.prototype.hasOwnProperty.call(nextConfig, 'mode')) {
        gatewayModeState[instanceKey] = String(nextConfig.mode || gatewayModeState[instanceKey] || 'live').trim().toLowerCase() || 'live';
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, 'quiesced')) {
        gatewayQuiesceState[instanceKey] = Boolean(nextConfig.quiesced);
      }
      if (Object.prototype.hasOwnProperty.call(nextConfig, 'controlPlane') || Object.prototype.hasOwnProperty.call(nextConfig, 'remoteApi')) {
        gatewayRuntimeConfig[instanceKey] = normalizeGatewayRuntimeConfig({
          controlPlane: nextConfig.controlPlane,
          remoteApi: nextConfig.remoteApi
        }, gatewayRuntimeConfig[instanceKey]);
      }
      return res.json({ status: 'updated', instanceId: `gateway:${instanceKey}`, config: nextConfig, gateway: getGatewayStatusPayload()[instanceKey] });
    }

    return res.status(400).json({ error: 'Unknown runtime instance class' });
  });

  app.post('/api/registry/nodes/:nodeId/quiesce', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'quiesced');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'quiesced' });
  });

  app.post('/api/registry/nodes/:nodeId/drain', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'draining');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    const drain = getNodeDrainStatus(req.params.nodeId);
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'draining', drain });
  });

  app.get('/api/registry/nodes/:nodeId/drain-status', (req, res) => {
    const drain = getNodeDrainStatus(req.params.nodeId);
    if (drain.managerCount === 0) return res.status(404).json({ error: 'Node not found' });
    res.json(drain);
  });

  app.post('/api/registry/nodes/:nodeId/maintenance', (req, res) => {
    const force = req.query.force === 'true';
    const drain = getNodeDrainStatus(req.params.nodeId);
    if (drain.managerCount === 0) return res.status(404).json({ error: 'Node not found' });
    if (!drain.drainReady && !force) {
      return res.status(409).json({
        error: 'Node not drained',
        message: 'Use /drain-status and wait for pendingMessagesKnown=0, or pass ?force=true',
        drain
      });
    }
    const changed = setNodeLifecycleState(req.params.nodeId, 'maintenance');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'maintenance' });
  });

  app.post('/api/registry/nodes/:nodeId/return-service', (req, res) => {
    const changed = setNodeLifecycleState(req.params.nodeId, 'up');
    if (!changed) return res.status(404).json({ error: 'Node not found' });
    res.json({ status: 'ok', nodeId: req.params.nodeId, lifecycle: 'up' });
  });

  app.post('/api/registry/queue-managers/:managerId/quiesce', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'quiesced');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.post('/api/registry/queue-managers/:managerId/maintenance', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'maintenance');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.post('/api/registry/queue-managers/:managerId/return-service', (req, res) => {
    const manager = setQueueManagerStatus(req.params.managerId, 'up');
    if (!manager) return res.status(404).json({ error: 'Queue manager not found' });
    res.json({ status: 'ok', manager });
  });

  app.get('/api/registry/queues', (req, res) => {
    const queues = Array.from(queueRoutes.values()).map(route => {
      const manager = queueManagerRegistry.get(route.managerId);
      let queueLength = null;
      if (manager?.local) {
        queueLength = queueManagers[manager.localIndex].getQueueLength(route.queueName);
      }
      return {
        queueName: route.queueName,
        managerId: route.managerId,
        queueLength,
        assignedAt: route.assignedAt
      };
    });
    res.json({ queues });
  });

  registerRoutesFromManifest({
    app,
    manifest: ROUTE_ROLE_MANIFEST,
    registrars: {
      registerLifecycleInquiryRoutes,
      registerLifecycleWorkerGatewayRoutes,
      registerQueueBrokerOpsRoutes,
      registerComplianceRoutes,
      registerObservabilityRoutes,
      registerPlatformRoutes,
      registerReplicationRoutes,
      registerQueueConfigRoutes,
      registerQueueTransferRoutes
    },
    dependencyFactories: {
      lifecycleInquiry: () => ({
        requirePermission,
        readTransactionLifecycleCompiled,
        getFsmEntityStateFromSql,
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
        updateNlpUserProfileFromFeedback
      }),
      lifecycleWorkerGateway: () => ({
        requirePermission,
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
        stopRouterWorker
      }),
      queueBrokerOps: () => ({
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
        globalState: globalThis,
        getActiveQueueManagers,
        ensureQueueTriggeredFlowForQueue,
        queueValidationErrors,
        requirePermission,
        dlqEvents,
        summarizeDlqEvents,
        dequeueViaRoute
      }),
      compliance: () => ({
        requirePermission,
        resolveActor,
        formatErrorDetails,
        sanctionsComplianceService
      }),
      observability: () => ({
        requirePermission,
        metricsCollector,
        evaluateLatencyPolicies,
        getWorkerConfig: () => workerConfig,
        getStep3LatencySummary,
        getQueueEnqueueLatencySummary,
        getEdgeOffloadMetricsSummary,
        getTxStatePersistenceSummary,
        getNodeRuntimeDiagnosticsSnapshot
      }),
      platform: () => ({
        requirePermission,
        enumerateApiCatalog,
        resolvePermissionForApiRequest,
        routeRoleManifest: ROUTE_ROLE_MANIFEST
      }),
      replication: () => ({
        queueManagerRegistry,
        queueManagers
      }),
      queueConfig: () => ({
        requirePermission,
        queueManagerInstances,
        queueManagerRegistry,
        inferQueueDataTypeIds,
        compileQueueDslSpec,
        diffQueueConfigs,
        resolveLibrarianOrigin,
        IS_PRODUCTION_ENV,
        ALLOW_TEMP_QUEUES_IN_PRODUCTION
      }),
      queueTransfer: () => ({
        requirePermission,
        queueManagerInstances
      })
    }
  });

  app.post('/api/router/rules', async (req, res) => {
    try {
      const rule = await messageRouter.upsertRule(req.body || {});
      res.json({ status: 'upserted', rule });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/router/rules/:ruleId', async (req, res) => {
    try {
      const removed = await messageRouter.deleteRule(req.params.ruleId);
      if (!removed) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      res.json({ status: 'deleted', ruleId: req.params.ruleId });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/router/ingest', async (req, res) => {
    try {
      const { inputQueue, message, sourceService, useEdge, edgeRole } = req.body || {};
      if (!inputQueue) {
        return res.status(400).json({ error: 'inputQueue is required' });
      }
      const shouldForceEdge = parseBooleanLike(useEdge, false);
      const routed = await ingestWithEdgeFallback({
        inputQueue,
        message,
        sourceService: sourceService || 'webapi',
        forceEdge: shouldForceEdge,
        preferredEdgeRole: edgeRole
      });
      res.json({ status: 'routed', mode: routed.mode, edge: routed.edge, result: routed.result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/edge/ingest', async (req, res) => {
    try {
      const { inputQueue, message, sourceService, useEdge, convertMtToXml, edgeRole } = req.body || {};
      if (!inputQueue) return res.status(400).json({ error: 'inputQueue is required' });
      const convertRequested = parseBooleanLike(convertMtToXml, false);
      const routed = await ingestWithEdgeFallback({
        inputQueue,
        message,
        sourceService: sourceService || 'edge-api',
        forceEdge: parseBooleanLike(useEdge, true),
        convertMtToXml: convertRequested,
        preferredEdgeRole: edgeRole
      });
      return res.json({
        status: 'ok',
        mode: routed.mode,
        edge: routed.edge,
        conversion: {
          requested: convertRequested,
          location: 'esp32-edge'
        },
        result: routed.result
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/router/process/:inputQueue', async (req, res) => {
    try {
      const { inputQueue } = req.params;
      const { maxMessages, consumerService } = req.body || {};
      const result = await messageRouter.processFromQueue(inputQueue, {
        maxMessages: maxMessages || 1,
        consumerService: consumerService || 'router-worker'
      });
      res.json({ status: 'processed', mode: 'queue', result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/router/workers', (req, res) => {
    res.json({ workers: getRouterWorkersPayload() });
  });

  app.get('/api/lifecycle/dashboard', (req, res) => {
    const compiled = readTransactionLifecycleCompiled();
    if (!compiled) {
      return res.status(404).json({
        error: 'Lifecycle compiled artifact not found',
        hint: 'Run: npm run compile:lifecycle'
      });
    }

    const payload = buildTransactionLifecycleDashboardPayload(compiled);
    if (!payload) {
      return res.status(500).json({ error: 'Lifecycle artifact is invalid' });
    }

    return res.json(payload);
  });

  app.get('/api/lifecycle/happy-path', requirePermission('lifecycle.read'), (req, res) => {
    if (!ENABLE_LIFECYCLE_PATH_TESTERS) {
      return res.status(503).json({ error: 'Lifecycle path testers are disabled' });
    }
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }
      const happyPath = deriveLifecycleHappyPath(compiled);
      return res.json({ status: 'ok', happyPath });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/lifecycle/sad-path', requirePermission('lifecycle.read'), (req, res) => {
    if (!ENABLE_LIFECYCLE_PATH_TESTERS) {
      return res.status(503).json({ error: 'Lifecycle path testers are disabled' });
    }
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }
      const sadPath = deriveLifecycleSadPath(compiled);
      return res.json({ status: 'ok', sadPath });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/happy-path/run', requirePermission('lifecycle.manage'), async (req, res) => {
    if (!ENABLE_LIFECYCLE_PATH_TESTERS) {
      return res.status(503).json({ error: 'Lifecycle path testers are disabled' });
    }
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { txId, message } = req.body || {};
      const result = await runLifecycleHappyPath(compiled, { txId, message });
      recordLifecycleTesterRun('happy', {
        status: 'completed',
        transitionCount: result.transitionCount,
        transactionId: result.transactionId
      });
      return res.json({ status: 'completed', result });
    } catch (e) {
      recordLifecycleTesterRun('happy', {
        status: 'failed',
        error: e.message
      });
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/sad-path/run', requirePermission('lifecycle.manage'), async (req, res) => {
    if (!ENABLE_LIFECYCLE_PATH_TESTERS) {
      return res.status(503).json({ error: 'Lifecycle path testers are disabled' });
    }
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { txId, message } = req.body || {};
      const result = await runLifecycleSadPath(compiled, { txId, message });
      recordLifecycleTesterRun('sad', {
        status: 'completed',
        transitionCount: result.transitionCount,
        transactionId: result.transactionId
      });
      return res.json({ status: 'completed', result });
    } catch (e) {
      recordLifecycleTesterRun('sad', {
        status: 'failed',
        error: e.message
      });
      return res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/lifecycle/heartbeat', requirePermission('lifecycle.read'), (req, res) => {
    res.json({ heartbeat: getLifecycleHeartbeatPayload() });
  });

  app.post('/api/lifecycle/heartbeat/trigger', requirePermission('lifecycle.manage'), async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { reason } = req.body || {};
      const heartbeat = await enqueueLifecycleHeartbeat(compiled, {
        reason: reason || 'manual-trigger',
        sourceService: 'lifecycle-heartbeat:manual'
      });
      lifecycleHeartbeat.manualRuns += 1;
      return res.json({ status: 'queued', heartbeat, monitor: getLifecycleHeartbeatPayload() });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/test/start', async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { txId, message } = req.body || {};
      const active = await lifecycleHarnessStartTransaction(compiled, { txId, message });
      return res.json({ status: 'started', active });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/test/step', async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { eventName, status, statementMatch, replacementMessage } = req.body || {};
      const result = await lifecycleHarnessAdvance(compiled, {
        eventName: eventName || null,
        context: { status, statementMatch },
        replacementMessage: replacementMessage || null
      });
      return res.json({ status: 'advanced', ...result });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/simulators/bank-of-canada/approve', async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const result = await lifecycleHarnessAdvance(compiled, {
        eventName: 'lynx_approved',
        context: { status: 'approved' }
      });
      return res.json({ status: 'simulated', simulator: 'bank-of-canada-approve', ...result });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/simulators/bank-of-canada/reject', async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const result = await lifecycleHarnessAdvance(compiled, {
        eventName: 'lynx_rejected',
        context: { status: 'rejected' }
      });
      return res.json({ status: 'simulated', simulator: 'bank-of-canada-reject', ...result });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/lifecycle/simulators/correspondent/send-mt940', async (req, res) => {
    try {
      const compiled = readTransactionLifecycleCompiled();
      if (!compiled) {
        return res.status(404).json({ error: 'Lifecycle compiled artifact not found', hint: 'Run: npm run compile:lifecycle' });
      }

      const { statementRef } = req.body || {};
      const ref = String(statementRef || lifecycleHarness.active?.transactionId || 'UNKNOWN');
      const mt940 = `:20:${ref}\n:25:CORR-ACCOUNT-001\n:61:260514C12500,NTRFNONREF//${ref}\n:86:Settlement confirmed`;

      const result = await lifecycleHarnessAdvance(compiled, {
        eventName: 'statement_matched',
        context: { statementMatch: true },
        replacementMessage: mt940
      });
      return res.json({ status: 'simulated', simulator: 'correspondent-mt940', mt940, ...result });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/lifecycle/policy', requirePermission('lifecycle.policy.read'), (req, res) => {
    res.json({
      policy: {
        allowDbSync: Boolean(lifecycleActionPolicy.allowDbSync),
        allowDbAsync: Boolean(lifecycleActionPolicy.allowDbAsync)
      }
    });
  });

  app.post('/api/lifecycle/policy', requirePermission('lifecycle.policy.manage'), (req, res) => {
    const { allowDbSync, allowDbAsync } = req.body || {};
    if (typeof allowDbSync !== 'undefined') {
      lifecycleActionPolicy.allowDbSync = Boolean(allowDbSync);
    }
    if (typeof allowDbAsync !== 'undefined') {
      lifecycleActionPolicy.allowDbAsync = Boolean(allowDbAsync);
    }

    res.json({
      status: 'updated',
      policy: {
        allowDbSync: Boolean(lifecycleActionPolicy.allowDbSync),
        allowDbAsync: Boolean(lifecycleActionPolicy.allowDbAsync)
      }
    });
  });

  app.get('/api/lifecycle/policy/flow-targets', requirePermission('lifecycle.policy.read'), (req, res) => {
    res.json({
      status: 'ok',
      configSource: 'worker-config.json',
      flowTargets: getLatencyPolicyThresholds(workerConfig)
    });
  });

  app.post('/api/lifecycle/policy/flow-targets', requirePermission('lifecycle.policy.manage'), (req, res) => {
    try {
      const payload = req.body || {};
      const errors = validateLatencyPolicyTargetsUpdate(payload);
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }

      workerConfig = applyLatencyPolicyTargetsUpdate(workerConfig, payload, req.actor?.userId || 'unknown');

      try {
        persistWorkerConfig(workerConfig, WORKER_CONFIG_PATH);
      } catch (e) {
        console.warn(`[CONFIG] Failed to persist flow targets: ${e.message}`);
      }

      res.json({
        status: 'updated',
        message: 'Flow targets saved to worker-config.json.',
        flowTargets: getLatencyPolicyThresholds(workerConfig)
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/lifecycle/tx-state-persistence', requirePermission('lifecycle.read'), (req, res) => {
    res.json({
      status: 'ok',
      persistence: getTxStatePersistenceSummary()
    });
  });

  app.post('/api/lifecycle/tx-state-log-shipping/run', requirePermission('lifecycle.manage'), async (req, res) => {
    try {
      const maxEntries = Math.max(1, Number(req.body?.maxEntries || TX_STATE_LOG_SHIPPING_BATCH_SIZE));
      const result = await shipQueuedTransactionStateLogs({ maxEntries });
      res.json({
        status: 'ok',
        run: result,
        persistence: getTxStatePersistenceSummary()
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });



  // Worker Configuration Management API
  app.get('/api/workers/config', (req, res) => {
    const defaults = getWorkerDefaults();
    res.json({
      status: 'ok',
      configSource: 'worker-config.json',
      current: {
        intervalMs: defaults.intervalMs,
        batchSize: defaults.batchSize,
        numWorkersPerQueue: defaults.numWorkers,
        priorityQueues: defaults.priorityQueues
      },
      latencyPolicies: getLatencyPolicyThresholds(workerConfig),
      raw: workerConfig.workers?.router || {},
      limits: workerConfig.workers?.router?.limits || {},
      recommendations: {
        note: 'Adjust these values based on queue depth and system resources',
        factors: [
          'High queue depth: increase batchSize or numWorkers',
          'CPU >80%: decrease batchSize or increase intervalMs',
          'Memory pressure: decrease numWorkers or batchSize',
          'Compute nodes joined: can safely increase numWorkers',
          'Compute nodes removed: reduce numWorkers gracefully'
        ]
      }
    });
  });

  app.post('/api/workers/config', requirePermission('workers.configure'), (req, res) => {
    try {
      const { intervalMs, batchSize, numWorkersPerQueue } = req.body || {};

      const errors = validateWorkerConfigUpdate(workerConfig, {
        intervalMs,
        batchSize,
        numWorkersPerQueue
      });
      
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }

      workerConfig = applyWorkerConfigUpdate(
        workerConfig,
        { intervalMs, batchSize, numWorkersPerQueue },
        req.actor?.userId || 'unknown'
      );
      
      try {
        persistWorkerConfig(workerConfig, WORKER_CONFIG_PATH);
        console.log(`[CONFIG] Worker configuration updated: interval=${intervalMs} batch=${batchSize} workers=${numWorkersPerQueue}`);
      } catch (e) {
        console.warn(`[CONFIG] Failed to persist config: ${e.message}`);
      }
      
      res.json({
        status: 'updated',
        message: 'Worker configuration updated. Restart backend or redeploy workers to apply changes.',
        updated: {
          intervalMs,
          batchSize,
          numWorkersPerQueue
        }
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/workers/recommendations', (req, res) => {
    const defaults = getWorkerDefaults();
    const recommendations = [];
    const latencyPolicySummary = evaluateLatencyPolicies(metricsCollector.getCurrentMetrics(), workerConfig);
    
    // Analyze current state
    const totalWorkers = routerWorkers.size;
    const allQueueDepths = {};
    
    for (const [queueName, worker] of routerWorkers) {
      allQueueDepths[queueName] = allQueueDepths[queueName] || 0;
    }
    
    // Generate recommendations
    if (totalWorkers < 10) {
      recommendations.push({
        type: 'info',
        message: 'Current system has few workers - consider scaling up if experiencing queue backlog'
      });
    }
    
    if (defaults.batchSize < 50) {
      recommendations.push({
        type: 'warning',
        message: 'Batch size is low - consider increasing to 50-100 for better throughput'
      });
    }
    
    if (defaults.intervalMs > 500) {
      recommendations.push({
        type: 'warning',
        message: 'Processing interval is high - consider reducing to 200-300ms for better responsiveness'
      });
    }

    for (const [targetId, result] of Object.entries(latencyPolicySummary.evaluations || {})) {
      if (result.status === 'critical') {
        recommendations.push({
          type: 'critical',
          message: `${targetId} p95 ${result.p95Ms}ms exceeds target ${result.targetP95Ms}ms - scale up workers or reduce interval`
        });
      } else if (result.status === 'warning') {
        recommendations.push({
          type: 'warning',
          message: `${targetId} p95 ${result.p95Ms}ms is approaching target ${result.targetP95Ms}ms`
        });
      } else if (result.status === 'no-data') {
        recommendations.push({
          type: 'info',
          message: `${targetId} has no latency samples yet - ensure recordCompletion is emitted for tracked queues`
        });
      }
    }
    
    res.json({
      status: 'ok',
      currentConfig: {
        totalWorkers: totalWorkers,
        intervalMs: defaults.intervalMs,
        batchSize: defaults.batchSize,
        workersPerQueue: defaults.numWorkers
      },
      latencyPolicies: latencyPolicySummary,
      recommendations: recommendations.length > 0 ? recommendations : [
        { type: 'ok', message: 'Current configuration looks good' }
      ]
    });
  });

    // UDP discovery for primary broker
    app.get('/api/discover-primary', async (req, res) => {
      // Find the most recently seen broker node (not self)
      const now = Date.now();
      const nodes = Array.from(discoveredNodes.values())
        .filter(n => n.details?.services?.some(s => s.name?.toLowerCase().includes('broker')) && now - n.lastSeen < 10 * 60 * 1000)
        .sort((a, b) => b.lastSeen - a.lastSeen);
      if (nodes.length > 0) {
        res.json({ url: `http://${nodes[0].ip}:4000`, ip: nodes[0].ip, node: nodes[0] });
      } else {
        res.status(404).json({ error: 'No primary broker found' });
      }
    });

  debugLog('[DEBUG] Registering routes...');

  // Queue configuration synchronization endpoints for distributed config management

  function resolveLibrarianOrigin() {
    return readEnvString('LIBRARIAN_URL', 'http://127.0.0.1:4100');
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
  
  const fileServer = createFileServer();
  debugLog('[DEBUG] File server routes registered');
  app.use('/api/fileserver', fileServer.router);

  // --- Proxy to data-librarian service ---
  const LIBRARIAN_ORIGIN = resolveLibrarianOrigin();
  const MAPPER_ORIGIN = resolveMapperOrigin();

  // Binary upload route — must be registered before the generic JSON proxy below
  app.post('/api/librarian/upload/:dest', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    const url = `${LIBRARIAN_ORIGIN}/api/librarian/upload/${req.params.dest}`;
    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': req.get('content-type') || 'application/octet-stream',
          'x-filename': req.get('x-filename') || 'upload',
        },
        body: req.body,
      });
      res.status(upstream.status).json(await upstream.json());
    } catch (e) {
      res.status(502).json({ error: 'Librarian service unavailable', details: e.message });
    }
  });

  app.use('/api/librarian', async (req, res) => {
    const url = `${LIBRARIAN_ORIGIN}/api/librarian${req.path}${req.search || (req.url.includes('?') ? '?' + req.url.split('?')[1] : '')}`;
    try {
      const method = req.method;
      const hasBody = !['GET', 'HEAD'].includes(method);
      const upstream = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: hasBody ? JSON.stringify(req.body) : undefined,
      });
      const contentType = upstream.headers.get('content-type') || '';
      res.status(upstream.status);
      if (contentType.includes('application/json')) {
        res.json(await upstream.json());
      } else {
        res.send(await upstream.text());
      }
    } catch (e) {
      res.status(502).json({ error: 'Librarian service unavailable', details: e.message });
    }
  });

  // --- Proxy to data-mapper service ---
  app.use('/api/mapper', async (req, res) => {
    const query = req.search || (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
    const url = `${MAPPER_ORIGIN}/api/mapper${req.path}${query}`;
    try {
      const method = req.method;
      const hasBody = !['GET', 'HEAD'].includes(method);
      const upstream = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: hasBody ? JSON.stringify(req.body) : undefined,
      });
      const contentType = upstream.headers.get('content-type') || '';
      res.status(upstream.status);
      if (contentType.includes('application/json')) {
        res.json(await upstream.json());
      } else {
        res.send(await upstream.text());
      }
    } catch (e) {
      res.status(502).json({ error: 'Mapper service unavailable', details: e.message });
    }
  });
  app.get('/status', (req, res) => {
    res.json(getBrokerNodeDetails());
  });
  app.get('/api/system/performance', (req, res) => {
    res.json({
      status: 'ok',
      performance: getSystemPerformanceSnapshot()
    });
  });
  app.get('/services/describe', (req, res) => {
    res.json({ services: [BROKER_SERVICE, ROUTER_SERVICE, QUEUE_SERVICE, FILE_SERVER_SERVICE] });
  });

  app.get('/api/availability/status', (req, res) => {
    res.json({
      ...getMachineAvailabilityPayload(),
      workload: {
        inFlight: machineWorkloadState.inFlight,
        updatedAt: machineWorkloadState.updatedAt
      }
    });
  });

  app.post('/api/availability/available', (req, res) => {
    const next = setMachineAvailable();
    res.json({ status: 'ok', availability: next });
  });

  app.post('/api/availability/unavailable', async (req, res) => {
    const requestedTimeoutMs = Number(req.body?.timeoutMs || req.body?.drainMs || MACHINE_DRAIN_DEFAULT_TIMEOUT_MS);
    const result = await drainMachineAndSetUnavailable({ timeoutMs: requestedTimeoutMs });
    res.json({ status: 'ok', ...result });
  });

  app.get('/api/presence/client/status', (req, res) => {
    const clientId = String(req.query?.clientId || '').trim();
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    const presence = getBrowserPresence(clientId);
    return res.json({
      clientId,
      available: Boolean(presence?.availability?.available),
      status: presence?.availability?.status || 'unavailable',
      node: presence,
      lastSeen: presence?.lastSeen || null
    });
  });

  app.post('/api/presence/client/available', (req, res) => {
    const clientId = String(req.body?.clientId || '').trim();
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    const nodeName = String(req.body?.nodeName || req.body?.hostname || 'Web Client').trim();
    const ip = normalizePresenceIp(req.ip || req.socket?.remoteAddress);
    const userAgent = String(req.get('user-agent') || '').trim();
    const node = upsertBrowserPresenceNode({ clientId, nodeName, ip, userAgent, available: true });
    return res.json({ status: 'ok', clientId, available: true, node });
  });

  app.post('/api/presence/client/heartbeat', (req, res) => {
    const clientId = String(req.body?.clientId || '').trim();
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    const existing = getBrowserPresence(clientId);
    if (!existing) {
      return res.status(404).json({ error: 'presence not found', clientId });
    }
    const node = upsertBrowserPresenceNode({
      clientId,
      nodeName: existing.nodeName,
      ip: normalizePresenceIp(req.ip || req.socket?.remoteAddress),
      userAgent: String(req.get('user-agent') || existing.userAgent || '').trim(),
      available: true
    });
    return res.json({ status: 'ok', clientId, available: true, node });
  });

  app.post('/api/presence/client/unavailable', (req, res) => {
    const clientId = String(req.body?.clientId || '').trim();
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }
    const node = setBrowserPresenceUnavailable(clientId);
    return res.json({ status: 'ok', clientId, available: false, node });
  });
  registerLocalServiceHeartbeats();
  setInterval(registerLocalServiceHeartbeats, 10000);
  setInterval(updateVirtualNodes, 3000);
  startLifecycleHeartbeatMonitor();
  setMachineAvailable();
  debugLog('[DEBUG] All routes registered');
  app.get('/api/nodes', (req, res) => {
    // Backend server as a virtual node
    const now = Date.now();
    const backendNode = {
      ip: '127.0.0.1',
      nodeName: 'Aggregator Backend',
      lastSeen: now,
      details: {
        nodeName: 'Aggregator Backend',
        hardware: 'Server',
        services: [
          { name: 'Message Broker', status: 'online', api: '/api/broker' },
          { name: 'Router Service', status: 'online', api: '/api/router' },
          { name: 'Queue Manager', status: 'online', api: '/api/queue' },
          { name: 'File Server', status: 'online', api: '/api/fileserver' }
        ],
        status: 'ok',
        version: '1.0.0'
      }
    };
    const magicClusterNodes = [
      {
        kind: 'machineAvailability',
        serviceName: 'js-pmachine',
        nodeId: 'magic-js-pmachine-01',
        nodeName: 'magic-js-pmachine-01',
        ip: '127.0.10.101',
        port: 4101,
        status: 'available',
        available: true,
        draining: false,
        lastSeen: now,
        ts: now,
        details: {
          nodeName: 'magic-js-pmachine-01',
          hardware: 'PMachine JavaScript VM',
          runtime: 'js-pmachine',
          clusterName: 'Magic Cluster',
          services: ['PMachine Runtime', 'JavaScript VM']
        }
      },
      {
        kind: 'machineAvailability',
        serviceName: 'js-pmachine',
        nodeId: 'magic-js-pmachine-02',
        nodeName: 'magic-js-pmachine-02',
        ip: '127.0.10.102',
        port: 4102,
        status: 'available',
        available: true,
        draining: false,
        lastSeen: now,
        ts: now,
        details: {
          nodeName: 'magic-js-pmachine-02',
          hardware: 'PMachine JavaScript VM',
          runtime: 'js-pmachine',
          clusterName: 'Magic Cluster',
          services: ['PMachine Runtime', 'JavaScript VM']
        }
      },
      {
        kind: 'machineAvailability',
        serviceName: 'js-pmachine',
        nodeId: 'magic-js-pmachine-03',
        nodeName: 'magic-js-pmachine-03',
        ip: '127.0.10.103',
        port: 4103,
        status: 'available',
        available: true,
        draining: false,
        lastSeen: now,
        ts: now,
        details: {
          nodeName: 'magic-js-pmachine-03',
          hardware: 'PMachine JavaScript VM',
          runtime: 'js-pmachine',
          clusterName: 'Magic Cluster',
          services: ['PMachine Runtime', 'JavaScript VM']
        }
      }
    ];
    // Return backend node + discovered nodes, sorted by lastSeen desc
    const nodes = [
      backendNode,
      ...magicClusterNodes,
      ...Array.from(discoveredNodes.values())
    ].sort((a, b) => b.lastSeen - a.lastSeen);
    res.json(nodes);
  });
  app.get('/api/proxy/:ip', async (req, res) => {
    const { ip } = req.params;
    const path = req.query.path || '/';
    try {
      const url = `http://${ip}:80${path}`;
      const deviceRes = await fetch(url);
      const contentType = deviceRes.headers.get('content-type') || '';
      res.status(deviceRes.status);
      if (contentType.includes('application/json')) {
        const data = await deviceRes.json();
        res.json(data);
      } else {
        const text = await deviceRes.text();
        console.log(`[Proxy Debug] ${url} returned non-JSON content-type (${contentType}):\n${text.substring(0, 500)}`);
        res.type(contentType).send(text);
      }
    } catch (e) {
      res.status(502).json({ error: 'Proxy fetch failed', details: e.toString() });
    }
  });

  // Catch-all error handler for uncaught errors in Express (MUST BE LAST)
  app.use((err, req, res, next) => {
    const errorMsg = '[EXPRESS ERROR] ' + (err && err.stack ? err.stack : err.toString());
    logToFile(errorMsg);
    console.error(errorMsg);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error', details: errorMsg });
  });
}

try {
  debugLog('[DEBUG] Starting backend server...');
  console.log('[STARTUP] Binding HTTP listener...');
  app.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Aggregator backend running on http://0.0.0.0:${HTTP_PORT} (LAN accessible)`);
  });

  console.log('[STARTUP] Registering queue manager sync callbacks...');
  
  // Set up peer sync callbacks for each queue manager
  // This enables distributed config synchronization
  for (const [managerId, qm] of queueManagerInstances) {
    qm.onConfigChange(async (operation) => {
      // When this queue manager's config changes, notify all other instances
      // In a distributed setup, this would HTTP POST to all peer instances
      // For now, log it so the sync mechanism can pick it up
      console.log(`[SYNC] Config change on ${managerId}: ${operation.type} - ${operation.queueName}`);
      
      // In production, you'd iterate through all registered instances of this queue manager
      // and POST to their /api/queues/:managerId/apply-config-change endpoint
    });
  }
  
  console.log('[STARTUP] Registering API routes...');
  registerRoutes(app);
  
  // Load worker configuration on startup
  console.log('[STARTUP] Loading worker configuration...');
  loadWorkerConfig();

  // Fail fast when worker queues are not covered by enabled router input rules.
  console.log('[STARTUP] Validating router coverage...');
  const routerCoverage = validateRouterRuleCoverageForWorkerQueues();
  if (routerCoverage.ok) {
    console.log(`[PRECHECK] Router input rule coverage OK (strict=${routerCoverage.strictMode})`);
  }

  console.log('[STARTUP] Ensuring priority queue bindings...');
  const ensuredPriorityQueues = ensurePriorityInputQueuesConfigured();
  if (ensuredPriorityQueues.length > 0) {
    console.log(`[PRECHECK] Ensured ${ensuredPriorityQueues.length} priority queue binding(s) across local queue managers.`);
  }
  
  // Start metrics collection
  console.log('[STARTUP] Starting metrics collection...');
  metricsCollector.start();

  // Warm up FSM SQL persistence. In production mode, DB is mandatory.
  const fsmSqlSource = process.env.FSM_MSSQL_CONNECTION_STRING
    ? 'FSM_MSSQL_CONNECTION_STRING'
    : process.env.GROUP_MSSQL_CONNECTION_STRING
      ? 'GROUP_MSSQL_CONNECTION_STRING'
      : 'derived-default';
  const resolvedSqlTarget = SQL_INSTANCE_NAME ? `${SQL_SERVER_HOST}\\${SQL_INSTANCE_NAME}` : SQL_SERVER_HOST;
  console.log(`[FSM-SQL] Mode=${SQL_INSTANCE_MODE || 'sqlexpress'} source=${fsmSqlSource} target=${resolvedSqlTarget} database=${SQL_DATABASE}`);
  if (TX_STATE_REQUIRE_REALTIME_DB) {
    await getTransactionStateMssqlPool();
    console.log(`[FSM-SQL] Connected (required). Current table=${FSM_MSSQL_CURRENT_TABLE} history table=${FSM_MSSQL_HISTORY_TABLE}`);
  } else {
    getTransactionStateMssqlPool()
      .then(() => console.log(`[FSM-SQL] Connected. Current table=${FSM_MSSQL_CURRENT_TABLE} history table=${FSM_MSSQL_HISTORY_TABLE}`))
      .catch((e) => console.warn(`[FSM-SQL] Disabled: ${formatErrorDetails(e)}`));
  }

  if (TX_STATE_EMERGENCY_LOG_SHIPPING && TX_STATE_LOG_SHIPPING_INTERVAL_MS > 0) {
    const shipTimer = setInterval(() => {
      shipQueuedTransactionStateLogs({ maxEntries: TX_STATE_LOG_SHIPPING_BATCH_SIZE })
        .catch((e) => {
          txStatePersistenceStats.shippingFailures += 1;
          txStatePersistenceStats.lastShipFailureAt = new Date().toISOString();
          txStatePersistenceStats.lastShipError = formatErrorDetails(e);
          console.warn(`[TX-STATE] Log shipping cycle failed: ${formatErrorDetails(e)}`);
        });
    }, TX_STATE_LOG_SHIPPING_INTERVAL_MS);
    if (typeof shipTimer.unref === 'function') shipTimer.unref();
    console.warn(`[TX-STATE] Emergency log shipping is ENABLED (interval=${TX_STATE_LOG_SHIPPING_INTERVAL_MS}ms).`);
  } else {
    console.log('[TX-STATE] Emergency log shipping is disabled. Realtime DB writes are expected.');
  }

  // Auto-start all workers and gateways on every backend startup using config defaults
  try {
    const routerWorkerResults = startDefaultRouterWorkers();
    console.log(`[AUTOSTART] Router workers started: ${routerWorkerResults.length} (6 instances per queue × 4 priority queues)`);
    routerWorkerResults.slice(0, 3).forEach(w => {
      console.log(`  - ${w.workerId}: interval=${w.intervalMs}ms, batch=${w.batchSize}`);
    });
    if (routerWorkerResults.length > 3) {
      console.log(`  - ... and ${routerWorkerResults.length - 3} more`);
    }
  } catch (e) {
    console.warn(`[AUTOSTART] Router workers failed: ${e.message}`);
  }

  try {
    const lifecycleWorkerResults = startDefaultQueueDrivenLifecycleWorkers({ intervalMs: 250, batchSize: 50 });
    console.log(`[AUTOSTART] Lifecycle workers started: ${lifecycleWorkerResults.length}`);
  } catch (e) {
    console.warn(`[AUTOSTART] Lifecycle workers failed: ${e.message}`);
  }

  try {
    const subflowWorkerResults = startDefaultSubflowBridgeWorkers({ intervalMs: 500, batchSize: 25 });
    console.log(`[AUTOSTART] Subflow workers started: ${subflowWorkerResults.length}`);
  } catch (e) {
    console.warn(`[AUTOSTART] Subflow workers failed: ${e.message}`);
  }

  try {
    startSwiftGateway({ intervalMs: 500, batchSize: 25 });
    console.log('[AUTOSTART] SWIFT gateway started');
  } catch (e) {
    console.warn(`[AUTOSTART] SWIFT gateway failed: ${e.message}`);
  }

  try {
    startBocGateway({ intervalMs: 500, batchSize: 25, mode: gatewayModeState.boc });
    console.log(`[AUTOSTART] BoC gateway started (mode=${gatewayModeState.boc})`);
  } catch (e) {
    console.warn(`[AUTOSTART] BoC gateway failed: ${e.message}`);
  }

  try {
    startFedGateway({ intervalMs: 500, batchSize: 25 });
    console.log(`[AUTOSTART] Fed gateway started (mode=${gatewayModeState.fed})`);
  } catch (e) {
    console.warn(`[AUTOSTART] Fed gateway failed: ${e.message}`);
  }

  // --- Start Data Librarian as a child process ---
  const librarianPath = fileURLToPath(new URL('./data-librarian.mjs', import.meta.url));
  const librarian = spawn(process.execPath, [librarianPath], {
    stdio: 'inherit',
    env: { ...process.env },
  });
  librarian.on('error', err => console.error('[Librarian] Failed to start:', err.message));
  librarian.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.warn(`[Librarian] Exited with code=${code} signal=${signal}`);
    }
  });

  // --- Start Data Mapper as a child process ---
  const mapperPath = fileURLToPath(new URL('./data-mapper.mjs', import.meta.url));
  const mapper = spawn(process.execPath, [mapperPath], {
    stdio: 'inherit',
    env: { ...process.env },
  });
  mapper.on('error', err => console.error('[Mapper] Failed to start:', err.message));
  mapper.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.warn(`[Mapper] Exited with code=${code} signal=${signal}`);
    }
  });

  process.on('exit', () => {
    librarian.kill();
    mapper.kill();
  });
  process.on('SIGINT', () => {
    librarian.kill();
    mapper.kill();
    process.exit();
  });
  process.on('SIGTERM', () => {
    librarian.kill();
    mapper.kill();
    process.exit();
  });

} catch (err) {
  console.error('[ERROR] Backend failed to start:', err);
}
