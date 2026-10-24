import assert from 'node:assert/strict';
import test from 'node:test';
import { attachPcodeSignature, signPcodeText } from '../../aggregator/scripts/pcode-signing.mjs';
import { DEBUG_ONLY_PROGRAM_MAP_KEYS, toRuntimeProgramMap } from '../../aggregator/scripts/esp32-runtime-artifacts.mjs';

test('runtime program map drops debugger-only data and keeps execution data', () => {
  const full = {
    version: 1,
    globals: { GREETING: 0 },
    procedures: { MAIN: { params: [], locals: ['Result'], returnType: { sourceText: 'compiler AST' } } },
    entries: [{ kind: 'map', items: [
      { sourcePath: 'a', targetPath: 'b', ops: [['copy']], conversionRule: 'copy a to b' },
      { sourcePath: 'c', targetPath: 'd', conversionRule: 'uncompiled' }
    ] }],
    sourceMap: [{ pc: 0, line: 1 }], symbols: [{ name: 'GREETING' }], fields: [{ name: 'X' }],
    files: ['hello.cob'], generatedAt: '2025-01-01T00:00:00Z',
    classDeclarations: [{ name: 'TBox', methods: [{ body: ['compiler AST'] }] }],
    typeDeclarations: [{ name: 'TIntegerBox', genericArgs: ['integer'] }]
  };
  const runtime = toRuntimeProgramMap(full);
  for (const key of DEBUG_ONLY_PROGRAM_MAP_KEYS) assert.equal(key in runtime, false, key);
  assert.deepEqual(runtime.globals, full.globals);
  assert.deepEqual(runtime.procedures, { MAIN: { params: [], locals: ['Result'] } });
  assert.ok(full.procedures.MAIN.returnType);
  assert.equal('conversionRule' in runtime.entries[0].items[0], false);
  assert.equal(runtime.entries[0].items[1].conversionRule, 'uncompiled');
  assert.ok(full.sourceMap, 'full map is not mutated');
});

test('signature over the runtime map still verifies the pcode text', () => {
  const pcode = 'LOAD GREETING\nPRINT\n';
  const signed = attachPcodeSignature(toRuntimeProgramMap({ sourceMap: [1], globals: {} }), pcode);
  assert.equal(signed.signing.signature, signPcodeText(pcode));
  assert.equal('sourceMap' in signed, false);
});
