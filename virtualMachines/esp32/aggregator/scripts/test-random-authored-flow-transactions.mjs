import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { buildAuthoredFlowPcodeArtifacts } from '../src/backend/flowAuthoringAgent.mjs';
import { runSingleMessageForEvolution } from './run-js-pmachine.mjs';

const BASE_URL = process.env.PULSE_BACKEND_URL || 'http://127.0.0.1:4000';
const SEED = Number(process.env.TEST_SEED || 20260803);
const TRANSACTION_COUNT = 50;
const ACTOR_HEADERS = { 'x-user-id': 'system-admin' };
const XML_PARSER = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false });

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

const random = createRandom(SEED);

function randomItem(values) {
  return values[Math.floor(random() * values.length)];
}

function randomDigits(length) {
  let value = '';
  for (let index = 0; index < length; index += 1) value += Math.floor(random() * 10);
  return value;
}

function getByPath(value, dottedPath) {
  return String(dottedPath).split('.').reduce((current, key) => current?.[key], value);
}

function getMappedXmlValue(value, dottedPath) {
  const pathText = String(dottedPath || '');
  if (pathText.endsWith('.#text')) {
    const parentValue = getByPath(value, pathText.slice(0, -6));
    return parentValue && typeof parentValue === 'object' ? parentValue['#text'] : parentValue;
  }
  return getByPath(value, pathText);
}

