import assert from 'node:assert/strict';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';

const source = [
  'QUEUE "metrics" -> "pulse.metrics" MANAGER "qm-rabbit" TYPE "integer";',
  'QUEUE "events" -> "pulse.events" MANAGER "qm-msmq" TYPE "integer";',
  'FILE "audit" -> "payments/audit.log" MANAGER "ffs-primary";',
  'DATABASE "ledger" -> "PaymentsLedger" MANAGER "db-primary";',
  'WORKFLOW "emit" BEGIN',
  'STEP "noop" WAIT 1;',
  'END;'
].join('\n');

const compiled = compileWorkflowDSLWithAntlr(source);
const bySymbol = compiled.bindings.bySymbol;

assert.deepEqual(bySymbol.metrics, {
  kind: 'queue',
  symbol: 'metrics',
  physicalName: 'pulse.metrics',
  managerId: 'qm-rabbit',
  provider: 'queue-manager',
  dataTypeIds: ['integer'],
  visibility: 'internal',
  systemId: null
});
assert.equal(bySymbol.events.managerId, 'qm-msmq');
assert.equal(bySymbol.audit.provider, 'ffs');
assert.equal(bySymbol.audit.managerId, 'ffs-primary');
assert.equal(bySymbol.ledger.provider, 'database');
assert.equal(bySymbol.ledger.managerId, 'db-primary');
assert.equal(compiled.pcodeText, undefined);

console.log('[deployment-binding-manifest] PASS: queue, FFS, and database bindings compile independently of pcode');
