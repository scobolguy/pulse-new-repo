import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runPL0 } from '../../aggregator/scripts/pl0-interpreter.mjs';
import { createPascalishMapperExecution } from '../../aggregator/src/mapper/execution-policy.mjs';

const requireAggregator = createRequire(new URL('../../aggregator/package.json', import.meta.url));
const express = requireAggregator('express');

function getByPath(source, dottedPath) {
  return String(dottedPath || '').split('.').map(part => part.trim()).filter(Boolean)
    .reduce((cursor, part) => cursor == null ? undefined : cursor[part], source);
}

function setByPath(target, dottedPath, value) {
  const parts = String(dottedPath || '').split('.').map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return;
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function runLegacyMapper({ payload, rules, sourceTypes = {}, targetTypes = {} }) {
  const output = {};
  const diagnostics = [];
  for (const rule of rules) {
    if (!rule.sourcePath || !rule.targetPath) continue;
    const sourceValue = getByPath(payload, rule.sourcePath);
    if (sourceValue === undefined) {
      diagnostics.push({
        level: 'warning',
        rule: `${rule.sourcePath} -> ${rule.targetPath}`,
        message: 'Source field not present in payload'
      });
      continue;
    }

    let value = sourceValue;
    if (rule.conversionRule) {
      const variables = runPL0(rule.conversionRule, { src: sourceValue, output: sourceValue });
      value = variables && Object.hasOwn(variables, 'output') ? variables.output : sourceValue;
      diagnostics.push({
        level: 'info',
        rule: `${rule.sourcePath} -> ${rule.targetPath}`,
        message: 'Pascalish routine applied'
      });
    } else {
      const sourceType = String(sourceTypes[rule.sourcePath] || 'unknown').toLowerCase();
      const targetType = String(targetTypes[rule.targetPath] || 'unknown').toLowerCase();
      if (sourceType !== targetType && sourceType !== 'unknown' && targetType !== 'unknown') {
        throw Object.assign(new Error(
          `Non-standard move ${rule.sourcePath} -> ${rule.targetPath} requires a Pascalish routine.`
        ), { status: 409 });
      }
    }
    setByPath(output, rule.targetPath, value);
  }
  return { output, diagnostics };
}

test('hosted Pascalish planning and writes preserve Mapper execution behavior', async () => {
  const execution = await createPascalishMapperExecution({ logger: { log() {}, error() {}, warn() {} } });
  try {
    const input = {
      payload: {
        source: { value: 21, name: '  Ada  ', entries: [{ id: 7 }] },
        optional: {}
      },
      rules: [
        { sourcePath: 'source.value', targetPath: 'target.answer', conversionRule: 'output := src * 2;' },
        { sourcePath: 'source.name', targetPath: 'target.profile.name', conversionRule: 'output := trim(src);' },
        { sourcePath: 'source.entries.0.id', targetPath: 'target.profile.entryId', conversionRule: '' },
        { sourcePath: 'optional.missing', targetPath: 'target.ignored', conversionRule: '' }
      ]
    };
    assert.deepEqual(await execution.run(input), runLegacyMapper(input));
    assert.deepEqual((await execution.run(input)).output, {
      target: { answer: 42, profile: { name: 'Ada', entryId: 7 } }
    });

    const matchingTypes = {
      payload: { source: { value: 'same type' } },
      rules: [{ sourcePath: 'source.value', targetPath: 'target.value', conversionRule: '' }],
      sourceTypes: { 'source.value': 'STRING' },
      targetTypes: { 'target.value': 'string' }
    };
    assert.deepEqual(await execution.run(matchingTypes), runLegacyMapper(matchingTypes));

    await assert.rejects(
      execution.run({
        payload: { source: { value: 'typed' } },
        rules: [{ sourcePath: 'source.value', targetPath: 'target.value', conversionRule: '' }],
        sourceTypes: { 'source.value': 'string' },
        targetTypes: { 'target.value': 'number' }
      }),
      error => error.status === 409 &&
        error.message === 'Non-standard move source.value -> target.value requires a Pascalish routine.'
    );
  } finally {
    await execution.stop();
  }
});

test('Pascalish shape policy preserves recursive compatibility and leaf expansion', async () => {
  const execution = await createPascalishMapperExecution({ logger: { log() {}, error() {}, warn() {} } });
  const sourceNodes = [
    { path: 'source', kind: 'branch', valueType: 'unknown' },
    { path: 'source.account', kind: 'branch', valueType: 'unknown' },
    { path: 'source.account.name', kind: 'leaf', valueType: 'string' },
    { path: 'source.account.code', kind: 'leaf', valueType: 'unknown' },
    { path: 'source.status', kind: 'leaf', valueType: 'string' }
  ];
  const targetNodes = [
    { path: 'target', kind: 'branch', valueType: 'unknown' },
    { path: 'target.account', kind: 'branch', valueType: 'unknown' },
    { path: 'target.account.name', kind: 'leaf', valueType: 'STRING' },
    { path: 'target.account.code', kind: 'leaf', valueType: 'number' },
    { path: 'target.status', kind: 'leaf', valueType: 'string' }
  ];
  try {
    assert.deepEqual(await execution.mapShape({
      sourceNodes, targetNodes, sourcePath: 'source', targetPath: 'target'
    }), {
      mappings: [
        { sourcePath: 'source.account.name', targetPath: 'target.account.name' },
        { sourcePath: 'source.account.code', targetPath: 'target.account.code' },
        { sourcePath: 'source.status', targetPath: 'target.status' }
      ]
    });

    await assert.rejects(
      execution.mapShape({
        sourceNodes: [...sourceNodes, { path: 'source.other', kind: 'leaf', valueType: 'string' }],
        targetNodes, sourcePath: 'source', targetPath: 'target'
      }),
      error => error.status === 409 &&
        error.message === 'Selected branches are not structurally equivalent.'
    );
    await assert.rejects(
      execution.mapShape({
        sourceNodes, targetNodes, sourcePath: 'source.missing', targetPath: 'target.account'
      }),
      error => error.status === 400 &&
        error.message === 'Selected source/target paths were not found in schema snapshots.'
    );
  } finally {
    await execution.stop();
  }
});

test('Pascalish structure flattening preserves preorder paths and normalization', async () => {
  const execution = await createPascalishMapperExecution({ logger: { log() {}, error() {}, warn() {} } });
  try {
    assert.deepEqual(await execution.flattenStructure({
      children: [
        {
          name: ' account ', kind: 'BRANCH', valueType: 'OBJECT', required: true,
          children: [
            { name: 'name', valueType: 'String', required: true },
            { name: '', children: [{ name: 'must-not-appear' }] }
          ]
        },
        { name: 'count', valueType: '', required: false },
        { name: 'zero-type', valueType: 0, required: false },
        { name: 0, children: [{ name: 'must-also-not-appear' }] }
      ]
    }), [
      { path: 'account', kind: 'branch', valueType: 'object', required: true },
      { path: 'account.name', kind: 'leaf', valueType: 'string', required: true },
      { path: 'count', kind: 'leaf', valueType: 'unknown', required: false },
      { path: 'zero-type', kind: 'leaf', valueType: 'unknown', required: false }
    ]);
    assert.deepEqual(await execution.flattenStructure(null), []);
  } finally {
    await execution.stop();
  }
});

test('Mapper run endpoint retains its HTTP response contract and status codes', async () => {
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-mapper-policy-'));
  const previousRuntimeRoot = process.env.PULSE_RUNTIME_DATA_ROOT;
  process.env.PULSE_RUNTIME_DATA_ROOT = runtimeRoot;
  let server;
  try {
    const { registerMapperRoutes } = await import('../../aggregator/src/backend/mapperRoutes.mjs');
    const app = express();
    app.use(express.json());
    registerMapperRoutes(app);
    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

      const createResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/mapper/maps`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: `execution-signature-${process.pid}`,
          name: 'Execution signature test',
          sourceStructure: {
            children: [{
              name: 'source', kind: 'branch', children: [
                { name: 'label', valueType: 'String', required: true }
              ]
            }]
          }
        }),
        signal: AbortSignal.timeout(10_000)
      });
      assert.equal(createResponse.status, 201);
      const createdMap = (await createResponse.json()).map;
      assert.equal(createdMap.sourceShapeSignature,
        '[{"kind":"branch","path":"source","required":false,"valueType":"unknown"},{"kind":"leaf","path":"source.label","required":true,"valueType":"string"}]');

    const mapId = `execution-policy-${process.pid}`;
    const mapsRoot = path.join(runtimeRoot, 'data-maps');
    const mapPath = path.join(mapsRoot, `${mapId}.map`);
    await fs.mkdir(mapsRoot, { recursive: true });
    const map = {
      id: mapId,
      sourceStructure: {
        children: [{
          name: 'source', kind: 'branch', children: [
            { name: 'value', valueType: 'String' },
            { name: 'label', valueType: 'string' }
          ]
        }]
      },
      targetStructure: {
        children: [{
          name: 'target', kind: 'branch', children: [
            { name: 'result', valueType: 'Number' },
            { name: 'label', valueType: 'STRING' }
          ]
        }]
      },
      rules: [
        { sourcePath: 'source.value', targetPath: 'target.result', conversionRule: 'output := src * 2;' },
        { sourcePath: 'source.absent', targetPath: 'target.ignored', conversionRule: '' }
      ]
    };
    await fs.writeFile(mapPath, JSON.stringify(map));

    const endpoint = `http://127.0.0.1:${server.address().port}/api/mapper/maps/${mapId}/run`;
    const shapeEndpoint = `http://127.0.0.1:${server.address().port}/api/mapper/maps/${mapId}/auto-shape-map`;
    const shapeResponse = await fetch(shapeEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourcePath: 'source.label', targetPath: 'target.label' }),
      signal: AbortSignal.timeout(10_000)
    });
    const shapeBody = await shapeResponse.json();
    assert.equal(shapeResponse.status, 200);
    assert.equal(shapeBody.added, 1);
    assert.deepEqual(shapeBody.map.rules.at(-1), {
      id: shapeBody.map.rules.at(-1).id,
      sourcePath: 'source.label',
      targetPath: 'target.label',
      kind: 'leaf',
      sourceValueType: 'unknown',
      targetValueType: 'unknown',
      conversionRule: ''
    });

    const duplicateShapeResponse = await fetch(shapeEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourcePath: 'source.label', targetPath: 'target.label' }),
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(duplicateShapeResponse.status, 200);
    assert.equal((await duplicateShapeResponse.json()).added, 0);

    const invalidShapeResponse = await fetch(shapeEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourcePath: 'source.value', targetPath: 'target.result' }),
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(invalidShapeResponse.status, 409);
    assert.deepEqual(await invalidShapeResponse.json(), {
      error: 'Selected branches are not structurally equivalent.'
    });

    const missingShapeNodeResponse = await fetch(shapeEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourcePath: 'source.unknown', targetPath: 'target.label' }),
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(missingShapeNodeResponse.status, 400);
    assert.deepEqual(await missingShapeNodeResponse.json(), {
      error: 'Selected source/target paths were not found in schema snapshots.'
    });

    const successfulResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { source: { value: 12, label: 'Label' } } }),
      signal: AbortSignal.timeout(10_000)
    });
    const successfulBody = await successfulResponse.json();
    assert.equal(successfulResponse.status, 200);
    assert.deepEqual(successfulBody, {
      mapId,
      input: { source: { value: 12, label: 'Label' } },
      output: { target: { result: 24, label: 'Label' } },
      diagnostics: [
        { level: 'info', rule: 'source.value -> target.result', message: 'Pascalish routine applied' },
        { level: 'warning', rule: 'source.absent -> target.ignored', message: 'Source field not present in payload' }
      ]
    });

    map.rules = [{ sourcePath: 'source.value', targetPath: 'target.result', conversionRule: '' }];
    await fs.writeFile(mapPath, JSON.stringify(map));
    const incompatibleResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { source: { value: 12, label: 'Label' } } }),
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(incompatibleResponse.status, 409);
    assert.deepEqual(await incompatibleResponse.json(), {
      error: 'Non-standard move source.value -> target.result requires a Pascalish routine.'
    });

    await fs.writeFile(path.join(runtimeRoot, 'issue-test-system.json'), JSON.stringify({
      testCases: [{ id: 'mapper-synthetic-case' }]
    }));
    map.rules = [{
      sourcePath: 'source.label',
      targetPath: 'target.label',
      conversionRule: ''
    }];
    await fs.writeFile(mapPath, JSON.stringify(map));
    const syntheticPayloadResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testCaseId: 'mapper-synthetic-case' }),
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(syntheticPayloadResponse.status, 200);
    const syntheticPayloadBody = await syntheticPayloadResponse.json();
    assert.deepEqual(syntheticPayloadBody.input, {
      source: { value: 'value-sample', label: 'label-sample' }
    });
    assert.deepEqual(syntheticPayloadBody.output, {
      target: { label: 'label-sample' }
    });

    const invalidPayloadResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: [] }),
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(invalidPayloadResponse.status, 400);
    assert.deepEqual(await invalidPayloadResponse.json(), { error: 'payload object or testCaseId is required' });
  } finally {
    if (server?.listening) {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    if (previousRuntimeRoot === undefined) delete process.env.PULSE_RUNTIME_DATA_ROOT;
    else process.env.PULSE_RUNTIME_DATA_ROOT = previousRuntimeRoot;
    await fs.rm(runtimeRoot, { recursive: true, force: true });
  }
});
