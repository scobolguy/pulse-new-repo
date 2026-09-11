import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';

const source = [
  'DEPLOYMENT "demo" PROJECT "payments" TARGETS ("magic-js-pmachine-01") BEGIN',
  '  SERVICE "mapper" FILE "programs/mapper.pas" QUEUE "swift.in" -> "pacs.out" TARGETS ("magic-js-pmachine-01") STARTUP true;',
  '  DAEMON "sweeper" FILE "daemons/sweeper.pas" QUEUE "timer.in" -> "timer.out" TARGETS ("magic-js-pmachine-01") STARTUP true;',
  'END;'
].join('\n');

const result = compileWorkflowDSLWithAntlr(source);
const resources = result.deployments?.[0]?.resources || [];
if (result.deployments.length !== 1 || resources.length !== 2) {
  throw new Error(`Unexpected deployment AST: ${JSON.stringify(result.deployments)}`);
}
if (resources.map((resource) => resource.kind).join(',') !== 'service,daemon') {
  throw new Error(`Unexpected resource kinds: ${resources.map((resource) => resource.kind).join(',')}`);
}
console.log(JSON.stringify({ status: 'ok', deploymentCount: result.deployments.length, resourceKinds: resources.map((resource) => resource.kind) }, null, 2));
