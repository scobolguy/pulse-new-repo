import assert from 'node:assert/strict';
import express from 'express';
import { registerDatabaseRoutes } from '../src/backend/databaseRoutes.mjs';
import { buildDeploymentBindingManifest } from '../src/backend/deploymentBindingManifest.mjs';

const manifest = buildDeploymentBindingManifest({
  databases: [
    {
      symbol: 'SqlLedger',
      databaseName: 'PulseSqlLedger',
      typeName: 'PaymentRecord',
      managerId: 'db-mssql',
      provider: 'mssql'
    }
  ]
});

const calls = [];
const databaseManagers = new Map([
  ['db-mssql', {
    provider: 'mssql',
    async createTable(schema) {
      calls.push({ operation: 'createTable', schema });
      return { ok: true, table: schema.table };
    },
    async insert(schema, record) {
      calls.push({ operation: 'insert', schema, record });
      return { ok: true, table: schema.table };
    },
    async createSchema(name) {
      calls.push({ operation: 'createSchema', name });
      return { schema: name };
    },
    async listSchemas() {
      return [{ schema_name: 'dbo' }];
    },
    async listTables() {
      return [{ TABLE_NAME: 'PulseSqlLedger', row_count: 2 }];
    }
  }]
]);

const app = express();
app.use(express.json());

registerDatabaseRoutes(app, {
  databaseManagers,
  resolveBinding: (symbol, kind) => {
    assert.equal(kind, 'database');
    const binding = manifest.bySymbol[String(symbol)];
    assert.ok(binding, `Missing logical binding for ${symbol}`);
    return binding;
  }
});

const server = app.listen(0, async () => {
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    let response = await fetch(`${base}/api/deployments/bindings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest })
    });
    assert.equal(response.status, 200);

    response = await fetch(`${base}/api/databases/SqlLedger/table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schema: {
          table: 'PulseSqlLedger',
          columns: {
            id: 'nvarchar(255)',
            payload: 'nvarchar(max)'
          }
        }
      })
    });
    assert.equal(response.status, 201);

    response = await fetch(`${base}/api/databases/SqlLedger/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schema: {
          table: 'PulseSqlLedger',
          columns: {
            id: 'nvarchar(255)',
            payload: 'nvarchar(max)'
          }
        },
        record: { id: 'txn-01', payload: '{\"status\":\"ok\"}' }
      })
    });
    assert.equal(response.status, 201);

    response = await fetch(`${base}/api/registry/databases`);
    assert.equal(response.status, 200);
    const registry = await response.json();
    assert.equal(registry.databases[0].tables[0].symbol, 'SqlLedger');
    assert.equal(registry.databases[0].tables[0].physicalName, 'PulseSqlLedger');

    response = await fetch(`${base}/api/databases/SqlLedger/schemas`);
    assert.equal(response.status, 200);
    const schemaInfo = await response.json();
    assert.equal(schemaInfo.binding.physicalName, 'PulseSqlLedger');
    assert.equal(schemaInfo.binding.managerId, 'db-mssql');

    assert.equal(calls.find(item => item.operation === 'createTable').schema.table, 'PulseSqlLedger');
    assert.equal(calls.find(item => item.operation === 'insert').record.id, 'txn-01');

    console.log('[database-binding-integration] PASS');
    server.close();
  } catch (error) {
    console.error(error);
    server.close();
    process.exitCode = 1;
  }
});
