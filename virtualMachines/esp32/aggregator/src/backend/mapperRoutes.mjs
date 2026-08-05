import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import XLSX from 'xlsx';
import { XMLBuilder } from 'fast-xml-parser';
import { runPL0 } from '../../scripts/pl0-interpreter.mjs';
import { compileMaplWithAntlr } from '../../scripts/compile-mapl-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../scripts/pcode-signing.mjs';
import { runSingleMessageForEvolution } from '../../scripts/run-js-pmachine.mjs';
import { ollamaGenerate } from './ollamaService.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaultRuntimeRoot = path.resolve(
  process.env.PULSE_OPERATIONAL_DATA_ROOT
  || (process.platform === 'win32' ? 'c:/dev/pulse-operational-data' : '/opt/pulse/operational-data')
);
const runtimeRoot = path.resolve(
  process.env.PULSE_DEVELOP_WORKSPACE_ROOT
  || process.env.PULSE_RUNTIME_DATA_ROOT
  || process.env.PULSE_QUEUE_DATA_ROOT
  || defaultRuntimeRoot
);
const mapsRoot = path.join(runtimeRoot, 'data-maps');
const defaultMapsRoot = path.join(defaultRuntimeRoot, 'data-maps');
const issueTestStorePath = path.join(runtimeRoot, 'issue-test-system.json');
const mapperAuthoringRoot = path.join(runtimeRoot, 'mapper-authoring-artifacts');
const mapperInventoryPath = path.join(runtimeRoot, 'mapper-authoring-inventory.json');
const mapperDeploymentsPath = path.join(runtimeRoot, 'mapper-authoring-deployments.json');
const librarianDataTypesPath = path.join(runtimeRoot, 'services', 'librarian', 'data-types.json');

const DETERMINISTIC_GENERATOR_VERSION = 'mapper-authoring-deterministic-v1';
const TYPE_ALIAS_VERSION = 'type-alias-v1';
const TEMPLATE_VERSION = 'external-json-maps-v2';
const INTENT_SCHEMA_VERSION = 'intent-schema-v1';
let lastGeneratedMap = null;

const TYPE_ALIASES = new Map([
  ['pacs8', 'pacs'],
  ['pacs008', 'pacs'],
  ['pacs.008', 'pacs'],
  ['pacs.008.001.14', 'pacs'],
  ['swift pacs008', 'pacs'],
  ['swift pacs8', 'pacs'],
  ['mt700', 'swift-mt700'],
  ['swift-mt700', 'swift-mt700'],
  ['mt940', 'swift-mt940'],
  ['swift mt940', 'swift-mt940'],
  ['swift-mt940', 'swift-mt940'],
  ['camt.053', 'camt'],
  ['camt053', 'camt'],
  ['pacs payment', 'pacs'],
  ['single transactions', 'pacs']
]);

function stableSortValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableSortValue);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const out = {};
  for (const key of keys) {
    out[key] = stableSortValue(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSortValue(value), null, 2);
}

function serializeXml(value) {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    textNodeName: '#text',
    format: true,
    indentBy: '  ',
    suppressEmptyNode: true
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(value)}`;
}

function sha256Hex(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function normalizeTypeToken(value) {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return '';
  return TYPE_ALIASES.get(token) || token;
}

function toIdent(value, fallback = 'value') {
  const s = String(value || '').trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return s || fallback;
}

function toPascalString(value) {
  return String(value || '').replaceAll('"', '\\"');
}

function normalizeQueueName(value, fallback = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');
  return normalized || fallback;
}

function parseExpectedTransactionCount(source) {
  const n = Number(source);
  if (!Number.isFinite(n)) return null;
  const whole = Math.trunc(n);
  if (whole <= 0) return null;
  return Math.min(100000, whole);
}

function requestedMaplExportPath(promptText, mapId) {
  const match = String(promptText || '').match(/\b(?:into|to|at)\s+["']?([A-Za-z]:[\\/][^"'\r\n,;]+?)["']?\s*$/i);
  if (!match) return null;

  const requested = path.resolve(match[1].trim());
  const allowedRoot = path.resolve(process.env.PULSE_MAP_EXPORT_ROOT || 'C:\\maps');
  const relative = path.relative(allowedRoot, requested);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`MAPL exports are restricted to ${allowedRoot}. Set PULSE_MAP_EXPORT_ROOT to allow another location.`);
  }

  if (path.extname(requested).toLowerCase() === '.mapl') return requested;
  const requestedName = path.basename(requested) || toIdent(mapId, 'mapping');
  return path.join(requested, `${requestedName}.mapl`);
}

function normalizeExecution(executionInput = {}) {
  const rawMode = String(executionInput.mode || 'sequential').trim().toLowerCase();
  const mode = rawMode === 'concurrent' ? 'concurrent' : 'sequential';
  const maxWorkersRaw = Number(executionInput.maxWorkers || (mode === 'concurrent' ? 8 : 1));
  const maxWorkers = Number.isFinite(maxWorkersRaw) ? Math.min(256, Math.max(1, Math.trunc(maxWorkersRaw))) : (mode === 'concurrent' ? 8 : 1);
  const clusterId = toIdent(executionInput.clusterId || 'esp32_edge_pool', 'esp32_edge_pool').toLowerCase();
  return {
    mode,
    maxWorkers,
    clusterId
  };
}

function parsePromptToIntent(promptText) {
  const prompt = String(promptText || '').trim();
  if (!prompt) {
    throw new Error('prompt is required when intent is not provided');
  }

  const lower = prompt.toLowerCase();
  const hasSplit = /single\s+transactions?/.test(lower) || /split|break/.test(lower);
  const hasMt700 = /mt\s*700|swift\s*-?\s*mt\s*700/.test(lower);
  const hasMt940 = /mt\s*940|swift\s*-?\s*mt\s*940/.test(lower);
  const hasPacs = /pacs\s*\.?\s*0*8|pacs\s*payment|pacs8/.test(lower);
  const hasCamt = /camt(?:\s*\.?\s*0*53)?|cash\s+management/.test(lower);
  const outputQueueMatch = lower.match(/queue\s+['"]?([a-z0-9._-]+)['"]?/i);
  const outputQueue = outputQueueMatch ? normalizeQueueName(outputQueueMatch[1], '') : '';
  const expectedCountMatch = lower.match(/\b(\d{1,6})\s+(?:payment\s+)?messages?\b/i);
  const expectedTransactionCount = expectedCountMatch ? parseExpectedTransactionCount(expectedCountMatch[1]) : null;

  if (hasSplit && hasPacs) {
    return {
      intentKind: 'split-message-to-transactions',
      sourceTypeId: normalizeTypeToken('pacs8'),
      targetTypeId: normalizeTypeToken('pacs'),
      mapId: 'pacs_split_single_transactions',
      description: 'Deterministic PACS split into single transaction payloads',
      outputQueue: outputQueue || 'pacs.outbound',
      expectedTransactionCount
    };
  }

  if (hasMt700 && hasPacs) {
    return {
      intentKind: 'map-message-type',
      sourceTypeId: normalizeTypeToken('mt700'),
      targetTypeId: normalizeTypeToken('pacs payment'),
      mapId: 'mt700_to_pacs_payment',
      description: 'Deterministic MT700 to PACS payment mapping'
    };
  }

  if (hasMt940 && hasCamt) {
    return {
      intentKind: 'map-message-type',
      sourceTypeId: normalizeTypeToken('mt940'),
      targetTypeId: normalizeTypeToken('camt.053'),
      mapId: 'mt940_to_camt053',
      description: 'Deterministic SWIFT MT940 to ISO 20022 CAMT.053 statement mapping'
    };
  }

  throw new Error('Unable to deterministically classify prompt. Provide explicit intent JSON.');
}

function normalizeIntent(body = {}) {
  const source = body.intent && typeof body.intent === 'object'
    ? body.intent
    : parsePromptToIntent(body.prompt);

  const intentKindRaw = String(source.intentKind || '').trim().toLowerCase();
  const intentKind = intentKindRaw === 'split-message-to-transactions'
    ? 'split-message-to-transactions'
    : (intentKindRaw === 'map-message-type' ? 'map-message-type' : '');
  if (!intentKind) {
    throw new Error('intent.intentKind must be split-message-to-transactions or map-message-type');
  }

  const sourceTypeId = normalizeTypeToken(source.sourceTypeId);
  const targetTypeId = normalizeTypeToken(source.targetTypeId);
  if (!sourceTypeId || !targetTypeId) {
    throw new Error('intent.sourceTypeId and intent.targetTypeId are required');
  }

  const mapId = toIdent(source.mapId || `${sourceTypeId}_to_${targetTypeId}`, 'deterministic_mapper').toLowerCase();
  const description = String(source.description || `${sourceTypeId} to ${targetTypeId}`).trim();
  const execution = normalizeExecution(body.execution || source.execution || {});
  const inputQueue = normalizeQueueName(source.inputQueue || `${sourceTypeId}.inbound`, `${sourceTypeId}.inbound`);
  const outputQueue = normalizeQueueName(source.outputQueue || `${targetTypeId}.outbound`, `${targetTypeId}.outbound`);
  const expectedTransactionCount = parseExpectedTransactionCount(source.expectedTransactionCount);

  return {
    schemaVersion: INTENT_SCHEMA_VERSION,
    generatorVersion: DETERMINISTIC_GENERATOR_VERSION,
    typeAliasVersion: TYPE_ALIAS_VERSION,
    templateVersion: TEMPLATE_VERSION,
    intentKind,
    sourceTypeId,
    targetTypeId,
    mapId,
    description,
    execution,
    inputQueue,
    outputQueue,
    expectedTransactionCount
  };
}

async function loadExternalMapDefinition(intent) {
  const fileName = `${String(intent.mapId || '').replaceAll('_', '-')}.map`;
  const candidates = Array.from(new Set([
    path.join(mapsRoot, fileName),
    path.join(defaultMapsRoot, fileName)
  ]));
  let lastError = null;
  const validateDefinition = (definition) => {
    if (!Array.isArray(definition.rules) || definition.rules.length === 0) {
      throw new Error('rules must be a non-empty array');
    }
    if (normalizeTypeToken(definition.sourceTypeId) !== intent.sourceTypeId
      || normalizeTypeToken(definition.targetTypeId) !== intent.targetTypeId) {
      throw new Error('sourceTypeId or targetTypeId does not match the requested intent');
    }
    return definition;
  };
  for (const candidate of candidates) {
    try {
      return validateDefinition(JSON.parse(await fs.readFile(candidate, 'utf-8')));
    } catch (error) {
      lastError = error;
    }
  }

  for (const root of Array.from(new Set([mapsRoot, defaultMapsRoot]))) {
    try {
      const names = (await fs.readdir(root)).filter(name => name.endsWith('.map')).sort();
      for (const name of names) {
        try {
          const definition = validateDefinition(JSON.parse(await fs.readFile(path.join(root, name), 'utf-8')));
          const isSplitDefinition = Boolean(definition.forEach && typeof definition.forEach === 'object');
          if (isSplitDefinition === (intent.intentKind === 'split-message-to-transactions')) {
            return definition;
          }
        } catch (error) {
          lastError = new Error(`${name}: ${error.message}`);
        }
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`External mapping definition is unavailable for ${intent.mapId}: ${lastError?.message || fileName}`);
}

function renderMapl(intent, definition) {
  const mapName = toIdent(intent.mapId, 'MAP');
  const sourceIdent = toIdent(intent.sourceTypeId, 'SOURCE').toUpperCase();
  const targetIdent = toIdent(intent.targetTypeId, 'TARGET').toUpperCase();
  const lines = [
    `map ${mapName} from ${sourceIdent} to ${targetIdent};`,
    `  // XML ingress contract: source payload is ISO XML parsed into source tree`,
    `  // XML egress contract: target tree must be serialized back to ISO XML`
  ];
  const iteration = definition.forEach && typeof definition.forEach === 'object'
    ? definition.forEach
    : null;
  const indent = iteration ? '    ' : '  ';
  if (iteration) {
    lines.push(`  for each ${iteration.sourcePath} as ${iteration.variable}`);
  }
  for (const rule of definition.rules) {
    lines.push(`${indent}${rule.targetPath} := ${rule.sourcePath};`);
  }
  for (const expression of Array.isArray(definition.validations) ? definition.validations : []) {
    lines.push(`${indent}validate ${expression};`);
  }
  if (iteration) lines.push('  end;');
  lines.push('end;');
  return lines.join('\n');
}

