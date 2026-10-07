import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { flattenGenericSystems, flattenGenericSystemConnections } from '../src/backend/genericSystem.mjs';

const source = await fs.readFile(new URL('../../src/generic-system.wfl', import.meta.url), 'utf8');
const compiled = compileWorkflowDSLWithAntlr(source);
assert.equal(compiled.genericSystems.length, 1);
const root = compiled.genericSystems[0];
assert.deepEqual(flattenGenericSystems(root).map(system => system.systemPath.join('.')), [
  'payments',
  'payments.ingress',
  'payments.ledger',
  'payments.ledger.audit'
]);
assert.deepEqual(flattenGenericSystemConnections(root).map(connection => ({
  symbol: connection.symbol,
  source: connection.sourcePath,
  target: connection.targetPath,
  type: connection.dataTypeId
})), [
  {
    symbol: 'orders',
    source: 'payments.ingress.ordersOut',
    target: 'payments.ledger.ordersIn',
    type: 'PaymentRecord'
  },
  {
    symbol: 'auditEvents',
    source: 'payments.ledger.auditOut',
    target: 'payments.ledger.audit.eventsIn',
    type: 'AuditEvent'
  }
]);

assert.throws(() => compileWorkflowDSLWithAntlr([
  'GENERIC_SYSTEM "bad" BEGIN',
  '  GENERIC_SYSTEM "a" BEGIN PORT "out" OUTPUT TYPE "PaymentRecord"; END;',
  '  GENERIC_SYSTEM "b" BEGIN PORT "in" INPUT TYPE "AuditEvent"; END;',
  '  CONNECT QUEUE "badEdge" FROM "a.out" TO "b.in" TYPE "PaymentRecord";',
  'END;'
].join('\n')), /does not match its endpoints/);

console.log('[wfl-generic-system] PASS');
