import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);

export async function generateFortranParsers() {
  const jar = path.resolve(root, '../../virtualMachines/esp32/aggregator/tools/antlr-4.13.2-complete.jar');
  await fs.access(jar);
  const output = path.join(root, 'grammar', 'generated');
  await fs.mkdir(output, { recursive: true });
  for (const grammar of ['Fortran77.g4', 'F77Format.g4']) {
    await run('java', ['-jar', jar, '-Dlanguage=JavaScript', '-visitor', '-no-listener',
      '-o', output, grammar], { cwd: path.join(root, 'grammar') });
  }
  console.log('[ANTLR] Generated languages/mnf/grammar/generated');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  generateFortranParsers().catch(error => {
    console.error(error.stderr || error.message);
    process.exitCode = 1;
  });
}