function renderPascalish(intent, definition) {
  const serviceId = `${intent.mapId}_service`;
  const inputQueue = String(intent.inputQueue || `${intent.sourceTypeId}.inbound`);
  const outputQueue = String(intent.outputQueue || `${intent.targetTypeId}.outbound`);
  const transformRule = `output := toxml(map(\\\"${toPascalString(intent.mapId)}\\\", fromxml(src)));`;
  const concurrentComment = intent.execution.mode === 'concurrent'
    ? `CONCURRENT-MODE workers=${intent.execution.maxWorkers}`
    : 'SEQUENTIAL-MODE workers=1';
  const xmlContractComment = 'XML-IN-OUT contract: parse from XML at ingress, emit XML at egress';
  const countComment = intent.expectedTransactionCount
    ? `EXPECTED-SPLIT-COUNT=${intent.expectedTransactionCount}`
    : null;
  const routerDescription = [intent.description, concurrentComment, xmlContractComment]
    .concat(countComment ? [countComment] : [])
    .join(' | ');

  const mapperRules = Array.isArray(definition.pascalishRules) ? definition.pascalishRules : definition.rules;
  const mapperLines = mapperRules.map((rule) => {
    const sourcePath = String(rule.sourcePath || '').replace(/^source\./, '');
    const targetPath = String(rule.targetPath || '').replace(/^target\./, '');
    const conversionRule = String(rule.pascalishConversionRule || 'output := src;');
    return `  MAP \"${toPascalString(sourcePath)}\" TO \"${toPascalString(targetPath)}\" USING \"${toPascalString(conversionRule)}\";`;
  });
  return [
    `SERVICE \"${toPascalString(serviceId)}\";`,
    ``,
    `ROUTER \"${toPascalString(intent.mapId)}_router\" INPUT \"${toPascalString(inputQueue)}\" DESCRIPTION \"${toPascalString(routerDescription)}\" ENABLED TRUE BEGIN`,
    `  OUTPUT \"${toPascalString(outputQueue)}\" WHEN \"output := 1;\" TRANSFORM \"${transformRule}\";`,
    `END;`,
    ``,
    `MAPPER \"${toPascalString(intent.mapId)}\" SOURCE \"${toPascalString(intent.sourceTypeId)}\" TARGET \"${toPascalString(intent.targetTypeId)}\" DESCRIPTION \"${toPascalString(intent.description)}\" ENABLED TRUE BEGIN`,
    ...mapperLines,
    `END;`
  ].join('\n');
}

function renderWfl(intent) {
  const cluster = toIdent(intent.execution.clusterId, 'esp32_edge_pool').toLowerCase();
  const serviceId = toIdent(`${intent.mapId}_service`, 'mapper_service');
  const queueIn = normalizeQueueName(intent.inputQueue || `${intent.sourceTypeId}.inbound`, 'source.inbound');
  const queueOut = normalizeQueueName(intent.outputQueue || `${intent.targetTypeId}.outbound`, 'target.outbound');
  const mode = intent.execution.mode === 'concurrent' ? 'parallel' : 'sequential';
  const xmlMode = `${mode}_xml`;

  return [
    `cluster ${cluster} {`,
    `  local;`,
    `  child;`,
    `  sibling;`,
    `}`,
    ``,
    `// ISO XML transport contract: queues carry XML payloads`,
    `deploy service ${serviceId} to cluster ${cluster};`,
    `deploy queue ${queueIn} to cluster ${cluster};`,
    `deploy queue ${queueOut} to cluster ${cluster};`,
    ``,
    `bind queue ${queueIn} manager qm name \"${queueIn}\" cluster ${cluster} mode ${xmlMode};`,
    `bind queue ${queueOut} manager qm name \"${queueOut}\" cluster ${cluster} mode ${xmlMode};`,
    ``,
    `evict service ${serviceId} after idle 30 seconds warm reload fallback alternate;`
  ].join('\n');
}

async function buildDeterministicArtifacts(normalizedIntent) {
  const definition = await loadExternalMapDefinition(normalizedIntent);
  const mapl = renderMapl(normalizedIntent, definition);
  const pascalish = renderPascalish(normalizedIntent, definition);
  const wfl = renderWfl(normalizedIntent);
  return {
    mapl,
    pascalish,
    wfl
  };
}

