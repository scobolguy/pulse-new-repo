import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildGenericNative } from './build-generic-native.mjs';

test('Arduino PMachine runs shipped boot P-code with its real bounded execution storage', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pulse-native-boot-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, process.platform === 'win32' ? 'boot.exe' : 'boot');
  buildGenericNative(fileURLToPath(new URL('./boot-supervisor-native.test.cpp', import.meta.url)),
    executable, { hostLibrary: false });
  const result = spawnSync(executable, [
    fileURLToPath(new URL('../../data/boot/pmachine-boot', import.meta.url))
  ], { encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /executed local boot P-code successfully/);
});
