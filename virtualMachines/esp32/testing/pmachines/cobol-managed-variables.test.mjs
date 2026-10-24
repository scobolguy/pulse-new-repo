import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('native COBOL managed variables preserve aliases, decimals, frames and recovery', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cobol-managed-'));
  try {
    const executable = path.join(directory, 'test.exe');
    const sources = ['cobol_vm.cpp', 'cobol_vm_text.cpp', 'cobol_vm_bindings.cpp']
      .map(name => path.join(root, 'pmachines', 'arduino', 'src', name));
    const build = spawnSync('g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror',
      path.join(root, 'testing', 'pmachines', 'cobol-managed-variables.test.cpp'),
      ...sources, '-o', executable], { encoding: 'utf8', windowsHide: true });
    assert.ifError(build.error);
    assert.equal(build.status, 0, build.stdout + build.stderr);
    const run = spawnSync(executable, [], { encoding: 'utf8', windowsHide: true });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout + run.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
