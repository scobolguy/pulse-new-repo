/**
 * Route Manifest Loader
 *
 * Reads the route role manifest from data/route-manifest.json at startup.
 * To enable or disable a route group, edit the JSON file and restart the backend.
 * No code changes are needed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.resolve(__dirname, '../../data/route-manifest.json');

/**
 * Load and return the route manifest array from data/route-manifest.json.
 * Throws if the file is missing or malformed so startup fails loudly.
 */
export function loadRouteManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.routes)) {
    throw new Error(`[ROUTES] route-manifest.json must contain a "routes" array`);
  }
  console.log(`[ROUTES] Loaded route-manifest.json — ${parsed.routes.length} entries (${parsed.routes.filter(r => r.enabled !== false).length} enabled)`);
  return parsed.routes;
}

/**
 * Register all enabled routes from the manifest.
 * Each entry must have a matching registrar function and dependency factory.
 */
export function registerRoutesFromManifest({ app, manifest, registrars, dependencyFactories }) {
  for (const entry of manifest || []) {
    if (!entry || entry.enabled === false) continue;

    const register = registrars?.[entry.registrar];
    if (typeof register !== 'function') {
      throw new Error(`[ROUTES] Registrar not found: ${entry.registrar}`);
    }

    const buildDeps = dependencyFactories?.[entry.dependencyKey];
    if (typeof buildDeps !== 'function') {
      throw new Error(`[ROUTES] Dependency factory not found: ${entry.dependencyKey}`);
    }

    register(app, buildDeps());
  }
}
