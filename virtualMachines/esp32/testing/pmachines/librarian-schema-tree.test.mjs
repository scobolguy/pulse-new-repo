import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createPascalishSchemaTreeService } from '../../aggregator/src/librarian/schema-tree-service.mjs';
import { createJsonCollectionBindings } from '../../pmachines/javascript/src/json-collection-bindings.mjs';
import { createDesktopTextBindings } from '../../pmachines/javascript/src/desktop-text-bindings.mjs';
import { createBoundedTextBindings } from '../../pmachines/javascript/src/bounded-text.mjs';
import { createJsonValueBindings } from '../../pmachines/javascript/src/json-value-bindings.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';

let service;
before(async () => { service = await createPascalishSchemaTreeService(); });
after(async () => { await service?.stop(); });

function original(structure, selections) {
  const fields = [];
  const allowed = [...new Set((selections || []).map(value => String(value || '').trim()
    .replace(/^root\.?/i, '').split('.').map(part => part.trim()).filter(Boolean).join('.')).filter(Boolean))];
  function visit(node, previous = '', filter = false) {
    if (!node || typeof node !== 'object') return null;
    const name = String(node.name || '').trim();
    const contributes = name && name !== 'root'
      && !['sequence', 'choice', 'all', 'complextype'].includes(String(node.valueType || '').toLowerCase());
    const current = contributes ? (previous ? `${previous}.${name}` : name) : previous;
    if (!filter && contributes && !fields.includes(current)) fields.push(current);
    if (filter && current && !allowed.some(field => field === current
      || field.startsWith(`${current}.`) || current.startsWith(`${field}.`))) return null;
    const children = (Array.isArray(node.children) ? node.children : [])
      .map(child => visit(child, current, filter)).filter(Boolean);
    return { ...node, children };
  }
  visit(structure);
  return { availableFields: fields, structure: visit(structure, '', true) };
}

const leaf = (name, metadata = {}) => ({ name, ...metadata, children: [] });
const cases = [
  ['null', null, []],
  ['null selections', { name: 'root', children: [leaf('A')] }, null],
  ['primitive root', 'not a node', ['anything']],
  ['array node and invalid children', { name: 'root', children: [null, 4, false, 'text', [1, 2], leaf('A')] }, ['A']],
  ['JSON values', { name: 'root', valueType: 'object', children: [
    { name: 'Account', valueType: 'object', children: [leaf('Id'), leaf('Name')] },
    leaf('Amount', { valueType: 'number' })
  ] }, ['root.Account.Id']],
  ['copybook and branch selection', { name: 'RECORD', children: [{ name: 'GROUP', children: [leaf('FIELD')] }, leaf('OTHER')] }, ['RECORD.GROUP']],
  ['XSD container casing', { name: 'root', children: [{ name: 'ignored', valueType: 'ComplexType', children: [
    { name: 'ignored2', valueType: 'SEQUENCE', children: [leaf('A'), leaf('B')] },
    { name: 'ignored3', valueType: 'choice', children: [leaf('C')] },
    { name: 'ignored4', valueType: 'all', children: [leaf('D')] }
  ] }] }, ['C']],
  ['duplicate preorder paths', { name: 'root', children: [leaf('B'), leaf('A'), leaf('B'), leaf('A')] }, ['A']],
  ['duplicate normalized selections', { name: 'root', children: [leaf('A'), leaf('B')] }, ['root.A', ' A ', 'A', 'root..A']],
  ['root casing and name trimming', { name: 'root', children: [{ name: ' Root ', children: [leaf(' root '), leaf('  ID  ')] }] }, ['Root.ID']],
  ['dot boundaries', { name: 'root', children: [
    { name: 'A', children: [leaf('One'), leaf('Two')] }, { name: 'AB', children: [leaf('One')] }
  ] }, ['A.One']],
  ['root prefix and empty segments', { name: 'root', children: [{ name: 'A', children: [leaf('One'), leaf('Two')] }] }, ['ROOT. A .. One .', 'rootA.One', '', null, false, 0]],
  ['empty selection retains unnamed containers', { name: 'root', children: [leaf('A'), { valueType: 'sequence', children: [leaf('B')] }] }, []],
  ['non-string names and malformed children', { name: 'root', children: [
    leaf(12), leaf(false), leaf(null), leaf(['array', 'name']), leaf({ object: true }), { name: 'A', children: {} }
  ] }, ['12', 'array,name', '[object Object]', 'A']],
  ['metadata', { name: 'root', other: { unchanged: ['x', null] }, children: [
    leaf('Code', { optional: true, enumValues: ['01', '02'], simpleType: {
      variety: 'union', finite: true, members: [{ variety: 'list', itemType: { enumValues: ['a'] } }]
    }, reference: { kind: 'type', namespace: 'urn:x', name: 'Code' }, recursive: true, truncated: true, truncationReason: 'depth', unresolved: true }),
    leaf('Other')
  ] }, ['Code']],
  ['Unicode and unpaired surrogates', { name: 'root', children: [leaf(' 名称 '), leaf('\ud800'), leaf('\ud801'), leaf('😀')] }, ['名称', '\ud800', '😀']],
  ['long paths', { name: 'root', children: [leaf(`A${'x'.repeat(2048)}`), leaf('B')] }, [`A${'x'.repeat(2048)}`]],
  ['pruning dotted names', { name: 'root', children: [{ name: 'A.', children: [leaf('B')] }, leaf('A')] }, ['A.B']]
];

