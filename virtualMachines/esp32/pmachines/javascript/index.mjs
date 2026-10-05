export {
  executeProgram,
  parsePcode,
  parseProgramMapMappings,
  runCli,
  runSingleMessageForEvolution
} from './src/runtime.mjs';

export { loadOpcodeManifest, loadOpcodeMap } from './src/opcodes.mjs';
export { createPascalishServiceHost } from './src/service-host.mjs';