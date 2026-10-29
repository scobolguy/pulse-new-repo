export * from '../../../../languages/csharp/src/compile-csharp-to-pcode.mjs';
import { main } from '../../../../languages/csharp/src/compile-csharp-to-pcode.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`[CSHARP] ${error.message}`); process.exitCode = 1; });
}
