const base = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000';
const managerId = process.env.MANAGER_ID || 'qm-primary-local';

const res = await fetch(`${base}/api/queues/${encodeURIComponent(managerId)}/config`, {
  headers: { 'x-user-id': 'system-admin' },
  signal: AbortSignal.timeout(10000)
});
const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status} ${text.slice(0, 400)}`);
  process.exit(1);
}
let payload = {};
try { payload = JSON.parse(text); } catch {}
const queues = Object.keys(payload?.queues || {});
console.log(JSON.stringify({ managerId, queueCount: queues.length, queues, payload }, null, 2));
