import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { compileCobolishToPmachine, compileVbishToPmachine } from './compile-interoperable-language.mjs';
import { executeProgram, parsePcode } from './run-js-pmachine.mjs';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';

const pascalish = [
  'database Ledger type PaymentRecord;',
  'program PascalDml;',
  'var id: string;',
  'var status: string;',
  'begin',
  "  id := '1';",
  "  status := 'new';",
  "  DbInsert(Ledger, 'Records', 'id,status', id, status);",
  "  DbSelect(Ledger, 'Records', 'id,status', 'id', '=', id, id, status);",
  "  DbUpdate(Ledger, 'Records', 'status', 'id', '=', id, status);",
  "  DbDelete(Ledger, 'Records', 'id', '=', id)",
  'end.'
].join('\n');

const cobolish = [
  'IDENTIFICATION DIVISION.',
  'PROGRAM-ID. COBDML.',
  'DATABASE Ledger TYPE PaymentRecord.',
  'DATA DIVISION.',
  'WORKING-STORAGE SECTION.',
  '01 RECORD-ID PIC X(10).',
  '01 RECORD-STATUS PIC X(10).',
  'PROCEDURE DIVISION.',
  'MOVE "1" TO RECORD-ID.',
  'MOVE "new" TO RECORD-STATUS.',
  'CALL "DB-INSERT" USING Ledger "Records" "id,status" RECORD-ID RECORD-STATUS.',
  'CALL "DB-SELECT" USING Ledger "Records" "id,status" "id" "=" RECORD-ID RECORD-ID RECORD-STATUS.',
  'CALL "DB-UPDATE" USING Ledger "Records" "status" "id" "=" RECORD-ID RECORD-STATUS.',
  'CALL "DB-DELETE" USING Ledger "Records" "id" "=" RECORD-ID.',
  'STOP RUN.'
].join('\n');

const vbish = [
  'Program "VbDml"',
  'Database Ledger Type PaymentRecord',
  'Sub Main()',
  '  Dim Id As String = "1"',
  '  Dim Status As String = "new"',
  '  DbInsert(Ledger, "Records", "id,status", Id, Status)',
  '  DbSelect(Ledger, "Records", "id,status", "id", "=", Id, Id, Status)',
  '  DbUpdate(Ledger, "Records", "status", "id", "=", Id, Status)',
  '  DbDelete(Ledger, "Records", "id", "=", Id)',
  'End Sub'
].join('\n');

const artifacts = [
  { language: 'pascalish', artifact: compilePascalishProgramWithAntlr(pascalish) },
  { language: 'cobolish', artifact: compileCobolishToPmachine(cobolish) },
  { language: 'vbish', artifact: compileVbishToPmachine(vbish) }
];
const opcodeMap = await loadOpcodeMap();

for (const { language, artifact } of artifacts) {
  for (const opcode of ['DB_INSERT', 'DB_SELECT', 'DB_UPDATE', 'DB_DELETE']) {
    assert.match(artifact.pcodeText, new RegExp(`^${opcode} `, 'm'), `${language} did not emit ${opcode}`);
  }
  assert.doesNotMatch(artifact.compilerPipeline || '', /pascalish-to-pmachine/i, `${language} used Pascalish lowering`);
  const runtime = await executeProgram({
    instructions: parsePcode(artifact.pcodeText),
    opcodeMap,
    runtimeContext: {
      async databaseReader() { return { id: '1', status: 'selected' }; }
    }
  });
  const operations = runtime.deliveries
    .filter(delivery => delivery.queueName === 'db.Ledger.dml')
    .map(delivery => JSON.parse(delivery.message).operation);
  assert.deepEqual(operations, ['insert', 'update', 'delete'], `${language} DML execution mismatch`);
}

console.log('[independent-language-dml-pcode] PASS: Pascalish, Cobolish, and VBish compile independently and execute DML as pcode');
