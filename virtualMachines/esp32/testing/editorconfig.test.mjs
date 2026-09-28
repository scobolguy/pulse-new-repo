import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const editorConfig = await readFile(path.join(workspaceRoot, '.editorconfig'), 'utf8');

for (const requirement of [
  'root = true',
  '[*.{js,jsx,mjs,cjs,json,jsonc,yml,yaml,css,html}]',
  '[*.{cpp,c,h,hpp}]',
  '[*.{ps1,psm1}]',
  '[*.bat]',
  'end_of_line = crlf',
  '[*.md]'
]) {
  if (!editorConfig.includes(requirement)) {
    throw new Error(`EditorConfig is missing ${requirement}`);
  }
}

console.log('[editorconfig] OK: cross-language formatting conventions are defined');