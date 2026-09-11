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
    inputQueue: 'cpx.test',
    sourceMessage: ''
  });
  return { compiled, result };
}

// 1. Operators, conversions and toString on the showcase.
{
  const source = await fs.readFile(path.join(root, 'data', 'imaginary-showcase.pas'), 'utf8');
  const { compiled, result } = await runSource(source);

  assert.deepEqual(compiled.programMap.libraries, ['imaginary']);
  assert.deepEqual(result.stdout, [
    'z = 3.000000E+00+4.000000E+00i',
    'w = 1.000000E+00-2.000000E+00i',
    'z + w = 4.000000E+00+2.000000E+00i',
    'z - w = 2.000000E+00+6.000000E+00i',
    'z * w = 1.100000E+01-2.000000E+00i',
    'z / w = -1.000000E+00+2.000000E+00i',
    'conj z = 3.000000E+00-4.000000E+00i',
    'z + 1 = 4.000000E+00+4.000000E+00i',
    'z * 2 = 6.000000E+00+8.000000E+00i',
    'abs z = 5.000000E+00',
    'real z = 3.000000E+00'
  ]);
  // 25 is a perfect square, so a correct Newton iteration lands on 5 exactly.
  assert.equal(result.globals.modulus, 5);
  assert.equal(result.globals.realPart, 3);
}

// 2. Chained operators, equality, and division by zero.
{
  const { result } = await runSource(`
    program ComplexAlgebra;
    use "imaginary";
    var
      z: Complex;
      w: Complex;
      q: Complex;
      chained: Complex;
    begin
      z.re := 3.0;
      z.im := 4.0;
      w.re := 1.0;
      w.im := 0.0 - 2.0;

      chained := z * w + z;
      writeln('chained = ', chained.toString());

      q := z / (w - w);
      writeln('zero div = ', q.toString());

      if z = z then
        writeln('eq = yes')
      else
        writeln('eq = no');

      if z = w then
        writeln('ne = wrong')
      else
        writeln('ne = ok')
    end.
  `);
  assert.deepEqual(result.stdout, [
    'chained = 1.400000E+01+2.000000E+00i',
    'zero div = 0.000000E+00+0.000000E+00i',
    'eq = yes',
    'ne = ok'
  ]);
}

// 3. The type is only available when the library is imported.
{
  assert.throws(() => compilePascalishProgramWithAntlr(`
    program MissingImport;
    var z: Complex;
    begin
      writeln(z.toString())
    end.
  `), /undeclared subprogram: z.toString/);
}

// 4. An unknown library id is rejected.
{
  assert.throws(() => compilePascalishProgramWithAntlr(`
    program UnknownLibrary;
    use "definitely-not-a-library";
    begin
    end.
  `), /Unknown library "definitely-not-a-library"/);
}

// 5. A user symbol colliding with a library symbol is rejected.
{
  assert.throws(() => compilePascalishProgramWithAntlr(`
    program CollidingSymbol;
    use "imaginary";
    type Complex = record r: real; end;
    begin
    end.
  `), /collides/i);
}

console.log('[imaginary-library] PASS: operators, conversions, toString, gating, collisions');
