import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { createPascalishLibrarianNormalization } from '../../aggregator/src/librarian/~normalization.mjs';
import { createDesktopTextBindings } from '../../pmachines/javascript/src/desktop-text-bindings.mjs';
import { createDesktopDateBindings } from '../../pmachines/javascript/src/desktop-date-bindings.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';

const baseline = execFileSync('git', [
  'show', 'a37663f0:virtualMachines/esp32/aggregator/data-librarian.mjs'
], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' });
const functions = baseline.slice(baseline.indexOf('const ISO_TYPE_PREFIXES'),
  baseline.indexOf('async function loadMapperRulesets'));
const original = runInNewContext(`${functions}
({ typeRecord: normalizeDataTypeRecord, inferIso: inferIsoTypeFromId,
   typeCatalog: values => ensureUniqueCanonicalDataTypeIds(values.map(normalizeDataTypeRecord).filter(Boolean)),
   ruleset: normalizeMapperRulesetPayload,
   rulesetCatalog: values => {
     const byId = new Map();
     for (const value of values) {
       try { const record = normalizeMapperRulesetPayload(value); byId.set(record.id, record); }
       catch { /* The original stored-record policy ignores invalid records. */ }
     }
     return Array.from(byId.values()).sort((a, b) =>
       Number(b.priority || 0) - Number(a.priority || 0) || a.id.localeCompare(b.id));
   }
})`, { createHash });
const originalSubschema = runInNewContext(`${baseline.slice(
  baseline.indexOf('function normalizeSchemaFieldPath'),
  baseline.indexOf('async function startSubschemaPolicyHost'))}
normalizeSubschemaDefinition`);
const originalLifecycle = runInNewContext(`${baseline.slice(
  baseline.indexOf('function sanitizeLifecycleDate'),
  baseline.indexOf('const LIBRARIAN_LLM_ACTIONS'))}
({ sanitize: sanitizeLifecycleDate, status: computeLifecycleStatus })`, { Date });
const plain = value => JSON.parse(JSON.stringify(value));
let service;
before(async () => { service = await createPascalishLibrarianNormalization(); });
after(async () => { await service?.stop(); });

test('subschema normalization preserves original validation, coercion and locale ordering', async () => {
  const base = { id: ' Test Sub.Schema ', parentSchemaPath: ' schemas\\x.json ',
    accessibleFields: ['root.Z', 'ROOT. A .. One .', ' A.One ', 'rootA.One', 'Z', 'root', '', null, false, 0,
      'É', 'e', '😀', '\ud800', '\ud801', ['Array', 'Name'], { name: 'object' }, 'Ａ', 'A'] };
  const cases = [null, false, 0, 'text', [], {}, base];
  const values = [null, false, true, 0, 2, '', ' ', ' Root.Name ', [], ['a', 'b'], {}, { x: true }];
  for (const field of ['id', 'label', 'parentSchemaPath', 'parentTypeId', 'accessibleFields']) {
    for (const value of values) cases.push({ ...base, [field]: value });
  }
  cases.push({ ...base, accessibleFields: ['root.' + 'x'.repeat(2048)] });
  for (const candidate of cases) {
    let expected;
    try { expected = plain(originalSubschema(candidate)); }
    catch (error) {
      await assert.rejects(service.subschema(candidate), actual => actual.message === error.message,
        JSON.stringify(candidate));
      continue;
    }
    assert.equal(JSON.stringify(await service.subschema(candidate)), JSON.stringify(expected),
      JSON.stringify(candidate));
  }
});

test('subschema catalogs normalize every record, fail on invalid rows and recover', async () => {
  const records = Array.from({ length: 32 }, (_, index) => ({
    id: `sub-${index}`, parentSchemaPath: 'schema.json', accessibleFields: ['root.Z', 'A', 'a', 'e', 'é', 'B']
  }));
  assert.deepEqual(await service.subschemaCatalog(records), plain(records.map(originalSubschema)));
  assert.deepEqual(await service.subschemaCatalog([]), []);
  await assert.rejects(service.subschemaCatalog({}), error => error.message === 'Subschema catalog must be a JSON array');
  await assert.rejects(service.subschemaCatalog([...records, { id: 'bad' }]),
    error => error.message === 'parentSchemaPath is required');
  assert.deepEqual(await service.subschemaCatalog(records), plain(records.map(originalSubschema)));
});

test('lifecycle normalization preserves date coercion, errors and ordering', async () => {
  const values = [null, false, true, 0, 1, -1, 8640000000000000, 8640000000000001,
    '', ' ', 'bad', '0', '2020-01-01', '2020-01-01T12:00:00+04:00', [], [0], [2020], {}, ['bad'], '0000-01-01'];
  for (const activeFrom of values) {
    for (const rejectAfter of [null, 'invalid', '2025-01-01', '2010-01-01']) {
      const candidate = { activeFrom, rejectAfter, keepForDisplay: false };
      const active = originalLifecycle.sanitize(activeFrom);
      const rejected = originalLifecycle.sanitize(rejectAfter);
      const error = activeFrom && !active ? 'activeFrom must be a valid date/time'
        : rejectAfter && !rejected ? 'rejectAfter must be a valid date/time'
        : active && rejected && Date.parse(rejected) <= Date.parse(active)
          ? 'rejectAfter must be later than activeFrom' : null;
      if (error) await assert.rejects(service.lifecycle(candidate), actual => actual.message === error);
      else assert.deepEqual(await service.lifecycle(candidate),
        { activeFrom: active, rejectAfter: rejected, keepForDisplay: false });
    }
  }
  for (const keepForDisplay of [null, false, true, 0, '', 'false']) {
    assert.equal((await service.lifecycle({ keepForDisplay })).keepForDisplay, keepForDisplay !== false);
  }
  await assert.rejects(service.lifecycle({ activeFrom: { toString: 0 } }),
    error => /primitive/.test(error.message) && error.normalizationValidation !== true);
});

test('lifecycle status respects exact boundaries, epoch-zero truthiness and scheduled precedence', async () => {
  const epoch = '1970-01-01T00:00:00.000Z';
  const boundary = '2026-01-01T00:00:00.000Z';
  const point = Date.parse(boundary);
  const cases = [
    {}, { activeFrom: boundary }, { rejectAfter: boundary },
    { activeFrom: boundary, rejectAfter: '2025-01-01', keepForDisplay: false },
    { activeFrom: epoch, rejectAfter: epoch }, { activeFrom: 'bad', rejectAfter: 'bad' },
    { activeFrom: 0, rejectAfter: false }, { activeFrom: true, rejectAfter: [2025] },
    { activeFrom: {}, rejectAfter: '' }, { activeFrom: '0000-01-01', rejectAfter: boundary }
  ];
  for (const now of [-1, 0, point - 1, point, point + 1]) {
    for (const candidate of cases) {
      const originalNow = Date.now;
      let expected;
      try { Date.now = () => now; expected = originalLifecycle.status(candidate); }
      finally { Date.now = originalNow; }
      assert.deepEqual(await service.lifecycleDisplay(candidate, now), {
        activeFrom: candidate.activeFrom || null, rejectAfter: candidate.rejectAfter || null,
        keepForDisplay: candidate.keepForDisplay !== false, status: expected
      });
    }
  }
  assert.equal((await service.lifecycleDisplay({})).status, 'active');
  await assert.rejects(service.lifecycleDisplay({}, 'invalid'), /numeric/);
});

test('generic desktop date primitives keep invalid dates distinct from malformed JSON', () => {
  const bindings = createDesktopDateBindings();
  assert.equal(bindings['host.date_iso']('null'), '"1970-01-01T00:00:00.000Z"');
  assert.equal(bindings['host.date_iso']('"bad"'), 'null');
  assert.equal(bindings['host.date_parse']('"1970-01-01T00:00:00Z"'), '0');
  assert.equal(bindings['host.date_parse']('"bad"'), 'null');
  const before = Date.now();
  assert.ok(JSON.parse(bindings['host.date_now']()) >= before);
  assert.throws(() => bindings['host.date_iso']('broken'), SyntaxError);
  assert.throws(() => bindings['host.date_parse'](null), /serialized JSON/);
});

test('type normalization matches original coercion, metadata and property order', async () => {
  const cases = [null, false, 0, '', 'type', [], {}, { id: 'pacs.008' },
    { id: 'ÉΣ😀', logicalId: ' 中文 ', canonicalId: 'TYPE:Custom', extra: { a: [null, 1] } },
    { id: 'foo', aliases: ['foo', '\ud800', '\ud801', '😀', null, 0, false, ['a', 'b']] },
    { id: 'invoice', isIso: true, builtin: true }];
  const values = [null, false, true, 0, 2, '', ' ', ' Root.Name ', [], ['a', 'b'], {}, { x: true }];
  for (const field of ['id', 'logicalId', 'canonicalId', 'label', 'aliases', 'builtin', 'isIso']) {
    for (const value of values) cases.push({ id: 'pacs.008', [field]: value });
  }
  for (const candidate of cases) {
    const expected = plain(original.typeRecord(candidate));
    const actual = await service.typeRecord(candidate);
    assert.deepEqual(actual, expected, JSON.stringify(candidate));
    assert.equal(JSON.stringify(actual), JSON.stringify(expected), `property order: ${JSON.stringify(candidate)}`);
  }
});

test('type catalog canonical collisions preserve alias order and UTF-8 hash behavior', async () => {
  const records = [{ id: 'Invoice.Payment' }, { id: 'invoice-payment' }, { id: '\ud800' },
    { id: '\ud801' }, { id: '中文' }, { id: 'invoice-payment', aliases: ['legacy'] }, null];
  assert.equal(JSON.stringify(await service.typeCatalog(records)),
    JSON.stringify(plain(original.typeCatalog(records))));
  await assert.rejects(service.typeCatalog({}), /Data type catalog must be a JSON array/);
});

test('custom type creation and ruleset rename IDs preserve original coercion', async () => {
  for (const id of [' pacs.008 ', 'PACS-TYPE', 'ÉΣ😀', 42, true, {}, ['a', 'b'], []]) {
    const cleanId = String(id).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    for (const isIso of [undefined, true, false, 'true']) {
      const expected = {
        id: cleanId,
        record: plain(original.typeRecord({
          id: cleanId, label: 'Type', builtin: false,
          isIso: typeof isIso === 'boolean' ? isIso : original.inferIso(cleanId)
        }))
      };
      assert.equal(JSON.stringify(await service.createType({ id, label: 'Type', isIso })),
        JSON.stringify(expected));
    }
    assert.equal(await service.rulesetId(id), String(id).trim().toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, ''));
  }
});