async function persistDeterministicArtifacts(normalizedIntent, artifacts, compiledMapl, manifest) {
  const scopeDir = path.join(mapperAuthoringRoot, manifest.intentHash);
  await fs.mkdir(scopeDir, { recursive: true });

  const mapId = toIdent(normalizedIntent.mapId, 'deterministic_mapper').toLowerCase();
  const paths = {
    intent: path.join(scopeDir, `${mapId}.intent.json`),
    mapl: path.join(scopeDir, `${mapId}.mapl`),
    pcode: path.join(scopeDir, `${mapId}.pcode`),
    programMap: path.join(scopeDir, `${mapId}.program.json`),
    pascalish: path.join(scopeDir, `${mapId}.pas`),
    wfl: path.join(scopeDir, `${mapId}.wfl`),
    manifest: path.join(scopeDir, `${mapId}.manifest.json`)
  };

  await fs.writeFile(paths.intent, stableStringify(normalizedIntent), 'utf-8');
  await fs.writeFile(paths.mapl, artifacts.mapl, 'utf-8');
  await fs.writeFile(paths.pcode, compiledMapl.pcodeText, 'utf-8');
  await fs.writeFile(paths.programMap, `${JSON.stringify(compiledMapl.programMap, null, 2)}\n`, 'utf-8');
  await fs.writeFile(paths.pascalish, artifacts.pascalish, 'utf-8');
  await fs.writeFile(paths.wfl, artifacts.wfl, 'utf-8');
  await fs.writeFile(paths.manifest, stableStringify(manifest), 'utf-8');

  return paths;
}

function extractJsonObject(text) {
  const source = String(text || '').trim();
  if (!source) {
    throw new Error('Ollama returned empty response');
  }
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Ollama response does not contain a JSON object');
  }
  return source.slice(start, end + 1);
}

function asIsoNow() {
  return new Date().toISOString();
}

function boolLike(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function schemaHintForType(typeId) {
  const normalized = String(typeId || '').trim().toLowerCase();
  if (normalized === 'pacs') return ['urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10'];
  if (normalized === 'pacs-lynx') return ['urn:iso:std:iso:20022:tech:xsd:pacs.009.001.10'];
  if (normalized === 'swift-mt700') return ['swift-fin:mt700'];
  return [];
}

async function readOrDefaultJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeStableJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, stableStringify(value), 'utf-8');
}

async function loadTypeCatalogById() {
  const catalog = await readOrDefaultJson(librarianDataTypesPath, []);
  const list = Array.isArray(catalog) ? catalog : [];
  const byId = new Map();
  for (const item of list) {
    const id = String(item?.id || '').trim().toLowerCase();
    if (!id) continue;
    byId.set(id, item);
  }
  return byId;
}

async function resolveLibrarianContracts(normalizedIntent) {
  const byId = await loadTypeCatalogById();
  if (byId.size === 0) {
    throw new Error(`Data Librarian type catalog is unavailable or empty: ${librarianDataTypesPath}`);
  }

  const source = byId.get(String(normalizedIntent.sourceTypeId || '').toLowerCase());
  const target = byId.get(String(normalizedIntent.targetTypeId || '').toLowerCase());
  const missing = [];
  if (!source) missing.push(`input format "${normalizedIntent.sourceTypeId}"`);
  if (!target) missing.push(`output format "${normalizedIntent.targetTypeId}"`);
  if (missing.length > 0) {
    throw new Error(`MAPL authoring requires Data Librarian message formats; not found: ${missing.join(', ')}`);
  }

  return {
    source: {
      id: String(source.id),
      label: String(source.label || source.id),
      kind: String(source.kind || 'message'),
      isIso: source.isIso === true
    },
    target: {
      id: String(target.id),
      label: String(target.label || target.id),
      kind: String(target.kind || 'message'),
      isIso: target.isIso === true
    }
  };
}

async function upsertMapperInventory({ normalizedIntent, manifest, stored, deployed }) {
  const now = asIsoNow();
  const current = await readOrDefaultJson(mapperInventoryPath, {
    version: 1,
    updatedAt: now,
    mappers: [],
    messageTypes: [],
    schemas: []
  });

  const byId = await loadTypeCatalogById();
  const sourceType = byId.get(String(normalizedIntent.sourceTypeId || '').toLowerCase()) || null;
  const targetType = byId.get(String(normalizedIntent.targetTypeId || '').toLowerCase()) || null;

  const mappers = Array.isArray(current.mappers) ? current.mappers : [];
  const mapperKey = String(normalizedIntent.mapId || '').trim().toLowerCase();
  const mapperIndex = mappers.findIndex((item) => String(item?.mapId || '').trim().toLowerCase() === mapperKey);
  const mapperEntry = {
    mapId: normalizedIntent.mapId,
    intentKind: normalizedIntent.intentKind,
    sourceTypeId: normalizedIntent.sourceTypeId,
    targetTypeId: normalizedIntent.targetTypeId,
    execution: normalizedIntent.execution,
    generatorVersion: DETERMINISTIC_GENERATOR_VERSION,
    intentHash: manifest.intentHash,
    manifestHash: manifest.manifestHash,
    artifactHashes: manifest.artifactHashes,
    artifactPaths: stored || null,
    deployed: deployed ? true : false,
    updatedAt: now,
    createdAt: mapperIndex >= 0 ? (mappers[mapperIndex].createdAt || now) : now
  };
  if (mapperIndex >= 0) {
    mappers[mapperIndex] = mapperEntry;
  } else {
    mappers.push(mapperEntry);
  }

  const messageTypes = Array.isArray(current.messageTypes) ? current.messageTypes : [];
  const typeUpsert = (typeId, typeMeta) => {
    const key = String(typeId || '').trim().toLowerCase();
    if (!key) return;
    const idx = messageTypes.findIndex((item) => String(item?.id || '').trim().toLowerCase() === key);
    const next = {
      id: key,
      label: String(typeMeta?.label || key),
      isIso: typeMeta?.isIso === true,
      kind: String(typeMeta?.kind || 'message'),
      categoryId: typeMeta?.categoryId ? String(typeMeta.categoryId) : null,
      parentTypeId: typeMeta?.parentTypeId ? String(typeMeta.parentTypeId) : null,
      updatedAt: now
    };
    if (idx >= 0) {
      messageTypes[idx] = { ...messageTypes[idx], ...next };
    } else {
      messageTypes.push(next);
    }
  };
  typeUpsert(normalizedIntent.sourceTypeId, sourceType);
  typeUpsert(normalizedIntent.targetTypeId, targetType);

  const schemas = Array.isArray(current.schemas) ? current.schemas : [];
  const schemaUpsert = (typeId, refs) => {
    const key = String(typeId || '').trim().toLowerCase();
    if (!key) return;
    const idx = schemas.findIndex((item) => String(item?.typeId || '').trim().toLowerCase() === key);
    const allRefs = Array.from(new Set([...(Array.isArray(refs) ? refs : []), ...schemaHintForType(key)])).filter(Boolean);
    const next = {
      typeId: key,
      schemaRefs: allRefs,
      transport: allRefs.length > 0 && key.includes('pacs') ? 'xml' : 'unknown',
      updatedAt: now
    };
    if (idx >= 0) {
      const prevRefs = Array.isArray(schemas[idx].schemaRefs) ? schemas[idx].schemaRefs : [];
      schemas[idx] = {
        ...schemas[idx],
        ...next,
        schemaRefs: Array.from(new Set([...prevRefs, ...next.schemaRefs]))
      };
    } else {
      schemas.push(next);
    }
  };
  schemaUpsert(normalizedIntent.sourceTypeId, normalizedIntent.sourceSchemaRefs);
  schemaUpsert(normalizedIntent.targetTypeId, normalizedIntent.targetSchemaRefs);

  const nextInventory = {
    version: 1,
    updatedAt: now,
    mappers,
    messageTypes,
    schemas
  };
  await writeStableJson(mapperInventoryPath, nextInventory);
  return nextInventory;
}

