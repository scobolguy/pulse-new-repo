import fs from 'fs/promises';
import path from 'path';
import { runPL0 } from './scripts/pl0-interpreter.mjs';

const OUTPUT_ASSIGN_RE = /^\s*output\s*:=\s*(.+?)\s*;?\s*$/i;

function toObject(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function isTruthy(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === '' || v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
    return true;
  }
  return Boolean(value);
}

function validateRuleShape(rule) {
  if (!rule || typeof rule !== 'object') throw new Error('rule must be an object');
  if (!rule.id || typeof rule.id !== 'string') throw new Error('rule.id is required');
  if (!rule.inputQueue || typeof rule.inputQueue !== 'string') throw new Error('rule.inputQueue is required');
  if (!Array.isArray(rule.outputs) || rule.outputs.length === 0) throw new Error('rule.outputs must be a non-empty array');
  for (const out of rule.outputs) {
    if (!out || typeof out !== 'object') throw new Error('output must be an object');
    if (!out.queueName || typeof out.queueName !== 'string') throw new Error('output.queueName is required');
    if (Object.prototype.hasOwnProperty.call(out, 'dataTypeId') && typeof out.dataTypeId !== 'string') {
      throw new Error('output.dataTypeId must be a string when provided');
    }
    if (Object.prototype.hasOwnProperty.call(out, 'dataTypeIds')) {
      if (!Array.isArray(out.dataTypeIds) || out.dataTypeIds.some(v => typeof v !== 'string')) {
        throw new Error('output.dataTypeIds must be an array of strings when provided');
      }
    }
  }
}

function getPathValue(obj, dotPath) {
  return String(dotPath || '')
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setPathValue(obj, dotPath, value) {
  const keys = String(dotPath || '').split('.').filter(Boolean);
  if (keys.length === 0) return;
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (cursor[key] == null || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

function findTopLevelComma(content) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      continue;
    }
    if (ch === ',' && depth === 0) return i;
  }
  return -1;
}

function parseQuotedLiteral(text) {
  const s = String(text || '').trim();
  if (s.length < 2) return null;
  const q = s[0];
  if ((q !== '"' && q !== "'") || s[s.length - 1] !== q) return null;
  return s.slice(1, -1);
}

