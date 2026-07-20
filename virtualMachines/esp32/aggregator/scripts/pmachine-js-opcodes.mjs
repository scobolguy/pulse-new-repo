import fs from 'fs/promises';
import path from 'path';

async function resolveManifestPath() {
  const candidates = [
    path.resolve(process.cwd(), 'pcode', 'pcode-opcodes.manifest.json'),
    path.resolve(process.cwd(), '..', 'pcode', 'pcode-opcodes.manifest.json')
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next likely workspace root.
    }
  }

  return candidates[0];
}

export async function loadOpcodeManifest() {
  const manifestPath = await resolveManifestPath();
  const raw = await fs.readFile(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

export async function loadOpcodeMap() {
  const manifest = await loadOpcodeManifest();
  const map = new Map();
  for (const op of manifest.opcodes || []) {
    map.set(op.name, Number.parseInt(String(op.hex || '0x0').trim(), 16));
  }
  return map;
}
