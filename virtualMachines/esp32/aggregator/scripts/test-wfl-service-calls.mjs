import assert from 'node:assert/strict';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { executeWorkflow } from './interpret-workflow.mjs';

const source = [
  'WORKFLOW "service-call-test" BEGIN',
  'STEP "sync-call" CALL SERVICE "mt103-to-pacs008" "MT103\\n:20:WFL-SYNC-001\\n:23B:CRED\\n:32A:260907USD100,01";',
  'STEP "async-call" CALL SERVICE "mt103-to-pacs008" "MT103\\n:20:WFL-ASYNC-002\\n:23B:CRED\\n:32A:260907USD200,02" ASYNC;',
  'END;'
].join('\n');

const compiled = compileWorkflowDSLWithAntlr(source);
const workflow = compiled.workflows.find(item => item.id === 'service-call-test');
assert.ok(workflow, 'workflow should compile');
assert.equal(workflow.steps[0].action, 'call_service');
assert.equal(workflow.steps[0].asynchronous, false);
assert.equal(workflow.steps[1].action, 'call_service');
assert.equal(workflow.steps[1].asynchronous, true);

const dryRun = await executeWorkflow(compiled, 'service-call-test', true, {
  serviceBaseUrl: 'http://127.0.0.1:4000'
});
assert.equal(dryRun.results[0].action, 'call_service');
assert.equal(dryRun.results[0].asynchronous, false);
assert.equal(dryRun.results[1].action, 'call_service');
assert.equal(dryRun.results[1].asynchronous, true);

if (process.env.WFL_SERVICE_INTEGRATION === '1') {
  const executed = await executeWorkflow(compiled, 'service-call-test', false, {
    serviceBaseUrl: 'http://127.0.0.1:4000'
  });
  assert.equal(executed.results[0].state, 'completed');
  assert.equal(executed.results[1].state, 'queued');
  assert.match(executed.results[0].result?.value || '', /Document/);
}

console.log(process.env.WFL_SERVICE_INTEGRATION === '1'
  ? '[wfl-service-calls] PASS: sync and async service calls executed through central service interface'
  : '[wfl-service-calls] PASS: sync and async service calls compile and dry-run on JS runtime');