export {
  executeProgram,
  parsePcode,
  parseProgramMapMappings,
  runCli,
  runSingleMessageForEvolution
} from './src/runtime.mjs';

export { loadOpcodeManifest, loadOpcodeMap } from './src/opcodes.mjs';
export { PMachineMemory, PMachineMemoryError } from './src/memory.mjs';
export { PMachineScheduler } from './src/scheduler.mjs';
export {
  PMACHINE_RUNTIME_PROFILE_VERSION,
  createPmachineRuntimeProfile,
  checkPmachineRuntimeCompatibility
} from '../shared/contracts/runtime-profile.mjs';