import assert from 'node:assert/strict';
import { compilePascalishWithAntlr } from './pascalish-antlr-compiler.mjs';

function getRouterByServiceId(compiled, serviceId) {
  return (compiled?.routerRules || []).find(
    (router) => String(router?.serviceId || '') === String(serviceId || '')
  );
}

async function main() {
  const source = [
    'SERVICE "mt103-pacs-endpoint" ON LOCAL;',
    'POST "/messages/mt103" ACCEPTS "swift-mt103" RETURNS "pacs.008";',
    'BEGIN',
    '  TRANSACTION "txn.mt103.to.pacs" BEGIN',
    '    RETURN map("mt103-to-pacs", src);',
    '  SUCCESS BEGIN',
    '    RETURN "ok";',
    '  END;',
    '  BACKOUT BEGIN',
    '    RETURN "failed";',
    '  END;',
    '  END;',
    'END;',
    'GET "/health" RETURNS "text/plain";',
    'BEGIN',
    '  RETURN "alive";',
    'END;',
    'END;'
  ].join('\n');

  const compiled = compilePascalishWithAntlr(source);
  assert.equal(compiled.serviceId, 'mt103-pacs-endpoint', 'service id should be parsed');

  const router = getRouterByServiceId(compiled, 'mt103-pacs-endpoint');
  assert.ok(router, 'synthetic router should be produced for endpoint service');

  assert.deepEqual(router.methods, ['POST', 'GET'], 'endpoint HTTP methods should be collected');

  const postOutput = (router.outputs || []).find((o) => o.httpVerb === 'POST');
  assert.ok(postOutput, 'POST endpoint output should exist');
  assert.equal(
    postOutput.transformRule,
    'output := map ("mt103-to-pacs", src);',
    'transaction endpoint should lower its transaction return expression'
  );

  const getOutput = (router.outputs || []).find((o) => o.httpVerb === 'GET');
  assert.ok(getOutput, 'GET endpoint output should exist');
  assert.equal(getOutput.transformRule, 'output := "alive";', 'GET endpoint return should lower to transform rule');

  console.log('[pascalish-endpoint-bnf] PASS: endpoint and transaction syntax compiles');
}

main().catch((error) => {
  console.error('[pascalish-endpoint-bnf] FAIL:', error.message);
  process.exitCode = 1;
});
