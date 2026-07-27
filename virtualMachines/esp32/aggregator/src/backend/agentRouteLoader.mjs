/**
 * Agent Route Loader
 *
 * Loads intent-dispatch rules from data/agent-routes.json and exposes
 * matchAgentIntent(message) to find the first matching intent.
 *
 * Add new intents by editing the JSON file — no code changes needed.
 * The cache refreshes every 30 seconds so edits take effect without a restart.
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

/**
 * Find the first intent whose patterns match the given message.
 * Returns { intent, captures } where captures is a Map of named capture
 * groups (or positional groups) from the intent's optional `capture` pattern,
 * or null if nothing matches.
 */
export async function matchAgentIntent(message) {
  const config = await loadRoutes();
  for (const intent of (config.intents || [])) {
    const flags = intent.flags ?? 'i';
    const matched = (intent.patterns || []).some(p => new RegExp(p, flags).test(message));
    if (!matched) continue;

    // Run the optional capture pattern to extract values from the message
    let captures = {};
    if (intent.capture) {
      const m = message.match(new RegExp(intent.capture, intent.captureFlags ?? 'i'));
      if (m) {
        // Named groups take priority, fall back to positional
        captures = m.groups ?? {};
        if (Object.keys(captures).length === 0 && m[1]) captures = { value: m[1] };
      }
    }

    return { intent, captures };
  }
  return null;
}

/**
 * Force-reload the cache (useful for testing).
 */
export async function reloadAgentRoutes() {
  cachedRoutes = null;
  return await loadRoutes();
}
