import fs from 'node:fs/promises';
import path from 'node:path';
import { compilePascalishProgramWithAntlr } from '../src/compile-pascalish-program-antlr-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';
import { loadOpcodeMap } from '../../../virtualMachines/esp32/pmachines/javascript/src/opcodes.mjs';

const [sourceFile, artifactPrefix, mode] = process.argv.slice(2);
const source = await fs.readFile(sourceFile, 'utf8');
let compiled;
try {
  compiled = compilePascalishProgramWithAntlr(source, { fileName: path.basename(sourceFile) });
} catch (error) {
  console.log(JSON.stringify({ stage: 'compile-error', error: error.message }));
  process.exit(0);
}
await fs.mkdir(path.dirname(artifactPrefix), { recursive: true });
await fs.writeFile(artifactPrefix + '.pcode', compiled.pcodeText);
await fs.writeFile(artifactPrefix + '.program.json', JSON.stringify(compiled.programMap, null, 2) + '\n');
if (mode === 'negative' || mode === 'compile-only') {
  console.log(JSON.stringify({ stage: 'compiled' }));
} else {
  try {
    const result = await executeProgram({
      instructions: parsePcode(compiled.pcodeText),
      programMap: compiled.programMap,
      opcodeMap: await loadOpcodeMap(),
      queueTypesByName: new Map(), isoTypeIds: new Set(),
      inputQueue: 'validation', sourceMessage: '',
      runtimeContext: { maxSteps: 200000 }
    });
    console.log(JSON.stringify({ stage: 'executed', result }));
  } catch (error) {
    console.log(JSON.stringify({ stage: 'runtime-error', error: error.message }));
  }
}
