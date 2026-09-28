import assert from 'node:assert/strict';
import { compileWorkflowDSL } from './compile-workflow-dsl.mjs';
import { queueConfigMapFromWorkflowSymbols } from '../src/backend/queueDslCompiler.mjs';

const source = [
  'SYSTEM TYPE "RtgsSystem" BEGIN',
  'QUEUE "creditIn" TYPE "pacs";',
  'END;',
  'SYSTEM "LYNX" OF TYPE "RtgsSystem" BEGIN',
  'QUEUE "creditIn" -> "credit.in" TYPE "pacs";',
  'QUEUE "creditOut" -> "credit.out" TYPE "pacs" VISIBILITY EXPOSED;',
  'SERVICE "gateway" -> "gateway" VISIBILITY EXPOSED;',
  'END;'
].join('\n');

const compiled = compileWorkflowDSL(source);
assert.equal(compiled.symbols.systems.length, 2);

const abstractSystem = compiled.symbols.systems.find(system => system.abstract);
assert.equal(abstractSystem.name, 'RtgsSystem');
assert.equal(abstractSystem.members[0].abstract, true);
assert.equal(abstractSystem.members[0].dataTypeId, 'pacs');

const concreteSystem = compiled.symbols.systems.find(system => !system.abstract);
assert.equal(concreteSystem.typeName, 'RtgsSystem');
assert.equal(compiled.symbols.queues.length, 2);
assert.equal(compiled.symbols.services.length, 1);
assert.equal(concreteSystem.members[0].queueName, 'default.LYNX.credit.in');
assert.equal(concreteSystem.members[0].visibility, 'internal');
assert.equal(concreteSystem.members[1].visibility, 'exposed');
assert.equal(concreteSystem.members[2].serviceId, 'gateway');

const queueConfigMap = queueConfigMapFromWorkflowSymbols(compiled.symbols);
assert.equal(queueConfigMap['default.LYNX.credit.in'].systemId, 'LYNX');
assert.equal(queueConfigMap['default.LYNX.credit.in'].visibility, 'internal');
assert.deepEqual(queueConfigMap['default.LYNX.credit.in'].dataTypeIds, ['pacs']);

assert.throws(
  () => compileWorkflowDSL([
    'SYSTEM TYPE "RtgsSystem" BEGIN',
    'QUEUE "required" TYPE "pacs";',
    'END;',
    'SYSTEM "FED" OF TYPE "RtgsSystem" BEGIN END;'
  ].join('\n')),
  /missing required member/
);

assert.throws(
  () => compileWorkflowDSL('SYSTEM "LYNX" OF TYPE "RtgsSystem", "SanctionsSystem" BEGIN END;'),
  /Parse failed|mismatched input|no viable alternative/
);

const nested = compileWorkflowDSL([
  'SYSTEM "paymentsCore" BEGIN',
  'SYSTEM "LYNX" OF TYPE "RtgsSystem" BEGIN',
  'QUEUE "creditOut" -> "credit.out" TYPE "pacs" VISIBILITY EXPOSED;',
  'END;',
  'END;'
].join('\n'));
assert.equal(nested.symbols.queues[0].queueName, 'default.paymentsCore.LYNX.credit.out');
assert.equal(nested.symbols.queues[0].systemId, 'paymentsCore.LYNX');

console.log('[wfl-system-scoping] PASS: systems emit scoped metadata and enforce single OF TYPE syntax');