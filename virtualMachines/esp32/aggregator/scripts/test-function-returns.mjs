import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { executeProgram, parsePcode, parseProgramMapMappings } from './run-js-pmachine.mjs';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opcodeMap = await loadOpcodeMap();

async function runSource(sourceText) {
  const compiled = compilePascalishProgramWithAntlr(sourceText);
  const result = await executeProgram({
    instructions: parsePcode(compiled.pcodeText),
    opcodeMap,
    mappingsById: parseProgramMapMappings(compiled.programMap),
    inputQueue: 'fn.test',
    sourceMessage: ''
  });
  return { compiled, result };
}

async function readData(name) {
  return fs.readFile(path.join(root, 'data', name), 'utf8');
}

// 1. Typed returns: integer, real, string, recursion, nesting.
{
  const { result } = await runSource(await readData('function-returns-showcase.pas'));
  assert.deepEqual(result.stdout, [
    'doubled=42',
    'ratio=2.500000E-01',
    'greeting=hello world',
    'factorial6=720',
    'nested=20'
  ]);
  assert.equal(result.globals.doubled, 42);
  assert.equal(result.globals.greeting, 'hello world');
  assert.equal(result.globals.fact, 720);
}

// 2. Real division is real, integer division still truncates.
{
  const { result } = await runSource(`
    program DivisionSemantics;
    var r: real; n: integer;
    begin
      r := 1.0 / 4.0;
      n := 7 / 2;
      writeln('r=', r);
      writeln('n=', n)
    end.
  `);
  assert.deepEqual(result.stdout, ['r=2.500000E-01', 'n=3']);
}

// 3. A function invoked as a statement must not leak its result onto the stack.
{
  const { compiled, result } = await runSource(`
    program DiscardResult;
    var seen: integer;
    function Bump(x: integer): integer;
    begin
      seen := seen + 1;
      return x
    end;
    begin
      Bump(1);
      Bump(2);
      writeln('seen=', seen)
    end.
  `);
  assert.match(compiled.pcodeText, /STORE __discard/);
  assert.deepEqual(result.stdout, ['seen=2']);
}

// 4. REGRESSION: `return` outside a function is still an orchestration return.
{
  const { compiled } = await runSource(await readData('parent-child-orchestration.pas'));
  assert.match(compiled.pcodeText, /ORCH_RETURN_SUCCESS "merged_reply"/);
  assert.doesNotMatch(compiled.pcodeText, /STORE __discard/);
}

// 5. A bare `return` inside a function is a compile error.
{
  assert.throws(() => compilePascalishProgramWithAntlr(`
    program BareReturn;
    function Broken(x: integer): integer;
    begin
      return
    end;
    begin
      writeln(Broken(1))
    end.
  `), /bare return/i);
}

console.log('[pascalish-function-returns] PASS: typed returns, real division, statement discard, orchestration regression');
