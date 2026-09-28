import assert from 'node:assert/strict';
import { compileCobolishToPcode } from './compile-cobolish-to-pcode.mjs';

const source = `
IDENTIFICATION DIVISION.
PROGRAM-ID. FEES.
SYSTEM TYPE "RtgsSystem" BEGIN
  QUEUE "requiredIn" TYPE "pacs".
END.
SYSTEM "LYNX" OF TYPE "RtgsSystem" BEGIN
  QUEUE "creditIn" -> "credit.in" TYPE "pacs" VISIBILITY EXPOSED.
  SERVICE "gateway" -> "gateway" VISIBILITY INTERNAL.
END.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 PRICE PIC 9(3).
PROCEDURE DIVISION.
  STOP RUN.
`;

const compiled = compileCobolishToPcode(source);
assert.equal(compiled.programMap.symbols.systems.length, 2);
assert.equal(compiled.programMap.symbols.systems[0].systemId, 'RtgsSystem');
assert.equal(compiled.programMap.symbols.systems[0].abstract, true);
assert.equal(compiled.programMap.symbols.systems[1].systemId, 'LYNX');
assert.equal(compiled.programMap.symbols.queues[0].queueName, 'LYNX.credit.in');
assert.equal(compiled.programMap.symbols.queues[0].visibility, 'exposed');
assert.equal(compiled.programMap.symbols.services[0].visibility, 'internal');

console.log('[cobolish-system-metadata] PASS');
