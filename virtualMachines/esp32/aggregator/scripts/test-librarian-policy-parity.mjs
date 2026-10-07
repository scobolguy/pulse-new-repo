import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const aggregatorRoot = path.resolve(import.meta.dirname, '..');
const baselineRevision = 'a49a70ca^';
const baselineSource = execFileSync('git', [
  'show', `${baselineRevision}:virtualMachines/esp32/aggregator/data-librarian.mjs`,
], { cwd: aggregatorRoot, encoding: 'utf8' });
assert.ok(baselineSource.includes('definition.accessibleFields.filter(field => !availableFields.has(field))'));
const baselinePath = path.join(aggregatorRoot, `.librarian-parity-${randomUUID()}.mjs`);
const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-librarian-parity-'));
const processes = [];

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function startLibrarian(entry, dataRoot) {
  const port = await getFreePort();
  const child = spawn(process.execPath, [entry], {
    cwd: aggregatorRoot,
    env: { ...process.env, LIBRARIAN_PORT: String(port), LIBRARIAN_DATA_ROOT: dataRoot },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  processes.push(child);
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Librarian exited (${child.exitCode}): ${errors}`);
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return origin;
    } catch {
      // Retry only while the child is starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Librarian startup timeout: ${errors}`);
}

function withoutTimestamps(value) {
  if (Array.isArray(value)) return value.map(withoutTimestamps);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['mtime', 'ctime'].includes(key))
    .map(([key, item]) => [key, withoutTimestamps(item)]));
}

const longField = 'LongField'.repeat(100);
const fields = [
  'Id', 'Identifier', 'Secret', '\u540d', 'caf\u00e9', 'cafe\u0301', '\ud83d\ude00',
  'a"b', 'a\\b', "a'b", 'line\nbreak', 'null\u0000byte', '\ud800',
  ...[281, 282, 283, 570, 585, 590].map(length => 'x'.repeat(length)), longField,
  ...Array.from({ length: 120 }, (_, index) => `ChunkField${String(index).padStart(3, '0')}`),
];
const schema = {
  type: 'object',
  properties: {
    Document: {
      type: 'object',
      properties: {
        Header: { type: 'object', properties: Object.fromEntries(fields.map(name => [name, { type: 'string' }])) },
      },
    },
  },
};
const cases = [
  { name: 'basic', fields: ['Document.Header.Id'], status: 201 },
  { name: 'branches', fields: ['Document', 'Document.Header'], status: 201 },
  { name: 'normalization', fields: [' root.Document . Header .Id ', 'Document..Header.Id'], status: 201 },
  { name: 'duplicates', fields: ['Document.Header.Id', 'Document.Header.Id'], status: 201 },
  { name: 'unicode', fields: ['Document.Header.\u540d', 'Document.Header.\ud83d\ude00'], status: 201 },
  { name: 'unicode-normalization', fields: ['Document.Header.caf\u00e9', 'Document.Header.cafe\u0301'], status: 201 },
  { name: 'escaped-fields', fields: ['Document.Header.a"b', 'Document.Header.a\\b', "Document.Header.a'b"], status: 201 },
  { name: 'control-characters', fields: ['Document.Header.line\nbreak', 'Document.Header.null\u0000byte'], status: 201 },
  { name: 'unpaired-surrogate-present', fields: ['Document.Header.\ud800'], status: 201 },
  { name: 'unpaired-surrogate-absent', fields: ['Document.Header.\ud801'], status: 400 },
  { name: 'chunk-boundaries', fields: [281, 282, 283, 570, 585, 590].map(length => `Document.Header.${'x'.repeat(length)}`), status: 201 },
  { name: 'long-present', fields: [`Document.Header.${longField}`], status: 201 },
  { name: 'long-absent', fields: [`Document.Header.${longField.slice(0, -1)}X`], status: 400 },
  { name: 'late-chunk', fields: ['Document.Header.ChunkField119'], status: 201 },
  { name: 'many-fields', fields: fields.slice(-120).map(name => `Document.Header.${name}`), status: 201 },
  { name: 'unknown', fields: ['Document.Header.DoesNotExist'], status: 400 },
  { name: 'prefix', fields: ['Document.Header.I'], status: 400 },
  { name: 'suffix', fields: ['Header.Id'], status: 400 },
  { name: 'wrong-case', fields: ['Document.Header.id'], status: 400 },
  { name: 'child-of-leaf', fields: ['Document.Header.Id.Child'], status: 400 },
  { name: 'mixed', fields: ['Document.Header.Id', 'Document.Header.Unknown', 'Document.Missing'], status: 400 },
  { name: 'empty', fields: [], status: 400 },
  { name: 'blank', fields: [' ', 'root.'], status: 400 },
  { name: 'not-array', fields: 'Document.Header.Id', status: 400 },
  { name: 'missing-parent', fields: ['Document.Header.Id'], parent: 'missing.json-schema', status: 400 },
  { name: 'unreadable-parent', fields: ['Document.Header.Id'], parent: 'broken.json-schema', status: 400 },
];

