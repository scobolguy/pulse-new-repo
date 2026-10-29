import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

async function resolveManifestPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'shared', 'contracts', 'pcode-opcodes.manifest.json');
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