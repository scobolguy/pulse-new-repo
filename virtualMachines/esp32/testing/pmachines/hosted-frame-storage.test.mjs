import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const workspace = fileURLToPath(new URL('../../', import.meta.url));

test('ESP32 hosted frame storage runs on desktop with heap allocations denied', async () => {
  const results = path.join(workspace, 'runtime', 'test-results');
  await mkdir(results, { recursive: true });
  const directory = await mkdtemp(path.join(results, 'pulse-hosted-slots-'));
  try {
    for (const name of ['hosted-frame-storage', 'host-call-storage', 'managed-heap', 'managed-objects']) {
      const executable = path.join(directory, `${name}${process.platform === 'win32' ? '.exe' : ''}`);
      const build = spawnSync('g++', ['-std=c++11', '-Wall', '-Wextra', '-Werror',
        path.join(workspace, 'testing', 'pmachines', `${name}.test.cpp`), '-o', executable],
      { encoding: 'utf8', windowsHide: true });
      assert.ifError(build.error);
      assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
      const run = spawnSync(executable, [], { encoding: 'utf8', windowsHide: true });
      assert.ifError(run.error);
      assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
