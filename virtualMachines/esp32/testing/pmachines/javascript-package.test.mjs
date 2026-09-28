import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const packageUrl = pathToFileURL(path.join(workspaceRoot, 'pmachines', 'javascript', 'index.mjs')).href;
const pmachine = await import(packageUrl);

for (const exportName of [
  'executeProgram',
  'parsePcode',
  'parseProgramMapMappings',
  'runCli',
  'runSingleMessageForEvolution',
  'loadOpcodeManifest',
  'loadOpcodeMap'
]) {
  if (typeof pmachine[exportName] !== 'function') {
    throw new Error(`JavaScript PMachine package is missing ${exportName}`);
  }
}

console.log('[pmachine-js-package] OK: public runtime and opcode exports are available');