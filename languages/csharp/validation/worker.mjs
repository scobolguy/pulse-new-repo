import fs from 'node:fs/promises';
import { compileCsharpToPcode } from '../src/compile-csharp-to-pcode.mjs';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';

const [sourceFile, prefix, mode] = process.argv.slice(2);
if (!sourceFile || !prefix || !['compile', 'execute'].includes(mode)) {
  throw new Error('Validation worker requires source file, artifact prefix and compile/execute mode');
}
const source = await fs.readFile(sourceFile, 'utf8');
let artifact, output;
try {
  artifact = compileCsharpToPcode(source, { fileName: sourceFile });
} catch (error) {
  output = { stage: 'compile-error', errorName: error.name, diagnostic: error.message };
}
if (artifact) {
  await fs.writeFile(prefix + '.pcode', artifact.pcodeText, 'utf8');
  await fs.writeFile(prefix + '.program.json', JSON.stringify(artifact.programMap, null, 2) + '\n', 'utf8');
  output = { stage: 'compiled' };
  if (mode === 'execute') {
    const mappingsById = new Map();
    mappingsById.__globals = artifact.programMap.globals;
    mappingsById.__proceduresByLabel = artifact.programMap.procedures;
    try {
      const result = await executeProgram({
        instructions: parsePcode(artifact.pcodeText), opcodeMap: await loadOpcodeMap(), mappingsById,
        queueTypesByName: new Map(), isoTypeIds: new Set(), inputQueue: 'csharp.validation',
        sourceMessage: '', runtimeContext: { maxSteps: 100000, maxCallDepth: 64 }
      });
      output = { stage: 'executed', result, procedures: artifact.programMap.procedures };
    } catch (error) {
      output = { stage: 'runtime-error', errorName: error.name, diagnostic: error.message };
    }
  }
}
process.stdout.write(JSON.stringify(output) + '\n');
