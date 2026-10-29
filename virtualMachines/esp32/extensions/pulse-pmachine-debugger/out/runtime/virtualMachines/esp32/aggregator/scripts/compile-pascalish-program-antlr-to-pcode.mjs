// Compatibility entry point; implementation lives in languages/pascalish.
export * from '../../../../languages/pascalish/src/compile-pascalish-program-antlr-to-pcode.mjs';
import { runCli } from '../../../../languages/pascalish/src/compile-pascalish-program-antlr-to-pcode.mjs';
import { pathToFileURL } from 'node:url';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
