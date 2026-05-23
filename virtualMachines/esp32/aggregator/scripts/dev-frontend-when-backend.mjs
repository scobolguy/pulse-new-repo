import { spawn } from 'node:child_process';

const backendHealthUrl = process.env.BACKEND_HEALTH_URL || 'http://localhost:4000/api/authz/me?userId=system-admin';
const waitTimeoutMs = Number(process.env.BACKEND_WAIT_TIMEOUT_MS || 180000);
const pollIntervalMs = Number(process.env.BACKEND_WAIT_POLL_MS || 2000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBackend() {
  const deadline = Date.now() + waitTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(backendHealthUrl, { method: 'GET' });
      if (response.ok) {
        process.stdout.write(`Backend is ready at ${backendHealthUrl}\n`);
        return;
      }
      process.stdout.write(`Backend not ready (${response.status}). Retrying...\n`);
    } catch {
      process.stdout.write('Backend not reachable yet. Retrying...\n');
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for backend after ${waitTimeoutMs}ms (${backendHealthUrl})`);
}

async function main() {
  await waitForBackend();

  const child = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    env: process.env
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exit(1);
});
