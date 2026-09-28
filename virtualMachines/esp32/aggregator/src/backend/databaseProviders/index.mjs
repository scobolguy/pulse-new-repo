import { spawn } from 'node:child_process';

function quoteIdentifier(value) {
  const name = String(value || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Unsafe database identifier: ${name}`);
  return name;
}

function normalizeSchema(schema = {}) {
  const table = quoteIdentifier(schema.table || schema.tableName);
  const columns = Object.entries(schema.columns || {}).map(([name, type]) => ({
    name: quoteIdentifier(name),
    type: String(type || 'nvarchar(255)').trim()
  }));
  if (!columns.length) throw new Error('schema.columns must contain at least one column');
  return { table, columns };
}

function normalizeWhere(where) {
  if (!where?.column) throw new Error('A WHERE predicate is required for update and delete');
  const operators = new Map([['=', '='], ['<>', '<>'], ['!=', '<>'], ['<', '<'], ['<=', '<='], ['>', '>'], ['>=', '>=']]);
  const operator = operators.get(String(where.op || '=').trim());
  if (!operator) throw new Error(`Unsupported WHERE operator: ${where.op}`);
  return { column: quoteIdentifier(where.column), operator, value: where.value };
}

export class MssqlDatabaseProvider {
  constructor(options = {}) { this.provider = 'mssql'; this.options = options; this.sql = null; this.pool = null; }
  async connect() {
    if (this.pool) return this.pool;
    const driver = String(this.options.driver || process.env.MSSQL_DRIVER || '').trim().toLowerCase();
    const module = driver === 'msnodesqlv8' ? await import('mssql/msnodesqlv8.js') : await import('mssql');
    this.sql = module.default || module;
    const connectionString = this.options.connectionString
      || process.env.MSSQL_DATABASE_CONNECTION_STRING
      || process.env.FSM_MSSQL_CONNECTION_STRING
      || process.env.GROUP_MSSQL_CONNECTION_STRING
      || '';
    const config = driver === 'msnodesqlv8'
      ? { connectionString, driver: 'msnodesqlv8' }
      : (connectionString || this.options);
    this.pool = await this.sql.connect(config);
    return this.pool;
  }
  async createTable(schema) {
    const normalized = normalizeSchema(schema);
    const pool = await this.connect();
    const columns = normalized.columns.map(column => `[${column.name}] ${column.type}`).join(', ');
    await pool.request().query(`IF OBJECT_ID(N'[${normalized.table}]', N'U') IS NULL CREATE TABLE [${normalized.table}] (${columns})`);
    return { ...normalized, provider: this.provider };
  }
  async createSchema(schemaName) {
    const name = quoteIdentifier(schemaName);
    const pool = await this.connect();
    await pool.request().query(`IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'${name}') EXEC('CREATE SCHEMA [${name}]')`);
    return { provider: this.provider, schema: name };
  }
  async listSchemas() {
    return this.query("SELECT name AS schema_name FROM sys.schemas WHERE name NOT IN ('dbo', 'guest', 'INFORMATION_SCHEMA', 'sys') ORDER BY name");
  }
  async dropSchema(schemaName) {
    const name = quoteIdentifier(schemaName);
    const pool = await this.connect();
    await pool.request().query(`IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'${name}') DROP SCHEMA [${name}]`);
    return { provider: this.provider, schema: name, dropped: true };
  }
  async createDatabase(databaseName) {
    const name = quoteIdentifier(databaseName);
    const pool = await this.connect();
    await pool.request().query(`IF DB_ID(N'${name}') IS NULL CREATE DATABASE [${name}]`);
    return { provider: this.provider, database: name };
  }
  async createIndex(index) {
    const name = quoteIdentifier(index.name);
    const table = quoteIdentifier(index.table);
    const columns = (index.columns || []).map(quoteIdentifier).join(', ');
    if (!columns) throw new Error('index.columns must contain at least one column');
    const pool = await this.connect();
    await pool.request().query(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'${name}') CREATE INDEX [${name}] ON [${table}] (${columns})`);
    return { provider: this.provider, index: name, table, columns: index.columns };
  }
  async query(sql, parameters = []) {
    const pool = await this.connect();
    const request = pool.request();
    parameters.forEach((value, index) => request.input(`p${index}`, value));
    const result = await request.query(String(sql));
    return result.recordset || [];
  }
  async listTables() {
    const tables = await this.query("SELECT TABLE_NAME AS table_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
    return Promise.all(tables.map(async table => {
      const name = quoteIdentifier(table.table_name);
      const rows = await this.query(`SELECT COUNT(*) AS row_count FROM [${name}]`);
      return { ...table, row_count: Number(rows[0]?.row_count || 0) };
    }));
  }
  async insert(schema, record) {
    const normalized = normalizeSchema(schema);
    const pool = await this.connect();
    const request = pool.request();
    const names = normalized.columns.map(column => column.name);
    const params = names.map((name, index) => { const parameterName = `solutionParam${index}`; request.input(parameterName, record?.[name]); return `@${parameterName}`; });
    await request.query(`INSERT INTO [${normalized.table}] (${names.map(name => `[${name}]`).join(', ')}) VALUES (${params.join(', ')})`);
    return { provider: this.provider, table: normalized.table, columns: names };
  }
  async update(schema, record, where) {
    const normalized = normalizeSchema(schema);
    const predicate = normalizeWhere(where);
    const names = Object.keys(record || {}).map(quoteIdentifier);
    if (!names.length) throw new Error('update record must contain at least one column');
    const request = (await this.connect()).request();
    names.forEach((name, index) => request.input(`set${index}`, record[name]));
    request.input('whereValue', predicate.value);
    await request.query(`UPDATE [${normalized.table}] SET ${names.map((name, index) => `[${name}] = @set${index}`).join(', ')} WHERE [${predicate.column}] ${predicate.operator} @whereValue`);
    return { provider: this.provider, table: normalized.table, columns: names };
  }
  async delete(schema, where) {
    const normalized = normalizeSchema(schema);
    const predicate = normalizeWhere(where);
    const request = (await this.connect()).request();
    request.input('whereValue', predicate.value);
    await request.query(`DELETE FROM [${normalized.table}] WHERE [${predicate.column}] ${predicate.operator} @whereValue`);
    return { provider: this.provider, table: normalized.table };
  }
  async close() { await this.pool?.close?.(); this.pool = null; }
}

