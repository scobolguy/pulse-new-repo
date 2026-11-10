import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { withNextSwarmResourceSequence } from '../src/backend/swarmResourceSequence.mjs';

test('resource report sequences persist across calls and failures', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-resource-sequence-'));
  t.after(() => fs.rm(directory, { recursive: true }));
  const filePath = path.join(directory, 'sequence.txt');

  assert.equal(await withNextSwarmResourceSequence({
    filePath, initialSequence: 10,
  }, async sequence => sequence), 10);
  await assert.rejects(withNextSwarmResourceSequence({
    filePath,
  }, async sequence => {
    assert.equal(sequence, 11);
    throw new Error('simulated lost acknowledgement');
  }), /simulated lost acknowledgement/);
  assert.equal(await withNextSwarmResourceSequence({
    filePath,
  }, async sequence => sequence), 12);
});

test('sequence allocation serializes concurrent reporters and rejects lock collisions', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-resource-sequence-'));
  t.after(() => fs.rm(directory, { recursive: true }));
  const filePath = path.join(directory, 'sequence.txt');
  let finishFirst;
  const firstInReport = new Promise(resolve => { finishFirst = resolve; });
  let finishReport;
  const pendingReport = new Promise(resolve => { finishReport = resolve; });
  const first = withNextSwarmResourceSequence({ filePath, initialSequence: 20 }, async sequence => {
    finishFirst();
    await pendingReport;
    return sequence;
  });
  await firstInReport;
  await assert.rejects(withNextSwarmResourceSequence({
    filePath, initialSequence: 20,
  }, async sequence => sequence), /sequence is locked/);
  finishReport();
  assert.equal(await first, 20);
  assert.equal(await withNextSwarmResourceSequence({
    filePath, initialSequence: 20,
  }, async sequence => sequence), 21);
});

test('malformed state fails closed without resetting the report sequence', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-resource-sequence-'));
  t.after(() => fs.rm(directory, { recursive: true }));
  const filePath = path.join(directory, 'sequence.txt');
  await fs.writeFile(filePath, 'not-a-sequence\n');
  await assert.rejects(withNextSwarmResourceSequence({
    filePath, initialSequence: 0,
  }, async sequence => sequence), /malformed/);
  assert.equal(await fs.readFile(filePath, 'utf8'), 'not-a-sequence\n');
});
