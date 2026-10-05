import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { executeProgram, parsePcode } from './run-js-pmachine.mjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadOpcodeMap() {
  const manifestPath = path.resolve(__dirname, '../../pcode/pcode-opcodes.manifest.json');
  const manifestText = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestText);
  const map = new Map();
  for (const [mnem, def] of Object.entries(manifest.opcodes || {})) {
    map.set(mnem, def);
  }
  return map;
}

async function runPascal(srcCode, sourceMessage) {
  const opcodeMap = await loadOpcodeMap();
  const compiled = compilePascalishProgramWithAntlr(srcCode);
  const instructions = parsePcode(compiled.pcodeText);
  const result = await executeProgram({
    instructions,
    opcodeMap,
    mappingsById: {},
    queueTypesByName: new Map(),
    isoTypeIds: new Set(),
    inputQueue: 'test.in',
    sourceMessage,
    runtimeContext: {}
  });
  
  return result?.stdout || [];
}

async function main() {
  console.log('=== Testing string literal comparisons ===\n');
  
  // Test 1: String literal in if condition
  const src1 = `program TestStrComp;
begin
  if 'hello' = 'hello' then
    writeln('strings are equal')
  else
    writeln('strings differ')
end.`;
  
  console.log('Test 1: String literal equality');
  const out1 = await runPascal(src1, '');
  console.log('Output:', out1.join('\n'));
  console.log(out1.includes('strings are equal') ? '✓ PASS' : '✗ FAIL');
  
  // Test 2: src variable compared to string literal
  const src2 = `program TestSrcComp;
begin
  if src = 'hello' then
    writeln('got hello')
  else
    writeln('not hello')
end.`;
  
  console.log('\nTest 2: src variable compared to string literal (src="hello")');
  const out2 = await runPascal(src2, 'hello');
  console.log('Output:', out2.join('\n'));
  console.log(out2.includes('got hello') ? '✓ PASS' : '✗ FAIL');
  
  // Test 3: src not equal comparison
  console.log('\nTest 3: src compared to string literal (src="world")');
  const out3 = await runPascal(src2, 'world');
  console.log('Output:', out3.join('\n'));
  console.log(out3.includes('not hello') ? '✓ PASS' : '✗ FAIL');
  
  // Test 4: Combined - TRIM src then compare
  const src4 = `program TestTrimSrc;
begin
  if src = 'active' then
    writeln('status is active')
  else
    writeln('status is not active')
end.`;
  
  console.log('\nTest 4: src variable equality (src="active")');
  const out4 = await runPascal(src4, 'active');
  console.log('Output:', out4.join('\n'));
  console.log(out4.includes('status is active') ? '✓ PASS' : '✗ FAIL');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