export class AccessDatabaseProvider {
  constructor(options = {}) { this.provider = 'access'; this.options = options; }
  async run(sql, parameters = []) {
    const connection = String(this.options.connectionString || '').replace(/'/g, "''");
    const encoded = Buffer.from(JSON.stringify({ sql, parameters }), 'utf8').toString('base64');
    const script = `$payload=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); $x=ConvertFrom-Json $payload; $c=New-Object System.Data.OleDb.OleDbConnection('${connection}'); $c.Open(); $cmd=$c.CreateCommand(); $cmd.CommandText=$x.sql; foreach($p in $x.parameters){$param=$cmd.Parameters.AddWithValue('', $p);}; $null=$cmd.ExecuteNonQuery(); $c.Close()`;
    await new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
      let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk.toString(); }); child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr || `PowerShell exited with ${code}`)));
    });
  }
  async createTable(schema) {
    const normalized = normalizeSchema(schema);
    await this.run(`CREATE TABLE [${normalized.table}] (${normalized.columns.map(column => `[${column.name}] ${column.type}`).join(', ')})`);
    return { ...normalized, provider: this.provider };
  }
  async createDatabase(databaseName) {
    throw new Error(`Access creates database files outside SQL; provision '${databaseName}' through the FFS/deployment layer`);
  }
  async createSchema() { throw new Error('Access does not support database schemas'); }
  async listSchemas() { throw new Error('Access does not support database schemas'); }
  async dropSchema() { throw new Error('Access does not support database schemas'); }
  async createIndex(index) {
    const name = quoteIdentifier(index.name);
    const table = quoteIdentifier(index.table);
    const columns = (index.columns || []).map(quoteIdentifier).join(', ');
    if (!columns) throw new Error('index.columns must contain at least one column');
    await this.run(`CREATE INDEX [${name}] ON [${table}] (${columns})`);
    return { provider: this.provider, index: name, table, columns: index.columns };
  }
  async query() {
    throw new Error('Access query results are not available through the current PowerShell adapter');
  }
  async listTables() { return []; }
  async insert(schema, record) {
    const normalized = normalizeSchema(schema);
    const names = normalized.columns.map(column => column.name);
    await this.run(`INSERT INTO [${normalized.table}] (${names.map(name => `[${name}]`).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`, names.map(name => record?.[name] ?? null));
    return { provider: this.provider, table: normalized.table, columns: names };
  }
  async update(schema, record, where) {
    const normalized = normalizeSchema(schema);
    const predicate = normalizeWhere(where);
    const names = Object.keys(record || {}).map(quoteIdentifier);
    if (!names.length) throw new Error('update record must contain at least one column');
    await this.run(`UPDATE [${normalized.table}] SET ${names.map(name => `[${name}] = ?`).join(', ')} WHERE [${predicate.column}] ${predicate.operator} ?`, [...names.map(name => record[name]), predicate.value]);
    return { provider: this.provider, table: normalized.table, columns: names };
  }
  async delete(schema, where) {
    const normalized = normalizeSchema(schema);
    const predicate = normalizeWhere(where);
    await this.run(`DELETE FROM [${normalized.table}] WHERE [${predicate.column}] ${predicate.operator} ?`, [predicate.value]);
    return { provider: this.provider, table: normalized.table };
  }
  async close() {}
}