async function upsertDeploymentRecord({ normalizedIntent, manifest, stored, requestedBy }) {
  const now = asIsoNow();
  const current = await readOrDefaultJson(mapperDeploymentsPath, {
    version: 1,
    updatedAt: now,
    deployments: []
  });
  const deployments = Array.isArray(current.deployments) ? current.deployments : [];
  const deployId = `${normalizedIntent.mapId}:${manifest.intentHash}`;
  const idx = deployments.findIndex((item) => String(item?.deployId || '') === deployId);
  const record = {
    deployId,
    mapId: normalizedIntent.mapId,
    intentHash: manifest.intentHash,
    manifestHash: manifest.manifestHash,
    artifactPaths: stored || null,
    requestedBy: String(requestedBy || 'ollama-intent').trim(),
    deploymentMode: 'artifact-publish-only',
    runtimePolicy: {
      executionEngine: 'pulse-code',
      modelExecutionAllowed: false,
      modelMayRequestDeployment: true
    },
    updatedAt: now,
    createdAt: idx >= 0 ? (deployments[idx].createdAt || now) : now
  };
  if (idx >= 0) {
    deployments[idx] = record;
  } else {
    deployments.push(record);
  }

  const next = {
    version: 1,
    updatedAt: now,
    deployments
  };
  await writeStableJson(mapperDeploymentsPath, next);
  return record;
}

async function generateDeterministicBundle(body = {}, reportProgress = () => {}) {
  const normalizedIntent = normalizeIntent(body);
  reportProgress('Consulting Data Librarian');
  const librarianContracts = await resolveLibrarianContracts(normalizedIntent);
  reportProgress('Looking at existing maps');
  const artifacts = await buildDeterministicArtifacts(normalizedIntent);
  reportProgress('Compiling MAPL');
  const compiled = compileMaplWithAntlr(artifacts.mapl);
  const compiledMapl = {
    pcodeText: compiled.pcodeText,
    programMap: attachPcodeSignature(compiled.programMap, compiled.pcodeText)
  };
  const normalizedIntentJson = stableStringify(normalizedIntent);
  const maplHash = sha256Hex(artifacts.mapl);
  const pascalishHash = sha256Hex(artifacts.pascalish);
  const wflHash = sha256Hex(artifacts.wfl);
  const intentHash = sha256Hex(normalizedIntentJson);
  const manifestPayload = {
    createdAt: asIsoNow(),
    generatorVersion: DETERMINISTIC_GENERATOR_VERSION,
    typeAliasVersion: TYPE_ALIAS_VERSION,
    templateVersion: TEMPLATE_VERSION,
    intentSchemaVersion: INTENT_SCHEMA_VERSION,
    intentHash,
    normalizedIntent,
    librarianContracts,
    artifactHashes: {
      maplHash,
      pascalishHash,
      wflHash
    },
    determinismContract: {
      invariant: 'Same normalized intent and versions produce byte-identical artifacts',
      concurrencyMode: normalizedIntent.execution.mode,
      maxWorkers: normalizedIntent.execution.maxWorkers,
      clusterId: normalizedIntent.execution.clusterId
    }
  };
  const manifestJson = stableStringify(manifestPayload);
  const manifestHash = sha256Hex(manifestJson);
  const manifest = {
    ...manifestPayload,
    manifestHash
  };

  const persist = body?.persist !== false;
  if (persist) reportProgress('Saving generated artifacts');
  const stored = persist
    ? await persistDeterministicArtifacts(normalizedIntent, artifacts, compiledMapl, manifest)
    : null;

  return {
    normalizedIntent,
    librarianContracts,
    artifacts,
    compiledMapl,
    manifest,
    stored
  };
}

async function classifyIntentWithOllama(promptText, executionInput = {}, deployArtifactInput = false) {
  const prompt = String(promptText || '').trim();
  if (!prompt) {
    throw new Error('prompt is required');
  }

  const mode = String(executionInput?.mode || 'sequential').trim().toLowerCase() === 'concurrent' ? 'concurrent' : 'sequential';
  const maxWorkers = Number(executionInput?.maxWorkers || (mode === 'concurrent' ? 8 : 1));
  const clusterId = String(executionInput?.clusterId || 'esp32_edge_pool').trim() || 'esp32_edge_pool';

  const llmPrompt = [
    'You are a mapper-intent classifier for PULSE.',
    'Return ONLY one JSON object. No markdown. No extra text.',
    'Allowed intentKind values: split-message-to-transactions, map-message-type.',
    'Use sourceTypeId and targetTypeId canonical ids when possible (e.g. pacs, swift-mt700).',
    'Set deployArtifact to true only when user explicitly asks to deploy or publish.',
    'JSON schema:',
    '{',
    '  "intentKind": "split-message-to-transactions|map-message-type",',
    '  "sourceTypeId": "string",',
    '  "targetTypeId": "string",',
    '  "mapId": "string",',
    '  "description": "string",',
    '  "inputQueue": "string",',
    '  "outputQueue": "string",',
    '  "expectedTransactionCount": 25,',
    '  "deployArtifact": true,',
    '  "execution": { "mode": "sequential|concurrent", "maxWorkers": 1, "clusterId": "esp32_edge_pool" }',
    '}',
    `Execution defaults: mode=${mode}, maxWorkers=${Number.isFinite(maxWorkers) ? Math.max(1, Math.trunc(maxWorkers)) : 1}, clusterId=${clusterId}.`,
    `Deploy default requested by caller: ${deployArtifactInput ? 'true' : 'false'}.`,
    `User request: "${prompt.replaceAll('"', '\\"')}"`
  ].join('\n');

  let promptHints = null;
  try {
    promptHints = parsePromptToIntent(prompt);
  } catch {
    promptHints = null;
  }

  let raw = '';
  let parsed = {};
  try {
    raw = await ollamaGenerate(llmPrompt);
    parsed = JSON.parse(extractJsonObject(raw));
  } catch (error) {
    if (!promptHints) throw error;
    raw = raw || `Deterministic fallback: ${error.message}`;
  }
  const deployArtifact = boolLike(parsed?.deployArtifact, boolLike(deployArtifactInput, false));
  const lowerPrompt = prompt.toLowerCase();
  const splitHint = /single\s+transactions?|decompose|split|break/.test(lowerPrompt) && /pacs\s*\.?\s*0*8|pacs8|pacs008/.test(lowerPrompt);

  const intent = {
    intentKind: parsed?.intentKind,
    sourceTypeId: parsed?.sourceTypeId,
    targetTypeId: parsed?.targetTypeId,
    mapId: parsed?.mapId,
    description: parsed?.description,
    inputQueue: parsed?.inputQueue,
    outputQueue: parsed?.outputQueue,
    expectedTransactionCount: parsed?.expectedTransactionCount,
    execution: parsed?.execution
  };

  if (splitHint) {
    intent.intentKind = 'split-message-to-transactions';
  }

  const maybeFill = (field) => {
    const current = intent[field];
    const missing = current == null || (typeof current === 'string' && current.trim() === '');
    if (missing && promptHints && promptHints[field] != null) {
      intent[field] = promptHints[field];
    }
  };

  maybeFill('intentKind');
  maybeFill('sourceTypeId');
  maybeFill('targetTypeId');
  maybeFill('mapId');
  maybeFill('description');
  maybeFill('inputQueue');
  maybeFill('outputQueue');
  maybeFill('expectedTransactionCount');

  if (splitHint) {
    intent.sourceTypeId = intent.sourceTypeId || 'pacs';
    intent.targetTypeId = intent.targetTypeId || 'pacs';
  }

  return {
    intent,
    deployArtifact,
    ollamaRaw: raw
  };
}

async function assignDeploymentToNode({ req, nodeId, normalizedIntent, manifest, stored, runtimePolicy, requestedBy }) {
  const targetNodeId = String(nodeId || '').trim();
  if (!targetNodeId) {
    throw new Error('nodeId is required for deploy assignment');
  }

  const backendBaseUrl = String(
    process.env.PULSE_BACKEND_URL
    || process.env.BACKEND_URL
    || 'http://127.0.0.1:4000'
  ).trim().replace(/\/$/, '');
  const baseUrl = backendBaseUrl || 'http://127.0.0.1:4000';
  const serviceName = `${toIdent(normalizedIntent.mapId, 'mapper')}_service`;
  const packageName = `mapper-authoring/${toIdent(normalizedIntent.mapId, 'mapper').toLowerCase()}`;
  const packageVersion = String(manifest?.manifestHash || 'latest').slice(0, 16) || 'latest';

  const deploymentBody = {
    serviceName,
    packageName,
    packageVersion,
    metadata: {
      intentHash: manifest?.intentHash || null,
      manifestHash: manifest?.manifestHash || null,
      artifactPaths: stored || null,
      inputQueue: `${normalizedIntent.sourceTypeId}.inbound`,
      outputQueue: `${normalizedIntent.targetTypeId}.outbound`,
      mapperAuthoring: true,
      runtimePolicy,
      requestedBy: String(requestedBy || 'ollama-deploy').trim()
    }
  };

  const response = await fetch(`${baseUrl}/api/nodes/${encodeURIComponent(targetNodeId)}/deploy`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(deploymentBody)
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const details = payload && typeof payload === 'object' ? (payload.error || JSON.stringify(payload)) : String(text || 'deploy failed');
    throw new Error(`node deploy failed (${response.status}): ${details}`);
  }

  return {
    nodeId: targetNodeId,
    serviceName,
    packageName,
    packageVersion,
    result: payload
  };
}

