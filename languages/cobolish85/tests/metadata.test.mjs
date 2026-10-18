import assert from 'node:assert/strict';
import { traceProgram, traceCheck } from './support/trace.mjs';
import { compileCobolishToPcode } from '../src/compile-cobolish-to-pcode.mjs';

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

traceProgram(import.meta.url, source.trim());
const compiled = compileCobolishToPcode(source);
const { systems, queues, services } = compiled.programMap.symbols;
traceCheck(import.meta.url, {
  description: 'System, queue and service metadata in the program map',
  expected: {
    systems: [{ systemId: 'RtgsSystem', abstract: true }, { systemId: 'LYNX' }],
    firstQueue: { queueName: 'LYNX.credit.in', visibility: 'exposed' },
    firstServiceVisibility: 'internal'
  },
  actual: {
    systems: systems.map(system => system.abstract ? { systemId: system.systemId, abstract: true } : { systemId: system.systemId }),
    firstQueue: { queueName: queues[0]?.queueName, visibility: queues[0]?.visibility },
    firstServiceVisibility: services[0]?.visibility
  }
});
assert.equal(compiled.programMap.symbols.systems.length, 2);
assert.equal(compiled.programMap.symbols.systems[0].systemId, 'RtgsSystem');
assert.equal(compiled.programMap.symbols.systems[0].abstract, true);
assert.equal(compiled.programMap.symbols.systems[1].systemId, 'LYNX');
assert.equal(compiled.programMap.symbols.queues[0].queueName, 'LYNX.credit.in');
assert.equal(compiled.programMap.symbols.queues[0].visibility, 'exposed');
assert.equal(compiled.programMap.symbols.services[0].visibility, 'internal');

console.log('[cobolish-system-metadata] PASS');
