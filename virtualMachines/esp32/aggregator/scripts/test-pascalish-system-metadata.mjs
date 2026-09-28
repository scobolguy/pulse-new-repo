import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';

const source = [
  'SYSTEM TYPE "RtgsSystem" BEGIN',
  'QUEUE "creditIn" -> "credit.in" TYPE "pacs" VISIBILITY EXPOSED;',
  'END;',
  'SYSTEM "LYNX" OF TYPE "RtgsSystem" BEGIN',
  'QUEUE "creditIn" -> "credit.in" TYPE "pacs" VISIBILITY EXPOSED;',
  'SERVICE "gateway" -> "gateway" VISIBILITY INTERNAL;',
  'END;',
  'PROGRAM "demo";',
  'BEGIN END.'
].join('\n');

const compiled = compilePascalishProgramWithAntlr(source);
assert.equal(compiled.programMap.symbols.systems.length, 2);
assert.equal(compiled.programMap.symbols.systems[0].abstract, true);
assert.equal(compiled.programMap.symbols.systems[1].typeName, 'RtgsSystem');
assert.equal(compiled.programMap.symbols.queues[0].queueName, 'LYNX.credit.in');
assert.equal(compiled.programMap.symbols.queues[0].visibility, 'exposed');
assert.equal(compiled.programMap.symbols.services[0].visibility, 'internal');

console.log('[pascalish-system-metadata] PASS');
