import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export const PROGRAM_SOURCE_ROOT = path.resolve(process.env.PULSE_PROGRAM_SOURCE_ROOT || path.join(workspaceRoot, 'src'));
export const PROGRAM_OBJECT_ROOT = path.resolve(process.env.PULSE_PROGRAM_OBJECT_ROOT || path.join(workspaceRoot, 'object'));

export function collectProjectDeploymentFiles(sourceRoot, objectRoot) {
  const files = [];
  const paths = new Set();
  const collect = (directory, root, source) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        collect(fullPath, root, source);
      } else if (entry.isFile() && (path.extname(entry.name).toLowerCase() === '.pas') === source) {
        const relativePath = path.relative(root, fullPath).replace(/\\/g, '/');
        if (paths.has(relativePath)) throw new Error(`Duplicate deployment path: ${relativePath}`);
        paths.add(relativePath);
        files.push({ fullPath, relativePath });
      }
    }
  };
  collect(objectRoot, objectRoot, false);
  collect(sourceRoot, sourceRoot, true);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}
