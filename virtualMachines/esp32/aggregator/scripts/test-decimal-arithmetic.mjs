import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { compileCobolishToPcode } from './compile-cobolish-to-pcode.mjs';
import { executeProgram, parsePcode, parseProgramMapMappings } from './run-js-pmachine.mjs';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';
import { parsePicture, widenPictures } from './cobol-picture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opcodeMap = await loadOpcodeMap();

async function runSource(sourceText) {
  const compiled = compilePascalishProgramWithAntlr(sourceText);
  const result = await executeProgram({
    instructions: parsePcode(compiled.pcodeText),
    opcodeMap,
    mappingsById: parseProgramMapMappings(compiled.programMap),
    inputQueue: 'dec.test',
    sourceMessage: ''
  });
  return { compiled, result };
}

// 1. The showcase: scale from the receiving field, truncation vs ROUNDED, exactness.
{
  const source = await fs.readFile(path.join(root, 'data', 'decimal-showcase.pas'), 'utf8');
  const { result } = await runSource(source);
  assert.deepEqual(result.stdout, [
    'gross     = 59.97',
    'fee trunc = 7.49',
    'fee round = 7.50',
    'share     = 3.33',
    'share rnd = 6.67',
    'sum 0.1   = 10.00',
    'exact     = yes'
  ]);
  assert.equal(result.globals.running, '10.00');
}

// 2. Exactness that binary floating point cannot express.
{
  const { result } = await runSource(`
    program DecimalExactness;
    var a: decimal(9, 2); b: decimal(9, 2); c: decimal(9, 2);
    begin
      a := 0.1;
      b := 0.2;
      c := a + b;
      writeln('sum = ', c);
      if c = 0.3 then
        writeln('eq = yes')
      else
        writeln('eq = no')
    end.
  `);
  assert.deepEqual(result.stdout, ['sum = 0.30', 'eq = yes']);
}

// 3. Precision beyond int32 and beyond float64's exact integer range.
{
  const { result } = await runSource(`
    program DecimalWidth;
    var big: decimal(30, 2); step: decimal(30, 2);
    begin
      big := 123456789012345678.99;
      step := big + 0.01;
      writeln('big  = ', big);
      writeln('step = ', step)
    end.
  `);
  assert.deepEqual(result.stdout, [
    'big  = 123456789012345678.99',
    'step = 123456789012345679.00'
  ]);
}

// 4. Half-up away from zero, on both signs.
{
  const { result } = await runSource(`
    program DecimalRounding;
    var up: decimal(9, 1); down: decimal(9, 1); negUp: decimal(9, 1);
    begin
      up := 2.25 rounded;
      down := 2.24 rounded;
      negUp := 0.0 - 2.25 rounded;
      writeln('up   = ', up);
      writeln('down = ', down);
      writeln('neg  = ', negUp)
    end.
  `);
  assert.deepEqual(result.stdout, ['up   = 2.3', 'down = 2.2', 'neg  = -2.3']);
}

// 5. Division by zero yields zero, matching the runtime's existing convention.
{
  const { result } = await runSource(`
    program DecimalDivZero;
    var q: decimal(9, 2); z: decimal(9, 2);
    begin
      z := 0.0;
      q := 5.0 / z;
      writeln('q = ', q)
    end.
  `);
  assert.deepEqual(result.stdout, ['q = 0.00']);
}

// 6. decimal(x) converts, and decimals survive a call boundary.
{
  const { result } = await runSource(`
    program DecimalCalls;
    var total: decimal(11, 2);
    function Twice(v: decimal(11, 2)): decimal(11, 2);
    begin
      return v + v
    end;
    begin
      total := Twice(decimal(12.34));
      writeln('total = ', total)
    end.
  `);
  assert.deepEqual(result.stdout, ['total = 24.68']);
}

// 7. COBOL PICTURE clauses map onto the same fixed-point types.
{
  assert.deepEqual(parsePicture('S9(7)V99'), {
    kind: 'decimal', signed: true, precision: 9, scale: 2, pascalishType: 'decimal(9, 2)'
  });
  assert.equal(parsePicture('PICTURE IS S9(18)V9(2)').pascalishType, 'decimal(20, 2)');
  assert.equal(parsePicture('9(5)').scale, 0);
  assert.equal(parsePicture('PIC X(20)').kind, 'string');
  assert.equal(parsePicture('  ')  , null);

  // Widening keeps every digit on both sides of the point.
  assert.equal(
    widenPictures(parsePicture('S9(3)V9(2)'), parsePicture('9(5)V9')).pascalishType,
    'decimal(7, 2)'
  );
}

// 8. Cobolish COMPUTE keeps arithmetic expressions instead of dropping them.
{
  const source = `
    IDENTIFICATION DIVISION.
    PROGRAM-ID. FEES.
    DATA DIVISION.
    WORKING-STORAGE SECTION.
    01 PRICE PIC S9(7)V99.
    01 QTY PIC 9(3).
    01 GROSS PIC S9(9)V99.
    PROCEDURE DIVISION.
        MOVE 19.99 TO PRICE.
        MOVE 3 TO QTY.
        COMPUTE GROSS = PRICE * QTY.
        DISPLAY "gross " GROSS.
        STOP RUN.
  `;
  const compiled = compileCobolishToPcode(source);
  const result = await executeProgram({
    instructions: parsePcode(compiled.pcodeText),
    opcodeMap,
    mappingsById: parseProgramMapMappings(compiled.programMap),
    inputQueue: 'cob.test',
    sourceMessage: ''
  });
  assert.deepEqual(result.stdout, ['gross 59.97']);
}

console.log('[decimal-arithmetic] PASS: fixed-point scale, ROUNDED, width, exactness, calls, PICTURE, COBOLISH COMPUTE');