function normalizePath(value) {
  return String(value || '').trim().replaceAll('\\', '/').replace(/^\/+/, '');
}

function isInsideRoot(candidatePath, rootPath) {
  return path.resolve(candidatePath).startsWith(path.resolve(rootPath));
}

function safeSchemaPath(rawPath) {
  const normalized = normalizePath(rawPath);
  if (!normalized || normalized.includes('..')) {
    throw new Error('Invalid schema path');
  }
  const resolved = path.resolve(runtimeRoot, normalized);
  if (!isInsideRoot(resolved, runtimeRoot)) {
    throw new Error('Invalid schema path');
  }
  return resolved;
}

async function readJsonFile(filePath, fallback = null) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

function flattenStructure(node, prefix = '') {
  if (!node || typeof node !== 'object') return [];
  const children = Array.isArray(node.children) ? node.children : [];
  const out = [];
  for (const child of children) {
    const name = String(child?.name || '').trim();
    if (!name) continue;
    const nextPath = prefix ? `${prefix}.${name}` : name;
    out.push({
      path: nextPath,
      kind: String(child?.kind || 'leaf').toLowerCase() === 'branch' ? 'branch' : 'leaf',
      valueType: String(child?.valueType || 'unknown').toLowerCase(),
      required: child?.required === true,
    });
    out.push(...flattenStructure(child, nextPath));
  }
  return out;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const out = {};
  for (const key of keys) {
    out[key] = sortObject(value[key]);
  }
  return out;
}