try {
  await fs.writeFile(baselinePath, baselineSource);
  const roots = ['old', 'new'].map(name => path.join(runtimeRoot, name));
  for (const root of roots) {
    const schemaRoot = path.join(root, 'services', 'librarian', 'schemas');
    await fs.mkdir(schemaRoot, { recursive: true });
    await fs.writeFile(path.join(schemaRoot, 'parity.json-schema'), JSON.stringify(schema));
    await fs.writeFile(path.join(schemaRoot, 'broken.json-schema'), 'not JSON');
  }
  const origins = [
    await startLibrarian(baselinePath, roots[0]),
    await startLibrarian('data-librarian.mjs', roots[1]),
  ];
  const timings = [[], []];
  const failures = [];
  let comparisons = 0;
  async function compare(name, method, endpoint, body, expectedStatus) {
    const results = [];
    for (const [index, origin] of origins.entries()) {
      const started = performance.now();
      const response = await fetch(`${origin}${endpoint}`, {
        method,
        headers: { 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30000),
      });
      const payload = await response.json();
      timings[index].push({ name, elapsedMs: performance.now() - started });
      results.push({ status: response.status, body: withoutTimestamps(payload) });
    }
    comparisons += 1;
    try {
      assert.equal(results[0].status, expectedStatus, `${name}: baseline status`);
      assert.deepEqual(results[1], results[0], `${name}: old/new response mismatch`);
    } catch (error) {
      failures.push(error.message);
      console.error(`[parity] FAIL: ${name} (old=${results[0].status}, new=${results[1].status})`);
    }
  }
  async function compareConcurrentRejections() {
      const batchSize = 24;
      const results = [];
      for (const origin of origins) {
        results.push(await Promise.all(Array.from({ length: batchSize }, async (_, index) => {
          const response = await fetch(`${origin}/api/librarian/subschemas`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              id: `concurrent-${index}`,
              parentSchemaPath: 'parity.json-schema',
              accessibleFields: [`Document.Header.Missing${index}`],
            }),
            signal: AbortSignal.timeout(30000),
          });
          return { status: response.status, body: await response.json() };
        })));
      }
      for (let index = 0; index < batchSize; index += 1) {
        comparisons += 1;
        try {
          assert.equal(results[0][index].status, 400);
          assert.deepEqual(results[1][index], results[0][index], `concurrent-${index}: old/new mismatch`);
        } catch (error) {
          failures.push(error.message);
          console.error(`[parity] FAIL: concurrent-${index} (${JSON.stringify(results[1][index].body)})`);
        }
      }
  }

  for (const testCase of cases) {
    await compare(testCase.name, 'POST', '/api/librarian/subschemas', {
      id: testCase.name,
      label: testCase.name,
      parentSchemaPath: testCase.parent || 'parity.json-schema',
      accessibleFields: testCase.fields,
    }, testCase.status);
  }
  await compare('duplicate-id', 'POST', '/api/librarian/subschemas', {
    id: 'basic', parentSchemaPath: 'parity.json-schema', accessibleFields: ['Document.Header.Id'],
  }, 409);
  await compare('update-allowed', 'PUT', '/api/librarian/subschemas/basic', {
    accessibleFields: ['Document.Header.Identifier'],
  }, 200);
  await compare('update-denied', 'PUT', '/api/librarian/subschemas/basic', {
    accessibleFields: ['Document.Header.NotPresent'],
  }, 400);
  await compare('update-missing', 'PUT', '/api/librarian/subschemas/missing', { label: 'Missing' }, 404);
  await compare('update-id-collision', 'PUT', '/api/librarian/subschemas/basic', { id: 'branches' }, 409);
  await compare('update-id-rename', 'PUT', '/api/librarian/subschemas/branches', { id: 'renamed-branches', label: 'Renamed' }, 200);
  await compareConcurrentRejections();
  await compare('list', 'GET', '/api/librarian/subschemas', undefined, 200);
  await compare('delete', 'DELETE', '/api/librarian/subschemas/basic', undefined, 200);
  await compare('delete-again', 'DELETE', '/api/librarian/subschemas/basic', undefined, 404);
  await compare('types-empty', 'GET', '/api/librarian/data-types', undefined, 200);
  await compare('type-create', 'POST', '/api/librarian/data-types', { id: 'parity-type', label: 'Parity \u540d' }, 200);
  await compare('type-update', 'PATCH', '/api/librarian/data-types/parity-type', { label: 'Updated' }, 200);
  await compare('type-rename', 'POST', '/api/librarian/data-types/parity-type/rename', { newId: 'parity-renamed' }, 200);
  await compare('type-delete', 'DELETE', '/api/librarian/data-types/parity-renamed', undefined, 200);
  await compare('type-missing-create-input', 'POST', '/api/librarian/data-types', { id: 'missing-label' }, 400);
  await compare('type-missing-update', 'PATCH', '/api/librarian/data-types/missing', { label: 'No' }, 404);
  await compare('type-missing-rename', 'POST', '/api/librarian/data-types/missing/rename', { newId: 'new' }, 404);
  await compare('type-empty-rename', 'POST', '/api/librarian/data-types/missing/rename', { newId: '' }, 400);
  await compare('type-missing-delete', 'DELETE', '/api/librarian/data-types/missing', undefined, 404);
  const typeFixtures = [null, 'ignored', { id: 'Invoice.Payment', label: ' \u540d ', canonicalId: 'type:invoice-payment',
    aliases: ['legacy', 'legacy'], extra: { retained: true } },
  { id: 'invoice-payment', label: 'Collision', canonicalId: 'type:invoice-payment', builtin: true }];
  for (const root of roots) await fs.writeFile(path.join(root, 'services', 'librarian', 'data-types.json'), JSON.stringify(typeFixtures));
  await compare('type-normalization-and-collisions', 'GET', '/api/librarian/data-types', undefined, 200);
  await compare('type-duplicate', 'POST', '/api/librarian/data-types', { id: 'invoice-payment', label: 'Duplicate' }, 409);
  await compare('type-rename-collision', 'POST', '/api/librarian/data-types/invoice.payment/rename', { newId: 'invoice-payment' }, 409);
  await compare('type-update-null-label', 'PATCH', '/api/librarian/data-types/invoice.payment', { label: null, isIso: 'yes' }, 200);
  await compare('type-update-empty-label', 'PATCH', '/api/librarian/data-types/invoice.payment', { label: '', isIso: true }, 200);
  await compare('type-rename-keeps-metadata', 'POST', '/api/librarian/data-types/invoice.payment/rename', { newId: 'Named.Type', label: '  ', isIso: false }, 200);
  await compare('type-update-object-label', 'PATCH', '/api/librarian/data-types/named.type', { label: { text: 'object' } }, 200);
  await compare('type-normalized-list', 'GET', '/api/librarian/data-types', undefined, 200);
  await compare('type-iso-inference', 'POST', '/api/librarian/data-types', { id: 'PACS.Type', label: 'ISO' }, 200);
  const ruleset = { id: 'PARITY_RULE', label: 'Parity', sourcePatterns: ['parity.*'], targetPatterns: ['target.*'] };
  await compare('ruleset-create', 'POST', '/api/librarian/mapper-rulesets', ruleset, 200);
  await compare('ruleset-update', 'PUT', '/api/librarian/mapper-rulesets/PARITY_RULE', { label: 'Updated' }, 200);
  await compare('ruleset-list', 'GET', '/api/librarian/mapper-rulesets', undefined, 200);
  await compare('ruleset-delete', 'DELETE', '/api/librarian/mapper-rulesets/PARITY_RULE', undefined, 200);
  await compare('ruleset-missing', 'PUT', '/api/librarian/mapper-rulesets/MISSING', { id: '!!!' }, 404);
  await compare('ruleset-invalid-patterns', 'POST', '/api/librarian/mapper-rulesets', { ...ruleset, sourcePatterns: [] }, 400);
  const mapperFixtures = [
    { ...ruleset, id: 'dup', label: 'First duplicate' },
    { ...ruleset, id: 'DUP', label: 'Last duplicate', priority: 12, recommended: true },
    { ...ruleset, id: 'a-b', label: 'Sanitized legacy identity' },
    { id: 'BAD' }
  ];
  for (const root of roots) await fs.writeFile(path.join(root, 'services', 'librarian', 'mapper-rulesets.json'), JSON.stringify(mapperFixtures));
  await compare('ruleset-legacy-list', 'GET', '/api/librarian/mapper-rulesets', undefined, 200);
  await compare('ruleset-legacy-duplicate', 'POST', '/api/librarian/mapper-rulesets', { ...ruleset, id: 'dup' }, 409);
  await compare('ruleset-legacy-delete-identity', 'DELETE', '/api/librarian/mapper-rulesets/A_B', undefined, 404);
  await compare('ruleset-legacy-append-update', 'PUT', '/api/librarian/mapper-rulesets/A_B', { description: 'Added' }, 200);
  await compare('ruleset-merge-last-visible', 'PUT', '/api/librarian/mapper-rulesets/DUP', {
    label: null, description: null, recommended: null, priority: null, sourcePatterns: null, targetPatterns: null
  }, 200);
  await compare('ruleset-invalid-update-before-collision', 'PUT', '/api/librarian/mapper-rulesets/DUP', { id: 'A_B', sourcePatterns: [] }, 400);
  await compare('ruleset-rename-collision', 'PUT', '/api/librarian/mapper-rulesets/DUP', { id: 'A_B' }, 409);
  await compare('ruleset-update-normalization', 'PUT', '/api/librarian/mapper-rulesets/DUP', {
    id: 'renamed-rule', label: ' \u540d ', sourcePatterns: [' A .* ', 'a.*', ' B.* '], targetPatterns: ' X.* ,x.*, Y.* ',
    priority: '21suffix', recommended: false
  }, 200);
  await compare('ruleset-create-replaces-invalid-visibility', 'POST', '/api/librarian/mapper-rulesets', { ...ruleset, id: 'BAD' }, 200);
  await compare('ruleset-delete-all-matching-raw-ids', 'DELETE', '/api/librarian/mapper-rulesets/BAD', undefined, 200);
  await compare('ruleset-delete-renamed', 'DELETE', '/api/librarian/mapper-rulesets/RENAMED_RULE', undefined, 200);
  await compare('ruleset-post-mutations', 'GET', '/api/librarian/mapper-rulesets', undefined, 200);
  await compare('ruleset-delete-missing', 'DELETE', '/api/librarian/mapper-rulesets/MISSING', undefined, 404);
  await compare('lifecycle-missing-path', 'POST', '/api/librarian/schema-lifecycle', { activeFrom: '2020-01-01' }, 400);
  await compare('lifecycle-missing-schema', 'POST', '/api/librarian/schema-lifecycle', { path: 'missing' }, 404);
  await compare('lifecycle-invalid-date', 'POST', '/api/librarian/schema-lifecycle', { path: 'parity.json-schema', activeFrom: 'invalid' }, 400);
  await compare('lifecycle-invalid-order', 'POST', '/api/librarian/schema-lifecycle', {
    path: 'parity.json-schema', activeFrom: '2100-01-01', rejectAfter: '2020-01-01'
  }, 400);
  await compare('lifecycle-update', 'POST', '/api/librarian/schema-lifecycle', {
    path: 'parity.json-schema', activeFrom: '2020-01-01', rejectAfter: '2100-01-01', keepForDisplay: true
  }, 200);
  await compare('schema-catalog', 'GET', '/api/librarian/schemas', undefined, 200);
  await compare('schema-rename-parent', 'POST', '/api/librarian/schemas/rename', {
    path: 'parity.json-schema', newName: 'parity-renamed'
  }, 200);
  await compare('subschemas-after-parent-rename', 'GET', '/api/librarian/subschemas', undefined, 200);
  for (const name of ['subschemas', 'data-types', 'mapper-rulesets', 'schema-lifecycle']) {
    const persisted = await Promise.all(roots.map(root => fs.readFile(
      path.join(root, 'services', 'librarian', `${name}.json`), 'utf8',
    )));
    try {
      assert.equal(persisted[1], persisted[0], `old/new persisted ${name} formatting mismatch`);
      assert.deepEqual(JSON.parse(persisted[1]), JSON.parse(persisted[0]), `old/new persisted ${name} mismatch`);
    } catch (error) {
      failures.push(error.message);
    }
  }
  for (const [index, label] of ['Node baseline', 'Pascalish'].entries()) {
    const sorted = timings[index].sort((a, b) => a.elapsedMs - b.elapsedMs);
    const slowest = sorted.at(-1);
    console.log(`[parity] ${label}: median=${sorted[Math.floor(sorted.length / 2)].elapsedMs.toFixed(1)}ms max=${slowest.elapsedMs.toFixed(1)}ms (${slowest.name}; HTTP, local fixtures)`);
  }
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log(`[librarian-policy-parity] PASS: ${comparisons} old/new HTTP comparisons and persisted catalogs match (${baselineRevision})`);
} finally {
  await Promise.all(processes.map(child => new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  })));
  await fs.rm(baselinePath, { force: true });
  await fs.rm(runtimeRoot, { recursive: true, force: true });
}
