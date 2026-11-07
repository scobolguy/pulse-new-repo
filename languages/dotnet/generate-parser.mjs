import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const jar = fileURLToPath(new URL('../../virtualMachines/esp32/aggregator/tools/antlr-4.13.2-complete.jar', import.meta.url));

export async function generateParser(rootUrl, grammarName) {
  const root = fileURLToPath(rootUrl);
  await fs.access(jar);
  const output = path.join(root, 'grammar', 'generated');
  await fs.mkdir(output, { recursive: true });
  const { stderr } = await run('java', ['-jar', jar, '-Dlanguage=JavaScript', '-visitor', '-no-listener',
    '-o', output, `${grammarName}.g4`], { cwd: path.join(root, 'grammar') });
  if (stderr) process.stderr.write(stderr);
  for (const name of await fs.readdir(output)) {
    if (!name.endsWith('.js')) continue;
    const file = path.join(output, name);
    const source = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, source.split(/\r?\n/).map(line => line.trimEnd()).join('\n').trimEnd() + '\n', 'utf8');
  }
  console.log(`[ANTLR] Generated ${grammarName} from .g4`);
}
