// Compatibility wrapper for callers that still use the legacy Aggregator path.
export {
  executeProgram,
  parsePcode,
  parseProgramMapMappings,
  runCli,
  runSingleMessageForEvolution
} from '../../pmachines/javascript/src/runtime.mjs';

import { runCli as runtimeRunCli } from '../../pmachines/javascript/src/runtime.mjs';
import { pathToFileURL } from 'node:url';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runtimeRunCli().catch(error => {
    console.error('[JS-PMACHINE] Failed:', error?.message || String(error));
    process.exitCode = 1;
  });
}
