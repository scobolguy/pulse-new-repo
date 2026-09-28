import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const aggregatorRoot = path.join(workspaceRoot, 'aggregator');

const checks = [
  ['pcode compatibility', 'scripts/check-pcode-compat.mjs'],
  ['opcode behavior', 'scripts/test-js-pmachine-spec-opcodes.mjs'],
  ['negative opcode behavior', 'scripts/test-js-pmachine-negative-opcodes.mjs'],
  ['failure paths', 'scripts/test-js-pmachine-failure-paths.mjs'],
  ['canonical types', 'scripts/test-js-pmachine-canonical-types.mjs'],
  ['debugger integration', 'scripts/test-javascript-pmachine-debugger.mjs'],
  ['deployment supervisor', 'scripts/verify-js-deployment-supervisor.mjs']
];

function runCheck(name, scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: aggregatorRoot,
      stdio: 'inherit',
      windowsHide: true
    });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) return resolve();
      return reject(new Error(`${name} failed with exit code ${code}`));
    });
  });
}

for (const [name, scriptPath] of checks) {
  console.log(`[pmachine-js-suite] Running ${name}`);
  await runCheck(name, scriptPath);
}

console.log(`[pmachine-js-suite] PASS: ${checks.length} checks completed`);