export class MysqlDatabaseProvider {
  constructor(options = {}) { this.provider = 'mysql'; this.options = options; this.pool = null; }
  async connect() {
    if (this.pool) return this.pool;
    const module = await import('mysql2/promise');
    const mysql = module.default || module;
    this.pool = mysql.createPool(this.options.connectionString || this.options.uri || this.options);
    return this.pool;
  }
  async createDatabase(databaseName) {
    const name = quoteIdentifier(databaseName);
    const pool = await this.connect();
    await pool.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``);
    return { provider: this.provider, database: name };
  }
  async createSchema(schemaName) { return this.createDatabase(schemaName); }
  async listSchemas() {
    const pool = await this.connect();
    const [rows] = await pool.query("SELECT SCHEMA_NAME AS schema_name FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY SCHEMA_NAME");
    return rows;
  }
  async dropSchema(schemaName) {
    const name = quoteIdentifier(schemaName);
    const pool = await this.connect();
    await pool.query(`DROP DATABASE IF EXISTS \`${name}\``);
    return { provider: this.provider, schema: name, dropped: true };
  }
  async createTable(schema) {
    const normalized = normalizeSchema(schema);
    const pool = await this.connect();
    const columns = normalized.columns.map(column => `\`${column.name}\` ${column.type}`).join(', ');
    await pool.query(`CREATE TABLE IF NOT EXISTS \`${normalized.table}\` (${columns})`);
    return { ...normalized, provider: this.provider };
  }
  async createIndex(index) {
    const name = quoteIdentifier(index.name);
    const table = quoteIdentifier(index.table);
    const columns = (index.columns || []).map(quoteIdentifier).map(column => `\`${column}\``).join(', ');
    if (!columns) throw new Error('index.columns must contain at least one column');
    const pool = await this.connect();
    await pool.query(`CREATE INDEX \`${name}\` ON \`${table}\` (${columns})`);
    return { provider: this.provider, index: name, table, columns: index.columns };
  }
  async query(sql, parameters = []) {
    const pool = await this.connect();
    const [rows] = await pool.query(String(sql), parameters);
    return rows;
  }
  async listTables() {
    const pool = await this.connect();
    const [tables] = await pool.query("SELECT TABLE_NAME AS table_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
    return Promise.all(tables.map(async table => {
      const name = quoteIdentifier(table.table_name);
      const [rows] = await pool.query(`SELECT COUNT(*) AS row_count FROM \`${name}\``);
      return { ...table, row_count: Number(rows[0]?.row_count || 0) };
    }));
  }
  async insert(schema, record) {
    const normalized = normalizeSchema(schema);
    const names = normalized.columns.map(column => column.name);
    const pool = await this.connect();
    await pool.query(`INSERT INTO \`${normalized.table}\` (${names.map(name => `\`${name}\``).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`, names.map(name => record?.[name] ?? null));
    return { provider: this.provider, table: normalized.table, columns: names };
  }
  async update(schema, record, where) {
    const normalized = normalizeSchema(schema);
    const predicate = normalizeWhere(where);
    const names = Object.keys(record || {}).map(quoteIdentifier);
    if (!names.length) throw new Error('update record must contain at least one column');
    const pool = await this.connect();
    await pool.query(`UPDATE \`${normalized.table}\` SET ${names.map(name => `\`${name}\` = ?`).join(', ')} WHERE \`${predicate.column}\` ${predicate.operator} ?`, [...names.map(name => record[name]), predicate.value]);
    return { provider: this.provider, table: normalized.table, columns: names };
  }
  async delete(schema, where) {
    const normalized = normalizeSchema(schema);
    const predicate = normalizeWhere(where);
    const pool = await this.connect();
    await pool.query(`DELETE FROM \`${normalized.table}\` WHERE \`${predicate.column}\` ${predicate.operator} ?`, [predicate.value]);
    return { provider: this.provider, table: normalized.table };
  }
  async close() { await this.pool?.end?.(); this.pool = null; }
}

export function createDatabaseProvider(provider, options = {}) {
  const normalized = String(provider || '').trim().toLowerCase();
  if (normalized === 'mssql') return new MssqlDatabaseProvider(options);
  if (normalized === 'access' || normalized === 'msaccess') return new AccessDatabaseProvider(options);
  if (normalized === 'mysql') return new MysqlDatabaseProvider(options);
  throw new Error(`Unsupported database provider: ${provider}`);
}