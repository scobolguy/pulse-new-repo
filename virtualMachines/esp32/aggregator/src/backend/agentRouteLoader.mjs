/**
 * Agent Route Loader
 *
 * Loads intent-dispatch rules from data/agent-routes.json and exposes
 * matchAgentIntent(message) to find the first matching intent.
 *
 * Two intent versions coexist:
 *
 *   v1 (legacy)  – intent has "patterns": [...] for matching + optional "capture" for slot
 *                  extraction.  First matching intent wins (ordered).
 *
 *   v2 (slot-first) – the config root has a "slots" dictionary of named extractors.
 *                  The loader extracts ALL slots from the message once, then picks the
 *                  highest-scoring intent whose "requires" slots are all present and
 *                  "excludes" slots are all absent.
 *                  Resolves the ordering/cross-cutting-modifier problems that plague v1.
 *
 * Add new intents by editing data/agent-routes.json — no code changes needed.
 * The cache refreshes every 30 seconds so changes take effect without a restart.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_PATH = path.resolve(__dirname, '../../data/agent-routes.json');

let cachedRoutes = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000;

async function loadRoutes() {
  const now = Date.now();
  if (cachedRoutes && (now - cacheLoadedAt) < CACHE_TTL_MS) return cachedRoutes;
  try {
    const text = await fs.readFile(ROUTES_PATH, 'utf-8');
    cachedRoutes = JSON.parse(text);
    cacheLoadedAt = now;
    return cachedRoutes;
  } catch (err) {
    console.warn('[AgentRoutes] Failed to load agent-routes.json:', err.message);
    return cachedRoutes || { intents: [] };
  }
}

// ── V2: slot extraction ────────────────────────────────────────────────────────

/**
 * Run every slot extractor defined in config.slots against the message.
 * Returns a plain object: { SLOT_NAME: matchedString | true, ... }
 * Slots whose regex has no named/positional group yield `true` (presence flag).
 */
function extractSlots(message, slotDefs) {
  if (!slotDefs || typeof slotDefs !== 'object') return {};
  const found = {};
  for (const [name, pattern] of Object.entries(slotDefs)) {
    const m = message.match(new RegExp(pattern, 'is'));
    if (!m) continue;
    // Use first named group value, then first positional group, then presence flag
    const groups = m.groups || {};
    const namedVal = groups[name];
    if (namedVal !== undefined) {
      found[name] = namedVal;
    } else if (m[1] !== undefined) {
      found[name] = m[1];
    } else {
      found[name] = true; // presence flag
    }
  }
  return found;
}

/**
 * Pick the highest-scoring v2 intent whose requires/excludes are satisfied.
 */
function matchV2Intent(intents, slots) {
  let best = null;
  let bestScore = -Infinity;

  for (const intent of intents) {
    if (intent.version !== 2) continue;

    const requires = Array.isArray(intent.requires) ? intent.requires : [];
    const excludes = Array.isArray(intent.excludes) ? intent.excludes : [];
    const score    = Number(intent.score ?? 0);

    if (requires.some(s => !(s in slots))) continue;   // missing required slot
    if (excludes.some(s => s in slots))    continue;   // disqualifying slot present

    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }

  return best;
}

// ── V1: pattern matching (unchanged) ──────────────────────────────────────────

function matchV1Intent(intents, message) {
  for (const intent of intents) {
    if (intent.version === 2) continue;
    const flags   = intent.flags ?? 'i';
    const matched = (intent.patterns || []).some(p => new RegExp(p, flags).test(message));
    if (!matched) continue;

    let captures = {};
    if (intent.capture) {
      const m = message.match(new RegExp(intent.capture, intent.captureFlags ?? 'i'));
      if (m) {
        captures = m.groups ?? {};
        if (Object.keys(captures).length === 0 && m[1]) captures = { value: m[1] };
      }
    }
    return { intent, captures };
  }
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Find the best intent for the given message.
 *
 * Strategy:
 *   1. Extract all v2 slots from the message.
 *   2. If any v2 intent matches (requires satisfied, excludes absent), use the
 *      highest-scoring one.  Captures = all extracted slots.
 *   3. Otherwise fall through to v1 first-match ordered scan.
 */
export async function matchAgentIntent(message) {
  const config  = await loadRoutes();
  const intents = config.intents || [];

  // ── v2 path ──
  const slots   = extractSlots(message, config.slots || {});
  const v2match = matchV2Intent(intents, slots);
  if (v2match) {
    return { intent: v2match, captures: slots };
  }

  // ── v1 path ──
  return matchV1Intent(intents, message);
}

/**
 * Force-reload the cache (useful for testing).
 */
export async function reloadAgentRoutes() {
  cachedRoutes = null;
  return await loadRoutes();
}

/**
 * Exported for unit tests — run slot extraction against a given slots dict.
 */
export { extractSlots, matchV2Intent, matchV1Intent };
