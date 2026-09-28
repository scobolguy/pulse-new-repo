import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';

const source = [
  'daemon "mt103-pacs008-daemon" every 1000 ms;',
  'begin',
  '  enqueue outgoing_message with "edge-payload";',
  'end.'
].join('\n');

const artifact = compilePascalishProgramWithAntlr(source);
assert.equal(artifact.programMap.runtimeUnit.kind, 'daemon');
assert.equal(artifact.programMap.runtimeUnit.id, 'mt103-pacs008-daemon');
assert.match(artifact.pcodeText, /ROUTE|ENQUEUE|outgoing_message/i);
assert.doesNotMatch(artifact.pcodeText, /mysql|mssql|access|qm-rabbit|qm-msmq/i);
assert.ok(artifact.programMap);

console.log('[mt103-pacs008-artifact] PASS: daemon emits provider-independent pcode for JS/ESP32 targets');
