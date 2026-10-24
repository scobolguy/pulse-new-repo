// Compatibility entrypoint; canonical implementation lives under languages/.
export * from '../../../../languages/mapl/src/compile-mapl-antlr-to-pcode.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { main } from '../../../../languages/mapl/src/compile-mapl-antlr-to-pcode.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`[MAPL] Failed: ${error.message}`);
    process.exitCode = 1;
  });
}
