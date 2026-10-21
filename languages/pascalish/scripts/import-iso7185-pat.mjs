import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const revision = 'f730c1c03de861dfcf1a88c7b320268c3a456bcc';
const checkout = process.argv[2];
if (!checkout || process.argv.length !== 3) {
  throw new Error('Usage: node scripts/import-iso7185-pat.mjs <Pascal-P5 git checkout>');
}
const directory = fileURLToPath(new URL('../validation/iso7185/', import.meta.url));
await fs.mkdir(directory, { recursive: true });
const provenance = {
  repository: 'https://git.code.sf.net/p/pascalp5/code',
  revision,
  rights: 'Author explicitly dedicates PAT to the public domain at https://www.standardpascal.org/p5.html',
  files: []
};
for (const [upstream, local] of [
  ['standard_tests/iso7185pat.pas', 'iso7185pat.pas'],
  ['standard_tests/iso7185pat.inp', 'iso7185pat.inp'],
  ['gpc/bit32/standard_tests/iso7185pat.cmp', 'iso7185pat.reference.txt']
]) {
  const { stdout } = await run('git', ['-C', path.resolve(checkout), 'show', `${revision}:${upstream}`], {
    encoding: 'buffer', maxBuffer: 8 * 1024 * 1024
  });
  await fs.writeFile(path.join(directory, local), stdout);
  provenance.files.push({ upstream, local, sha256: createHash('sha256').update(stdout).digest('hex') });
}
await fs.writeFile(path.join(directory, 'upstream.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(`Imported unmodified ISO 7185 PAT at ${revision}`);
