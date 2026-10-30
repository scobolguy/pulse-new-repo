import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('native HAL debounces stable edges, coalesces timers and handles clock wrap', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pulse-assemblerish-'));
  try {
    const executable = path.join(directory, process.platform === 'win32' ? 'trigger.exe' : 'trigger');
    const source = fileURLToPath(new URL('./assemblerish-trigger.test.cpp', import.meta.url));
    for (const [command, args] of [
      ['g++', ['-std=c++11', '-Wall', '-Wextra', '-Werror', source, '-o', executable]],
      [executable, []],
    ]) {
      const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
      assert.ifError(result.error);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
