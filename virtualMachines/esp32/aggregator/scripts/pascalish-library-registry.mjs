import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Libraries live next to the compiler, so resolution does not depend on cwd.
const librariesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'libraries');

export function libraryDirectory(id) {
  return path.join(librariesRoot, String(id || '').trim());
}

export function resolveLibrary(id) {
  const name = String(id || '').trim();
  if (!name) throw new Error('[PASCALISH-PROGRAM] Empty library id');

  const manifestPath = path.join(libraryDirectory(name), 'library.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`[PASCALISH-PROGRAM] Unknown library "${name}" (no manifest at ${manifestPath})`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const sourcePath = path.join(libraryDirectory(name), manifest.source || `${name}.pas`);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`[PASCALISH-PROGRAM] Library "${name}" declares source "${manifest.source}" which does not exist`);
  }

  return {
    id: manifest.id || name,
    version: manifest.version || '0.0.0',
    provides: manifest.provides || {},
    sourcePath,
    sourceText: fs.readFileSync(sourcePath, 'utf-8')
  };
}
