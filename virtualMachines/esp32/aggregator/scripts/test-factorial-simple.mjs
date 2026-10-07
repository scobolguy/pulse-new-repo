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

// Simple factorial pcode (no src, just hardcoded n=3)
const simplePcode = `
# Test factorial with n=3
JMP MAIN
PROC_FACTORIAL:
LOAD x
PUSH_INT 1
LE
JZ ELSE_1
PUSH_INT 1
STORE result
JMP ENDIF_2
ELSE_1:
LOAD x
PUSH_INT 1
SUB
CALL PROC_FACTORIAL 1
LOAD result
LOAD x
MUL
STORE result
ENDIF_2:
RET
MAIN:
PUSH_INT 0
STORE result
PUSH_INT 3
CALL PROC_FACTORIAL 1
LOAD result
PRINT_INT
PRINT_NL
HALT
`;

const opcodeMap = await loadOpcodeMap();
const instructions = parsePcode(simplePcode);
console.log('Instructions:', instructions.length);

const result = await executeProgram({
  instructions,
  opcodeMap,
  mappingsById: { __globals: ['result'], __proceduresByLabel: { 'PROC_FACTORIAL': { params: ['x'], locals: [] } } },
  queueTypesByName: new Map(),
  isoTypeIds: new Set(),
  inputQueue: 'test.in',
  sourceMessage: '',
  runtimeContext: {}
});

console.log('Output:', result?.stdout);