for (const [label, tree, selections] of cases) {
  test(`Pascalish traversal preserves original ${label}`, async () => {
    assert.deepEqual(await service.project(tree, selections), original(tree, selections));
    assert.deepEqual(await service.collect(tree), original(tree, selections).availableFields);
  });
}

test('iterative traversal handles depth beyond the VM call stack and independent cached copies', async () => {
  let tree = leaf('leaf');
  for (let index = 0; index < 80; index += 1) tree = { name: `N${index}`, children: [tree] };
  const expected = original(tree, ['N79']);
  const first = await service.project(tree, ['N79']);
  assert.deepEqual(first, expected);
  first.availableFields.length = 0;
  first.structure.children.length = 0;
  assert.deepEqual(await service.project(tree, ['N79']), expected);
});

test('projection with omitted selections still returns a projected structure', async () => {
  const tree = { name: 'root', children: [leaf('A')] };
  assert.deepEqual(await service.project(tree), original(tree, []));
});

test('concurrent work is coalesced, content edits are not stale, oversize input fails and recovers', async () => {
  const tree = { name: 'root', children: [leaf('Concurrent')] };
  const responses = await Promise.all(Array.from({ length: 24 }, () => service.project(tree, ['Concurrent'])));
  for (const result of responses) assert.deepEqual(result, original(tree, ['Concurrent']));
  responses[0].availableFields.push('mutated');
  assert.notDeepEqual(responses[0], responses[1]);
  tree.children.push(leaf('New'));
  assert.deepEqual(await service.collect(tree), ['Concurrent', 'New']);
  await assert.rejects(service.collect(leaf('x'.repeat(1000001))), error => error.status === 413);
  await assert.rejects(service.project(tree, 'not an array'), /JSON array/);
  assert.deepEqual(await service.collect(tree), ['Concurrent', 'New']);
  assert.ok(service.getStatus().cachedBytes <= 32000000);
  assert.ok(service.getStatus().cachedEntries <= 256);
});

test('wide trees fit the execution budget; oversized projected output fails explicitly and recovers', async () => {
  const wide = { name: 'root', children: Array.from({ length: 1000 }, (_, index) => leaf(`Wide${index}`)) };
  assert.deepEqual(await service.project(wide, ['Wide0']), original(wide, ['Wide0']));
  const large = { name: 'root', children: ['a', 'b', 'c'].map(value => leaf(`A.${value.repeat(180000)}`)) };
  assert.equal((await service.collect(large)).length, 3);
  await assert.rejects(service.project(large, ['A']), /capacity exceeded/i);
  assert.deepEqual(await service.project(leaf('Recovered'), ['Recovered']), original(leaf('Recovered'), ['Recovered']));
});

test('generic JSON kind, coercion and object conversion remain checked', () => {
  const bindings = createJsonCollectionBindings();
  for (const [serialized, kind] of [['null', 'null'], ['[]', 'array'], ['{}', 'object'],
    ['"text"', 'string'], ['1', 'number'], ['true', 'boolean']]) {
    assert.equal(bindings['host.json_kind'](serialized), kind);
  }
  assert.equal(bindings['host.json_to_text']('["a","b"]'), 'a,b');
  assert.equal(bindings['host.json_to_text']('{}'), '[object Object]');
  assert.equal(bindings['host.json_object']('[1,null]'), '{"0":1,"1":null}');
  for (const name of ['host.json_kind', 'host.json_to_text', 'host.json_object']) {
    assert.throws(() => bindings[name]('broken'), /Invalid JSON/);
  }
  assert.throws(() => bindings['host.json_object']('null'), /object or array/);
});

