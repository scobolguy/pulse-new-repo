import assert from 'node:assert/strict';
import { AccessDatabaseProvider, MssqlDatabaseProvider, MysqlDatabaseProvider, createDatabaseProvider } from '../src/backend/databaseProviders/index.mjs';

assert.ok(createDatabaseProvider('mssql') instanceof MssqlDatabaseProvider);
assert.ok(createDatabaseProvider('access') instanceof AccessDatabaseProvider);
assert.ok(createDatabaseProvider('mysql') instanceof MysqlDatabaseProvider);
assert.equal(new MssqlDatabaseProvider().provider, 'mssql');
assert.equal(new AccessDatabaseProvider().provider, 'access');
assert.equal(new MysqlDatabaseProvider().provider, 'mysql');
for (const Provider of [MssqlDatabaseProvider, AccessDatabaseProvider, MysqlDatabaseProvider]) {
	const provider = new Provider();
	assert.equal(typeof provider.createSchema, 'function');
	assert.equal(typeof provider.listSchemas, 'function');
	assert.equal(typeof provider.dropSchema, 'function');
}
assert.throws(() => createDatabaseProvider('oracle'), /Unsupported database provider/);

console.log('[database-provider-contract] PASS: MSSQL and Access share the API provider contract');