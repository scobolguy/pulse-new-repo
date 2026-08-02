import assert from 'node:assert/strict';
import { compileMaplWithAntlr } from './compile-mapl-antlr-to-pcode.mjs';

const source = `
map CustomerToAccount from Customer to Account;
  account.name := customer.name;
  account.code := upper(customer.code);
  account.country := customer.country default "UNKNOWN";
  if customer.active = true then
    account.status := customer.status;
  end;
  validate customer.id <> "";
end;
`;

const compiled = compileMaplWithAntlr(source);
const entry = compiled.programMap.entries[0];

assert.equal(entry.id, 'CustomerToAccount');
assert.equal(entry.sourceTypeId, 'Customer');
assert.equal(entry.targetTypeId, 'Account');
assert.equal(entry.items.length, 3);
assert.deepEqual(entry.items[0], {
  sourcePath: 'customer.name',
  targetPath: 'account.name',
  conversionRule: 'OUTPUT := SRC;'
});
assert.equal(entry.items[1].conversionRule, 'OUTPUT := upper(SRC);');
assert.match(compiled.pcodeText, /OP_MAP SRC, "CustomerToAccount", mappedPayload/);
assert.equal(compiled.programMap.compatibility[0].irOnly.length, 3);
assert.throws(() => compileMaplWithAntlr('map broken'), /\[MAPL\] Parse failed/);

console.log('[MAPL-TEST] Compiler and runtime artifact checks passed');