async function loadJsonOrDefault(filePath, defaultValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

export function createRouterEngine({ rulesPath, mappingsPath = './data/data-mappings.json', serviceId = 'default-router-service', publishToQueue, dequeueFromQueue }) {
  if (!rulesPath) throw new Error('rulesPath is required');
  if (typeof publishToQueue !== 'function') throw new Error('publishToQueue function is required');
  if (typeof dequeueFromQueue !== 'function') throw new Error('dequeueFromQueue function is required');

  const absoluteRulesPath = path.resolve(rulesPath);
  const absoluteMappingsPath = path.resolve(mappingsPath);
  let rules = [];
  let mappings = [];

  async function saveRules() {
    await fs.mkdir(path.dirname(absoluteRulesPath), { recursive: true });
    await fs.writeFile(absoluteRulesPath, JSON.stringify(rules, null, 2) + '\n', 'utf-8');
  }

  async function ensureLoaded() {
    if (rules.length > 0) return;
    const loaded = await loadJsonOrDefault(absoluteRulesPath, []);
    rules = Array.isArray(loaded) ? loaded : [];
  }

  async function ensureMappingsLoaded() {
    if (mappings.length > 0) return;
    const loaded = await loadJsonOrDefault(absoluteMappingsPath, []);
    mappings = Array.isArray(loaded) ? loaded : [];
  }

  function evaluateWhen(whenRule, vars) {
    const code = String(whenRule || '').trim();
    if (!code) return true;
    const result = runPL0(code, vars);
    return isTruthy(result.output);
  }

  function runMapping(mappingId, inputPayload) {
    const mapping = mappings.find(m => m.id === mappingId);
    if (!mapping) {
      throw new Error(`Mapping ${mappingId} not found in ${absoluteMappingsPath}`);
    }

    const source = toObject(inputPayload);
    const target = {};

    for (const item of mapping.items || []) {
      const srcValue = getPathValue(source, item.sourcePath);
      const ruleText = String(item.conversionRule || '').trim();
      const outValue = ruleText ? runPL0(ruleText, { src: srcValue, payload: source, input: source }).output : srcValue;
      setPathValue(target, item.targetPath, outValue);
    }

    return target;
  }

  function evaluateMapExpression(exprText, vars, fallbackMessage) {
    const expr = String(exprText || '').trim();

    if (!expr) return fallbackMessage;

    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
      return Object.prototype.hasOwnProperty.call(vars, expr) ? vars[expr] : fallbackMessage;
    }

    const quoted = parseQuotedLiteral(expr);
    if (quoted != null) {
      return quoted;
    }

    if (!expr.toLowerCase().startsWith('map(') || !expr.endsWith(')')) {
      throw new Error(`Unsupported map expression: ${expr}`);
    }

    const inside = expr.slice(4, -1).trim();
    const commaIdx = findTopLevelComma(inside);
    if (commaIdx < 0) {
      throw new Error(`map(...) requires two arguments: ${expr}`);
    }

    const mappingToken = inside.slice(0, commaIdx).trim();
    const payloadExpr = inside.slice(commaIdx + 1).trim();
    const mappingId = parseQuotedLiteral(mappingToken);
    if (!mappingId) {
      throw new Error(`map(...) first argument must be a quoted mapping id: ${expr}`);
    }

    const payload = evaluateMapExpression(payloadExpr, vars, fallbackMessage);
    return runMapping(mappingId, payload);
  }

  function evaluateTransform(transformRule, fallbackMessage, vars) {
    const code = String(transformRule || '').trim();
    if (!code) return fallbackMessage;

    const assignment = code.match(OUTPUT_ASSIGN_RE);
    if (assignment) {
      const rhs = assignment[1].trim();
      if (rhs.toLowerCase().startsWith('map(')) {
        return evaluateMapExpression(rhs, vars, fallbackMessage);
      }
    }

    const result = runPL0(code, vars);
    return result.output;
  }

  async function processMessage({ inputQueue, message, sourceService = 'router' }) {
    await ensureLoaded();
    await ensureMappingsLoaded();

    const matchingRules = rules.filter(r => (
      r.enabled !== false
      && r.inputQueue === inputQueue
      && (!r.serviceId || r.serviceId === serviceId)
    ));
    if (matchingRules.length === 0) {
      return {
        inputQueue,
        sourceService,
        matchedRuleCount: 0,
        publishedCount: 0,
        deliveries: []
      };
    }

    const messageObject = toObject(message);
    const deliveries = [];

    for (const rule of matchingRules) {
      for (const output of rule.outputs) {
        const vars = {
          src: message,
          msg: message,
          inputQueue,
          sourceService,
          outputQueue: output.queueName,
          routerRuleId: rule.id,
          routerServiceId: serviceId,
          payload: messageObject,
          json: messageObject,
          out: ''
        };

        const shouldRoute = evaluateWhen(output.whenRule, vars);
        if (!shouldRoute) continue;

        const routedMessage = evaluateTransform(output.transformRule, message, vars);
        const delivery = await publishToQueue({
          queueName: output.queueName,
          message: routedMessage,
          sourceService: `${sourceService}:router:${rule.id}`,
          dataTypeIds: Array.isArray(output.dataTypeIds)
            ? output.dataTypeIds
            : (output.dataTypeId ? [output.dataTypeId] : undefined)
        });

        deliveries.push({
          ruleId: rule.id,
          outputQueue: output.queueName,
          delivery
        });
      }
    }

    return {
      inputQueue,
      sourceService,
      matchedRuleCount: matchingRules.length,
      publishedCount: deliveries.length,
      deliveries
    };
  }

  return {
    async listRules() {
      await ensureLoaded();
      return rules;
    },

    async upsertRule(rule) {
      await ensureLoaded();
      validateRuleShape(rule);
      const normalized = {
        id: rule.id,
        name: rule.name || rule.id,
        serviceId: rule.serviceId || serviceId,
        enabled: rule.enabled !== false,
        inputQueue: rule.inputQueue,
        description: rule.description || '',
        outputs: rule.outputs.map(out => ({
          queueName: out.queueName,
          ...(Array.isArray(out.dataTypeIds) && out.dataTypeIds.length > 0
            ? { dataTypeIds: out.dataTypeIds, dataTypeId: out.dataTypeIds[0] }
            : (out.dataTypeId ? { dataTypeId: out.dataTypeId, dataTypeIds: [out.dataTypeId] } : {})),
          whenRule: out.whenRule || 'output := 1;',
          transformRule: out.transformRule || 'output := src;'
        })),
        updatedAt: new Date().toISOString(),
        createdAt: rule.createdAt || new Date().toISOString()
      };

      const idx = rules.findIndex(r => r.id === normalized.id);
      if (idx >= 0) {
        normalized.createdAt = rules[idx].createdAt || normalized.createdAt;
        rules[idx] = normalized;
      } else {
        rules.push(normalized);
      }
      await saveRules();
      return normalized;
    },

    async deleteRule(ruleId) {
      await ensureLoaded();
      const before = rules.length;
      rules = rules.filter(r => r.id !== ruleId);
      const removed = before !== rules.length;
      if (removed) await saveRules();
      return removed;
    },

    async ingest(payload) {
      const { inputQueue, message, sourceService } = payload || {};
      if (!inputQueue) throw new Error('inputQueue is required');
      return processMessage({ inputQueue, message, sourceService: sourceService || 'api' });
    },

    async processFromQueue(inputQueue, { consumerService = 'router', maxMessages = 1 } = {}) {
      if (!inputQueue) throw new Error('inputQueue is required');
      const limit = Number(maxMessages || 1);
      const results = [];

      for (let i = 0; i < limit; i += 1) {
        const queued = await dequeueFromQueue({ inputQueue, consumerService });
        if (!queued) break;

        const message = Object.prototype.hasOwnProperty.call(queued, 'message') ? queued.message : queued;
        const sourceService = queued?.sourceService || consumerService;
        const routeResult = await processMessage({ inputQueue, message, sourceService });
        results.push({ dequeued: queued, routed: routeResult });
      }

      return {
        inputQueue,
        requested: limit,
        processed: results.length,
        results
      };
    }
  };
}
