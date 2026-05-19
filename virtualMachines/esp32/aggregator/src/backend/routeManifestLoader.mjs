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
