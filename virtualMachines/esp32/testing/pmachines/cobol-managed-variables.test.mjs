import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildGenericNative } from './build-generic-native.mjs';

test('generic native managed variables preserve aliases, decimals, frames and recovery', { timeout: 1800000 }, async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cobol-managed-'));
  try {
    const executable = path.join(directory, 'test.exe');
    buildGenericNative(path.join(root, 'testing', 'pmachines', 'cobol-managed-variables.test.cpp'), executable);
    const run = spawnSync(executable, [], { encoding: 'utf8', windowsHide: true });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout + run.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
