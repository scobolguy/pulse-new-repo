import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import multer from 'multer';
import { reloadOllamaContext, getOllamaWarmthStatus, ollamaGenerate, ollamaGenerateStream, rebuildSystemPrompt } from './ollamaService.mjs';

// ── Partial result store for streaming NLI queries ──────────────────────────
// Keyed by interactionId. Holds { text, partial, startedAt, completedAt, message }
const partialResults = new Map();
const PARTIAL_TTL_MS = 30 * 60 * 1000; // 30 min

function savePartial(id, data) {
  partialResults.set(id, { ...data, savedAt: Date.now() });
  // Evict stale entries
  for (const [key, entry] of partialResults) {
    if (Date.now() - entry.savedAt > PARTIAL_TTL_MS) partialResults.delete(key);
  }
}

function getPartial(id) {
  return partialResults.get(String(id || '')) || null;
}
import { matchPascalExecuteRoute, matchPrecomputedRoute, detectQueryTypes } from './queryRouteLoader.mjs';
import { matchAgentIntent } from './agentRouteLoader.mjs';
import { getNliConfig } from './nliConfig.mjs';
import { getNliCorrectionStatus, runPendingNliCorrections } from './nliCorrectionService.mjs';
import { buildAuthoredFlowDocument, buildAuthoredFlowPcodeArtifacts, normalizeFlowTypeId, parseFlowAuthoringPrompt } from './flowAuthoringAgent.mjs';

const SLOW_QUERY_THRESHOLD = 60000; // 60 seconds
const SLOW_QUERY_LOG_FILE = path.resolve('./data/logs/slow-queries.jsonl');

function escapeAgentHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Ensure logs directory exists
const logsDir = path.resolve('./data/logs');
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

  const requestNodeJson = ({ host, port = 80, path: requestPath, method = 'GET', timeout = 8000 }) => new Promise((resolve) => {
    const request = http.request({ hostname: host, port, path: requestPath, method, timeout }, response => {
      let raw = '';
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        let data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch { data = { error: raw || 'Invalid device response' }; }
        resolve({ status: response.statusCode || 0, data });
      });
    });
    request.on('error', error => resolve({ status: 503, data: { error: error.message } }));
    request.on('timeout', () => {
      request.destroy();
      resolve({ status: 504, data: { error: 'Device request timed out' } });
    });
    request.end();
  });

  const normalizeDeviceName = value => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^(?:the|some)\s+/, '')
    .replace(/[^a-z0-9]/g, '');

  const nodeServices = node => (Array.isArray(node?.details?.services) ? node.details.services : [])
    .map(service => String(typeof service === 'string' ? service : service?.name || '').toLowerCase());

  const resolveNamedNode = (nodes, requestedName, capability = '') => {
    const requested = normalizeDeviceName(requestedName);
    if (!requested) return null;

    const candidates = (Array.isArray(nodes) ? nodes : []).filter(node => {
      if (!capability) return true;
      const hardware = String(node?.hardware || node?.details?.hardware || '').toLowerCase();
      const role = String(node?.deviceRole || node?.details?.deviceRole || '').toLowerCase();
      return nodeServices(node).includes(capability) || hardware.includes(capability) || role.includes(capability);
    }).sort((left, right) => {
      const score = node => {
        const hardware = String(node?.hardware || node?.details?.hardware || '').toLowerCase();
        const role = String(node?.deviceRole || node?.details?.deviceRole || '').toLowerCase();
        return (hardware.includes(capability) ? 4 : 0)
          + (role.includes(capability) ? 2 : 0)
          + (nodeServices(node).includes(capability) ? 1 : 0);
      };
      return score(right) - score(left);
    });
    const exact = candidates.find(node => [node?.nodeId, node?.nodeName, node?.ip]
      .some(value => normalizeDeviceName(value) === requested));
    if (exact) return exact;

    const numbered = requested.match(new RegExp(`^${capability}(\\d+)$`));
    if (numbered) return candidates[Number(numbered[1]) - 1] || null;
    return null;
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
      const streamResult0 = await ollamaGenerateStream(query, {});
      const fullResponse = streamResult0.text ?? streamResult0;

      // Split response into chunks and stream
      const words = (typeof fullResponse === 'string' ? fullResponse : '').split(' ');
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
        const treeStreamResult = await ollamaGenerateStream(treePrompt, {});
        const answer = treeStreamResult.text ?? treeStreamResult;
        
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
        
        const ledStreamResult = await ollamaGenerateStream(finalQuery, {});
        const answer = ledStreamResult.text ?? ledStreamResult;
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

      const generalStreamResult = await ollamaGenerateStream(finalQuery, {});
      const answer = generalStreamResult.text ?? generalStreamResult;

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

      // Build minimal topology structure while retaining the effective HTTP transport.
      const topologyNodes = nodeData.map(node => {
        let rawMetadata = null;
        try { rawMetadata = typeof node?.raw === 'string' ? JSON.parse(node.raw) : node?.raw; } catch { rawMetadata = null; }
        const protocolCandidates = [
          node?.protocol,
          node?.scheme,
          node?.url,
          node?.baseUrl,
          node?.statusUrl,
          node?.servicesUrl,
          node?.details?.protocol,
          node?.details?.scheme,
          node?.details?.url,
          node?.details?.baseUrl,
          node?.details?.statusUrl,
          node?.details?.servicesUrl,
          rawMetadata?.statusUrl,
          rawMetadata?.servicesUrl
        ];
        const advertisedUrl = protocolCandidates.find(value => /^https?:\/\//i.test(String(value || '').trim()));
        let advertisedPort = null;
        if (advertisedUrl) {
          try { advertisedPort = Number(new URL(String(advertisedUrl)).port || 0) || null; } catch { advertisedPort = null; }
        }
        const usesHttps = node?.httpsPort != null
          || node?.details?.httpsPort != null
          || node?.httpsEnabled === true
          || node?.details?.httpsEnabled === true
          || protocolCandidates.some(value => /^https(?::|$)/i.test(String(value || '').trim()));
        const protocol = usesHttps ? 'https' : 'http';
        const port = Number(usesHttps
          ? (node?.httpsPort || node?.details?.httpsPort || advertisedPort || node?.port || 443)
          : (advertisedPort || node?.port || node?.details?.httpPort || 80));
        const ip = node?.ip || '';
        return {
          nodeId: node?.nodeId || node?.nodeName || ip || '',
          nodeName: node?.nodeName || '',
          ip,
          port,
          protocol,
          endpoint: ip ? `${protocol}://${ip}${port === (usesHttps ? 443 : 80) ? '' : `:${port}`}` : '',
          parentNodeId: node?.topology?.parentNodeId || '',
          children: (node?.topology?.childNodeIds || '').toString().split(' ').filter(c => c),
          isClusterController: node?.topology?.clusterController === true,
          hardware: node?.hardware || node?.details?.hardware || ''
        };
      });

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
  * POST /api/nli/query
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
    const opts = {
      timeout: 5000,
      headers: { 'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID }
    };
    const req = http.get(`http://127.0.0.1:4000${apiPath}`, opts, (apiRes) => {
      let raw = '';
      apiRes.on('data', chunk => { raw += chunk; });
      apiRes.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });

  const postLocalApi = (apiPath, body, requestHeaders = {}) => new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const backendPort = Number(process.env.HTTP_PORT || process.env.PORT || 4000);
    const req = http.request({
      hostname: '127.0.0.1',
      port: backendPort,
      path: apiPath,
      method: 'POST',
      timeout: 120000,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID,
        ...requestHeaders
      }
    }, (apiRes) => {
      let raw = '';
      apiRes.on('data', chunk => { raw += chunk; });
      apiRes.on('end', () => {
        try {
          resolve({ status: apiRes.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: apiRes.statusCode, data: { error: raw || 'Invalid backend response' } });
        }
      });
    });
    req.on('error', error => resolve({ status: 503, data: { error: error.message } }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 504, data: { error: 'MAPL authoring request timed out' } });
    });
    req.end(payload);
  });

  // ── Agent summary endpoints (used by agent-routes.json api fields) ───────────

  /**
   * GET /api/agent/queue-summary
   * Aggregates queue depths + maxLength (capacity) from all managers, gateway state, manager list.
   * Merges maxLength from each manager's /api/queues/:managerId/config so capacity % is available.
   */
  app.get('/api/agent/queue-summary', async (req, res) => {
    try {
      const [queuesData, managersData, gatewaysData] = await Promise.all([
        fetchLocalApi('/api/registry/queues'),
        fetchLocalApi('/api/registry/queue-managers'),
        fetchLocalApi('/api/gateways'),
      ]);

      const registryQueues = Array.isArray(queuesData?.queues) ? queuesData.queues : [];
      const managers       = Array.isArray(managersData?.queueManagers) ? managersData.queueManagers : [];

      // Collect every local manager id — from the registry plus well-known defaults.
      const registryManagerIds = [...new Set(registryQueues.map(q => q.managerId).filter(Boolean))];
      const localManagerIds    = managers.filter(m => m.local).map(m => m.managerId);
      const allManagerIds      = [...new Set([...registryManagerIds, ...localManagerIds, 'qm-primary', 'qm-secondary'])];

      // Fetch config from every manager in parallel to get the full queue list + maxLength.
      const maxLengthByQueue = {};
      const configQueuesByManager = {};
      await Promise.all(allManagerIds.map(async (managerId) => {
        try {
          const cfg = await fetchLocalApi(`/api/queues/${encodeURIComponent(managerId)}/config`);
          const queuesMap = cfg?.queues || {};
          configQueuesByManager[managerId] = queuesMap;
          for (const [queueName, queueCfg] of Object.entries(queuesMap)) {
            const ml = Number(queueCfg?.maxLength || 0);
            if (ml > 0 && !maxLengthByQueue[queueName]) {
              maxLengthByQueue[queueName] = ml;
            }
          }
        } catch { /* manager unreachable — skip */ }
      }));

      // Build a depth lookup from the registry.
      const depthByQueue = {};
      for (const q of registryQueues) {
        depthByQueue[q.queueName] = Number(q.queueLength ?? 0);
      }

      // Union: start with registry entries, then add any config-only queues not already present.
      const seenQueues = new Set(registryQueues.map(q => `${q.managerId}::${q.queueName}`));
      const extraQueues = [];
      for (const [managerId, queuesMap] of Object.entries(configQueuesByManager)) {
        for (const queueName of Object.keys(queuesMap)) {
          const key = `${managerId}::${queueName}`;
          if (!seenQueues.has(key)) {
            seenQueues.add(key);
            extraQueues.push({ queueName, managerId, queueLength: 0 });
          }
        }
      }

      // Fetch live depths for config-only queues via their export endpoint.
      await Promise.all(extraQueues.map(async (q) => {
        try {
          const exportData = await fetchLocalApi(`/api/queues/${encodeURIComponent(q.managerId)}/${encodeURIComponent(q.queueName)}/export`);
          if (exportData && !exportData.error && Array.isArray(exportData.messages)) {
            q.queueLength = exportData.messages.length;
          }
        } catch { /* unreachable — leave as 0 */ }
      }));

      const allRawQueues = [...registryQueues, ...extraQueues];

      // Merge maxLength into every queue entry.
      const queues = allRawQueues.map(q => ({
        ...q,
        maxLength: maxLengthByQueue[q.queueName] || maxLengthByQueue[q.queue] || 0,
      }));

      res.json({
        queues,
        managers,
        gateways: (gatewaysData && typeof gatewaysData === 'object') ? gatewaysData : {},
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/agent/librarian-summary
   * Aggregates data types and schema catalog from the librarian service for the agent formatter.
   */
  app.get('/api/agent/librarian-summary', async (req, res) => {
    try {
      const [typesData, schemasData] = await Promise.all([
        fetchLocalApi('/api/librarian/data-types'),
        fetchLocalApi('/api/librarian/schemas'),
      ]);
      res.json({
        types:   Array.isArray(typesData?.types)     ? typesData.types   : [],
        schemas: Array.isArray(schemasData?.schemas) ? schemasData.schemas : [],
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/agent/queue-item?manager=qm-primary&queue=swift.mt103.inbound&index=0
   *
   * Non-destructively reads one message from a local queue manager (peek by position).
   * Runs three validation tiers against the queue's declared dataTypeIds and any
   * matching schema in the librarian:
   *   1. Structural shape  — does the message match the declared type at all?
   *   2. XSD field presence — for XML/ISO payloads: are required elements present?
   *   3. Enum conformance   — do constrained fields carry a value in the allowed set?
   *
   * Returns everything the queueItem formatter needs in one payload.
   */
  app.get('/api/agent/queue-item', async (req, res) => {
    try {
      const managerId  = String(req.query.manager || 'qm-primary').trim();
      const queueName  = String(req.query.queue   || '').trim();
      const itemIndex  = Math.max(0, parseInt(req.query.index || '0', 10) || 0);

      if (!queueName) return res.status(400).json({ error: 'queue parameter is required' });

      // ── 1. Fetch the message from the local queue manager via its config API ──
      const configData = await fetchLocalApi(`/api/queues/${encodeURIComponent(managerId)}/config`);
      const queueCfg   = configData?.queues?.[queueName] || null;
      if (!queueCfg) {
        // Try the export endpoint as fallback — it includes messages for local managers
        const exportData = await fetchLocalApi(`/api/queues/${encodeURIComponent(managerId)}/${encodeURIComponent(queueName)}/export`);
        if (!exportData || exportData.error) {
          return res.status(404).json({ error: `Queue ${queueName} not found on manager ${managerId}` });
        }
        const msgs = Array.isArray(exportData.messages) ? exportData.messages : [];
        if (msgs.length === 0) return res.json({ empty: true, queueName, managerId, itemIndex, dataTypeIds: [], validations: [], schema: null, item: null });
        const item = msgs[Math.min(itemIndex, msgs.length - 1)];
        return res.json({ empty: false, queueName, managerId, itemIndex, queueLength: msgs.length,
          dataTypeIds: [], validations: [], schema: null, item });
      }

      // Use the per-queue export to get actual messages non-destructively
      const exportData = await fetchLocalApi(`/api/queues/${encodeURIComponent(managerId)}/${encodeURIComponent(queueName)}/export`);
      const msgs = Array.isArray(exportData?.messages) ? exportData.messages : [];

      if (msgs.length === 0) {
        return res.json({ empty: true, queueName, managerId, itemIndex, queueLength: 0,
          dataTypeIds: queueCfg.dataTypeIds || [queueCfg.dataTypeId || 'text-string'],
          validations: [], schema: null, item: null });
      }

      const item       = msgs[Math.min(itemIndex, msgs.length - 1)];
      const dataTypeIds = Array.isArray(queueCfg.dataTypeIds) && queueCfg.dataTypeIds.length
        ? queueCfg.dataTypeIds
        : (queueCfg.dataTypeId ? [queueCfg.dataTypeId] : ['text-string']);
      const primaryType = dataTypeIds[0];

      // ── 2. Tier-1: structural shape check ─────────────────────────────────
      const message    = item.message;
      const validations = [];

      const shape      = !message ? 'null'
        : typeof message === 'string'     ? 'string'
        : Array.isArray(message)          ? 'array'
        : typeof message === 'object' && message.Document  ? 'iso20022-document'
        : typeof message === 'object' && message.finEnvelope ? 'swift-fin-envelope'
        : typeof message === 'object'     ? 'object'
        : typeof message;

      function tier1Check(typeId, msg) {
        const t = String(typeId || '').toLowerCase();
        if (!t || t === 'text-string') return { valid: true, tier: 'structural', typeId };
        if (t === 'pacs') {
          const ok = msg && typeof msg === 'object' && msg.Document && typeof msg.Document === 'object';
          return { valid: ok, tier: 'structural', typeId,
            reason: ok ? null : 'Expected ISO 20022 object with top-level Document key' };
        }
        if (t === 'swift-mt103') {
          const ok = (typeof msg === 'string' && msg.toUpperCase().startsWith('MT103'))
            || (msg && typeof msg === 'object' && msg.finEnvelope?.block4?.fields);
          return { valid: ok, tier: 'structural', typeId,
            reason: ok ? null : 'Expected MT103 raw string or parsed finEnvelope.block4.fields object' };
        }
        if (t === 'swift-mt202' || t === 'swift-mt202cov') {
          const prefix = t === 'swift-mt202cov' ? 'MT202COV' : 'MT202';
          const ok = (typeof msg === 'string' && msg.toUpperCase().startsWith(prefix))
            || (msg && typeof msg === 'object' && msg.finEnvelope?.block4?.fields);
          return { valid: ok, tier: 'structural', typeId,
            reason: ok ? null : `Expected ${prefix} string or parsed finEnvelope.block4.fields object` };
        }
        return { valid: true, tier: 'structural', typeId };
      }

      for (const typeId of dataTypeIds) validations.push(tier1Check(typeId, message));

      // ── 3. Fetch matching schema from librarian (best-effort) ─────────────
      const schemasData   = await fetchLocalApi('/api/librarian/schemas');
      const allSchemas    = Array.isArray(schemasData?.schemas) ? schemasData.schemas : [];

      // Match on typeId — a schema whose typeId prefix matches primaryType (e.g. 'pacs' matches pacs.002.001.12)
      const normalPrimary = primaryType.toLowerCase().replace(/^swift-/, '');
      const matchedSchema = allSchemas.find(s => {
        const tid = String(s.typeId || '').toLowerCase();
        return tid === normalPrimary || tid.startsWith(normalPrimary + '.') || normalPrimary.startsWith(tid);
      }) || null;

      // ── 4. Tier-2: XSD / JSON field-presence check using librarian tree ──
      if (matchedSchema?.structure && typeof message === 'object' && message !== null) {
        const tree = matchedSchema.structure;

        // Flatten required leaf/branch names from the schema tree (1 level deep for brevity)
        function collectRequired(node, depth = 0) {
          const found = [];
          if (!node || !Array.isArray(node.children)) return found;
          for (const child of node.children) {
            if (child.required !== false) {  // required is true when minOccurs > 0 or unset
              found.push({ name: child.name, required: child.required !== false, valueType: child.valueType || null,
                isEnum: child.isEnum || false, enumValues: child.enumValues || [], depth });
            }
            if (Array.isArray(child.children) && child.children.length > 0 && depth < 2) {
              found.push(...collectRequired(child, depth + 1));
            }
          }
          return found;
        }

        // Flatten the message object to a set of present key names (recursive, max depth 4)
        function collectKeys(obj, depth = 0) {
          const keys = new Set();
          if (!obj || typeof obj !== 'object' || depth > 4) return keys;
          for (const [k, v] of Object.entries(obj)) {
            keys.add(k.toLowerCase());
            for (const sk of collectKeys(v, depth + 1)) keys.add(sk);
          }
          return keys;
        }

        const requiredFields = collectRequired(tree);
        const presentKeys    = collectKeys(message);

        for (const field of requiredFields.slice(0, 30)) {  // cap at 30 to keep response manageable
          const present = presentKeys.has(field.name.toLowerCase());
          const v = { tier: 'field-presence', field: field.name, required: field.required,
            present, valid: !field.required || present,
            reason: (!field.required || present) ? null : `Required field "${field.name}" not found in message` };

          // Tier-3: enum check if the field is present and has enumValues
          if (present && field.isEnum && field.enumValues.length > 0) {
            // Find the value in the message (shallow search)
            function findValue(obj, key, d = 0) {
              if (!obj || typeof obj !== 'object' || d > 4) return undefined;
              const lk = key.toLowerCase();
              for (const [k, val] of Object.entries(obj)) {
                if (k.toLowerCase() === lk) return val;
                const found = findValue(val, key, d + 1);
                if (found !== undefined) return found;
              }
              return undefined;
            }
            const val = findValue(message, field.name);
            if (val !== undefined && val !== null) {
              const valStr = String(val);
              const enumOk = field.enumValues.includes(valStr);
              v.enumCheck = { value: valStr, allowedValues: field.enumValues.slice(0, 20), valid: enumOk };
              if (!enumOk) {
                v.valid = false;
                v.reason = `Field "${field.name}" value "${valStr}" is not in allowed enum [${field.enumValues.slice(0,5).join(', ')}${field.enumValues.length > 5 ? '…' : ''}]`;
              }
            }
          }
          validations.push(v);
        }
      }

      // ── 5. Try to parse XML string payloads so the formatter can render them ─
      let parsedXml = null;
      if (typeof message === 'string' && message.trimStart().startsWith('<')) {
        try {
          const { XMLParser } = await import('fast-xml-parser');
          const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: true, trimValues: true });
          parsedXml = parser.parse(message);
        } catch { /* leave parsedXml null */ }
      }

      res.json({
        empty: false,
        queueName,
        managerId,
        itemIndex,
        queueLength: msgs.length,
        dataTypeIds,
        shape,
        item,
        parsedXml,
        schema: matchedSchema ? {
          path: matchedSchema.path,
          typeId: matchedSchema.typeId,
          type: matchedSchema.type,
          lifecycle: matchedSchema.lifecycle,
        } : null,
        validations,
      });

    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/agent/queue-query
   *
   * SQL-like SELECT on queue messages (non-destructive peek).
   *
   * Query parameters:
   *   queue    – queue name (required)
   *   manager  – queue manager id (default: qm-primary)
   *   select   – comma-separated dot-path field names to project from each message,
   *              e.g. "messageId,sourceService,message.Amount,messageEnvelope.dataTypeId"
   *              Use * or omit to project all top-level fields.
   *   where    – optional filter expression: <dot-path><op><value>
   *              Supported operators: =, !=, >, <, >=, <=, ~= (case-insensitive regex contains)
   *              e.g. "sourceService=router" or "message.Currency=USD"
   *   limit    – max rows to return (default 50, max 500)
   *   offset   – skip first N rows (default 0)
   *
   * Returns:
   *   { queue, manager, totalMessages, matchedCount, columns: string[], rows: object[] }
   */
  app.get('/api/agent/queue-query', async (req, res) => {
    try {
      const managerId = String(req.query.manager || 'qm-primary').trim();
      const queueName = String(req.query.queue   || '').trim();
      const selectRaw = String(req.query.select  || '*').trim();
      const whereRaw  = String(req.query.where   || '').trim();
      const limitRaw  = parseInt(req.query.limit  || '50', 10);
      const offsetRaw = parseInt(req.query.offset || '0',  10);
      const limit     = Number.isFinite(limitRaw)  && limitRaw  > 0 ? Math.min(limitRaw,  500) : 50;
      const offset    = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

      if (!queueName) return res.status(400).json({ error: 'queue parameter is required' });

      // ── Fetch messages non-destructively via export endpoint ──────────────
      const exportData = await fetchLocalApi(
        `/api/queues/${encodeURIComponent(managerId)}/${encodeURIComponent(queueName)}/export`
      );

      if (!exportData || exportData.error) {
        return res.status(404).json({ error: `Queue ${queueName} not found on manager ${managerId}` });
      }

      const allMessages = Array.isArray(exportData.messages) ? exportData.messages : [];

      // ── Helper: resolve a dot-path on the queue item object ───────────────
      // The top-level item has: messageId, sourceService, message, messageEnvelope
      // Dot paths navigate into nested objects, e.g. "message.Amount" or
      // "messageEnvelope.dataTypeId"
      function resolvePath(item, dotPath) {
        const parts = dotPath.split('.');
        let cur = item;
        for (const part of parts) {
          if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
          cur = cur[part];
        }
        return cur;
      }

      // ── Parse WHERE clause ────────────────────────────────────────────────
      // Supported: field<op>value  where op is =  !=  >=  <=  >  <  ~=
      let wherePredicate = null;
      if (whereRaw) {
        const whereMatch = whereRaw.match(/^([^=!<>~]+?)\s*(~=|!=|>=|<=|>|<|=)\s*(.*)$/);
        if (!whereMatch) {
          return res.status(400).json({
            error: `Invalid where expression "${whereRaw}". Use format: field=value, field!=value, field>value, field~=substring`
          });
        }
        const [, wField, wOp, wValue] = whereMatch;
        const field = wField.trim();
        const value = wValue.trim();
        wherePredicate = (item) => {
          const raw = resolvePath(item, field);
          const actual = raw === undefined || raw === null ? '' : String(raw);
          const expected = value;
          switch (wOp) {
            case '=':  return actual === expected;
            case '!=': return actual !== expected;
            case '>':  return Number(actual) >  Number(expected);
            case '<':  return Number(actual) <  Number(expected);
            case '>=': return Number(actual) >= Number(expected);
            case '<=': return Number(actual) <= Number(expected);
            case '~=': return actual.toLowerCase().includes(expected.toLowerCase());
            default:   return true;
          }
        };
      }

      // ── Parse SELECT columns ──────────────────────────────────────────────
      const isSelectAll   = !selectRaw || selectRaw === '*';
      const selectColumns = isSelectAll ? [] : selectRaw.split(',').map(s => s.trim()).filter(Boolean);

      // ── Apply WHERE, OFFSET, LIMIT ────────────────────────────────────────
      const filtered  = wherePredicate ? allMessages.filter(wherePredicate) : allMessages;
      const paged     = filtered.slice(offset, offset + limit);

      // ── Project each row to requested columns ─────────────────────────────
      let columns;
      if (isSelectAll) {
        // Derive columns from first item
        const first = paged[0];
        columns = first ? Object.keys(first).filter(k => k !== 'messageEnvelope' || paged.some(r => r.messageEnvelope))
          : ['messageId', 'sourceService', 'message'];
      } else {
        columns = selectColumns;
      }

      const rows = paged.map(item => {
        if (isSelectAll) {
          // Flatten top-level fields; stringify deep objects
          return Object.fromEntries(
            columns.map(col => [col, item[col]])
          );
        }
        return Object.fromEntries(
          selectColumns.map(col => [col, resolvePath(item, col)])
        );
      });

      res.json({
        queue: queueName,
        manager: managerId,
        totalMessages: allMessages.length,
        matchedCount: filtered.length,
        offset,
        limit,
        columns,
        rows,
        where: whereRaw || null,
        select: isSelectAll ? '*' : selectRaw,
      });

    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/agent/flow-diagram
   *
   * Builds a flow topology from the active router rules + live queue depths.
   * Returns a normalised graph suitable for SVG rendering:
   *   { nodes: [{id, label, depth, kind}], edges: [{from, to, ruleId, label}] }
   *
   * kind values: 'queue' | 'rule'
   */
  app.get('/api/agent/flow-diagram', async (req, res) => {
    try {
      const [rulesData, summaryData] = await Promise.all([
        fetchLocalApi('/api/router/rules'),
        fetchLocalApi('/api/agent/queue-summary'),
      ]);

      const rules  = Array.isArray(rulesData?.rules)  ? rulesData.rules  : [];
      const queues = Array.isArray(summaryData?.queues) ? summaryData.queues : [];

      // Build a depth lookup by queue name (take max across managers)
      const depthByQueue = {};
      for (const q of queues) {
        const name  = q.queueName || q.queue || '';
        const depth = Number(q.queueLength ?? q.depth ?? 0);
        if (name) depthByQueue[name] = Math.max(depthByQueue[name] || 0, depth);
      }

      // Collect unique queue names and build graph
      const queueSet = new Set();
      const edges    = [];

      for (const rule of rules) {
        if (!rule.inputQueue) continue;
        queueSet.add(rule.inputQueue);
        for (const out of (rule.outputs || [])) {
          if (!out.queueName) continue;
          queueSet.add(out.queueName);
          edges.push({
            from:    rule.inputQueue,
            to:      out.queueName,
            ruleId:  rule.id || rule.name || '',
            label:   rule.description || rule.name || rule.id || '',
            service: rule.serviceId || '',
          });
        }
      }

      const nodes = Array.from(queueSet).map(id => ({
        id,
        label: id,
        depth: depthByQueue[id] || 0,
        kind:  'queue',
      }));

      res.json({
        nodes,
        edges,
        rules,
        generatedAt: new Date().toISOString(),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/agent/animated-flow-page?interval=30
   *
   * Serves the self-contained animated flow HTML page directly so the browser
   * can navigate to it (data:text/html navigation is blocked by modern browsers).
   */
  app.get('/api/agent/animated-flow-page', (req, res) => {
    const interval = Math.max(5, Math.min(300, parseInt(req.query.interval || '30', 10) || 30));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Live Flow Diagram</title>
<style>
  body { margin:0; font-family:-apple-system,'Segoe UI',sans-serif; background:#f7f8fa; color:#1f2328; }
  #header { display:flex; align-items:center; gap:14px; padding:10px 16px; background:#fff; border-bottom:1px solid #e5e7eb; flex-wrap:wrap; }
  #header h2 { margin:0; font-size:15px; font-weight:600; }
  #meta { font-size:12px; color:#57606a; }
  #status { font-size:11px; padding:2px 8px; border-radius:10px; background:#e5e7eb; }
  #status.ok { background:#dcfce7; color:#15803d; }
  #status.err { background:#fee2e2; color:#b91c1c; }
  #canvas { padding:16px; overflow:auto; }
  #canvas svg { display:block; max-width:100%; }
  #legend { padding:6px 16px; font-size:11px; color:#57606a; }
  #controls { display:flex; gap:10px; align-items:center; }
  button { font-size:12px; padding:3px 10px; border:1px solid #d0d7de; border-radius:5px; background:#f7f8fa; cursor:pointer; }
  button:hover { background:#e5e7eb; }
  input[type=number] { width:56px; font-size:12px; padding:2px 6px; border:1px solid #d0d7de; border-radius:4px; }
</style>
</head>
<body>
<div id="header">
  <h2>&#9654; Live Flow Diagram</h2>
  <div id="meta">Refreshing every <input type="number" id="ivInput" min="5" max="300" value="${interval}">s</div>
  <div id="controls">
    <button onclick="applyInterval()">Apply</button>
    <button onclick="pause()">Pause</button>
    <button onclick="exportSvg()">&#11015; Export SVG</button>
  </div>
  <div id="status">connecting\u2026</div>
</div>
<div id="canvas"><p style="color:#57606a;padding:20px">Loading\u2026</p></div>
<div id="legend">
  Node colour:
  <span style="background:#e5e7eb;padding:1px 6px;border-radius:3px">empty</span>
  <span style="background:#fde68a;padding:1px 6px;border-radius:3px">&lt;10 msgs</span>
  <span style="background:#fbbf24;padding:1px 6px;border-radius:3px">&lt;100 msgs</span>
  <span style="background:#f87171;color:#fff;padding:1px 6px;border-radius:3px">&#8805;100 msgs</span>
  &nbsp;\u00b7 Blue badge = live depth
</div>
<script>
const BASE = location.origin;
let intervalMs = ${interval} * 1000;
let timerId = null;
let paused  = false;
let lastSvg = '';

function depthColor(d) {
  if (d === 0) return '#e5e7eb';
  if (d < 10)  return '#fde68a';
  if (d < 100) return '#fbbf24';
  return '#f87171';
}
function textColor(d) { return d >= 100 ? '#fff' : '#1f2328'; }

function buildSvg(nodes, edges, generatedAt) {
  if (!nodes.length) return '<p style="color:#57606a;padding:20px">No routing rules \u2014 no flow to display.</p>';
  const NODE_W=160,NODE_H=38,COL_GAP=60,ROW_GAP=18,PAD_X=20,PAD_Y=40;
  const inDegree=new Map(nodes.map(n=>[n.id,0]));
  const adjOut=new Map(nodes.map(n=>[n.id,[]]));
  for(const e of edges){
    if(!inDegree.has(e.from)||!inDegree.has(e.to))continue;
    inDegree.set(e.to,(inDegree.get(e.to)||0)+1);
    adjOut.get(e.from).push(e.to);
  }
  const layer=new Map();const q=[];
  for(const n of nodes){if(!inDegree.get(n.id)){layer.set(n.id,0);q.push(n.id);}}
  for(const n of nodes){if(!layer.has(n.id)){layer.set(n.id,0);q.push(n.id);}}
  let qi=0;
  while(qi<q.length){
    const cur=q[qi++];const cl=layer.get(cur)||0;
    for(const nxt of(adjOut.get(cur)||[])){
      if((layer.get(nxt)||0)<=cl)layer.set(nxt,cl+1);
      if(!q.includes(nxt))q.push(nxt);
    }
  }
  const byLayer=new Map();
  for(const n of nodes){const l=layer.get(n.id)||0;if(!byLayer.has(l))byLayer.set(l,[]);byLayer.get(l).push(n);}
  const maxLayer=Math.max(...byLayer.keys());
  const colX=[];let xCursor=PAD_X;
  for(let l=0;l<=maxLayer;l++){colX[l]=xCursor;xCursor+=NODE_W+COL_GAP;}
  const pos=new Map();let maxY=PAD_Y;
  for(let l=0;l<=maxLayer;l++){
    const col=byLayer.get(l)||[];let y=PAD_Y;
    for(const n of col){pos.set(n.id,{x:colX[l],y});y+=NODE_H+ROW_GAP;}
    if(y>maxY)maxY=y;
  }
  const svgW=xCursor-COL_GAP+PAD_X,svgH=maxY+20;
  const nodeSvg=nodes.map(n=>{
    const p=pos.get(n.id);if(!p)return '';
    const d=n.depth||0;const fill=depthColor(d);const tc=textColor(d);
    const lbl=n.label.length>20?n.label.slice(0,18)+'\u2026':n.label;
    const badge=d>0
      ? '<rect x="'+(p.x+NODE_W-32)+'" y="'+(p.y+4)+'" width="28" height="16" rx="8" fill="#3b82d4"/><text x="'+(p.x+NODE_W-18)+'" y="'+(p.y+15)+'" font-size="9" fill="#fff" text-anchor="middle" font-family="monospace">'+d+'</text>'
      : '';
    return '<g><rect x="'+p.x+'" y="'+p.y+'" width="'+NODE_W+'" height="'+NODE_H+'" rx="6" fill="'+fill+'" stroke="#d0d7de" stroke-width="1.2"/>'+badge+'<text x="'+(p.x+NODE_W/2)+'" y="'+(p.y+NODE_H/2+5)+'" font-size="11" fill="'+tc+'" text-anchor="middle" font-family="-apple-system,sans-serif" font-weight="500">'+lbl+'</text></g>';
  }).join('');
  const edgeSvg=edges.map(e=>{
    const f=pos.get(e.from),t=pos.get(e.to);if(!f||!t)return '';
    const x1=f.x+NODE_W,y1=f.y+NODE_H/2,x2=t.x,y2=t.y+NODE_H/2,cx=(x1+x2)/2;
    return '<path d="M'+x1+','+y1+' C'+cx+','+y1+' '+cx+','+y2+' '+x2+','+y2+'" fill="none" stroke="#8b949e" stroke-width="1.5" marker-end="url(#arr)"/>';
  }).join('');
  const timeStr=generatedAt?new Date(generatedAt).toLocaleTimeString():'';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+svgW+'" height="'+svgH+'" viewBox="0 0 '+svgW+' '+svgH+'" id="flowSvg">'
    +'<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#8b949e"/></marker></defs>'
    +'<text x="20" y="24" font-size="13" font-weight="600" fill="#1f2328" font-family="-apple-system,sans-serif">Message Flow Diagram</text>'
    +'<text x="'+(svgW-20)+'" y="24" font-size="10" fill="#57606a" text-anchor="end" font-family="monospace">'+timeStr+'</text>'
    +edgeSvg+nodeSvg+'</svg>';
}

async function refresh() {
  if (paused) return;
  const st = document.getElementById('status');
  try {
    const r = await fetch('/api/agent/flow-diagram', { headers: { 'x-user-id': 'systemadmin' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    lastSvg = buildSvg(data.nodes||[], data.edges||[], data.generatedAt);
    document.getElementById('canvas').innerHTML = lastSvg;
    st.className = 'ok';
    st.textContent = 'live \u00b7 ' + new Date().toLocaleTimeString();
  } catch(e) {
    st.className = 'err';
    st.textContent = 'error: ' + e.message;
  }
}

function applyInterval() {
  const v = parseInt(document.getElementById('ivInput').value, 10);
  if (!v || v < 5) return;
  intervalMs = v * 1000;
  clearInterval(timerId);
  timerId = setInterval(refresh, intervalMs);
  paused = false;
  document.querySelector('button[onclick="pause()"]').textContent = 'Pause';
}

function pause() {
  paused = !paused;
  document.querySelector('button[onclick="pause()"]').textContent = paused ? '\u25b6 Resume' : 'Pause';
}

function exportSvg() {
  const el = document.getElementById('flowSvg');
  if (!el) return;
  const src = new XMLSerializer().serializeToString(el);
  const a = document.createElement('a');
  a.href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  a.download = 'flow-diagram-' + new Date().toISOString().slice(0,19).replace(/[:.]/g,'-') + '.svg';
  a.click();
}

refresh();
timerId = setInterval(refresh, intervalMs);
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  });

  const cameraViewerSrcDoc = (captureUrl, nodeName) => escapeAgentHtml(`<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{width:100%;height:100%;margin:0;background:#000;overflow:hidden}
body{display:grid;place-items:center}
img{display:block;width:100%;height:100%;object-fit:cover}
</style></head><body>
<img id="camera-frame" src="${captureUrl}" alt="Live feed from ${nodeName}">
<script>
const frame=document.getElementById('camera-frame');
const captureUrl=${JSON.stringify(captureUrl)};
const separator=captureUrl.includes('?')?'&':'?';
function refresh(){
  const nextFrame=new Image();
  nextFrame.onload=()=>{frame.src=nextFrame.src;setTimeout(refresh,400)};
  nextFrame.onerror=()=>setTimeout(refresh,1000);
  nextFrame.src=captureUrl+separator+'t='+Date.now();
}
frame.addEventListener('load',()=>setTimeout(refresh,400),{once:true});
</script></body></html>`);

  // ── Formatters (keyed by the "formatter" field in agent-routes.json) ─────────
  const FORMATTERS = {

    async flowAuthoring(data, captures) {
      const prompt = String(captures?.prompt || captures?.FLOW_PROMPT || '').trim();
      const request = parseFlowAuthoringPrompt(prompt);
      if (request.missing.length > 0) {
        return {
          output: `<p style="font-family:-apple-system,'Segoe UI',sans-serif;color:#9a6700">I need ${escapeAgentHtml(request.missing.join(', '))}. Try: <code>create a flow to read queue payments.in; convert MT103 to PACS.008 and MT202 to PACS.009; output to queue payments.out</code>.</p>`,
          voiceReply: `I need ${request.missing.join(', ')}`,
          confidence: 0.5
        };
      }

      const mapCatalog = await fetchLocalApi('/api/mapper/maps');
      const mapSummaries = Array.isArray(mapCatalog?.maps) ? mapCatalog.maps : [];
      const fullMaps = [];
      for (const summary of mapSummaries) {
        const payload = await fetchLocalApi(`/api/mapper/maps/${encodeURIComponent(summary.id)}`);
        if (payload?.map) fullMaps.push(payload.map);
      }

      const resolvedMaps = [];
      const unresolved = [];
      for (const conversion of request.conversions) {
        const match = fullMaps.find(map => (
          normalizeFlowTypeId(map?.sourceTypeId) === conversion.sourceTypeId
          && normalizeFlowTypeId(map?.targetTypeId) === conversion.targetTypeId
        ));
        if (match) resolvedMaps.push(match);
        else unresolved.push(`${conversion.sourceTypeId} to ${conversion.targetTypeId}`);
      }

      if (unresolved.length > 0) {
        return {
          output: `<p style="font-family:-apple-system,'Segoe UI',sans-serif;color:#cf222e">No deployable mapper is registered for ${escapeAgentHtml(unresolved.join(', '))}. Create those mapper rules first, then repeat the flow request.</p>`,
          voiceReply: 'One or more mapper rules are missing',
          confidence: 0.5
        };
      }

      const inputAssignment = await assignQueueTypesFromOllamaRequest({
        queueName: request.inputQueue,
        dataTypeIds: request.inputTypeIds,
        projectId: 'default',
        subproject: 'flow-authoring'
      });
      if (!inputAssignment.success) {
        return {
          output: `<p style="font-family:monospace;color:#cf222e">Input queue setup failed: ${escapeAgentHtml(inputAssignment.error)}</p>`,
          voiceReply: 'Input queue setup failed',
          confidence: 0
        };
      }

      const outputAssignment = await assignQueueTypesFromOllamaRequest({
        queueName: request.outputQueue,
        dataTypeIds: request.outputTypeIds,
        projectId: 'default',
        subproject: 'flow-authoring'
      });
      if (!outputAssignment.success) {
        return {
          output: `<p style="font-family:monospace;color:#cf222e">Output queue setup failed: ${escapeAgentHtml(outputAssignment.error)}</p>`,
          voiceReply: 'Output queue setup failed',
          confidence: 0
        };
      }

      const flowName = `${request.inputQueue}-to-${request.outputQueue}`;
      const flow = buildAuthoredFlowDocument({ flowName, request, maps: resolvedMaps });
      const executable = buildAuthoredFlowPcodeArtifacts({ flowName, request, maps: resolvedMaps });
      const workspace = {
        version: 1,
        projectId: 'default',
        projectLabel: 'BOB Authored Flow',
        projectDescription: `Flow from ${request.inputQueue} to ${request.outputQueue}`,
        documents: {
          pcode: {
            id: 'pcode',
            kind: 'pcode',
            label: 'Compiled Pcode',
            fileName: executable.pcodeFileName,
            content: executable.pcodeText
          },
          programMap: {
            id: 'programMap',
            kind: 'program-map',
            label: 'Pcode Program Map',
            fileName: executable.programMapFileName,
            content: JSON.stringify(executable.programMap, null, 2)
          }
        },
        catalogOverrides: {},
        projectModel: {
          programs: [{
            id: executable.programId,
            fileName: executable.pcodeFileName,
            programMapFileName: executable.programMapFileName,
            language: 'pcode'
          }],
          flows: [{ id: 'default.main.flow', fileName: flow.meta.name, contains: flow.nodes.map(node => node.id) }],
          daemons: [],
          services: [],
          rulesets: resolvedMaps.map(map => ({ id: map.id, fileName: `${map.id}.map` })),
          messageDefinitions: Array.from(new Set([...request.inputTypeIds, ...request.outputTypeIds])).map(id => ({ id }))
        },
        flow: { fileName: flow.meta.name, payload: flow, lastSavedAt: flow.savedAt }
      };
      const saved = await callLocalJsonApi('http://127.0.0.1:4000/api/projects/default/workspace', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-user-id': OLLAMA_QUEUE_ACTION_USER_ID },
        body: JSON.stringify({ workspace })
      });
      if (!saved.ok) {
        return {
          output: `<p style="font-family:monospace;color:#cf222e">Flow persistence failed: ${escapeAgentHtml(saved.data?.error || saved.text || `HTTP ${saved.status}`)}</p>`,
          voiceReply: 'Flow persistence failed',
          confidence: 0
        };
      }

      const mappingRows = resolvedMaps.map(map => `<li><code>${escapeAgentHtml(map.sourceTypeId)}</code> → <code>${escapeAgentHtml(map.targetTypeId)}</code> using <strong>${escapeAgentHtml(map.name || map.id)}</strong></li>`).join('');
      return {
        output: `<div style="font-family:-apple-system,'Segoe UI',sans-serif"><h3 style="margin:0 0 8px">Flow created</h3><p><code>${escapeAgentHtml(request.inputQueue)}</code> → ${resolvedMaps.length} mapper${resolvedMaps.length === 1 ? '' : 's'} → <code>${escapeAgentHtml(request.outputQueue)}</code></p><ul>${mappingRows}</ul><p>Queue type contracts were applied. <strong>${escapeAgentHtml(flow.meta.name)}</strong> and executable <strong>${escapeAgentHtml(executable.pcodeFileName)}</strong> were saved to the default Flow Designer workspace.</p></div>`,
        voiceReply: `Flow created from ${request.inputQueue} to ${request.outputQueue}`,
        confidence: 1
      };
    },

    async maplAuthoring(data, captures) {
      const prompt = String(captures?.prompt || '').trim();
      const result = await postLocalApi('/api/mapper/authoring/ollama-intent', {
        prompt,
        persist: true
      });
      const generated = result.data || {};
      if (result.status < 200 || result.status >= 300 || !generated.ok) {
        return {
          output: `<p style="font-family:monospace;color:#cf222e">MAPL generation or compilation failed: ${escapeAgentHtml(generated.error || `HTTP ${result.status}`)}</p>`,
          voiceReply: 'MAPL compilation failed',
          confidence: 0
        };
      }

      const source = generated.artifacts?.mapl || '';
      const stored = generated.stored || {};
      return {
        output: source || `MAPL generation completed, but no MAPL source was returned. Stored artifact: ${stored.mapl || 'unknown'}`,
        voiceReply: 'MAPL program created and compiled',
        confidence: 1
      };
    },

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
      const normalizeNodeId = value => String(value || '').trim().toLowerCase();
      const nodeMap = new Map((data.nodes || []).map(n => [normalizeNodeId(n.nodeId), n]));
      const childrenOf = new Map();
      for (const n of (data.nodes || [])) {
        if (n.parentNodeId) {
          const parentId = normalizeNodeId(n.parentNodeId);
          if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
          childrenOf.get(parentId).push(normalizeNodeId(n.nodeId));
        }
      }
      const renderNode = (nodeId, depth) => {
        const normalizedNodeId = normalizeNodeId(nodeId);
        const n = nodeMap.get(normalizedNodeId);
        if (!n) return '';
        const marker = depth > 0 ? `${'  '.repeat(depth - 1)}└─ ` : '';
        const controller = n.isClusterController ? ' [controller]' : '';
        const transport = String(n.endpoint || `${n.protocol || 'http'}://${n.ip || 'no IP'}`);
        const line = `${marker}${n.nodeName} (${transport})${n.hardware ? ` - ${n.hardware}` : ''}${controller}`;
        return [line, ...(childrenOf.get(normalizedNodeId) || []).map(cid => renderNode(cid, depth + 1))]
          .filter(Boolean)
          .join('\n');
      };
      const roots = data.rootNodes || [];
      return `${data.totalNodes || 0} nodes, ${roots.length} root${roots.length !== 1 ? 's' : ''}\n\n${roots.map(r => renderNode(r, 0)).join('\n')}`;
    },

    topologyTree(data) {
      const escapeHtml = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const normalizeNodeId = value => String(value || '').trim().toLowerCase();
      const nodeMap = new Map((data.nodes || []).map(node => [normalizeNodeId(node.nodeId), node]));
      const childrenOf = new Map();
      for (const node of (data.nodes || [])) {
        if (!node.parentNodeId) continue;
        const parentId = normalizeNodeId(node.parentNodeId);
        if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
        childrenOf.get(parentId).push(normalizeNodeId(node.nodeId));
      }
      const renderNode = (nodeId, open = false) => {
        const normalizedNodeId = normalizeNodeId(nodeId);
        const node = nodeMap.get(normalizedNodeId);
        if (!node) return '';
        const childIds = childrenOf.get(normalizedNodeId) || [];
        const transport = node.endpoint || `${node.protocol || 'http'}://${node.ip || 'no IP'}`;
        const label = `${escapeHtml(node.nodeName)} · ${escapeHtml(transport)} · ${escapeHtml(String(node.protocol || 'http').toUpperCase())}`;
        if (childIds.length === 0) {
          return `<li style="padding:4px 0"><span style="font-weight:600">${label}</span></li>`;
        }
        return `<li style="padding:4px 0"><details${open ? ' open' : ''}>
          <summary style="cursor:pointer;font-weight:600">${label} <span style="color:#57606a;font-weight:400">(${childIds.length})</span></summary>
          <ul style="list-style:none;margin:4px 0 0 14px;padding-left:12px;border-left:1px solid #d0d7de">${childIds.map(id => renderNode(id)).join('')}</ul>
        </details></li>`;
      };
      const roots = data.rootNodes || [];
      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
        <p style="margin:0 0 8px;color:#57606a">${data.totalNodes || 0} nodes · expand a node to load its branch</p>
        <ul style="list-style:none;margin:0;padding:0">${roots.map(id => renderNode(id, true)).join('')}</ul>
      </div>`;
    },

    topologyLive() {
      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif">
        <p style="margin:0 0 8px;color:#57606a;font-size:13px">Live network diagram · refreshes every 30 seconds</p>
        <iframe src="/topology" title="Live network topology" style="width:100%;height:520px;border:1px solid #d0d7de;border-radius:6px;background:#fff"></iframe>
        <p style="margin:8px 0 0"><a href="/topology" target="_blank" rel="noopener" style="color:#0969da">Open the live diagram</a></p>
      </div>`;
    },

    fsmsByNode(data) {
      const nodes = Array.isArray(data) ? data : [];
      const rows = nodes.flatMap(node => {
        const details = node?.details || {};
        const candidates = [
          details.fsms,
          details.finiteStateMachines,
          details.stateMachines,
          details.runtime?.fsms,
          node?.fsms,
        ].filter(Array.isArray).flat();
        const names = [...new Set(candidates.map(fsm => String(
          typeof fsm === 'string' ? fsm : (fsm?.name || fsm?.id || fsm?.fsmId || '')
        ).trim()).filter(Boolean))];
        return names.map(name => ({ nodeName: node.nodeName || node.ip || 'unknown', name }));
      });
      if (rows.length === 0) {
        return `<p style="font-family:-apple-system,'Segoe UI',sans-serif;color:#57606a">No finite state machines were reported by any of the ${nodes.length} nodes.</p>`;
      }
      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
        <p style="margin:0 0 8px;color:#57606a">${rows.length} finite state machine${rows.length !== 1 ? 's' : ''} across ${nodes.length} nodes</p>
        <table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;background:#f7f8fa"><th style="padding:6px 10px">Node</th><th style="padding:6px 10px">Finite State Machine</th></tr></thead>
        <tbody>${rows.map(row => `<tr><td style="padding:6px 10px">${row.nodeName}</td><td style="padding:6px 10px">${row.name}</td></tr>`).join('')}</tbody></table>
      </div>`;
    },

    devicesByNode(data) {
      const nodes = Array.isArray(data) ? data : [];
      const deviceServiceNames = new Set(['ledpin', 'relay', 'camera', 'sensor', 'gpio', 'adc', 'pwm']);
      const rows = nodes.map(node => {
        const details = node?.details || {};
        const explicitDevices = [details.devices, details.localDevices, node?.devices]
          .filter(Array.isArray)
          .flat();
        const explicitNames = explicitDevices.map(device => String(
          typeof device === 'string' ? device : (device?.name || device?.deviceName || device?.id || '')
        ).trim()).filter(Boolean);
        const capabilityNames = (Array.isArray(details.services) ? details.services : [])
          .map(service => String(typeof service === 'string' ? service : (service?.name || '')).trim())
          .filter(name => deviceServiceNames.has(name.toLowerCase()));
        const devices = [...new Set([...explicitNames, ...capabilityNames])];
        return {
          nodeName: node.nodeName || details.nodeName || node.ip || 'unknown',
          devices,
        };
      });
      const totalDevices = rows.reduce((total, row) => total + row.devices.length, 0);
      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
        <p style="margin:0 0 8px;color:#57606a">${totalDevices} device${totalDevices !== 1 ? 's' : ''} across ${rows.length} nodes</p>
        <table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;background:#f7f8fa"><th style="padding:6px 10px">Node</th><th style="padding:6px 10px">Devices</th></tr></thead>
        <tbody>${rows.map(row => `<tr><td style="padding:6px 10px;font-weight:500">${row.nodeName}</td><td style="padding:6px 10px">${row.devices.join(', ') || 'none'}</td></tr>`).join('')}</tbody></table>
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

    time(data) {
      const t = data?.time;
      if (!t) return '<p style="font-family:-apple-system,sans-serif;color:#cf222e">Time data unavailable.</p>';
      const local = new Date(t.nowMs);
      const pad = n => String(n).padStart(2, '0');
      const dateStr = `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())}`;
      const timeStr = `${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
      const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const dayName  = dayNames[local.getDay()];
      const syncAgo  = t.lastSyncAt ? Math.round((Date.now() - new Date(t.lastSyncAt).getTime()) / 1000) : null;
      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif">
        <div style="font-size:42px;font-weight:300;letter-spacing:-1px;color:#1f2328;line-height:1">${timeStr}</div>
        <div style="font-size:16px;color:#57606a;margin-top:4px">${dayName}, ${dateStr}</div>
        <div style="margin-top:12px;font-size:11px;color:#57606a;border-top:1px solid #e5e7eb;padding-top:8px">
          Source: <strong>${t.source}</strong> &nbsp;·&nbsp;
          Offset: ${t.offsetMs > 0 ? '+' : ''}${t.offsetMs}ms &nbsp;·&nbsp;
          ${syncAgo !== null ? `Last NTP sync: ${syncAgo}s ago` : ''}
        </div>
      </div>`;
    },

    async temporalQuery(_data, captures, context = {}) {
      const query = String(captures?.query || '').trim();
      const userId = String(context.userId || OLLAMA_QUEUE_ACTION_USER_ID);
      const result = await postLocalApi('/api/time/query', { query }, { 'x-user-id': userId });
      const data = result?.data;
      if (result?.status !== 200 || !data?.kind) {
        const message = data?.error || 'Date and time data unavailable';
        return { output: `<p style="font-family:-apple-system,sans-serif;color:#cf222e">${escapeAgentHtml(message)}</p>`, confidence: 0 };
      }
      if (data.kind === 'date-weekday') {
        return {
          output: `<p style="font-family:-apple-system,sans-serif;font-size:15px"><strong>${escapeAgentHtml(data.monthName)} ${data.day}, ${data.year}</strong> is a <strong>${escapeAgentHtml(data.weekday)}</strong>.</p><p style="font-family:-apple-system,sans-serif;font-size:11px;color:#57606a">Year inferred from the current date in ${escapeAgentHtml(data.timeZone)}.</p>`,
          voiceReply: `${data.monthName} ${data.day}, ${data.year} is a ${data.weekday}`,
          confidence: 1
        };
      }
      if (data.kind === 'timezone-set') {
        return {
          output: `<p style="font-family:-apple-system,sans-serif;font-size:15px">Your timezone is now <strong>${escapeAgentHtml(data.timeZone)}</strong>.</p><p style="font-family:-apple-system,sans-serif;font-size:13px;color:#57606a">Local time: ${escapeAgentHtml(data.current.time)} · ${escapeAgentHtml(data.current.weekday)}, ${escapeAgentHtml(data.current.monthName)} ${data.current.day}, ${data.current.year}</p>`,
          voiceReply: `Your timezone is now ${data.timeZone}`,
          confidence: 1
        };
      }
      return {
        output: `<div style="font-family:-apple-system,'Segoe UI',sans-serif"><div style="font-size:36px;font-weight:300">${escapeAgentHtml(data.current.time)}</div><div style="font-size:16px;color:#57606a">${escapeAgentHtml(data.current.weekday)}, ${escapeAgentHtml(data.current.monthName)} ${data.current.day}, ${data.current.year}</div><div style="margin-top:8px;font-size:11px;color:#57606a">${escapeAgentHtml(data.timeZone)} · ${escapeAgentHtml(data.current.zoneName)}</div></div>`,
        voiceReply: `It is ${data.current.time} on ${data.current.weekday}, ${data.current.monthName} ${data.current.day} in ${data.timeZone}`,
        confidence: 1
      };
    },

    async calendar(_data, captures) {
      const query = String(captures?.query || '').trim();
      const data = await fetchLocalApi(`/api/calendar/month?query=${encodeURIComponent(query)}`);
      if (!data?.days || !data?.calendar) {
        return {
          output: '<p style="font-family:-apple-system,sans-serif;color:#cf222e">Calendar data unavailable.</p>',
          voiceReply: 'Calendar data is unavailable',
          confidence: 0
        };
      }

      const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const cells = [];
      for (let index = 0; index < data.days[0].weekday; index += 1) {
        cells.push('<div style="min-height:74px;border:1px solid #e5e7eb;background:#f7f8fa"></div>');
      }
      for (const day of data.days) {
        const background = day.today ? '#ddf4ff' : (day.holiday ? '#fff8c5' : (day.weekend ? '#f6f8fa' : '#fff'));
        const border = day.today ? '#0969da' : '#e5e7eb';
        const label = day.holiday
          ? `<div style="margin-top:5px;font-size:10px;line-height:1.25;color:#7d4e00">${escapeAgentHtml(day.holiday)}</div>`
          : (day.businessDay ? '<div style="margin-top:5px;font-size:10px;color:#2da44e">Business day</div>' : '');
        cells.push(`<div style="min-height:74px;padding:6px;border:1px solid ${border};background:${background}">
          <div style="font-size:13px;font-weight:${day.today ? '700' : '500'}">${day.day}${day.today ? ' · Today' : ''}</div>
          ${label}
        </div>`);
      }

      const holidayRows = data.holidays.length
        ? data.holidays.map(holiday => `<li><strong>${escapeAgentHtml(holiday.date)}</strong> · ${escapeAgentHtml(holiday.name)}</li>`).join('')
        : '<li>None</li>';
      return {
        output: `<div style="font-family:-apple-system,'Segoe UI',sans-serif;color:#1f2328">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:10px;flex-wrap:wrap">
            <div><div style="font-size:20px;font-weight:600">${escapeAgentHtml(data.monthName)} ${data.year}</div>
            <div style="font-size:12px;color:#57606a">${escapeAgentHtml(data.calendar.name)} · ${escapeAgentHtml(data.calendar.timeZone)}</div></div>
            <div style="font-size:12px;color:#57606a"><strong>${data.businessDayCount}</strong> business days</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));font-size:11px;text-align:center;font-weight:600;color:#57606a">
            ${weekdayNames.map(name => `<div style="padding:5px">${name}</div>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr))">${cells.join('')}</div>
          <div style="margin-top:10px;font-size:12px"><strong>Holidays and observed dates</strong><ul style="margin:5px 0 0;padding-left:20px">${holidayRows}</ul></div>
        </div>`,
        voiceReply: `${data.monthName} ${data.year} calendar for ${data.calendar.name}`,
        confidence: 1
      };
    },

    async camera(_data, captures) {
      const requestedCamera = String(captures?.camera || captures?.value || '').trim();
      const nodes = await fetchNodeData();
      const cameraNode = resolveNamedNode(nodes, requestedCamera, 'camera');
      if (!cameraNode?.ip) {
        return `<p style="font-family:-apple-system,sans-serif;color:#cf222e">Camera "${escapeAgentHtml(requestedCamera)}" was not found in the live node registry.</p>`;
      }
      const node = cameraNode.nodeName || cameraNode.nodeId || requestedCamera;
      const ip = cameraNode.ip;
      const streamUrl = `http://${ip}/api/camera/stream`;
      const captureUrl = `http://${ip}/api/camera/capture`;
      const viewerSrcDoc = cameraViewerSrcDoc(captureUrl, node);
      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif">
        <p style="margin:0 0 8px;font-size:13px;color:#57606a">
          Live feed — <strong>${node}</strong> &nbsp;·&nbsp; <span style="font-family:monospace">${ip}</span>
          &nbsp;·&nbsp; <a href="${streamUrl}" target="_blank" style="color:#3b82d4">open in new tab</a>
          &nbsp;·&nbsp; <a href="${captureUrl}" target="_blank" style="color:#3b82d4">snapshot</a>
        </p>
        <iframe srcdoc="${viewerSrcDoc}" title="Live feed from ${escapeAgentHtml(node)}"
          style="width:100%;aspect-ratio:4/3;border-radius:6px;border:1px solid #e5e7eb;display:block;background:#000"></iframe>
      </div>`;
    },

    async allCameras() {
      const nodes = await fetchNodeData();
      const camerasByIdentity = new Map();

      for (const node of (Array.isArray(nodes) ? nodes : [])) {
        const hardware = String(node?.hardware || node?.details?.hardware || '').toLowerCase();
        const role = String(node?.deviceRole || node?.details?.deviceRole || '').toLowerCase();
        if (!hardware.includes('camera') && !role.includes('camera')) continue;

        const nodeName = String(node?.nodeName || '').trim();
        const ip = String(node?.ip || '').trim();
        if (!nodeName || !ip) continue;

        const identity = String(node?.nodeId || nodeName || ip).trim().toLowerCase();
        if (!camerasByIdentity.has(identity)) camerasByIdentity.set(identity, { ...node, nodeName, ip });
      }

      const cameras = [...camerasByIdentity.values()]
        .sort((left, right) => left.nodeName.localeCompare(right.nodeName, undefined, { numeric: true }));
      if (cameras.length === 0) {
        return {
          output: '<p style="font-family:-apple-system,sans-serif;color:#57606a">No dedicated camera nodes were found in the live node registry.</p>',
          voiceReply: 'No cameras were found',
          confidence: 1
        };
      }

      const feeds = cameras.map(camera => {
        const port = Number(camera.port || camera.details?.httpPort || 80);
        const origin = `http://${camera.ip}${port === 80 ? '' : `:${port}`}`;
        const streamUrl = `${origin}/api/camera/stream`;
        const captureUrl = `${origin}/api/camera/capture`;
        const nodeName = escapeAgentHtml(camera.nodeName);
        const ip = escapeAgentHtml(camera.ip);
        const safeStreamUrl = escapeAgentHtml(streamUrl);
        const safeCaptureUrl = escapeAgentHtml(captureUrl);
        const viewerSrcDoc = cameraViewerSrcDoc(captureUrl, camera.nodeName);
        return `<section style="min-width:0">
          <p style="margin:0 0 8px;font-size:13px;color:#57606a">
            <strong>${nodeName}</strong> &nbsp;·&nbsp; <span style="font-family:monospace">${ip}</span>
            &nbsp;·&nbsp; <a href="${safeStreamUrl}" target="_blank" rel="noopener" style="color:#3b82d4">open in new tab</a>
            &nbsp;·&nbsp; <a href="${safeCaptureUrl}" target="_blank" rel="noopener" style="color:#3b82d4">snapshot</a>
          </p>
            <iframe srcdoc="${viewerSrcDoc}" title="Live feed from ${nodeName}"
                  style="width:100%;aspect-ratio:4/3;border-radius:6px;border:1px solid #e5e7eb;display:block;background:#000"></iframe>
        </section>`;
      }).join('');

      return {
        output: `<div style="font-family:-apple-system,'Segoe UI',sans-serif">
          <p style="margin:0 0 12px;font-size:13px;color:#57606a">${cameras.length} camera${cameras.length === 1 ? '' : 's'} in the live node registry</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px">${feeds}</div>
        </div>`,
        voiceReply: `Showing ${cameras.length} camera${cameras.length === 1 ? '' : 's'}: ${cameras.map(camera => camera.nodeName).join(', ')}`,
        confidence: 1
      };
    },

    async cameraDisplayStream(_data, captures) {
      const requestedCamera = String(captures?.camera || '').trim();
      const requestedDisplay = String(captures?.display || '').trim();
      const nodes = await fetchNodeData();
      const cameraNode = resolveNamedNode(nodes, requestedCamera, 'camera');
      const displayNode = resolveNamedNode(nodes, requestedDisplay);

      if (!cameraNode?.ip) {
        return {
          output: `<p style="font-family:-apple-system,sans-serif;color:#cf222e">Camera "${escapeAgentHtml(requestedCamera)}" was not found in the live node registry.</p>`,
          voiceReply: `Camera ${requestedCamera} was not found`,
          confidence: 0
        };
      }
      if (!displayNode?.ip) {
        return {
          output: `<p style="font-family:-apple-system,sans-serif;color:#cf222e">Display "${escapeAgentHtml(requestedDisplay)}" was not found in the live node registry.</p>`,
          voiceReply: `Display ${requestedDisplay} was not found`,
          confidence: 0
        };
      }

      const cameraName = cameraNode.nodeName || cameraNode.nodeId || requestedCamera;
      const displayName = displayNode.nodeName || displayNode.nodeId || requestedDisplay;
      const startPath = `/api/doorbell/display-stream/start?target=${encodeURIComponent(displayNode.ip)}&port=${encodeURIComponent(displayNode.port || 80)}&intervalMs=500`;
      const result = await requestNodeJson({ host: cameraNode.ip, port: cameraNode.port || 80, path: startPath, method: 'POST' });
      if (result.status < 200 || result.status >= 300 || !result.data?.ok) {
        const error = result.data?.error || `HTTP ${result.status}`;
        return {
          output: `<p style="font-family:-apple-system,sans-serif;color:#cf222e">Could not route <strong>${escapeAgentHtml(cameraName)}</strong> to <strong>${escapeAgentHtml(displayName)}</strong>: ${escapeAgentHtml(error)}</p>`,
          voiceReply: `Could not start the camera feed: ${error}`,
          confidence: 0
        };
      }

      return {
        output: `<div style="font-family:-apple-system,'Segoe UI',sans-serif"><strong>Camera feed started</strong><p style="margin:6px 0 0"><code>${escapeAgentHtml(cameraName)}</code> (${escapeAgentHtml(cameraNode.ip)}) → <code>${escapeAgentHtml(displayName)}</code> (${escapeAgentHtml(displayNode.ip)})</p></div>`,
        voiceReply: `Showing ${cameraName} on ${displayName}`,
        confidence: 1
      };
    },

    dashboard(data) {
      const p = data?.performance;
      if (!p) return '<p style="font-family:-apple-system,sans-serif;color:#cf222e">Performance data unavailable.</p>';
      const mb = b => (b / 1024 / 1024).toFixed(0) + ' MB';
      const pct = (used, total) => total > 0 ? ((used / total) * 100).toFixed(1) + '%' : '—';
      const bar = (used, total) => {
        const w = total > 0 ? Math.min(100, (used / total) * 100).toFixed(1) : 0;
        const color = w > 85 ? '#cf222e' : w > 65 ? '#e36209' : '#2da44e';
        return `<div style="background:#f7f8fa;border-radius:3px;height:8px;overflow:hidden;margin-top:4px">
          <div style="width:${w}%;background:${color};height:100%;border-radius:3px"></div></div>`;
      };
      const qRows = (p.queueManagers || []).map(qm =>
        `<tr>
          <td style="padding:5px 8px">${qm.managerId}</td>
          <td style="padding:5px 8px;text-align:center">${qm.queueCount}</td>
          <td style="padding:5px 8px;text-align:center">${qm.totalQueuedMessages.toLocaleString()}</td>
        </tr>`).join('');
      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
        <p style="margin:0 0 10px;color:#57606a">Sampled ${new Date(p.sampledAt).toLocaleTimeString()} · Node ${p.node?.version} · PID ${p.node?.pid} · uptime ${Math.round(p.node?.uptimeSeconds/3600)}h</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px;background:#fff">
            <div style="color:#57606a;font-size:11px;text-transform:uppercase;letter-spacing:.5px">Heap Used</div>
            <div style="font-size:20px;font-weight:600;color:#1f2328;margin:4px 0">${mb(p.node?.memoryUsage?.heapUsed)}</div>
            ${bar(p.node?.memoryUsage?.heapUsed, p.node?.memoryUsage?.heapTotal)}
            <div style="color:#57606a;font-size:11px;margin-top:3px">of ${mb(p.node?.memoryUsage?.heapTotal)} heap</div>
          </div>
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px;background:#fff">
            <div style="color:#57606a;font-size:11px;text-transform:uppercase;letter-spacing:.5px">System RAM</div>
            <div style="font-size:20px;font-weight:600;color:#1f2328;margin:4px 0">${pct(p.os?.memoryUsed, p.os?.totalMemory)}</div>
            ${bar(p.os?.memoryUsed, p.os?.totalMemory)}
            <div style="color:#57606a;font-size:11px;margin-top:3px">${mb(p.os?.memoryUsed)} / ${mb(p.os?.totalMemory)}</div>
          </div>
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px;background:#fff;margin-bottom:10px">
          <div style="color:#57606a;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">CPU · ${p.os?.cpuModel?.replace(/\s+/g,' ') || '—'} · ${p.os?.cpuCount} cores</div>
          <div style="font-size:13px;color:#1f2328">${p.os?.cpuSpeedMHz} MHz &nbsp;·&nbsp; OS uptime ${Math.round(p.os?.uptimeSeconds/3600)}h</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f7f8fa;text-align:left">
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb">Queue Manager</th>
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center">Queues</th>
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center">Messages</th>
          </tr></thead>
          <tbody>${qRows}</tbody>
        </table>
      </div>`;
    },

    datetimeArithmetic(_data, captures) {
      // ── Parse the raw query from captures.query ──────────────────────────
      const raw = (captures?.query || '').toLowerCase().trim();
      const now = new Date();
      const dayNames   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

      function formatDate(d) {
        return `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
      }
      function addDays(base, n) {
        const d = new Date(base); d.setDate(d.getDate() + n); return d;
      }
      function startOfDay(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }

      // ── Named reference dates ─────────────────────────────────────────────
      const NAMED_DATES = {
        'christmas':       () => new Date(now.getFullYear(), 11, 25),
        'new year':        () => new Date(now.getFullYear() + 1, 0, 1),
        "new year's day":  () => new Date(now.getFullYear() + 1, 0, 1),
        'halloween':       () => new Date(now.getFullYear(), 9, 31),
        'valentines day':  () => new Date(now.getFullYear(), 1, 14),
        "valentine's day": () => new Date(now.getFullYear(), 1, 14),
        'thanksgiving':    () => {
          // 4th Thursday of November
          const nov = new Date(now.getFullYear(), 10, 1);
          const thu = (11 - nov.getDay()) % 7; // first Thursday
          return new Date(now.getFullYear(), 10, 1 + thu + 21);
        }
      };

      // ── Detect "how many days until X" ───────────────────────────────────
      const untilMatch = raw.match(/how many (?:days?|weeks?|months?)\s+(?:until|till|before|to|until)\s+(.+)/);
      const daysUntilMatch = raw.match(/days?\s+(?:until|till|before|to)\s+(.+)/);
      const refText = (untilMatch || daysUntilMatch)?.[1]?.trim().replace(/[?.!]+$/, '');
      if (refText) {
        let target = null;
        // Try named dates first
        for (const [key, fn] of Object.entries(NAMED_DATES)) {
          if (refText.includes(key)) { target = fn(); break; }
        }
        // Try to parse an explicit date
        if (!target) {
          const parsed = Date.parse(refText);
          if (!isNaN(parsed)) target = new Date(parsed);
        }
        if (target) {
          const diff = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
          if (diff === 0) {
            return `<p style="font-family:-apple-system,sans-serif;font-size:15px"><strong>${formatDate(target)}</strong> is <strong>today</strong>.</p>`;
          } else if (diff > 0) {
            const weeks = Math.floor(diff / 7), days = diff % 7;
            const breakdown = weeks > 0 ? ` (${weeks} week${weeks !== 1 ? 's' : ''}${days > 0 ? ` and ${days} day${days !== 1 ? 's' : ''}` : ''})` : '';
            return `<p style="font-family:-apple-system,sans-serif;font-size:15px">There are <strong>${diff} day${diff !== 1 ? 's' : ''}${breakdown}</strong> until <strong>${formatDate(target)}</strong>.</p>`;
          } else {
            return `<p style="font-family:-apple-system,sans-serif;font-size:15px"><strong>${formatDate(target)}</strong> was <strong>${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} ago</strong>.</p>`;
          }
        }
      }

      // ── Detect "what date/day is it in N days/weeks/months" ──────────────
      const inFutureMatch = raw.match(/(?:what\s+(?:date|day)\s+(?:is\s+it|will\s+it\s+be)\s+)?(?:in|after)\s+(\d+)\s+(day|days|week|weeks|month|months)/);
      if (inFutureMatch) {
        const n    = parseInt(inFutureMatch[1], 10);
        const unit = inFutureMatch[2].replace(/s$/, '');
        let target;
        if (unit === 'day')   { target = addDays(now, n); }
        else if (unit === 'week')  { target = addDays(now, n * 7); }
        else { // month
          target = new Date(now);
          target.setMonth(target.getMonth() + n);
        }
        return `<p style="font-family:-apple-system,sans-serif;font-size:15px">In <strong>${n} ${unit}${n !== 1 ? 's' : ''}</strong> it will be <strong>${formatDate(target)}</strong>.</p>`;
      }

      // ── Detect "N days ago / N weeks ago" ─────────────────────────────────
      const agoMatch = raw.match(/(\d+)\s+(day|days|week|weeks|month|months)\s+ago/);
      if (agoMatch) {
        const n    = parseInt(agoMatch[1], 10);
        const unit = agoMatch[2].replace(/s$/, '');
        let target;
        if (unit === 'day')   { target = addDays(now, -n); }
        else if (unit === 'week')  { target = addDays(now, -n * 7); }
        else {
          target = new Date(now);
          target.setMonth(target.getMonth() - n);
        }
        return `<p style="font-family:-apple-system,sans-serif;font-size:15px"><strong>${n} ${unit}${n !== 1 ? 's' : ''} ago</strong> was <strong>${formatDate(target)}</strong>.</p>`;
      }

      // ── Detect "add N days/weeks/months to [date or today]" ──────────────
      const addMatch = raw.match(/add\s+(\d+)\s+(day|days|week|weeks|month|months)\s+to\s+(.+)/);
      if (addMatch) {
        const n    = parseInt(addMatch[1], 10);
        const unit = addMatch[2].replace(/s$/, '');
        const baseText = addMatch[3].trim();
        const base = /today|now/.test(baseText) ? now : (Date.parse(baseText) ? new Date(Date.parse(baseText)) : now);
        let target;
        if (unit === 'day')   { target = addDays(base, n); }
        else if (unit === 'week')  { target = addDays(base, n * 7); }
        else {
          target = new Date(base);
          target.setMonth(target.getMonth() + n);
        }
        return `<p style="font-family:-apple-system,sans-serif;font-size:15px">Adding <strong>${n} ${unit}${n !== 1 ? 's' : ''}</strong> gives <strong>${formatDate(target)}</strong>.</p>`;
      }

      // ── Detect "difference between [date1] and [date2]" ──────────────────
      const diffMatch = raw.match(/(?:difference|days?)\s+between\s+(.+?)\s+and\s+(.+)/);
      if (diffMatch) {
        const d1 = Date.parse(diffMatch[1].trim());
        const d2 = Date.parse(diffMatch[2].trim());
        if (!isNaN(d1) && !isNaN(d2)) {
          const diff = Math.abs(Math.round((d2 - d1) / 86400000));
          return `<p style="font-family:-apple-system,sans-serif;font-size:15px">There are <strong>${diff} day${diff !== 1 ? 's' : ''}</strong> between those dates.</p>`;
        }
      }

      // ── Fallback: show today ──────────────────────────────────────────────
      return `<p style="font-family:-apple-system,sans-serif;font-size:15px">Today is <strong>${formatDate(now)}</strong>.</p>`;
    },

    queues(data, captures) {
      const queues   = Array.isArray(data?.queues)   ? data.queues   : [];

      // ── Detect Excel/spreadsheet export request ────────────────────────────
      const isExcelRequest = Boolean(captures?.excel);

      // ── Resolve capacity threshold from captures ───────────────────────────
      // "half-full" / "almost full" → 50 / 80; explicit "75%" → 75
      let threshold = null;
      if (captures?.threshold) {
        threshold = Math.min(100, Math.max(0, Number(captures.threshold)));
      } else if (captures?.named) {
        const n = String(captures.named).toLowerCase();
        threshold = /half/.test(n) ? 50 : 80;
      }
      const isCapacityQuery = threshold !== null;

      // ── Normalise each queue entry; compute fill % when maxLength is known ─
      const enriched = queues.map(q => {
        const name      = q.queueName || q.queue || '—';
        const depth     = Number(q.queueLength ?? q.depth ?? 0);
        const maxLength = Number(q.maxLength || 0);
        const fillPct   = maxLength > 0 ? (depth / maxLength) * 100 : null;
        return { name, depth, maxLength, fillPct, managerId: q.managerId || '—' };
      });

      // ── Apply threshold filter when this is a capacity query ───────────────
      const display = isCapacityQuery
        ? enriched.filter(q => q.fillPct !== null && q.fillPct >= threshold)
        : enriched;

      // Sort by fill % (capacity queries) or depth (general queries), descending
      const sorted = [...display].sort((a, b) =>
        isCapacityQuery
          ? (b.fillPct ?? -1) - (a.fillPct ?? -1)
          : b.depth - a.depth
      );

      const totalMessages = enriched.reduce((s, q) => s + q.depth, 0);

      // ── Depth / capacity bar ───────────────────────────────────────────────
      const capacityBar = (depth, maxLength, fillPct) => {
        if (maxLength > 0 && fillPct !== null) {
          const w     = Math.min(100, fillPct).toFixed(1);
          const color = fillPct >= 90 ? '#cf222e' : fillPct >= 75 ? '#e36209' : '#2da44e';
          return `<div style="background:#f7f8fa;border-radius:3px;height:6px;margin-top:3px" title="${fillPct.toFixed(1)}% of ${maxLength.toLocaleString()}">
            <div style="width:${w}%;background:${color};height:100%;border-radius:3px"></div></div>`;
        }
        // No capacity configured — show depth bar relative to peers
        const maxPeerDepth = Math.max(...enriched.map(q => q.depth), 1);
        const w = Math.min(100, (depth / maxPeerDepth) * 100).toFixed(1);
        const color = depth > 1000 ? '#cf222e' : depth > 100 ? '#e36209' : '#2da44e';
        return `<div style="background:#f7f8fa;border-radius:3px;height:6px;margin-top:3px">
          <div style="width:${w}%;background:${color};height:100%;border-radius:3px"></div></div>`;
      };

      // ── Table rows ─────────────────────────────────────────────────────────
      const showCapacityCol = enriched.some(q => q.maxLength > 0);
      const queueRows = sorted.slice(0, 25).map(q => {
        const fillLabel = q.fillPct !== null
          ? `<span style="color:${q.fillPct >= 90 ? '#cf222e' : q.fillPct >= 75 ? '#e36209' : '#2da44e'};font-weight:600">${q.fillPct.toFixed(1)}%</span>`
          : '<span style="color:#57606a">—</span>';
        const capacityLabel = q.maxLength > 0 ? q.maxLength.toLocaleString() : '∞';
        return `<tr>
          <td style="padding:5px 8px;font-weight:500;font-family:monospace;font-size:12px">${q.name}</td>
          <td style="padding:5px 8px;color:#57606a;font-size:11px">${q.managerId}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:600">${q.depth.toLocaleString()}</td>
          ${showCapacityCol ? `<td style="padding:5px 8px;text-align:right;color:#57606a">${capacityLabel}</td>
          <td style="padding:5px 8px;text-align:right">${fillLabel}</td>` : ''}
          <td style="padding:5px 8px;min-width:80px">${capacityBar(q.depth, q.maxLength, q.fillPct)}</td>
        </tr>`;
      }).join('');

      // ── Capacity-query header ──────────────────────────────────────────────
      const thresholdLabel = threshold !== null
        ? (captures?.named ? String(captures.named) : `${threshold}%`)
        : null;

      const summaryLine = isCapacityQuery
        ? `${sorted.length} queue${sorted.length !== 1 ? 's' : ''} at ≥ ${thresholdLabel} capacity · ${totalMessages.toLocaleString()} total messages across all queues`
        : `${enriched.length} queue${enriched.length !== 1 ? 's' : ''} · ${totalMessages.toLocaleString()} total messages`;

      // ── Build Excel download link (data URI, HTML-table-in-xls trick) ──────
      const buildExcelDownloadHtml = () => {
        const tsNow = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `queues-${tsNow}.xls`;

        // Build an HTML table that Excel opens natively via data URI
        const capacityHeader = showCapacityCol
          ? '<th>Capacity</th><th>Fill %</th>'
          : '';
        const dataRows = enriched.map(q => {
          const fillLabel = q.fillPct !== null ? q.fillPct.toFixed(2) : '';
          const capacityLabel = q.maxLength > 0 ? q.maxLength : '';
          return `<tr>
            <td>${q.name}</td>
            <td>${q.managerId}</td>
            <td>${q.depth}</td>
            ${showCapacityCol ? `<td>${capacityLabel}</td><td>${fillLabel}</td>` : ''}
          </tr>`;
        }).join('');

        const xlsHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Queues</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml></head>
<body><table>
<thead><tr><th>Queue</th><th>Manager</th><th>Messages</th>${capacityHeader}</tr></thead>
<tbody>${dataRows}</tbody>
</table></body></html>`;

        // Encode as base64 data URI so it works as a plain <a href> (no script needed)
        const b64 = Buffer.from(xlsHtml, 'utf8').toString('base64');
        const dataUri = `data:application/vnd.ms-excel;base64,${b64}`;

        return `<div style="margin-bottom:12px">
          <a href="${dataUri}" download="${fileName}"
             style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#217346;color:#fff;border-radius:6px;font-size:13px;font-weight:500;text-decoration:none;font-family:-apple-system,'Segoe UI',sans-serif">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Download ${fileName}
          </a>
          <span style="margin-left:10px;font-size:11px;color:#57606a;font-family:-apple-system,sans-serif">${enriched.length} queue${enriched.length !== 1 ? 's' : ''} · ${totalMessages.toLocaleString()} messages</span>
        </div>`;
      };

      // ── Render ─────────────────────────────────────────────────────────────
      const noQueuesMsg = isCapacityQuery
        ? `<p style="color:#2da44e;font-style:italic">No queues are at or above ${thresholdLabel} capacity.</p>`
        : '<p style="color:#57606a;font-style:italic">No queues registered.</p>';

      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
        <p style="margin:0 0 10px;color:#57606a">${summaryLine}</p>

        ${isExcelRequest ? buildExcelDownloadHtml() : ''}

        ${sorted.length > 0 ? `
        <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:10px">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#f7f8fa;text-align:left">
              <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb">Queue</th>
              <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb">Manager</th>
              <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right">Depth</th>
              ${showCapacityCol ? '<th style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right">Capacity</th><th style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right">Fill</th>' : ''}
              <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb;min-width:80px"></th>
            </tr></thead>
            <tbody>${queueRows}</tbody>
          </table>
          ${sorted.length < display.length || (!isCapacityQuery && sorted.length < enriched.length) ? `<p style="margin:4px 8px;color:#57606a;font-size:11px">Showing ${sorted.length} of ${isCapacityQuery ? display.length : enriched.length}</p>` : ''}
        </div>` : noQueuesMsg}

      </div>`;
    },

    librarian(data) {
      const types   = Array.isArray(data?.types)   ? data.types   : [];
      const schemas = Array.isArray(data?.schemas) ? data.schemas : [];

      const isoTypes   = types.filter(t => t.isIso);
      const builtinTypes = types.filter(t => t.builtin && !t.isIso);
      const customTypes  = types.filter(t => !t.builtin && !t.isIso);

      const typeRow = (t) => {
        const badge = t.builtin
          ? `<span style="font-size:10px;background:#e8f0fe;color:#3b82d4;border-radius:3px;padding:1px 4px;margin-left:4px">builtin</span>`
          : (t.isIso ? `<span style="font-size:10px;background:#e6f4ea;color:#2da44e;border-radius:3px;padding:1px 4px;margin-left:4px">ISO</span>` : '');
        return `<tr>
          <td style="padding:4px 8px;font-family:monospace;font-size:12px">${t.id}${badge}</td>
          <td style="padding:4px 8px;color:#57606a">${t.label || '—'}</td>
        </tr>`;
      };

      const typeSection = (title, list) => list.length === 0 ? '' : `
        <div style="font-size:11px;color:#57606a;text-transform:uppercase;letter-spacing:.5px;margin:10px 0 4px">${title}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
          <tbody>${list.map(typeRow).join('')}</tbody>
        </table>`;

      const schemaRows = schemas.slice(0, 20).map(s => {
        const statusColor = s.lifecycle?.status === 'active' ? '#2da44e' : s.lifecycle?.status === 'scheduled' ? '#e36209' : '#cf222e';
        const mtime = s.mtime ? new Date(s.mtime).toLocaleDateString() : '—';
        return `<tr>
          <td style="padding:4px 8px;font-family:monospace;font-size:11px">${s.path || s.name || '—'}</td>
          <td style="padding:4px 8px;color:#57606a">${s.typeId || s.type || '—'}</td>
          <td style="padding:4px 8px"><span style="color:${statusColor};font-size:11px">${s.lifecycle?.status || '—'}</span></td>
          <td style="padding:4px 8px;color:#57606a;font-size:11px;text-align:right">${mtime}</td>
        </tr>`;
      }).join('');

      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
        <p style="margin:0 0 8px;color:#57606a">${types.length} data type${types.length !== 1 ? 's' : ''} · ${schemas.length} schema${schemas.length !== 1 ? 's' : ''} registered</p>

        ${typeSection('ISO 20022 Types', isoTypes)}
        ${typeSection('Built-in Types', builtinTypes)}
        ${typeSection('Custom Types', customTypes)}
        ${types.length === 0 ? '<p style="color:#57606a;font-style:italic">No data types registered (librarian may be offline).</p>' : ''}

        ${schemas.length > 0 ? `
        <div style="font-size:11px;color:#57606a;text-transform:uppercase;letter-spacing:.5px;margin:10px 0 4px">Schemas (${schemas.length})</div>
        <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#f7f8fa;text-align:left">
              <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb">Path</th>
              <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb">Type</th>
              <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb">Status</th>
              <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right">Modified</th>
            </tr></thead>
            <tbody>${schemaRows}</tbody>
          </table>
          ${schemas.length > 20 ? `<p style="margin:6px 8px;color:#57606a;font-size:11px">Showing 20 of ${schemas.length}</p>` : ''}
        </div>` : ''}
      </div>`;
    },

    async queueItem(_data, captures) {
      // ── Resolve captured queue name and optional params ────────────────────
      const queueName = (captures?.queue || captures?.queue2 || captures?.value || '').trim();
      const manager   = (captures?.manager || 'qm-primary').trim();
      const itemIndex = captures?.index ? Math.max(0, parseInt(captures.index, 10) || 0) : 0;
      const count     = captures?.count ? Math.min(100, Math.max(1, parseInt(captures.count, 10) || 1)) : 1;

      if (!queueName) {
        return `<p style="font-family:-apple-system,sans-serif;color:#cf222e">
          Could not determine which queue to inspect. Try: <em>"show first 5 items in payments.inbound"</em>.
        </p>`;
      }

      // ── Multi-item path: fetch count items and render a compact table ──────
      if (count > 1) {
        const indices = Array.from({ length: count }, (_, i) => i + itemIndex);
        const results = await Promise.all(indices.map(i =>
          fetchLocalApi(`/api/agent/queue-item?manager=${encodeURIComponent(manager)}&queue=${encodeURIComponent(queueName)}&index=${i}`)
        ));

        // Find the first non-error result to check queue state
        const first = results.find(r => r && !r.error);
        if (!first) return `<p style="font-family:-apple-system,sans-serif;color:#cf222e">Could not reach queue manager.</p>`;
        if (first.empty) return `<p style="font-family:-apple-system,'Segoe UI',sans-serif;color:#57606a">Queue <strong>${queueName}</strong> is empty.</p>`;

        // Stop at the last valid item (index >= queueLength returns the last item repeated)
        const queueLength = first.queueLength || 0;
        const showing = Math.min(count, queueLength);
        const validResults = results.slice(0, showing).filter(r => r && !r.error && !r.empty && r.item);

        function truncate(val, max = 120) {
          if (val === null || val === undefined) return '—';
          const s = typeof val === 'string' ? val : JSON.stringify(val);
          const esc = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          return esc.length > max ? esc.slice(0, max) + '…' : esc;
        }

        const rows = validResults.map((r, i) => {
          const msg = r.item?.message;
          return `<tr style="${i % 2 === 1 ? 'background:#f7f8fa' : ''}">
            <td style="padding:4px 8px;text-align:right;color:#57606a;font-size:11px;white-space:nowrap">${itemIndex + i + 1}</td>
            <td style="padding:4px 8px;font-family:monospace;font-size:11px;max-width:480px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${r.item?.messageId ? `<span style="color:#57606a;font-size:10px">${truncate(r.item.messageId, 24)}</span><br>` : ''}
              ${truncate(msg)}
            </td>
          </tr>`;
        }).join('');

        return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
          <p style="margin:0 0 8px;color:#57606a">
            Showing ${validResults.length} of ${queueLength.toLocaleString()} items in
            <strong style="font-family:monospace">${queueName}</strong> on <strong>${manager}</strong>
            &nbsp;·&nbsp; read-only peek, nothing dequeued
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#f7f8fa;text-align:left">
              <th style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right">#</th>
              <th style="padding:4px 8px;border-bottom:1px solid #e5e7eb">Message</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      }

      // ── Single-item path (original behaviour) ─────────────────────────────
      const url = `/api/agent/queue-item?manager=${encodeURIComponent(manager)}&queue=${encodeURIComponent(queueName)}&index=${itemIndex}`;
      const d = await fetchLocalApi(url);

      if (!d) {
        return `<p style="font-family:-apple-system,sans-serif;color:#cf222e">Could not reach queue manager. Is the backend running?</p>`;
      }
      if (d.error) {
        return `<p style="font-family:-apple-system,sans-serif;color:#cf222e">Error: ${d.error}</p>`;
      }
      if (d.empty) {
        return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
          <p style="color:#57606a">Queue <strong style="font-family:monospace">${d.queueName}</strong> on <strong>${d.managerId}</strong> is empty.</p>
        </div>`;
      }

      const { item, dataTypeIds, shape, parsedXml, schema, validations, queueLength } = d;
      const message     = item?.message;
      const envelope    = item?.messageEnvelope;
      const primaryType = (dataTypeIds || [])[0] || 'text-string';

      // ── Validation verdict ─────────────────────────────────────────────────
      const failures  = (validations || []).filter(v => !v.valid);
      const warnings  = (validations || []).filter(v => v.valid && v.tier === 'field-presence' && !v.present && !v.required);
      const allPassed = failures.length === 0;

      const verdictColor = allPassed ? '#2da44e' : '#cf222e';
      const verdictLabel = allPassed
        ? `✓ Valid — passes all ${validations.length} check${validations.length !== 1 ? 's' : ''}`
        : `✗ ${failures.length} validation failure${failures.length !== 1 ? 's' : ''}`;

      // ── Schema badge ───────────────────────────────────────────────────────
      const schemaBadge = schema
        ? `<span style="font-size:11px;background:#e8f0fe;color:#3b82d4;border-radius:3px;padding:2px 6px;margin-left:6px">
             schema: ${schema.path}
             <span style="color:${schema.lifecycle?.status === 'active' ? '#2da44e' : '#e36209'}"> · ${schema.lifecycle?.status || '?'}</span>
           </span>`
        : `<span style="font-size:11px;background:#fff8e1;color:#b08000;border-radius:3px;padding:2px 6px;margin-left:6px">no schema in librarian</span>`;

      // ── Failure rows ───────────────────────────────────────────────────────
      const failureRows = failures.map(v =>
        `<tr>
          <td style="padding:4px 8px;font-family:monospace;font-size:11px;color:#cf222e">${v.field || v.typeId || '?'}</td>
          <td style="padding:4px 8px;font-size:11px;color:#57606a">${v.tier}</td>
          <td style="padding:4px 8px;font-size:11px;color:#cf222e">${v.reason || 'failed'}</td>
        </tr>`
      ).join('');

      // ── Message payload renderer ───────────────────────────────────────────
      // Build a two-column field table for object payloads; fall back to <pre> for strings.
      function renderValue(val, depth) {
        if (val === null || val === undefined) return '<span style="color:#57606a">null</span>';
        if (typeof val === 'boolean') return `<span style="color:#7c5cd8">${val}</span>`;
        if (typeof val === 'number')  return `<span style="color:#0969da">${val}</span>`;
        if (typeof val === 'string') {
          const esc = val.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          return `<span style="color:#116329">"${esc.length > 120 ? esc.slice(0,120) + '…' : esc}"</span>`;
        }
        if (Array.isArray(val)) {
          if (val.length === 0) return '<span style="color:#57606a">[]</span>';
          return `<span style="color:#57606a">[${val.length} item${val.length !== 1 ? 's' : ''}]</span>`;
        }
        if (typeof val === 'object' && depth < 2) {
          const entries = Object.entries(val).slice(0, 12);
          const rows = entries.map(([k, v2]) =>
            `<tr>
              <td style="padding:2px 6px;font-weight:500;color:#57606a;white-space:nowrap;vertical-align:top">${k}</td>
              <td style="padding:2px 6px">${renderValue(v2, depth + 1)}</td>
            </tr>`
          ).join('');
          const more = Object.keys(val).length > 12 ? `<tr><td colspan="2" style="padding:2px 6px;color:#57606a;font-size:11px">… ${Object.keys(val).length - 12} more keys</td></tr>` : '';
          return `<table style="border-collapse:collapse;font-size:12px;width:100%">${rows}${more}</table>`;
        }
        return `<span style="color:#57606a">{…}</span>`;
      }

      const displayMessage = parsedXml || message;
      const messageHtml = typeof displayMessage === 'string'
        ? `<pre style="font-size:11px;white-space:pre-wrap;word-break:break-all;margin:0;color:#1f2328;line-height:1.5">${
            displayMessage.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').slice(0, 4000)
          }${displayMessage.length > 4000 ? '\n… (truncated)' : ''}</pre>`
        : renderValue(displayMessage, 0);

      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">

        <!-- Header -->
        <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          <span style="font-weight:600;font-family:monospace">${d.queueName}</span>
          <span style="color:#57606a">on ${d.managerId}</span>
          <span style="color:#57606a;font-size:11px">item ${d.itemIndex + 1} of ${queueLength}</span>
          <span style="font-size:11px;background:#f7f8fa;border:1px solid #e5e7eb;border-radius:3px;padding:1px 5px">${primaryType}</span>
          <span style="font-size:11px;color:#57606a">shape: ${shape}</span>
          ${schemaBadge}
        </div>

        <!-- Verdict banner -->
        <div style="border-left:3px solid ${verdictColor};padding:8px 10px;background:${allPassed ? '#f0fff4' : '#fff0f0'};margin-bottom:10px;border-radius:0 4px 4px 0">
          <span style="color:${verdictColor};font-weight:600">${verdictLabel}</span>
          ${item?.messageId ? `<span style="float:right;font-size:10px;color:#57606a;font-family:monospace">${item.messageId}</span>` : ''}
        </div>

        <!-- Failure table -->
        ${failures.length > 0 ? `
        <div style="border:1px solid #ffcdd2;border-radius:6px;overflow:hidden;margin-bottom:10px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#fff0f0;text-align:left">
              <th style="padding:4px 8px;border-bottom:1px solid #ffcdd2">Field / Type</th>
              <th style="padding:4px 8px;border-bottom:1px solid #ffcdd2">Tier</th>
              <th style="padding:4px 8px;border-bottom:1px solid #ffcdd2">Reason</th>
            </tr></thead>
            <tbody>${failureRows}</tbody>
          </table>
        </div>` : ''}

        <!-- Envelope metadata -->
        ${envelope ? `
        <div style="font-size:11px;color:#57606a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Envelope</div>
        <div style="background:#f7f8fa;border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;font-family:monospace;font-size:11px;margin-bottom:10px;display:flex;gap:16px;flex-wrap:wrap">
          ${envelope.formatToken ? `<span><strong>formatToken</strong> ${envelope.formatToken}</span>` : ''}
          ${envelope.mediaType   ? `<span><strong>mediaType</strong> ${envelope.mediaType}</span>` : ''}
          ${envelope.dataTypeId  ? `<span><strong>dataTypeId</strong> ${envelope.dataTypeId}</span>` : ''}
          ${item.sourceService   ? `<span><strong>source</strong> ${item.sourceService}</span>` : ''}
        </div>` : ''}

        <!-- Message payload -->
        <div style="font-size:11px;color:#57606a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
          Payload${parsedXml ? ' (parsed from XML)' : ''}
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px;background:#fff;overflow:auto;max-height:400px">
          ${messageHtml}
        </div>

        <!-- Source info -->
        ${item.sourceService ? `<p style="margin:6px 0 0;font-size:11px;color:#57606a">Enqueued by: ${item.sourceService}</p>` : ''}
      </div>`;
    },

    async queueItemEach(data) {
      // data is the queue-summary payload: { queues: [...], managers: [...], ... }
      const queues = Array.isArray(data?.queues) ? data.queues : [];

      if (queues.length === 0) {
        return `<p style="font-family:-apple-system,sans-serif;color:#57606a">No queues found.</p>`;
      }

      // Fetch the first item from each queue in parallel (only non-empty queues)
      const nonEmpty = queues.filter(q => Number(q.queueLength ?? q.depth ?? 0) > 0);
      const empty    = queues.filter(q => Number(q.queueLength ?? q.depth ?? 0) === 0);

      const peeks = await Promise.all(nonEmpty.map(async q => {
        const queueName = q.queueName || q.queue;
        const managerId = q.managerId || 'qm-primary';
        const d = await fetchLocalApi(
          `/api/agent/queue-item?manager=${encodeURIComponent(managerId)}&queue=${encodeURIComponent(queueName)}&index=0`
        );
        return { queueName, managerId, depth: Number(q.queueLength ?? q.depth ?? 0), d };
      }));

      const rows = peeks.map(({ queueName, managerId, depth, d }) => {
        let preview = '<span style="color:#57606a;font-style:italic">unavailable</span>';
        if (d && !d.error && !d.empty && d.item) {
          const msg = d.item.message;
          const raw = typeof msg === 'string'
            ? msg.slice(0, 120) + (msg.length > 120 ? '…' : '')
            : JSON.stringify(msg).slice(0, 120);
          const esc = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          preview = `<code style="font-size:11px;color:#1f2328">${esc}</code>`;
        } else if (d?.error) {
          preview = `<span style="color:#cf222e;font-size:11px">${d.error}</span>`;
        }
        return `<tr>
          <td style="padding:5px 8px;font-family:monospace;font-weight:500;font-size:12px;white-space:nowrap">${queueName}</td>
          <td style="padding:5px 8px;color:#57606a;font-size:11px">${managerId}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:600">${depth.toLocaleString()}</td>
          <td style="padding:5px 8px;max-width:320px;overflow:hidden;text-overflow:ellipsis">${preview}</td>
        </tr>`;
      }).join('');

      const emptyNote = empty.length > 0
        ? `<p style="margin:8px 0 0;font-size:11px;color:#57606a">${empty.length} empty queue${empty.length !== 1 ? 's' : ''} not shown.</p>`
        : '';

      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
        <p style="margin:0 0 8px;color:#57606a">
          First item from each non-empty queue · ${nonEmpty.length} of ${queues.length} queue${queues.length !== 1 ? 's' : ''} have messages
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f7f8fa;text-align:left">
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb">Queue</th>
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb">Manager</th>
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right">Depth</th>
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb">First Item</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${emptyNote}
      </div>`;
    },

    lifecycle(data) {
      if (!data) return '<p style="font-family:-apple-system,sans-serif;color:#cf222e">Lifecycle data unavailable.</p>';
      const states = data.states || [];
      const totals = data.totalsByLayer || {};
      const totalMsgs = data.totalMessagesAcrossStates || 0;
      const rows = states.slice(0, 20).map(s => {
        const count = s.messageCount ?? 0;
        const pct = totalMsgs > 0 ? ((count / totalMsgs) * 100).toFixed(1) : '0';
        const barW = totalMsgs > 0 ? Math.min(100, (count / totalMsgs) * 100).toFixed(1) : 0;
        return `<tr>
          <td style="padding:5px 8px;font-weight:500">${s.stateId || s.id || '—'}</td>
          <td style="padding:5px 8px;color:#57606a">${s.layer ?? '—'}</td>
          <td style="padding:5px 8px;text-align:right">${count.toLocaleString()}</td>
          <td style="padding:5px 8px;width:120px">
            <div style="background:#f7f8fa;border-radius:3px;height:6px">
              <div style="width:${barW}%;background:#3b82d4;height:100%;border-radius:3px"></div>
            </div>
          </td>
          <td style="padding:5px 8px;color:#57606a;text-align:right">${pct}%</td>
        </tr>`;
      }).join('');
      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
        <p style="margin:0 0 8px;color:#57606a">${states.length} FSM states · ${totalMsgs.toLocaleString()} messages total · generated ${data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : '—'}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f7f8fa;text-align:left">
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb">State</th>
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb">Layer</th>
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right">Messages</th>
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb;min-width:80px"></th>
            <th style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right">%</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    },

    async queueQuery(_data, captures) {
      // ── Parse captures from the query DSL intent ──────────────────────────
      // Expected capture groups (from agent-routes.json):
      //   queue    – required queue name
      //   manager  – optional queue manager id (default: qm-primary)
      //   select   – optional comma-separated field list (default: *)
      //   where    – optional filter expression (field op value)
      //   limit    – optional row limit
      const queueName = (captures?.queue || captures?.queue2 || captures?.value || '').trim();
      const manager   = (captures?.manager || 'qm-primary').trim();
      const select    = (captures?.select  || '*').trim();
      const where     = (captures?.where   || '').trim();
      const limit     = captures?.limit ? Math.min(500, Math.max(1, parseInt(captures.limit, 10) || 50)) : 50;

      if (!queueName) {
        return `<p style="font-family:-apple-system,sans-serif;color:#cf222e">
          Could not determine which queue to query. Try:<br>
          <em>"select messageId, sourceService from queue payments.inbound"</em><br>
          <em>"select message.Currency from queue swift.mt103.inbound where message.Currency=USD"</em>
        </p>`;
      }

      // ── Fetch messages directly from the export endpoint (non-destructive peek) ──
      const exportData = await fetchLocalApi(
        `/api/queues/${encodeURIComponent(manager)}/${encodeURIComponent(queueName)}/export`
      );

      if (!exportData) {
        return `<p style="font-family:-apple-system,sans-serif;color:#cf222e">Could not reach queue manager. Is the backend running?</p>`;
      }
      if (exportData.error) {
        return `<p style="font-family:-apple-system,sans-serif;color:#cf222e">Error: ${exportData.error}</p>`;
      }

      const allMessages = Array.isArray(exportData.messages) ? exportData.messages : [];

      // ── Helper: resolve a dot-path on the queue item object ──────────────
      function resolvePath(item, dotPath) {
        const parts = dotPath.split('.');
        let cur = item;
        for (const part of parts) {
          if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
          cur = cur[part];
        }
        return cur;
      }

      // ── Apply WHERE filter ────────────────────────────────────────────────
      let filtered = allMessages;
      let whereError = null;
      if (where) {
        const whereMatch = where.match(/^([^=!<>~]+?)\s*(~=|!=|>=|<=|>|<|=)\s*(.*)$/);
        if (!whereMatch) {
          whereError = `Invalid where expression "${where}". Use: field=value, field!=value, field>value, field~=substring`;
        } else {
          const [, wField, wOp, wValue] = whereMatch;
          const field = wField.trim();
          const expected = wValue.trim();
          filtered = allMessages.filter(item => {
            const raw = resolvePath(item, field);
            const actual = raw === undefined || raw === null ? '' : String(raw);
            switch (wOp) {
              case '=':  return actual === expected;
              case '!=': return actual !== expected;
              case '>':  return Number(actual) >  Number(expected);
              case '<':  return Number(actual) <  Number(expected);
              case '>=': return Number(actual) >= Number(expected);
              case '<=': return Number(actual) <= Number(expected);
              case '~=': return actual.toLowerCase().includes(expected.toLowerCase());
              default:   return true;
            }
          });
        }
      }

      if (whereError) {
        return `<p style="font-family:-apple-system,sans-serif;color:#cf222e">${whereError}</p>`;
      }

      // ── Apply LIMIT ───────────────────────────────────────────────────────
      const paged = filtered.slice(0, limit);

      // ── Parse SELECT columns ──────────────────────────────────────────────
      const isSelectAll   = !select || select === '*';
      const selectColumns = isSelectAll ? [] : select.split(',').map(s => s.trim()).filter(Boolean);

      let columns;
      if (isSelectAll) {
        const first = paged[0];
        columns = first ? Object.keys(first) : ['messageId', 'sourceService', 'message'];
      } else {
        columns = selectColumns;
      }

      const rows = paged.map(item =>
        Object.fromEntries(
          columns.map(col => [col, isSelectAll ? item[col] : resolvePath(item, col)])
        )
      );

      if (rows.length === 0) {
        const reason = where
          ? ` — no rows matched <code>where ${where}</code>`
          : ` — queue is empty`;
        return `<p style="font-family:-apple-system,'Segoe UI',sans-serif;color:#57606a">
          Query on <strong style="font-family:monospace">${queueName}</strong>${reason}.
        </p>`;
      }

      // ── Render results ────────────────────────────────────────────────────
      function cellValue(val) {
        if (val === null || val === undefined) return '<span style="color:#57606a">null</span>';
        if (typeof val === 'object') {
          const s = JSON.stringify(val);
          const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<span style="font-family:monospace;font-size:11px;color:#57606a">${esc.length > 80 ? esc.slice(0, 80) + '…' : esc}</span>`;
        }
        const s = String(val);
        const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return esc.length > 120
          ? `<span title="${esc}" style="font-family:monospace;font-size:11px">${esc.slice(0, 120)}…</span>`
          : `<span style="font-family:monospace;font-size:11px">${esc}</span>`;
      }

      const headerCells = columns.map(c =>
        `<th style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:left;white-space:nowrap">${c}</th>`
      ).join('');

      const bodyRows = rows.map((row, i) => {
        const cells = columns.map(col =>
          `<td style="padding:4px 8px;vertical-align:top${i % 2 === 1 ? ';background:#f7f8fa' : ''}">${cellValue(row[col])}</td>`
        ).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      const filterNote = where
        ? ` · <code style="font-size:11px">where ${where}</code> → ${filtered.length.toLocaleString()} of ${allMessages.length.toLocaleString()} matched`
        : ` · ${allMessages.length.toLocaleString()} total`;
      const selectNote = !isSelectAll ? ` · columns: <code style="font-size:11px">${select}</code>` : '';

      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
        <p style="margin:0 0 8px;color:#57606a">
          <strong style="font-family:monospace">${queueName}</strong> on <strong>${manager}</strong>
          ${filterNote}${selectNote}
          &nbsp;·&nbsp; showing ${rows.length.toLocaleString()} row${rows.length !== 1 ? 's' : ''} · read-only peek
        </p>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#f7f8fa">${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      </div>`;
    },

    // ── Flow diagram helpers (shared by flow + animatedFlow) ──────────────────
    async _buildFlowDiagramSvg(data, { title = 'Flow Diagram', width = 820, showDepths = true } = {}) {
      // data = { nodes, edges, generatedAt }
      const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
      const edges = Array.isArray(data?.edges) ? data.edges : [];

      if (nodes.length === 0) {
        return { svg: `<text x="20" y="30" font-family="sans-serif" font-size="13" fill="#57606a">No routing rules found — no flow to display.</text>`, height: 60 };
      }

      // ── Layered layout (left-to-right topological sort) ─────────────────────
      // Assign a column (layer) to each node via longest-path from sources
      const inDegree  = new Map(nodes.map(n => [n.id, 0]));
      const adjOut    = new Map(nodes.map(n => [n.id, []]));
      const adjIn     = new Map(nodes.map(n => [n.id, []]));

      for (const e of edges) {
        if (!inDegree.has(e.from) || !inDegree.has(e.to)) continue;
        inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
        adjOut.get(e.from).push(e.to);
        adjIn.get(e.to).push(e.from);
      }

      // BFS layers
      const layer  = new Map();
      const queue  = [];
      for (const n of nodes) {
        if ((inDegree.get(n.id) || 0) === 0) { layer.set(n.id, 0); queue.push(n.id); }
      }
      // Fallback — isolated nodes that have in-edges (cycles) get layer 0
      for (const n of nodes) { if (!layer.has(n.id)) { layer.set(n.id, 0); queue.push(n.id); } }

      let qi = 0;
      while (qi < queue.length) {
        const cur = queue[qi++];
        const curLayer = layer.get(cur) || 0;
        for (const next of (adjOut.get(cur) || [])) {
          if ((layer.get(next) || 0) <= curLayer) {
            layer.set(next, curLayer + 1);
          }
          if (!queue.includes(next)) queue.push(next);
        }
      }

      // Group nodes by layer
      const byLayer = new Map();
      for (const n of nodes) {
        const l = layer.get(n.id) || 0;
        if (!byLayer.has(l)) byLayer.set(l, []);
        byLayer.get(l).push(n);
      }
      const maxLayer = Math.max(...byLayer.keys());

      // Layout constants
      const NODE_W    = 160;
      const NODE_H    = 38;
      const COL_GAP   = 60;
      const ROW_GAP   = 18;
      const PAD_X     = 20;
      const PAD_Y     = 40;  // space for title

      // Assign x/y to each node
      const pos = new Map();
      const colX = [];
      let xCursor = PAD_X;
      for (let l = 0; l <= maxLayer; l++) {
        colX[l] = xCursor;
        xCursor += NODE_W + COL_GAP;
      }

      let maxY = PAD_Y;
      for (let l = 0; l <= maxLayer; l++) {
        const col = byLayer.get(l) || [];
        let y = PAD_Y;
        for (const n of col) {
          pos.set(n.id, { x: colX[l], y });
          y += NODE_H + ROW_GAP;
        }
        if (y > maxY) maxY = y;
      }

      const svgWidth  = xCursor - COL_GAP + PAD_X;
      const svgHeight = maxY + 20;

      // ── Render nodes ─────────────────────────────────────────────────────────
      function depthColor(d) {
        if (d === 0) return '#e5e7eb';
        if (d < 10)  return '#fde68a';
        if (d < 100) return '#fbbf24';
        return '#f87171';
      }
      function textColor(d) { return d >= 100 ? '#fff' : '#1f2328'; }

      const nodeSvg = nodes.map(n => {
        const p = pos.get(n.id);
        if (!p) return '';
        const depth    = n.depth || 0;
        const fill     = depthColor(depth);
        const tc       = textColor(depth);
        const label    = n.label.length > 20 ? n.label.slice(0, 18) + '…' : n.label;
        const depthBadge = showDepths && depth > 0
          ? `<rect x="${p.x + NODE_W - 32}" y="${p.y + 4}" width="28" height="16" rx="8" fill="#3b82d4"/>
             <text x="${p.x + NODE_W - 18}" y="${p.y + 15}" font-size="9" fill="#fff" text-anchor="middle" font-family="monospace">${depth}</text>`
          : '';
        return `<g>
          <rect x="${p.x}" y="${p.y}" width="${NODE_W}" height="${NODE_H}" rx="6" fill="${fill}" stroke="#d0d7de" stroke-width="1.2"/>
          ${depthBadge}
          <text x="${p.x + NODE_W / 2}" y="${p.y + NODE_H / 2 + 5}" font-size="11" fill="${tc}" text-anchor="middle" font-family="-apple-system,sans-serif" font-weight="500">${label}</text>
        </g>`;
      }).join('\n');

      // ── Render edges (cubic bezier) ───────────────────────────────────────────
      const edgeSvg = edges.map(e => {
        const from = pos.get(e.from);
        const to   = pos.get(e.to);
        if (!from || !to) return '';
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const cx = (x1 + x2) / 2;
        return `<path d="M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}" fill="none" stroke="#8b949e" stroke-width="1.5" marker-end="url(#arr)"/>`;
      }).join('\n');

      const titleSvg = `<text x="${PAD_X}" y="24" font-size="13" font-weight="600" fill="#1f2328" font-family="-apple-system,sans-serif">${title}</text>
        <text x="${svgWidth - PAD_X}" y="24" font-size="10" fill="#57606a" text-anchor="end" font-family="monospace">${data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : ''}</text>`;

      const defs = `<defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#8b949e"/>
        </marker>
      </defs>`;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
        ${defs}
        ${titleSvg}
        ${edgeSvg}
        ${nodeSvg}
      </svg>`;

      return { svg, width: svgWidth, height: svgHeight };
    },

    async flow(data) {
      // data = /api/agent/flow-diagram payload
      if (!data) return `<p style="font-family:-apple-system,sans-serif;color:#cf222e">Flow data unavailable.</p>`;

      const { svg, width, height } = await FORMATTERS._buildFlowDiagramSvg(data, { title: 'Message Flow Diagram' });

      // Base64-encode the SVG for a download link
      const svgB64  = Buffer.from(svg, 'utf8').toString('base64');
      const dlHref  = `data:image/svg+xml;base64,${svgB64}`;
      const ts      = data.generatedAt ? new Date(data.generatedAt).toISOString().replace(/[:.]/g, '-').slice(0, 19) : 'export';
      const dlName  = `flow-diagram-${ts}.svg`;

      const nodeCount = (data.nodes || []).length;
      const edgeCount = (data.edges || []).length;
      const withDepth = (data.nodes || []).filter(n => n.depth > 0).length;

      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap">
          <span style="color:#57606a">${nodeCount} queue${nodeCount !== 1 ? 's' : ''} · ${edgeCount} route${edgeCount !== 1 ? 's' : ''}${withDepth > 0 ? ` · <strong style="color:#f59e0b">${withDepth} with messages</strong>` : ''}</span>
          <a href="${dlHref}" download="${dlName}" style="font-size:11px;padding:3px 10px;border:1px solid #d0d7de;border-radius:5px;color:#3b82d4;text-decoration:none;background:#f7f8fa">⬇ Export SVG</a>
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:auto;background:#fff;padding:8px">
          ${svg}
        </div>
        <p style="margin:6px 0 0;font-size:11px;color:#57606a">Node colour: <span style="background:#e5e7eb;padding:1px 6px;border-radius:3px">empty</span> <span style="background:#fde68a;padding:1px 6px;border-radius:3px">&lt;10</span> <span style="background:#fbbf24;padding:1px 6px;border-radius:3px">&lt;100</span> <span style="background:#f87171;color:#fff;padding:1px 6px;border-radius:3px">≥100</span></p>
      </div>`;
    },

    async animatedFlow(_data, captures) {
      // Builds a self-contained HTML page that polls /api/agent/flow-diagram
      // every N seconds and re-renders the SVG — delivered as a data:text/html link
      // that opens in a new tab, plus a live inline preview note.
      const interval = captures?.interval
        ? Math.max(5, Math.min(300, parseInt(captures.interval, 10) || 30))
        : 30;

      // Fetch current snapshot for the inline preview
      const data = await fetchLocalApi('/api/agent/flow-diagram');
      const nodes    = Array.isArray(data?.nodes) ? data.nodes : [];
      const edges    = Array.isArray(data?.edges) ? data.edges : [];
      const nodeCount = nodes.length;
      const edgeCount = edges.length;

      // Build the self-contained animated HTML page
      // It uses fetch() + setInterval to poll the live endpoint and redraw the SVG.
      const animatedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Animated Flow Diagram</title>
<style>
  body { margin:0; font-family:-apple-system,'Segoe UI',sans-serif; background:#f7f8fa; color:#1f2328; }
  #header { display:flex; align-items:center; gap:14px; padding:10px 16px; background:#fff; border-bottom:1px solid #e5e7eb; flex-wrap:wrap; }
  #header h2 { margin:0; font-size:15px; font-weight:600; }
  #meta { font-size:12px; color:#57606a; }
  #status { font-size:11px; padding:2px 8px; border-radius:10px; background:#e5e7eb; }
  #status.ok { background:#dcfce7; color:#15803d; }
  #status.err { background:#fee2e2; color:#b91c1c; }
  #canvas { padding:16px; overflow:auto; }
  #canvas svg { display:block; max-width:100%; }
  #legend { padding:6px 16px; font-size:11px; color:#57606a; }
  #controls { display:flex; gap:10px; align-items:center; }
  button { font-size:12px; padding:3px 10px; border:1px solid #d0d7de; border-radius:5px; background:#f7f8fa; cursor:pointer; }
  button:hover { background:#e5e7eb; }
  input[type=number] { width:56px; font-size:12px; padding:2px 6px; border:1px solid #d0d7de; border-radius:4px; }
</style>
</head>
<body>
<div id="header">
  <h2>&#9654; Live Flow Diagram</h2>
  <div id="meta">Refreshing every <input type="number" id="ivInput" min="5" max="300" value="${interval}">s</div>
  <div id="controls">
    <button onclick="applyInterval()">Apply</button>
    <button onclick="pause()">Pause</button>
    <button onclick="exportSvg()">&#11015; Export SVG</button>
  </div>
  <div id="status">connecting…</div>
</div>
<div id="canvas"><p style="color:#57606a;padding:20px">Loading…</p></div>
<div id="legend">
  Node colour:
  <span style="background:#e5e7eb;padding:1px 6px;border-radius:3px">empty</span>
  <span style="background:#fde68a;padding:1px 6px;border-radius:3px">&lt;10 msgs</span>
  <span style="background:#fbbf24;padding:1px 6px;border-radius:3px">&lt;100 msgs</span>
  <span style="background:#f87171;color:#fff;padding:1px 6px;border-radius:3px">&#8805;100 msgs</span>
  &nbsp;· Blue badge = live depth
</div>

<script>
const BASE = location.origin;
let intervalMs = ${interval} * 1000;
let timerId = null;
let paused  = false;
let lastSvg = '';

function depthColor(d) {
  if (d === 0) return '#e5e7eb';
  if (d < 10)  return '#fde68a';
  if (d < 100) return '#fbbf24';
  return '#f87171';
}
function textColor(d) { return d >= 100 ? '#fff' : '#1f2328'; }

function buildSvg(nodes, edges, generatedAt) {
  if (!nodes.length) return '<p style="color:#57606a;padding:20px">No routing rules — no flow to display.</p>';

  const NODE_W=160, NODE_H=38, COL_GAP=60, ROW_GAP=18, PAD_X=20, PAD_Y=40;

  const inDegree = new Map(nodes.map(n=>[n.id,0]));
  const adjOut   = new Map(nodes.map(n=>[n.id,[]]));
  for (const e of edges) {
    if (!inDegree.has(e.from)||!inDegree.has(e.to)) continue;
    inDegree.set(e.to,(inDegree.get(e.to)||0)+1);
    adjOut.get(e.from).push(e.to);
  }

  const layer = new Map();
  const q = [];
  for (const n of nodes) { if (!inDegree.get(n.id)) { layer.set(n.id,0); q.push(n.id); } }
  for (const n of nodes) { if (!layer.has(n.id)) { layer.set(n.id,0); q.push(n.id); } }
  let qi=0;
  while (qi<q.length) {
    const cur=q[qi++]; const cl=layer.get(cur)||0;
    for (const nxt of (adjOut.get(cur)||[])) {
      if ((layer.get(nxt)||0)<=cl) layer.set(nxt,cl+1);
      if (!q.includes(nxt)) q.push(nxt);
    }
  }

  const byLayer=new Map();
  for (const n of nodes) { const l=layer.get(n.id)||0; if(!byLayer.has(l))byLayer.set(l,[]); byLayer.get(l).push(n); }
  const maxLayer=Math.max(...byLayer.keys());

  const colX=[]; let xCursor=PAD_X;
  for(let l=0;l<=maxLayer;l++){colX[l]=xCursor;xCursor+=NODE_W+COL_GAP;}

  const pos=new Map(); let maxY=PAD_Y;
  for(let l=0;l<=maxLayer;l++){
    const col=byLayer.get(l)||[]; let y=PAD_Y;
    for(const n of col){pos.set(n.id,{x:colX[l],y}); y+=NODE_H+ROW_GAP;}
    if(y>maxY)maxY=y;
  }

  const svgW=xCursor-COL_GAP+PAD_X, svgH=maxY+20;

  const nodeSvg=nodes.map(n=>{
    const p=pos.get(n.id); if(!p)return '';
    const d=n.depth||0; const fill=depthColor(d); const tc=textColor(d);
    const lbl=n.label.length>20?n.label.slice(0,18)+'…':n.label;
    const badge=d>0?\`<rect x="\${p.x+NODE_W-32}" y="\${p.y+4}" width="28" height="16" rx="8" fill="#3b82d4"/><text x="\${p.x+NODE_W-18}" y="\${p.y+15}" font-size="9" fill="#fff" text-anchor="middle" font-family="monospace">\${d}</text>\`:'';
    return \`<g><rect x="\${p.x}" y="\${p.y}" width="\${NODE_W}" height="\${NODE_H}" rx="6" fill="\${fill}" stroke="#d0d7de" stroke-width="1.2"/>\${badge}<text x="\${p.x+NODE_W/2}" y="\${p.y+NODE_H/2+5}" font-size="11" fill="\${tc}" text-anchor="middle" font-family="-apple-system,sans-serif" font-weight="500">\${lbl}</text></g>\`;
  }).join('');

  const edgeSvg=edges.map(e=>{
    const f=pos.get(e.from),t=pos.get(e.to); if(!f||!t)return '';
    const x1=f.x+NODE_W,y1=f.y+NODE_H/2,x2=t.x,y2=t.y+NODE_H/2,cx=(x1+x2)/2;
    return \`<path d="M\${x1},\${y1} C\${cx},\${y1} \${cx},\${y2} \${x2},\${y2}" fill="none" stroke="#8b949e" stroke-width="1.5" marker-end="url(#arr)"/>\`;
  }).join('');

  const timeStr=generatedAt?new Date(generatedAt).toLocaleTimeString():'';
  return \`<svg xmlns="http://www.w3.org/2000/svg" width="\${svgW}" height="\${svgH}" viewBox="0 0 \${svgW} \${svgH}" id="flowSvg">
    <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#8b949e"/></marker></defs>
    <text x="20" y="24" font-size="13" font-weight="600" fill="#1f2328" font-family="-apple-system,sans-serif">Message Flow Diagram</text>
    <text x="\${svgW-20}" y="24" font-size="10" fill="#57606a" text-anchor="end" font-family="monospace">\${timeStr}</text>
    \${edgeSvg}\${nodeSvg}
  </svg>\`;
}

async function refresh() {
  if (paused) return;
  const st = document.getElementById('status');
  try {
    const r = await fetch(BASE + '/api/agent/flow-diagram', { headers:{'x-user-id':'systemadmin'} });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    const svg = buildSvg(data.nodes||[], data.edges||[], data.generatedAt);
    lastSvg = svg;
    document.getElementById('canvas').innerHTML = svg;
    st.className = 'ok';
    st.textContent = 'live · ' + new Date().toLocaleTimeString();
  } catch(e) {
    st.className = 'err';
    st.textContent = 'error: ' + e.message;
  }
}

function applyInterval() {
  const v = parseInt(document.getElementById('ivInput').value, 10);
  if (!v || v < 5) return;
  intervalMs = v * 1000;
  clearInterval(timerId);
  timerId = setInterval(refresh, intervalMs);
  paused = false;
  document.querySelector('button[onclick="pause()"]').textContent = 'Pause';
}

function pause() {
  paused = !paused;
  document.querySelector('button[onclick="pause()"]').textContent = paused ? '▶ Resume' : 'Pause';
}

function exportSvg() {
  const el = document.getElementById('flowSvg');
  if (!el) return;
  const src = new XMLSerializer().serializeToString(el);
  const a = document.createElement('a');
  a.href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  a.download = 'flow-diagram-' + new Date().toISOString().slice(0,19).replace(/[:.]/g,'-') + '.svg';
  a.click();
}

refresh();
timerId = setInterval(refresh, intervalMs);
</script>
</body>
</html>`;

      // Build inline static preview
      const previewSvg = nodeCount > 0
        ? (await FORMATTERS._buildFlowDiagramSvg(data, { title: 'Current Snapshot' })).svg
        : `<p style="color:#57606a">No routing rules found.</p>`;

      const liveUrl    = `/api/agent/animated-flow-page?interval=${interval}`;
      // Export: encode the animatedHtml as a data: download (download attr, not navigation)
      const pageB64    = Buffer.from(animatedHtml, 'utf8').toString('base64');
      const exportHref = `data:text/html;base64,${pageB64}`;

      return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap">
          <span style="font-weight:600">Animated Flow Diagram</span>
          <span style="color:#57606a;font-size:12px">${nodeCount} queue${nodeCount!==1?'s':''} · ${edgeCount} route${edgeCount!==1?'s':''} · refreshes every ${interval}s</span>
          <a href="${liveUrl}" target="_blank" rel="noopener" style="font-size:12px;padding:4px 12px;border-radius:5px;background:#3b82d4;color:#fff;text-decoration:none;font-weight:500">&#9654; Open Live View</a>
          <a href="${exportHref}" download="animated-flow-${interval}s.html" style="font-size:11px;padding:3px 10px;border:1px solid #d0d7de;border-radius:5px;color:#3b82d4;text-decoration:none;background:#f7f8fa">&#11015; Export HTML</a>
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:auto;background:#fff;padding:8px;position:relative">
          ${previewSvg}
          <div style="position:absolute;top:8px;right:10px;font-size:10px;background:#f7f8fa;border:1px solid #e5e7eb;border-radius:3px;padding:2px 7px;color:#57606a">snapshot · click &#9654; for live</div>
        </div>
        <p style="margin:6px 0 0;font-size:11px;color:#57606a">The live view opens in a new tab and polls <code>/api/agent/flow-diagram</code> every ${interval} seconds. Use "animated flow every 10 seconds" to change the interval.</p>
      </div>`;
    },
  };

  // ── Interaction log (feedback dataset) ──────────────────────────────────────
  const INTERACTION_LOG_PATH = path.resolve('./data/interaction-log.jsonl');

  function appendInteractionLog(record) {
    try {
      fs.appendFileSync(INTERACTION_LOG_PATH, JSON.stringify(record) + '\n', 'utf8');
    } catch (e) {
      console.warn('[AGENT] Could not write interaction log:', e.message);
    }
  }

  app.get('/api/agent/corrections', (req, res) => {
    try {
      res.json(getNliCorrectionStatus());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/agent/corrections/run', express.json(), async (req, res) => {
    try {
      const result = await runPendingNliCorrections({
        enqueueEscalation: async (packet) => {
          const backendPort = Number(process.env.HTTP_PORT || process.env.PORT || 4000);
          const response = await fetch(
            `http://127.0.0.1:${backendPort}/api/queue/nli.corrections.escalation/enqueue`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ message: packet, sourceService: 'nli-correction-service' }),
            },
          );
          if (!response.ok) {
            const details = await response.text().catch(() => '');
            throw new Error(`Escalation queue returned ${response.status}: ${details}`);
          }
        },
      });
      rebuildSystemPrompt();
      res.json({ ok: true, ...result });
    } catch (e) {
      console.error('[NLI] Correction run failed:', e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/agent/feedback
  // Body: { interactionId, rating: 'good'|'bad', expected?: string }
  app.post('/api/agent/feedback', express.json(), (req, res) => {
    try {
      const { interactionId, rating, expected } = req.body || {};
      if (!interactionId || !['good', 'bad'].includes(rating)) {
        return res.status(400).json({ error: 'interactionId and rating (good|bad) are required' });
      }
      appendInteractionLog({
        type: 'feedback',
        interactionId: String(interactionId),
        rating: String(rating),
        expected: expected ? String(expected).slice(0, 500) : null,
        recordedAt: new Date().toISOString(),
      });
      res.json({ ok: true, ...getNliCorrectionStatus() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/nli/query-stream
   * SSE endpoint — streams tokens + status notes in real time.
   * Saves partial results so the client can resume if connection drops.
   * Events: { type: 'status'|'token'|'done'|'error', text, interactionId, partial }
   */
  app.post('/api/nli/query-stream', upload.array('files'), async (req, res) => {
    const interactionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const message = String(req.body?.message || '').trim();

    if (!message) {
      return res.status(400).json({ error: 'No message provided.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Interaction-Id', interactionId);
    res.flushHeaders();

    const send = (type, payload) => {
      try { res.write(`data: ${JSON.stringify({ type, interactionId, ...payload })}\n\n`); } catch { /* client disconnected */ }
    };

    send('status', { text: `Interaction ${interactionId} started` });

    // Check deterministic intent first — no Ollama needed
    const match = await matchAgentIntent(message).catch(() => null);
    if (match) {
      const { intent, captures } = match;
      const formatter = FORMATTERS[intent.formatter];
      try {
        let data = null;
        if (intent.api !== null) data = await fetchLocalApi(intent.api);
        const result = formatter ? await Promise.resolve(formatter(data, captures, {
          userId: String(req.get('x-user-id') || OLLAMA_QUEUE_ACTION_USER_ID)
        })) : { output: String(data) };
        const text = result?.output ?? JSON.stringify(result);
        savePartial(interactionId, { text, partial: false, message, intentId: intent.id });
        send('done', { text, partial: false, intentId: intent.id });
        return res.end();
      } catch (e) {
        send('status', { text: `Intent handler failed (${e.message}), falling back to Ollama...` });
      }
    }

    send('status', { text: 'Sending to Ollama...' });

    // Build the same prompt the askHandler would use
    const syntheticQuery = message;
    let accumulated = '';

    try {
      const result = await ollamaGenerateStream(syntheticQuery, {
        onToken(token) {
          accumulated += token;
          send('token', { text: token });
        },
        onStatus(msg) {
          send('status', { text: msg });
        },
      });

      const finalText = result.text || accumulated;
      savePartial(interactionId, { text: finalText, partial: result.partial, message, intentId: 'ollama-stream' });

      if (result.partial) {
        send('done', {
          text: finalText,
          partial: true,
          canContinue: true,
          text_so_far: finalText,
          note: 'Response was cut short. Use POST /api/nli/continue with this interactionId to get more.',
        });
      } else {
        send('done', { text: finalText, partial: false });
      }
    } catch (e) {
      savePartial(interactionId, { text: accumulated, partial: true, message, intentId: 'ollama-stream', error: e.message });
      send('error', { text: e.message, text_so_far: accumulated, canContinue: !!accumulated });
    }

    res.end();
  });

  /**
   * POST /api/nli/continue
   * Resume a partial or timed-out interaction.
   * Body: { interactionId }
   * Returns the saved partial text and status.
   */
  app.post('/api/nli/continue', express.json(), (req, res) => {
    const id = String(req.body?.interactionId || '').trim();
    if (!id) return res.status(400).json({ error: 'interactionId is required' });
    const saved = getPartial(id);
    if (!saved) {
      return res.status(404).json({ error: `No partial result found for interactionId "${id}". It may have expired (30 min TTL).` });
    }
    res.json({
      interactionId: id,
      text: saved.text,
      partial: saved.partial,
      message: saved.message,
      intentId: saved.intentId,
      savedAt: new Date(saved.savedAt).toISOString(),
      error: saved.error || null,
    });
  });

  app.post('/api/nli/query', upload.array('files'), async (req, res) => {
    const interactionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const shouldRecordInteraction = req.get('x-agent-test') !== '1';
    try {
      const message = String(req.body?.message || '').trim();
      if (!message) return res.status(400).json({
        output: 'No message provided.',
        voiceReply: "I'm unclear, can you help me with this",
        _needsClarification: true,
      });

      console.log(`[AGENT] message="${message.substring(0, 80)}"`);

      // ── Reset ──────────────────────────────────────────────────────────────
      if (message === '__RESET_MODEL__') {
        responseCache.clear();
        const reloadResult = await reloadOllamaContext();
        return res.json({
          output: reloadResult.success
            ? 'Model context cleared and reloaded successfully.'
            : `Reset attempted, but reload reported: ${reloadResult.error || 'unknown error'}`,
          voiceReply: reloadResult.success ? 'OK' : "I'm unclear, can you help me with this",
          _needsClarification: !reloadResult.success,
        });
      }

      // ── Intent dispatch (driven by data/agent-routes.json) ─────────────────
      const match = await matchAgentIntent(message);
      let intentId = match ? match.intent.id : 'ollama-fallback';

      const respond = (result, confidence = 1) => {
        const { responsePolicy } = getNliConfig();
        const structured = result && typeof result === 'object' && !Array.isArray(result)
          ? result
          : { output: result };
        const output = structured.output ?? '';
        const normalizedConfidence = Number(confidence) > 1
          ? Number(confidence) / 100
          : Number(confidence);
        const needsClarification = !Number.isFinite(normalizedConfidence)
          || normalizedConfidence < Number(responsePolicy.clarificationConfidence);
        const explicitVoiceReply = String(structured.voiceReply || '').trim();
        const voiceReply = explicitVoiceReply
          || (needsClarification ? responsePolicy.clarificationReply : responsePolicy.successReply);

        // Log the interaction before responding
        if (shouldRecordInteraction) {
          appendInteractionLog({
            type: 'interaction',
            interactionId,
            message,
            intentId,
            outputSummary: String(output || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
            recordedAt: new Date().toISOString(),
          });
        }
        res.json({
          output,
          voiceReply,
          _interactionId: interactionId,
          _intentId: intentId,
          _needsClarification: needsClarification,
        });
      };

      if (match) {
        const { intent, captures } = match;
        console.log(`[AGENT] intent="${intent.id}" formatter="${intent.formatter}" captures=${JSON.stringify(captures)}`);
        const formatter = FORMATTERS[intent.formatter];
        if (intent.api === null && formatter) {
          const formatted = await Promise.resolve(formatter(null, captures, {
            userId: String(req.get('x-user-id') || req.body?.userId || OLLAMA_QUEUE_ACTION_USER_ID)
          }));
          return respond(formatted, formatted?.confidence ?? 1);
        }
        const data = await fetchLocalApi(intent.api);
        if (data && formatter) {
          return respond(await Promise.resolve(formatter(data, captures, {
            userId: String(req.get('x-user-id') || req.body?.userId || OLLAMA_QUEUE_ACTION_USER_ID)
          })));
        }
        console.warn(`[AGENT] intent "${intent.id}" matched but api/formatter failed — falling through`);
        intentId = 'ollama-fallback';
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
            const rawOutput = data?.answer || data?.output;
            // If Ollama timed out before producing any tokens, give a helpful message
            const output = rawOutput
              ? String(rawOutput)
              : 'The model is still loading — please try again in a few seconds. (Ollama did not respond within the timeout window.)';
            respond({ output, voiceReply: data?.voiceReply }, rawOutput ? (data?.confidence ?? 0) : 0);
            resolve();
          }
        };
        Promise.resolve(askHandler(syntheticReq, syntheticRes)).catch((err) => {
          if (!settled) {
            settled = true;
            respond(`Error: ${err.message || String(err)}`, 0);
          }
          resolve();
        });
      });

    } catch (e) {
      console.error('[AGENT] Unhandled error:', e?.message || String(e));
      res.status(500).json({
        output: `Server error: ${e?.message || String(e)}`,
        voiceReply: "I'm unclear, can you help me with this",
        _needsClarification: true,
      });
    }
  });

  console.log('[OLLAMA] Routes registered at /api/ollama/* and /api/openai/* (compat)');
  console.log('[NLI] /api/nli/query endpoint registered');
}
