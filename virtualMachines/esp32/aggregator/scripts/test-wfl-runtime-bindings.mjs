import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { applySolutionDeliveries } from '../src/backend/solutionRuntimeBindings.mjs';

const source = fs.readFileSync(new URL('../../src/odbc-database-assignment.wfl', import.meta.url), 'utf8');
const manifest = compileWorkflowDSLWithAntlr(source).bindings;
assert.equal(manifest.bySymbol.SqlLedger.connectionRef, 'env:MSSQL_DATABASE_CONNECTION_STRING');
assert.equal(manifest.bySymbol.Orders.deliveryMode, 'sync');
assert.equal(manifest.bySymbol.Audit.deliveryMode, 'async');

const calls = [];
const databaseManager = {
  async insert(schema, row) { calls.push({ operation: 'insert', schema, row }); },
  async update(schema, row, where) { calls.push({ operation: 'update', schema, row, where }); },
  async delete(schema, where) { calls.push({ operation: 'delete', schema, where }); }
};
const queueManager = {
  async enqueue(queue, message) { calls.push({ operation: 'enqueue', queue, message }); return `message-${calls.length}`; }
};

const applied = await applySolutionDeliveries({
  bindingManifest: manifest,
  databaseManagers: new Map([['db-mssql', databaseManager]]),
  queueManagers: new Map([['qm-primary', queueManager]]),
  databaseSchemas: { SqlLedger: { table: 'PulseSqlLedger', columns: { id: 'nvarchar(32)', status: 'nvarchar(32)' } } },
  deliveries: [
    { queueName: 'db.SqlLedger.dml', message: JSON.stringify({ operation: 'insert', database: 'SqlLedger', row: { id: '1', status: 'new' } }) },
    { queueName: 'db.SqlLedger.dml', message: JSON.stringify({ operation: 'update', database: 'SqlLedger', row: { status: 'posted' }, where: { column: 'id', op: '=', value: '1' } }) },
    { queueName: 'db.SqlLedger.dml', message: JSON.stringify({ operation: 'delete', database: 'SqlLedger', where: { column: 'id', op: '=', value: '1' } }) },
    { queueName: 'Orders', message: 'confirmed', deliveryMode: 'sync' },
    { queueName: 'Audit', message: 'recorded', deliveryMode: 'async' }
  ]
});

assert.deepEqual(calls.map(call => call.operation), ['insert', 'update', 'delete', 'enqueue', 'enqueue']);
assert.equal(calls[3].queue, 'payments.orders');
assert.equal(calls[4].queue, 'payments.audit');
assert.deepEqual(applied.filter(item => item.kind === 'queue').map(item => item.deliveryMode), ['sync', 'async']);
assert.deepEqual(applied.filter(item => item.kind === 'database').map(item => item.operation), ['insert', 'update', 'delete']);
console.log('[wfl-runtime-bindings] PASS: ODBC reference, DML dispatch, and queue delivery modes');
