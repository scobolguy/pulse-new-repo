import assert from 'node:assert/strict';
import { compileCobolishToPcode } from './compile-cobolish-to-pcode.mjs';

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

const artifact = compileCobolishToPcode(source);
for (const opcode of ['DB_INSERT', 'DB_SELECT', 'DB_UPDATE', 'DB_DELETE']) {
  assert.match(artifact.pcodeText, new RegExp(`^${opcode} `, 'm'));
}
assert.equal(artifact.programMap.sourceLanguage, 'cobolish');
console.log('[cobolish-dml-pcode] PASS');
