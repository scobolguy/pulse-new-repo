import fs from 'node:fs';
import path from 'node:path';
import { getNliConfig } from './nliConfig.mjs';

const INTERACTION_LOG_PATH = path.resolve(process.env.NLI_INTERACTION_LOG_PATH || './data/interaction-log.jsonl');
const CORRECTIONS_PATH = path.resolve(process.env.NLI_CORRECTIONS_PATH || './data/nli-corrections.json');
const STATE_PATH = path.resolve(process.env.NLI_CORRECTION_STATE_PATH || './data/nli-corrections-state.generated.json');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readInteractionLog() {
  try {
    return fs.readFileSync(INTERACTION_LOG_PATH, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .flatMap((line) => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
  } catch {
    return [];
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

export function getPendingNliCorrections() {
  const records = readInteractionLog();
  const interactions = new Map(
    records.filter(record => record.type === 'interaction' && record.interactionId)
      .map(record => [record.interactionId, record]),
  );
  const feedbackByInteraction = new Map();
  for (const record of records) {
    if (record.type !== 'feedback' || record.rating !== 'bad' || !String(record.expected || '').trim()) continue;
    feedbackByInteraction.set(record.interactionId, record);
  }

  const appliedIds = new Set(readJson(STATE_PATH, { appliedInteractionIds: [] }).appliedInteractionIds || []);
  const baselineTime = Date.parse(getNliConfig().corrections.baselineAt || '') || 0;
  const pending = [];
  for (const [interactionId, feedback] of feedbackByInteraction) {
    const interaction = interactions.get(interactionId);
    if (!interaction || appliedIds.has(interactionId)) continue;
    if ((Date.parse(feedback.recordedAt || '') || 0) <= baselineTime) continue;
    pending.push({
      interactionId,
      message: String(interaction.message || '').trim(),
      expected: String(feedback.expected || '').trim(),
      previousIntentId: interaction.intentId || null,
      recordedAt: feedback.recordedAt || null,
    });
  }
  return pending.sort((left, right) => String(left.recordedAt).localeCompare(String(right.recordedAt)));
}

export function getNliCorrectionStatus() {
  const pending = getPendingNliCorrections();
  return { pendingCount: pending.length, pending };
}

export function runPendingNliCorrections() {
  const pending = getPendingNliCorrections();
  if (pending.length === 0) return { appliedCount: 0, pendingCount: 0, applied: [] };

  const document = readJson(CORRECTIONS_PATH, { version: 1, corrections: [] });
  const existing = Array.isArray(document.corrections) ? document.corrections : [];
  const existingIds = new Set(existing.map(correction => correction.interactionId));
  const appliedAt = new Date().toISOString();
  const additions = pending.filter(correction => !existingIds.has(correction.interactionId)).map(correction => ({
    ...correction,
    enabled: true,
    appliedAt,
  }));
  writeJsonAtomic(CORRECTIONS_PATH, { ...document, version: 1, corrections: [...existing, ...additions] });

  const state = readJson(STATE_PATH, { appliedInteractionIds: [] });
  const appliedInteractionIds = [...new Set([...(state.appliedInteractionIds || []), ...pending.map(item => item.interactionId)])];
  writeJsonAtomic(STATE_PATH, { version: 1, appliedInteractionIds, updatedAt: appliedAt });

  return { appliedCount: pending.length, pendingCount: 0, applied: pending };
}

export function loadNliCorrections() {
  const document = readJson(CORRECTIONS_PATH, { corrections: [] });
  return (Array.isArray(document.corrections) ? document.corrections : []).filter(correction => correction.enabled !== false);
}

export { CORRECTIONS_PATH, INTERACTION_LOG_PATH, STATE_PATH };