import assert from 'node:assert/strict';
import { traceProgram, traceCheck } from './support/trace.mjs';
import { compileCobolishToPcode } from '../src/compile-cobolish-to-pcode.mjs';

const source = [
  'IDENTIFICATION DIVISION.',
  'PROGRAM-ID. DML.',
  'DATA DIVISION.',
  'WORKING-STORAGE SECTION.',
  '01 RECORD-ID PIC X(10).',
  '01 RECORD-STATUS PIC X(10).',
  'PROCEDURE DIVISION.',
  'CALL "DB-INSERT" USING Ledger "Records" "id,status" RECORD-ID RECORD-STATUS.',
  'CALL "DB-SELECT" USING Ledger "Records" "id,status" "id" "=" RECORD-ID RECORD-ID RECORD-STATUS.',
  'CALL "DB-UPDATE" USING Ledger "Records" "status" "id" "=" RECORD-ID RECORD-STATUS.',
  'CALL "DB-DELETE" USING Ledger "Records" "id" "=" RECORD-ID.',
  'STOP RUN.'
].join('\n');

traceProgram(import.meta.url, source);
const artifact = compileCobolishToPcode(source);
const dmlOpcodes = ['DB_INSERT', 'DB_SELECT', 'DB_UPDATE', 'DB_DELETE'];
traceCheck(import.meta.url, {
  description: 'DML opcodes emitted in the P-code',
  expected: { opcodes: dmlOpcodes, sourceLanguage: 'cobolish' },
  actual: {
    opcodes: dmlOpcodes.filter(opcode => new RegExp(`^${opcode} `, 'm').test(artifact.pcodeText)),
    sourceLanguage: artifact.programMap.sourceLanguage
  }
});
for (const opcode of dmlOpcodes) {
  assert.match(artifact.pcodeText, new RegExp(`^${opcode} `, 'm'));
}
assert.equal(artifact.programMap.sourceLanguage, 'cobolish');
console.log('[cobolish-dml-pcode] PASS');
