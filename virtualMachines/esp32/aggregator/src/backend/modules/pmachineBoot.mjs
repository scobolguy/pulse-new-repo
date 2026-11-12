import fs from 'node:fs/promises';
import path from 'node:path';

export const FIXED_BOOT_FILE = 'pmachine-boot';

function safeBootDirectory(value) {
  const directory = path.resolve(String(value || ''));
  if (!directory || directory === path.parse(directory).root) {
    throw new Error('A non-root pmachine boot directory is required');
  }
  return directory;
}

export async function resolveFixedBootProgram(bootDirectory) {
  const directory = safeBootDirectory(bootDirectory);
  const file = path.join(directory, FIXED_BOOT_FILE);
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) return { state: 'recovery', reason: 'fixed boot file is not a regular file', file };
    await fs.access(file, fs.constants.X_OK);
    return { state: 'ready', file };
  } catch (error) {
    if (error.code === 'EACCES') return { state: 'recovery', reason: 'fixed boot file is not executable', file };
    if (error.code === 'ENOENT') return { state: 'recovery', reason: 'fixed boot file is missing', file };
    throw error;
  }
}
