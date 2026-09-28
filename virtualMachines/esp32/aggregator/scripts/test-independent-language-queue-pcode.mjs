import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { compileCobolishToPmachine, compileVbishToPmachine } from './compile-interoperable-language.mjs';
import { executeProgram, parsePcode } from './run-js-pmachine.mjs';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';

const programs = [
  {
    language: 'pascalish',
    artifact: compilePascalishProgramWithAntlr([
      'program QueueWriter;',
      'begin',
      "  QueueWriteSync(Orders, 'confirmed');",
      "  QueueWriteAsync(Audit, 'recorded')",
      'end.'
    ].join('\n'))
  },
  {
    language: 'cobolish',
    artifact: compileCobolishToPmachine([
      'IDENTIFICATION DIVISION.',
      'PROGRAM-ID. QUEUEWRITER.',
      'PROCEDURE DIVISION.',
      'CALL "QUEUE-WRITE-SYNC" USING Orders "confirmed".',
      'CALL "QUEUE-WRITE-ASYNC" USING Audit "recorded".',
      'STOP RUN.'
    ].join('\n'))
  },
  {
    language: 'vbish',
    artifact: compileVbishToPmachine([
      'Program "QueueWriter"',
      'Sub Main()',
      '  QueueWriteSync(Orders, "confirmed")',
      '  QueueWriteAsync(Audit, "recorded")',
      'End Sub'
    ].join('\n'))
  }
];

const opcodeMap = await loadOpcodeMap();
for (const { language, artifact } of programs) {
  assert.match(artifact.pcodeText, /^QUEUE_WRITE_SYNC "Orders"$/m, `${language} sync opcode missing`);
  assert.match(artifact.pcodeText, /^QUEUE_WRITE_ASYNC "Audit"$/m, `${language} async opcode missing`);
  const result = await executeProgram({ instructions: parsePcode(artifact.pcodeText), opcodeMap });
  assert.deepEqual(result.deliveries.map(item => ({ queueName: item.queueName, message: item.message, deliveryMode: item.deliveryMode })), [
    { queueName: 'Orders', message: 'confirmed', deliveryMode: 'sync' },
    { queueName: 'Audit', message: 'recorded', deliveryMode: 'async' }
  ]);
}

console.log('[independent-language-queue-pcode] PASS: all languages execute sync and async queue writes on JavaScript PMachine');
