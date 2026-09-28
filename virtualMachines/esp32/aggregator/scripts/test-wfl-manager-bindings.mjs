import assert from 'node:assert/strict';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { queueConfigMapFromWorkflowSymbols } from '../src/backend/queueDslCompiler.mjs';

const source = [
  'QUEUE "in" -> "swift.in" MANAGER "qm-secondary" TYPE "text";',
  'DATABASE "ledger" -> "payments" MANAGER "db-mssql-default";',
  'SYSTEM "app" BEGIN',
  'QUEUE "out" -> "swift.out" MANAGER "qm-primary" TYPE "text";',
  'END;'
].join('\n');

const compiled = compileWorkflowDSLWithAntlr(source);
assert.equal(compiled.symbols.queues[0].managerId, 'qm-secondary');
assert.equal(compiled.symbols.databases[0].managerId, 'db-mssql-default');
assert.equal(compiled.symbols.systems[0].members[0].managerId, 'qm-primary');

const queueConfig = queueConfigMapFromWorkflowSymbols(compiled.symbols);
assert.equal(queueConfig['swift.in'].managerId, 'qm-secondary');
assert.equal(queueConfig['default.app.swift.out'].managerId, 'qm-primary');

console.log('[wfl-manager-bindings] PASS: queue and database manager selection remains metadata-only');
