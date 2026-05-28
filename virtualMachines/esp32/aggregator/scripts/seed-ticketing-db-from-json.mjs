import fs from 'fs/promises';
import path from 'path';
import sql from 'mssql';

function parseArgs(argv) {
  const args = {
    jsonPath: './data/issue-test-system.json',
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
    if (token === '--json') args.jsonPath = argv[i + 1];
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

function buildConfig(args) {
  return {
    user: String(args.user || '').trim() || undefined,
    password: String(args.password || '').trim() || undefined,
    server: String(args.server || '').trim(),
    database: String(args.database || '').trim(),
    options: {
      encrypt: Boolean(args.encrypt),
      trustServerCertificate: Boolean(args.trustServerCertificate),
      instanceName: String(args.instance || '').trim() || undefined
    }
  };
}

function safeSchema(schema) {
  return String(schema || '').replace(/]/g, ']]');
}

async function upsertSequence(pool, schema, entity, value) {
  await pool.request()
    .input('entity', sql.NVarChar(64), entity)
    .input('nextValue', sql.Int, Number(value) || 0)
    .query(`
MERGE [${schema}].[sequences] AS target
USING (SELECT @entity AS entity, @nextValue AS next_value) AS source
ON target.entity = source.entity
WHEN MATCHED THEN UPDATE SET next_value = source.next_value, updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (entity, next_value) VALUES (source.entity, source.next_value);
`);
}

async function upsertCollection(pool, schema, tableName, items) {
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || '').trim();
    if (!id) continue;
    await pool.request()
      .input('id', sql.NVarChar(64), id)
      .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(item))
      .query(`
MERGE [${schema}].[${tableName}] AS target
USING (SELECT @id AS id, @payload AS payload) AS source
ON target.id = source.id
WHEN MATCHED THEN UPDATE SET payload = source.payload, updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (id, payload) VALUES (source.id, source.payload);
`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const schema = safeSchema(args.schema);
  const jsonPath = path.resolve(args.jsonPath);
  const raw = await fs.readFile(jsonPath, 'utf-8');
  const payload = JSON.parse(raw);

  const pool = await sql.connect(buildConfig(args));
  try {
    const sequences = payload?.sequences && typeof payload.sequences === 'object' ? payload.sequences : {};

    await upsertSequence(pool, schema, 'issue', sequences.issue);
    await upsertSequence(pool, schema, 'testCase', sequences.testCase);
    await upsertSequence(pool, schema, 'testPlan', sequences.testPlan);
    await upsertSequence(pool, schema, 'project', sequences.project);
    await upsertSequence(pool, schema, 'release', sequences.release);
    await upsertSequence(pool, schema, 'deploymentArtifact', sequences.deploymentArtifact);
    await upsertSequence(pool, schema, 'projectPlan', sequences.projectPlan);
    await upsertSequence(pool, schema, 'milestone', sequences.milestone);
    await upsertSequence(pool, schema, 'task', sequences.task);
    await upsertSequence(pool, schema, 'synchpoint', sequences.synchpoint);
    await upsertSequence(pool, schema, 'deliverable', sequences.deliverable);
    await upsertSequence(pool, schema, 'resource', sequences.resource);

    await upsertCollection(pool, schema, 'issues', payload.issues);
    await upsertCollection(pool, schema, 'test_cases', payload.testCases);
    await upsertCollection(pool, schema, 'test_plans', payload.testPlans);
    await upsertCollection(pool, schema, 'projects', payload.projects);
    await upsertCollection(pool, schema, 'releases', payload.releases);
    await upsertCollection(pool, schema, 'deployment_artifacts', payload.deploymentArtifacts);
    await upsertCollection(pool, schema, 'project_plans', payload.projectPlans);
    await upsertCollection(pool, schema, 'milestones', payload.milestones);
    await upsertCollection(pool, schema, 'tasks', payload.tasks);
    await upsertCollection(pool, schema, 'synchpoints', payload.synchpoints);
    await upsertCollection(pool, schema, 'deliverables', payload.deliverables);
    await upsertCollection(pool, schema, 'resources', payload.resources);
  } finally {
    await pool.close();
  }

  console.log(`[TICKETING-DB] Seeded from ${jsonPath} into ${args.database}.${args.schema}`);
}

main().catch((error) => {
  console.error('[TICKETING-DB] Seed failed:', error.message || error);
  process.exitCode = 1;
});