test('ruleset normalization matches original coercion, validation precedence and numeric priorities', async () => {
  const base = { id: 'Test rules!', label: ' Test ', sourcePatterns: [' A .* ', 'a.*'], targetPatterns: ' B.* , b.*' };
  const values = [null, false, true, 0, 2, '', ' ', ' ÉΣ😀 ', [], ['a', 'b'], {}, { x: true }];
  const cases = [null, [], base];
  for (const field of ['id', 'label', 'description', 'sourcePatterns', 'targetPatterns', 'recommended', 'priority']) {
    for (const value of values) cases.push({ ...base, [field]: value });
  }
  for (const priority of ['-12tail', '0x20', '1e30', '99999999999999999999999999999999999', '9'.repeat(400)]) {
    cases.push({ ...base, priority });
  }
  for (const candidate of cases) {
    let expected;
    try { expected = plain(original.ruleset(candidate)); }
    catch (error) {
      await assert.rejects(service.ruleset(candidate), actual => actual.message === error.message,
        JSON.stringify(candidate));
      continue;
    }
    assert.deepEqual(await service.ruleset(candidate), expected, JSON.stringify(candidate));
  }
});

test('ruleset catalog keeps last valid duplicates and sorts by priority then locale', async () => {
  const records = [
    { id: 'z', label: 'Z', sourcePatterns: 'a', targetPatterns: 'b', priority: -5 },
    { id: 'a!', label: 'first', sourcePatterns: 'a', targetPatterns: 'b', priority: 10 },
    { id: 'a', label: 'last', sourcePatterns: 'a', targetPatterns: 'b', priority: 20 },
    { id: 'B', label: 'B', sourcePatterns: 'a', targetPatterns: 'b', priority: 20 },
    { id: 'huge', label: 'Huge', sourcePatterns: 'a', targetPatterns: 'b', priority: '9'.repeat(80) }
  ];
  assert.deepEqual(await service.rulesetCatalog(records), plain(original.rulesetCatalog(records)));
  assert.deepEqual(await service.rulesetCatalog(records.slice().reverse()), plain(original.rulesetCatalog(records.slice().reverse())));
  assert.deepEqual(await service.rulesetCatalog([]), []);
  await assert.rejects(service.rulesetCatalog({}), /Mapper ruleset catalog must be a JSON array/);
});

