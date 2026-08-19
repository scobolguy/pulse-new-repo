import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { execFile } from 'node:child_process';
import { allocateJob } from '../allocator/economicAllocator.mjs';
import { attachPcodeSignature } from '../../../scripts/pcode-signing.mjs';

const NODE_RENAME_OVERRIDES_PATH = path.resolve(process.cwd(), 'data', 'node-rename-overrides.json');
const NODE_TOPOLOGY_OVERRIDES_PATH = path.resolve(process.cwd(), 'data', 'node-topology-overrides.json');
const ALLOCATOR_DECISIONS_PATH = path.resolve(process.cwd(), 'data', 'allocator-decisions.jsonl');
const CLUSTER_REGISTRY_PATH = path.resolve(process.cwd(), 'data', 'cluster-registry.json');
const SITE_REGISTRY_PATH = path.resolve(process.cwd(), 'data', 'site-registry.json');
const FREE_POOL_CLUSTER_ID = 'free-pool';
const FREE_POOL_CLUSTER_LABEL = 'Free Pool';
const FREE_POOL_JS_CLUSTER_ID = 'free-pool-js';
const FREE_POOL_JS_CLUSTER_LABEL = 'Free JS Pool';
const FREE_POOL_ESP_CLUSTER_ID = 'free-pool-esp';
const FREE_POOL_ESP_CLUSTER_LABEL = 'Free ESP Pool';
const UDP_PORT_PAIR_START = 4200;
const SITE_MODE_DEFAULT = 'hot-warm';

function normalizeSiteMode(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (normalized === 'hot-hot') return 'hot-hot';
  if (normalized === 'hot-warm') return 'hot-warm';
  if (normalized === 'hot-cold') return 'hot-cold';
  return '';
}

function normalizeSiteCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'internal' || normalized === 'onprem' || normalized === 'on-prem') return 'internal';
  if (normalized === 'vendor' || normalized === 'partner' || normalized === 'third-party') return 'vendor';
  if (normalized === 'cloud' || normalized === 'aws' || normalized === 'azure' || normalized === 'gcp') return 'cloud';
  return '';
}

function toSiteName(siteId) {
  const raw = String(siteId || '').trim();
  if (!raw) return '';
  return raw
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function normalizeSiteMetadata(raw = {}, { fallbackCategory = 'internal', fallbackMode = SITE_MODE_DEFAULT } = {}) {
  const siteId = String(raw?.siteId || raw?.id || '').trim().toLowerCase();
  const siteName = String(raw?.siteName || raw?.name || '').trim();
  const siteCategory = normalizeSiteCategory(raw?.siteCategory || raw?.siteType || raw?.siteKind);
  const siteMode = normalizeSiteMode(raw?.siteMode || raw?.siteResilience || raw?.sitePolicy);
  const category = siteCategory || normalizeSiteCategory(fallbackCategory) || 'internal';
  const mode = siteMode || normalizeSiteMode(fallbackMode) || SITE_MODE_DEFAULT;
  const explicitExternal = raw?.isExternalSite;
  const isExternalSite = typeof explicitExternal === 'boolean'
    ? explicitExternal
    : (category === 'vendor' || category === 'cloud');

  return {
    siteId: siteId || 'primary-site',
    siteName: siteName || toSiteName(siteId || 'primary-site'),
    siteCategory: category,
    siteMode: mode,
    isExternalSite
  };
}

function buildDefaultSiteRegistry() {
  const now = new Date().toISOString();
  return {
    'primary-site': {
      siteId: 'primary-site',
      siteName: 'Primary Site',
      siteCategory: 'internal',
      siteMode: SITE_MODE_DEFAULT,
      isExternalSite: false,
      state: 'up',
      description: 'Default primary on-prem site.',
      createdAt: now,
      updatedAt: now
    }
  };
}

function normalizeSiteRegistry(raw) {
  const out = {};
  const entries = Array.isArray(raw)
    ? raw.map((value) => [String(value?.siteId || value?.id || '').trim().toLowerCase(), value])
    : Object.entries(raw || {});

  for (const [key, value] of entries) {
    const meta = normalizeSiteMetadata({ ...(value || {}), siteId: value?.siteId || value?.id || key });
    const siteId = String(meta.siteId || '').trim().toLowerCase();
    if (!siteId) continue;
    const current = out[siteId] || {};
    out[siteId] = {
      ...meta,
      state: String(value?.state || current.state || 'up').trim().toLowerCase() || 'up',
      description: String(value?.description || current.description || '').trim() || null,
      createdAt: String(value?.createdAt || current.createdAt || new Date().toISOString()),
      updatedAt: String(value?.updatedAt || new Date().toISOString())
    };
  }

  if (!out['primary-site']) {
    const defaults = buildDefaultSiteRegistry();
    out['primary-site'] = defaults['primary-site'];
  }

  return out;
}

function isManagedFreePoolClusterId(clusterId) {
  const normalized = String(clusterId || '').trim().toLowerCase();
  return normalized === FREE_POOL_CLUSTER_ID
    || normalized === FREE_POOL_JS_CLUSTER_ID
    || normalized === FREE_POOL_ESP_CLUSTER_ID;
}

function normalizeNodeRenameMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]) => [String(key || '').trim().toLowerCase(), String(value || '').trim()])
      .filter(([key, value]) => Boolean(key) && Boolean(value))
  );
}

function normalizeNodeTopologyMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = String(key || '').trim().toLowerCase();
    if (!normalizedKey) continue;
    const parentNodeId = String(value?.parentNodeId || '').trim();
    out[normalizedKey] = {
      parentNodeId,
      isClusterGateway: value?.isClusterGateway === true,
      activeClusterId: String(value?.activeClusterId || '').trim().toLowerCase(),
      parentHost: String(value?.parentHost || '').trim(),
      parentPort: Number(value?.parentPort || 0) || undefined,
      siblingPort: Number(value?.siblingPort || 0) || undefined,
      pendingBoardSync: value?.pendingBoardSync === true,
      ...normalizeSiteMetadata(value || {})
    };
  }
  return out;
}

function normalizeComputeNodeConfig(node) {
  const config = node?.config && typeof node.config === 'object' ? node.config : {};
  return {
    operationRef: String(config.operationRef || '').trim().toLowerCase(),
    argumentN: String(config.argumentN || '3').trim(),
    runtimeKind: String(config.runtimeKind || 'pmachine').trim(),
    deploymentTarget: String(config.deploymentTarget || 'esp32-native').trim(),
    outputMode: String(config.outputMode || 'console').trim(),
    programSource: String(config.programSource || '').trim(),
  };
}

function generateHanoiMoves(count, fromPeg = 'A', toPeg = 'C', auxPeg = 'B', moves = []) {
  const size = Math.max(1, Number.parseInt(String(count || '3').trim(), 10) || 3);
  if (size === 1) {
    moves.push(`Move disk 1 from ${fromPeg} to ${toPeg}`);
    return moves;
  }
  generateHanoiMoves(size - 1, fromPeg, auxPeg, toPeg, moves);
  moves.push(`Move disk ${size} from ${fromPeg} to ${toPeg}`);
  generateHanoiMoves(size - 1, auxPeg, toPeg, fromPeg, moves);
  return moves;
}

function compileComputeNodeToPcode(computeNode) {
  const config = normalizeComputeNodeConfig(computeNode);
  const operationRef = String(config.operationRef || '').trim().toLowerCase();
  if (operationRef !== 'towers-of-hanoi' && operationRef !== 'hanoi') {
    throw new Error(`Unsupported compute operationRef: ${operationRef || '(empty)'}`);
  }

  const n = Math.max(1, Math.min(8, Number.parseInt(String(config.argumentN || '3').trim(), 10) || 3));
  const moves = generateHanoiMoves(n);
  const summaryLine = `Towers of Hanoi n=${n} (${moves.length} moves)`;
  const instructions = [
    `PUSH_STR ${JSON.stringify(summaryLine)}`,
    'PRINT',
    'PRINT_NL',
  ];

  for (const move of moves) {
    instructions.push(`PUSH_STR ${JSON.stringify(move)}`);
    instructions.push('PRINT');
    instructions.push('PRINT_NL');
  }

  instructions.push('HALT');

  const programMap = [];
  let address = 0;
  for (const line of instructions) {
    programMap.push({ address, text: line });
    address += 1;
  }

  const pcodeText = `${instructions.join('\n')}\n`;
  return {
    pcodeText,
    programMap,
    summaryLine,
    moves,
    config,
    operationRef,
    instructionCount: address,
  };
}

