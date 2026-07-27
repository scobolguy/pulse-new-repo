import fs from 'fs';
import path from 'path';
import http from 'http';
import multer from 'multer';
import { reloadOllamaContext, getOllamaWarmthStatus, ollamaGenerate } from './ollamaService.mjs';
import { matchPascalExecuteRoute, matchPrecomputedRoute, detectQueryTypes } from './queryRouteLoader.mjs';
import { matchAgentIntent } from './agentRouteLoader.mjs';

const SLOW_QUERY_THRESHOLD = 60000; // 60 seconds
const SLOW_QUERY_LOG_FILE = path.resolve('./logs/slow-queries.jsonl');

// Ensure logs directory exists
const logsDir = path.resolve('./logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Load global system knowledge that provides context to Ollama responses.
 */
let globalKnowledge = '';
try {
  const knowledgePath = path.resolve('./data/general-knowledge.md');
  if (fs.existsSync(knowledgePath)) {
    globalKnowledge = fs.readFileSync(knowledgePath, 'utf8');
  }
} catch (e) {
  console.warn('[OLLAMA] Warning: Could not load general-knowledge.md:', e.message);
}

/**
 * Load device configuration for hardware control
 */
let deviceConfig = {};
try {
  const deviceConfigPath = path.resolve('./data/device-config.json');
  if (fs.existsSync(deviceConfigPath)) {
    const configData = fs.readFileSync(deviceConfigPath, 'utf8');
    deviceConfig = JSON.parse(configData);
    console.log('[OLLAMA] Loaded device configuration with', Object.keys(deviceConfig.devices || {}).length, 'devices');
  }
} catch (e) {
  console.warn('[OLLAMA] Warning: Could not load device-config.json:', e.message);
}

/**
 * Response cache for tree queries and topology requests
 * Maps query hash to { response, timestamp }
 */
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const OLLAMA_QUEUE_ACTION_USER_ID = process.env.OLLAMA_QUEUE_ACTION_USER_ID || 'systemadmin';
const OLLAMA_DEFAULT_PROJECT_ID = process.env.OLLAMA_PROJECT_ID || 'myProject';
const OLLAMA_PROJECT_ARTIFACTS_ROOT = path.resolve('./data/projects');

const getCacheKey = (query) => {
  return query.toLowerCase().trim();
};

const isCacheValid = (timestamp) => {
  return Date.now() - timestamp < CACHE_TTL;
};

const recordSlowQuery = (query, queryType, duration, success, errorMsg = null) => {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      query: query.substring(0, 200), // Truncate long queries
      queryType,
      durationMs: Math.round(duration),
      success,
      error: errorMsg
    };
    fs.appendFileSync(SLOW_QUERY_LOG_FILE, JSON.stringify(logEntry) + '\n');
  } catch (err) {
    console.warn('[OLLAMA] Failed to record slow query:', err.message);
  }
};

// Helper to invalidate cache for related queries
const invalidateCachePatterns = (patterns) => {
  let invalidated = 0;
  for (const [key] of responseCache.entries()) {
    if (patterns.some(p => key.includes(p))) {
      responseCache.delete(key);
      invalidated++;
    }
  }
  if (invalidated > 0) {
    console.log(`[OLLAMA] Invalidated ${invalidated} cache entries for patterns:`, patterns);
  }
};

