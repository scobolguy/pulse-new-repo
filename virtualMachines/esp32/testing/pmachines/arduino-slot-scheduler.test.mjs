import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildGenericNative } from './build-generic-native.mjs';

test('Arduino interpreter executes shared Kotlin scheduler at full slot capacity and restores it', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pulse-arduino-slots-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, process.platform === 'win32' ? 'scheduler.exe' : 'scheduler');
  buildGenericNative(fileURLToPath(new URL('./arduino-slot-scheduler.test.cpp', import.meta.url)),
    executable, { hostLibrary: false });
  const result = spawnSync(executable, [], { encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /executed sixteen-slot Kotlin scheduler and recovery/);
});
