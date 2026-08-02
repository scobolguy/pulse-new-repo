import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-nli-corrections-'));
const interactionLogPath = path.join(temporaryDirectory, 'interaction-log.jsonl');
const correctionsPath = path.join(temporaryDirectory, 'nli-corrections.json');
const statePath = path.join(temporaryDirectory, 'correction-state.json');

process.env.NLI_INTERACTION_LOG_PATH = interactionLogPath;
process.env.NLI_CORRECTIONS_PATH = correctionsPath;
process.env.NLI_CORRECTION_STATE_PATH = statePath;

const records = [
  { type: 'interaction', interactionId: 'old-1', message: 'old message', intentId: 'old', recordedAt: '2026-08-01T20:00:00.000Z' },
  { type: 'feedback', interactionId: 'old-1', rating: 'bad', expected: 'old guidance', recordedAt: '2026-08-01T20:01:00.000Z' },
  { type: 'interaction', interactionId: 'new-1', message: 'show the new view', intentId: 'ollama-fallback', recordedAt: '2026-08-03T20:00:00.000Z' },
  { type: 'feedback', interactionId: 'new-1', rating: 'bad', expected: 'use the compact view', recordedAt: '2026-08-03T20:01:00.000Z' },
  { type: 'feedback', interactionId: 'new-1', rating: 'bad', expected: 'use the compact view', recordedAt: '2026-08-03T20:01:01.000Z' },
];

try {
  fs.writeFileSync(interactionLogPath, `${records.map(record => JSON.stringify(record)).join('\n')}\n`, 'utf8');
  fs.writeFileSync(correctionsPath, '{"version":1,"corrections":[]}\n', 'utf8');

  const service = await import(`../src/backend/nliCorrectionService.mjs?test=${Date.now()}`);
  let status = service.getNliCorrectionStatus();
  assert.equal(status.pendingCount, 1);
  assert.equal(status.pending[0].interactionId, 'new-1');

  const result = service.runPendingNliCorrections();
  assert.equal(result.appliedCount, 1);
  status = service.getNliCorrectionStatus();
  assert.equal(status.pendingCount, 0);

  const promoted = JSON.parse(fs.readFileSync(correctionsPath, 'utf8'));
  assert.equal(promoted.corrections.length, 1);
  assert.equal(promoted.corrections[0].expected, 'use the compact view');

  console.log('[nli-corrections] PASS: baseline, deduplication, promotion, and applied state');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}