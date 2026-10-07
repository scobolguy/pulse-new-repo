import { compileStandardPascalWithAntlr } from './compile-standard-pascal-antlr-to-pcode.mjs';
import { executeProgram } from './run-js-pmachine.mjs';
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

const src = `program T; begin if 'hello' = 'hello' then writeln('eq') else writeln('neq') end.`;
const r = compileStandardPascalWithAntlr(src);
console.log('PCODE:\n' + r.pcodeText);

const pcodeText = r.pcodeText;
const lines = pcodeText.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
const labelMap = {};
const instructions = [];

// Collect labels first
let instrIdx = 0;
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.endsWith(':')) {
    labelMap[trimmed.slice(0, -1)] = instrIdx;
  } else {
    instrIdx++;
  }
}

// Parse instructions
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.endsWith(':')) continue;
  const m = trimmed.match(/^(\w+)\s*(.*)?$/);
  if (!m) continue;
  const mnemonic = m[1];
  const operand = (m[2] || '').trim();
  const instr = { mnemonic, operand, strOperand: operand, targetIndex: -1 };
  if ((mnemonic === 'JMP' || mnemonic === 'JZ') && labelMap[operand] !== undefined) {
    instr.targetIndex = labelMap[operand];
  }
  instructions.push(instr);
}

const opcodeMap = await loadOpcodeMap();
const result = await executeProgram({
  instructions,
  opcodeMap,
  mappingsById: {},
  queueTypesByName: new Map(),
  isoTypeIds: new Set(),
  inputQueue: 'test.in',
  sourceMessage: 'hello',
  runtimeContext: {}
});

console.log('\nOUTPUT:', result?.stdout);
