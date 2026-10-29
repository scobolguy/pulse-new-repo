import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const require = createRequire(import.meta.url);
const yauzl = require('yauzl');
const execFileAsync = promisify(execFile);
const extension = fileURLToPath(new URL('../../', import.meta.url));

async function extract(vsix, destination) {
  const zip = await new Promise((resolve, reject) => {
    yauzl.open(vsix, { lazyEntries: true }, (error, value) => error ? reject(error) : resolve(value));
  });
  try {
    await new Promise((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', entry => {
        (async () => {
          if (entry.fileName.startsWith('extension/') && !entry.fileName.endsWith('/')) {
            const target = path.resolve(destination, ...entry.fileName.split('/'));
            assert.ok(target.startsWith(`${destination}${path.sep}`), 'VSIX path must stay inside extraction directory');
            const stream = await new Promise((resolve, reject) => {
              zip.openReadStream(entry, (error, value) => error ? reject(error) : resolve(value));
            });
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, Buffer.concat(await Array.fromAsync(stream)));
          }
          zip.readEntry();
        })().catch(reject);
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}

test('installed VSIX compiles, runs, debugs and deploys without a Pulse checkout or project dependencies', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-installed-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const manifest = JSON.parse(await fs.readFile(path.join(extension, 'package.json'), 'utf8'));
  await extract(path.join(extension, `pulse-pmachine-debugger-${manifest.version}.vsix`), temporary);
  const project = path.join(temporary, 'project');
  await fs.mkdir(project);
  await fs.copyFile(new URL('./runtime-probe.mjs', import.meta.url), path.join(temporary, 'probe.mjs'));
  const environment = { ...process.env };
  delete environment.NODE_PATH;
  delete environment.NODE_OPTIONS;
  const { stdout } = await execFileAsync(process.execPath, [path.join(temporary, 'probe.mjs')], {
    cwd: project,
    env: environment,
    timeout: 60000,
  });
  assert.match(stdout, /Portable compilation, JS execution, debugging and direct-node deployment passed/);
});
