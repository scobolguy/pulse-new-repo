/**
 * Ollama Query Route Loader
 *
 * Loads query routing rules from data/ollama-query-routes.json and exposes
 * helper functions for matching queries against those rules.
 * Add new routes by editing the JSON file — no code changes needed.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_PATH = path.resolve(__dirname, '../../data/ollama-query-routes.json');

let cachedRoutes = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000; // Reload every 30s so edits take effect without restart

async function loadRoutes() {
  const now = Date.now();
  if (cachedRoutes && (now - cacheLoadedAt) < CACHE_TTL_MS) return cachedRoutes;
  try {
    const text = await fs.readFile(ROUTES_PATH, 'utf-8');
    cachedRoutes = JSON.parse(text);
    cacheLoadedAt = now;
    return cachedRoutes;
  } catch (err) {
    console.warn('[QueryRoutes] Failed to load routes file:', err.message);
    return cachedRoutes || { routes: [], precomputed: [], queryTypeDetectors: [] };
  }
}

/**
 * Build a single RegExp from an array of pattern strings joined by |
 */
function buildRegex(patterns, flags = 'i') {
  return new RegExp(patterns.map(p => `(?:${p})`).join('|'), flags);
}

/**
 * Test if query matches any pattern in the array
 */
function matchesAny(query, patterns, flags = 'i') {
  return buildRegex(patterns, flags).test(query);
}

/**
 * Find the first pascal-execute route that matches the query.
 * Returns { route, capturedValue } or null.
 */
export async function matchPascalExecuteRoute(query) {
  const config = await loadRoutes();
  for (const route of (config.routes || [])) {
    if (route.type !== 'pascal-execute') continue;
    // Try each pattern individually to get the captured group
    for (const pattern of (route.patterns || [])) {
      const re = new RegExp(pattern, route.flags || 'i');
      const m = query.match(re);
      if (m) {
        // Find first non-null capture group
        const captured = m.slice(1).find(g => g != null) ?? null;
        return { route, capturedValue: captured };
      }
    }
  }
  return null;
}

/**
 * Find a precomputed answer type matching the query.
 * Returns the precomputed route's type string, or null.
 */
export async function matchPrecomputedRoute(query) {
  const config = await loadRoutes();
  for (const pre of (config.precomputed || [])) {
    if (matchesAny(query, pre.patterns, pre.flags || '')) {
      return pre.type;
    }
  }
  return null;
}

/**
 * Detect all matching query types (tree-query, nodes-query, etc.)
 * Returns a Set of type strings.
 */
export async function detectQueryTypes(query) {
  const config = await loadRoutes();
  const matched = new Set();
  for (const detector of (config.queryTypeDetectors || [])) {
    if (matchesAny(query, detector.patterns, detector.flags || 'i')) {
      // Check excludeIfAlso
      if (detector.excludeIfAlso && matched.has(detector.excludeIfAlso)) continue;
      matched.add(detector.type);
    }
  }
  return matched;
}

/**
 * Force-reload the routes cache (useful for testing).
 */
export async function reloadRoutes() {
  cachedRoutes = null;
  return await loadRoutes();
}

export { loadRoutes };
