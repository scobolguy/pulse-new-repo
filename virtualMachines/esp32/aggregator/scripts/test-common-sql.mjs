import assert from 'node:assert/strict';
import { parseCommonSql } from '../src/backend/commonSql.mjs';

assert.deepEqual(parseCommonSql('CREATE DATABASE PulseDB;'), { operation: 'createDatabase', database: 'PulseDB' });
assert.deepEqual(parseCommonSql('CREATE SCHEMA payments;'), { operation: 'createSchema', schemaName: 'payments' });
assert.equal(parseCommonSql('CREATE TABLE payments (id INT, amount DECIMAL(10,2));').operation, 'createTable');
assert.equal(parseCommonSql('CREATE INDEX ix_payments ON payments (id);').operation, 'createIndex');
assert.equal(parseCommonSql('SELECT id FROM payments WHERE id = 1').operation, 'query');
assert.throws(() => parseCommonSql('DROP TABLE payments'), /Supported common SQL/);
console.log('[common-sql] PASS: common database commands normalize before provider execution');