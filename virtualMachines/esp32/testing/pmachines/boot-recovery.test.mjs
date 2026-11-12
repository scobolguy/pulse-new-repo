import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveFixedBootProgram, FIXED_BOOT_FILE } from '../../aggregator/src/backend/modules/pmachineBoot.mjs';

test('fixed boot resolver enters recovery when the immutable boot file is absent', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-boot-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const result = await resolveFixedBootProgram(root);
  assert.equal(result.state, 'recovery');
  assert.equal(result.reason, 'fixed boot file is missing');
  assert.equal(result.file, path.join(root, FIXED_BOOT_FILE));
});

test('fixed boot resolver accepts the fixed executable only', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-boot-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, FIXED_BOOT_FILE);
  await fs.writeFile(file, 'boot');
  await fs.chmod(file, 0o755);
  const result = await resolveFixedBootProgram(root);
  assert.equal(result.state, 'ready');
  assert.equal(result.file, file);
});
