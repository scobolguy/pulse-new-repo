import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { main } from '../../../../languages/cobolish85/src/compile-tandem-cobol85-to-pcode.mjs';

export { compileTandemCobol85ToPcode } from '../../../../languages/cobolish85/src/compile-tandem-cobol85-to-pcode.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`[TANDEM-COBOL85] ${error.message}`);
    process.exitCode = 1;
  });
}