async function loadNodeRenameMap() {
  try {
    const raw = await fs.readFile(NODE_RENAME_OVERRIDES_PATH, 'utf8');
    return normalizeNodeRenameMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function saveNodeRenameMap(map) {
  const normalized = normalizeNodeRenameMap(map);
  await fs.mkdir(path.dirname(NODE_RENAME_OVERRIDES_PATH), { recursive: true });
  await fs.writeFile(NODE_RENAME_OVERRIDES_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

async function loadNodeTopologyMap() {
  try {
    const raw = await fs.readFile(NODE_TOPOLOGY_OVERRIDES_PATH, 'utf8');
    return normalizeNodeTopologyMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function saveNodeTopologyMap(map) {
  const normalized = normalizeNodeTopologyMap(map);
  await fs.mkdir(path.dirname(NODE_TOPOLOGY_OVERRIDES_PATH), { recursive: true });
  await fs.writeFile(NODE_TOPOLOGY_OVERRIDES_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

async function appendAllocatorDecisionLog(entry) {
  const line = `${JSON.stringify(entry)}\n`;
  await fs.mkdir(path.dirname(ALLOCATOR_DECISIONS_PATH), { recursive: true });
  await fs.appendFile(ALLOCATOR_DECISIONS_PATH, line, 'utf8');
}

function normalizeClusterRegistry(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const clusterId = String(key || '').trim().toLowerCase();
    if (!clusterId) continue;
    const nodes = Array.isArray(value?.nodes)
      ? value.nodes.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean)
      : [];
    const nodeOrigins = value?.nodeOrigins && typeof value.nodeOrigins === 'object'
      ? Object.fromEntries(
          Object.entries(value.nodeOrigins)
            .map(([nodeId, sourcePoolId]) => [
              String(nodeId || '').trim().toLowerCase(),
              String(sourcePoolId || '').trim().toLowerCase()
            ])
            .filter(([nodeId, sourcePoolId]) => Boolean(nodeId) && Boolean(sourcePoolId))
        )
      : {};
    out[clusterId] = {
      clusterId,
      label: String(value?.label || clusterId).trim(),
      nodes: Array.from(new Set(nodes)),
      nodeOrigins,
      state: String(value?.state || 'up').trim().toLowerCase(),
      createdAt: String(value?.createdAt || new Date().toISOString()),
      updatedAt: String(value?.updatedAt || new Date().toISOString())
    };
  }
  return out;
}

async function loadClusterRegistry() {
  try {
    const raw = await fs.readFile(CLUSTER_REGISTRY_PATH, 'utf8');
    return normalizeClusterRegistry(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function saveClusterRegistry(map) {
  const normalized = normalizeClusterRegistry(map);
  await fs.mkdir(path.dirname(CLUSTER_REGISTRY_PATH), { recursive: true });
  await fs.writeFile(CLUSTER_REGISTRY_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

async function loadSiteRegistry() {
  try {
    const raw = await fs.readFile(SITE_REGISTRY_PATH, 'utf8');
    return normalizeSiteRegistry(JSON.parse(raw));
  } catch {
    return buildDefaultSiteRegistry();
  }
}

async function saveSiteRegistry(map) {
  const normalized = normalizeSiteRegistry(map);
  await fs.mkdir(path.dirname(SITE_REGISTRY_PATH), { recursive: true });
  await fs.writeFile(SITE_REGISTRY_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

function normalizeSlaClass(value) {
  return String(value || '').trim().toLowerCase();
}

function resolvePolicyIdFromSlaClass(value) {
  const key = normalizeSlaClass(value);
  if (key === 'latency-critical' || key === 'latency_critical' || key === 'interactive') return 'latency-first';
  if (key === 'reliability-critical' || key === 'reliability_critical' || key === 'critical') return 'reliability-first';
  if (key === 'batch' || key === 'background') return 'cost-min';
  return 'balanced';
}

function normalizeServiceAdvertisement(service) {
  if (service == null) return null;
  if (typeof service === 'string') {
    const name = String(service || '').trim();
    return name ? { name } : null;
  }
  if (typeof service === 'object') {
    const name = String(service.name || service.serviceName || '').trim();
    if (!name) return null;
    return {
      ...service,
      name
    };
  }
  return null;
}

function getServiceAdvertisementKey(service) {
  const normalized = normalizeServiceAdvertisement(service);
  if (!normalized) return null;
  return String(normalized.name || normalized.serviceName || '').trim().toLowerCase();
}

function dedupeServiceAdvertisements(services) {
  const out = [];
  const seen = new Set();
  for (const service of Array.isArray(services) ? services : []) {
    const normalized = normalizeServiceAdvertisement(service);
    if (!normalized) continue;
    const key = getServiceAdvertisementKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function normalizeDeviceNodeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeDeviceAdvertisement(device, fallbackNodeKey = '') {
  if (device == null) return null;
  if (typeof device === 'string') {
    const name = String(device || '').trim();
    const sourceNodeKey = normalizeDeviceNodeKey(fallbackNodeKey);
    return name ? { name, ...(sourceNodeKey ? { sourceNodeKey } : {}) } : null;
  }
  if (typeof device === 'object') {
    const name = String(device.name || device.deviceName || device.id || '').trim();
    if (!name) return null;
    const sourceNodeKey = normalizeDeviceNodeKey(
      device.sourceNodeKey
      || device.nodeKey
      || device.nodeId
      || device.nodeName
      || device.ip
      || fallbackNodeKey
    );
    return {
      ...device,
      name,
      ...(sourceNodeKey ? { sourceNodeKey } : {})
    };
  }
  return null;
}

function getDeviceAdvertisementKey(device) {
  const normalized = normalizeDeviceAdvertisement(device);
  if (!normalized) return null;
  const nameKey = String(normalized.name || normalized.deviceName || normalized.id || '').trim().toLowerCase();
  const nodeKey = normalizeDeviceNodeKey(normalized.sourceNodeKey || normalized.nodeKey || normalized.nodeId || normalized.nodeName || normalized.ip);
  if (!nameKey) return null;
  return `${nodeKey || 'global'}::${nameKey}`;
}

function dedupeDeviceAdvertisements(devices, fallbackNodeKey = '') {
  const out = [];
  const seen = new Set();
  for (const device of Array.isArray(devices) ? devices : []) {
    const normalized = normalizeDeviceAdvertisement(device, fallbackNodeKey);
    if (!normalized) continue;
    const key = getDeviceAdvertisementKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function getDeploymentName(deployment) {
  return String(deployment?.displayName || deployment?.deploymentName || deployment?.packageName || deployment?.serviceName || '').trim();
}

function getDeploymentId(deployment) {
  return String(deployment?.deploymentId || deployment?.id || '').trim();
}

function getDeploymentTargets(deployment) {
  const rawTargets = Array.isArray(deployment?.targetNodeIds)
    ? deployment.targetNodeIds
    : (deployment?.targetNodeId ? [deployment.targetNodeId] : []);
  return Array.from(new Set(
    rawTargets
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ));
}

function getDeploymentScope(deployment) {
  const explicitScope = String(deployment?.scope || '').trim().toLowerCase();
  if (explicitScope) return explicitScope;
  if (getDeploymentTargets(deployment).length > 1) return 'collective';
  return 'node';
}

function getDeploymentRuntimeState(deployment) {
  return String(deployment?.runtimeState || deployment?.state || 'running').trim().toLowerCase() || 'running';
}

function getDeploymentServiceStatus(runtimeState) {
  const normalized = String(runtimeState || '').trim().toLowerCase();
  if (normalized === 'running') return 'up';
  if (normalized === 'paused') return 'paused';
  if (normalized === 'stopped') return 'resident';
  return 'resident';
}

function getDeploymentKey(serviceName, targetNodeId, deploymentId = '') {
  const normalizedService = String(serviceName || '').trim().toLowerCase();
  const normalizedTarget = String(targetNodeId || '').trim().toLowerCase();
  if (normalizedService && normalizedTarget) {
    return `${normalizedService}::${normalizedTarget}`;
  }
  if (normalizedService) {
    return `${normalizedService}::${String(deploymentId || 'collective').trim().toLowerCase()}`;
  }
  return String(deploymentId || crypto.randomUUID()).trim();
}

function parseDeploymentRef(rawRef) {
  const text = String(rawRef || '').trim();
  if (!text) {
    return { deploymentId: '', serviceName: '', targetNodeId: '' };
  }

  if (text.includes('::')) {
    const [serviceName, ...rest] = text.split('::');
    return {
      deploymentId: '',
      serviceName: String(serviceName || '').trim(),
      targetNodeId: rest.join('::').trim(),
    };
  }

  if (text.includes('.')) {
    const dotIndex = text.lastIndexOf('.');
    const left = text.slice(0, dotIndex).trim();
    const right = text.slice(dotIndex + 1).trim();
    if (left && right) {
      return {
        deploymentId: '',
        serviceName: right,
        targetNodeId: left,
      };
    }
  }

  return { deploymentId: text, serviceName: text, targetNodeId: '' };
}

function buildDeploymentInstanceId(deployment, targetNodeId) {
  const deploymentId = getDeploymentId(deployment) || String(deployment?.key || '').trim() || 'deployment';
  const targetToken = String(targetNodeId || deployment?.targetNodeId || '*').trim().toLowerCase() || '*';
  return `deploy:${deploymentId}:${targetToken}`;
}

function buildDeploymentAliases(deployment) {
  const serviceName = String(deployment?.serviceName || '').trim();
  const targets = getDeploymentTargets(deployment);
  const aliases = new Set();
  if (serviceName && targets.length > 0) {
    for (const targetNodeId of targets) {
      aliases.add(`${targetNodeId}.${serviceName}`);
      aliases.add(`${serviceName}::${targetNodeId}`);
    }
  }
  if (serviceName) {
    aliases.add(serviceName);
    aliases.add(`${serviceName}::*`);
  }
  const deploymentId = getDeploymentId(deployment);
  if (deploymentId) aliases.add(deploymentId);
  return Array.from(aliases);
}

function normalizeDeploymentRecord(deployment = {}) {
  const serviceName = String(deployment?.serviceName || '').trim();
  const targetNodeIds = getDeploymentTargets(deployment);
  const targetNodeId = String(deployment?.targetNodeId || targetNodeIds[0] || '').trim() || null;
  const runtimeState = getDeploymentRuntimeState(deployment);
  const createdAt = String(deployment?.createdAt || deployment?.updatedAt || new Date().toISOString());
  const updatedAt = String(deployment?.updatedAt || createdAt);
  const deploymentId = String(deployment?.deploymentId || crypto.randomUUID()).trim();
  const scope = getDeploymentScope(deployment);
  const key = String(deployment?.key || getDeploymentKey(serviceName, targetNodeId || '*', deploymentId)).trim();
  const instanceStates = deployment?.instances && typeof deployment.instances === 'object'
    ? deployment.instances
    : {};

  return {
    ...deployment,
    key,
    deploymentId,
    deploymentRef: String(deployment?.deploymentRef || key).trim(),
    serviceName,
    targetNodeId,
    targetNodeIds,
    scope,
    runtimeState,
    state: runtimeState,
    createdAt,
    updatedAt,
    instances: targetNodeIds.reduce((acc, nodeId) => {
      const normalizedNodeId = String(nodeId || '').trim();
      if (!normalizedNodeId) return acc;
      const nextState = String(instanceStates[normalizedNodeId]?.state || runtimeState || 'running').trim().toLowerCase() || 'running';
      acc[normalizedNodeId] = {
        state: nextState,
        updatedAt,
        startedAt: String(instanceStates[normalizedNodeId]?.startedAt || createdAt),
        stoppedAt: nextState === 'stopped' ? String(instanceStates[normalizedNodeId]?.stoppedAt || updatedAt) : null
      };
      return acc;
    }, {}),
    aliases: buildDeploymentAliases({ ...deployment, serviceName, targetNodeId, targetNodeIds, deploymentId, key })
  };
}

async function readDeploymentIndexFromDisk(deploymentIndexPath) {
  if (!deploymentIndexPath) return { updatedAt: new Date().toISOString(), deployments: [] };
  try {
    const raw = await fs.readFile(deploymentIndexPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      updatedAt: String(parsed?.updatedAt || new Date().toISOString()),
      deployments: Array.isArray(parsed?.deployments) ? parsed.deployments : []
    };
  } catch {
    return { updatedAt: new Date().toISOString(), deployments: [] };
  }
}

async function writeDeploymentIndexToDisk(deploymentIndexPath, index) {
  if (!deploymentIndexPath) return;
  await fs.mkdir(path.dirname(deploymentIndexPath), { recursive: true });
  await fs.writeFile(deploymentIndexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

function syncDeploymentRegistry(deploymentRegistry, deployments) {
  if (!(deploymentRegistry instanceof Map)) return;
  deploymentRegistry.clear();
  for (const deployment of Array.isArray(deployments) ? deployments : []) {
    const normalized = normalizeDeploymentRecord(deployment);
    deploymentRegistry.set(normalized.key, normalized);
  }
}

function collectDeploymentServiceInstances(deployment, serviceInstanceRegistry) {
  const targetNodeIds = getDeploymentTargets(deployment);
  const runtimeState = getDeploymentRuntimeState(deployment);
  const serviceStatus = getDeploymentServiceStatus(runtimeState);
  const deploymentId = getDeploymentId(deployment) || String(deployment?.key || '').trim();
  const records = [];

  for (const targetNodeId of targetNodeIds.length > 0 ? targetNodeIds : [null]) {
    const normalizedTargetNodeId = String(targetNodeId || '').trim() || null;
    const pmachineInstance = normalizedTargetNodeId
      ? Array.from(serviceInstanceRegistry.values()).find((instance) => {
          if (String(instance?.serviceName || '').trim().toLowerCase() !== 'pmachine') return false;
          return String(instance?.nodeId || instance?.ip || '').trim().toLowerCase() === normalizedTargetNodeId;
        })
      : null;

    records.push({
      instanceId: buildDeploymentInstanceId(deployment, normalizedTargetNodeId),
      serviceName: String(deployment?.serviceName || '').trim(),
      nodeId: normalizedTargetNodeId,
      ip: pmachineInstance?.ip || null,
      port: pmachineInstance?.port || null,
      status: serviceStatus,
      metadata: {
        deployment: true,
        deploymentId,
        deploymentKey: String(deployment?.key || '').trim(),
        deploymentName: getDeploymentName(deployment) || String(deployment?.serviceName || '').trim(),
        packageName: deployment?.packageName || null,
        packageVersion: deployment?.packageVersion || null,
        targetNodeId: normalizedTargetNodeId,
        targetNodeIds,
        scope: getDeploymentScope(deployment),
        runtimeState,
        collective: targetNodeIds.length > 1,
        ...(deployment?.metadata && typeof deployment.metadata === 'object' ? deployment.metadata : {})
      },
      lastHeartbeat: pmachineInstance?.lastHeartbeat || null
    });
  }

  return records;
}

function upsertDeploymentServiceInstances(serviceInstanceRegistry, deployment) {
  if (!(serviceInstanceRegistry instanceof Map)) return;
  const instances = collectDeploymentServiceInstances(deployment, serviceInstanceRegistry);
  for (const instance of instances) {
    serviceInstanceRegistry.set(instance.instanceId, {
      ...(serviceInstanceRegistry.get(instance.instanceId) || {}),
      ...instance,
      lastHeartbeat: Date.now()
    });
  }
}

function updateDeploymentRuntimeState(deployment, nextState) {
  const normalizedState = String(nextState || '').trim().toLowerCase();
  const targetNodeIds = getDeploymentTargets(deployment);
  const now = new Date().toISOString();
  const currentInstances = deployment?.instances && typeof deployment.instances === 'object' ? deployment.instances : {};
  const nextInstances = {};
  for (const targetNodeId of targetNodeIds.length > 0 ? targetNodeIds : [null]) {
    const normalizedTargetNodeId = String(targetNodeId || '').trim() || null;
    if (!normalizedTargetNodeId) continue;
    const prevInstance = currentInstances[normalizedTargetNodeId] || {};
    nextInstances[normalizedTargetNodeId] = {
      state: normalizedState || String(prevInstance.state || deployment?.runtimeState || 'running').trim().toLowerCase() || 'running',
      startedAt: String(prevInstance.startedAt || deployment?.createdAt || now),
      updatedAt: now,
      stoppedAt: normalizedState === 'stopped' ? now : (prevInstance.stoppedAt || null)
    };
  }

  return normalizeDeploymentRecord({
    ...deployment,
    runtimeState: normalizedState || getDeploymentRuntimeState(deployment),
    state: normalizedState || getDeploymentRuntimeState(deployment),
    updatedAt: now,
    instances: nextInstances
  });
}

function resolveDeploymentMatches(rawRef, deploymentRegistry) {
  const ref = String(rawRef || '').trim();
  const deployments = Array.from(deploymentRegistry instanceof Map ? deploymentRegistry.values() : []);
  if (!ref) return [];

  const exact = deploymentRegistry instanceof Map ? deploymentRegistry.get(ref) : null;
  if (exact) return [exact];

  const byDeploymentId = deployments.filter((deployment) => getDeploymentId(deployment) === ref);
  if (byDeploymentId.length > 0) return byDeploymentId;

  const parsed = parseDeploymentRef(ref);
  if (parsed.serviceName && parsed.targetNodeId) {
    const targeted = deployments.filter((deployment) => {
      if (String(deployment?.serviceName || '').trim().toLowerCase() !== String(parsed.serviceName || '').trim().toLowerCase()) return false;
      const targets = getDeploymentTargets(deployment).map((value) => value.toLowerCase());
      return targets.includes(String(parsed.targetNodeId || '').trim().toLowerCase());
    });
    if (targeted.length > 0) return targeted;
  }

  if (parsed.serviceName) {
    return deployments.filter((deployment) => String(deployment?.serviceName || '').trim().toLowerCase() === String(parsed.serviceName || '').trim().toLowerCase());
  }

  return [];
}

async function persistDeploymentRecords({ deploymentIndexPath, deploymentRegistry, deployments }) {
  const normalizedDeployments = Array.isArray(deployments)
    ? deployments.map((deployment) => normalizeDeploymentRecord(deployment))
    : [];
  const payload = {
    updatedAt: new Date().toISOString(),
    deployments: normalizedDeployments
  };
  await writeDeploymentIndexToDisk(deploymentIndexPath, payload);
  syncDeploymentRegistry(deploymentRegistry, normalizedDeployments);
  return payload;
}

export function registerTopologyRuntimeRoutes(app, deps) {
  const {
    discoveredNodes,
    homeAutomationService,
    getBrokerNodeDetails,
    getSystemPerformanceSnapshot,
    services,
    serviceInstanceRegistry,
    upsertServiceInstance,
    resolveServiceInstance,
    ffsDeploymentRegistry,
    setNodeLifecycleState,
    deploymentIndexPath
  } = deps;
  let nodeRenameMap = {};
  let nodeRenameMapLoaded = false;
  let nodeTopologyMap = {};
  let nodeTopologyMapLoaded = false;
  let clusterRegistry = {};
  let clusterRegistryLoaded = false;
  let siteRegistry = {};
  let siteRegistryLoaded = false;

  async function ensureNodeRenameMapLoaded() {
    if (nodeRenameMapLoaded) return;
    nodeRenameMap = await loadNodeRenameMap();
    nodeRenameMapLoaded = true;
  }

  async function ensureNodeTopologyMapLoaded() {
    if (nodeTopologyMapLoaded) return;
    nodeTopologyMap = await loadNodeTopologyMap();
    nodeTopologyMapLoaded = true;
  }

  async function ensureClusterRegistryLoaded() {
    if (clusterRegistryLoaded) return;
    clusterRegistry = await loadClusterRegistry();
    clusterRegistryLoaded = true;
  }

  async function ensureSiteRegistryLoaded() {
    if (siteRegistryLoaded) return;
    siteRegistry = await loadSiteRegistry();
    siteRegistryLoaded = true;
  }

  function buildEffectiveClusterRegistry(nodes, registryOverride = null) {
    const normalizedNodes = Array.isArray(nodes) ? nodes : [];
    const explicit = normalizeClusterRegistry(registryOverride || clusterRegistry);
    const persistedFreePool = explicit[FREE_POOL_CLUSTER_ID] || null;
    const persistedJsFreePool = explicit[FREE_POOL_JS_CLUSTER_ID] || null;
    const persistedEspFreePool = explicit[FREE_POOL_ESP_CLUSTER_ID] || null;
    delete explicit[FREE_POOL_CLUSTER_ID];
    delete explicit[FREE_POOL_JS_CLUSTER_ID];
    delete explicit[FREE_POOL_ESP_CLUSTER_ID];

    function inferDefaultFreePoolForNode(node) {
      const hardware = String(node?.details?.hardware || '').trim().toLowerCase();
      const runtime = String(node?.details?.runtime || '').trim().toLowerCase();
      const nodeId = String(node?.nodeId || node?.nodeName || '').trim().toLowerCase();
      const ip = String(node?.ip || '').trim();

      const isJsRuntime = runtime.includes('js') || runtime.includes('javascript') || nodeId.includes('js-pmachine');
      if (isJsRuntime) return FREE_POOL_JS_CLUSTER_ID;

      const isEspHardware = hardware.includes('esp32')
        || hardware.includes('esp8266')
        || runtime.includes('pmachine')
        || (ip && !ip.startsWith('127.') && hardware !== 'server');
      if (isEspHardware) return FREE_POOL_ESP_CLUSTER_ID;

      return null;
    }

    const assigned = new Set();
    for (const cluster of Object.values(explicit)) {
      for (const nodeId of cluster.nodes || []) {
        const normalized = normalizeNodeId(nodeId);
        if (normalized) assigned.add(normalized);
      }
    }

    const unassigned = [];
    const unassignedJs = [];
    const unassignedEsp = [];
    for (const node of normalizedNodes) {
      const normalized = normalizeNodeId(node.nodeId || node.nodeName || node.ip);
      if (!normalized || assigned.has(normalized)) continue;
      const sourceFreePoolId = inferDefaultFreePoolForNode(node);
      if (!sourceFreePoolId) continue;
      unassigned.push(normalized);
      if (sourceFreePoolId === FREE_POOL_JS_CLUSTER_ID) unassignedJs.push(normalized);
      if (sourceFreePoolId === FREE_POOL_ESP_CLUSTER_ID) unassignedEsp.push(normalized);
    }

    const now = new Date().toISOString();
    return {
      ...explicit,
      [FREE_POOL_JS_CLUSTER_ID]: {
        clusterId: FREE_POOL_JS_CLUSTER_ID,
        label: String(persistedJsFreePool?.label || FREE_POOL_JS_CLUSTER_LABEL).trim() || FREE_POOL_JS_CLUSTER_LABEL,
        nodes: Array.from(new Set(unassignedJs)),
        nodeOrigins: {},
        state: String(persistedJsFreePool?.state || 'up').trim().toLowerCase() || 'up',
        createdAt: String(persistedJsFreePool?.createdAt || now),
        updatedAt: now
      },
      [FREE_POOL_ESP_CLUSTER_ID]: {
        clusterId: FREE_POOL_ESP_CLUSTER_ID,
        label: String(persistedEspFreePool?.label || FREE_POOL_ESP_CLUSTER_LABEL).trim() || FREE_POOL_ESP_CLUSTER_LABEL,
        nodes: Array.from(new Set(unassignedEsp)),
        nodeOrigins: {},
        state: String(persistedEspFreePool?.state || 'up').trim().toLowerCase() || 'up',
        createdAt: String(persistedEspFreePool?.createdAt || now),
        updatedAt: now
      },
      [FREE_POOL_CLUSTER_ID]: {
        clusterId: FREE_POOL_CLUSTER_ID,
        label: String(persistedFreePool?.label || FREE_POOL_CLUSTER_LABEL).trim() || FREE_POOL_CLUSTER_LABEL,
        nodes: Array.from(new Set(unassigned)),
        nodeOrigins: {},
        state: String(persistedFreePool?.state || 'up').trim().toLowerCase() || 'up',
        createdAt: String(persistedFreePool?.createdAt || now),
        updatedAt: now
      }
    };
  }

  function buildClusterUdpPortMap(effectiveRegistry) {
    const entries = Object.values(effectiveRegistry || {})
      .map((cluster) => String(cluster?.clusterId || '').trim().toLowerCase())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const out = new Map();
    for (let i = 0; i < entries.length; i += 1) {
      const clusterId = entries[i];
      const parentPort = UDP_PORT_PAIR_START + (i * 2);
      const siblingPort = parentPort + 1;
      out.set(clusterId, { parentPort, siblingPort });
    }
    return out;
  }

  function resolveNodeRename(node) {
    const candidateKeys = [
      node?.nodeId,
      node?.id,
      node?.ip,
      node?.nodeName,
      node?.details?.nodeName
    ]
      .map((value) => normalizeNodeId(value))
      .filter(Boolean);

    for (const key of candidateKeys) {
      const renamed = nodeRenameMap[key];
      if (renamed) return renamed;
    }
    return null;
  }

  function applyNodeRename(node) {
    const renamed = resolveNodeRename(node);
    if (!renamed) return node;
    return {
      ...node,
      nodeName: renamed,
      details: {
        ...(node?.details || {}),
        nodeName: renamed
      }
    };
  }

  function normalizeServiceName(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeNodeId(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getNodeIdentityCandidates(node) {
    return [
      node?.nodeId,
      node?.id,
      node?.ip,
      node?.nodeName,
      node?.details?.nodeName
    ]
      .map((value) => normalizeNodeId(value))
      .filter(Boolean);
  }

  function resolveNodeTopologyOverride(node) {
    const keys = getNodeIdentityCandidates(node);
    for (const key of keys) {
      const value = nodeTopologyMap[key];
      if (value) return value;
    }
    return {
      parentNodeId: '',
      isClusterGateway: false,
      ...normalizeSiteMetadata({})
    };
  }

  function resolveNodeSite(node, override = null) {
    const detailsSite = node?.details?.site && typeof node.details.site === 'object'
      ? node.details.site
      : {};
    const base = normalizeSiteMetadata(detailsSite || {}, {
      fallbackCategory: 'internal',
      fallbackMode: SITE_MODE_DEFAULT
    });
    const overrideSiteId = String(override?.siteId || '').trim().toLowerCase();
    const detailsSiteId = String(detailsSite?.siteId || '').trim().toLowerCase();
    const selectedSiteId = overrideSiteId || detailsSiteId || base.siteId;
    const registrySite = selectedSiteId ? siteRegistry?.[selectedSiteId] : null;
    const mergedRaw = registrySite
      ? {
          ...registrySite,
          siteId: selectedSiteId
        }
      : {
          ...base,
          ...(override || {})
        };
    return normalizeSiteMetadata(mergedRaw, {
      fallbackCategory: base.siteCategory,
      fallbackMode: base.siteMode
    });
  }

  function attachTopologyMetadata(nodes, effectiveRegistry = {}) {
    const normalizedNodes = Array.isArray(nodes) ? nodes : [];
    const keyToNode = new Map();

    for (const node of normalizedNodes) {
      for (const key of getNodeIdentityCandidates(node)) {
        if (!keyToNode.has(key)) keyToNode.set(key, node);
      }
    }

    const clusterNodeMap = new Map();
    for (const [clusterId, cluster] of Object.entries(effectiveRegistry || {})) {
      const normalizedClusterId = String(clusterId || '').trim().toLowerCase();
      const members = Array.isArray(cluster?.nodes) ? cluster.nodes : [];
      for (const nodeId of members) {
        const normalizedNodeId = normalizeNodeId(nodeId);
        if (!normalizedNodeId) continue;
        clusterNodeMap.set(normalizedNodeId, normalizedClusterId);
      }
    }
    const clusterUdpPortMap = buildClusterUdpPortMap(effectiveRegistry);

    const withTopology = normalizedNodes.map((node) => {
      const nodeKey = getNodeIdentityCandidates(node)[0] || normalizeNodeId(node?.ip) || 'unknown';
      const override = resolveNodeTopologyOverride(node);
      const boardCluster = node?.details?.cluster && typeof node.details.cluster === 'object'
        ? node.details.cluster
        : {};
      const boardParent = normalizeNodeId(boardCluster.parentNodeId);
      // Check node.topology.parentNodeId as well
      const existingTopologyParent = normalizeNodeId(node?.topology?.parentNodeId);
      const overrideParent = normalizeNodeId(override.parentNodeId);
      const normalizedParent = override.pendingBoardSync
        ? overrideParent
        : (boardParent || existingTopologyParent || overrideParent);
      const parentNode = normalizedParent ? keyToNode.get(normalizedParent) : null;
      const parentName = parentNode
        ? String(parentNode.details?.nodeName || parentNode.nodeName || parentNode.nodeId || parentNode.ip || '').trim()
        : '';
      const parentIp = parentNode ? String(parentNode.ip || '').trim() : '';

      const boardParentPort = Number(boardCluster.parentPort || boardCluster?.udp?.parentPort || 0);
      const boardSiblingPort = Number(boardCluster.siblingPort || boardCluster?.udp?.siblingPort || 0);
      const boardPortsValid = Number.isFinite(boardParentPort)
        && Number.isFinite(boardSiblingPort)
        && boardParentPort >= 1024
        && boardSiblingPort === boardParentPort + 1;
      const boardGateway = boardCluster.isClusterGateway === true;

      const assignedClusterId = clusterNodeMap.get(nodeKey) || null;
      const activeClusterId = String(assignedClusterId || boardCluster.activeClusterId || 'default').trim().toLowerCase() || 'default';
      const clusterPorts = clusterUdpPortMap.get(activeClusterId) || null;
      const parentPort = clusterPorts?.parentPort || (boardPortsValid ? boardParentPort : UDP_PORT_PAIR_START);
      const siblingPort = clusterPorts?.siblingPort || (boardPortsValid ? boardSiblingPort : (parentPort + 1));
      const site = resolveNodeSite(node, override);

      return {
        ...node,
        topology: {
          nodeKey,
          isClusterGateway: boardGateway || override.isClusterGateway === true,
          parentNodeId: normalizedParent || '',
          parentNodeName: parentName,
          parentNodeIp: parentIp,
          parentAvailable: !normalizedParent || Boolean(parentNode),
          waitingForParent: Boolean(normalizedParent) && !parentNode,
          activeClusterId,
          site,
          siteId: site.siteId,
          siteName: site.siteName,
          siteCategory: site.siteCategory,
          siteMode: site.siteMode,
          isExternalSite: site.isExternalSite,
          flowDirection: 'bottom-up',
          udp: {
            parentPort,
            siblingPort,
            listenPorts: [parentPort, siblingPort],
            upstreamPort: parentPort
          }
        }
      };
    });

    const childrenByParent = new Map();
    for (const node of withTopology) {
      const parent = normalizeNodeId(node?.topology?.parentNodeId);
      const child = String(node?.topology?.nodeKey || '').trim();
      if (!parent || !child) continue;
      if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
      childrenByParent.get(parent).push(child);
    }

    const withChildren = withTopology.map((node) => {
      const key = String(node?.topology?.nodeKey || '').trim();
      const children = childrenByParent.get(key) || [];
      const hasChildren = children.length > 0;
      return {
        ...node,
        topology: {
          ...node.topology,
          childNodeIds: children,
          // A node is considered a cluster controller whenever it has children.
          clusterController: hasChildren,
          isClusterGateway: Boolean(node?.topology?.isClusterGateway) || hasChildren
        }
      };
    });

    const byNodeKeyForClusterInheritance = new Map();
    for (const node of withChildren) {
      const nodeKey = String(node?.topology?.nodeKey || '').trim();
      if (nodeKey) byNodeKeyForClusterInheritance.set(nodeKey, node);
    }

    const memoClusterByNode = new Map();
    const resolveEffectiveClusterForNode = (nodeKey, visiting = new Set()) => {
      if (!nodeKey) return 'default';
      if (memoClusterByNode.has(nodeKey)) return memoClusterByNode.get(nodeKey);

      const node = byNodeKeyForClusterInheritance.get(nodeKey);
      if (!node) return 'default';

      const explicitAssignedCluster = String(clusterNodeMap.get(nodeKey) || '').trim().toLowerCase();
      const boardDeclaredCluster = String(node?.details?.cluster?.activeClusterId || '').trim().toLowerCase();
      const currentCluster = String(node?.topology?.activeClusterId || 'default').trim().toLowerCase() || 'default';

      // Explicit cluster definitions stay on the node; inherited defaults come from the parent.
      if (explicitAssignedCluster) {
        memoClusterByNode.set(nodeKey, explicitAssignedCluster);
        return explicitAssignedCluster;
      }
      if (boardDeclaredCluster && boardDeclaredCluster !== 'default') {
        memoClusterByNode.set(nodeKey, boardDeclaredCluster);
        return boardDeclaredCluster;
      }

      const parentKey = normalizeNodeId(node?.topology?.parentNodeId);
      if (parentKey && !visiting.has(nodeKey)) {
        visiting.add(nodeKey);
        const inherited = resolveEffectiveClusterForNode(parentKey, visiting);
        visiting.delete(nodeKey);
        const normalizedInherited = String(inherited || '').trim().toLowerCase();
        if (normalizedInherited) {
          memoClusterByNode.set(nodeKey, normalizedInherited);
          return normalizedInherited;
        }
      }

      memoClusterByNode.set(nodeKey, currentCluster);
      return currentCluster;
    };

    const withInheritedClusters = withChildren.map((node) => {
      const nodeKey = String(node?.topology?.nodeKey || '').trim();
      const activeClusterId = resolveEffectiveClusterForNode(nodeKey);
      const clusterPorts = clusterUdpPortMap.get(activeClusterId) || null;
      const currentParentPort = Number(node?.topology?.udp?.parentPort || 0);
      const nextParentPort = clusterPorts?.parentPort || (currentParentPort >= 1024 ? currentParentPort : UDP_PORT_PAIR_START);
      const nextSiblingPort = clusterPorts?.siblingPort || (nextParentPort + 1);

      return {
        ...node,
        topology: {
          ...node.topology,
          activeClusterId,
          udp: {
            parentPort: nextParentPort,
            siblingPort: nextSiblingPort,
            listenPorts: [nextParentPort, nextSiblingPort],
            upstreamPort: nextParentPort
          }
        }
      };
    });

    const byNodeKey = new Map();
    for (const node of withInheritedClusters) {
      const nodeKey = String(node?.topology?.nodeKey || '').trim();
      if (nodeKey) byNodeKey.set(nodeKey, node);
    }

    const memoServices = new Map();
    const memoDevices = new Map();
    const collectAdvertisedServices = (nodeKey, visiting = new Set()) => {
      if (!nodeKey) return [];
      if (memoServices.has(nodeKey)) return memoServices.get(nodeKey);
      if (visiting.has(nodeKey)) return [];

      const node = byNodeKey.get(nodeKey);
      if (!node) return [];

      visiting.add(nodeKey);
      const ownServices = dedupeServiceAdvertisements(node?.details?.services || []);
      let combined = [...ownServices];

      const childNodeIds = Array.isArray(node?.topology?.childNodeIds) ? node.topology.childNodeIds : [];
      for (const childKey of childNodeIds) {
        combined = combined.concat(collectAdvertisedServices(String(childKey || '').trim(), visiting));
      }

      visiting.delete(nodeKey);
      const deduped = dedupeServiceAdvertisements(combined);
      memoServices.set(nodeKey, deduped);
      return deduped;
    };

    const collectAdvertisedDevices = (nodeKey, visiting = new Set()) => {
      if (!nodeKey) return [];
      if (memoDevices.has(nodeKey)) return memoDevices.get(nodeKey);
      if (visiting.has(nodeKey)) return [];

      const node = byNodeKey.get(nodeKey);
      if (!node) return [];

      visiting.add(nodeKey);
      const ownDevices = dedupeDeviceAdvertisements(node?.details?.devices || [], nodeKey);
      let combined = [...ownDevices];

      const childNodeIds = Array.isArray(node?.topology?.childNodeIds) ? node.topology.childNodeIds : [];
      for (const childKey of childNodeIds) {
        combined = combined.concat(collectAdvertisedDevices(String(childKey || '').trim(), visiting));
      }

      visiting.delete(nodeKey);
      const deduped = dedupeDeviceAdvertisements(combined);
      memoDevices.set(nodeKey, deduped);
      return deduped;
    };

    return withInheritedClusters.map((node) => {
      const nodeKey = String(node?.topology?.nodeKey || '').trim();
      const localServices = dedupeServiceAdvertisements(node?.details?.services || []);
      const advertisedServices = collectAdvertisedServices(nodeKey);
      const localDevices = dedupeDeviceAdvertisements(node?.details?.devices || [], nodeKey);
      const advertisedDevices = collectAdvertisedDevices(nodeKey);
      return {
        ...node,
        details: {
          ...(node?.details || {}),
          localServices,
          services: advertisedServices,
          localDevices,
          devices: advertisedDevices
        }
      };
    });
  }

  async function buildCurrentNodesWithTopology() {
    await ensureNodeRenameMapLoaded();
    await ensureNodeTopologyMapLoaded();
    await ensureClusterRegistryLoaded();
    await ensureSiteRegistryLoaded();
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

    // Add Neptune parent node with proper nodeKey
    const neptuneNode = {
      id: 'Neptune',
      nodeId: 'Neptune',
      nodeName: 'Neptune',
      ip: '172.18.0.1',
      port: 8080,
      kind: 'cluster-node',
      hardware: 'Neptune Cluster',
      status: 'available',
      available: true,
      lastSeen: now,
      ts: now,
      details: {
        nodeName: 'Neptune',
        hardware: 'Neptune Cluster',
        services: ['Cluster Manager', 'Router'],
        status: 'available'
      },
      topology: {
        nodeKey: 'Neptune',
        parentNodeId: null,
        activeClusterId: 'default',
        site: {
          siteId: 'primary-site',
          siteName: 'Primary Site',
          siteCategory: 'internal',
          siteMode: 'hot-warm'
        }
      }
    };

    // Add known ESP32 nodes with Neptune as parent
    const esp32Nodes = [
      {
        id: 'child1',
        nodeId: 'child1',
        nodeName: 'child1',
        ip: '192.168.2.157',
        port: 80,
        kind: 'esp32-device',
        hardware: 'ESP32-CAM',
        status: 'available',
        available: true,
        lastSeen: now,
        ts: now,
        details: {
          nodeName: 'child1',
          hardware: 'ESP32-CAM',
          services: ['LEDPIN', 'RELAY', 'Camera'],
          status: 'available'
        },
        topology: {
          nodeKey: 'child1',
          parentNodeId: 'Neptune',
          activeClusterId: 'default',
          site: {
            siteId: 'primary-site',
            siteName: 'Primary Site',
            siteCategory: 'internal',
            siteMode: 'hot-warm'
          }
        }
      },
      {
        id: 'child2',
        nodeId: 'child2',
        nodeName: 'child2',
        ip: '192.168.2.59',
        port: 80,
        kind: 'esp8266-device',
        hardware: 'ESP8266',
        status: 'available',
        available: true,
        lastSeen: now,
        ts: now,
        details: {
          nodeName: 'child2',
          hardware: 'ESP8266',
          services: ['RELAY', 'Sensor'],
          status: 'available'
        },
        topology: {
          nodeKey: 'child2',
          parentNodeId: 'Neptune',
          activeClusterId: 'default',
          site: {
            siteId: 'primary-site',
            siteName: 'Primary Site',
            siteCategory: 'internal',
            siteMode: 'hot-warm'
          }
        }
      },
      {
        id: 'child3',
        nodeId: 'child3',
        nodeName: 'child3',
        ip: '192.168.2.58',
        port: 80,
        kind: 'esp32-device',
        hardware: 'ESP32',
        status: 'available',
        available: true,
        lastSeen: now,
        ts: now,
        details: {
          nodeName: 'child3',
          hardware: 'ESP32',
          services: ['GPIO', 'ADC', 'PWM'],
          status: 'available'
        },
        topology: {
          nodeKey: 'child3',
          parentNodeId: 'Neptune',
          activeClusterId: 'default',
          site: {
            siteId: 'primary-site',
            siteName: 'Primary Site',
            siteCategory: 'internal',
            siteMode: 'hot-warm'
          }
        }
      }
    ];

    const homeAutomationNodes = homeAutomationService?.getTopologyNodes?.() || [];
    const allNodes = [backendNode, ...magicClusterNodes, neptuneNode, ...esp32Nodes, ...homeAutomationNodes, ...Array.from(discoveredNodes.values())];
    
    // Deduplicate nodes by nodeKey/nodeId/nodeName/ip
    const seenKeys = new Set();
    const uniqueNodes = [];
    for (const node of allNodes) {
      const key = normalizeNodeId(node?.nodeId || node?.nodeName || node?.ip || '');
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);
      uniqueNodes.push(node);
    }

    const nodes = uniqueNodes
      .map((node) => applyNodeRename(node))
      .sort((a, b) => b.lastSeen - a.lastSeen);
    await reconcilePendingNodeTopologies(nodes);
    const effectiveRegistry = buildEffectiveClusterRegistry(nodes);
    return attachTopologyMetadata(nodes, effectiveRegistry);
  }

  function resolveBoardIpForNodeId(normalizedNodeId, nodes = []) {
    const liveNode = (Array.isArray(nodes) ? nodes : []).find(
      (entry) => normalizeNodeId(entry.nodeId || entry.nodeName || entry.ip) === normalizedNodeId
    ) || null;
    const liveIp = String(liveNode?.ip || '').trim();
    if (liveIp) return liveIp;

    for (const existing of discoveredNodes.values()) {
      const candidateId = normalizeNodeId(existing?.nodeId || existing?.id || existing?.ip);
      if (candidateId && candidateId === normalizedNodeId) {
        const ip = String(existing?.ip || '').trim();
        if (ip) return ip;
      }
    }
    return '';
  }

  function isLikelyEspBoard(nodeId, nodes = []) {
    const liveNode = (Array.isArray(nodes) ? nodes : []).find(
      (entry) => normalizeNodeId(entry.nodeId || entry.nodeName || entry.ip) === nodeId
    ) || null;
    const hardware = String(liveNode?.details?.hardware || '').trim().toLowerCase();
    return hardware.includes('esp32') || hardware.includes('esp8266');
  }

  async function applyNodeTopologyAssignment(nodeId, topology = {}, nodes = []) {
    await ensureNodeTopologyMapLoaded();

    const normalizedNodeId = normalizeNodeId(nodeId);
    if (!normalizedNodeId) {
      return { nodeId, status: 'skipped', reason: 'invalid-node-id' };
    }

    const boardIp = resolveBoardIpForNodeId(normalizedNodeId, nodes);
    const shouldPushToBoard = Boolean(boardIp)
      && !String(boardIp).startsWith('127.')
      && isLikelyEspBoard(normalizedNodeId, nodes);

    if (shouldPushToBoard) {
      await persistNodeTopologyOnBoard(boardIp, topology);
      nodeTopologyMap[normalizedNodeId] = {
        parentNodeId: normalizeNodeId(topology.parentNodeId) || '',
        isClusterGateway: topology.isClusterGateway === true,
        activeClusterId: String(topology.activeClusterId || '').trim().toLowerCase(),
        parentHost: String(topology.parentHost || '').trim(),
        parentPort: Number(topology.parentPort || 0) || undefined,
        siblingPort: Number(topology.siblingPort || 0) || undefined,
        pendingBoardSync: false,
        ...normalizeSiteMetadata(topology || {})
      };
      await saveNodeTopologyMap(nodeTopologyMap);
      return { nodeId: normalizedNodeId, status: 'applied', source: 'board', ip: boardIp };
    }

    nodeTopologyMap[normalizedNodeId] = {
      parentNodeId: normalizeNodeId(topology.parentNodeId) || '',
      isClusterGateway: topology.isClusterGateway === true,
      activeClusterId: String(topology.activeClusterId || '').trim().toLowerCase(),
      parentHost: String(topology.parentHost || '').trim(),
      parentPort: Number(topology.parentPort || 0) || undefined,
      siblingPort: Number(topology.siblingPort || 0) || undefined,
      pendingBoardSync: true,
      ...normalizeSiteMetadata(topology || {})
    };
    await saveNodeTopologyMap(nodeTopologyMap);
    return { nodeId: normalizedNodeId, status: 'applied', source: 'server' };
  }

  async function reconcilePendingNodeTopologies(nodes = []) {
    await ensureNodeTopologyMapLoaded();
    let changed = false;

    for (const [nodeId, topology] of Object.entries(nodeTopologyMap)) {
      if (topology?.pendingBoardSync !== true) continue;

      const node = (Array.isArray(nodes) ? nodes : []).find((candidate) => {
        const aliases = [
          ...getNodeIdentityCandidates(candidate),
          normalizeNodeId(candidate?.topology?.nodeKey)
        ].filter(Boolean);
        return aliases.includes(normalizeNodeId(nodeId));
      }) || null;
      const boardIp = String(node?.ip || '').trim();
      if (!boardIp || boardIp.startsWith('127.') || !isLikelyEspBoard(normalizeNodeId(nodeId), nodes)) continue;

      try {
        await persistNodeTopologyOnBoard(boardIp, topology);
        nodeTopologyMap[nodeId] = {
          ...topology,
          pendingBoardSync: false
        };
        changed = true;
      } catch {
        // Keep the assignment queued until this board is reachable again.
      }
    }

    if (changed) await saveNodeTopologyMap(nodeTopologyMap);
  }

  async function renameNodeByIdentity(requestedNodeId, requestedIp, nextName) {
    await ensureNodeRenameMapLoaded();
    await ensureNodeTopologyMapLoaded();

    const normalizedNodeId = normalizeNodeId(requestedNodeId);
    const normalizedIp = normalizeNodeId(requestedIp);
    const nodes = await buildCurrentNodesWithTopology();
    const resolvedNode = resolveManagedNode(requestedNodeId, requestedIp, nodes).node;
    const renamedAliases = new Set([
      normalizedNodeId,
      normalizedIp,
      ...getNodeIdentityCandidates(resolvedNode),
      normalizeNodeId(resolvedNode?.topology?.nodeKey)
    ].filter(Boolean));
    const childNodes = nodes.filter((node) => renamedAliases.has(normalizeNodeId(node?.topology?.parentNodeId)));
    let boardIp = String(requestedIp || '').trim();

    if (!boardIp && normalizedNodeId) {
      for (const existing of discoveredNodes.values()) {
        const matches = [
          normalizeNodeId(existing?.nodeId),
          normalizeNodeId(existing?.id),
          normalizeNodeId(existing?.ip)
        ].filter(Boolean);
        if (matches.includes(normalizedNodeId)) {
          boardIp = String(existing?.ip || '').trim();
          break;
        }
      }
    }

    if (!boardIp) {
      const err = new Error('target board ip not found for rename');
      err.httpStatus = 404;
      throw err;
    }

    let boardRenameApplied = false;
    try {
      await persistNodeNameOnBoard(boardIp, nextName);
      boardRenameApplied = true;
    } catch (error) {
      // Legacy nodes may not implement /node/name; fall back to server-side rename override.
      const message = String(error?.message || '').toLowerCase();
      const canFallback = message.includes('not found') || message.includes('404');
      if (!canFallback) throw error;
    }

    if (normalizedNodeId) delete nodeRenameMap[normalizedNodeId];
    if (normalizedIp) delete nodeRenameMap[normalizedIp];

    if (normalizedNodeId) nodeRenameMap[normalizedNodeId] = nextName;
    if (normalizedIp) nodeRenameMap[normalizedIp] = nextName;
    const normalizedBoardIp = normalizeNodeId(boardIp);
    if (normalizedBoardIp) nodeRenameMap[normalizedBoardIp] = nextName;

    const topologyUpdates = [];
    for (const child of childNodes) {
      const childKey = getNodeIdentityCandidates(child)[0] || normalizeNodeId(child?.ip);
      if (!childKey) continue;

      const desiredTopology = {
        activeClusterId: String(child?.topology?.activeClusterId || 'default').trim().toLowerCase(),
        parentHost: boardIp,
        parentNodeId: normalizeNodeId(nextName),
        isClusterGateway: child?.topology?.isClusterGateway === true,
        parentPort: child?.topology?.udp?.parentPort,
        siblingPort: child?.topology?.udp?.siblingPort,
        ...normalizeSiteMetadata(child?.topology || {})
      };
      let synchronized = false;
      const childIp = String(child?.ip || '').trim();
      if (childIp && !childIp.startsWith('127.') && isLikelyEspBoard(childKey, nodes)) {
        try {
          await persistNodeTopologyOnBoard(childIp, desiredTopology);
          synchronized = true;
        } catch {
          synchronized = false;
        }
      }

      nodeTopologyMap[childKey] = {
        ...desiredTopology,
        pendingBoardSync: !synchronized
      };
      topologyUpdates.push({ nodeId: childKey, synchronized });
    }

    for (const [key, existing] of discoveredNodes.entries()) {
      const matches = [
        normalizeNodeId(existing?.nodeId),
        normalizeNodeId(existing?.id),
        normalizeNodeId(existing?.ip),
        normalizeNodeId(key)
      ].filter(Boolean);
      if (
        (normalizedNodeId && matches.includes(normalizedNodeId))
        || (normalizedIp && matches.includes(normalizedIp))
      ) {
        discoveredNodes.set(key, {
          ...existing,
          nodeName: nextName,
          details: {
            ...(existing?.details || {}),
            nodeName: nextName
          }
        });
      }
    }

    await saveNodeRenameMap(nodeRenameMap);
    if (topologyUpdates.length > 0) await saveNodeTopologyMap(nodeTopologyMap);

    return {
      status: 'ok',
      nodeId: requestedNodeId || requestedIp,
      nodeName: nextName,
      sourceOfTruth: boardRenameApplied ? 'board' : 'server',
      childTopologyUpdates: topologyUpdates
    };
  }

  function nodeMatchesAddressToken(node, token) {
    const normalizedToken = normalizeNodeId(token);
    if (!normalizedToken) return false;
    const candidates = [
      node?.nodeName,
      node?.nodeId,
      node?.ip,
      node?.topology?.nodeKey,
      node?.details?.nodeName
    ].map((v) => normalizeNodeId(v)).filter(Boolean);
    return candidates.includes(normalizedToken);
  }

  function resolveNodeByAddressPath(address, nodes) {
    const segments = String(address || '').split('.').map((v) => normalizeNodeId(v)).filter(Boolean);
    if (segments.length === 0) return null;

    const list = Array.isArray(nodes) ? nodes : [];
    const byKey = new Map();
    for (const node of list) {
      const key = String(node?.topology?.nodeKey || '').trim();
      if (key) byKey.set(key, node);
    }

    let current = list.find((node) => nodeMatchesAddressToken(node, segments[0])) || null;
    if (!current) return null;

    for (let i = 1; i < segments.length; i += 1) {
      const token = segments[i];
      const childKeys = Array.isArray(current?.topology?.childNodeIds) ? current.topology.childNodeIds : [];
      const childNodes = childKeys.map((key) => byKey.get(String(key || '').trim())).filter(Boolean);
      const next = childNodes.find((node) => nodeMatchesAddressToken(node, token)) || null;
      if (!next) return null;
      current = next;
    }

    return current;
  }

  function chooseServiceInstanceByNode(serviceName, nodeId) {
    return chooseServiceInstanceByNodeWithNodes(serviceName, nodeId, []);
  }

  function normalizeSiteState(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isSiteStateAcceptingWork(state) {
    const normalized = normalizeSiteState(state);
    return normalized === 'up' || normalized === 'active';
  }

  function buildNodeSiteStateMap(nodes = []) {
    const nodeSiteState = new Map();
    const nodeSiteId = new Map();
    for (const node of Array.isArray(nodes) ? nodes : []) {
      const siteId = String(node?.topology?.siteId || 'primary-site').trim().toLowerCase() || 'primary-site';
      const siteState = normalizeSiteState(siteRegistry?.[siteId]?.state || 'up') || 'up';
      for (const key of getNodeIdentityCandidates(node)) {
        if (!nodeSiteState.has(key)) nodeSiteState.set(key, siteState);
        if (!nodeSiteId.has(key)) nodeSiteId.set(key, siteId);
      }
    }
    return { nodeSiteState, nodeSiteId };
  }

  function chooseServiceInstanceByNodeWithNodes(serviceName, nodeId, nodes = []) {
    const normalizedName = normalizeServiceName(serviceName);
    const normalizedNodeId = normalizeNodeId(nodeId);
    if (!normalizedName || !normalizedNodeId) return null;

    const { nodeSiteState } = buildNodeSiteStateMap(nodes);

    let selected = null;
    for (const instance of serviceInstanceRegistry.values()) {
      if (normalizeServiceName(instance.serviceName) !== normalizedName) continue;
      if (!['up', 'degraded'].includes(String(instance.status || '').toLowerCase())) continue;
      const instanceKey = normalizeNodeId(instance.nodeId || instance.ip);
      if (instanceKey !== normalizedNodeId) continue;
      const siteState = nodeSiteState.get(instanceKey) || 'up';
      if (!isSiteStateAcceptingWork(siteState)) continue;
      if (!selected || Number(instance.lastHeartbeat || 0) > Number(selected.lastHeartbeat || 0)) {
        selected = instance;
      }
    }
    return selected;
  }

  function listServiceDirectory() {
    const now = Date.now();
    const byService = new Map();

    for (const instance of serviceInstanceRegistry.values()) {
      const serviceName = String(instance.serviceName || '').trim();
      if (!serviceName) continue;
      const key = normalizeServiceName(serviceName);
      if (!byService.has(key)) {
        byService.set(key, {
          serviceName,
          instances: []
        });
      }

      const staleMs = Math.max(0, now - Number(instance.lastHeartbeat || 0));
      byService.get(key).instances.push({
        instanceId: instance.instanceId,
        serviceName: instance.serviceName,
        nodeId: instance.nodeId,
        ip: instance.ip,
        port: instance.port,
        status: instance.status,
        metadata: instance.metadata || {},
        lastHeartbeat: instance.lastHeartbeat,
        staleMs
      });
    }

    // Keep deployed services discoverable even when no dedicated runtime instance advertises them.
    for (const deployment of ffsDeploymentRegistry.values()) {
      const serviceName = String(deployment?.serviceName || '').trim();
      if (!serviceName) continue;
      const key = normalizeServiceName(serviceName);
      if (!byService.has(key)) {
        byService.set(key, {
          serviceName,
          instances: []
        });
      }

      const deployedInstances = collectDeploymentServiceInstances(deployment, serviceInstanceRegistry);
      for (const deployedInstance of deployedInstances) {
        const pmachineInstance = deployedInstance.nodeId
          ? Array.from(serviceInstanceRegistry.values()).find((instance) => {
              if (normalizeServiceName(instance.serviceName) !== 'pmachine') return false;
              return normalizeNodeId(instance.nodeId || instance.ip) === normalizeNodeId(deployedInstance.nodeId);
            }) || null
          : null;

        byService.get(key).instances.push({
          instanceId: deployedInstance.instanceId,
          serviceName,
          nodeId: deployedInstance.nodeId,
          ip: deployedInstance.ip || null,
          port: deployedInstance.port || null,
          status: deployedInstance.status,
          metadata: deployedInstance.metadata,
          lastHeartbeat: pmachineInstance?.lastHeartbeat || deployedInstance.lastHeartbeat || null,
          staleMs: pmachineInstance?.lastHeartbeat ? Math.max(0, now - Number(pmachineInstance.lastHeartbeat || 0)) : null
        });
      }
    }

    const servicesOut = Array.from(byService.values());
    servicesOut.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
    for (const svc of servicesOut) {
      svc.instances.sort((a, b) => Number(b.lastHeartbeat || 0) - Number(a.lastHeartbeat || 0));
    }
    return servicesOut;
  }

  function getDeploymentForService(serviceName, nodeId) {
    const normalizedService = normalizeServiceName(serviceName);
    const normalizedNodeId = normalizeNodeId(nodeId);
    if (!normalizedService) return null;

    const entries = Array.from(ffsDeploymentRegistry.values());
    let wildcard = null;
    for (const entry of entries) {
      if (normalizeServiceName(entry.serviceName) !== normalizedService) continue;
      const targets = getDeploymentTargets(entry).map((target) => normalizeNodeId(target));
      if (normalizedNodeId && targets.includes(normalizedNodeId)) return entry;
      if (targets.length === 0 || String(entry?.scope || '').trim().toLowerCase() === 'collective') wildcard = entry;
    }
    return wildcard;
  }

  function toAllocatorCandidate(instance) {
    return {
      id: String(instance.instanceId || `${instance.serviceName}:${instance.nodeId || instance.ip || 'unknown'}`),
      nodeId: instance.nodeId || null,
      clusterId: instance.metadata?.clusterId || null,
      failureDomain: instance.metadata?.failureDomain || instance.nodeId || instance.ip || 'default',
      service: instance.serviceName || null,
      capabilities: Array.isArray(instance.metadata?.capabilities) ? instance.metadata.capabilities : [],
      executionMs: Number(instance.metadata?.p95LatencyMs || 50),
      queueDelayMs: Number(instance.metadata?.queueDelayMs || 0),
      dataMoveCost: Number(instance.metadata?.dataMoveCost || 0),
      failureRisk: Number(instance.metadata?.failureRisk || 0.01),
      congestionPrice: Number(instance.metadata?.congestionPrice || 0),
      specializationBenefit: Number(instance.metadata?.specializationBenefit || 0),
      diversityPenalty: Number(instance.metadata?.diversityPenalty || 0),
      successRate15m: Number(instance.metadata?.successRate15m || 0.99),
      estimatedFreeSlots: Number(instance.metadata?.estimatedFreeSlots || 1),
      status: instance.status
    };
  }

  function listActiveServiceInstances(serviceName, nodes = []) {
    const normalizedName = normalizeServiceName(serviceName);
    const { nodeSiteState } = buildNodeSiteStateMap(nodes);
    return Array.from(serviceInstanceRegistry.values()).filter((instance) => {
      if (normalizeServiceName(instance.serviceName) !== normalizedName) return false;
      if (!['up', 'degraded'].includes(String(instance.status || '').toLowerCase())) return false;
      const instanceKey = normalizeNodeId(instance.nodeId || instance.ip);
      const siteState = nodeSiteState.get(instanceKey) || 'up';
      return isSiteStateAcceptingWork(siteState);
    });
  }

  function chooseCandidateByNode(candidates, nodeId) {
    const normalizedNodeId = normalizeNodeId(nodeId);
    if (!normalizedNodeId) return null;
    return (Array.isArray(candidates) ? candidates : []).find((candidate) => {
      return normalizeNodeId(candidate?.nodeId || candidate?.ip) === normalizedNodeId;
    }) || null;
  }

  function listDeploymentBackedServiceCandidates(serviceName, nodes = []) {
    const normalizedService = normalizeServiceName(serviceName);
    if (!normalizedService) return [];

    const entries = Array.from(ffsDeploymentRegistry.values())
      .filter((entry) => normalizeServiceName(entry?.serviceName) === normalizedService);
    if (entries.length === 0) return [];

    const nodeList = Array.isArray(nodes) ? nodes : [];
    const nodeByKey = new Map();
    for (const node of nodeList) {
      for (const key of getNodeIdentityCandidates(node)) {
        if (!nodeByKey.has(key)) nodeByKey.set(key, node);
      }
    }

    const pmachineInstances = listActiveServiceInstances('pmachine', nodeList);
    const out = [];

    for (const pmachine of pmachineInstances) {
      const pmachineKey = normalizeNodeId(pmachine?.nodeId || pmachine?.ip);
      if (!pmachineKey) continue;

      const node = nodeByKey.get(pmachineKey) || null;
      const nodeKeys = node ? getNodeIdentityCandidates(node) : [pmachineKey];
      const deployment = entries.find((entry) => {
        const targets = getDeploymentTargets(entry).map((target) => normalizeNodeId(target));
        if (targets.length === 0) return true;
        return targets.some((target) => nodeKeys.includes(target) || target === pmachineKey);
      }) || null;
      if (!deployment) continue;

      const runtimeState = getDeploymentRuntimeState(deployment);
      if (runtimeState === 'stopped' || runtimeState === 'paused') continue;

      out.push({
        instanceId: `resident:${normalizedService}:${pmachine.instanceId || pmachineKey}`,
        serviceName,
        nodeId: pmachine.nodeId || node?.nodeId || node?.nodeName || pmachine.ip,
        ip: pmachine.ip,
        port: pmachine.port,
        status: runtimeState === 'running' ? 'up' : 'resident',
        lastHeartbeat: pmachine.lastHeartbeat,
        metadata: {
          ...(pmachine.metadata || {}),
          route: '/pmachine/router/run',
          deployment: true,
          deploymentId: getDeploymentId(deployment) || null,
          deploymentName: getDeploymentName(deployment) || serviceName,
          deploymentServiceName: deployment.serviceName,
          deploymentPackageName: deployment.packageName,
          deploymentPackageVersion: deployment.packageVersion,
          deploymentRuntimeState: runtimeState,
          targetNodeIds: getDeploymentTargets(deployment),
          ...(deployment.metadata || {})
        }
      });
    }

    return out;
  }

  async function invokeDeploymentOnPmachine(instance, deployment, reqBody) {
    const body = reqBody && typeof reqBody === 'object' ? reqBody : {};
    const deploymentMeta = deployment?.metadata && typeof deployment.metadata === 'object'
      ? deployment.metadata
      : {};

    const inputQueue = String(body.inputQueue || deploymentMeta.inputQueue || 'default.in').trim();
    const message = String(body.message || '').trim();
    const rules = String(body.rules || deploymentMeta.rules || '').trim();
    const mappings = String(body.mappings || deploymentMeta.mappings || '').trim();

    const params = new URLSearchParams();
    params.set('serviceId', String(body.runtimeServiceId || body.serviceId || deployment?.serviceName || instance?.serviceName || 'pmachine-service'));
    params.set('inputQueue', inputQueue);
    params.set('message', message);
    if (rules) params.set('rules', rules);
    if (mappings) params.set('mappings', mappings);

    const timeoutMs = Number(body.timeoutMs || 8000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(100, timeoutMs));
    try {
      const response = await fetch(`http://${instance.ip}:${instance.port}/pmachine/router/run?${params.toString()}`, {
        method: 'GET',
        signal: controller.signal
      });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '');
      return {
        ok: response.ok,
        status: response.status,
        contentType,
        payload
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function proxyServiceInvocation(instance, reqBody) {
    const body = reqBody && typeof reqBody === 'object' ? reqBody : {};
    const method = String(body.method || 'POST').trim().toUpperCase();
    const targetPath = String(body.path || instance?.metadata?.route || '/pmachine/service').trim();
    const timeoutMs = Number(body.timeoutMs || 5000);

    if (!instance?.ip || !instance?.port) {
      throw new Error('Selected service instance has no reachable ip/port');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(100, timeoutMs));
    try {
      const response = await fetch(`http://${instance.ip}:${instance.port}${targetPath.startsWith('/') ? targetPath : `/${targetPath}`}`, {
        method,
        headers: {
          'content-type': 'application/json'
        },
        body: method === 'GET' ? undefined : JSON.stringify(body.payload ?? body),
        signal: controller.signal
      });

      const contentType = response.headers.get('content-type') || '';
      let payload;
      if (contentType.includes('application/json')) {
        payload = await response.json();
      } else {
        payload = await response.text();
      }

      return {
        ok: response.ok,
        status: response.status,
        contentType,
        payload
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function enqueueInvocationDeliveries(invocation, { sourceService } = {}) {
    const payload = invocation?.payload;
    const deliveries = Array.isArray(payload?.deliveries) ? payload.deliveries : [];
    if (deliveries.length === 0) {
      return { attempted: 0, enqueued: 0, failed: 0, items: [] };
    }

    const backendBaseUrl = String(
      process.env.PULSE_BACKEND_URL
      || process.env.BACKEND_URL
      || 'http://127.0.0.1:4000'
    ).trim().replace(/\/$/, '') || 'http://127.0.0.1:4000';

    const items = [];
    let enqueued = 0;
    for (const delivery of deliveries) {
      const queueName = String(delivery?.outputQueue || delivery?.queueName || '').trim();
      if (!queueName) {
        items.push({ ok: false, queueName: '', status: 0, error: 'missing queue name' });
        continue;
      }

      try {
        const response = await fetch(`${backendBaseUrl}/api/queue/${encodeURIComponent(queueName)}/enqueue`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            message: delivery?.message ?? '',
            sourceService: String(sourceService || 'pmachine-route')
          })
        });

        const text = await response.text();
        let payloadBody = null;
        try {
          payloadBody = JSON.parse(text);
        } catch {
          payloadBody = { raw: text };
        }

        const ok = response.ok;
        if (ok) enqueued += 1;
        items.push({
          ok,
          queueName,
          status: response.status,
          response: payloadBody
        });
      } catch (e) {
        items.push({
          ok: false,
          queueName,
          status: 0,
          error: e?.message || String(e)
        });
      }
    }

    return {
      attempted: deliveries.length,
      enqueued,
      failed: Math.max(0, deliveries.length - enqueued),
      items
    };
  }

  async function persistNodeNameOnBoard(ip, nextName, timeoutMs = 2500) {
    const normalizedIp = String(ip || '').trim();
    const normalizedName = String(nextName || '').trim();
    if (!normalizedIp) {
      throw new Error('board ip is required');
    }
    if (!normalizedName) {
      throw new Error('nodeName is required');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(250, timeoutMs));
    try {
      const body = new URLSearchParams({
        nodeName: normalizedName,
        persist: 'true'
      }).toString();

      const response = await fetch(`http://${normalizedIp}/node/name`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body,
        signal: controller.signal
      });

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      let payload = null;
      if (contentType.includes('application/json')) {
        payload = await response.json().catch(() => null);
      } else {
        payload = await response.text().catch(() => '');
      }

      if (!response.ok) {
        const detail = payload && typeof payload === 'object'
          ? (payload.error || payload.message || JSON.stringify(payload))
          : String(payload || `HTTP ${response.status}`);
        throw new Error(`board rename failed: ${detail}`);
      }

      return payload;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function persistNodeTopologyOnBoard(ip, topology = {}, timeoutMs = 2500) {
    const normalizedIp = String(ip || '').trim();
    if (!normalizedIp) {
      throw new Error('board ip is required');
    }

    const body = new URLSearchParams();
    if (topology.activeClusterId != null) body.set('activeClusterId', String(topology.activeClusterId));
    if (topology.parentHost != null) body.set('parentHost', String(topology.parentHost));
    if (topology.parentNodeId != null) body.set('parentNodeId', String(topology.parentNodeId));
    if (topology.isClusterGateway != null) body.set('isClusterGateway', String(Boolean(topology.isClusterGateway)));
    if (topology.parentPort != null) body.set('parentPort', String(topology.parentPort));
    if (topology.siblingPort != null) body.set('siblingPort', String(topology.siblingPort));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(250, timeoutMs));
    try {
      const response = await fetch(`http://${normalizedIp}/node/topology`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: body.toString(),
        signal: controller.signal
      });

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      let payload = null;
      if (contentType.includes('application/json')) {
        payload = await response.json().catch(() => null);
      } else {
        payload = await response.text().catch(() => '');
      }

      if (!response.ok) {
        const detail = payload && typeof payload === 'object'
          ? (payload.error || payload.message || JSON.stringify(payload))
          : String(payload || `HTTP ${response.status}`);
        throw new Error(`board topology update failed: ${detail}`);
      }

      return payload;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function restartNodeOnBoard(ip, options = {}, timeoutMs = 2500) {
    const normalizedIp = String(ip || '').trim();
    if (!normalizedIp) {
      throw new Error('board ip is required');
    }

    const body = new URLSearchParams();
    if (options.reason != null) body.set('reason', String(options.reason));
    if (options.delayMs != null) body.set('delayMs', String(options.delayMs));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(250, timeoutMs));
    try {
      const response = await fetch(`http://${normalizedIp}/node/restart`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: body.toString(),
        signal: controller.signal
      });

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '');

      if (!response.ok) {
        const detail = payload && typeof payload === 'object'
          ? (payload.error || payload.message || JSON.stringify(payload))
          : String(payload || `HTTP ${response.status}`);
        throw new Error(`board restart failed: ${detail}`);
      }

      return payload;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function requestBoard({
    protocol = 'http:',
    ip,
    port,
    path: requestPath,
    method = 'GET',
    headers = {},
    body = null,
    timeoutMs = 5000,
    insecureTls = true
  }) {
    const normalizedIp = String(ip || '').trim();
    if (!normalizedIp) throw new Error('board ip is required');
    const normalizedPath = String(requestPath || '/').trim() || '/';
    const normalizedProtocol = String(protocol || 'http:').trim().toLowerCase();
    const isHttps = normalizedProtocol === 'https:';
    const targetPort = Number(port || (isHttps ? 443 : 80));

    const payload = body == null ? null : (typeof body === 'string' ? body : String(body));
    const requestHeaders = { ...headers };
    if (payload != null && requestHeaders['content-length'] == null && requestHeaders['Content-Length'] == null) {
      requestHeaders['content-length'] = Buffer.byteLength(payload);
    }

    return await new Promise((resolve, reject) => {
      const client = isHttps ? https : http;
      const req = client.request({
        hostname: normalizedIp,
        port: targetPort,
        path: normalizedPath,
        method,
        headers: requestHeaders,
        rejectUnauthorized: isHttps ? !insecureTls : undefined,
      }, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          const contentType = String(res.headers['content-type'] || '').toLowerCase();
          let parsed = raw;
          if (contentType.includes('application/json')) {
            try {
              parsed = raw.length ? JSON.parse(raw) : {};
            } catch {
              parsed = raw;
            }
          }
          resolve({
            ok: Number(res.statusCode || 0) >= 200 && Number(res.statusCode || 0) < 300,
            status: Number(res.statusCode || 0),
            headers: res.headers,
            body: parsed,
            raw
          });
        });
      });

      req.setTimeout(Math.max(250, Number(timeoutMs || 0)), () => {
        req.destroy(new Error('request timed out'));
      });

      req.on('error', (error) => reject(error));

      if (payload != null) {
        req.write(payload);
      }
      req.end();
    });
  }

  async function requestBoardJson(options) {
    const response = await requestBoard(options);
    if (!response.ok) {
      const detail = typeof response.body === 'object'
        ? (response.body?.error || response.body?.message || JSON.stringify(response.body))
        : String(response.body || response.raw || `HTTP ${response.status}`);
      throw new Error(`${options?.method || 'GET'} ${options?.path || '/'} failed: ${detail}`);
    }
    return response.body;
  }

  function resolveProvisionTarget(req, nodes = []) {
    const requestedNodeId = String(req.params.nodeId || req.body?.nodeId || '').trim();
    const requestedIp = String(req.body?.ip || req.query?.ip || '').trim();
    const resolved = resolveManagedNode(requestedNodeId, requestedIp, nodes);
    if (!resolved.boardIp) {
      const err = new Error('target board ip not found');
      err.httpStatus = 404;
      throw err;
    }
    return {
      resolved,
      requestedNodeId,
      requestedIp,
      boardIp: resolved.boardIp
    };
  }

  async function uploadFileToBoard(ip, remotePath, content, timeoutMs = 5000) {
    const normalizedIp = String(ip || '').trim();
    const normalizedPath = String(remotePath || '').trim();
    if (!normalizedIp) throw new Error('board ip is required');
    if (!normalizedPath) throw new Error('remote path is required');

    const pathSegments = normalizedPath.split('/').filter(Boolean);
    const parentSegments = pathSegments.slice(0, -1);
    let parentPath = '';
    for (const segment of parentSegments) {
      parentPath += `/${segment}`;
      const createResponse = await fetch(`http://${normalizedIp}:4000/api/fileserver/ffs/create`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ path: parentPath, type: 'directory' })
      });
      if (!createResponse.ok && createResponse.status !== 409) {
        const createText = await createResponse.text().catch(() => '');
        throw new Error(`board directory create failed for ${parentPath}: ${createText || `HTTP ${createResponse.status}`}`);
      }
    }

    const body = JSON.stringify({
      path: normalizedPath,
      data: String(content || '')
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(250, timeoutMs));
    try {
      const response = await fetch(`http://${normalizedIp}:4000/api/fileserver/ffs/put`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body,
        signal: controller.signal
      });

      const payload = await response.text().catch(() => '');
      if (!response.ok) {
        throw new Error(`board upload failed for ${normalizedPath}: ${payload || `HTTP ${response.status}`}`);
      }
      return {
        ok: true,
        status: response.status,
        path: normalizedPath,
        response: payload
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function runLocalPmachineFallback({ fallbackPcodeText, fallbackProgramMapText, inputQueue, message, sourceLabel }) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'esp32-pmachine-'));
    const slug = String(sourceLabel || 'compute-node').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'compute-node';
    const pcodePath = path.join(tempDir, `${slug}.pcode`);
    const programMapPath = path.join(tempDir, `${slug}.program.json`);

    await fs.writeFile(pcodePath, `${fallbackPcodeText}\n`, 'utf-8');
    await fs.writeFile(programMapPath, `${fallbackProgramMapText}\n`, 'utf-8');

    const runnerPath = path.resolve(process.cwd(), 'scripts', 'run-js-pmachine.mjs');
    const stdout = await new Promise((resolve, reject) => {
      execFile(
        'node',
        [runnerPath, '--pcode', pcodePath, '--program-map', programMapPath, '--input-queue', inputQueue, '--message', message],
        { cwd: process.cwd(), maxBuffer: 1024 * 1024 },
        (error, childStdout, childStderr) => {
          if (error) {
            const details = String(childStderr || childStdout || error.message || '').trim();
            return reject(new Error(details || 'local pmachine execution failed'));
          }
          return resolve(String(childStdout || '').trim());
        }
      );
    });

    try {
      return JSON.parse(stdout);
    } catch {
      return {
        stdout: stdout ? [stdout] : [],
        rawOutput: stdout,
        fallback: true
      };
    }
  }

  async function executeProgramOnBoard(ip, program = {}, timeoutMs = 8000) {
    const normalizedIp = String(ip || '').trim();
    const file = String(program.file || '').trim();
    const programMap = String(program.programMap || '').trim();
    const inputQueue = String(program.inputQueue || 'default.in').trim();
    const message = String(program.message || '').trim();
    const fallbackPcodeText = String(program.fallbackPcodeText || '').trim();
    const fallbackProgramMapText = String(program.fallbackProgramMapText || '').trim();
    if (!normalizedIp) throw new Error('board ip is required');
    if (!file || !programMap) {
      throw new Error('program file and programMap are required');
    }

    const params = new URLSearchParams({
      file,
      programMap,
      inputQueue,
      message
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(250, timeoutMs));
    try {
      const response = await fetch(`http://${normalizedIp}/pmachine/pcode_router_run?${params.toString()}`, {
        method: 'GET',
        signal: controller.signal
      });

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '');

      if (!response.ok) {
        const detail = payload && typeof payload === 'object'
          ? (payload.error || payload.message || JSON.stringify(payload))
          : String(payload || `HTTP ${response.status}`);
        if (!fallbackPcodeText || !fallbackProgramMapText) {
          throw new Error(`board program execution failed: ${detail}`);
        }

        const localPayload = await runLocalPmachineFallback({
          fallbackPcodeText,
          fallbackProgramMapText,
          inputQueue,
          message,
          sourceLabel: path.basename(file, path.extname(file)) || 'compute-node'
        });

        return {
          ok: true,
          status: response.status,
          payload: localPayload,
          fallback: true,
          remoteError: detail
        };
      }

      return {
        ok: true,
        status: response.status,
        payload
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function attachHierarchyPaths(nodes) {
    const list = Array.isArray(nodes) ? nodes : [];
    const byKey = new Map();
    for (const node of list) {
      const key = String(node?.topology?.nodeKey || '').trim();
      if (key) byKey.set(key, node);
    }

    const cache = new Map();
    const computePath = (node, visiting = new Set()) => {
      const key = String(node?.topology?.nodeKey || '').trim();
      if (!key) return '';
      if (cache.has(key)) return cache.get(key);
      if (visiting.has(key)) return key;
      visiting.add(key);

      const parentKey = String(node?.topology?.parentNodeId || '').trim().toLowerCase();
      const selfToken = normalizeNodeId(node?.nodeName || node?.nodeId || node?.ip || key) || key;
      let pathValue = selfToken;
      if (parentKey) {
        const parent = byKey.get(parentKey) || null;
        if (parent) {
          const parentPath = computePath(parent, visiting);
          pathValue = parentPath ? `${parentPath}.${selfToken}` : selfToken;
        }
      }

      visiting.delete(key);
      cache.set(key, pathValue);
      return pathValue;
    };

    return list.map((node) => ({
      ...node,
      topology: {
        ...(node?.topology || {}),
        hierarchyPath: computePath(node)
      }
    }));
  }

  function resolveManagedNode(requestedNodeId, requestedIp, nodes = []) {
    const normalizedNodeId = normalizeNodeId(requestedNodeId);
    const normalizedIp = normalizeNodeId(requestedIp);
    const list = Array.isArray(nodes) ? nodes : [];
    const node = list.find((existing) => {
      const matches = [
        normalizeNodeId(existing?.nodeId),
        normalizeNodeId(existing?.id),
        normalizeNodeId(existing?.ip),
        normalizeNodeId(existing?.nodeName),
        normalizeNodeId(existing?.details?.nodeName)
      ].filter(Boolean);
      return (normalizedNodeId && matches.includes(normalizedNodeId))
        || (normalizedIp && matches.includes(normalizedIp));
    }) || null;

    const boardIp = String(requestedIp || node?.ip || '').trim();
    return {
      node,
      boardIp,
      targetKey: normalizedNodeId || normalizedIp || normalizeNodeId(node?.nodeId || node?.ip),
      normalizedNodeId,
      normalizedIp
    };
  }

  function hierarchyWouldCycle(nodes, targetKey, nextParentKey) {
    const normalizedTarget = normalizeNodeId(targetKey);
    let cursor = normalizeNodeId(nextParentKey);
    if (!normalizedTarget || !cursor) return false;

    const parentByAlias = new Map();
    for (const node of Array.isArray(nodes) ? nodes : []) {
      const parent = normalizeNodeId(node?.topology?.parentNodeId);
      for (const alias of getNodeIdentityCandidates(node)) {
        parentByAlias.set(alias, parent);
      }
      const topologyKey = normalizeNodeId(node?.topology?.nodeKey);
      if (topologyKey) parentByAlias.set(topologyKey, parent);
    }

    const visited = new Set();
    while (cursor) {
      if (cursor === normalizedTarget) return true;
      if (visited.has(cursor)) return true;
      visited.add(cursor);
      cursor = normalizeNodeId(parentByAlias.get(cursor));
    }
    return false;
  }

  app.get('/api/discover-primary', async (req, res) => {
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
    res.json({ services });
  });

  app.get('/api/nodes', async (req, res) => {
    res.json(attachHierarchyPaths(await buildCurrentNodesWithTopology()));
  });

  app.get('/api/sites', async (req, res) => {
    await ensureSiteRegistryLoaded();
    const nodes = await buildCurrentNodesWithTopology();
    const includeNodes = req.query.includeNodes === '1' || req.query.includeNodes === 'true';

    const nodeBuckets = new Map();
    for (const node of nodes) {
      const siteId = String(node?.topology?.siteId || 'primary-site').trim().toLowerCase() || 'primary-site';
      if (!nodeBuckets.has(siteId)) nodeBuckets.set(siteId, []);
      nodeBuckets.get(siteId).push({
        nodeId: String(node?.nodeId || node?.nodeName || node?.ip || '').trim(),
        nodeName: String(node?.nodeName || node?.nodeId || node?.ip || '').trim(),
        ip: String(node?.ip || '').trim(),
        clusterId: String(node?.topology?.activeClusterId || 'default').trim().toLowerCase() || 'default'
      });
    }

    const sites = Object.values(siteRegistry)
      .map((site) => {
        const siteId = String(site?.siteId || '').trim().toLowerCase();
        const members = nodeBuckets.get(siteId) || [];
        return {
          ...site,
          state: normalizeSiteState(site?.state || 'up') || 'up',
          nodeCount: members.length,
          ...(includeNodes ? { nodes: members } : {})
        };
      })
      .sort((a, b) => String(a.siteId || '').localeCompare(String(b.siteId || '')));

    return res.json({ sites });
  });

  app.post('/api/sites', async (req, res) => {
    await ensureSiteRegistryLoaded();

    const requestedSiteId = String(req.body?.siteId || req.body?.id || '').trim().toLowerCase();
    if (!requestedSiteId) {
      return res.status(400).json({ error: 'siteId is required' });
    }

    const previous = siteRegistry[requestedSiteId] || null;
    const normalized = normalizeSiteMetadata({ ...(req.body || {}), siteId: requestedSiteId }, {
      fallbackCategory: previous?.siteCategory || 'internal',
      fallbackMode: previous?.siteMode || SITE_MODE_DEFAULT
    });

    const next = {
      ...normalized,
      state: String(req.body?.state || previous?.state || 'up').trim().toLowerCase() || 'up',
      description: String(req.body?.description || previous?.description || '').trim() || null,
      createdAt: String(previous?.createdAt || new Date().toISOString()),
      updatedAt: new Date().toISOString()
    };

    siteRegistry[requestedSiteId] = next;
    await saveSiteRegistry(siteRegistry);
    return res.json({ status: 'ok', site: next });
  });

  app.delete('/api/sites/:siteId', async (req, res) => {
    await ensureSiteRegistryLoaded();
    const siteId = String(req.params.siteId || '').trim().toLowerCase();
    if (!siteId) return res.status(400).json({ error: 'siteId is required' });
    if (siteId === 'primary-site') {
      return res.status(400).json({ error: 'primary-site cannot be deleted' });
    }
    const existing = siteRegistry[siteId];
    if (!existing) return res.status(404).json({ error: 'site not found' });

    const nodes = await buildCurrentNodesWithTopology();
    const assigned = nodes.filter((node) => String(node?.topology?.siteId || '').trim().toLowerCase() === siteId);
    if (assigned.length > 0) {
      return res.status(409).json({
        error: 'site is currently assigned to nodes',
        nodeCount: assigned.length
      });
    }

    delete siteRegistry[siteId];
    await saveSiteRegistry(siteRegistry);
    return res.json({ status: 'ok', deletedSiteId: siteId });
  });

  app.post('/api/sites/:siteId/assign', async (req, res) => {
    await ensureSiteRegistryLoaded();
    await ensureNodeTopologyMapLoaded();

    const siteId = String(req.params.siteId || '').trim().toLowerCase();
    if (!siteId) return res.status(400).json({ error: 'siteId is required' });
    if (!siteRegistry[siteId]) {
      return res.status(404).json({ error: 'site not found' });
    }

    const requestedNodes = Array.isArray(req.body?.nodes) ? req.body.nodes : [];
    if (requestedNodes.length === 0) {
      return res.status(400).json({ error: 'nodes array is required' });
    }

    const nodes = await buildCurrentNodesWithTopology();
    const assigned = [];
    for (const token of requestedNodes) {
      const tokenValue = String(token || '').trim();
      const node = resolveNodeByAddressPath(tokenValue, nodes)
        || nodes.find((entry) => nodeMatchesAddressToken(entry, tokenValue))
        || null;
      if (!node) {
        return res.status(404).json({ error: `node not found: ${tokenValue}` });
      }
      const targetKey = normalizeNodeId(node?.nodeId || node?.nodeName || node?.ip);
      if (!targetKey) {
        return res.status(400).json({ error: `node id resolution failed for: ${tokenValue}` });
      }
      nodeTopologyMap[targetKey] = {
        ...(nodeTopologyMap[targetKey] || {}),
        siteId
      };
      assigned.push({ nodeId: targetKey, sourceToken: tokenValue });
    }

    await saveNodeTopologyMap(nodeTopologyMap);
    return res.json({
      status: 'ok',
      siteId,
      assignedCount: assigned.length,
      assigned
    });
  });

  app.post('/api/sites/:siteId/quiesce', async (req, res) => {
    await ensureSiteRegistryLoaded();
    const siteId = String(req.params.siteId || '').trim().toLowerCase();
    if (!siteId) return res.status(400).json({ error: 'siteId is required' });
    if (!siteRegistry[siteId]) return res.status(404).json({ error: 'site not found' });

    const nodes = await buildCurrentNodesWithTopology();
    const targetedNodes = nodes.filter((node) => String(node?.topology?.siteId || 'primary-site').trim().toLowerCase() === siteId);
    const changed = [];
    for (const node of targetedNodes) {
      const targetNodeId = String(node?.nodeId || node?.nodeName || node?.ip || '').trim();
      if (!targetNodeId) continue;
      const ok = typeof setNodeLifecycleState === 'function'
        ? setNodeLifecycleState(targetNodeId, 'quiesced')
        : false;
      if (ok) changed.push(targetNodeId);
    }

    siteRegistry[siteId] = {
      ...siteRegistry[siteId],
      state: 'quiesced',
      updatedAt: new Date().toISOString()
    };
    await saveSiteRegistry(siteRegistry);

    return res.json({
      status: 'ok',
      siteId,
      state: 'quiesced',
      targetedNodes: targetedNodes.map((node) => String(node?.nodeId || node?.nodeName || node?.ip || '').trim()).filter(Boolean),
      affectedNodes: changed,
      affectedCount: changed.length
    });
  });

  app.post('/api/sites/:siteId/start', async (req, res) => {
    await ensureSiteRegistryLoaded();
    const siteId = String(req.params.siteId || '').trim().toLowerCase();
    if (!siteId) return res.status(400).json({ error: 'siteId is required' });
    if (!siteRegistry[siteId]) return res.status(404).json({ error: 'site not found' });

    const nodes = await buildCurrentNodesWithTopology();
    const targetedNodes = nodes.filter((node) => String(node?.topology?.siteId || 'primary-site').trim().toLowerCase() === siteId);
    const changed = [];
    for (const node of targetedNodes) {
      const targetNodeId = String(node?.nodeId || node?.nodeName || node?.ip || '').trim();
      if (!targetNodeId) continue;
      const ok = typeof setNodeLifecycleState === 'function'
        ? setNodeLifecycleState(targetNodeId, 'up')
        : false;
      if (ok) changed.push(targetNodeId);
    }

    siteRegistry[siteId] = {
      ...siteRegistry[siteId],
      state: 'up',
      updatedAt: new Date().toISOString()
    };
    await saveSiteRegistry(siteRegistry);

    return res.json({
      status: 'ok',
      siteId,
      state: 'up',
      targetedNodes: targetedNodes.map((node) => String(node?.nodeId || node?.nodeName || node?.ip || '').trim()).filter(Boolean),
      affectedNodes: changed,
      affectedCount: changed.length
    });
  });

  app.get('/api/address/resolve/:address', async (req, res) => {
    const address = String(req.params.address || '').trim();
    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }

    const nodes = await buildCurrentNodesWithTopology();
    const node = resolveNodeByAddressPath(address, nodes);
    if (!node) {
      return res.status(404).json({ error: 'address not found', address });
    }

    const nodeNorm = normalizeNodeId(node.nodeId || node.nodeName || node.ip);
    const serviceInstances = Array.from(serviceInstanceRegistry.values())
      .filter((instance) => {
        const candidate = normalizeNodeId(instance.nodeId || instance.ip);
        return candidate && candidate === nodeNorm;
      })
      .map((instance) => ({
        serviceName: instance.serviceName,
        instanceId: instance.instanceId,
        status: instance.status,
        ip: instance.ip,
        port: instance.port,
        route: instance?.metadata?.route || null
      }));

    return res.json({
      address,
      resolved: {
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        ip: node.ip,
        topology: node.topology,
        services: Array.isArray(node?.details?.services) ? node.details.services : [],
        devices: Array.isArray(node?.details?.devices) ? node.details.devices : []
      },
      serviceInstances
    });
  });

  app.get('/api/clusters', async (req, res) => {
    await ensureClusterRegistryLoaded();
    const nodes = await buildCurrentNodesWithTopology();
    const effectiveRegistry = buildEffectiveClusterRegistry(nodes);
    const udpByClusterId = buildClusterUdpPortMap(effectiveRegistry);
    const clusters = Object.values(effectiveRegistry).map((cluster) => {
      const clusterId = String(cluster?.clusterId || '').trim().toLowerCase();
      const udp = udpByClusterId.get(clusterId) || null;
      return {
        ...cluster,
        udp: udp
          ? {
              parentPort: udp.parentPort,
              siblingPort: udp.siblingPort,
              listenPorts: [udp.parentPort, udp.siblingPort],
              upstreamPort: udp.parentPort
            }
          : null
      };
    });
    return res.json({ clusters });
  });

  app.post('/api/clusters', async (req, res) => {
    await ensureClusterRegistryLoaded();

    const clusterId = normalizeNodeId(req.body?.clusterId || req.body?.id);
    const label = String(req.body?.label || clusterId).trim() || clusterId;
    const requestedNodes = Array.isArray(req.body?.nodes) ? req.body.nodes : [];
    if (!clusterId) {
      return res.status(400).json({ error: 'clusterId is required' });
    }
    if (requestedNodes.length === 0) {
      return res.status(400).json({ error: 'nodes array is required' });
    }
    if (clusterId === FREE_POOL_CLUSTER_ID) {
      return res.status(400).json({ error: `${FREE_POOL_CLUSTER_ID} is managed automatically` });
    }
    if (isManagedFreePoolClusterId(clusterId)) {
      return res.status(400).json({ error: `${clusterId} is managed automatically` });
    }

    const nodes = await buildCurrentNodesWithTopology();
    const effectiveRegistry = buildEffectiveClusterRegistry(nodes);
    const freePoolEntries = Object.values(effectiveRegistry).filter((cluster) => isManagedFreePoolClusterId(cluster?.clusterId));
    const resolvedNodeIds = [];
    const nodeOrigins = {};
    for (const token of requestedNodes) {
      const node = resolveNodeByAddressPath(String(token || ''), nodes)
        || nodes.find((entry) => nodeMatchesAddressToken(entry, String(token || '')))
        || null;
      if (!node) {
        return res.status(404).json({ error: `node not found: ${token}` });
      }
      const normalizedNodeId = normalizeNodeId(node.nodeId || node.nodeName || node.ip);
      if (!normalizedNodeId) {
        return res.status(400).json({ error: `node id resolution failed for: ${token}` });
      }
      const sourcePool = freePoolEntries.find((pool) => (pool.nodes || []).includes(normalizedNodeId)) || null;
      if (!sourcePool) {
        return res.status(409).json({ error: `node is not currently available in a free pool: ${token}` });
      }
      resolvedNodeIds.push(normalizedNodeId);
      if (sourcePool.clusterId !== FREE_POOL_CLUSTER_ID) {
        nodeOrigins[normalizedNodeId] = sourcePool.clusterId;
      }
    }

    const previousCluster = clusterRegistry?.[clusterId] || null;
    const previousNodes = new Set(Array.isArray(previousCluster?.nodes) ? previousCluster.nodes : []);
    const nextNodes = new Set(Array.from(new Set(resolvedNodeIds)));
    const returnedNodes = Array.from(previousNodes).filter((nodeId) => !nextNodes.has(nodeId));
    const returnedToPools = returnedNodes.map((nodeId) => ({
      nodeId,
      poolId: String(previousCluster?.nodeOrigins?.[nodeId] || FREE_POOL_CLUSTER_ID)
    }));

    const now = new Date().toISOString();
    clusterRegistry[clusterId] = {
      clusterId,
      label,
      nodes: Array.from(new Set(resolvedNodeIds)),
      nodeOrigins,
      state: 'up',
      createdAt: clusterRegistry?.[clusterId]?.createdAt || now,
      updatedAt: now
    };
    delete clusterRegistry[FREE_POOL_CLUSTER_ID];
    delete clusterRegistry[FREE_POOL_JS_CLUSTER_ID];
    delete clusterRegistry[FREE_POOL_ESP_CLUSTER_ID];
    await saveClusterRegistry(clusterRegistry);

    const nodesAfter = await buildCurrentNodesWithTopology();
    const effectiveAfter = buildEffectiveClusterRegistry(nodesAfter);
    const udpByClusterId = buildClusterUdpPortMap(effectiveAfter);
    const clusterUdp = udpByClusterId.get(clusterId) || null;

    const topologyApplied = [];
    for (const nodeId of clusterRegistry[clusterId].nodes || []) {
      const result = await applyNodeTopologyAssignment(nodeId, {
        activeClusterId: clusterId,
        parentHost: '',
        parentNodeId: '',
        isClusterGateway: false,
        parentPort: clusterUdp?.parentPort,
        siblingPort: clusterUdp?.siblingPort
      }, nodesAfter);
      topologyApplied.push(result);
    }

    for (const returned of returnedToPools) {
      const poolId = normalizeNodeId(returned.poolId || FREE_POOL_CLUSTER_ID) || FREE_POOL_CLUSTER_ID;
      const poolUdp = udpByClusterId.get(poolId) || udpByClusterId.get(FREE_POOL_CLUSTER_ID) || null;
      const result = await applyNodeTopologyAssignment(returned.nodeId, {
        activeClusterId: poolId,
        parentHost: '',
        parentNodeId: '',
        isClusterGateway: false,
        parentPort: poolUdp?.parentPort,
        siblingPort: poolUdp?.siblingPort
      }, nodesAfter);
      topologyApplied.push(result);
    }

    return res.json({
      status: 'ok',
      cluster: clusterRegistry[clusterId],
      allocatedFromPools: Object.entries(nodeOrigins).map(([nodeId, poolId]) => ({ nodeId, poolId })),
      returnedToPools,
      topologyApplied
    });
  });

  app.delete('/api/clusters/:clusterId', async (req, res) => {
    await ensureClusterRegistryLoaded();
    const clusterId = normalizeNodeId(req.params.clusterId);
    if (!clusterId) return res.status(400).json({ error: 'clusterId is required' });
    if (isManagedFreePoolClusterId(clusterId)) {
      return res.status(400).json({ error: `${clusterId} is managed automatically` });
    }

    const existing = clusterRegistry[clusterId];
    if (!existing) {
      return res.status(404).json({ error: 'cluster not found' });
    }

    const releasedNodes = Array.isArray(existing.nodes) ? existing.nodes : [];
    const returnedToPools = releasedNodes.map((nodeId) => ({
      nodeId,
      poolId: String(existing?.nodeOrigins?.[nodeId] || FREE_POOL_CLUSTER_ID)
    }));

    delete clusterRegistry[clusterId];
    await saveClusterRegistry(clusterRegistry);

    const nodesAfter = await buildCurrentNodesWithTopology();
    const effectiveAfter = buildEffectiveClusterRegistry(nodesAfter);
    const udpByClusterId = buildClusterUdpPortMap(effectiveAfter);
    const topologyApplied = [];

    for (const returned of returnedToPools) {
      const poolId = normalizeNodeId(returned.poolId || FREE_POOL_CLUSTER_ID) || FREE_POOL_CLUSTER_ID;
      const poolUdp = udpByClusterId.get(poolId) || udpByClusterId.get(FREE_POOL_CLUSTER_ID) || null;
      const result = await applyNodeTopologyAssignment(returned.nodeId, {
        activeClusterId: poolId,
        parentHost: '',
        parentNodeId: '',
        isClusterGateway: false,
        parentPort: poolUdp?.parentPort,
        siblingPort: poolUdp?.siblingPort
      }, nodesAfter);
      topologyApplied.push(result);
    }

    return res.json({
      status: 'ok',
      deletedClusterId: clusterId,
      releasedNodeCount: releasedNodes.length,
      returnedToPools,
      topologyApplied
    });
  });

  app.post('/api/clusters/:clusterId/quiesce', async (req, res) => {
    await ensureClusterRegistryLoaded();
    const clusterId = normalizeNodeId(req.params.clusterId);
    const nodes = await buildCurrentNodesWithTopology();
    const effectiveRegistry = buildEffectiveClusterRegistry(nodes);
    const cluster = effectiveRegistry[clusterId];
    if (!cluster) return res.status(404).json({ error: 'cluster not found' });

    const targetedNodes = [];
    const changed = [];
    for (const nodeId of cluster.nodes || []) {
      const liveNode = nodes.find((entry) => normalizeNodeId(entry.nodeId || entry.nodeName || entry.ip) === nodeId) || null;
      const targetNodeId = String(liveNode?.nodeId || nodeId).trim();
      targetedNodes.push(targetNodeId);
      const ok = typeof setNodeLifecycleState === 'function'
        ? setNodeLifecycleState(targetNodeId, 'quiesced')
        : false;
      if (ok) changed.push(targetNodeId);
    }

    if (clusterId !== FREE_POOL_CLUSTER_ID && clusterRegistry[clusterId]) {
      clusterRegistry[clusterId].state = 'quiesced';
      clusterRegistry[clusterId].updatedAt = new Date().toISOString();
      await saveClusterRegistry(clusterRegistry);
    }
    return res.json({
      status: 'ok',
      clusterId,
      state: 'quiesced',
      targetedNodes: Array.from(new Set(targetedNodes)),
      affectedNodes: changed,
      affectedCount: changed.length
    });
  });

  app.post('/api/clusters/:clusterId/start', async (req, res) => {
    await ensureClusterRegistryLoaded();
    const clusterId = normalizeNodeId(req.params.clusterId);
    const nodes = await buildCurrentNodesWithTopology();
    const effectiveRegistry = buildEffectiveClusterRegistry(nodes);
    const cluster = effectiveRegistry[clusterId];
    if (!cluster) return res.status(404).json({ error: 'cluster not found' });

    const targetedNodes = [];
    const changed = [];
    for (const nodeId of cluster.nodes || []) {
      const liveNode = nodes.find((entry) => normalizeNodeId(entry.nodeId || entry.nodeName || entry.ip) === nodeId) || null;
      const targetNodeId = String(liveNode?.nodeId || nodeId).trim();
      targetedNodes.push(targetNodeId);
      const ok = typeof setNodeLifecycleState === 'function'
        ? setNodeLifecycleState(targetNodeId, 'up')
        : false;
      if (ok) changed.push(targetNodeId);
    }

    if (clusterId !== FREE_POOL_CLUSTER_ID && clusterRegistry[clusterId]) {
      clusterRegistry[clusterId].state = 'up';
      clusterRegistry[clusterId].updatedAt = new Date().toISOString();
      await saveClusterRegistry(clusterRegistry);
    }
    return res.json({
      status: 'ok',
      clusterId,
      state: 'up',
      targetedNodes: Array.from(new Set(targetedNodes)),
      affectedNodes: changed,
      affectedCount: changed.length
    });
  });

  app.get('/api/clusters/:clusterId/announce', async (req, res) => {
    await ensureClusterRegistryLoaded();
    const clusterId = normalizeNodeId(req.params.clusterId);
    const nodes = await buildCurrentNodesWithTopology();
    const effectiveRegistry = buildEffectiveClusterRegistry(nodes);
    const cluster = effectiveRegistry[clusterId];
    if (!cluster) return res.status(404).json({ error: 'cluster not found' });

    const memberNodes = nodes.filter((node) => {
      const normalized = normalizeNodeId(node.nodeId || node.nodeName || node.ip);
      return (cluster.nodes || []).includes(normalized);
    });

    const servicesOut = [];
    const devicesOut = [];
    for (const node of memberNodes) {
      const nodeServices = Array.isArray(node?.details?.services) ? node.details.services : [];
      const nodeDevices = Array.isArray(node?.details?.devices) ? node.details.devices : [];

      for (const service of nodeServices) {
        servicesOut.push({ nodeId: node.nodeId, nodeName: node.nodeName, service });
      }
      for (const device of nodeDevices) {
        devicesOut.push({ nodeId: node.nodeId, nodeName: node.nodeName, device });
      }
    }

    return res.json({
      clusterId,
      label: cluster.label,
      state: cluster.state,
      members: memberNodes.map((node) => ({
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        ip: node.ip,
        topology: node.topology
      })),
      services: servicesOut,
      devices: devicesOut,
      announcedAt: new Date().toISOString()
    });
  });

  app.post('/api/nodes/:nodeId/rename', async (req, res) => {
    try {
      const requestedNodeId = String(req.params.nodeId || req.body?.nodeId || '').trim();
      const requestedIp = String(req.body?.ip || '').trim();
      const nextName = String(req.body?.nodeName || '').trim();

      if (!requestedNodeId && !requestedIp) {
        return res.status(400).json({ error: 'nodeId or ip is required' });
      }
      if (!nextName) {
        return res.status(400).json({ error: 'nodeName is required' });
      }
      return res.json(await renameNodeByIdentity(requestedNodeId, requestedIp, nextName));
    } catch (error) {
      const status = Number(error?.httpStatus || 500);
      return res.status(status).json({ error: error?.message || 'failed to rename node' });
    }
  });

  app.post('/api/nodes/:nodeId/name', async (req, res) => {
    try {
      const requestedNodeId = String(req.params.nodeId || req.body?.nodeId || '').trim();
      const requestedIp = String(req.body?.ip || '').trim();
      const nextName = String(req.body?.nodeName || req.body?.name || '').trim();

      if (!requestedNodeId && !requestedIp) {
        return res.status(400).json({ error: 'nodeId or ip is required' });
      }
      if (!nextName) {
        return res.status(400).json({ error: 'nodeName is required' });
      }

      return res.json(await renameNodeByIdentity(requestedNodeId, requestedIp, nextName));
    } catch (error) {
      const status = Number(error?.httpStatus || 500);
      return res.status(status).json({ error: error?.message || 'failed to set node name' });
    }
  });

  app.post('/api/nodes/:nodeId/topology', async (req, res) => {
    try {
      await ensureNodeTopologyMapLoaded();
      await ensureSiteRegistryLoaded();
      const nodes = await buildCurrentNodesWithTopology();

      const requestedNodeId = String(req.params.nodeId || req.body?.nodeId || '').trim();
      const requestedIp = String(req.body?.ip || '').trim();
      const normalizedNodeId = normalizeNodeId(requestedNodeId);
      const normalizedIp = normalizeNodeId(requestedIp);
      const targetKey = normalizedNodeId || normalizedIp;

      if (!targetKey) {
        return res.status(400).json({ error: 'nodeId or ip is required' });
      }

      const nextParentRaw = req.body?.parentNodeId;
      const nextParent = normalizeNodeId(nextParentRaw);
      if (nextParent && nextParent === targetKey) {
        return res.status(400).json({ error: 'node cannot be its own parent' });
      }
      if (hierarchyWouldCycle(nodes, targetKey, nextParent)) {
        return res.status(409).json({ error: 'parent assignment would create a hierarchy cycle' });
      }

      const nextGateway = req.body?.isClusterGateway === true;
      const requestedSiteId = String(req.body?.siteId || '').trim().toLowerCase();
      const resolvedCurrentSiteId = normalizeNodeId(nodeTopologyMap[targetKey]?.siteId) || 'primary-site';
      const nextSiteId = requestedSiteId || resolvedCurrentSiteId;
      if (nextSiteId && !siteRegistry[nextSiteId]) {
        return res.status(400).json({ error: `unknown siteId: ${nextSiteId}` });
      }
      let boardIp = requestedIp;
      if (!boardIp) {
        for (const existing of discoveredNodes.values()) {
          const matches = [
            normalizeNodeId(existing?.nodeId),
            normalizeNodeId(existing?.id),
            normalizeNodeId(existing?.ip)
          ].filter(Boolean);
          if (normalizedNodeId && matches.includes(normalizedNodeId)) {
            boardIp = String(existing?.ip || '').trim();
            break;
          }
        }
      }

      let boardTopologyApplied = false;
      if (boardIp) {
        try {
          await persistNodeTopologyOnBoard(boardIp, {
            activeClusterId: req.body?.activeClusterId || 'default',
            parentHost: req.body?.parentHost || '',
            parentNodeId: nextParent || '',
            isClusterGateway: nextGateway,
            parentPort: req.body?.parentPort,
            siblingPort: req.body?.siblingPort
          });
          boardTopologyApplied = true;
        } catch (error) {
          const message = String(error?.message || '').toLowerCase();
          const canFallback = message.includes('not found') || message.includes('404');
          if (!canFallback) throw error;
        }
      }

      nodeTopologyMap[targetKey] = {
        parentNodeId: nextParent || '',
        isClusterGateway: nextGateway,
        activeClusterId: String(req.body?.activeClusterId || 'default').trim().toLowerCase(),
        parentHost: String(req.body?.parentHost || '').trim(),
        parentPort: Number(req.body?.parentPort || 0) || undefined,
        siblingPort: Number(req.body?.siblingPort || 0) || undefined,
        pendingBoardSync: !boardTopologyApplied,
        siteId: nextSiteId,
        ...normalizeSiteMetadata({ ...(req.body || {}), siteId: nextSiteId })
      };
      await saveNodeTopologyMap(nodeTopologyMap);

      const site = normalizeSiteMetadata({ ...(siteRegistry[nextSiteId] || {}), ...(req.body || {}), siteId: nextSiteId });

      return res.json({
        status: 'ok',
        nodeId: requestedNodeId || requestedIp,
        topology: {
          parentNodeId: nextParent || '',
          isClusterGateway: nextGateway,
          site,
          siteId: site.siteId,
          siteName: site.siteName,
          siteCategory: site.siteCategory,
          siteMode: site.siteMode,
          isExternalSite: site.isExternalSite
        },
        sourceOfTruth: boardTopologyApplied ? 'board' : 'server'
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'failed to update node topology' });
    }
  });

  app.post('/api/nodes/:nodeId/parent', async (req, res) => {
    try {
      await ensureNodeTopologyMapLoaded();
      await ensureSiteRegistryLoaded();
      const requestedNodeId = String(req.params.nodeId || req.body?.nodeId || '').trim();
      const requestedIp = String(req.body?.ip || '').trim();
      const nodes = await buildCurrentNodesWithTopology();
      const resolved = resolveManagedNode(requestedNodeId, requestedIp, nodes);

      if (!resolved.targetKey) {
        return res.status(400).json({ error: 'nodeId or ip is required' });
      }

      let nextParent = normalizeNodeId(req.body?.parentNodeId);
      if (!nextParent && req.body?.parentAddress) {
        const parentNode = resolveNodeByAddressPath(String(req.body.parentAddress || '').trim(), nodes);
        nextParent = normalizeNodeId(parentNode?.nodeId || parentNode?.nodeName || parentNode?.ip);
      }
      if (nextParent && nextParent === resolved.targetKey) {
        return res.status(400).json({ error: 'node cannot be its own parent' });
      }
      if (hierarchyWouldCycle(nodes, resolved.targetKey, nextParent)) {
        return res.status(409).json({ error: 'parent assignment would create a hierarchy cycle' });
      }

      const nextGateway = req.body?.isClusterGateway === true;
      const nextClusterId = String(req.body?.activeClusterId || resolved.node?.topology?.activeClusterId || 'default').trim().toLowerCase() || 'default';
      const resolvedTargetKey = resolved.targetKey;
      const requestedSiteId = String(req.body?.siteId || '').trim().toLowerCase();
      const currentSiteId = normalizeNodeId(nodeTopologyMap[resolvedTargetKey]?.siteId)
        || normalizeNodeId(resolved.node?.topology?.siteId)
        || 'primary-site';
      const nextSiteId = requestedSiteId || currentSiteId;
      if (nextSiteId && !siteRegistry[nextSiteId]) {
        return res.status(400).json({ error: `unknown siteId: ${nextSiteId}` });
      }
      let boardTopologyApplied = false;
      if (resolved.boardIp) {
        try {
          await persistNodeTopologyOnBoard(resolved.boardIp, {
            activeClusterId: nextClusterId,
            parentHost: String(req.body?.parentHost || '').trim(),
            parentNodeId: nextParent || '',
            isClusterGateway: nextGateway,
            parentPort: req.body?.parentPort,
            siblingPort: req.body?.siblingPort
          });
          boardTopologyApplied = true;
        } catch (error) {
          const message = String(error?.message || '').toLowerCase();
          const canFallback = message.includes('not found') || message.includes('404');
          if (!canFallback) throw error;
        }
      }

      nodeTopologyMap[resolved.targetKey] = {
        parentNodeId: nextParent || '',
        isClusterGateway: nextGateway,
        activeClusterId: nextClusterId,
        parentHost: String(req.body?.parentHost || '').trim(),
        parentPort: Number(req.body?.parentPort || 0) || undefined,
        siblingPort: Number(req.body?.siblingPort || 0) || undefined,
        pendingBoardSync: !boardTopologyApplied,
        siteId: nextSiteId,
        ...normalizeSiteMetadata({ ...(req.body || {}), siteId: nextSiteId })
      };
      await saveNodeTopologyMap(nodeTopologyMap);

      const site = normalizeSiteMetadata({ ...(siteRegistry[nextSiteId] || {}), ...(req.body || {}), siteId: nextSiteId });

      return res.json({
        status: 'ok',
        nodeId: requestedNodeId || requestedIp,
        topology: {
          activeClusterId: nextClusterId,
          parentNodeId: nextParent || '',
          isClusterGateway: nextGateway,
          site,
          siteId: site.siteId,
          siteName: site.siteName,
          siteCategory: site.siteCategory,
          siteMode: site.siteMode,
          isExternalSite: site.isExternalSite
        },
        sourceOfTruth: boardTopologyApplied ? 'board' : 'server'
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'failed to move node under parent' });
    }
  });

  app.post('/api/nodes/:nodeId/restart', async (req, res) => {
    try {
      const requestedNodeId = String(req.params.nodeId || req.body?.nodeId || '').trim();
      const requestedIp = String(req.body?.ip || '').trim();
      const nodes = await buildCurrentNodesWithTopology();
      const resolved = resolveManagedNode(requestedNodeId, requestedIp, nodes);
      if (!resolved.boardIp) {
        return res.status(404).json({ error: 'target board ip not found for restart' });
      }

      const restart = await restartNodeOnBoard(resolved.boardIp, {
        reason: req.body?.reason || 'api-request',
        delayMs: req.body?.delayMs
      });
      return res.json({
        status: 'ok',
        nodeId: requestedNodeId || requestedIp,
        ip: resolved.boardIp,
        restart
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'failed to restart node' });
    }
  });

  app.get('/api/nodes/:nodeId/wifi/profiles', async (req, res) => {
    try {
      const nodes = await buildCurrentNodesWithTopology();
      const { boardIp, requestedNodeId, requestedIp } = resolveProvisionTarget(req, nodes);
      const profiles = await requestBoardJson({
        protocol: 'http:',
        ip: boardIp,
        path: '/api/wifi/profiles',
        method: 'GET',
        timeoutMs: 5000
      });

      return res.json({
        status: 'ok',
        nodeId: requestedNodeId || requestedIp || boardIp,
        ip: boardIp,
        profiles
      });
    } catch (error) {
      const status = Number(error?.httpStatus || 500);
      return res.status(status).json({ error: error?.message || 'failed to fetch wifi profiles' });
    }
  });

  app.delete('/api/nodes/:nodeId/wifi/profiles', async (req, res) => {
    try {
      const nodes = await buildCurrentNodesWithTopology();
      const { boardIp, requestedNodeId, requestedIp } = resolveProvisionTarget(req, nodes);

      const cleared = await requestBoard({
        protocol: 'http:',
        ip: boardIp,
        path: '/api/wifi/profiles',
        method: 'DELETE',
        timeoutMs: 5000
      });

      if (!cleared.ok) {
        return res.status(502).json({
          error: 'board profile clear failed',
          nodeId: requestedNodeId || requestedIp || boardIp,
          ip: boardIp,
          status: cleared.status,
          response: cleared.body
        });
      }

      return res.json({
        status: 'ok',
        nodeId: requestedNodeId || requestedIp || boardIp,
        ip: boardIp,
        result: cleared.body
      });
    } catch (error) {
      const status = Number(error?.httpStatus || 500);
      return res.status(status).json({ error: error?.message || 'failed to clear wifi profiles' });
    }
  });

  app.post('/api/nodes/:nodeId/provision/wifi', async (req, res) => {
    try {
      const nodes = await buildCurrentNodesWithTopology();
      const { boardIp, requestedNodeId, requestedIp } = resolveProvisionTarget(req, nodes);

      const profilesRaw = Array.isArray(req.body?.profiles) ? req.body.profiles : [];
      const profiles = profilesRaw
        .map((item) => ({
          ssid: String(item?.ssid || '').trim(),
          password: String(item?.password || ''),
          authMode: String(item?.authMode || '').trim().toLowerCase() || 'wpa2-psk',
          eapMethod: String(item?.eapMethod || '').trim(),
          identity: String(item?.identity || '').trim(),
          username: String(item?.username || '').trim(),
          enterprisePassword: String(item?.enterprisePassword || ''),
          hostname: String(item?.hostname || '').trim(),
          dhcp: item?.dhcp !== false,
          staticIP: String(item?.staticIP || '').trim(),
          gateway: String(item?.gateway || '').trim(),
          subnet: String(item?.subnet || '').trim(),
          dns1: String(item?.dns1 || '').trim(),
          dns2: String(item?.dns2 || '').trim(),
        }))
        .filter((item) => item.ssid.length > 0)
        .slice(0, 5);

      if (profiles.length === 0) {
        return res.status(400).json({ error: 'profiles array with at least one ssid is required' });
      }

      for (let i = 0; i < profiles.length; i += 1) {
        const profile = profiles[i];
        if (profile.authMode === 'wpa2-enterprise') {
          const identity = profile.identity || profile.username;
          const username = profile.username || profile.identity;
          const enterprisePassword = profile.enterprisePassword || profile.password;
          if (!identity || !username || !enterprisePassword) {
            return res.status(400).json({
              error: `enterprise profile at index ${i} requires identity/username/password`
            });
          }
        }
      }

      const nodeName = String(req.body?.nodeName || '').trim();
      const replaceExisting = req.body?.replaceExisting !== false;
      const rebootAfter = req.body?.rebootAfter !== false;

      const actions = [];
      if (replaceExisting) {
        const clearResult = await requestBoard({
          protocol: 'http:',
          ip: boardIp,
          path: '/api/wifi/profiles',
          method: 'DELETE',
          timeoutMs: 5000
        });
        actions.push({ action: 'clearProfiles', ok: clearResult.ok, status: clearResult.status, response: clearResult.body });
      }

      for (let i = 0; i < profiles.length; i += 1) {
        const profile = profiles[i];
        const params = new URLSearchParams();
        params.set('ssid', profile.ssid);
        params.set('password', profile.password);
        params.set('authMode', profile.authMode);
        if (profile.eapMethod) params.set('eapMethod', profile.eapMethod);
        if (profile.identity) params.set('identity', profile.identity);
        if (profile.username) params.set('username', profile.username);
        if (profile.enterprisePassword) params.set('enterprisePassword', profile.enterprisePassword);
        if (profile.hostname) params.set('hostname', profile.hostname);
        if (nodeName) params.set('nodeName', nodeName);
        params.set('dhcp', profile.dhcp ? 'true' : 'false');
        if (!profile.dhcp) {
          if (profile.staticIP) params.set('staticIP', profile.staticIP);
          if (profile.gateway) params.set('gateway', profile.gateway);
          if (profile.subnet) params.set('subnet', profile.subnet);
          if (profile.dns1) params.set('dns1', profile.dns1);
          if (profile.dns2) params.set('dns2', profile.dns2);
        }
        params.set('reboot', rebootAfter && i === profiles.length - 1 ? 'true' : 'false');

        const provisionResult = await requestBoard({
          protocol: 'http:',
          ip: boardIp,
          path: '/api/wifi/provision',
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
          timeoutMs: 8000
        });

        actions.push({
          action: 'upsertProfile',
          profileIndex: i,
          ssid: profile.ssid,
          ok: provisionResult.ok,
          status: provisionResult.status,
          response: provisionResult.body
        });

        if (!provisionResult.ok) {
          return res.status(502).json({
            error: 'board provisioning failed',
            nodeId: requestedNodeId || requestedIp || boardIp,
            ip: boardIp,
            actions
          });
        }
      }

      return res.json({
        status: 'ok',
        nodeId: requestedNodeId || requestedIp || boardIp,
        ip: boardIp,
        profilesApplied: profiles.length,
        rebootAfter,
        actions
      });
    } catch (error) {
      const status = Number(error?.httpStatus || 500);
      return res.status(status).json({ error: error?.message || 'failed to provision wifi profiles' });
    }
  });

  app.get('/api/nodes/:nodeId/tls/status', async (req, res) => {
    try {
      const nodes = await buildCurrentNodesWithTopology();
      const { boardIp, requestedNodeId, requestedIp } = resolveProvisionTarget(req, nodes);
      const strictTls = req.query?.strictTls === '1' || req.query?.strictTls === 'true';
      const statusPayload = await requestBoardJson({
        protocol: 'https:',
        ip: boardIp,
        path: '/tls/status',
        method: 'GET',
        insecureTls: !strictTls,
        timeoutMs: 7000
      });
      return res.json({
        status: 'ok',
        nodeId: requestedNodeId || requestedIp || boardIp,
        ip: boardIp,
        tls: statusPayload
      });
    } catch (error) {
      const status = Number(error?.httpStatus || 500);
      return res.status(status).json({ error: error?.message || 'failed to read tls status' });
    }
  });

  app.post('/api/nodes/:nodeId/tls/enroll/commit', async (req, res) => {
    try {
      const nodes = await buildCurrentNodesWithTopology();
      const { boardIp, requestedNodeId, requestedIp } = resolveProvisionTarget(req, nodes);

      const bootstrapSecret = String(req.body?.bootstrapSecret || '').trim();
      const certPem = String(req.body?.certPem || '').trim();
      const keyPem = String(req.body?.keyPem || '').trim();
      const caPem = String(req.body?.caPem || '').trim();
      const requireMtls = req.body?.requireMtls === true;
      const strictTls = req.body?.strictTls === true;

      if (!bootstrapSecret) {
        return res.status(400).json({ error: 'bootstrapSecret is required' });
      }
      if (!certPem || !keyPem) {
        return res.status(400).json({ error: 'certPem and keyPem are required' });
      }

      const startPayload = await requestBoardJson({
        protocol: 'https:',
        ip: boardIp,
        path: '/tls/enroll/start',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bootstrapSecret }),
        insecureTls: !strictTls,
        timeoutMs: 8000
      });

      const sessionId = String(startPayload?.sessionId || '').trim();
      if (!sessionId) {
        return res.status(502).json({ error: 'missing sessionId from /tls/enroll/start', start: startPayload });
      }

      const commitPayload = await requestBoardJson({
        protocol: 'https:',
        ip: boardIp,
        path: '/tls/enroll/commit',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          certPem,
          keyPem,
          caPem,
          requireMtls
        }),
        insecureTls: !strictTls,
        timeoutMs: 10000
      });

      return res.json({
        status: 'ok',
        nodeId: requestedNodeId || requestedIp || boardIp,
        ip: boardIp,
        start: startPayload,
        commit: commitPayload
      });
    } catch (error) {
      const status = Number(error?.httpStatus || 500);
      return res.status(status).json({ error: error?.message || 'failed to complete tls enrollment commit' });
    }
  });

  app.post('/api/pmachine/announce', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const ip = String(body.ip || req.ip || '').replace('::ffff:', '').trim();
    const nodeId = String(body.nodeId || body.nodeName || ip || '').trim();
    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId (or nodeName/ip) is required' });
    }

    const now = Date.now();
    const key = ip || nodeId;
    const previous = discoveredNodes.get(key) || {};
    const servicesList = Array.isArray(body.services) ? body.services : [];
    const normalizedServices = servicesList
      .map((svc) => {
        if (!svc || typeof svc !== 'object') return null;
        const name = String(svc.name || svc.serviceName || '').trim();
        if (!name) return null;
        return {
          name,
          endpoint: String(svc.endpoint || '/pmachine/service').trim(),
          status: String(svc.status || 'up').trim().toLowerCase(),
          metadata: svc.metadata && typeof svc.metadata === 'object' ? svc.metadata : {}
        };
      })
      .filter(Boolean);

    const nextNode = {
      ...previous,
      id: String(body.id || previous.id || key).trim(),
      nodeId,
      nodeName: String(body.nodeName || previous.nodeName || nodeId).trim(),
      ip: ip || previous.ip || nodeId,
      port: Number(body.port || previous.port || 80),
      serviceName: 'pmachine',
      kind: 'machineAvailability',
      source: body.source || previous.source || 'pmachine-announce',
      status: String(body.status || previous.status || 'available').trim(),
      available: body.available !== false,
      draining: Boolean(body.draining),
      lastSeen: now,
      ts: now,
      availability: {
        available: body.available !== false,
        draining: Boolean(body.draining),
        status: String(body.status || 'available')
      },
      details: {
        ...(previous.details || {}),
        hardware: String(body.hardware || previous?.details?.hardware || 'ESP32').trim(),
        runtime: String(body.runtime || previous?.details?.runtime || 'pmachine').trim(),
        services: normalizedServices,
        capabilities: Array.isArray(body.capabilities) ? body.capabilities : (previous?.details?.capabilities || [])
      },
      raw: JSON.stringify(body)
    };
    discoveredNodes.set(key, nextNode);

    for (const svc of normalizedServices) {
      upsertServiceInstance({
        serviceName: svc.name,
        instanceId: `${svc.name}:${nodeId}:${nextNode.port}`,
        nodeId,
        ip: nextNode.ip,
        port: nextNode.port,
        status: svc.status || 'up',
        metadata: {
          ...(svc.metadata || {}),
          route: svc.endpoint,
          hardware: nextNode.details.hardware,
          runtime: nextNode.details.runtime
        }
      });
    }

    res.json({
      status: 'ok',
      node: {
        nodeId: nextNode.nodeId,
        ip: nextNode.ip,
        port: nextNode.port,
        services: normalizedServices.map((svc) => svc.name)
      }
    });
  });

  app.get('/api/pmachine/services', (req, res) => {
    res.json({
      updatedAt: new Date().toISOString(),
      services: listServiceDirectory()
    });
  });

  app.post('/api/pmachine/route/:serviceName', async (req, res) => {
    try {
      const serviceName = String(req.params.serviceName || '').trim();
      if (!serviceName) return res.status(400).json({ error: 'serviceName is required' });

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const preferredNodeId = String(body.nodeId || '').trim();
      const proxy = body.proxy === true;
      const allocatorMode = String(body.allocatorMode || 'shadow').trim().toLowerCase();
      const slaClass = String(body.slaClass || '').trim();
      const policyId = String(body.policyId || resolvePolicyIdFromSlaClass(slaClass)).trim();
      const requiredCapability = String(body.requiredCapability || '').trim();
      const requiredFailureDomain = String(body.requiredFailureDomain || '').trim();
      const requireDistinctFailureDomain = body?.placementPolicy?.requireDistinctFailureDomain === true;
      const forbiddenFailureDomains = new Set(
        (Array.isArray(body.forbiddenFailureDomains) ? body.forbiddenFailureDomains : [])
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      );

      const currentNodes = await buildCurrentNodesWithTopology();
      const activeInstances = listActiveServiceInstances(serviceName, currentNodes);
      const deploymentCandidates = listDeploymentBackedServiceCandidates(serviceName, currentNodes);
      const candidateInstances = activeInstances.length > 0 ? activeInstances : deploymentCandidates;

      if (candidateInstances.length === 0) {
        return res.status(404).json({ error: `No active or resident deployment candidate for service ${serviceName}` });
      }

      const constrainedInstances = activeInstances.filter((instance) => {
        const domain = String(instance.metadata?.failureDomain || instance.nodeId || instance.ip || 'default');
        if (requiredFailureDomain && domain !== requiredFailureDomain) return false;
        if (forbiddenFailureDomains.size === 0) return true;
        return !forbiddenFailureDomains.has(domain);
      });
      const constrainedCandidates = constrainedInstances.length > 0
        ? constrainedInstances
        : candidateInstances.filter((instance) => {
            const domain = String(instance.metadata?.failureDomain || instance.nodeId || instance.ip || 'default');
            if (requiredFailureDomain && domain !== requiredFailureDomain) return false;
            if (forbiddenFailureDomains.size === 0) return true;
            return !forbiddenFailureDomains.has(domain);
          });

      const allocatorJob = {
        requiredService: serviceName,
        requiredCapability: requiredCapability || null,
        sla: {
          minSuccessProb: body?.sla?.minSuccessProb
        },
        placementPolicy: {
          minReplicas: Number(body?.placementPolicy?.minReplicas || 1)
        }
      };

      const allocatorResult = allocateJob(
        allocatorJob,
        constrainedCandidates.map(toAllocatorCandidate),
        {
          policyId,
          weights: body.weights || null
        }
      );

      const allocatorTop = allocatorResult?.decision?.[0] || null;
      const acceptedCandidates = allocatorResult.scored.candidates.filter((entry) => entry.accepted);
      const acceptedDomains = new Set(acceptedCandidates.map((entry) => String(entry.failureDomain || 'default')));
      const requiredReplicas = Math.max(1, Number(body?.placementPolicy?.minReplicas || 1));
      const distinctDomainConstraintMet = !requireDistinctFailureDomain || acceptedDomains.size >= requiredReplicas;

      if (allocatorMode === 'enforce' && !distinctDomainConstraintMet) {
        return res.status(409).json({
          error: 'Distinct failure-domain constraint cannot be satisfied',
          requiredReplicas,
          availableDistinctDomains: acceptedDomains.size
        });
      }

      const allocatorSelectedInstance = allocatorTop
        ? constrainedCandidates.find((instance) => String(instance.instanceId || `${instance.serviceName}:${instance.nodeId || instance.ip || 'unknown'}`) === allocatorTop.id)
        : null;

      let selected = preferredNodeId
        ? (chooseServiceInstanceByNodeWithNodes(serviceName, preferredNodeId, currentNodes) || chooseCandidateByNode(candidateInstances, preferredNodeId))
        : null;

      if (!selected) {
        if (allocatorMode === 'enforce' && allocatorSelectedInstance) {
          selected = allocatorSelectedInstance;
        } else {
          selected = resolveServiceInstance(serviceName) || constrainedCandidates[0] || candidateInstances[0] || null;
        }
      }
      if (!selected) {
        return res.status(404).json({ error: `No active instance for service ${serviceName}` });
      }

      const fallbackReason = preferredNodeId
        ? 'preferred-node-id'
        : (allocatorMode === 'enforce'
            ? 'allocator-no-decision-fallback-resolver'
            : 'resolver-default');

      const effectiveMode = allocatorMode === 'enforce' ? 'enforce' : 'shadow';

      void appendAllocatorDecisionLog({
        ts: new Date().toISOString(),
        route: '/api/pmachine/route/:serviceName',
        serviceName,
        mode: effectiveMode,
        policyId,
        slaClass: slaClass || null,
        requiredCapability: requiredCapability || null,
        preferredNodeId: preferredNodeId || null,
        selected: {
          instanceId: selected.instanceId,
          nodeId: selected.nodeId,
          ip: selected.ip,
          source: preferredNodeId
            ? 'preferred-node'
            : (effectiveMode === 'enforce' && allocatorSelectedInstance ? 'allocator' : 'resolver')
        },
        fallbackReason,
        allocator: {
          acceptedCandidates: allocatorResult.scored.candidates.filter((entry) => entry.accepted).length,
          acceptedDistinctFailureDomains: acceptedDomains.size,
          requiredReplicas,
          requireDistinctFailureDomain,
          topDecision: allocatorTop
            ? {
                id: allocatorTop.id,
                score: allocatorTop.score,
                failureDomain: allocatorTop.failureDomain,
                successProb: allocatorTop.successProb
              }
            : null,
          topScored: allocatorResult.scored.candidates.slice(0, 5).map((entry) => ({
            id: entry.id,
            accepted: entry.accepted,
            score: entry.score,
            failureDomain: entry.failureDomain,
            reasons: entry.reasons
          }))
        }
      }).catch(() => {
        // Non-blocking decision log persistence.
      });

      const deployment = getDeploymentForService(serviceName, selected.nodeId || selected.ip);
      const responsePayload = {
        status: 'ok',
        selected: {
          instanceId: selected.instanceId,
          deploymentName: getDeploymentName(deployment) || selected.serviceName,
          deploymentId: getDeploymentId(deployment) || null,
          serviceName: selected.serviceName,
          nodeId: selected.nodeId,
          ip: selected.ip,
          port: selected.port,
          metadata: selected.metadata || {},
          lastHeartbeat: selected.lastHeartbeat
        },
        deployment: deployment || null,
        allocator: {
          mode: effectiveMode,
          policyId,
          slaClass: slaClass || null,
          recommended: allocatorTop
            ? {
                id: allocatorTop.id,
                score: allocatorTop.score,
                failureDomain: allocatorTop.failureDomain,
                successProb: allocatorTop.successProb
              }
            : null,
          acceptedCandidates: allocatorResult.scored.candidates.filter((entry) => entry.accepted).length,
          evaluatedCandidates: allocatorResult.scored.candidates.length,
          acceptedDistinctFailureDomains: acceptedDomains.size,
          requiredReplicas,
          requireDistinctFailureDomain,
          distinctDomainConstraintMet
        }
      };

      if (!proxy) {
        return res.json(responsePayload);
      }

      const isDeploymentBackedSelection = deployment && (
        normalizeServiceName(selected?.serviceName) === 'pmachine'
        || selected?.metadata?.deployment === true
      );

      const invocationServiceId = String(body.serviceId || body.runtimeServiceId || serviceName).trim() || serviceName;
      const invocation = isDeploymentBackedSelection
        ? await invokeDeploymentOnPmachine(selected, deployment, {
            ...body,
            serviceId: invocationServiceId
          })
        : await proxyServiceInvocation(selected, body);

      let outputQueueing = null;
      const shouldEnqueueOutputs = body.enqueueOutputs !== false;
      if (shouldEnqueueOutputs && invocation?.ok) {
        outputQueueing = await enqueueInvocationDeliveries(invocation, { sourceService: serviceName });
      }

      return res.status(invocation.ok ? 200 : 502).json({
        ...responsePayload,
        invocationServiceId,
        invocation,
        outputQueueing
      });
    } catch (e) {
      res.status(500).json({ error: 'Service route failed', details: e.message || String(e) });
    }
  });

  app.get('/api/pmachine/deployments', (req, res) => {
    const deployments = Array.from(ffsDeploymentRegistry.values())
      .map((deployment) => normalizeDeploymentRecord(deployment))
      .sort((a, b) => `${a.serviceName}:${a.targetNodeId || '*'}`.localeCompare(`${b.serviceName}:${b.targetNodeId || '*'}`));
    res.json({ deployments });
  });

  app.post('/api/pmachine/deployments', async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const serviceName = String(body.serviceName || '').trim();
      const packageName = String(body.packageName || '').trim();
      const packageVersion = String(body.packageVersion || 'latest').trim();
      const targetNodeIds = Array.from(new Set([
        ...(Array.isArray(body.targetNodeIds) ? body.targetNodeIds : []),
        ...(Array.isArray(body.targets) ? body.targets : []),
        body.targetNodeId || body.nodeId || body.target || null
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)));

      if (!serviceName || !packageName) {
        return res.status(400).json({ error: 'serviceName and packageName are required' });
      }

      const deploymentId = String(body.deploymentId || crypto.randomUUID()).trim();
      const runtimeState = String(body.autoStart === false ? 'stopped' : (body.runtimeState || 'running')).trim().toLowerCase() || 'running';
      const key = getDeploymentKey(serviceName, targetNodeIds[0] || '*', deploymentId);
      const next = normalizeDeploymentRecord({
        key,
        deploymentId,
        deploymentRef: String(body.deploymentRef || key).trim(),
        displayName: String(body.displayName || body.deploymentName || packageName).trim() || packageName,
        serviceName,
        packageName,
        packageVersion,
        targetNodeId: targetNodeIds[0] || null,
        targetNodeIds,
        scope: String(body.scope || (targetNodeIds.length > 1 ? 'collective' : 'node')).trim().toLowerCase() || 'node',
        runtimeState,
        state: runtimeState,
        createdAt: String(body.createdAt || new Date().toISOString()),
        updatedAt: new Date().toISOString(),
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
        instances: targetNodeIds.reduce((acc, nodeId) => {
          const normalizedNodeId = String(nodeId || '').trim();
          if (!normalizedNodeId) return acc;
          acc[normalizedNodeId] = {
            state: runtimeState,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stoppedAt: runtimeState === 'stopped' ? new Date().toISOString() : null
          };
          return acc;
        }, {})
      });

      const currentDeployments = Array.from(ffsDeploymentRegistry.values());
      const existingIdx = currentDeployments.findIndex((deployment) => String(deployment?.key || '') === key);
      if (existingIdx >= 0) {
        currentDeployments[existingIdx] = next;
      } else {
        currentDeployments.push(next);
      }

      const persisted = await persistDeploymentRecords({
        deploymentIndexPath,
        deploymentRegistry: ffsDeploymentRegistry,
        deployments: currentDeployments
      });

      upsertDeploymentServiceInstances(serviceInstanceRegistry, next);

      return res.json({
        status: 'ok',
        deployment: next,
        aliases: buildDeploymentAliases(next),
        persistedAt: persisted.updatedAt
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'failed to deploy flow' });
    }
  });

  app.post('/api/pmachine/deployments/:deploymentRef/actions/:action', async (req, res) => {
    try {
      const deploymentRef = String(req.params.deploymentRef || '').trim();
      const action = String(req.params.action || '').trim().toLowerCase();
      const allowed = new Set(['start', 'pause', 'resume', 'stop']);
      if (!allowed.has(action)) {
        return res.status(400).json({ error: 'Unsupported action. Use start, pause, resume, or stop.' });
      }

      const matches = resolveDeploymentMatches(deploymentRef, ffsDeploymentRegistry);
      if (matches.length === 0) {
        return res.status(404).json({ error: 'deployment not found', deploymentRef });
      }

      const targetNodeId = String(req.body?.targetNodeId || req.query?.targetNodeId || '').trim();
      const filteredMatches = targetNodeId
        ? matches.filter((deployment) => getDeploymentTargets(deployment).map((value) => normalizeNodeId(value)).includes(normalizeNodeId(targetNodeId)))
        : matches;
      if (filteredMatches.length === 0) {
        return res.status(404).json({ error: 'deployment target not found', deploymentRef, targetNodeId });
      }

      const nextState = action === 'resume' ? 'running' : action;
      const updatedDeployments = Array.from(ffsDeploymentRegistry.values()).map((deployment) => {
        if (!filteredMatches.some((match) => String(match?.key || '') === String(deployment?.key || ''))) {
          return deployment;
        }
        return updateDeploymentRuntimeState(deployment, nextState);
      });

      const persisted = await persistDeploymentRecords({
        deploymentIndexPath,
        deploymentRegistry: ffsDeploymentRegistry,
        deployments: updatedDeployments
      });

      for (const deployment of filteredMatches) {
        upsertDeploymentServiceInstances(serviceInstanceRegistry, updateDeploymentRuntimeState(deployment, nextState));
      }

      return res.json({
        status: 'ok',
        action,
        deploymentRef,
        affected: filteredMatches.map((deployment) => ({
          deploymentId: getDeploymentId(deployment),
          key: deployment.key,
          serviceName: deployment.serviceName,
          targetNodeIds: getDeploymentTargets(deployment),
          runtimeState: nextState
        })),
        persistedAt: persisted.updatedAt
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'failed to update deployment state' });
    }
  });

  app.delete('/api/pmachine/deployments/:deploymentRef', async (req, res) => {
    try {
      const deploymentRef = String(req.params.deploymentRef || '').trim();
      const matches = resolveDeploymentMatches(deploymentRef, ffsDeploymentRegistry);
      if (matches.length === 0) {
        return res.status(404).json({ error: 'deployment not found', deploymentRef });
      }

      const remaining = Array.from(ffsDeploymentRegistry.values()).filter((deployment) => {
        return !matches.some((match) => String(match?.key || '') === String(deployment?.key || ''));
      });

      const persisted = await persistDeploymentRecords({
        deploymentIndexPath,
        deploymentRegistry: ffsDeploymentRegistry,
        deployments: remaining
      });

      return res.json({
        status: 'ok',
        action: 'removed',
        deploymentRef,
        removed: matches.map((deployment) => ({
          deploymentId: getDeploymentId(deployment),
          key: deployment.key,
          serviceName: deployment.serviceName,
          targetNodeIds: getDeploymentTargets(deployment),
        })),
        persistedAt: persisted.updatedAt
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'failed to remove deployment' });
    }
  });

  app.post('/api/nodes/:nodeId/deploy', async (req, res) => {
    try {
      const requestedNodeId = String(req.params.nodeId || req.body?.nodeId || '').trim();
      const requestedIp = String(req.body?.ip || '').trim();
      const nodes = await buildCurrentNodesWithTopology();
      const resolved = resolveManagedNode(requestedNodeId, requestedIp, nodes);
      const body = req.body && typeof req.body === 'object' ? req.body : {};

      if (!resolved.node && !resolved.boardIp) {
        return res.status(404).json({ error: 'node not found' });
      }

      const uploads = [];
      const requestedFiles = Array.isArray(body.files) ? body.files : [];
      if (requestedFiles.length > 0) {
        if (!resolved.boardIp) {
          return res.status(400).json({ error: 'target node is not addressable for file deployment' });
        }
        for (const file of requestedFiles) {
          const remotePath = String(file?.path || '').trim();
          if (!remotePath) {
            return res.status(400).json({ error: 'each file requires a path' });
          }
          uploads.push(await uploadFileToBoard(resolved.boardIp, remotePath, String(file?.content || '')));
        }
      }

      const deploymentRecords = [];
      const serviceName = String(body.serviceName || '').trim();
      const packageName = String(body.packageName || '').trim();
      if (serviceName && packageName) {
        const key = `${normalizeServiceName(serviceName)}::${normalizeNodeId(requestedNodeId || resolved.node?.nodeId || resolved.boardIp || '*')}`;
        const next = {
          key,
          deploymentId: String(body.deploymentId || crypto.randomUUID()).trim(),
          displayName: String(body.displayName || body.deploymentName || packageName).trim() || packageName,
          serviceName,
          packageName,
          packageVersion: String(body.packageVersion || 'latest').trim(),
          targetNodeId: String(requestedNodeId || resolved.node?.nodeId || resolved.node?.nodeName || resolved.boardIp || '').trim(),
          updatedAt: new Date().toISOString(),
          metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
        };
        ffsDeploymentRegistry.set(key, next);
        deploymentRecords.push(next);
      }

      let execution = null;
      if (body.program && typeof body.program === 'object') {
        if (!resolved.boardIp) {
          return res.status(400).json({ error: 'target node is not addressable for program execution' });
        }
        execution = await executeProgramOnBoard(resolved.boardIp, body.program);
      }

      return res.json({
        status: 'ok',
        target: {
          nodeId: requestedNodeId || resolved.node?.nodeId || null,
          nodeName: resolved.node?.nodeName || resolved.node?.details?.nodeName || null,
          ip: resolved.boardIp || null
        },
        uploads,
        deployments: deploymentRecords,
        execution
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'failed to deploy to node' });
    }
  });

  app.post('/api/nodes/:nodeId/run-compute', async (req, res) => {
    try {
      const requestedNodeId = String(req.params.nodeId || req.body?.nodeId || '').trim();
      const requestedIp = String(req.body?.ip || '').trim();
      const nodes = await buildCurrentNodesWithTopology();
      const resolved = resolveManagedNode(requestedNodeId, requestedIp, nodes);
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const computeNode = body.computeNode && typeof body.computeNode === 'object' ? body.computeNode : null;

      if (!resolved.node && !resolved.boardIp) {
        return res.status(404).json({ error: 'target node not found' });
      }
      if (!computeNode) {
        return res.status(400).json({ error: 'computeNode is required' });
      }

      const compiled = compileComputeNodeToPcode(computeNode);
      if (!resolved.boardIp) {
        return res.status(400).json({ error: 'target node is not addressable for program execution' });
      }

      const baseSlug = String(computeNode?.visualObjectName || computeNode?.label || computeNode?.id || 'compute-node')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'compute-node';
      const pcodePath = `/pmachine/programs/${baseSlug}.pcode`;
      const programMapPath = `/pmachine/programs/${baseSlug}.program.json`;
      const signedProgramMap = attachPcodeSignature({
        nodeId: computeNode.id || null,
        nodeLabel: computeNode.label || null,
        operationRef: compiled.operationRef,
        instructionCount: compiled.instructionCount,
        moves: compiled.moves,
        programMap: compiled.programMap,
      }, compiled.pcodeText);
      const programMapText = `${JSON.stringify(signedProgramMap, null, 2)}\n`;

      const uploads = [];
      uploads.push(await uploadFileToBoard(resolved.boardIp, pcodePath, compiled.pcodeText));
      uploads.push(await uploadFileToBoard(resolved.boardIp, programMapPath, programMapText));

      const execution = await executeProgramOnBoard(resolved.boardIp, {
        file: pcodePath,
        programMap: programMapPath,
        inputQueue: String(body.inputQueue || 'default.in').trim(),
        message: String(body.message || compiled.summaryLine || '').trim(),
        fallbackPcodeText: compiled.pcodeText,
        fallbackProgramMapText: programMapText,
      });

      return res.json({
        status: 'ok',
        target: {
          nodeId: requestedNodeId || resolved.node?.nodeId || null,
          nodeName: resolved.node?.nodeName || resolved.node?.details?.nodeName || null,
          ip: resolved.boardIp || null,
        },
        computeNode: {
          id: computeNode.id || null,
          label: computeNode.label || null,
          operationRef: compiled.operationRef,
          summaryLine: compiled.summaryLine,
          instructionCount: compiled.instructionCount,
          moves: compiled.moves,
        },
        uploads,
        execution,
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'failed to run compute on node' });
    }
  });

  app.post('/api/clusters/:clusterId/deploy', async (req, res) => {
    try {
      await ensureClusterRegistryLoaded();
      const clusterId = normalizeNodeId(req.params.clusterId);
      const nodes = attachHierarchyPaths(await buildCurrentNodesWithTopology());
      const effectiveRegistry = buildEffectiveClusterRegistry(nodes);
      const cluster = effectiveRegistry[clusterId];
      if (!cluster) {
        return res.status(404).json({ error: 'cluster not found' });
      }

      const results = [];
      for (const clusterNodeId of cluster.nodes || []) {
        const node = nodes.find((entry) => normalizeNodeId(entry.nodeId || entry.nodeName || entry.ip) === clusterNodeId) || null;
        if (!node) {
          results.push({ nodeId: clusterNodeId, ok: false, error: 'node not currently available' });
          continue;
        }

        try {
          const uploads = [];
          const requestedFiles = Array.isArray(req.body?.files) ? req.body.files : [];
          for (const file of requestedFiles) {
            uploads.push(await uploadFileToBoard(node.ip, String(file?.path || ''), String(file?.content || '')));
          }

          const deployments = [];
          const serviceName = String(req.body?.serviceName || '').trim();
          const packageName = String(req.body?.packageName || '').trim();
          if (serviceName && packageName) {
            const key = `${normalizeServiceName(serviceName)}::${normalizeNodeId(node.nodeId || node.ip)}`;
            const next = {
              key,
              deploymentId: String(req.body?.deploymentId || crypto.randomUUID()).trim(),
              displayName: String(req.body?.displayName || req.body?.deploymentName || packageName).trim() || packageName,
              serviceName,
              packageName,
              packageVersion: String(req.body?.packageVersion || 'latest').trim(),
              targetNodeId: String(node.nodeId || node.nodeName || node.ip || '').trim(),
              updatedAt: new Date().toISOString(),
              metadata: req.body?.metadata && typeof req.body.metadata === 'object'
                ? { ...req.body.metadata, clusterId }
                : { clusterId }
            };
            ffsDeploymentRegistry.set(key, next);
            deployments.push(next);
          }

          let execution = null;
          if (req.body?.program && typeof req.body.program === 'object') {
            execution = await executeProgramOnBoard(node.ip, req.body.program);
          }

          results.push({
            nodeId: node.nodeId,
            nodeName: node.nodeName,
            ip: node.ip,
            ok: true,
            uploads,
            deployments,
            execution
          });
        } catch (error) {
          results.push({
            nodeId: node.nodeId,
            nodeName: node.nodeName,
            ip: node.ip,
            ok: false,
            error: error?.message || String(error)
          });
        }
      }

      return res.json({
        status: 'ok',
        clusterId,
        attempted: results.length,
        succeeded: results.filter((entry) => entry.ok).length,
        results
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'failed to deploy to cluster' });
    }
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
}
