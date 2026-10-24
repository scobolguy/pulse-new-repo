import assert from 'node:assert/strict';
import test from 'node:test';
import { compileMaplWithAntlr, formatMaplName, formatMaplPath } from '../src/compile-mapl-antlr-to-pcode.mjs';

test('MAPL emits mapping metadata and p-code', () => {
  const compiled = compileMaplWithAntlr(`
map CustomerToAccount from Customer to Account;
  account.name := customer.name;
  account.code := upper(customer.code);
end;
`);
  const entry = compiled.programMap.entries[0];
  assert.equal(entry.id, 'CustomerToAccount');
  assert.equal(entry.sourceTypeId, 'Customer');
  assert.equal(entry.targetTypeId, 'Account');
  assert.deepEqual(entry.items.map(item => item.ops), [['SRC'], ['SRC', 'UPPER']]);
  assert.match(compiled.pcodeText, /OP_MAP SRC, "CustomerToAccount", mappedPayload/);
  assert.match(compiled.pcodeText, /MAP_RETURN mappedPayload/);
});

test('MAPL preserves quoted names and paths', () => {
  assert.equal(formatMaplName('Customer'), 'Customer');
  assert.equal(formatMaplName('mt940-to-camt'), "'mt940-to-camt'");
  assert.equal(formatMaplPath('target.Stmt.end'), "target.Stmt.'end'");
  assert.equal(formatMaplPath('source.block4.31C'), "source.block4.'31C'");
});

test('MAPL rejects malformed input', () => {
  assert.throws(() => compileMaplWithAntlr('map broken'), /\[MAPL\] Parse failed/);
});
