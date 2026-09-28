import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendSource = await readFile(path.join(workspaceRoot, 'aggregator', 'backend.mjs'), 'utf8');
const launcherSource = await readFile(path.join(workspaceRoot, 'start-backend.bat'), 'utf8');

const backendRequirements = [
  'PULSE_OPERATIONAL_DATA_ROOT',
  'PULSE_QUEUE_DATA_ROOT',
  'PULSE_RUNTIME_DATA_ROOT',
  'Runtime writes to workspace data are disabled'
];

for (const requirement of backendRequirements) {
  if (!backendSource.includes(requirement)) {
    throw new Error(`Backend runtime-data policy is missing ${requirement}`);
  }
}

const launcherRequirements = [
  'PULSE_LIBRARIAN_DATA_ROOT',
  'set "PULSE_LIBRARIAN_DATA_ROOT=%PULSE_RUNTIME_DATA_ROOT%"',
  'set "LIBRARIAN_DATA_ROOT=%PULSE_LIBRARIAN_DATA_ROOT%"'
];

for (const requirement of launcherRequirements) {
  if (!launcherSource.includes(requirement)) {
    throw new Error(`Backend launcher runtime-data policy is missing ${requirement}`);
  }
}

if (launcherSource.includes('set "LIBRARIAN_DATA_ROOT=%AGGREGATOR_DIR%\\data"')) {
  throw new Error('Backend launcher still defaults librarian data to the source checkout');
}

console.log('[runtime-data-policy] OK: runtime and librarian data default outside the source checkout');