test('invocation-local JSON value navigation is checked, bounded and preserves own properties', () => {
  const bindings = createJsonValueBindings();
  const handle = bindings['host.json_parse_value']('{"children":[null,{"__proto__":"safe","name":"名"}]}');
  const children = bindings['host.json_node_member'](handle, 0, 'children');
  assert.equal(bindings['host.json_node_member'](handle, 0, 'missing'), -1);
  assert.equal(bindings['host.json_node_member'](handle, 0, 'toString'), -1);
  assert.equal(bindings['host.json_node_kind'](handle, children), 'array');
  assert.equal(bindings['host.json_node_count'](handle, children), 2);
  assert.equal(bindings['host.json_node_kind'](handle, bindings['host.json_node_item'](handle, children, 0)), 'null');
  const entry = bindings['host.json_node_item'](handle, children, 1);
  assert.equal(bindings['host.json_node_item'](handle, children, 1), entry);
  assert.equal(bindings['host.json_node_value'](handle, bindings['host.json_node_member'](handle, entry, '__proto__')), '"safe"');
  assert.throws(() => bindings['host.json_node_item'](handle, children, 2), /index out of bounds/);
  assert.throws(() => bindings['host.json_node_count'](handle, 0), /array node/);
  assert.throws(() => bindings['host.json_node_kind'](handle + 1, 0), /handle or node/);
  assert.throws(() => bindings['host.json_node_kind'](handle, -1), /handle or node/);
  assert.throws(() => bindings['host.json_parse_value']('broken'), /Invalid JSON/);
  const isolated = createJsonValueBindings();
  assert.throws(() => isolated['host.json_node_kind'](handle, entry), /handle or node/);
  const bounded = createJsonValueBindings({ maxHandles: 1, maxNodes: 2 });
  const limitedHandle = bounded['host.json_parse_value']('{"a":1,"b":2}');
  bounded['host.json_node_member'](limitedHandle, 0, 'a');
  assert.throws(() => bounded['host.json_node_member'](limitedHandle, 0, 'b'), /node capacity/);
  assert.throws(() => bounded['host.json_parse_value']('null'), /handle capacity/);
  assert.throws(() => createJsonValueBindings({ maxNodes: 0 }), /Invalid JSON value limits/);
});

test('desktop text operations preserve Unicode code units without relaxing ESP32 ASCII bindings', () => {
  const bindings = createDesktopTextBindings();
  assert.equal(bindings['host.text_trim']('\u00a0名\ud800\u00a0'), '名\ud800');
  assert.equal(bindings['host.string_lower']('ÉΣ'), 'éς');
  assert.equal(bindings['host.string_upper']('éß'), 'ÉSS');
  assert.equal(bindings['host.string_index']('名\ud800'.repeat(2048), '\ud800'), 1);
  assert.equal(bindings['host.string_slice']('名\ud800😀', 1, 1000000), '\ud800😀');
  assert.deepEqual(JSON.parse(bindings['host.text_split']('A..名.', '.')), ['A', '', '名', '']);
  for (const [start, end] of [[-1, 1], [2, 1], [0.5, 1], [0, Infinity]]) {
    assert.throws(() => bindings['host.string_slice']('x', start, end), /Invalid string slice/);
  }
  assert.throws(() => bindings['host.text_trim'](null), /Expected string/);
  assert.throws(() => createBoundedTextBindings()['host.text_lower']('名'), /ASCII/);
  for (const expression of ["host.json_kind('{}')", "host.json_to_text('null')",
    "host.json_object('[]')", "host.json_remove('{}', 'x')", "host.text_trim('x')", "host.text_split('x', '.')",
    "host.string_upper('x')",
    "host.string_lower('x')", "host.string_index('x', 'x')", "host.string_slice('x', 0, 1)",
    "host.json_parse_value('{}')", "host.json_node_kind(1, 0)", "host.json_node_member(1, 0, 'x')",
    "host.json_node_count(1, 0)", "host.json_node_item(1, 0, 0)", "host.json_node_value(1, 0)"]) {
    const compiled = compilePascalishProgramWithAntlr(
      `service 'desktop-text'; get '/'; begin return ${expression} end end.`, { hostServices: true });
    assert.deepEqual(compiled.programMap.targets, ['js']);
    assert.throws(() => encodeHostedImage(compiled.pcodeText), /Desktop-only/);
  }
});

test('stopping the tree service clears caches and explicitly rejects new work', async () => {
  const isolated = await createPascalishSchemaTreeService();
  try {
    await isolated.collect(leaf('A'));
    await isolated.stop();
    assert.equal(isolated.getStatus().cachedBytes, 0);
    await assert.rejects(isolated.collect(null), error => error.status === 503);
  } finally {
    await isolated.stop();
  }
});
