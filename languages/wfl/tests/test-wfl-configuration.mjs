import assert from 'node:assert/strict';
import { compileWorkflowDSL } from '../src/compile-workflow-dsl.mjs';

const estate = `
DEFAULT ENVIRONMENT "dev";

LET region = "eu";
LET qmgr = "QM." & UPPER(ENVIRONMENT);
LET dbHost = ENV("PULSE_TEST_DB_HOST", "localhost");

IF ENVIRONMENT = "prod" THEN
  LET prefix = "PROD";
ELSIF ENVIRONMENT IN ("test", "uat") THEN
  LET prefix = "TEST";
ELSIF ENVIRONMENT LIKE "dev*" OR ENVIRONMENT STARTS WITH "local" THEN
  LET prefix = "DEV";
ELSE
  LET prefix = "SANDBOX";
ENDIF;

QUEUE "payments.in" -> "\${prefix}.\${region}.PAYMENTS.IN" MANAGER "\${qmgr}";
FILE "statements" -> "/data/\${ENVIRONMENT}/statements";
DATABASE "ledger" -> "ledger_\${prefix}" CONNECTION "Server=\${dbHost};Database=ledger";

IF NOT (ENVIRONMENT = "prod") AND region <> "us" THEN
  API "mock-bank" BASE "http://localhost:9000/\${ENVIRONMENT}";
ENDIF;

IF LOWER(prefix) MATCHES "^(dev|test)$" THEN
  IF region NOT IN ("us", "apac") THEN
    QUEUE "audit" -> "\${prefix}.AUDIT";
  ELSE
    QUEUE "audit" -> "AUDIT.DISABLED";
  ENDIF;
ENDIF;

WORKFLOW "payments" BEGIN
  STEP "route" ROUTE QUEUE "payments.in";
  STEP "mark" SET STATE "environment" = "\${ENVIRONMENT}";
END;
`;

function compile(options) {
  return compileWorkflowDSL(estate, { env: {}, ...options });
}

function queue(result, symbol) {
  return result.symbols.queues.find((item) => item.symbol === symbol);
}

// Without an external environment the file default applies.
{
  const result = compile({});
  assert.deepEqual(result.configuration, {
    environment: 'dev',
    environmentSource: 'file-default',
    variables: { region: 'eu', qmgr: 'QM.DEV', dbHost: 'localhost', prefix: 'DEV' }
  });
  assert.equal(queue(result, 'payments.in').queueName, 'DEV.eu.PAYMENTS.IN');
  assert.equal(queue(result, 'payments.in').managerId, 'QM.DEV');
  assert.equal(queue(result, 'audit').queueName, 'DEV.AUDIT');
  assert.equal(result.symbols.files[0].path, '/data/dev/statements');
  assert.equal(result.symbols.databases[0].databaseName, 'ledger_DEV');
  assert.equal(result.symbols.databases[0].connectionRef, 'Server=localhost;Database=ledger');
  assert.equal(result.symbols.apis[0].baseUrl, 'http://localhost:9000/dev');
  assert.equal(result.workflows[0].steps[1].value, 'dev');
}

// The same file moves to test by changing only the environment.
{
  const result = compile({ environment: 'uat', env: { PULSE_TEST_DB_HOST: 'db.test.internal' } });
  assert.equal(result.configuration.environmentSource, 'option');
  assert.equal(queue(result, 'payments.in').queueName, 'TEST.eu.PAYMENTS.IN');
  assert.equal(queue(result, 'payments.in').managerId, 'QM.UAT');
  assert.equal(result.symbols.databases[0].connectionRef, 'Server=db.test.internal;Database=ledger');
  assert.equal(queue(result, 'audit').queueName, 'TEST.AUDIT');
}

// Production drops the mock API and the audit queue; --define overrides a LET.
{
  const result = compile({ environment: 'prod', variables: { region: 'us' } });
  assert.equal(queue(result, 'payments.in').queueName, 'PROD.us.PAYMENTS.IN');
  assert.equal(result.symbols.apis.length, 0);
  assert.equal(queue(result, 'audit'), undefined);
  assert.equal(result.configuration.variables.region, 'us');
}

// ELSE branches and nested conditionals.
{
  const result = compile({ environment: 'local-dave', variables: { region: 'apac' } });
  assert.equal(queue(result, 'payments.in').queueName, 'DEV.apac.PAYMENTS.IN');
  assert.equal(queue(result, 'audit').queueName, 'AUDIT.DISABLED');
  assert.equal(queue(compile({ environment: 'perf' }), 'payments.in').queueName, 'SANDBOX.eu.PAYMENTS.IN');
}

// PULSE_ENVIRONMENT also overrides the file default, and systems use the same environment.
{
  const previous = process.env.PULSE_ENVIRONMENT;
  process.env.PULSE_ENVIRONMENT = 'test';
  try {
    const result = compileWorkflowDSL('DEFAULT ENVIRONMENT "dev";\nSYSTEM "pay" BEGIN QUEUE "in" -> "IN"; END;');
    assert.equal(result.configuration.environment, 'test');
    assert.equal(result.configuration.environmentSource, 'PULSE_ENVIRONMENT');
    assert.equal(result.symbols.queues[0].queueName, 'test.pay.IN');
  } finally {
    if (previous === undefined) delete process.env.PULSE_ENVIRONMENT;
    else process.env.PULSE_ENVIRONMENT = previous;
  }
}

// Comparison operators are ordinal and case-sensitive; ENDS WITH, CONTAINS and $\${ escaping.
{
  const result = compileWorkflowDSL(`
LET v = "Release-2";
IF v > "Release-10" AND v <= "Release-2" AND v ENDS WITH "-2" AND v CONTAINS "lease" AND v NOT CONTAINS "x" AND v <> "release-2" THEN
  QUEUE "ok" -> "$\${literal}";
ENDIF;
`, { env: {} });
  assert.equal(result.symbols.queues[0].queueName, '${literal}');
}

// Errors.
assert.throws(() => compileWorkflowDSL('QUEUE "a" -> "\${missing}";', { env: {} }), /Unknown WFL variable 'missing'/);
assert.throws(() => compileWorkflowDSL('LET x = ENV("PULSE_NOT_SET");', { env: {} }), /Environment variable 'PULSE_NOT_SET' is not set/);
assert.throws(() => compileWorkflowDSL('LET e = ENVIRONMENT;\nDEFAULT ENVIRONMENT "dev";', { env: {} }), /must appear before ENVIRONMENT is used/);
assert.throws(() => compileWorkflowDSL('IF "a" MATCHES "(" THEN ENDIF;', { env: {} }), /Invalid MATCHES pattern/);

console.log('WFL configuration tests passed');