test('malformed stored rulesets produce explicit warnings without masking host failures', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(message);
  try {
    assert.deepEqual(await service.rulesetCatalog([{ id: 'bad' }, null]), []);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /label is required/);
    assert.match(warnings[1], /id is required/);
  } finally { console.warn = originalWarn; }
  await assert.rejects(service.ruleset({ id: 'a', label: 'A', sourcePatterns: 'x'.repeat(1_000_001), targetPatterns: 'b' }),
    /bounds|byte|limit|too large/i);
});

test('representative catalogs remain within desktop VM budgets', async () => {
  const records = Array.from({ length: 1000 }, (_, index) => ({
    id: `T${index}`, label: `Type ${index}`, sourcePatterns: 'a', targetPatterns: 'b', priority: index
  }));
  assert.deepEqual(await service.rulesetCatalog(records), plain(original.rulesetCatalog(records)));
  const types = Array.from({ length: 1000 }, (_, index) => ({ id: `type-${index}` }));
  assert.deepEqual(await service.typeCatalog(types), plain(original.typeCatalog(types)));
});

test('generic desktop regex, locale and numeric primitives validate input', () => {
  const bindings = createDesktopTextBindings();
  assert.equal(bindings['host.string_replace'](' A \t B ', '\\s+', 'g', ''), 'AB');
  assert.equal(bindings['host.string_compare']('B', 'A'), Math.sign('B'.localeCompare('A')));
  assert.equal(bindings['host.number_parse_integer']('2147483648suffix'), '2147483648');
  assert.equal(bindings['host.number_parse_integer']('not numeric'), '0');
  assert.equal(bindings['host.number_compare']('1e100', '2147483648'), 1);
  assert.throws(() => bindings['host.string_replace']('x', 'x', 'gg', ''), /Invalid/);
  assert.throws(() => bindings['host.string_replace']('x', 'x', 'm', ''), /Invalid/);
  assert.throws(() => bindings['host.string_replace']('x', 'x'.repeat(257), '', ''), /Invalid/);
  assert.throws(() => bindings['host.number_compare']('"1"', '1'), /numeric/);
});

test('new desktop normalization bindings remain unavailable to ESP32 hosted images', () => {
  for (const expression of [
    "host.string_replace('a', 'a', 'g', 'b')", "host.string_compare('a', 'b')",
    "host.number_parse_integer('123')", "host.number_compare('1', '2')", "host.text_hash_utf8('x')",
    "host.date_iso('null')", "host.date_parse('null')", "host.date_now()"
  ]) {
    const compiled = compilePascalishProgramWithAntlr(`service 'check'; post '/check'; begin return ${expression} end end.`,
      { fileName: 'desktop-normalization.pas', hostServices: true });
    assert.throws(() => encodeHostedImage(compiled.pcodeText), /desktop-only/i);
  }
});
