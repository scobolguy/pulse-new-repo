// Compatibility entrypoint; canonical implementation lives under languages/.
export * from '../../../../languages/wfl/src/interpret-workflow.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { main } from '../../../../languages/wfl/src/interpret-workflow.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error('[WORKFLOW-INTERPRETER] Failed:', error.message);
    process.exitCode = 1;
  });
}
