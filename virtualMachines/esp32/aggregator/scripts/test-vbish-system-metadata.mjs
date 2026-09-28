import assert from 'node:assert/strict';
import { compileVbishWithAntlr } from './vbish-antlr-compiler.mjs';
import { compileVbishToPmachine } from './compile-interoperable-language.mjs';

const source = [
  'SYSTEM TYPE "RtgsSystem" BEGIN',
  'QUEUE "requiredIn" TYPE "pacs"',
  'END',
  'SYSTEM "LYNX" OF TYPE "RtgsSystem" BEGIN',
  'QUEUE "creditIn" -> "credit.in" TYPE "pacs" VISIBILITY EXPOSED',
  'SERVICE "gateway" -> "gateway" VISIBILITY INTERNAL',
  'END'
].join('\n');

const native = compileVbishWithAntlr(source, { fileName: 'system.vbs' });
assert.equal(native.valid, true);

const compiled = compileVbishToPmachine(source, { fileName: 'system.vbs' });
assert.equal(compiled.programMap.symbols.systems.length, 2);
assert.equal(compiled.programMap.symbols.systems[0].abstract, true);
assert.equal(compiled.programMap.symbols.queues[0].queueName, 'LYNX.credit.in');
assert.equal(compiled.programMap.symbols.queues[0].visibility, 'exposed');
assert.equal(compiled.programMap.symbols.services[0].visibility, 'internal');

const recursive = compileVbishToPmachine([
  'SYSTEM "Payments" BEGIN',
  'SYSTEM "Ingress" BEGIN',
  'QUEUE "incoming" -> "payments.in" TYPE "pacs"',
  'END',
  'SYSTEM "Settlement" BEGIN',
  'QUEUE "settled" -> "payments.settled" TYPE "pacs"',
  'END',
  'END'
].join('\n'), { fileName: 'recursive-system.vbs' });
const root = recursive.programMap.symbols.systems[0];
assert.equal(root.systemId, 'Payments');
assert.equal(root.members[0].systemId, 'Payments.Ingress');
assert.equal(root.members[1].systemId, 'Payments.Settlement');
assert.equal(root.members[0].members[0].queueName, 'Payments.Ingress.payments.in');

console.log('[vbish-system-metadata] PASS: recursive systems compile directly to pcode metadata');
