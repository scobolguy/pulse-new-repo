/**
 * process-interaction-log.mjs
 *
 * Reads data/interaction-log.jsonl, joins interaction + feedback records,
 * and either prints a startup summary or writes a full processed report.
 *
 * Usage:
 *   node scripts/process-interaction-log.mjs                  # full report + write processed file
 *   node scripts/process-interaction-log.mjs --summary-only   # one-paragraph console summary (fast)
 *   node scripts/process-interaction-log.mjs --since 2026-07-27  # filter to records after a date
 *
 * Output (full mode):
 *   data/interaction-log-processed.jsonl  — one joined record per interaction
 *   data/interaction-log-report.json      — aggregated stats for dashboards / further tooling
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR     = path.resolve(__dirname, '../data');
const LOG_PATH     = path.join(DATA_DIR, 'interaction-log.jsonl');
const OUT_JSONL    = path.join(DATA_DIR, 'interaction-log-processed.jsonl');
const OUT_REPORT   = path.join(DATA_DIR, 'interaction-log-report.json');

const summaryOnly  = process.argv.includes('--summary-only');
const sinceArg     = (() => {
  const idx = process.argv.indexOf('--since');
  return idx !== -1 ? new Date(process.argv[idx + 1]) : null;
})();

// ── Read and parse the log ──────────────────────────────────────────────────

if (!fs.existsSync(LOG_PATH)) {
  console.log('[interaction-log] No interaction-log.jsonl found yet — nothing to process.');
  process.exit(0);
}

const lines = fs.readFileSync(LOG_PATH, 'utf8')
  .split('\n')
  .filter(Boolean);

const interactions = new Map();  // interactionId → interaction record
const feedbacks    = new Map();  // interactionId → feedback record (last one wins)

for (const line of lines) {
  let rec;
  try { rec = JSON.parse(line); } catch { continue; }

  if (sinceArg && rec.recordedAt && new Date(rec.recordedAt) < sinceArg) continue;

  if (rec.type === 'interaction') {
    interactions.set(rec.interactionId, rec);
  } else if (rec.type === 'feedback') {
    feedbacks.set(rec.interactionId, rec);
  }
}

// ── Join ────────────────────────────────────────────────────────────────────

const joined = [];
for (const [id, interaction] of interactions) {
  const feedback = feedbacks.get(id) || null;
  joined.push({
    interactionId: id,
    message:       interaction.message,
    intentId:      interaction.intentId,
    outputSummary: interaction.outputSummary,
    rating:        feedback?.rating   ?? null,
    expected:      feedback?.expected ?? null,
    recordedAt:    interaction.recordedAt,
    feedbackAt:    feedback?.recordedAt ?? null,
  });
}

// Sort by time ascending
joined.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

// ── Aggregate stats ─────────────────────────────────────────────────────────

const total      = joined.length;
const labelled   = joined.filter(r => r.rating !== null).length;
const good       = joined.filter(r => r.rating === 'good').length;
const bad        = joined.filter(r => r.rating === 'bad').length;
const unlabelled = total - labelled;
const fallback   = joined.filter(r => r.intentId === 'ollama-fallback').length;

// Intent frequency
const intentFreq = {};
for (const r of joined) {
  intentFreq[r.intentId] = (intentFreq[r.intentId] || 0) + 1;
}
const topIntents = Object.entries(intentFreq)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

// Bad rows with expected text
const badWithExpected = joined.filter(r => r.rating === 'bad' && r.expected);

// Good Ollama-fallback rows — candidates for fine-tuning positive examples
const goodFallback = joined.filter(r => r.rating === 'good' && r.intentId === 'ollama-fallback');

// ── Summary output (--summary-only) ────────────────────────────────────────

if (summaryOnly) {
  if (total === 0) {
    console.log('[interaction-log] No interactions recorded yet.');
    process.exit(0);
  }

  const pctLabelled = total > 0 ? Math.round((labelled / total) * 100) : 0;
  const pctGood     = labelled > 0 ? Math.round((good / labelled) * 100) : 0;

  console.log(`[interaction-log] ${total} interaction${total !== 1 ? 's' : ''} · ${labelled} labelled (${pctLabelled}%) · ${good} good / ${bad} bad (${pctGood}% positive) · ${fallback} Ollama fallback${fallback !== 1 ? 's' : ''}`);

  if (badWithExpected.length > 0) {
    console.log(`[interaction-log] ${badWithExpected.length} bad rating${badWithExpected.length !== 1 ? 's' : ''} with correction:`);
    for (const r of badWithExpected) {
      console.log(`  [${r.intentId}] "${r.message.slice(0, 70)}" → expected: "${r.expected.slice(0, 80)}"`);
    }
  }

  process.exit(0);
}

// ── Full mode ───────────────────────────────────────────────────────────────

// Write processed JSONL
const processedLines = joined.map(r => JSON.stringify(r)).join('\n') + '\n';
fs.writeFileSync(OUT_JSONL, processedLines, 'utf8');

// Write report JSON
const report = {
  generatedAt:    new Date().toISOString(),
  sinceFilter:    sinceArg ? sinceArg.toISOString() : null,
  totals: { total, labelled, unlabelled, good, bad, fallback },
  labelledPct:    total > 0 ? Math.round((labelled / total) * 100) : 0,
  goodPct:        labelled > 0 ? Math.round((good / labelled) * 100) : 0,
  topIntents,
  badWithExpected: badWithExpected.map(r => ({
    interactionId: r.interactionId,
    message:       r.message,
    intentId:      r.intentId,
    expected:      r.expected,
    recordedAt:    r.recordedAt,
  })),
  fineTuningCandidates: {
    positiveExamples: goodFallback.length,
    negativeExamples: badWithExpected.length,
    readyForFineTune: goodFallback.length >= 50,
    note: goodFallback.length < 50
      ? `Need ${50 - goodFallback.length} more labelled good Ollama-fallback responses before fine-tuning.`
      : 'Sufficient labelled data for a fine-tuning run.',
  },
};
fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2), 'utf8');

// Console output
console.log('\n── Interaction Log Report ─────────────────────────────────────');
console.log(`  Total interactions : ${total}`);
console.log(`  Labelled           : ${labelled} (${report.labelledPct}%)`);
console.log(`  Good / Bad         : ${good} / ${bad}${labelled > 0 ? ` (${report.goodPct}% positive)` : ''}`);
console.log(`  Ollama fallbacks   : ${fallback}`);
console.log('');
console.log('  Top intents:');
for (const [id, count] of topIntents) {
  console.log(`    ${String(count).padStart(4)}  ${id}`);
}

if (badWithExpected.length > 0) {
  console.log('');
  console.log(`  Bad ratings with corrections (${badWithExpected.length}):`);
  for (const r of badWithExpected) {
    console.log(`    [${r.intentId}]`);
    console.log(`      message  : ${r.message}`);
    console.log(`      expected : ${r.expected}`);
  }
}

console.log('');
console.log(`  Fine-tuning: ${report.fineTuningCandidates.note}`);
console.log('');
console.log(`  Written: ${OUT_JSONL}`);
console.log(`           ${OUT_REPORT}`);
console.log('───────────────────────────────────────────────────────────────\n');