function expectedMappedValue(sourceValue, conversionRule) {
  const rule = String(conversionRule || '').toLowerCase();
  if (rule.includes('yymmddtoiso')) {
    const value = String(sourceValue).trim();
    const year = Number(value.slice(0, 2));
    return `${year >= 70 ? 1900 + year : 2000 + year}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
  }
  if (rule.includes('mtamounttodecimal')) return String(sourceValue).trim().replace(',', '.');
  if (rule.includes('mtpartyname')) {
    const lines = String(sourceValue).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    return lines.find(line => !line.startsWith('/')) || lines[0] || '';
  }
  if (rule.includes('mtchargebearertoiso')) {
    const value = String(sourceValue).trim().toUpperCase();
    return value === 'OUR' ? 'DEBT' : value === 'BEN' ? 'CRED' : value;
  }
  if (rule.includes('upper')) return String(sourceValue).trim().toUpperCase();
  if (rule.includes('trim')) return String(sourceValue).trim();
  return sourceValue;
}

function randomDate() {
  const year = 26 + Math.floor(random() * 3);
  const month = 1 + Math.floor(random() * 12);
  const day = 1 + Math.floor(random() * 28);
  return `${String(year).padStart(2, '0')}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
}

function randomAmount() {
  return `${1 + Math.floor(random() * 999999)},${randomDigits(2)}`;
}

function buildPayload(messageType, index) {
  const currency = randomItem(['CAD', 'USD', 'EUR', 'GBP', 'JPY']);
  const reference = `${messageType}-${String(index + 1).padStart(3, '0')}-${randomDigits(8)}`;
  const common = {
    '20': reference,
    '21': `E2E-${randomDigits(12)}`,
    '32A': { components: { valueDate: randomDate(), currency, amount: randomAmount() } },
    '52A': randomItem(['ROYCCAT2', 'BOFAUS3N', 'DEUTDEFF', 'BARCGB22']),
    '56A': randomItem(['CITIUS33', 'BNPAFRPP', 'CHASUS33', 'NEDSZAJJ']),
    '57A': randomItem(['TDOMCATTTOR', 'CHQABEBB', 'IRVTUS3N', 'DABADKKK']),
    '72': `/INS/${reference}`,
  };

  const fields = messageType === 'MT103'
    ? {
        ...common,
        '23B': 'CRED',
        '33B': { components: { currency, amount: randomAmount() } },
        '50A': randomItem(['ROYCCAT2', 'BOFAUS3N', 'DEUTDEFF']),
        '50K': `DEBTOR ${randomDigits(6)}`,
        '53A': randomItem(['BOFACATT', 'CITIUS33', 'BNPAFRPP']),
        '59': `CREDITOR ${randomDigits(6)}`,
        '59A': randomItem(['TDOMCATTTOR', 'CHQABEBB', 'IRVTUS3N']),
        '70': `INVOICE-${randomDigits(10)}`,
        '71A': randomItem(['SHA', 'OUR', 'BEN']),
        '71B': randomAmount(),
      }
    : {
        ...common,
        '58A': randomItem(['IRVTIT2X', 'BOFAUS3N', 'DEUTDEFF']),
      };

  return { messageType, finEnvelope: { block4: { fields } } };
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...ACTOR_HEADERS, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${payload.error || JSON.stringify(payload)}`);
  return payload;
}

async function validatePlatformContracts() {
  const workspacePayload = await fetchJson('/api/projects/default/workspace');
  const flow = workspacePayload?.workspace?.flow?.payload;
  assert.equal(flow?.kind, 'pulse.canvas.generic-flow', 'Unexpected flow kind');
  assert.equal(flow.nodes.length, 4, 'Expected four flow nodes');
  assert.equal(flow.edges.length, 4, 'Expected four flow edges');

  const mapperRulesets = flow.nodes
    .filter(node => node.flowNodeType === 'mapper')
    .map(node => node.config?.ruleset)
    .sort();
  assert.deepEqual(mapperRulesets, ['mt103-to-pacs', 'mt202-to-pacs']);

  const queueConfig = await fetchJson('/api/queues/qm-primary/config');
  assert.deepEqual(queueConfig.queues?.['payments.in']?.dataTypeIds, ['swift-mt103', 'swift-mt202']);
  assert.deepEqual(queueConfig.queues?.['payments.out']?.dataTypeIds, ['pacs']);
  return workspacePayload;
}

async function loadMap(mapId) {
  const filePath = path.resolve('data', 'data-maps', `${mapId}.map`);
  const map = JSON.parse(await fs.readFile(filePath, 'utf8'));
  assert.ok(Array.isArray(map.rules) && map.rules.length > 0, `Map ${mapId} has no rules`);
  return map;
}

async function runTransaction(testCase, maps, executablePaths) {
  const map = maps[testCase.mapId];
  const payload = buildPayload(testCase.messageType, testCase.index);
  const result = await runSingleMessageForEvolution({
    pcode: executablePaths.pcode,
    programMap: executablePaths.programMap,
    inputQueue: 'payments.in',
    message: JSON.stringify(payload),
    backendUrl: BASE_URL,
    actorUserId: 'system-admin',
    serviceId: 'payments-in-to-payments-out-service',
    organismId: '',
    generation: '0',
    fitnessOut: '',
  });

  assert.equal(result.runtime, 'js-pmachine', `Transaction ${testCase.index}: p-machine did not run`);
  assert.equal(result.publishedCount, 1, `Transaction ${testCase.index}: expected one pcode delivery`);
  assert.equal(result.deliveries[0]?.queueName, 'payments.out', `Transaction ${testCase.index}: wrong output queue`);
  const output = XML_PARSER.parse(String(result.deliveries[0].message || ''));
  const expectedNamespace = testCase.messageType === 'MT103'
    ? 'urn:iso:std:iso:20022:tech:xsd:pacs.008.001.14'
    : 'urn:iso:std:iso:20022:tech:xsd:pacs.009.001.13';
  assert.equal(output.Document?.['@xmlns'], expectedNamespace, `Transaction ${testCase.index}: wrong PACS namespace`);

  for (const rule of map.rules) {
    const sourceValue = getByPath(payload, rule.sourcePath);
    const targetValue = getMappedXmlValue(output, rule.targetPath);
    assert.notEqual(sourceValue, undefined, `Transaction ${testCase.index}: missing generated source ${rule.sourcePath}`);
    const expectedValue = expectedMappedValue(sourceValue, rule.conversionRule);
    assert.deepEqual(targetValue, expectedValue, `Transaction ${testCase.index}: incorrect ${rule.sourcePath} -> ${rule.targetPath}`);
  }

  return {
    index: testCase.index,
    messageType: testCase.messageType,
    mapId: testCase.mapId,
    reference: getByPath(payload, 'finEnvelope.block4.fields.20'),
    checkedRules: map.rules.length,
  };
}

async function main() {
  const workspacePayload = await validatePlatformContracts();
  const maps = {
    'mt103-to-pacs': await loadMap('mt103-to-pacs'),
    'mt202-to-pacs': await loadMap('mt202-to-pacs'),
  };
  const request = {
    inputQueue: 'payments.in',
    outputQueue: 'payments.out',
    inputTypeIds: ['swift-mt103', 'swift-mt202'],
    outputTypeIds: ['pacs'],
  };
  const executable = buildAuthoredFlowPcodeArtifacts({
    flowName: 'payments.in-to-payments.out',
    request,
    maps: [maps['mt103-to-pacs'], maps['mt202-to-pacs']],
  });
  const workspace = workspacePayload.workspace;
  workspace.documents = {
    ...(workspace.documents || {}),
    pcode: { id: 'pcode', kind: 'pcode', label: 'Compiled Pcode', fileName: executable.pcodeFileName, content: executable.pcodeText },
    programMap: { id: 'programMap', kind: 'program-map', label: 'Pcode Program Map', fileName: executable.programMapFileName, content: JSON.stringify(executable.programMap, null, 2) },
  };
  workspace.projectModel.programs = [{
    id: executable.programId,
    fileName: executable.pcodeFileName,
    programMapFileName: executable.programMapFileName,
    language: 'pcode',
  }];
  await fetchJson('/api/projects/default/workspace', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace }),
  });
  const executionRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-pcode-flow-'));
  const executablePaths = {
    pcode: path.join(executionRoot, executable.pcodeFileName),
    programMap: path.join(executionRoot, executable.programMapFileName),
  };
  await fs.writeFile(executablePaths.pcode, executable.pcodeText, 'utf8');
  await fs.writeFile(executablePaths.programMap, `${JSON.stringify(executable.programMap, null, 2)}\n`, 'utf8');

  const testCases = Array.from({ length: TRANSACTION_COUNT }, (_, index) => ({
    index,
    messageType: index < TRANSACTION_COUNT / 2 ? 'MT103' : 'MT202',
    mapId: index < TRANSACTION_COUNT / 2 ? 'mt103-to-pacs' : 'mt202-to-pacs',
    order: random(),
  })).sort((left, right) => left.order - right.order);

  const results = [];
  for (const testCase of testCases) results.push(await runTransaction(testCase, maps, executablePaths));

  const references = new Set(results.map(item => item.reference));
  assert.equal(references.size, TRANSACTION_COUNT, 'Random transaction references were not unique');

  const summary = {
    status: 'passed',
    seed: SEED,
    transactions: results.length,
    mt103: results.filter(item => item.messageType === 'MT103').length,
    mt202: results.filter(item => item.messageType === 'MT202').length,
    ruleAssertions: results.reduce((total, item) => total + item.checkedRules, 0),
    runtime: 'pcode via js-pmachine',
    pcode: executable.pcodeFileName,
    failures: 0,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', seed: SEED, error: error.message }, null, 2));
  process.exitCode = 1;
});
