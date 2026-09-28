import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { executeProgram, parsePcode } from './run-js-pmachine.mjs';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';
import QueueManager from '../src/broker/QueueManager.mjs';

const canonicalId = 'type:swift-mt103-v4';
const source = `
program typed_pmachine_proof;
begin
  enqueue typed_out with "MT103\\n:20:JS-PMACHINE-1";
end.
`;

const compiled = compilePascalishProgramWithAntlr(source);
const execution = await executeProgram({
  instructions: parsePcode(compiled.pcodeText),
  opcodeMap: await loadOpcodeMap(),
  inputQueue: 'typed.in',
  sourceMessage: 'MT103\\n:20:JS-PMACHINE-1'
});

assert.equal(execution.error, null);
assert.equal(execution.deliveries.length, 1);
assert.equal(execution.deliveries[0].queueName, 'typed.out');
assert.match(String(execution.deliveries[0].message), /JS-PMACHINE-1/);

const queueManager = new QueueManager('js-pmachine-canonical-proof');
queueManager.createQueue('typed.out', {
  dataTypeId: canonicalId,
  dataTypeIds: [canonicalId]
});
queueManager.enqueue(
  'typed.out',
  execution.deliveries[0].message,
  'js-pmachine',
  'js-pmachine-message-1',
  { dataTypeId: canonicalId }
);
const claim = queueManager.claim('typed.out', 'js-pmachine-worker');
assert.equal(claim.message.messageEnvelope.dataTypeId, canonicalId);
assert.match(String(claim.message.message), /JS-PMACHINE-1/);

console.log('[js-pmachine-canonical-types] PASS: PMachine execution delivers a typed message that claims with the canonical ID');