function structureSignature(structure) {
  const flat = flattenStructure(structure);
  const normalized = flat
    .map((node) => ({
      path: node.path,
      kind: node.kind,
      valueType: node.valueType,
      required: node.required,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return JSON.stringify(sortObject(normalized));
}

function nodeMapByPath(structure) {
  const map = new Map();
  for (const item of flattenStructure(structure)) {
    map.set(String(item.path || ''), item);
  }
  return map;
}

function getByPath(source, dottedPath) {
  const parts = String(dottedPath || '').split('.').map(part => part.trim()).filter(Boolean);
  let cursor = source;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object' || !(part in cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function setByPath(target, dottedPath, value) {
  const parts = String(dottedPath || '').split('.').map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return;
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function getRelativePath(fullPath, parentPath) {
  const full = String(fullPath || '');
  const parent = String(parentPath || '');
  if (!parent) return full;
  const prefix = `${parent}.`;
  return full.startsWith(prefix) ? full.slice(prefix.length) : full;
}

function isShapeEquivalentNode(sourceNode, targetNode, sourceChildrenByParent, targetChildrenByParent) {
  if (!sourceNode || !targetNode) return false;
  const sourceChildren = sourceChildrenByParent.get(String(sourceNode.path || '')) || [];
  const targetChildren = targetChildrenByParent.get(String(targetNode.path || '')) || [];
  if (sourceChildren.length !== targetChildren.length) return false;

  const sourceLeaf = sourceChildren.length === 0;
  const targetLeaf = targetChildren.length === 0;
  if (sourceLeaf !== targetLeaf) return false;
  if (sourceLeaf && targetLeaf) {
    const sourceType = String(sourceNode.valueType || 'unknown').toLowerCase();
    const targetType = String(targetNode.valueType || 'unknown').toLowerCase();
    return sourceType === targetType || sourceType === 'unknown' || targetType === 'unknown';
  }

  const sourceByName = new Map(sourceChildren.map((child) => [String(child.path || '').split('.').pop(), child]));
  const targetByName = new Map(targetChildren.map((child) => [String(child.path || '').split('.').pop(), child]));
  if (sourceByName.size !== targetByName.size) return false;

  for (const [name, sourceChild] of sourceByName.entries()) {
    const targetChild = targetByName.get(name);
    if (!targetChild) return false;
    if (!isShapeEquivalentNode(sourceChild, targetChild, sourceChildrenByParent, targetChildrenByParent)) {
      return false;
    }
  }

  return true;
}

function buildChildrenByParent(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const pathValue = String(node.path || '');
    const idx = pathValue.lastIndexOf('.');
    const parent = idx >= 0 ? pathValue.slice(0, idx) : '';
    const list = map.get(parent) || [];
    list.push(node);
    map.set(parent, list);
  }
  return map;
}

function expandShapeMappings(sourceNode, targetNode, sourceChildrenByParent, targetChildrenByParent) {
  const sourceChildren = sourceChildrenByParent.get(String(sourceNode.path || '')) || [];
  const targetChildren = targetChildrenByParent.get(String(targetNode.path || '')) || [];
  if (sourceChildren.length === 0 && targetChildren.length === 0) {
    return [{ sourcePath: sourceNode.path, targetPath: targetNode.path, kind: 'leaf' }];
  }

  const out = [];
  const sourceByName = new Map(sourceChildren.map((child) => [String(child.path || '').split('.').pop(), child]));
  const targetByName = new Map(targetChildren.map((child) => [String(child.path || '').split('.').pop(), child]));

  for (const [name, sourceChild] of sourceByName.entries()) {
    const targetChild = targetByName.get(name);
    if (!targetChild) continue;
    out.push(...expandShapeMappings(sourceChild, targetChild, sourceChildrenByParent, targetChildrenByParent));
  }

  return out;
}

function buildSyntheticPayloadFromNodes(nodes) {
  const payload = {};
  for (const node of nodes) {
    if (String(node.kind || '').toLowerCase() === 'branch') continue;
    const leafName = String(node.path || '').split('.').pop() || 'value';
    const sample = node.valueType && String(node.valueType).toLowerCase().includes('number')
      ? 0
      : `${leafName}-sample`;
    setByPath(payload, node.path, sample);
  }
  return payload;
}

async function currentSchemaMtime(schemaPath) {
  const absolute = safeSchemaPath(schemaPath);
  const stat = await fs.stat(absolute);
  return stat.mtime.toISOString();
}

function normalizeRuleForRuntime(rule) {
  const sourcePath = String(rule?.sourcePath || rule?.from || '').trim();
  const targetPath = String(rule?.targetPath || rule?.to || '').trim();
  return {
    sourcePath,
    targetPath,
    kind: String(rule?.kind || 'leaf').toLowerCase() === 'branch' ? 'branch' : 'leaf',
    sourceValueType: String(rule?.sourceValueType || 'unknown').toLowerCase(),
    targetValueType: String(rule?.targetValueType || 'unknown').toLowerCase(),
    conversionRule: String(rule?.conversionRule || rule?.conversion || '').trim(),
  };
}

function resolveMapFile(fileName) {
  const normalized = String(fileName || '').trim().replace(/[\\/]+/g, '_');
  if (!normalized || normalized.includes('..') || !normalized.endsWith('.map')) {
    throw new Error('Invalid map file name');
  }
  const resolved = path.resolve(mapsRoot, normalized);
  if (!resolved.startsWith(path.resolve(mapsRoot))) {
    throw new Error('Invalid map file path');
  }
  return resolved;
}

async function ensureMapsDirectory() {
  await fs.mkdir(mapsRoot, { recursive: true });
}

async function seedLegacyMapIfMissing(fileName) {
  const targetPath = path.join(mapsRoot, fileName);
  const exists = await fs.stat(targetPath).then(() => true).catch(() => false);
  if (exists) return;

  const sourcePath = path.join(repoRoot, fileName);
  const sourceExists = await fs.stat(sourcePath).then(() => true).catch(() => false);
  if (!sourceExists) return;

  await fs.copyFile(sourcePath, targetPath);
}

async function seedLegacyMaps() {
  await ensureMapsDirectory();
  await Promise.all([
    seedLegacyMapIfMissing('mt103-to-pacs.map'),
    seedLegacyMapIfMissing('mt202-to-pacs.map')
  ]);
}

function createDefaultMap(id, name) {
  return {
    id,
    name,
    description: '',
    version: '1.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rules: [],
    submaps: []
  };
}

export function registerMapperRoutes(app) {
  app.post('/api/mapper/authoring/ollama-intent-stream', async (req, res) => {
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const emit = (payload) => res.write(`${JSON.stringify(payload)}\n`);

    try {
      const prompt = String(req.body?.prompt || '').trim();
      if (!prompt) throw new Error('prompt is required');

      emit({ type: 'progress', message: 'Understanding mapping request' });
      const classified = await classifyIntentWithOllama(
        prompt,
        req.body?.execution || {},
        false
      );
      const generated = await generateDeterministicBundle({
        intent: classified.intent,
        execution: req.body?.execution || classified.intent?.execution || {},
        persist: true
      }, (message) => emit({ type: 'progress', message }));

      let exportedMaplPath = null;
      const requestedPath = requestedMaplExportPath(prompt, generated.normalizedIntent.mapId);
      if (requestedPath) {
        emit({ type: 'progress', message: `Writing ${requestedPath}` });
        await fs.mkdir(path.dirname(requestedPath), { recursive: true });
        await fs.writeFile(requestedPath, generated.artifacts.mapl, 'utf-8');
        exportedMaplPath = requestedPath;
      }

      lastGeneratedMap = {
        generated,
        exportedMaplPath,
        createdAt: new Date().toISOString()
      };

      emit({
        type: 'result',
        output: generated.artifacts.mapl,
        savedPath: exportedMaplPath || generated.stored?.mapl || null,
        mapId: generated.normalizedIntent.mapId
      });
    } catch (error) {
      emit({ type: 'error', message: error.message || String(error) });
    } finally {
      res.end();
    }
  });

  app.post('/api/mapper/authoring/test-last-stream', async (req, res) => {
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const emit = (payload) => res.write(`${JSON.stringify(payload)}\n`);

    try {
      emit({ type: 'progress', message: 'Locating the last generated map' });
      if (!lastGeneratedMap?.generated) {
        throw new Error('No generated map is available in this backend session. Create a map first, then ask BOB to test it.');
      }

      const { generated, exportedMaplPath } = lastGeneratedMap;
      emit({ type: 'progress', message: 'Preparing representative test data' });
      const definition = await loadExternalMapDefinition(generated.normalizedIntent);
      const testCase = Array.isArray(definition.testCases) ? definition.testCases[0] : null;
      if (!testCase?.input) {
        throw new Error(`Map ${generated.normalizedIntent.mapId} has no external test case in its JSON definition.`);
      }

      emit({ type: 'progress', message: 'Running the map on the JS p-machine' });
      const runtimeResult = await runSingleMessageForEvolution({
        pcode: generated.stored?.pcode,
        programMap: generated.stored?.programMap,
        inputQueue: generated.normalizedIntent.inputQueue,
        message: String(testCase.input),
        messageFile: null,
        backendUrl: 'http://127.0.0.1:4000',
        actorUserId: 'system-admin',
        serviceId: `mapl-${generated.normalizedIntent.mapId}`,
        organismId: '',
        generation: '0',
        fitnessOut: ''
      });
      if (runtimeResult.error || runtimeResult.response == null) {
        throw new Error(runtimeResult.error || 'The p-machine returned no mapped output.');
      }

      emit({ type: 'progress', message: 'Formatting input and output' });
      const output = generated.librarianContracts?.target?.isIso
        ? serializeXml(runtimeResult.response)
        : runtimeResult.response;
      emit({
        type: 'result',
        mapId: generated.normalizedIntent.mapId,
        maplPath: exportedMaplPath || generated.stored?.mapl || null,
        testCaseId: testCase.id || null,
        testCaseDescription: testCase.description || '',
        input: String(testCase.input),
        output,
        outputFormat: generated.librarianContracts?.target?.isIso ? 'xml' : 'json',
        outputMediaType: generated.librarianContracts?.target?.isIso ? 'application/xml' : 'application/json'
      });
    } catch (error) {
      emit({ type: 'error', message: error.message || String(error) });
    } finally {
      res.end();
    }
  });

  app.post('/api/mapper/authoring/deterministic-generate', async (req, res) => {
    try {
      const generated = await generateDeterministicBundle(req.body || {});
      const deployArtifact = boolLike(req.body?.deployArtifact, false);
      const deployment = deployArtifact
        ? await upsertDeploymentRecord({
          normalizedIntent: generated.normalizedIntent,
          manifest: generated.manifest,
          stored: generated.stored,
          requestedBy: 'deterministic-endpoint'
        })
        : null;
      const inventory = await upsertMapperInventory({
        normalizedIntent: generated.normalizedIntent,
        manifest: generated.manifest,
        stored: generated.stored,
        deployed: Boolean(deployment)
      });

      res.status(201).json({
        ok: true,
        normalizedIntent: generated.normalizedIntent,
        librarianContracts: generated.librarianContracts,
        artifacts: generated.artifacts,
        compiledMapl: generated.compiledMapl,
        manifest: generated.manifest,
        stored: generated.stored,
        deployment,
        inventorySummary: {
          mapperCount: Array.isArray(inventory?.mappers) ? inventory.mappers.length : 0,
          messageTypeCount: Array.isArray(inventory?.messageTypes) ? inventory.messageTypes.length : 0,
          schemaCount: Array.isArray(inventory?.schemas) ? inventory.schemas.length : 0
        }
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/mapper/authoring/ollama-intent', async (req, res) => {
    try {
      const prompt = String(req.body?.prompt || '').trim();
      if (!prompt) {
        return res.status(400).json({ error: 'prompt is required' });
      }

      const classified = await classifyIntentWithOllama(
        prompt,
        req.body?.execution || {},
        req.body?.deployArtifact
      );

      const generated = await generateDeterministicBundle({
        intent: classified.intent,
        execution: req.body?.execution || classified.intent?.execution || {},
        persist: req.body?.persist
      });

      const deployment = classified.deployArtifact
        ? await upsertDeploymentRecord({
          normalizedIntent: generated.normalizedIntent,
          manifest: generated.manifest,
          stored: generated.stored,
          requestedBy: 'ollama-intent'
        })
        : null;
      const inventory = await upsertMapperInventory({
        normalizedIntent: generated.normalizedIntent,
        manifest: generated.manifest,
        stored: generated.stored,
        deployed: Boolean(deployment)
      });

      res.status(201).json({
        ok: true,
        normalizedIntent: generated.normalizedIntent,
        librarianContracts: generated.librarianContracts,
        artifacts: generated.artifacts,
        compiledMapl: generated.compiledMapl,
        manifest: generated.manifest,
        stored: generated.stored,
        deployment,
        inventorySummary: {
          mapperCount: Array.isArray(inventory?.mappers) ? inventory.mappers.length : 0,
          messageTypeCount: Array.isArray(inventory?.messageTypes) ? inventory.messageTypes.length : 0,
          schemaCount: Array.isArray(inventory?.schemas) ? inventory.schemas.length : 0
        },
        ollama: {
          deployArtifact: classified.deployArtifact,
          rawResponse: classified.ollamaRaw
        },
        runtimePolicy: {
          executionEngine: 'pulse-code',
          modelExecutionAllowed: false,
          modelMayRequestDeployment: true
        }
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/mapper/authoring/ollama-deploy', async (req, res) => {
    try {
      const prompt = String(req.body?.prompt || '').trim();
      const nodeId = String(req.body?.nodeId || '').trim();
      if (!prompt) {
        return res.status(400).json({ error: 'prompt is required' });
      }
      if (!nodeId) {
        return res.status(400).json({ error: 'nodeId is required' });
      }

      const runtimePolicy = {
        executionEngine: 'pulse-code',
        modelExecutionAllowed: false,
        modelMayRequestDeployment: true
      };

      const classified = await classifyIntentWithOllama(
        prompt,
        req.body?.execution || {},
        true
      );

      const generated = await generateDeterministicBundle({
        intent: classified.intent,
        execution: req.body?.execution || classified.intent?.execution || {},
        persist: req.body?.persist
      });

      const deploymentBookRecord = await upsertDeploymentRecord({
        normalizedIntent: generated.normalizedIntent,
        manifest: generated.manifest,
        stored: generated.stored,
        requestedBy: 'ollama-deploy'
      });

      const inventory = await upsertMapperInventory({
        normalizedIntent: generated.normalizedIntent,
        manifest: generated.manifest,
        stored: generated.stored,
        deployed: true
      });

      const nodeDeployment = await assignDeploymentToNode({
        req,
        nodeId,
        normalizedIntent: generated.normalizedIntent,
        manifest: generated.manifest,
        stored: generated.stored,
        runtimePolicy,
        requestedBy: 'ollama-deploy'
      });

      return res.status(201).json({
        ok: true,
        normalizedIntent: generated.normalizedIntent,
        librarianContracts: generated.librarianContracts,
        artifacts: generated.artifacts,
        compiledMapl: generated.compiledMapl,
        manifest: generated.manifest,
        stored: generated.stored,
        deploymentBookRecord,
        nodeDeployment,
        inventorySummary: {
          mapperCount: Array.isArray(inventory?.mappers) ? inventory.mappers.length : 0,
          messageTypeCount: Array.isArray(inventory?.messageTypes) ? inventory.messageTypes.length : 0,
          schemaCount: Array.isArray(inventory?.schemas) ? inventory.schemas.length : 0
        },
        ollama: {
          deployArtifact: true,
          rawResponse: classified.ollamaRaw
        },
        runtimePolicy
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/mapper/authoring/inventory', async (req, res) => {
    try {
      const inventory = await readOrDefaultJson(mapperInventoryPath, {
        version: 1,
        updatedAt: null,
        mappers: [],
        messageTypes: [],
        schemas: []
      });
      res.json({ inventory });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/mapper/authoring/deployments', async (req, res) => {
    try {
      const deploymentBook = await readOrDefaultJson(mapperDeploymentsPath, {
        version: 1,
        updatedAt: null,
        deployments: []
      });
      res.json({ deploymentBook });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // List all maps
  app.get('/api/mapper/maps', async (req, res) => {
    try {
      await seedLegacyMaps();
      const entries = await fs.readdir(mapsRoot).catch(() => []);
      const maps = [];
      for (const entry of entries) {
        if (!entry.endsWith('.map')) continue;
        try {
          const filePath = path.join(mapsRoot, entry);
          const content = await fs.readFile(filePath, 'utf-8');
          const map = JSON.parse(content);
          maps.push({
            id: map.id,
            name: map.name,
            description: map.description,
            version: map.version,
            createdAt: map.createdAt,
            updatedAt: map.updatedAt,
            ruleCount: Array.isArray(map.rules) ? map.rules.length : 0,
            submapCount: Array.isArray(map.submaps) ? map.submaps.length : 0,
            fileName: entry
          });
        } catch {
          // Skip malformed files
        }
      }
      res.json({ maps: maps.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get specific map
  app.get('/api/mapper/maps/:id', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);
      res.json({ map });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/mapper/test-cases', async (req, res) => {
    try {
      const store = await readJsonFile(issueTestStorePath, {});
      const testCases = Array.isArray(store?.testCases) ? store.testCases : [];
      res.json({
        testCases: testCases.map((testCase) => ({
          id: String(testCase?.id || ''),
          name: String(testCase?.name || ''),
          testType: String(testCase?.testType || 'generic').toLowerCase(),
          description: String(testCase?.description || '')
        })).filter((testCase) => testCase.id)
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create new map
  app.post('/api/mapper/maps', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id, name, description } = req.body;
      if (!id || !name) {
        return res.status(400).json({ error: 'id and name are required' });
      }
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const stat = await fs.stat(filePath).catch(() => null);
      if (stat) {
        return res.status(409).json({ error: 'Map already exists' });
      }
      const newMap = createDefaultMap(id, name);
      if (description) {
        newMap.description = description;
      }
      if (req.body?.sourceTypeId) newMap.sourceTypeId = String(req.body.sourceTypeId).toLowerCase();
      if (req.body?.targetTypeId) newMap.targetTypeId = String(req.body.targetTypeId).toLowerCase();
      if (req.body?.sourceSchemaPath) newMap.sourceSchemaPath = String(req.body.sourceSchemaPath);
      if (req.body?.targetSchemaPath) newMap.targetSchemaPath = String(req.body.targetSchemaPath);
      if (req.body?.sourceSchemaMtime) newMap.sourceSchemaMtime = String(req.body.sourceSchemaMtime);
      if (req.body?.targetSchemaMtime) newMap.targetSchemaMtime = String(req.body.targetSchemaMtime);
      if (req.body?.sourceStructure && typeof req.body.sourceStructure === 'object') {
        newMap.sourceStructure = req.body.sourceStructure;
        newMap.sourceShapeSignature = structureSignature(req.body.sourceStructure);
      }
      if (req.body?.targetStructure && typeof req.body.targetStructure === 'object') {
        newMap.targetStructure = req.body.targetStructure;
        newMap.targetShapeSignature = structureSignature(req.body.targetStructure);
      }
      if (Array.isArray(req.body?.rules)) {
        newMap.rules = req.body.rules;
      }
      await fs.writeFile(filePath, JSON.stringify(newMap, null, 2), 'utf-8');
      res.status(201).json({ map: newMap });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update map
  app.put('/api/mapper/maps/:id', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const { name, description, rules, submaps } = req.body;
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);
      if (name) map.name = name;
      if (description !== undefined) map.description = description;
      if (Array.isArray(rules)) map.rules = rules;
      if (Array.isArray(submaps)) map.submaps = submaps;
      if (req.body?.sourceTypeId) map.sourceTypeId = String(req.body.sourceTypeId).toLowerCase();
      if (req.body?.targetTypeId) map.targetTypeId = String(req.body.targetTypeId).toLowerCase();
      if (req.body?.sourceSchemaPath) map.sourceSchemaPath = String(req.body.sourceSchemaPath);
      if (req.body?.targetSchemaPath) map.targetSchemaPath = String(req.body.targetSchemaPath);
      if (req.body?.sourceSchemaMtime) map.sourceSchemaMtime = String(req.body.sourceSchemaMtime);
      if (req.body?.targetSchemaMtime) map.targetSchemaMtime = String(req.body.targetSchemaMtime);
      if (req.body?.sourceStructure && typeof req.body.sourceStructure === 'object') {
        map.sourceStructure = req.body.sourceStructure;
        map.sourceShapeSignature = structureSignature(req.body.sourceStructure);
      }
      if (req.body?.targetStructure && typeof req.body.targetStructure === 'object') {
        map.targetStructure = req.body.targetStructure;
        map.targetShapeSignature = structureSignature(req.body.targetStructure);
      }
      map.updatedAt = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(map, null, 2), 'utf-8');
      res.json({ map });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Delete map
  app.delete('/api/mapper/maps/:id', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Rename map (creates new file, deletes old)
  app.post('/api/mapper/maps/:id/rename', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const { newId } = req.body;
      if (!newId) {
        return res.status(400).json({ error: 'newId is required' });
      }
      const oldFileName = `${id}.map`;
      const newFileName = `${newId}.map`;
      const oldFilePath = resolveMapFile(oldFileName);
      const newFilePath = resolveMapFile(newFileName);
      const content = await fs.readFile(oldFilePath, 'utf-8');
      const map = JSON.parse(content);
      map.id = newId;
      map.updatedAt = new Date().toISOString();
      await fs.writeFile(newFilePath, JSON.stringify(map, null, 2), 'utf-8');
      await fs.unlink(oldFilePath);
      res.json({ map });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Import CSV → map rules
  app.post('/api/mapper/maps/:id/import-csv', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const { csvContent } = req.body;
      if (!csvContent) {
        return res.status(400).json({ error: 'csvContent is required' });
      }

      const lines = String(csvContent).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV must have header row and at least one data row' });
      }

      const header = lines[0].split(',').map(h => h.trim().toUpperCase());
      const fromIdx = header.indexOf('FROM');
      const toIdx = header.indexOf('TO');
      const descIdx = header.indexOf('DESCRIPTION');

      if (fromIdx < 0 || toIdx < 0) {
        return res.status(400).json({ error: 'CSV must contain FROM and TO columns' });
      }

      const rules = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        const from = parts[fromIdx] || '';
        const to = parts[toIdx] || '';
        const desc = descIdx >= 0 ? parts[descIdx] || '' : '';

        if (!from || !to) continue;

        // Generate Pascalish conversion: simple assignment if no special logic
        let conversion = `output := src;`;
        if (desc && desc.toLowerCase().includes('trim')) {
          conversion = `output := trim(src);`;
        } else if (desc && desc.toLowerCase().includes('upper')) {
          conversion = `output := upcase(src);`;
        } else if (desc && desc.toLowerCase().includes('lower')) {
          conversion = `output := downcase(src);`;
        }

        rules.push({
          id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          from,
          to,
          description: desc,
          conversion
        });
      }

      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);
      map.rules.push(...rules);
      map.updatedAt = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(map, null, 2), 'utf-8');

      res.json({ rulesAdded: rules.length, map });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Export map to Excel (returns CSV for now, can enhance to .xlsx)
  app.get('/api/mapper/maps/:id/export-csv', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);

      // Build CSV
      const lines = ['FROM,TO,DESCRIPTION,CONVERSION'];
      for (const rule of map.rules) {
        const from = String(rule.from || '').replaceAll('"', '""');
        const to = String(rule.to || '').replaceAll('"', '""');
        const desc = String(rule.description || '').replaceAll('"', '""');
        const conversion = String(rule.conversion || '').replaceAll('"', '""');
        lines.push(`"${from}","${to}","${desc}","${conversion}"`);
      }

      const csv = lines.join('\n');
      res.set('content-type', 'text/csv');
      res.set('content-disposition', `attachment; filename="${id}.csv"`);
      res.send(csv);
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/mapper/maps/:id/export-excel', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const fileName = `${id}.map`;
      const filePath = resolveMapFile(fileName);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);

      const metadataRows = [
        ['Field', 'Value'],
        ['id', map.id || id],
        ['name', map.name || ''],
        ['description', map.description || ''],
        ['version', map.version || ''],
        ['createdAt', map.createdAt || ''],
        ['updatedAt', map.updatedAt || '']
      ];

      const rulesRows = [
        ['ID', 'FROM', 'TO', 'DESCRIPTION', 'CONVERSION']
      ];
      for (const rule of Array.isArray(map.rules) ? map.rules : []) {
        rulesRows.push([
          String(rule.id || ''),
          String(rule.from || ''),
          String(rule.to || ''),
          String(rule.description || ''),
          String(rule.conversion || '')
        ]);
      }

      const submapRows = [
        ['ID', 'Name', 'Description']
      ];
      for (const submap of Array.isArray(map.submaps) ? map.submaps : []) {
        submapRows.push([
          String(submap.id || ''),
          String(submap.name || ''),
          String(submap.description || '')
        ]);
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(metadataRows), 'Map');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rulesRows), 'Rules');
      if (submapRows.length > 1) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(submapRows), 'Submaps');
      }

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      res.set('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('content-disposition', `attachment; filename="${id}.xlsx"`);
      res.send(buffer);
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/mapper/maps/:id/auto-shape-map', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const { sourcePath, targetPath } = req.body || {};
      if (!sourcePath || !targetPath) {
        return res.status(400).json({ error: 'sourcePath and targetPath are required' });
      }

      const filePath = resolveMapFile(`${id}.map`);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);
      if (!map?.sourceStructure || !map?.targetStructure) {
        return res.status(409).json({ error: 'Map schema snapshot missing. Re-open map and save before using shape-aware mapping.' });
      }

      const sourceNodes = flattenStructure(map.sourceStructure);
      const targetNodes = flattenStructure(map.targetStructure);
      const sourceByPath = nodeMapByPath(map.sourceStructure);
      const targetByPath = nodeMapByPath(map.targetStructure);
      const sourceChildrenByParent = buildChildrenByParent(sourceNodes);
      const targetChildrenByParent = buildChildrenByParent(targetNodes);
      const sourceNode = sourceByPath.get(String(sourcePath));
      const targetNode = targetByPath.get(String(targetPath));

      if (!sourceNode || !targetNode) {
        return res.status(400).json({ error: 'Selected source/target paths were not found in schema snapshots.' });
      }
      if (!isShapeEquivalentNode(sourceNode, targetNode, sourceChildrenByParent, targetChildrenByParent)) {
        return res.status(409).json({ error: 'Selected branches are not structurally equivalent.' });
      }

      const expanded = expandShapeMappings(sourceNode, targetNode, sourceChildrenByParent, targetChildrenByParent);
      const nextRules = Array.isArray(map.rules) ? [...map.rules] : [];
      const existingKeys = new Set(nextRules.map((rule) => {
        const normalized = normalizeRuleForRuntime(rule);
        return `${normalized.sourcePath}=>${normalized.targetPath}`;
      }));

      let added = 0;
      for (const pair of expanded) {
        const key = `${pair.sourcePath}=>${pair.targetPath}`;
        if (existingKeys.has(key)) continue;
        nextRules.push({
          id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          sourcePath: pair.sourcePath,
          targetPath: pair.targetPath,
          kind: 'leaf',
          sourceValueType: 'unknown',
          targetValueType: 'unknown',
          conversionRule: '',
        });
        existingKeys.add(key);
        added += 1;
      }

      map.rules = nextRules;
      map.updatedAt = new Date().toISOString();
      await fs.writeFile(filePath, JSON.stringify(map, null, 2), 'utf-8');

      res.json({ added, map });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/mapper/maps/:id/run', async (req, res) => {
    try {
      await seedLegacyMaps();
      const { id } = req.params;
      const filePath = resolveMapFile(`${id}.map`);
      const content = await fs.readFile(filePath, 'utf-8');
      const map = JSON.parse(content);

      if (map?.sourceSchemaPath && map?.sourceSchemaMtime) {
        const mtime = await currentSchemaMtime(map.sourceSchemaPath).catch(() => null);
        if (mtime && String(mtime) !== String(map.sourceSchemaMtime)) {
          return res.status(409).json({ error: 'Source schema changed since this map was saved. Refresh before running.' });
        }
      }
      if (map?.targetSchemaPath && map?.targetSchemaMtime) {
        const mtime = await currentSchemaMtime(map.targetSchemaPath).catch(() => null);
        if (mtime && String(mtime) !== String(map.targetSchemaMtime)) {
          return res.status(409).json({ error: 'Target schema changed since this map was saved. Refresh before running.' });
        }
      }

      let payload = req.body?.payload;
      const testCaseId = String(req.body?.testCaseId || '').trim();
      if (!payload && testCaseId) {
        const store = await readJsonFile(issueTestStorePath, {});
        const testCases = Array.isArray(store?.testCases) ? store.testCases : [];
        const testCase = testCases.find((item) => String(item?.id || '') === testCaseId);
        if (!testCase) {
          return res.status(404).json({ error: `Unknown test case: ${testCaseId}` });
        }
        const sourceNodes = flattenStructure(map?.sourceStructure);
        payload = buildSyntheticPayloadFromNodes(sourceNodes);
      }

      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({ error: 'payload object or testCaseId is required' });
      }

      const rules = (Array.isArray(map.rules) ? map.rules : []).map(normalizeRuleForRuntime);
      const sourceByPath = nodeMapByPath(map?.sourceStructure || null);
      const targetByPath = nodeMapByPath(map?.targetStructure || null);
      const output = {};
      const diagnostics = [];

      for (const rule of rules) {
        if (!rule.sourcePath || !rule.targetPath) continue;
        const sourceValue = getByPath(payload, rule.sourcePath);
        if (sourceValue === undefined) {
          diagnostics.push({ level: 'warning', rule: `${rule.sourcePath} -> ${rule.targetPath}`, message: 'Source field not present in payload' });
          continue;
        }

        let value = sourceValue;
        if (rule.conversionRule) {
          const vars = runPL0(rule.conversionRule, { src: sourceValue, output: sourceValue });
          value = vars && Object.prototype.hasOwnProperty.call(vars, 'output') ? vars.output : sourceValue;
          diagnostics.push({ level: 'info', rule: `${rule.sourcePath} -> ${rule.targetPath}`, message: 'Pascalish routine applied' });
        } else {
          const sourceNode = sourceByPath.get(rule.sourcePath);
          const targetNode = targetByPath.get(rule.targetPath);
          if (sourceNode && targetNode) {
            const sourceType = String(sourceNode.valueType || 'unknown').toLowerCase();
            const targetType = String(targetNode.valueType || 'unknown').toLowerCase();
            if (sourceType !== targetType && sourceType !== 'unknown' && targetType !== 'unknown') {
              return res.status(409).json({
                error: `Non-standard move ${rule.sourcePath} -> ${rule.targetPath} requires a Pascalish routine.`
              });
            }
          }
        }

        setByPath(output, rule.targetPath, value);
      }

      res.json({
        mapId: map.id,
        input: payload,
        output,
        diagnostics,
      });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(400).json({ error: e.message });
    }
  });
}
