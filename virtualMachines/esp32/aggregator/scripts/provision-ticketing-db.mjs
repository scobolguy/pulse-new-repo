import sql from 'mssql';

function parseArgs(argv) {
  const args = {
    server: process.env.TICKETING_DB_SERVER || process.env.GROUP_MSSQL_SERVER || 'localhost',
    instance: process.env.TICKETING_DB_INSTANCE || process.env.GROUP_MSSQL_INSTANCE || 'SQLEXPRESS',
    user: process.env.TICKETING_DB_USER || process.env.GROUP_MSSQL_USER || '',
    password: process.env.TICKETING_DB_PASSWORD || process.env.GROUP_MSSQL_PASSWORD || '',
    database: process.env.TICKETING_DB_NAME || 'PulseGovernance',
    schema: process.env.TICKETING_DB_SCHEMA || 'ticketing',
    encrypt: String(process.env.TICKETING_DB_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: String(process.env.TICKETING_DB_TRUST_CERT || 'true').toLowerCase() !== 'false'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--server') args.server = argv[i + 1];
    if (token === '--instance') args.instance = argv[i + 1];
    if (token === '--user') args.user = argv[i + 1];
    if (token === '--password') args.password = argv[i + 1];
    if (token === '--database') args.database = argv[i + 1];
    if (token === '--schema') args.schema = argv[i + 1];
    if (token === '--encrypt') args.encrypt = String(argv[i + 1]).toLowerCase() === 'true';
    if (token === '--trust-server-certificate') args.trustServerCertificate = String(argv[i + 1]).toLowerCase() === 'true';
  }

  return args;
}

function buildConfig(args, databaseName) {
  const server = String(args.server || '').trim();
  const instanceName = String(args.instance || '').trim();
  return {
    user: String(args.user || '').trim() || undefined,
    password: String(args.password || '').trim() || undefined,
    server,
    database: databaseName,
    options: {
      encrypt: Boolean(args.encrypt),
      trustServerCertificate: Boolean(args.trustServerCertificate),
      instanceName: instanceName || undefined
    }
  };
}

async function ensureDatabase(pool, databaseName) {
  const safeDatabase = String(databaseName || '').replace(/]/g, ']]');
  await pool.request().query(`
IF DB_ID(N'${safeDatabase}') IS NULL
BEGIN
  DECLARE @sql NVARCHAR(MAX) = N'CREATE DATABASE [${safeDatabase}]';
  EXEC(@sql);
END
`);
}

async function ensureSchemaAndTables(pool, schemaName) {
  const safeSchema = String(schemaName || '').replace(/]/g, ']]');

  await pool.request().query(`
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'${safeSchema}')
BEGIN
  EXEC(N'CREATE SCHEMA [${safeSchema}] AUTHORIZATION [dbo]');
END
`);

  const ddl = `
IF OBJECT_ID(N'[${safeSchema}].[sequences]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[sequences] (
    entity NVARCHAR(64) NOT NULL PRIMARY KEY,
    next_value INT NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_sequences_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[issues]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[issues] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_issues_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[test_cases]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[test_cases] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_test_cases_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[test_plans]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[test_plans] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_test_plans_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[projects]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[projects] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_projects_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[releases]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[releases] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_releases_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[deployment_artifacts]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[deployment_artifacts] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_deployment_artifacts_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[project_plans]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[project_plans] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_project_plans_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[milestones]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[milestones] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_milestones_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[tasks]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[tasks] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_tasks_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[synchpoints]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[synchpoints] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_synchpoints_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[deliverables]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[deliverables] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_deliverables_updated_at DEFAULT SYSUTCDATETIME()
  );
END

IF OBJECT_ID(N'[${safeSchema}].[resources]', N'U') IS NULL
BEGIN
  CREATE TABLE [${safeSchema}].[resources] (
    id NVARCHAR(32) NOT NULL PRIMARY KEY,
    payload NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_${safeSchema}_resources_updated_at DEFAULT SYSUTCDATETIME()
  );
END
`;

  await pool.request().query(ddl);

  const entities = [
    'issue',
    'testCase',
    'testPlan',
    'project',
    'release',
    'deploymentArtifact',
    'projectPlan',
    'milestone',
    'task',
    'synchpoint',
    'deliverable',
    'resource'
  ];

  for (const entity of entities) {
    await pool.request()
      .input('entity', sql.NVarChar(64), entity)
      .query(`
IF NOT EXISTS (SELECT 1 FROM [${safeSchema}].[sequences] WHERE entity = @entity)
BEGIN
  INSERT INTO [${safeSchema}].[sequences] (entity, next_value) VALUES (@entity, 0);
END
`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const masterPool = await sql.connect(buildConfig(args, 'master'));
  try {
    await ensureDatabase(masterPool, args.database);
  } finally {
    await masterPool.close();
  }

  const dbPool = await sql.connect(buildConfig(args, args.database));
  try {
    await ensureSchemaAndTables(dbPool, args.schema);
  } finally {
    await dbPool.close();
  }

  console.log(`[TICKETING-DB] Ready database=${args.database} schema=${args.schema}`);
}

main().catch((error) => {
  console.error('[TICKETING-DB] Failed:', error.message || error);
  process.exitCode = 1;
});