const parseCreateQueueRequest = (query) => {
  const q = String(query || '').trim();
  if (!q) return null;

  // Examples:
  // - "create queue myQueue"
  // - "make queue myQueue"
  // - "i need a queue called myQueue"
  // - "build a queue named myQueue"
  const match = q.match(/\b(?:create|add|make|build)\s+(?:a\s+)?queue\s+(?:called\s+|named\s+)?["']?([a-zA-Z0-9._:-]+)["']?/i)
    || q.match(/\bi\s+need\s+(?:a\s+)?queue\s+(?:called\s+|named\s+)?["']?([a-zA-Z0-9._:-]+)["']?/i);
  if (!match || !match[1]) return null;
  return match[1];
};

const parseCreateGatewayRequest = (query) => {
  const q = String(query || '').trim();
  if (!q) return null;

  if (!/\bgateway\b/i.test(q)) return null;

  const queueToken = String.raw`[a-zA-Z0-9._:-]+`;
  const pairRegexes = [
    new RegExp(String.raw`\bfrom\s+queue\s+["']?(${queueToken})["']?\s+(?:to|into|onto)\s+queue\s+["']?(${queueToken})["']?`, 'i'),
    new RegExp(String.raw`\binput\s*queue\s+["']?(${queueToken})["']?\s+(?:to|into|onto)\s+output\s*queue\s+["']?(${queueToken})["']?`, 'i'),
    new RegExp(String.raw`\bwith\s+queues?\s+["']?(${queueToken})["']?\s*(?:,|and|->|to)\s*["']?(${queueToken})["']?`, 'i'),
    new RegExp(String.raw`\bbetween\s+queues?\s+["']?(${queueToken})["']?\s*(?:and|->|to)\s*["']?(${queueToken})["']?`, 'i'),
    new RegExp(String.raw`\bqueues?\s+["']?(${queueToken})["']?\s*(?:,|and|->|to)\s*["']?(${queueToken})["']?`, 'i'),
    new RegExp(String.raw`\bfrom\s+["']?(${queueToken})["']?\s+(?:to|into|onto)\s+["']?(${queueToken})["']?`, 'i'),
  ];

  let inputQueue = '';
  let outputQueue = '';
  for (const regex of pairRegexes) {
    const match = q.match(regex);
    if (!match || !match[1] || !match[2]) continue;
    inputQueue = String(match[1]).trim();
    outputQueue = String(match[2]).trim();
    break;
  }

  if (!inputQueue || !outputQueue) {
    const fromMatch = q.match(/\bfrom\s+queue\s+["']?([a-zA-Z0-9._:-]+)["']?/i)
      || q.match(/\binput\s*queue\s+["']?([a-zA-Z0-9._:-]+)["']?/i);
    const toMatch = q.match(/\b(?:to|onto|into)\s+queue\s+["']?([a-zA-Z0-9._:-]+)["']?/i)
      || q.match(/\boutput\s*queue\s+["']?([a-zA-Z0-9._:-]+)["']?/i);

    inputQueue = fromMatch && fromMatch[1] ? String(fromMatch[1]).trim() : inputQueue;
    outputQueue = toMatch && toMatch[1] ? String(toMatch[1]).trim() : outputQueue;
  }

  if (!inputQueue || !outputQueue) return null;

  const gatewayNameMatch = q.match(/\bgateway\s+called\s+["']?([a-zA-Z0-9._:-]+)["']?/i)
    || q.match(/\bgateway\s+named\s+["']?([a-zA-Z0-9._:-]+)["']?/i)
    || q.match(/\bgateway\s+id\s+["']?([a-zA-Z0-9._:-]+)["']?/i)
    || q.match(/\b(?:create|make|add|build)\s+(?:a\s+)?gateway\s+["']?([a-zA-Z0-9._:-]+)["']?\s+(?:with|from|between|in|subproject|project)\b/i)
    || q.match(/\bgateway\s+["']?([a-zA-Z0-9._:-]+)["']?\s+(?:with|from|between|in|subproject|project)\b/i);
  const reservedNameTokens = new Set(['with', 'from', 'between', 'queue', 'queues', 'input', 'output', 'to', 'into', 'onto', 'in', 'project', 'subproject', 'called', 'named', 'id']);
  const gatewayName = String(gatewayNameMatch?.[1] || '').trim();
  const workerId = gatewayName && !reservedNameTokens.has(gatewayName.toLowerCase())
    ? gatewayName
    : '';

  const projectMatch = q.match(/\bin\s+project\s+["']?([a-zA-Z0-9._:/\\-]+)["']?/i)
    || q.match(/\bproject\s+["']?([a-zA-Z0-9._:/\\-]+)["']?/i);
  const subprojectMatch = q.match(/\bsubproject\s+["']?([a-zA-Z0-9._:/\\-]+)["']?/i);

  const projectId = String(projectMatch?.[1] || OLLAMA_DEFAULT_PROJECT_ID).trim() || OLLAMA_DEFAULT_PROJECT_ID;
  const subproject = String(subprojectMatch?.[1] || '').trim();

  return { inputQueue, outputQueue, workerId, projectId, subproject };
};

const parseAssignQueueTypesRequest = (query) => {
  const q = String(query || '').trim();
  if (!q) return null;

  const match = q.match(/\bassign\s+(.+?)\s+to\s+queue\s+["']?([a-zA-Z0-9._:-]+)["']?(?:\s+in\s+project\s+["']?([a-zA-Z0-9._:/\\-]+)["']?)?(?:\s+subproject\s+["']?([a-zA-Z0-9._:/\\-]+)["']?)?$/i);
  if (!match) return null;

  const rawTypeList = String(match[1] || '').trim();
  const queueName = String(match[2] || '').trim();
  if (!rawTypeList || !queueName) return null;

  const dataTypeIds = rawTypeList
    .split(/\s*,\s*|\s+and\s+/i)
    .map((token) => String(token || '')
      .trim()
      .replace(/^[\[\(<\{"'\s]+/, '')
      .replace(/[\]\)>\}"'\s]+$/, '')
      .toLowerCase())
    .filter(Boolean);

  if (dataTypeIds.length === 0) return null;

  const projectId = String(match[3] || OLLAMA_DEFAULT_PROJECT_ID).trim() || OLLAMA_DEFAULT_PROJECT_ID;
  const subproject = String(match[4] || '').trim();

  return {
    queueName,
    dataTypeIds: Array.from(new Set(dataTypeIds)),
    projectId,
    subproject,
  };
};

const parseRenameProjectRequest = (query) => {
  const q = String(query || '').trim();
  if (!q) return null;
  const match = q.match(/\brename\s+project\s+["']?([a-zA-Z0-9._:-]+)["']?\s+to\s+["']?([a-zA-Z0-9._:-]+)["']?/i);
  if (!match) return null;
  return {
    oldProjectId: String(match[1] || '').trim(),
    newProjectId: String(match[2] || '').trim(),
  };
};

const parseRenameSubprojectRequest = (query) => {
  const q = String(query || '').trim();
  if (!q) return null;
  const match = q.match(/\brename\s+subproject\s+["']?([a-zA-Z0-9._:/\\-]+)["']?\s+to\s+["']?([a-zA-Z0-9._:/\\-]+)["']?(?:\s+in\s+project\s+["']?([a-zA-Z0-9._:-]+)["']?)?/i);
  if (!match) return null;
  return {
    oldSubproject: String(match[1] || '').trim(),
    newSubproject: String(match[2] || '').trim(),
    projectId: String(match[3] || OLLAMA_DEFAULT_PROJECT_ID).trim() || OLLAMA_DEFAULT_PROJECT_ID,
  };
};

const parseDeployProjectRequest = (query) => {
  const q = String(query || '').trim();
  if (!q || !/\bdeploy\b/i.test(q)) return null;

  const subprojectFirst = q.match(/\bdeploy\s+subproject\s+["']?([a-zA-Z0-9._:/\\-]+)["']?\s+in\s+project\s+["']?([a-zA-Z0-9._:-]+)["']?\s+to\s+node\s+["']?([a-zA-Z0-9._:/\\-]+)["']?/i);
  if (subprojectFirst) {
    return {
      projectId: String(subprojectFirst[2] || OLLAMA_DEFAULT_PROJECT_ID).trim() || OLLAMA_DEFAULT_PROJECT_ID,
      subproject: String(subprojectFirst[1] || '').trim(),
      nodeId: String(subprojectFirst[3] || '').trim(),
    };
  }

  const projectFirst = q.match(/\bdeploy\s+project\s+["']?([a-zA-Z0-9._:-]+)["']?(?:\s+subproject\s+["']?([a-zA-Z0-9._:/\\-]+)["']?)?\s+to\s+node\s+["']?([a-zA-Z0-9._:/\\-]+)["']?/i);
  if (!projectFirst) return null;
  return {
    projectId: String(projectFirst[1] || OLLAMA_DEFAULT_PROJECT_ID).trim() || OLLAMA_DEFAULT_PROJECT_ID,
    subproject: String(projectFirst[2] || '').trim(),
    nodeId: String(projectFirst[3] || '').trim(),
  };
};

const isGatewayQueueStateQuery = (query) => {
  const q = String(query || '').toLowerCase();
  if (!q) return false;
  const asksState = /\b(state|status|health|show|display|graphic|dashboard)\b/.test(q);
  const mentionsGateway = /\bgateway|gateways\b/.test(q);
  const mentionsQueue = /\bqueue|queues\b/.test(q);
  return asksState && mentionsGateway && mentionsQueue;
};

const parseJsonSafe = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const callLocalJsonApi = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = parseJsonSafe(text);
  return {
    ok: response.ok,
    status: response.status,
    text,
    data,
  };
};

const normalizeProjectToken = (value, fallback = 'default') => {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return normalized || fallback;
};

const normalizeSubprojectSegments = (value) => {
  if (!value) return [];
  return String(value)
    .split(/[\\/]+/)
    .map((segment) => normalizeProjectToken(segment, ''))
    .filter(Boolean);
};

const resolveProjectArtifactContext = (projectId, subproject, { create = true } = {}) => {
  const safeProjectId = normalizeProjectToken(projectId, normalizeProjectToken(OLLAMA_DEFAULT_PROJECT_ID, 'default'));
  const subprojectSegments = normalizeSubprojectSegments(subproject);
  const projectRoot = path.join(OLLAMA_PROJECT_ARTIFACTS_ROOT, safeProjectId);
  const artifactDir = subprojectSegments.length > 0
    ? path.join(projectRoot, 'subprojects', ...subprojectSegments)
    : projectRoot;

  if (create) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  return {
    safeProjectId,
    subprojectSegments,
    projectRoot,
    artifactDir,
    subprojectPath: subprojectSegments.join('/'),
  };
};

const listProjectFilesRecursive = (rootPath) => {
  const out = [];
  if (!fs.existsSync(rootPath)) return out;

  const walk = (currentPath) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        out.push(fullPath);
      }
    }
  };

  walk(rootPath);
  return out;
};

const loadJsonSafe = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
};

const resolveQueueManagerId = async () => {
  const managers = await callLocalJsonApi('http://127.0.0.1:4000/api/registry/queue-managers', {
    method: 'GET',
    headers: { 'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID },
  });

  if (!managers.ok) {
    return {
      success: false,
      error: (managers.data && managers.data.error) || managers.text || `manager lookup failed (${managers.status})`,
    };
  }

  const managerId = (managers.data && managers.data.managerId)
    || (managers.data && Array.isArray(managers.data.managers) && managers.data.managers[0] && managers.data.managers[0].managerId)
    || 'qm-primary';
  return { success: true, managerId };
};

const fetchAllowedDataTypeIds = async () => {
  const response = await callLocalJsonApi('http://127.0.0.1:4000/api/librarian/data-types', {
    method: 'GET',
  });

  if (!response.ok) {
    return {
      success: true,
      degraded: true,
      warning: (response.data && response.data.error) || response.text || `data librarian type lookup failed (${response.status})`,
      allowedIds: ['text-string'],
    };
  }

  const allowedIds = Array.from(new Set(
    (Array.isArray(response.data?.types) ? response.data.types : [])
      .map((item) => String(item?.id || '').trim().toLowerCase())
      .filter(Boolean)
      .concat(['text-string'])
  ));

  return {
    success: true,
    degraded: false,
    warning: null,
    allowedIds,
  };
};

const persistQueueTypeAssignmentArtifact = ({ managerId, queueName, dataTypeIds, projectId, subproject }) => {
  const safeProjectId = normalizeProjectToken(projectId, normalizeProjectToken(OLLAMA_DEFAULT_PROJECT_ID, 'default'));
  const subprojectSegments = normalizeSubprojectSegments(subproject);
  const projectRoot = path.join(OLLAMA_PROJECT_ARTIFACTS_ROOT, safeProjectId);
  const artifactDir = subprojectSegments.length > 0
    ? path.join(projectRoot, 'subprojects', ...subprojectSegments)
    : projectRoot;
  const artifactPath = path.join(artifactDir, 'queue-type-assignments.json');

  fs.mkdirSync(artifactDir, { recursive: true });

  const existing = loadJsonSafe(artifactPath, {
    version: 1,
    projectId: safeProjectId,
    subprojectPath: subprojectSegments.join('/'),
    assignments: [],
    updatedAt: new Date().toISOString(),
  });

  const assignments = Array.isArray(existing.assignments) ? existing.assignments : [];
  const nowIso = new Date().toISOString();
  const normalizedQueue = String(queueName || '').trim();
  const normalizedTypes = Array.from(new Set((Array.isArray(dataTypeIds) ? dataTypeIds : [])
    .map((typeId) => String(typeId || '').trim().toLowerCase())
    .filter(Boolean)));

  const nextEntry = {
    queueName: normalizedQueue,
    dataTypeIds: normalizedTypes,
    managerId: String(managerId || ''),
    assignedAt: nowIso,
    source: 'ollama-assign-command',
  };

  const idx = assignments.findIndex((item) => String(item?.queueName || '').trim() === normalizedQueue);
  if (idx >= 0) {
    assignments[idx] = nextEntry;
  } else {
    assignments.push(nextEntry);
  }

  const payload = {
    version: 1,
    projectId: safeProjectId,
    subprojectPath: subprojectSegments.join('/'),
    updatedAt: nowIso,
    assignments,
  };

  fs.writeFileSync(artifactPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return {
    projectId: safeProjectId,
    subprojectPath: subprojectSegments.join('/'),
    artifactPath,
  };
};

const emitGatewayPascalish = ({ workerId, inputQueue, outputQueue }) => {
  const safeWorkerName = String(workerId || 'gateway_bridge').replace(/[^a-zA-Z0-9_]/g, '_');
  return [
    `service ${safeWorkerName};`,
    'begin',
    `  route message from "${String(inputQueue || '').replace(/"/g, '\\"')}" to "${String(outputQueue || '').replace(/"/g, '\\"')}";`,
    'end;',
    ''
  ].join('\n');
};

const emitGatewayPcodeText = ({ inputQueue, outputQueue }) => {
  const safeIn = String(inputQueue || '').replace(/"/g, '\\"');
  const safeOut = String(outputQueue || '').replace(/"/g, '\\"');
  return [
    '# Auto-generated gateway pcode (ESP32-compatible route opcode subset)',
    `ROUTE_MATCH_QUEUE "${safeIn}"`,
    'JZ FINISH',
    `ROUTE_EMIT "${safeOut}"`,
    'FINISH:',
    'HALT',
    ''
  ].join('\n');
};

const buildGatewayProgramMap = ({ workerId, inputQueue, outputQueue, pcodeText }) => {
  const lines = String(pcodeText || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const executable = lines.filter((line) => !line.startsWith('#') && !line.endsWith(':'));
  return {
    kind: 'gateway-bridge-program',
    version: 1,
    targetRuntime: 'esp32-pmachine',
    workerId,
    inputQueue,
    outputQueue,
    instructionCount: executable.length,
    signing: {
      algorithm: 'none',
      keyId: 'none',
      signature: 'unsigned-generated-artifact',
      signedAt: new Date().toISOString(),
      canonicalForm: 'raw-pcode-text-v1'
    }
  };
};

const persistGatewayArtifact = ({ managerId, workerId, inputQueue, outputQueue, projectId, subproject }) => {
  const context = resolveProjectArtifactContext(projectId, subproject);
  const gatewaysDir = path.join(context.artifactDir, 'gateways');
  fs.mkdirSync(gatewaysDir, { recursive: true });

  const safeWorkerId = toSafeWorkerToken(workerId || `bridge-${inputQueue}-to-${outputQueue}`);
  const pasFilePath = path.join(gatewaysDir, `${safeWorkerId}.pas`);
  const pcodeFilePath = path.join(gatewaysDir, `${safeWorkerId}.pcode`);
  const mapFilePath = path.join(gatewaysDir, `${safeWorkerId}.program.json`);
  const indexPath = path.join(context.artifactDir, 'gateway-bridges.json');

  const pascalishSource = emitGatewayPascalish({ workerId: safeWorkerId, inputQueue, outputQueue });
  const pcodeText = emitGatewayPcodeText({ inputQueue, outputQueue });
  const programMap = buildGatewayProgramMap({
    workerId: safeWorkerId,
    inputQueue,
    outputQueue,
    pcodeText,
  });

  fs.writeFileSync(pasFilePath, pascalishSource, 'utf8');
  fs.writeFileSync(pcodeFilePath, pcodeText, 'utf8');
  fs.writeFileSync(mapFilePath, `${JSON.stringify(programMap, null, 2)}\n`, 'utf8');

  const existingIndex = loadJsonSafe(indexPath, {
    version: 1,
    projectId: context.safeProjectId,
    subprojectPath: context.subprojectPath,
    bridges: [],
    updatedAt: new Date().toISOString(),
  });

  const bridges = Array.isArray(existingIndex.bridges) ? existingIndex.bridges : [];
  const nowIso = new Date().toISOString();
  const bridgeEntry = {
    workerId: safeWorkerId,
    managerId: String(managerId || ''),
    inputQueue: String(inputQueue || ''),
    outputQueue: String(outputQueue || ''),
    pascalishFile: pasFilePath,
    pcodeFile: pcodeFilePath,
    programMapFile: mapFilePath,
    updatedAt: nowIso,
    source: 'ollama-gateway-command',
  };

  const existingBridgeIdx = bridges.findIndex((item) => String(item?.workerId || '') === safeWorkerId);
  if (existingBridgeIdx >= 0) {
    bridges[existingBridgeIdx] = bridgeEntry;
  } else {
    bridges.push(bridgeEntry);
  }

  const indexPayload = {
    version: 1,
    projectId: context.safeProjectId,
    subprojectPath: context.subprojectPath,
    updatedAt: nowIso,
    bridges,
  };
  fs.writeFileSync(indexPath, `${JSON.stringify(indexPayload, null, 2)}\n`, 'utf8');

  return {
    projectId: context.safeProjectId,
    subprojectPath: context.subprojectPath,
    indexPath,
    pasFilePath,
    pcodeFilePath,
    programMapFile: mapFilePath,
  };
};

const assignQueueTypesFromOllamaRequest = async ({ queueName, dataTypeIds, projectId, subproject }) => {
  const normalizedQueueName = String(queueName || '').trim();
  const normalizedDataTypeIds = Array.from(new Set((Array.isArray(dataTypeIds) ? dataTypeIds : [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)));

  if (!normalizedQueueName) {
    return { success: false, error: 'queue name is required' };
  }
  if (normalizedDataTypeIds.length === 0) {
    return { success: false, error: 'at least one data type is required' };
  }

  const allowedTypeLookup = await fetchAllowedDataTypeIds();
  if (!allowedTypeLookup.success) {
    return { success: false, error: allowedTypeLookup.error };
  }

  const invalidTypeIds = normalizedDataTypeIds.filter((typeId) => !allowedTypeLookup.allowedIds.includes(typeId));
  if (invalidTypeIds.length > 0) {
    return {
      success: false,
      error: `invalid data type(s): ${invalidTypeIds.join(', ')}`,
      allowedTypeIds: allowedTypeLookup.allowedIds,
      validationDegraded: allowedTypeLookup.degraded === true,
      validationWarning: allowedTypeLookup.warning || null,
    };
  }

  const managerResolution = await resolveQueueManagerId();
  if (!managerResolution.success) {
    return { success: false, error: managerResolution.error };
  }
  const { managerId } = managerResolution;

  const configSnapshot = await callLocalJsonApi(`http://127.0.0.1:4000/api/queues/${encodeURIComponent(managerId)}/config`, {
    method: 'GET',
  });

  if (!configSnapshot.ok) {
    return {
      success: false,
      error: (configSnapshot.data && configSnapshot.data.error) || configSnapshot.text || `queue config lookup failed (${configSnapshot.status})`,
    };
  }

  const existingQueueConfig = configSnapshot.data?.queues?.[normalizedQueueName] || null;
  const updatePayload = {
    dataTypeId: normalizedDataTypeIds[0],
    dataTypeIds: normalizedDataTypeIds,
    createdByUser: true,
  };

  let applyResult = null;
  if (existingQueueConfig) {
    applyResult = await callLocalJsonApi(`http://127.0.0.1:4000/api/queues/${encodeURIComponent(managerId)}/update`, {
      method: 'POST',
      headers: {
        'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        queueName: normalizedQueueName,
        updates: updatePayload,
      }),
    });
  } else {
    applyResult = await callLocalJsonApi(`http://127.0.0.1:4000/api/queues/${encodeURIComponent(managerId)}/create`, {
      method: 'POST',
      headers: {
        'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        queueName: normalizedQueueName,
        config: updatePayload,
      }),
    });

    // Handle create/update race by retrying as update if queue already exists.
    const createError = String((applyResult.data && applyResult.data.error) || applyResult.text || '').toLowerCase();
    if (!applyResult.ok && createError.includes('already exists')) {
      applyResult = await callLocalJsonApi(`http://127.0.0.1:4000/api/queues/${encodeURIComponent(managerId)}/update`, {
        method: 'POST',
        headers: {
          'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          queueName: normalizedQueueName,
          updates: updatePayload,
        }),
      });
    }
  }

  if (!applyResult.ok) {
    return {
      success: false,
      error: (applyResult.data && applyResult.data.error) || applyResult.text || `queue type assignment failed (${applyResult.status})`,
    };
  }

  const artifact = persistQueueTypeAssignmentArtifact({
    managerId,
    queueName: normalizedQueueName,
    dataTypeIds: normalizedDataTypeIds,
    projectId,
    subproject,
  });

  return {
    success: true,
    queueName: normalizedQueueName,
    managerId,
    dataTypeIds: normalizedDataTypeIds,
    createdQueue: !existingQueueConfig,
    validationDegraded: allowedTypeLookup.degraded === true,
    validationWarning: allowedTypeLookup.warning || null,
    artifact,
    message: `assigned data types ${normalizedDataTypeIds.join(', ')} to queue ${normalizedQueueName}`,
  };
};

const renameProjectArtifacts = ({ oldProjectId, newProjectId }) => {
  const oldCtx = resolveProjectArtifactContext(oldProjectId, '', { create: false });
  const newCtx = resolveProjectArtifactContext(newProjectId, '', { create: false });
  if (!fs.existsSync(oldCtx.projectRoot)) {
    return { success: false, error: `project ${oldCtx.safeProjectId} not found` };
  }
  if (fs.existsSync(newCtx.projectRoot)) {
    return { success: false, error: `project ${newCtx.safeProjectId} already exists` };
  }

  fs.mkdirSync(path.dirname(newCtx.projectRoot), { recursive: true });
  fs.renameSync(oldCtx.projectRoot, newCtx.projectRoot);
  return {
    success: true,
    oldProjectId: oldCtx.safeProjectId,
    newProjectId: newCtx.safeProjectId,
    projectRoot: newCtx.projectRoot,
    message: `project ${oldCtx.safeProjectId} renamed to ${newCtx.safeProjectId}`,
  };
};

const renameSubprojectArtifacts = ({ projectId, oldSubproject, newSubproject }) => {
  const oldCtx = resolveProjectArtifactContext(projectId, oldSubproject, { create: false });
  const newCtx = resolveProjectArtifactContext(projectId, newSubproject, { create: false });
  if (!fs.existsSync(oldCtx.artifactDir)) {
    return { success: false, error: `subproject ${oldCtx.subprojectPath || '(root)'} not found` };
  }
  if (fs.existsSync(newCtx.artifactDir)) {
    return { success: false, error: `subproject ${newCtx.subprojectPath || '(root)'} already exists` };
  }

  fs.mkdirSync(path.dirname(newCtx.artifactDir), { recursive: true });
  fs.renameSync(oldCtx.artifactDir, newCtx.artifactDir);
  return {
    success: true,
    projectId: oldCtx.safeProjectId,
    oldSubprojectPath: oldCtx.subprojectPath,
    newSubprojectPath: newCtx.subprojectPath,
    artifactDir: newCtx.artifactDir,
    message: `subproject ${oldCtx.subprojectPath} renamed to ${newCtx.subprojectPath}`,
  };
};

const normalizeNodeToken = (value) => String(value || '').trim().toLowerCase();

const buildHierarchyParentMap = (payload) => {
  const map = new Map();
  const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
  for (const node of nodes) {
    const id = normalizeNodeToken(node?.nodeId || node?.id || node?.name);
    const parent = normalizeNodeToken(node?.parentNodeId || node?.parentId || node?.parent);
    if (!id) continue;
    map.set(id, parent || '');
  }
  return map;
};

const matchesDottedPathByHierarchy = (candidateId, dottedSegments, parentMap) => {
  if (!candidateId || dottedSegments.length < 2) return false;
  let current = normalizeNodeToken(candidateId);
  // Start one level above leaf; compare right-to-left over remaining segments.
  for (let i = dottedSegments.length - 2; i >= 0; i -= 1) {
    current = normalizeNodeToken(parentMap.get(current));
    if (!current || current !== dottedSegments[i]) {
      return false;
    }
  }
  return true;
};

const resolveDeploymentNodeId = async (requestedNodeId) => {
  const rawNodeId = String(requestedNodeId || '').trim();
  if (!rawNodeId) {
    return { success: false, error: 'nodeId is required' };
  }

  const nodesResult = await callLocalJsonApi('http://127.0.0.1:4000/api/ollama/nodes', {
    method: 'GET',
    headers: { 'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID },
  });
  if (!nodesResult.ok) {
    return {
      success: true,
      requestedNodeId: rawNodeId,
      resolvedNodeId: rawNodeId,
      aliasApplied: false,
      warning: `node lookup unavailable (${nodesResult.status}); using requested nodeId`,
    };
  }

  const nodes = Array.isArray(nodesResult.data?.nodes) ? nodesResult.data.nodes : [];
  const rawKey = normalizeNodeToken(rawNodeId);
  const candidates = nodes.map((node) => ({
    id: String(node?.id || '').trim(),
    name: String(node?.name || '').trim(),
    idKey: normalizeNodeToken(node?.id),
    nameKey: normalizeNodeToken(node?.name),
  })).filter((node) => node.id);

  const exact = candidates.find((node) => node.idKey === rawKey || node.nameKey === rawKey);
  if (exact) {
    return {
      success: true,
      requestedNodeId: rawNodeId,
      resolvedNodeId: exact.id,
      aliasApplied: exact.idKey !== rawKey,
      warning: null,
    };
  }

  const dottedSegments = rawNodeId
    .split(/[./\\>]+/)
    .map((segment) => normalizeNodeToken(segment))
    .filter(Boolean);

  if (dottedSegments.length > 1) {
    const leaf = dottedSegments[dottedSegments.length - 1];
    const leafMatches = candidates.filter((node) => node.idKey === leaf || node.nameKey === leaf);

    if (leafMatches.length === 1) {
      return {
        success: true,
        requestedNodeId: rawNodeId,
        resolvedNodeId: leafMatches[0].id,
        aliasApplied: true,
        warning: null,
      };
    }

    if (leafMatches.length > 1) {
      const hierarchyResult = await callLocalJsonApi('http://127.0.0.1:4000/api/node/hierarchy', {
        method: 'GET',
        headers: { 'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID },
      });
      if (hierarchyResult.ok) {
        const parentMap = buildHierarchyParentMap(hierarchyResult.data || {});
        const hierarchyMatch = leafMatches.find((candidate) =>
          matchesDottedPathByHierarchy(candidate.id, dottedSegments, parentMap));
        if (hierarchyMatch) {
          return {
            success: true,
            requestedNodeId: rawNodeId,
            resolvedNodeId: hierarchyMatch.id,
            aliasApplied: true,
            warning: null,
          };
        }
      }
    }
  }

  return {
    success: true,
    requestedNodeId: rawNodeId,
    resolvedNodeId: rawNodeId,
    aliasApplied: false,
    warning: null,
  };
};

const deployProjectArtifactsToNode = async ({ projectId, subproject, nodeId }) => {
  const targetNodeId = String(nodeId || '').trim();
  if (!targetNodeId) {
    return { success: false, error: 'nodeId is required' };
  }

  const nodeResolution = await resolveDeploymentNodeId(targetNodeId);
  if (!nodeResolution.success) {
    return { success: false, error: nodeResolution.error || 'node resolution failed' };
  }
  const resolvedNodeId = String(nodeResolution.resolvedNodeId || targetNodeId).trim();

  const ctx = resolveProjectArtifactContext(projectId, subproject, { create: false });
  if (!fs.existsSync(ctx.artifactDir)) {
    return {
      success: false,
      error: `project/subproject artifact path not found: ${ctx.artifactDir}`,
    };
  }

  const allFiles = listProjectFilesRecursive(ctx.artifactDir);
  if (allFiles.length === 0) {
    return { success: false, error: 'no deployable artifact files found' };
  }

  const files = allFiles.map((fullPath) => {
    const rel = path.relative(ctx.artifactDir, fullPath).replace(/\\/g, '/');
    const remotePath = `/projects/${ctx.safeProjectId}/${ctx.subprojectPath ? `subprojects/${ctx.subprojectPath}/` : ''}${rel}`;
    return {
      path: remotePath,
      content: fs.readFileSync(fullPath, 'utf8'),
    };
  });

  const deployBody = {
    nodeId: resolvedNodeId,
    serviceName: `project-${ctx.safeProjectId}${ctx.subprojectPath ? `-${ctx.subprojectPath.replace(/[\\/]+/g, '-')}` : ''}`,
    packageName: `projects/${ctx.safeProjectId}${ctx.subprojectPath ? `/${ctx.subprojectPath}` : ''}`,
    packageVersion: String(Date.now()),
    metadata: {
      projectId: ctx.safeProjectId,
      subprojectPath: ctx.subprojectPath,
      source: 'ollama-project-deploy',
      artifactCount: files.length,
    },
    files,
  };

  const deployResult = await callLocalJsonApi(`http://127.0.0.1:4000/api/nodes/${encodeURIComponent(resolvedNodeId)}/deploy`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID,
    },
    body: JSON.stringify(deployBody),
  });

  if (!deployResult.ok) {
    return {
      success: false,
      error: (deployResult.data && deployResult.data.error) || deployResult.text || `deploy failed (${deployResult.status})`,
    };
  }

  return {
    success: true,
    projectId: ctx.safeProjectId,
    subprojectPath: ctx.subprojectPath,
    nodeId: resolvedNodeId,
    requestedNodeId: targetNodeId,
    aliasApplied: nodeResolution.aliasApplied === true,
    nodeResolutionWarning: nodeResolution.warning || null,
    artifactCount: files.length,
    deployedFiles: files.map((item) => item.path),
    deployment: deployResult.data,
    message: `project ${ctx.safeProjectId}${ctx.subprojectPath ? `/${ctx.subprojectPath}` : ''} deployed to node ${resolvedNodeId}`,
  };
};

const fetchQueueGatewayRuntimeState = async () => {
  const gatewaysResult = await callLocalJsonApi('http://127.0.0.1:4000/api/gateways', {
    method: 'GET',
    headers: { 'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID },
  });

  if (!gatewaysResult.ok) {
    return { success: false, error: `gateway status failed (${gatewaysResult.status})` };
  }

  // Queue status endpoint differs across runtime roles; try known variants.
  const queueStatusResult = await callLocalJsonApi('http://127.0.0.1:4000/api/queues/status', {
    method: 'GET',
    headers: { 'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID },
  });

  let queues = [];
  if (queueStatusResult.ok && Array.isArray(queueStatusResult.data?.queues)) {
    queues = queueStatusResult.data.queues;
  } else {
    const registryQueuesResult = await callLocalJsonApi('http://127.0.0.1:4000/api/registry/queues', {
      method: 'GET',
      headers: { 'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID },
    });

    if (!registryQueuesResult.ok) {
      return {
        success: false,
        error: `queue status unavailable (${queueStatusResult.status}); registry fallback failed (${registryQueuesResult.status})`,
      };
    }

    const registryQueues = Array.isArray(registryQueuesResult.data?.queues) ? registryQueuesResult.data.queues : [];
    const queueRows = [];
    for (const queueEntry of registryQueues) {
      const queueName = String(queueEntry?.queueName || queueEntry?.queue || '').trim();
      if (!queueName) continue;

      const lengthResult = await callLocalJsonApi(`http://127.0.0.1:4000/api/queue/${encodeURIComponent(queueName)}/length`, {
        method: 'GET',
        headers: { 'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID },
      });
      const depth = lengthResult.ok
        ? Math.max(Number(lengthResult.data?.primary || 0), Number(lengthResult.data?.secondary || 0))
        : 0;

      queueRows.push({
        queue: queueName,
        depth,
      });
    }
    queues = queueRows;
  }

  const topQueues = [...queues]
    .map((item) => ({
      queue: String(item?.queue || item?.queueName || '').trim(),
      depth: Number(item?.depth || 0),
    }))
    .filter((item) => item.queue)
    .sort((a, b) => b.depth - a.depth)
    .slice(0, 12);

  const gateways = gatewaysResult.data || {};
  const gatewayEntries = Object.entries(gateways)
    .filter(([, value]) => value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'running'))
    .map(([gatewayId, value]) => ({
      gatewayId,
      running: Boolean(value.running),
      quiesced: Boolean(value.quiesced),
      mode: String(value.mode || 'unknown'),
      processedCount: Number(value?.queueMetrics?.cumulativeProcessedCount || 0),
      currentQueueCount: Number(value?.queueMetrics?.currentQueueCount || 0),
    }));

  return {
    success: true,
    runtimeState: {
      gateways: gatewayEntries,
      topQueues,
      queueCount: queues.length,
      generatedAt: new Date().toISOString(),
    },
  };
};

const createQueueFromOllamaRequest = async (queueName) => {
  const safeQueueName = String(queueName || '').trim();
  if (!safeQueueName) {
    return { success: false, error: 'queue name is required' };
  }

  const actorHeaders = { 'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID };
  const managers = await callLocalJsonApi('http://127.0.0.1:4000/api/registry/queue-managers', {
    method: 'GET',
    headers: actorHeaders,
  });

  if (!managers.ok) {
    return {
      success: false,
      error: (managers.data && managers.data.error) || managers.text || `manager lookup failed (${managers.status})`,
    };
  }

  const managerId = (managers.data && managers.data.managerId)
    || (managers.data && Array.isArray(managers.data.managers) && managers.data.managers[0] && managers.data.managers[0].managerId)
    || 'qm-primary';

  const createBody = {
    queueName: safeQueueName,
    config: {
      dataTypeId: 'text-string',
      dataTypeIds: ['text-string'],
      createdByUser: true,
    },
  };

  const createResult = await callLocalJsonApi(`http://127.0.0.1:4000/api/queues/${encodeURIComponent(managerId)}/create`, {
    method: 'POST',
    headers: {
      ...actorHeaders,
      'content-type': 'application/json',
    },
    body: JSON.stringify(createBody),
  });

  if (createResult.ok) {
    return {
      success: true,
      managerId,
      queueName: safeQueueName,
      message: `queue ${safeQueueName} created`,
      created: true,
      raw: createResult.data,
    };
  }

  const errorText = String((createResult.data && createResult.data.error) || createResult.text || '').toLowerCase();
  if (errorText.includes('already exists')) {
    return {
      success: true,
      managerId,
      queueName: safeQueueName,
      message: 'queue already exists',
      created: false,
      alreadyExists: true,
      raw: createResult.data,
    };
  }

  return {
    success: false,
    managerId,
    queueName: safeQueueName,
    error: (createResult.data && createResult.data.error) || createResult.text || `queue creation failed (${createResult.status})`,
  };
};

const toSafeWorkerToken = (value) => String(value || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-');

const createGatewayBridgeFromOllamaRequest = async ({ inputQueue, outputQueue, workerId, projectId, subproject }) => {
  const input = String(inputQueue || '').trim();
  const output = String(outputQueue || '').trim();
  const requestedWorkerId = String(workerId || '').trim();
  if (!input || !output) {
    return { success: false, error: 'inputQueue and outputQueue are required' };
  }

  // Ensure queues exist before starting bridge worker.
  const inputQueueResult = await createQueueFromOllamaRequest(input);
  if (!inputQueueResult.success) {
    return { success: false, error: `failed to ensure input queue ${input}: ${inputQueueResult.error}` };
  }

  const outputQueueResult = await createQueueFromOllamaRequest(output);
  if (!outputQueueResult.success) {
    return { success: false, error: `failed to ensure output queue ${output}: ${outputQueueResult.error}` };
  }

  const resolvedWorkerId = toSafeWorkerToken(requestedWorkerId || `bridge-${toSafeWorkerToken(input)}-to-${toSafeWorkerToken(output)}`);
  const bridgeResult = await callLocalJsonApi('http://127.0.0.1:4000/api/lifecycle/bridge-workers/start', {
    method: 'POST',
    headers: {
      'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      workerId: resolvedWorkerId,
      inputQueue: input,
      outputQueue: output,
      consumerService: 'ollama-gateway-bridge',
      sourceService: 'ollama-gateway-bridge',
      intervalMs: 250,
      batchSize: 50,
    }),
  });

  if (!bridgeResult.ok) {
    return {
      success: false,
      error: (bridgeResult.data && bridgeResult.data.error) || bridgeResult.text || `gateway bridge creation failed (${bridgeResult.status})`,
    };
  }

  const artifact = persistGatewayArtifact({
    managerId: inputQueueResult.managerId,
    workerId: resolvedWorkerId,
    inputQueue: input,
    outputQueue: output,
    projectId,
    subproject,
  });

  return {
    success: true,
    workerId: resolvedWorkerId,
    inputQueue: input,
    outputQueue: output,
    inputQueueCreated: inputQueueResult.created === true,
    outputQueueCreated: outputQueueResult.created === true,
    projectId: artifact.projectId,
    subprojectPath: artifact.subprojectPath,
    artifact,
    message: `gateway ${resolvedWorkerId} bridge created from ${input} to ${output}`,
    raw: bridgeResult.data,
  };
};

/**
 * Device control helper functions
 */

/**
 * Parse device name from query
 * Examples: "turn on the led on child1" -> "child1"
 *           "turn on neptune.child1 led" -> "child1"
 */
const parseDeviceName = (query) => {
  const lowerQuery = query.toLowerCase();
  
  // Look for device name patterns
  // Pattern 1: "child1", "child2", "child3"
  const childMatch = lowerQuery.match(/child[123]\b/);
  if (childMatch) return childMatch[0];
  
  // Pattern 2: "neptune.child1"
  const fullyQualified = lowerQuery.match(/neptune\.child[123]\b/);
  if (fullyQualified) {
    const parts = fullyQualified[0].split('.');
    return parts[1]; // Return just "child1" from "neptune.child1"
  }
  
  // Pattern 3: Named device: "aggregator", "neptune"
  const namedDevice = lowerQuery.match(/\b(aggregator|neptune|pmachine)\b/);
  if (namedDevice) return namedDevice[1];
  
  return null;
};

/**
 * Get device configuration
 */
const getDeviceInfo = (deviceName) => {
  if (!deviceName || !deviceConfig.devices) return null;
  const device = deviceConfig.devices[deviceName.toLowerCase()];
  return device || null;
};

/**
 * Get LED pin for a device type
 */
const getLedPin = (deviceType) => {
  if (!deviceType || !deviceConfig.deviceTypes) return null;
  const typeConfig = deviceConfig.deviceTypes[deviceType];
  return typeConfig ? typeConfig.ledPin : null;
};

/**
 * Construct GPIO command for device control
 */
const constructGpioCommand = (deviceName, pin, value) => {
  const device = getDeviceInfo(deviceName);
  if (!device) return null;
  
  return {
    device: deviceName,
    ip: device.ip,
    port: device.port || 80,
    type: device.type,
    pin: pin,
    value: value, // 0 = OFF, 1 = ON
    endpoint: `/api/device/${deviceName}/gpio/${pin}/set`,
    description: `Turn ${value ? 'ON' : 'OFF'} LED on ${deviceName} (GPIO${pin})`
  };
};

/**
 * Send GPIO command to device
 */
const sendGpioCommand = (command) => {
  return new Promise((resolve, reject) => {
    // ESP32 endpoint: /devices/ledpin/action?action=on|off
    const action = command.value ? 'on' : 'off';
    const url = `http://${command.ip}:${command.port}/devices/ledpin/action?action=${action}`;
    
    const req = http.request(url, {
      method: 'POST',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            success: res.statusCode === 200 || res.statusCode === 201,
            statusCode: res.statusCode,
            response: response,
            command: command
          });
        } catch (e) {
          resolve({
            success: res.statusCode === 200 || res.statusCode === 201,
            statusCode: res.statusCode,
            response: data,
            command: command
          });
        }
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout sending command to ${command.ip}:${command.port}`));
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    // No body needed since we use query parameters
    req.end();
  });
};

/**
 * Detect if query is a device control request (turn on/off LED, toggle, etc.)
 */
const isDeviceControlQuery = (query) => {
  const lowerQuery = query.toLowerCase();
  const hasDevice = /child1|child2|child3|neptune\.child\d/.test(lowerQuery);
  const hasAction = /turn\s+(on|off)|toggle|switch|activate|deactivate|blink|pulse|set.*(?:led|light)/i.test(lowerQuery);
  return hasDevice && hasAction;
};

/**
 * Extract device and action from device control query
 */
const parseDeviceControlQuery = (query) => {
  const lowerQuery = query.toLowerCase();
  
  // Extract device name
  let device = parseDeviceName(query);
  
  // Extract action - CHECK OFF FIRST to prevent matching "on" in "on child1"
  let action = null;
  if (/\boff\b|turn\s+off|switch\s+off|close|deactivate/.test(lowerQuery)) {
    action = 'off';
  } else if (/\bon\b|turn\s+on|switch\s+on|activate/.test(lowerQuery)) {
    action = 'on';
  } else if (/toggle|switch|flip|blink|pulse/.test(lowerQuery)) {
    action = 'on'; // For toggle, we send 'on'; device can implement toggle logic
  }
  
  return { device, action };
};

/**
 * Register Ollama management routes.
 */
export function registerOllamaRoutes(app) {
  console.log('[OLLAMA] registerOllamaRoutes() called, starting route registration...');
  
  /**
   * Fetch real node data from topology using HTTP and enhance with system context.
   */
  const fetchNodeData = async () => {
    return new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:4000/api/nodes', { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const nodes = JSON.parse(data);
            console.log('[OLLAMA] Fetched nodes:', nodes.length ? `${nodes.length} nodes` : 'empty list');
            resolve(nodes);
          } catch (e) {
            console.warn('[OLLAMA] Failed to parse nodes:', e.message);
            resolve(null);
          }
        });
      });

      req.on('error', (e) => {
        console.warn('[OLLAMA] Error fetching nodes:', e.message);
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        console.warn('[OLLAMA] Node fetch timeout');
        resolve(null);
      });
    });
  };

  /**
   * Known ESP32 nodes - hard-coded mapping of node names to IPs
   */
  const knownNodes = {
    'child1': { ip: '192.168.2.157', port: 80 },
    'child2': { ip: '192.168.2.59', port: 80 },
    'child3': { ip: '192.168.2.58', port: 80 }
  };

  /**
   * Control device on a node by making HTTP request directly to the device endpoint
   */
  const controlDeviceOnNode = async (nodeId, device, action) => {
    return new Promise((resolve) => {
      let nodeIp, nodePort;
      
      // Check if it's a known ESP32 node
      const knownNode = knownNodes[nodeId.toLowerCase()];
      if (knownNode) {
        nodeIp = knownNode.ip;
        nodePort = knownNode.port;
        executeDeviceControl();
        return;
      }

      // Otherwise, try to get from nodes endpoint
      const nodeReq = http.get('http://127.0.0.1:4000/api/nodes', { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const nodes = JSON.parse(data);
            const node = nodes.find(n => n.nodeName === nodeId || n.nodeId === nodeId);
            if (!node) {
              resolve({ success: false, error: `Node ${nodeId} not found in registry or known nodes` });
              return;
            }
            
            nodeIp = node.ip;
            nodePort = node.details?.httpPort || 80;
            executeDeviceControl();
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse nodes' });
          }
        });
      });
      
      nodeReq.on('error', (e) => {
        resolve({ success: false, error: `Node fetch failed: ${e.message}` });
      });
      nodeReq.on('timeout', () => {
        nodeReq.destroy();
        resolve({ success: false, error: 'Node fetch timeout' });
      });

      function executeDeviceControl() {
        const devicePath = `/devices/${device.toLowerCase()}/action`;
        const postData = `action=${encodeURIComponent(action.toLowerCase())}`;
        
        const options = {
          hostname: nodeIp,
          port: nodePort,
          path: devicePath,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 5000
        };
        
        const deviceReq = http.request(options, (deviceRes) => {
          let deviceData = '';
          deviceRes.on('data', (chunk) => { deviceData += chunk; });
          deviceRes.on('end', () => {
            try {
              const result = JSON.parse(deviceData);
              resolve({ 
                success: true, 
                device: result.device || device,
                action: result.action || action,
                state: result.state,
                nodeId: nodeId,
                pin: result.pin,
                timestamp: new Date().toISOString()
              });
            } catch (e) {
              resolve({ success: false, error: `Invalid device response: ${e.message}` });
            }
          });
        });
        
        deviceReq.on('error', (e) => {
          resolve({ success: false, error: `Device request failed: ${e.message}` });
        });
        
        deviceReq.write(postData);
        deviceReq.end();
      }
    });
  };

  // Helper to check for pre-computed answers in knowledge base
  const checkPreComputedAnswer = (query) => {
    const lowerQuery = query.toLowerCase();
    
    // Pre-computed answer triggers - specific patterns for informational queries only
    if (/show.*tree|network.*topology|node.*hierarchy|structure.*node|how.*arranged|how.*organized/.test(lowerQuery)) {
      return {
        type: 'topology',
        answer: `The network has 8 nodes arranged in a hierarchical structure:

ROOT NODES (5 total):
• Aggregator Backend (127.0.0.1)
• Neptune (172.18.0.1) [Cluster Controller]
• magic-js-pmachine-01 (127.0.10.101)
• magic-js-pmachine-02 (127.0.10.102)
• magic-js-pmachine-03 (127.0.10.103)

CHILD NODES (3 total, under Neptune):
• child1 (192.168.2.157) - ESP32-CAM
• child2 (192.168.2.59) - ESP8266
• child3 (192.168.2.58) - ESP32

Tree Structure:
Neptune (Cluster Controller)
├─ child1 (ESP32-CAM)
├─ child2 (ESP8266)
└─ child3 (ESP32)

Summary: 8 nodes total | 5 root nodes | 1 cluster controller | 3 child devices`
      };
    }
    
    if (/how many nodes|node count|total nodes|devices.*available|list.*nodes|all.*nodes|count.*device/.test(lowerQuery)) {
      return {
        type: 'quick',
        answer: `Currently 8 nodes are registered and online:
- 5 root nodes (no parent)
- 1 cluster controller (Neptune)
- 3 ESP32/ESP8266 child devices

All nodes are communicating normally.`
      };
    }
    
    if (/list.*esp32|esp32.*list|list.*esp8266|what.*esp32|what.*devices|esp32.*devices|esp8266.*available/.test(lowerQuery)) {
      return {
        type: 'devices',
        answer: `The network has 3 ESP microcontroller devices managed by Neptune:

1. child1 (192.168.2.157)
   Type: ESP32-CAM
   Parent: Neptune

2. child2 (192.168.2.59)
   Type: ESP8266
   Parent: Neptune

3. child3 (192.168.2.58)
   Type: ESP32
   Parent: Neptune

All child devices are online and operational.`
      };
    }
    
    if (/what.*neptune|neptune.*what|tell.*neptune|neptune.*info|who.*neptune|what.*cluster controller|cluster controller.*info/.test(lowerQuery)) {
      return {
        type: 'neptune',
        answer: `Neptune (IP: 172.18.0.1) is the cluster controller for the network.

KEY PROPERTIES:
• Role: Cluster Controller
• IP Address: 172.18.0.1
• Children: 3 ESP32/ESP8266 devices (child1, child2, child3)
• Hardware: Server
• Status: Online

Neptune manages device discovery and communication for all child nodes.`
      };
    }
    
    return null;
  };

  // Streaming handler for SSE (Server-Sent Events)
  const streamingAskHandler = async (req, res) => {
    const queryStartTime = Date.now();
    let query = '';
    
    try {
      query = String(req.body?.query || '').trim();
      if (!query) {
        return res.status(400).json({ error: 'query is required' });
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Check for pre-computed answers first (from data/ollama-query-routes.json)
      const precomputedType = await matchPrecomputedRoute(query);
      if (precomputedType) {
        const precomputed = checkPreComputedAnswer(query);
        if (precomputed) {
          console.log('[OLLAMA] Pre-computed answer for:', query);
          res.write(`data: ${JSON.stringify({ chunk: precomputed.answer, final: true })}\n\n`);
          res.end();
          return;
        }
      }

      // Check cache
      const cacheKey = getCacheKey(query);
      if (responseCache.has(cacheKey)) {
        const cached = responseCache.get(cacheKey);
        if (isCacheValid(cached.timestamp)) {
          console.log('[OLLAMA] Cache hit for streaming query:', query);
          res.write(`data: ${JSON.stringify({ chunk: cached.response.answer, final: true })}\n\n`);
          res.end();
          return;
        } else {
          responseCache.delete(cacheKey);
        }
      }

      // Stream response from Ollama (word by word)
      console.log('[OLLAMA] Streaming response for query:', query.substring(0, 50) + '...');
      const fullResponse = await ollamaGenerate(query);
      
      // Split response into chunks and stream
      const words = fullResponse.split(' ');
      let accumulated = '';
      
      for (const word of words) {
        accumulated += (accumulated ? ' ' : '') + word;
        res.write(`data: ${JSON.stringify({ chunk: word + ' ' })}\n\n`);
        // Small delay to simulate streaming (optional)
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Cache the full response
      responseCache.set(cacheKey, { 
        response: { answer: fullResponse }, 
        timestamp: Date.now() 
      });

      res.write(`data: ${JSON.stringify({ chunk: '', final: true })}\n\n`);
      res.end();

      const queryElapsed = Date.now() - queryStartTime;
      if (queryElapsed > SLOW_QUERY_THRESHOLD) {
        recordSlowQuery(query, 'streaming', queryElapsed, true);
      }
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      const queryElapsed = Date.now() - queryStartTime;
      if (queryElapsed > SLOW_QUERY_THRESHOLD) {
        recordSlowQuery(query, 'streaming-error', queryElapsed, false, msg);
      }
      console.error('[OLLAMA] Streaming error:', msg);
      res.write(`data: ${JSON.stringify({ error: msg, final: true })}\n\n`);
      res.end();
    }
  };

  const askHandler = async (req, res) => {
    const queryStartTime = Date.now();
    let query = '';
    try {
      query = String(req.body?.query || '').trim();
      if (!query) {
        return res.status(400).json({ error: 'query is required' });
      }

      // Check cache first
      const cacheKey = getCacheKey(query);
      if (responseCache.has(cacheKey)) {
        const cached = responseCache.get(cacheKey);
        if (isCacheValid(cached.timestamp)) {
          console.log('[OLLAMA] Cache hit for query:', query);
          return res.json(cached.response);
        } else {
          responseCache.delete(cacheKey);
        }
      }

      // Deterministic queue creation path for commands like "create queue myQueue".
      const requestedTypeAssignment = parseAssignQueueTypesRequest(query);
      if (requestedTypeAssignment) {
        const assignResult = await assignQueueTypesFromOllamaRequest(requestedTypeAssignment);
        if (!assignResult.success) {
          return res.status(400).json({
            success: false,
            answer: `failed to assign queue data types: ${assignResult.error}`,
            model: 'queue-manager',
            queryType: 'queue-type-assignment',
            queueName: requestedTypeAssignment.queueName,
            dataTypeIds: requestedTypeAssignment.dataTypeIds,
            projectId: requestedTypeAssignment.projectId,
            subproject: requestedTypeAssignment.subproject,
            allowedTypeIds: assignResult.allowedTypeIds || [],
          });
        }

        const assignResponse = {
          success: true,
          answer: assignResult.message,
          model: 'queue-manager',
          queryType: 'queue-type-assignment',
          queueName: assignResult.queueName,
          managerId: assignResult.managerId,
          dataTypeIds: assignResult.dataTypeIds,
          createdQueue: assignResult.createdQueue === true,
          projectId: assignResult.artifact?.projectId || requestedTypeAssignment.projectId,
          subprojectPath: assignResult.artifact?.subprojectPath || '',
          artifactPath: assignResult.artifact?.artifactPath || '',
          validationDegraded: assignResult.validationDegraded === true,
          validationWarning: assignResult.validationWarning || null,
        };

        responseCache.set(cacheKey, { response: assignResponse, timestamp: Date.now() });
        invalidateCachePatterns(['queue', assignResult.queueName.toLowerCase()]);
        return res.json(assignResponse);
      }

      const requestedProjectRename = parseRenameProjectRequest(query);
      if (requestedProjectRename) {
        const renameResult = renameProjectArtifacts(requestedProjectRename);
        if (!renameResult.success) {
          return res.status(400).json({
            success: false,
            answer: `failed to rename project: ${renameResult.error}`,
            model: 'project-manager',
            queryType: 'project-rename',
            ...requestedProjectRename,
          });
        }

        const renameResponse = {
          success: true,
          answer: renameResult.message,
          model: 'project-manager',
          queryType: 'project-rename',
          ...renameResult,
        };
        responseCache.set(cacheKey, { response: renameResponse, timestamp: Date.now() });
        invalidateCachePatterns(['project', requestedProjectRename.oldProjectId.toLowerCase(), requestedProjectRename.newProjectId.toLowerCase()]);
        return res.json(renameResponse);
      }

      const requestedSubprojectRename = parseRenameSubprojectRequest(query);
      if (requestedSubprojectRename) {
        const renameResult = renameSubprojectArtifacts(requestedSubprojectRename);
        if (!renameResult.success) {
          return res.status(400).json({
            success: false,
            answer: `failed to rename subproject: ${renameResult.error}`,
            model: 'project-manager',
            queryType: 'subproject-rename',
            ...requestedSubprojectRename,
          });
        }

        const renameResponse = {
          success: true,
          answer: renameResult.message,
          model: 'project-manager',
          queryType: 'subproject-rename',
          ...renameResult,
        };
        responseCache.set(cacheKey, { response: renameResponse, timestamp: Date.now() });
        invalidateCachePatterns(['project', requestedSubprojectRename.projectId.toLowerCase()]);
        return res.json(renameResponse);
      }

      const requestedProjectDeploy = parseDeployProjectRequest(query);
      if (requestedProjectDeploy) {
        const deployResult = await deployProjectArtifactsToNode(requestedProjectDeploy);
        if (!deployResult.success) {
          return res.status(400).json({
            success: false,
            answer: `failed to deploy project: ${deployResult.error}`,
            model: 'deployment-manager',
            queryType: 'project-deploy',
            ...requestedProjectDeploy,
          });
        }

        const deployResponse = {
          success: true,
          answer: deployResult.message,
          model: 'deployment-manager',
          queryType: 'project-deploy',
          ...deployResult,
        };
        responseCache.set(cacheKey, { response: deployResponse, timestamp: Date.now() });
        invalidateCachePatterns(['project', deployResult.projectId.toLowerCase(), 'deploy', deployResult.nodeId.toLowerCase()]);
        return res.json(deployResponse);
      }

      if (isGatewayQueueStateQuery(query)) {
        const stateResult = await fetchQueueGatewayRuntimeState();
        if (!stateResult.success) {
          return res.status(400).json({
            success: false,
            answer: `failed to fetch queue/gateway state: ${stateResult.error}`,
            model: 'runtime-observer',
            queryType: 'runtime-state',
          });
        }

        const stateResponse = {
          success: true,
          answer: `runtime state generated with ${stateResult.runtimeState.gateways.length} gateways and ${stateResult.runtimeState.queueCount} queues`,
          model: 'runtime-observer',
          queryType: 'runtime-state',
          runtimeState: stateResult.runtimeState,
        };
        responseCache.set(cacheKey, { response: stateResponse, timestamp: Date.now() });
        invalidateCachePatterns(['state', 'gateway', 'queue']);
        return res.json(stateResponse);
      }

      const requestedQueueName = parseCreateQueueRequest(query);
      if (requestedQueueName) {
        const queueResult = await createQueueFromOllamaRequest(requestedQueueName);
        if (!queueResult.success) {
          return res.status(400).json({
            success: false,
            answer: `failed to create queue: ${queueResult.error}`,
            model: 'queue-manager',
            queryType: 'queue-create',
            queueName: requestedQueueName,
          });
        }

        const queueResponse = {
          success: true,
          answer: queueResult.message,
          model: 'queue-manager',
          queryType: 'queue-create',
          managerId: queueResult.managerId,
          queueName: queueResult.queueName,
          created: queueResult.created === true,
          alreadyExists: queueResult.alreadyExists === true,
        };

        responseCache.set(cacheKey, { response: queueResponse, timestamp: Date.now() });
        invalidateCachePatterns(['queue', requestedQueueName.toLowerCase()]);
        return res.json(queueResponse);
      }

      const requestedGateway = parseCreateGatewayRequest(query);
      if (requestedGateway) {
        const gatewayResult = await createGatewayBridgeFromOllamaRequest(requestedGateway);
        if (!gatewayResult.success) {
          return res.status(400).json({
            success: false,
            answer: `failed to create gateway: ${gatewayResult.error}`,
            model: 'gateway-manager',
            queryType: 'gateway-create',
            inputQueue: requestedGateway.inputQueue,
            outputQueue: requestedGateway.outputQueue,
          });
        }

        const gatewayResponse = {
          success: true,
          answer: gatewayResult.message,
          model: 'gateway-manager',
          queryType: 'gateway-create',
          workerId: gatewayResult.workerId,
          inputQueue: gatewayResult.inputQueue,
          outputQueue: gatewayResult.outputQueue,
          inputQueueCreated: gatewayResult.inputQueueCreated,
          outputQueueCreated: gatewayResult.outputQueueCreated,
          projectId: gatewayResult.projectId,
          subprojectPath: gatewayResult.subprojectPath,
          artifactPath: gatewayResult.artifact?.indexPath || '',
          pascalishFile: gatewayResult.artifact?.pasFilePath || '',
          pcodeFile: gatewayResult.artifact?.pcodeFilePath || '',
          programMapFile: gatewayResult.artifact?.programMapFile || '',
        };

        responseCache.set(cacheKey, { response: gatewayResponse, timestamp: Date.now() });
        invalidateCachePatterns(['gateway', requestedGateway.inputQueue.toLowerCase(), requestedGateway.outputQueue.toLowerCase()]);
        return res.json(gatewayResponse);
      }

      // Check for pre-computed answers first (from data/ollama-query-routes.json)
      const precomputedType = await matchPrecomputedRoute(query);
      if (precomputedType) {
        const precomputed = checkPreComputedAnswer(query);
        if (precomputed) {
          console.log('[OLLAMA] Pre-computed answer for:', query.substring(0, 50));
          return res.json({
            success: true,
            answer: precomputed.answer,
            model: process.env.OLLAMA_MODEL || 'phi3:latest',
            queryType: precomputed.type,
            fromCache: 'precomputed'
          });
        }
      }

      // Check for device control queries and route to device-control endpoint
      if (isDeviceControlQuery(query)) {
        console.log('[OLLAMA] Device control query detected:', query);
        const { device, action } = parseDeviceControlQuery(query);
        
        if (device && action) {
          console.log(`[OLLAMA] Routing to device-control: device=${device}, action=${action}`);
          try {
            // Call device-control endpoint directly
            const body = JSON.stringify({ device, action });
            const deviceResult = await new Promise((resolve, reject) => {
              const req = http.request('http://127.0.0.1:4000/api/ollama/device-control', {
                method: 'POST',
                timeout: 10000,
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(body)
                }
              }, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                  try {
                    resolve(JSON.parse(data));
                  } catch (e) {
                    resolve({ error: data });
                  }
                });
              });
              
              req.on('error', reject);
              req.on('timeout', () => {
                req.destroy();
                reject(new Error('Device control timeout'));
              });
              
              req.write(body);
              req.end();
            });
            
            // Format response for user
            const message = deviceResult.message || `LED on ${device} set to ${action.toUpperCase()}`;
            const cacheKey = getCacheKey(query);
            const response = {
              success: true,
              answer: message,
              model: 'device-control',
              queryType: 'device-control',
              device: deviceResult.device,
              pin: deviceResult.pin,
              value: deviceResult.value,
              deviceResponse: deviceResult
            };
            
            // Cache the response
            responseCache.set(cacheKey, { response, timestamp: Date.now() });
            
            return res.json(response);
          } catch (e) {
            console.error('[OLLAMA] Device control error:', e.message);
            return res.json({
              success: false,
              answer: `Error controlling device: ${e.message}`,
              model: 'device-control',
              queryType: 'device-control'
            });
          }
        }
      }

      // Route matching via externalized config (data/ollama-query-routes.json)
      const queryTypes = await detectQueryTypes(query);
      const isTreeQuery = queryTypes.has('tree-query');
      const isNodesQuery = queryTypes.has('nodes-query');
      const isServicesQuery = queryTypes.has('services-query');
      const isRelayQuery = queryTypes.has('relay-control');
      const isLedQuery = queryTypes.has('led-control');

      // Check pascal-execute routes (factorial, etc.) from config
      const pascalRoute = await matchPascalExecuteRoute(query);
      if (pascalRoute) {
        const { route, capturedValue } = pascalRoute;
        const n = parseInt(capturedValue, 10);
        console.log(`[OLLAMA] Pascal-execute route matched: ${route.id}, capture=${capturedValue}`);
        try {
          const sourceFile = path.resolve(process.cwd(), route.action.sourceFile);
          const source = await fs.promises.readFile(sourceFile, 'utf-8');
          const execRes = await fetch('http://127.0.0.1:4000/api/pascal/execute', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ source, message: String(capturedValue) })
          });
          const execData = await execRes.json();
          if (execData.status === 'ok') {
            const result = execData.stdout;
            const isInvalid = result.trim() === 'Invalid input';
            const fmt = isInvalid ? route.formatResult.invalid : route.formatResult.valid;
            const answer = fmt
              .replace(/{n}/g, capturedValue)
              .replace(/{result}/g, result);
            const response = {
              success: true,
              answer,
              model: 'pascal-execute',
              queryType: route.id,
              computed: { n, result, elapsedMs: execData.elapsedMs }
            };
            responseCache.set(cacheKey, { response, timestamp: Date.now() });
            return res.json(response);
          }
        } catch (e) {
          console.warn(`[OLLAMA] Pascal execute failed for route ${route.id}:`, e.message);
        }
      }

      let finalQuery = query;
      let queryType = 'general';
      let deviceControl = null;
      
      if (isTreeQuery) {
        queryType = 'tree-query';
        console.log('[OLLAMA] Tree query detected:', query);
        
        // For tree queries, fetch topology data and format it
        const nodeData = await fetchNodeData();
        if (!nodeData || nodeData.length === 0) {
          console.log('[OLLAMA] No nodes found for tree query');
          return res.json({
            success: true,
            answer: 'No nodes found in the network topology.',
            model: process.env.OLLAMA_MODEL || 'phi3:latest',
            queryType
          });
        }
        
        console.log('[OLLAMA] Building tree from', nodeData.length, 'nodes');
        
        // Build tree structure
        const nodesById = new Map();
        const nodesByKeyLower = new Map();
        const childrenByParent = new Map();
        const rootNodes = [];
        
        // First pass: index all nodes
        for (const node of nodeData) {
          const nodeKey = String(node?.nodeId || node?.nodeName || node?.ip || '').trim();
          if (!nodeKey) continue;
          nodesById.set(nodeKey, node);
          nodesByKeyLower.set(nodeKey.toLowerCase(), nodeKey);
        }
        
        console.log('[OLLAMA] Indexed', nodesById.size, 'nodes');
        
        // Second pass: build hierarchy
        for (const node of nodeData) {
          const nodeKey = String(node?.nodeId || node?.nodeName || node?.ip || '').trim();
          const parentIdRaw = String(node?.topology?.parentNodeId || '').trim();
          
          if (!parentIdRaw) {
            rootNodes.push(nodeKey);
            console.log('[OLLAMA] Root node:', nodeKey);
          } else {
            // Find parent by exact match or case-insensitive match
            const parentKeyLower = parentIdRaw.toLowerCase();
            const actualParentKey = nodesByKeyLower.get(parentKeyLower) || parentIdRaw;
            
            if (!childrenByParent.has(actualParentKey)) {
              childrenByParent.set(actualParentKey, []);
            }
            childrenByParent.get(actualParentKey).push(nodeKey);
            console.log('[OLLAMA] Child relationship:', nodeKey, '→', actualParentKey);
          }
        }
        
        console.log('[OLLAMA] Found', rootNodes.length, 'root nodes');
        
        // Format tree for Ollama
        const buildTreeText = (nodeKey, depth = 0, visited = new Set()) => {
          // Prevent infinite loops
          if (visited.has(nodeKey)) return '';
          visited.add(nodeKey);
          
          const node = nodesById.get(nodeKey);
          if (!node) return '';
          
          const indent = '  '.repeat(depth);
          let text = indent + '• ' + (node?.nodeName || nodeKey) + ` (${node?.ip || 'n/a'})`;
          
          const children = childrenByParent.get(nodeKey) || [];
          for (const childKey of children) {
            const childText = buildTreeText(childKey, depth + 1, visited);
            if (childText) text += '\n' + childText;
          }
          return text;
        };
        
        let treeText = 'Network Topology Tree:\n\n';
        for (const rootKey of rootNodes) {
          const rootText = buildTreeText(rootKey);
          if (rootText) treeText += rootText + '\n';
        }
        
        console.log('[OLLAMA] Tree formatted, sending to Ollama');
        
        // Ask Ollama to provide a nice summary of the tree
        const treePrompt = `Here is the network topology tree structure:\n\n${treeText}\n\nThe user asked: "${query}"\n\nProvide a clear, concise answer about the network topology and hierarchy.`;
        const answer = await ollamaGenerate(treePrompt);
        
        console.log('[OLLAMA] Tree query completed successfully');
        
        const treeResponse = {
          success: true,
          answer,
          model: process.env.OLLAMA_MODEL || 'phi3:latest',
          queryType,
          topology: {
            tree: treeText,
            rootNodes,
            totalNodes: nodeData.length
          }
        };
        
        // Cache the response
        responseCache.set(cacheKey, { response: treeResponse, timestamp: Date.now() });
        
        return res.json(treeResponse);
      } else if (isLedQuery && !isNodesQuery && !isServicesQuery && !queryTypes.has('queue-query')) {
        queryType = 'device-control';
        // For LED control, ask Ollama to parse the command
        finalQuery = `Parse this LED/light control request and respond with ONLY valid JSON (no other text):
{
  "action": "on" or "off" or "toggle",
  "node": "<node name like 'child1' or 'child2'>",
  "device": "LEDPIN"
}

User request: "${query}"`;
        
        const answer = await ollamaGenerate(finalQuery);
        try {
          // Extract JSON from response (may be wrapped in markdown)
          let jsonStr = answer;
          const jsonMatch = jsonStr.match(/```json\n([\s\S]*?)\n```/) || jsonStr.match(/```\n([\s\S]*?)\n```/) || jsonStr.match(/```([\s\S]*?)```/);
          if (jsonMatch && jsonMatch[1]) {
            jsonStr = jsonMatch[1].trim();
          }
          jsonStr = jsonStr.replace(/\/\/.*$/gm, '').replace(/,\s*([\]}])/g, '$1');
          
          const cmd = JSON.parse(jsonStr);
          if (cmd.action && cmd.node) {
            // Execute the device control
            deviceControl = await controlDeviceOnNode(cmd.node, cmd.device || 'LEDPIN', cmd.action);
          }
        } catch (e) {
          console.warn('[OLLAMA] LED command parse failed:', e.message);
        }
        
        return res.json({
          success: true,
          answer: deviceControl?.success 
            ? `LED ${deviceControl.action}ed on ${deviceControl.node}` 
            : 'Could not control LED',
          model: process.env.OLLAMA_MODEL || 'phi3:latest',
          queryType,
          deviceControl: deviceControl
        });
      } else if (isRelayQuery) {
        queryType = 'relay-control';
        // For relay control, ask Ollama to parse the command and return JSON
        finalQuery = `Parse this relay control request and respond with ONLY valid JSON (no other text):
{
  "action": "ON" or "OFF" or "PULSE",
  "node": "<node name or 'child2'>",
  "pin": <pin number or 12>,
  "duration": null or <milliseconds>
}

User request: "${query}"`;
      } else if (isNodesQuery || isServicesQuery) {
        // For node/service queries, brief mode - actual data fetched separately
        if (isNodesQuery) queryType = 'nodes-query';
        if (isServicesQuery) queryType = 'services-query';
        finalQuery = `Briefly summarize what the user is asking for in one sentence:\n\n"${query}"\n\nRespond with only a one-sentence summary, no details.`;
      }

      const answer = await ollamaGenerate(finalQuery);
      
      const generalResponse = {
        success: true,
        answer,
        model: process.env.OLLAMA_MODEL || 'phi3:latest',
        queryType,
        isBriefMode: isNodesQuery || isServicesQuery,
      };
      
      // Cache all responses
      responseCache.set(cacheKey, { response: generalResponse, timestamp: Date.now() });
      
      const queryElapsed = Date.now() - queryStartTime;
      if (queryElapsed > SLOW_QUERY_THRESHOLD) {
        recordSlowQuery(query, queryType || 'general', queryElapsed, true);
      }
      
      return res.json(generalResponse);
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      const queryElapsed = Date.now() - queryStartTime;
      if (queryElapsed > SLOW_QUERY_THRESHOLD) {
        recordSlowQuery(query, 'error', queryElapsed, false, msg);
      }
      console.error('[OLLAMA] Ask endpoint error:', msg);
      return res.status(500).json({ error: msg });
    }
  };

  const reloadHandler = async (req, res) => {
    try {
      const result = await reloadOllamaContext();
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(503).json({ success: false, error: result.error });
      }
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Reload endpoint error:', msg);
      res.status(500).json({ error: msg });
    }
  };

  const statusHandler = (req, res) => {
    try {
      const warmthStatus = getOllamaWarmthStatus();
      res.json({
        warmthKeeper: warmthStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Status endpoint error:', msg);
      res.status(500).json({ error: msg });
    }
  };

  /**
   * Get real network nodes (without LLM processing).
   * Useful for displaying actual node list alongside LLM responses.
   */
  const nodesHandler = async (req, res) => {
    try {
      const nodeData = await fetchNodeData();
      if (!nodeData) {
        return res.json({ nodes: [], count: 0 });
      }

      const nodes = Array.isArray(nodeData) ? nodeData : [nodeData];
      const summary = nodes
        .filter(n => n.nodeName) // Only nodes with names
        .map((node, idx) => ({
          id: node.nodeName || node.id,
          name: node.nodeName || 'Unknown',
          type: node.nodeType || (node.details?.hardware || 'Unknown'),
          ip: node.ip || 'N/A',
          status: node.status || node.details?.status || 'unknown',
          services: node.details?.services?.map(s => s.name) || [],
        }));

      return res.json({ nodes: summary, count: summary.length });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Nodes endpoint error:', msg);
      return res.status(500).json({ error: msg });
    }
  };

  /**
   * Gather all unique services across the network and their providers.
   */
  const servicesHandler = async (req, res) => {
    try {
      const nodeData = await fetchNodeData();
      if (!nodeData) {
        return res.json({ services: [], servicesByNode: {}, count: 0 });
      }

      const nodes = Array.isArray(nodeData) ? nodeData : [nodeData];
      const serviceMap = new Map(); // service -> Set of node names

      // Aggregate services from all nodes
      nodes.forEach(node => {
        const nodeName = node.nodeName || 'Unknown';
        const nodeServices = node.details?.services || [];
        
        if (Array.isArray(nodeServices)) {
          nodeServices.forEach(svc => {
            const serviceName = typeof svc === 'string' ? svc : (svc.name || '');
            if (serviceName && !serviceMap.has(serviceName)) {
              serviceMap.set(serviceName, []);
            }
            if (serviceName) {
              serviceMap.get(serviceName).push(nodeName);
            }
          });
        } else if (typeof nodeServices === 'string' && nodeServices.trim()) {
          // Handle space-separated services
          nodeServices.split(/\s+/).forEach(svc => {
            if (svc && !serviceMap.has(svc)) {
              serviceMap.set(svc, []);
            }
            if (svc) {
              serviceMap.get(svc).push(nodeName);
            }
          });
        }
      });

      // Convert to array format
      const services = Array.from(serviceMap.entries())
        .map(([name, providers]) => ({
          name,
          providers: [...new Set(providers)], // Deduplicate providers
          providerCount: new Set(providers).size
        }))
        .sort((a, b) => b.providerCount - a.providerCount); // Most common first

      return res.json({
        services,
        servicesByNode: Object.fromEntries(
          nodes
            .filter(n => n.nodeName)
            .map(node => [
              node.nodeName,
              node.details?.services
                ? (Array.isArray(node.details.services)
                    ? node.details.services.map(s => typeof s === 'string' ? s : s.name)
                    : node.details.services.split?.(/\s+/) || [])
                : []
            ])
        ),
        count: services.length
      });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Services endpoint error:', msg);
      return res.status(500).json({ error: msg });
    }
  };

  /**
   * Handle device control requests with automatic device lookup and hardware mapping
   * Body: { device, action: "on"|"off" }
   * Or: { deviceName, pin, value: 0|1 }
   */
  const deviceControlHandler = async (req, res) => {
    try {
      const { device, action, deviceName, pin, value } = req.body || {};
      
      // Support both high-level (device + action) and low-level (deviceName + pin + value) APIs
      let targetDevice, targetPin, targetValue;
      
      if (device && action) {
        // High-level API: device + action
        targetDevice = device;
        targetValue = action.toLowerCase() === 'on' ? 1 : 0;
        const deviceInfo = getDeviceInfo(targetDevice);
        if (!deviceInfo) {
          return res.status(404).json({
            error: `Device '${targetDevice}' not found in configuration`,
            availableDevices: Object.keys(deviceConfig.devices || {})
          });
        }
        targetPin = deviceInfo.ledPin;
      } else if (deviceName && pin !== undefined && value !== undefined) {
        // Low-level API: deviceName + pin + value
        targetDevice = deviceName;
        targetPin = pin;
        targetValue = value ? 1 : 0;
      } else {
        return res.status(400).json({
          error: 'Provide either (device + action) or (deviceName + pin + value)',
          examples: {
            highlevel: { device: 'child1', action: 'on' },
            lowlevel: { deviceName: 'child1', pin: 4, value: 1 }
          }
        });
      }
      
      const deviceInfo = getDeviceInfo(targetDevice);
      if (!deviceInfo) {
        return res.status(404).json({
          error: `Device '${targetDevice}' not found`,
          availableDevices: Object.keys(deviceConfig.devices || {})
        });
      }
      
      // Construct the GPIO command
      const gpioCmd = constructGpioCommand(targetDevice, targetPin, targetValue);
      if (!gpioCmd) {
        return res.status(500).json({ error: 'Failed to construct GPIO command' });
      }
      
      console.log('[OLLAMA] Device control command:', gpioCmd);
      
      // Send the command to the device
      try {
        const cmdResult = await sendGpioCommand(gpioCmd);
        console.log('[OLLAMA] Device command result:', cmdResult);
        
        return res.json({
          success: cmdResult.success,
          device: targetDevice,
          deviceType: deviceInfo.type,
          pin: targetPin,
          value: targetValue,
          action: targetValue ? 'ON' : 'OFF',
          ip: deviceInfo.ip,
          statusCode: cmdResult.statusCode,
          deviceResponse: cmdResult.response,
          message: `LED on ${targetDevice} turned ${targetValue ? 'ON' : 'OFF'}`
        });
      } catch (commError) {
        console.warn('[OLLAMA] Device communication error:', commError.message);
        
        // Return partial success - command was constructed correctly
        return res.status(202).json({
          success: false,
          warning: 'Device command constructed but communication failed',
          device: targetDevice,
          pin: targetPin,
          value: targetValue,
          error: commError.message,
          ip: deviceInfo.ip,
          port: deviceInfo.port || 80,
          message: `Could not reach ${targetDevice} at ${deviceInfo.ip}:${deviceInfo.port || 80}. Ensure device is online and accessible.`
        });
      }
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Device control error:', msg);
      return res.status(500).json({ error: msg });
    }
  };

  /**
   * POST /api/ollama/relay/control
   * Send a relay control command to a node.
   * Body: { nodeId, pin, action: "ON"|"OFF"|"PULSE", duration?: number }
   */
  const relayControlHandler = async (req, res) => {
    try {
      const { nodeId, pin, action, duration } = req.body || {};
      
      if (!nodeId || pin === undefined || !action) {
        return res.status(400).json({
          error: 'Required fields: nodeId, pin, action (ON|OFF|PULSE)',
          received: { nodeId, pin, action, duration }
        });
      }

      // Validate action
      if (!['ON', 'OFF', 'PULSE'].includes(action)) {
        return res.status(400).json({
          error: 'Action must be ON, OFF, or PULSE'
        });
      }

      // Build the control message
      const controlMsg = {
        type: 'relay-control',
        nodeId,
        pin: parseInt(pin),
        action,
        duration: action === 'PULSE' && duration ? parseInt(duration) : null,
        timestamp: new Date().toISOString()
      };

      console.log('[OLLAMA] Relay control command:', controlMsg);

      // In a real implementation, this would send the command to the node
      // For now, return a confirmation that can be displayed to the user
      return res.json({
        success: true,
        command: controlMsg,
        message: `Relay control command queued: ${action} relay on pin ${pin} of ${nodeId}${action === 'PULSE' && duration ? ` for ${duration}ms` : ''}`
      });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Relay control error:', msg);
      return res.status(500).json({ error: msg });
    }
  };

  const renameProjectHandler = async (req, res) => {
    try {
      const oldProjectId = String(req.body?.oldProjectId || '').trim();
      const newProjectId = String(req.body?.newProjectId || '').trim();
      if (!oldProjectId || !newProjectId) {
        return res.status(400).json({ error: 'oldProjectId and newProjectId are required' });
      }

      const result = renameProjectArtifacts({ oldProjectId, newProjectId });
      if (!result.success) {
        return res.status(400).json(result);
      }
      invalidateCachePatterns(['project', oldProjectId.toLowerCase(), newProjectId.toLowerCase()]);
      return res.json(result);
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      return res.status(500).json({ error: msg });
    }
  };

  const renameSubprojectHandler = async (req, res) => {
    try {
      const projectId = String(req.body?.projectId || OLLAMA_DEFAULT_PROJECT_ID).trim() || OLLAMA_DEFAULT_PROJECT_ID;
      const oldSubproject = String(req.body?.oldSubproject || '').trim();
      const newSubproject = String(req.body?.newSubproject || '').trim();
      if (!oldSubproject || !newSubproject) {
        return res.status(400).json({ error: 'oldSubproject and newSubproject are required' });
      }

      const result = renameSubprojectArtifacts({ projectId, oldSubproject, newSubproject });
      if (!result.success) {
        return res.status(400).json(result);
      }
      invalidateCachePatterns(['project', projectId.toLowerCase()]);
      return res.json(result);
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      return res.status(500).json({ error: msg });
    }
  };

  const deployProjectHandler = async (req, res) => {
    try {
      const projectId = String(req.body?.projectId || OLLAMA_DEFAULT_PROJECT_ID).trim() || OLLAMA_DEFAULT_PROJECT_ID;
      const subproject = String(req.body?.subproject || '').trim();
      const nodeId = String(req.body?.nodeId || '').trim();
      if (!nodeId) {
        return res.status(400).json({ error: 'nodeId is required' });
      }

      const result = await deployProjectArtifactsToNode({ projectId, subproject, nodeId });
      if (!result.success) {
        return res.status(400).json(result);
      }
      invalidateCachePatterns(['project', projectId.toLowerCase(), 'deploy', nodeId.toLowerCase()]);
      return res.json(result);
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      return res.status(500).json({ error: msg });
    }
  };

  const runtimeStateHandler = async (_req, res) => {
    try {
      const result = await fetchQueueGatewayRuntimeState();
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result.runtimeState);
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      return res.status(500).json({ error: msg });
    }
  };

  /**
   * POST /api/ollama/ask
   * Send a direct natural-language question to Ollama.
   */
  app.post('/api/ollama/ask', askHandler);
  app.post('/api/openai/ask', askHandler);

  /**
   * POST /api/ollama/ask-stream
   * Stream responses in real-time using Server-Sent Events (SSE).
   * Responses are streamed word-by-word as they're generated.
   * Pre-computed answers are sent immediately (~<50ms).
   * Useful for perceived latency reduction on slow queries.
   */
  app.post('/api/ollama/ask-stream', streamingAskHandler);
  app.post('/api/openai/ask-stream', streamingAskHandler);

  /**
   * POST /api/ollama/relay/control
   * Control relays on network nodes.
   */
  app.post('/api/ollama/relay/control', relayControlHandler);
  app.post('/api/openai/relay/control', relayControlHandler);

  app.post('/api/ollama/projects/rename', renameProjectHandler);
  app.post('/api/openai/projects/rename', renameProjectHandler);

  app.post('/api/ollama/subprojects/rename', renameSubprojectHandler);
  app.post('/api/openai/subprojects/rename', renameSubprojectHandler);

  app.post('/api/ollama/projects/deploy', deployProjectHandler);
  app.post('/api/openai/projects/deploy', deployProjectHandler);

  app.get('/api/ollama/runtime/state', runtimeStateHandler);
  app.get('/api/openai/runtime/state', runtimeStateHandler);

  /**
   * POST /api/ollama/device-control
   * Control ESP32/ESP8266 devices with automatic hardware mapping.
   * High-level: { device: "child1", action: "on" }
   * Low-level: { deviceName: "child1", pin: 4, value: 1 }
   */
  app.post('/api/ollama/device-control', deviceControlHandler);
  app.post('/api/openai/device-control', deviceControlHandler);

  /**
   * POST /api/ollama/reload
   * Force reload of Ollama context, clearing old state and preparing for fresh analysis.
   */
  app.post('/api/ollama/reload', reloadHandler);
  app.post('/api/openai/reload', reloadHandler);

  /**
   * GET /api/ollama/status
   * Get warmth keeper status and Ollama diagnostics.
   */
  app.get('/api/ollama/status', statusHandler);
  app.get('/api/openai/status', statusHandler);

  /**
   * GET /api/ollama/nodes
   * Get real network nodes (without LLM processing).
   */
  app.get('/api/ollama/nodes', nodesHandler);
  app.get('/api/openai/nodes', nodesHandler);

  /**
   * GET /api/ollama/services
   * Get all services available across the network, grouped by provider.
   */
  app.get('/api/ollama/services', servicesHandler);
  app.get('/api/openai/services', servicesHandler);

  /**
   * GET /api/ollama/slow-queries
   * Retrieve recorded slow queries (>60s) for analysis and optimization.
   */
  app.get('/api/ollama/slow-queries', (req, res) => {
    try {
      if (!fs.existsSync(SLOW_QUERY_LOG_FILE)) {
        return res.json({ queries: [], total: 0, message: 'No slow queries recorded yet' });
      }
      const content = fs.readFileSync(SLOW_QUERY_LOG_FILE, 'utf8');
      const queries = content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
      res.json({
        queries: queries.slice(-100), // Last 100 slow queries
        total: queries.length,
        avgDurationMs: queries.length > 0 ? Math.round(queries.reduce((sum, q) => sum + q.durationMs, 0) / queries.length) : 0,
        successCount: queries.filter(q => q.success).length,
        errorCount: queries.filter(q => !q.success).length
      });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Slow queries endpoint error:', msg);
      res.status(500).json({ error: msg });
    }
  });
  app.get('/api/openai/slow-queries', (req, res) => {
    // Alias for compatibility
    app._router.stack.find(r => r.route?.path === '/api/ollama/slow-queries')?.route?.stack[0].handle(req, res);
  });

  /**
   * GET /api/topology
   * Lightweight topology endpoint - returns only topology structure (minimal payload)
   * Useful for frontend tree views and topology operations without full node details
   */
  const topologyHandler = async (req, res) => {
    try {
      const nodeData = await fetchNodeData();
      if (!nodeData || nodeData.length === 0) {
        return res.json({ nodes: [], topology: {} });
      }

      // Build minimal topology structure
      const topologyNodes = nodeData.map(node => ({
        nodeId: node?.nodeId || node?.nodeName || node?.ip || '',
        nodeName: node?.nodeName || '',
        ip: node?.ip || '',
        port: node?.port || 80,
        parentNodeId: node?.topology?.parentNodeId || '',
        children: (node?.topology?.childNodeIds || '').toString().split(' ').filter(c => c),
        isClusterController: node?.topology?.clusterController === true,
        hardware: node?.hardware || node?.details?.hardware || ''
      }));

      // Build parent-child relationships
      const childrenByParent = new Map();
      const rootNodes = [];

      for (const node of topologyNodes) {
        if (!node.parentNodeId) {
          rootNodes.push(node.nodeId);
        } else {
          if (!childrenByParent.has(node.parentNodeId)) {
            childrenByParent.set(node.parentNodeId, []);
          }
          childrenByParent.get(node.parentNodeId).push(node.nodeId);
        }
      }

      res.json({
        nodes: topologyNodes,
        totalNodes: topologyNodes.length,
        rootNodes,
        topology: Object.fromEntries(childrenByParent)
      });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Topology endpoint error:', msg);
      res.status(500).json({ error: msg });
    }
  };

  app.get('/api/topology', topologyHandler);

  /**
   * POST /agent
   * Unified voice/chat console endpoint used by bob-console.html.
   * Accepts multipart/form-data with a `message` field (and optional `files`),
   * OR application/json with a `message` field.
   *
   * Special messages:
   *   __RESET_MODEL__ – clears the response cache and reloads the Ollama context.
   *
   * Intent dispatch is driven by data/agent-routes.json — add intents there,
   * not here. The formatters below are keyed by the "formatter" field in that file.
   *
   * Returns: { output: string }
   */
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  // ── Live API helper ──────────────────────────────────────────────────────────
  const fetchLocalApi = (apiPath) => new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:4000${apiPath}`, { timeout: 5000 }, (apiRes) => {
      let raw = '';
      apiRes.on('data', chunk => { raw += chunk; });
      apiRes.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });

  // ── Formatters (keyed by the "formatter" field in agent-routes.json) ─────────
  const FORMATTERS = {

    nodes(data) {
      const nodes = data?.nodes ?? (Array.isArray(data) ? data : []);
      const rows = nodes.map(n => {
        const statusColor = n.status === 'ok' || n.status === 'available' ? '#2da44e' : '#cf222e';
        const services = (n.services || []).join(', ') || '—';
        return `<tr>
          <td style="padding:6px 10px;font-weight:500">${n.name || n.nodeName || n.nodeId}</td>
          <td style="padding:6px 10px;font-family:monospace">${n.ip}</td>
          <td style="padding:6px 10px">${n.type || n.hardware || '—'}</td>
          <td style="padding:6px 10px"><span style="color:${statusColor};font-weight:600">${n.status}</span></td>
          <td style="padding:6px 10px;color:#57606a;font-size:12px">${services}</td>
        </tr>`;
      }).join('');
      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif">
        <p style="margin:0 0 8px;font-size:13px;color:#57606a">${nodes.length} node${nodes.length !== 1 ? 's' : ''} on the network</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f7f8fa;text-align:left">
            <th style="padding:6px 10px;border-bottom:1px solid #e5e7eb">Name</th>
            <th style="padding:6px 10px;border-bottom:1px solid #e5e7eb">IP</th>
            <th style="padding:6px 10px;border-bottom:1px solid #e5e7eb">Hardware</th>
            <th style="padding:6px 10px;border-bottom:1px solid #e5e7eb">Status</th>
            <th style="padding:6px 10px;border-bottom:1px solid #e5e7eb">Services</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    },

    'esp-nodes'(data) {
      const all = Array.isArray(data) ? data : [];
      const esp = all
        .filter(n => /esp/i.test(n.hardware || n.kind || ''))
        .map(n => ({
          name: n.nodeName, ip: n.ip, type: n.hardware, status: n.status,
          services: (n.details?.services || []).map(s => typeof s === 'string' ? s : s.name)
        }));
      return esp.length ? FORMATTERS.nodes({ nodes: esp }) : '<p style="font-family:-apple-system,sans-serif;color:#57606a">No ESP devices found.</p>';
    },

    topology(data) {
      const nodeMap = new Map((data.nodes || []).map(n => [n.nodeId, n]));
      const childrenOf = new Map();
      for (const n of (data.nodes || [])) {
        if (n.parentNodeId) {
          if (!childrenOf.has(n.parentNodeId)) childrenOf.set(n.parentNodeId, []);
          childrenOf.get(n.parentNodeId).push(n.nodeId);
        }
      }
      const renderNode = (nodeId, depth) => {
        const n = nodeMap.get(nodeId);
        if (!n) return '';
        const indent = depth * 20;
        const badge = n.isClusterController ? ' <span style="font-size:10px;background:#3b82d4;color:#fff;border-radius:3px;padding:1px 5px">controller</span>' : '';
        let html = `<div style="padding:4px 0 4px ${indent}px;font-size:13px">
          <span style="color:#57606a;margin-right:6px">${depth > 0 ? '└─' : '●'}</span>
          <strong>${n.nodeName}</strong> <span style="font-family:monospace;color:#57606a">${n.ip}</span>
          <span style="color:#57606a;font-size:11px;margin-left:6px">${n.hardware || ''}</span>${badge}
        </div>`;
        for (const cid of (childrenOf.get(nodeId) || [])) html += renderNode(cid, depth + 1);
        return html;
      };
      const roots = data.rootNodes || [];
      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif">
        <p style="margin:0 0 8px;font-size:13px;color:#57606a">${data.totalNodes || 0} nodes · ${roots.length} root${roots.length !== 1 ? 's' : ''}</p>
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px;background:#fff">${roots.map(r => renderNode(r, 0)).join('')}</div>
      </div>`;
    },

    services(data) {
      const rows = (data.services || []).map(s =>
        `<tr>
          <td style="padding:6px 10px;font-weight:500">${s.name}</td>
          <td style="padding:6px 10px">${s.providers.join(', ')}</td>
          <td style="padding:6px 10px;text-align:center">${s.providerCount}</td>
        </tr>`
      ).join('');
      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif">
        <p style="margin:0 0 8px;font-size:13px;color:#57606a">${data.count || 0} services across the network</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f7f8fa;text-align:left">
            <th style="padding:6px 10px;border-bottom:1px solid #e5e7eb">Service</th>
            <th style="padding:6px 10px;border-bottom:1px solid #e5e7eb">Providers</th>
            <th style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">Count</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    },
  };

  app.post('/agent', upload.array('files'), async (req, res) => {
    try {
      const message = String(req.body?.message || '').trim();
      if (!message) return res.status(400).json({ output: 'No message provided.' });

      console.log(`[AGENT] message="${message.substring(0, 80)}"`);

      // ── Reset ──────────────────────────────────────────────────────────────
      if (message === '__RESET_MODEL__') {
        responseCache.clear();
        const reloadResult = await reloadOllamaContext();
        return res.json({
          output: reloadResult.success
            ? 'Model context cleared and reloaded successfully.'
            : `Reset attempted, but reload reported: ${reloadResult.error || 'unknown error'}`
        });
      }

      // ── Intent dispatch (driven by data/agent-routes.json) ─────────────────
      const intent = await matchAgentIntent(message);
      if (intent) {
        console.log(`[AGENT] intent="${intent.id}" api="${intent.api}" formatter="${intent.formatter}"`);
        const data = await fetchLocalApi(intent.api);
        const formatter = FORMATTERS[intent.formatter];
        if (data && formatter) {
          return res.json({ output: formatter(data) });
        }
        console.warn(`[AGENT] intent "${intent.id}" matched but api/formatter failed — falling through`);
      }

      // ── Fall through to Ollama askHandler for everything else ──────────────
      const syntheticReq = { body: { query: message }, files: req.files || [] };
      let settled = false;
      await new Promise((resolve) => {
        const syntheticRes = {
          status(code) { this._status = code; return this; },
          json(data) {
            if (settled) return;
            settled = true;
            res.json({ output: data?.answer || data?.output || JSON.stringify(data, null, 2) });
            resolve();
          }
        };
        Promise.resolve(askHandler(syntheticReq, syntheticRes)).catch((err) => {
          if (!settled) { settled = true; res.json({ output: `Error: ${err.message || String(err)}` }); }
          resolve();
        });
      });

    } catch (e) {
      console.error('[AGENT] Unhandled error:', e?.message || String(e));
      res.status(500).json({ output: `Server error: ${e?.message || String(e)}` });
    }
  });

  console.log('[OLLAMA] Routes registered at /api/ollama/* and /api/openai/* (compat)');
  console.log('[AGENT] /agent endpoint registered (BOB Console)');
}
