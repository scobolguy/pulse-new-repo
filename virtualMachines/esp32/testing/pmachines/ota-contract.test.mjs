import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..', '..');
const source = path.join(here, 'ota-contract.test.cpp');
const output = path.join(project, '.pio', 'ota-contract.test.exe');

test('production OTA transaction contract passes native fault-injection cases', (t) => {
  const probe = spawnSync('g++', ['--version'], { encoding: 'utf8' });
  if (probe.error?.code === 'ENOENT') {
    t.skip('g++ is not installed');
    return;
  }
  assert.equal(probe.status, 0, probe.stderr);

  const build = spawnSync('g++', [
    '-std=c++17',
    '-Wall',
    '-Wextra',
    '-Werror',
    source,
    '-o',
    output,
  ], { cwd: project, encoding: 'utf8' });
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

  try {
    const run = spawnSync(output, [], { cwd: project, encoding: 'utf8' });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  } finally {
    rmSync(output, { force: true });
  }
});
