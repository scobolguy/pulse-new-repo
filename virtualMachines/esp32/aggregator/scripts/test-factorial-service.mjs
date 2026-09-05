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

function buildMappingsById(programMap) {
  const m = new Map();
  m.__globals = Array.isArray(programMap?.globals) ? programMap.globals : [];
  m.__proceduresByLabel = programMap?.procedures || {};
  return m;
}

const factorialSrc = await fs.readFile(path.resolve(__dirname, '../data/factorial-service.pas'), 'utf-8');
const compiled = compilePascalishProgramWithAntlr(factorialSrc);
const opcodeMap = await loadOpcodeMap();
const instructions = parsePcode(compiled.pcodeText);
const mappingsById = buildMappingsById(compiled.programMap);

async function runTest(srcMsg, expected) {
  try {
    const result = await executeProgram({
      instructions,
      opcodeMap,
      mappingsById,
      queueTypesByName: new Map(),
      isoTypeIds: new Set(),
      inputQueue: 'test.in',
      sourceMessage: srcMsg,
      runtimeContext: {}
    });
    const output = (result?.stdout || []).join('\n');
    const pass = output.includes(expected);
    console.log(`src="${srcMsg}" -> "${output}" (expected "${expected}") ${pass ? '✓' : '✗'}`);
    return pass;
  } catch(e) {
    console.error(`src="${srcMsg}" -> ERROR: ${e.message}`);
    return false;
  }
}

console.log('=== Factorial Service Tests ===\n');

let p = 0, f = 0;
const tests = [
  ['0', '1'],
  ['1', '1'],
  ['2', '2'],
  ['3', '6'],
  ['4', '24'],
  ['5', '120'],
  ['6', '720'],
  ['7', '5040'],
  ['10', '3628800'],
  ['-1', 'Invalid input'],
  ['11', 'Invalid input'],
  ['hello', 'Invalid input'],
];

for (const [msg, exp] of tests) {
  if (await runTest(msg, exp)) p++; else f++;
}

console.log(`\nPassed: ${p}  Failed: ${f}`);
process.exit(f > 0 ? 1 : 0);
