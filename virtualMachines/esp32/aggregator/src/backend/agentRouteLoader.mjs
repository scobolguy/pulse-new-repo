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
 * Returns the full intent object, or null if nothing matches.
 */
export async function matchAgentIntent(message) {
  const config = await loadRoutes();
  for (const intent of (config.intents || [])) {
    const flags = intent.flags ?? 'i';
    const matched = (intent.patterns || []).some(p => new RegExp(p, flags).test(message));
    if (matched) return intent;
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
