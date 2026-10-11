import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyMappingAction, prototypeMapping, rulesOf } from '../out/dataMapperModel.js';
import { applySplices, formatPath, mappingToMapl, maplSplices, maplToMapping, parseMapl } from '../out/maplDocument.js';
import { compileMaplWithAntlr } from '../../../aggregator/scripts/compile-mapl-antlr-to-pcode.mjs';

const sample = `// Payments to transfers
map 'pay-to-xfer' from payment to transfer;
  @name 'Pay to transfer';
  @owner 'treasury';
  @sourceSchema 'schemas/payment.json';
  target.transfer.id := source.reference; // id
  target.'first name' := source.'given name' using 'output := trim(src);';
  if source.amount > 0 then
    target.transfer.amount := source.amount;
  end;
end;
`;

const compiled = text => compileMaplWithAntlr(text).programMap.entries[0];
const strip = path => path.replace(/^(source|target)\./, '');

test('parser agrees with the ANTLR compiler on names, directives and top-level rules', () => {
  const parsed = parseMapl(sample);
  const entry = compiled(sample);
  assert.equal(parsed.id, entry.id);
  assert.equal(parsed.sourceTypeId, entry.sourceTypeId);
  assert.equal(parsed.targetTypeId, entry.targetTypeId);
  assert.deepEqual(Object.fromEntries(parsed.directives.map(item => [item.key, item.value])), entry.metadata);
  assert.deepEqual(parsed.rules.map(statement => [statement.rule.sourcePath, statement.rule.targetPath, statement.rule.conversionRule ?? '']),
    entry.maplIr.filter(item => item.type === 'Assign').map(item => [strip(item.sourcePath), strip(item.targetPath), item.conversionRule ?? '']));
  assert.equal(parsed.extras.length, 1);
  assert.match(parsed.extras[0].text, /^if source\.amount > 0 then/);
});

test('mapping projection reads directives and infers structures from rules', () => {
  const map = maplToMapping(sample);
  assert.equal(map.name, 'Pay to transfer');
  assert.equal(map.sourceSchemaPath, 'schemas/payment.json');
  assert.equal(map.sourceStructureInferred, true);
  assert.deepEqual(map.sourceStructure.children.map(node => node.name), ['reference', 'given name']);
  const cached = maplToMapping(sample, { 'schemas/payment.json': { structure: { children: [
    { name: 'reference', kind: 'leaf', valueType: 'string' }, { name: 'given name', kind: 'leaf', valueType: 'string' },
  ] }, mtime: 'm1' } });
  assert.equal(cached.sourceStructureInferred, false);
  assert.equal(cached.sourceSchemaMtime, 'm1');
  assert.equal(rulesOf(cached)[0].sourceValueType, 'string');
});

test('designer edits become minimal splices that keep comments, unknown directives and other statements', () => {
  const map = maplToMapping(sample);
  const withTarget = maplToMapping(sample.replace("@sourceSchema 'schemas/payment.json';", "@sourceSchema 'schemas/payment.json';\n  @targetSchema 'schemas/transfer.json';"),
    { 'schemas/transfer.json': { structure: { children: [{ name: 'transfer', kind: 'branch', children: [
      { name: 'id', kind: 'leaf', valueType: 'string' }, { name: 'ref', kind: 'leaf', valueType: 'string' }] },
    { name: 'first name', kind: 'leaf', valueType: 'string' }] } } });
  const edits = [
    applyMappingAction(map, { type: 'conversion', index: 0, conversionRule: 'output := upper(src);' }),
    applyMappingAction(map, { type: 'remove', index: 1 }),
    { ...applyMappingAction(withTarget, { type: 'connect', sourcePath: 'reference', targetPath: 'transfer.ref' }), targetSchemaPath: '' },
    { ...map, id: 'renamed', name: 'Renamed', description: 'Moves money' },
  ];
  const results = edits.map(next => applySplices(sample, maplSplices(sample, next)));
  for (const text of results) {
    assert.match(text, /^\/\/ Payments to transfers/);
    assert.match(text, /@owner 'treasury';/);
    assert.match(text, /if source\.amount > 0 then/);
    compiled(text);
  }
  assert.match(results[0], /target\.transfer\.id := source\.reference using 'output := upper\(src\);'; \/\/ id/);
  assert.doesNotMatch(results[1], /first name/);
  assert.match(results[2], /end;\n  target\.transfer\.ref := source\.reference;\nend;\n$/);
  assert.match(results[3], /^map renamed from payment to transfer;/m);
  assert.match(results[3], /@name 'Renamed';/);
  assert.match(results[3], /@sourceSchema 'schemas\/payment\.json';\n  @description 'Moves money';\n  target\.transfer\.id/);
  assert.deepEqual(maplSplices(sample, map), [], 'an unchanged mapping needs no edits');
});

test('rendering round-trips quoted names, quoted segments and conversion text', () => {
  const map = { ...prototypeMapping(), rules: [
    { sourcePath: 'name', targetPath: 'person.first name', conversionRule: "output := src + 'x\\'y';" },
    { sourcePath: 'end', targetPath: 'map', conversionRule: '' },
  ] };
  const text = mappingToMapl(map);
  assert.match(text, /^map 'vscode-prototype' from 'prototype-payment' to 'prototype-transfer';/);
  assert.equal(formatPath('target', 'person.first name'), "target.person.'first name'");
  const back = maplToMapping(text);
  assert.deepEqual(rulesOf(back).map(rule => [rule.sourcePath, rule.targetPath, rule.conversionRule ?? '']),
    map.rules.map(rule => [rule.sourcePath, rule.targetPath, rule.conversionRule]));
  const result = compileMaplWithAntlr(text);
  const entry = result.programMap.entries[0];
  assert.equal(entry.maplIr[0].conversionRule, map.rules[0].conversionRule);
  assert.deepEqual(entry.items.map(item => item.sourcePath), ['source.end']);
  assert.deepEqual(result.programMap.compatibility[0].irOnly, [{
    type: 'Assign', reason: 'Conversion is not supported by the native MAPL runtime.'
  }]);
});

test('invalid MAPL fails explicitly', () => {
  for (const text of ['', 'map a from b to c;', 'map a from b to c; end; map d from e to f; end;', 'map a from b; end;']) {
    assert.throws(() => parseMapl(text));
  }
});
