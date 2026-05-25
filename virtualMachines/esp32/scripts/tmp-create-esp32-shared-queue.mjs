const base = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4000';
const managerId = process.env.MANAGER_ID || 'qm-primary-local';
const queueName = process.env.QUEUE_NAME || 'esp32.shared.inbound';
const dataTypeId = process.env.DATA_TYPE_ID || 'text-string';

const body = {
  queueName,
  config: {
    createdByUser: true,
    queueClass: 'permanent',
    dataTypeId
  }
};

const res = await fetch(`${base}/api/queues/${encodeURIComponent(managerId)}/create`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-user-id': 'system-admin'
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(15000)
});
const text = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text);
if (!res.ok) process.exit(1);
