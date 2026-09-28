import assert from 'node:assert/strict';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { createDatabaseProvider } from '../src/backend/databaseProviders/index.mjs';

const source = [
  'DATABASE "SqlLedger" -> "PulseSqlLedger" TYPE "PaymentRecord" MANAGER "db-mssql";',
  'DATABASE "AuditLedger" -> "PulseAudit" TYPE "AuditTrail" MANAGER "db-mssql";'
].join('\n');

const compiled = compileWorkflowDSLWithAntlr(source);
assert.equal(compiled.bindings.bySymbol.SqlLedger.physicalName, 'PulseSqlLedger');
assert.equal(compiled.bindings.bySymbol.SqlLedger.managerId, 'db-mssql');
assert.equal(compiled.bindings.bySymbol.AuditLedger.physicalName, 'PulseAudit');

const connectionString = process.env.MSSQL_DATABASE_CONNECTION_STRING
  || 'Server=localhost;Database=PulseSqlLedger;Trusted_Connection=true;TrustServerCertificate=true;Encrypt=false;Connection Timeout=30;';

const databaseManagers = new Map([
  ['db-mssql', createDatabaseProvider('mssql', { connectionString })]
]);

const binding = compiled.bindings.bySymbol.SqlLedger;
const manager = databaseManagers.get(binding.managerId);
assert.ok(manager, 'db-mssql manager must exist');

console.log('[wfl-odbc-database-assignment] PASS');
console.log(JSON.stringify({
  logicalSymbol: binding.symbol,
  physicalName: binding.physicalName,
  managerId: binding.managerId,
  provider: manager.provider,
  connectionStringSource: process.env.MSSQL_DATABASE_CONNECTION_STRING ? 'environment' : 'default-template'
}, null, 2));
