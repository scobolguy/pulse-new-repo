import assert from 'node:assert/strict';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { resolveDeploymentBinding, translateDeploymentSymbol } from '../src/backend/deploymentBindingManifest.mjs';

const compiled = compileWorkflowDSLWithAntlr([
  'QUEUE "orders" -> "rabbit.orders" MANAGER "qm-rabbit" TYPE "order";',
  'FILE "audit" -> "ffs/audit.log" MANAGER "ffs-primary";',
  'DATABASE "ledger" -> "PaymentsLedger" MANAGER "db-mssql";',
].join('\n'));

assert.deepEqual(translateDeploymentSymbol(compiled.bindings, 'orders', 'queue'), {
  logicalSymbol: 'orders',
  physicalName: 'rabbit.orders',
  managerId: 'qm-rabbit',
  provider: 'queue-manager',
  kind: 'queue'
});
assert.equal(resolveDeploymentBinding(compiled.bindings, 'audit', 'file').physicalName, 'ffs/audit.log');
assert.equal(resolveDeploymentBinding(compiled.bindings, 'ledger', 'database').managerId, 'db-mssql');
assert.throws(() => resolveDeploymentBinding(compiled.bindings, 'orders', 'database'), /expected database/);
assert.throws(() => resolveDeploymentBinding(compiled.bindings, 'missing'), /No deployment binding/);

console.log('[deployment-translation] PASS: compiler/WFL map translates logical resources without changing pcode');