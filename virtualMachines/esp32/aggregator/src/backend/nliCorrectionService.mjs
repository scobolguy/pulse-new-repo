import fs from 'node:fs';
import path from 'node:path';
import { getNliConfig } from './nliConfig.mjs';

const INTERACTION_LOG_PATH = path.resolve(process.env.NLI_INTERACTION_LOG_PATH || './data/interaction-log.jsonl');
const CORRECTIONS_PATH = path.resolve(process.env.NLI_CORRECTIONS_PATH || './data/nli-corrections.json');
const STATE_PATH = path.resolve(process.env.NLI_CORRECTION_STATE_PATH || './data/nli-corrections-state.generated.json');
const ESCALATION_FALLBACK_PATH = path.resolve(
  process.env.NLI_CORRECTION_ESCALATION_PATH || './data/nli-correction-escalations.jsonl',
);

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

function normalizeMessage(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function appendEscalationFallback(packet) {
  fs.mkdirSync(path.dirname(ESCALATION_FALLBACK_PATH), { recursive: true });
  fs.appendFileSync(ESCALATION_FALLBACK_PATH, `${JSON.stringify(packet)}\n`, 'utf8');
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

  const correctionState = readJson(STATE_PATH, { appliedInteractionIds: [], escalatedInteractionIds: [] });
  const handledIds = new Set([
    ...(correctionState.appliedInteractionIds || []),
    ...(correctionState.escalatedInteractionIds || []),
  ]);
  const baselineTime = Date.parse(getNliConfig().corrections.baselineAt || '') || 0;
  const pending = [];
  for (const [interactionId, feedback] of feedbackByInteraction) {
    const interaction = interactions.get(interactionId);
    if (!interaction || handledIds.has(interactionId)) continue;
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

export async function runPendingNliCorrections({ enqueueEscalation = null } = {}) {
  const pending = getPendingNliCorrections();
  if (pending.length === 0) {
    return { appliedCount: 0, escalatedCount: 0, pendingCount: 0, applied: [], escalated: [] };
  }

  const document = readJson(CORRECTIONS_PATH, { version: 1, corrections: [] });
  const existing = Array.isArray(document.corrections) ? document.corrections : [];
  const existingIds = new Set(existing.map(correction => correction.interactionId));
  const existingByMessage = new Map();
  for (const correction of existing.filter(item => item.enabled !== false)) {
    const key = normalizeMessage(correction.message);
    if (!key) continue;
    const matches = existingByMessage.get(key) || [];
    matches.push(correction);
    existingByMessage.set(key, matches);
  }

  const appliedAt = new Date().toISOString();
  const escalated = [];
  const locallyApplicable = [];
  for (const correction of pending) {
    const priorCorrections = existingByMessage.get(normalizeMessage(correction.message)) || [];
    if (priorCorrections.length === 0) {
      locallyApplicable.push(correction);
      continue;
    }

    const packet = {
      type: 'nli-correction-escalation',
      queue: 'nli.corrections.escalation',
      reason: 'repeat-failure-after-local-correction',
      requestedModelClass: 'larger-model',
      escalatedAt: appliedAt,
      problem: correction,
      priorCorrections: priorCorrections.map(item => ({
        interactionId: item.interactionId,
        expected: item.expected,
        appliedAt: item.appliedAt || null,
      })),
    };

    try {
      if (typeof enqueueEscalation === 'function') await enqueueEscalation(packet);
      else appendEscalationFallback(packet);
    } catch (error) {
      packet.queueError = error?.message || String(error);
      appendEscalationFallback(packet);
    }
    escalated.push(correction);
  }

  const additions = locallyApplicable.filter(correction => !existingIds.has(correction.interactionId)).map(correction => ({
    ...correction,
    enabled: true,
    appliedAt,
  }));
  if (additions.length > 0) {
    writeJsonAtomic(CORRECTIONS_PATH, { ...document, version: 1, corrections: [...existing, ...additions] });
  }

  const state = readJson(STATE_PATH, { appliedInteractionIds: [], escalatedInteractionIds: [] });
  const appliedInteractionIds = [
    ...new Set([...(state.appliedInteractionIds || []), ...locallyApplicable.map(item => item.interactionId)]),
  ];
  const escalatedInteractionIds = [
    ...new Set([...(state.escalatedInteractionIds || []), ...escalated.map(item => item.interactionId)]),
  ];
  writeJsonAtomic(STATE_PATH, { version: 1, appliedInteractionIds, escalatedInteractionIds, updatedAt: appliedAt });

  return {
    appliedCount: locallyApplicable.length,
    escalatedCount: escalated.length,
    pendingCount: 0,
    applied: locallyApplicable,
    escalated,
  };
}

export function loadNliCorrections() {
  const document = readJson(CORRECTIONS_PATH, { corrections: [] });
  return (Array.isArray(document.corrections) ? document.corrections : []).filter(correction => correction.enabled !== false);
}

export { CORRECTIONS_PATH, ESCALATION_FALLBACK_PATH, INTERACTION_LOG_PATH, STATE_PATH };