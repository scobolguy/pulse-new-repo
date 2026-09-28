import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { compileCobolishWithAntlr } from './cobolish-antlr-compiler.mjs';
import { compileVbishWithAntlr } from './vbish-antlr-compiler.mjs';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';

const pascal = compilePascalishProgramWithAntlr([
  'type PaymentRecord = record',
  '  id: integer;',
  '  amount: real;',
  'end;',
  'database SqlLedger type PaymentRecord;',
  'program DualDatabaseWriter;',
  'begin end.'
].join('\n'));
assert.equal(pascal.programMap.symbols.databases[0].typeName, 'PaymentRecord');
assert.doesNotMatch(pascal.pcodeText, /mssql|access|SqlLedger/i);

const vb = compileVbishWithAntlr([
  'TYPE PaymentRecord AS integer',
  'DATABASE AccessLedger TYPE PaymentRecord',
  'PULSE PROGRAM "DualDatabaseWriter"'
].join('\n'));
assert.equal(vb.databases[0].typeName, 'PaymentRecord');

const cobol = compileCobolishWithAntlr([
  'IDENTIFICATION DIVISION.',
  'PROGRAM-ID. FEES.',
  'DATA DIVISION.',
  'WORKING-STORAGE SECTION.',
  '01 PRICE PIC 9(3).',
  'DATABASE Ledger TYPE PaymentRecord.',
  'PROCEDURE DIVISION.',
  'STOP RUN.'
].join('\n'));
assert.equal(cobol.databases[0].typeName, 'PaymentRecord');

const wfl = compileWorkflowDSLWithAntlr('DATABASE "SqlLedger" -> "PulseSqlLedger" TYPE "PaymentRecord" MANAGER "db-mssql";');
assert.equal(wfl.bindings.bySymbol.SqlLedger.typeName, 'PaymentRecord');
assert.equal(wfl.bindings.bySymbol.SqlLedger.managerId, 'db-mssql');

console.log('[database-type-declarations] PASS: Pascalish/VBish/Cobolish types and WFL bindings remain provider-independent');
