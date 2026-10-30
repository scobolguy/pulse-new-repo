import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compileScreenCobol } from '../src/compiler.mjs';
const source = await fs.readFile(new URL('../../../virtualMachines/esp32/pathway/examples/echo.scob', import.meta.url), 'utf8');

test('formal SCREEN COBOL parser compiles vendor-style AT and SEND/REPLY clauses to p-code', () => {
  const compiled = compileScreenCobol(source);
  assert.match(compiled.pcodeText, /CALL_EXT pathway.send 3/);
  assert.equal(compiled.programMap.screenCobol.screens['MAIN-SCREEN'].columns, 80);
  assert.equal(compiled.programMap.sourceLanguage, 'screencobol');
  assert.ok(compiled.programMap.sourceMap);
  assert.doesNotThrow(() => compileScreenCobol(source.toLowerCase()));
});
test('rejects unknown syntax, missing symbols, layout conflicts and invalid field widths', () => {
  for (const [invalid, message] of [
    [source.replace('STOP RUN.', 'EXPLODE.'), /parse failed/],
    [source.replace('SEND REQUEST-TEXT', 'SEND MISSING-ITEM'), /Undefined/],
    [source.replace('AT 5, 2', 'AT 3, 2'), /Overlapping/],
    [source.replace('SIZE 24, 80', 'SIZE 0, 80'), /Invalid/],
    [source.replace('USING REQUEST-TEXT', 'USING MISSING'), /Undefined/],
    [source.replace('STOP RUN.', 'STOP RUN. DISPLAY MAIN-SCREEN.'), /after STOP/],
    [source.replace('PIC X(40) USING', 'PIC X(41) USING'), /width/],
  ]) assert.throws(() => compileScreenCobol(invalid), message);
});
