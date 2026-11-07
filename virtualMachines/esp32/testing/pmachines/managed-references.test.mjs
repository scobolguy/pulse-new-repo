import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('generic reference handles are bounded and frame identities cannot alias after return', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'managed-references-'));
  try {
    const executable = path.join(directory, 'test.exe');
    const source = fileURLToPath(new URL('./managed-references.test.cpp', import.meta.url));
    const build = spawnSync('g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', source, '-o', executable],
      { encoding: 'utf8', windowsHide: true });
    assert.ifError(build.error);
    assert.equal(build.status, 0, build.stdout + build.stderr);
    const run = spawnSync(executable, [], { encoding: 'utf8', windowsHide: true });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout + run.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
