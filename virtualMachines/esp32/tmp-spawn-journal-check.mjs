const headers = {
  'content-type': 'application/json',
  'x-user-id': 'systemadmin'
};

await fetch('http://127.0.0.1:4000/api/lifecycle/auto-restart', {
  method: 'POST',
  headers,
  body: JSON.stringify({ enabled: true, reason: 'spawn-journal-check' }),
  signal: AbortSignal.timeout(8000)
});

await fetch('http://127.0.0.1:4000/api/lifecycle/workers/start-default', {
  method: 'POST',
  headers,
  body: JSON.stringify({ intervalMs: 120, batchSize: 25 }),
  signal: AbortSignal.timeout(8000)
});

const started = await fetch('http://127.0.0.1:4000/api/lifecycle/test/start', {
  method: 'POST',
  headers,
  body: JSON.stringify({}),
  signal: AbortSignal.timeout(8000)
}).then((response) => response.json());

const parent = started?.active?.transactionId;
const child = `${parent}-PACS`;
await new Promise((resolve) => setTimeout(resolve, 3000));

const fs = await import('node:fs');
const lines = fs.readFileSync('aggregator/data/transaction-trace-journal.jsonl', 'utf8').split(/\r?\n/).filter(Boolean);
const events = [];
for (let i = lines.length - 1; i >= 0 && events.length < 30; i -= 1) {
  try {
    const event = JSON.parse(lines[i]);
    if ((event.entityId === parent || event.entityId === child)
      && (event.eventKind === 'transaction-spawn-parent'
        || event.eventKind === 'transaction-spawn-child'
        || event.eventKind === 'lifecycle-transition'
        || event.eventKind === 'queue-enqueue')) {
      events.push({
        at: event.occurredAt,
        entity: event.entityId,
        kind: event.eventKind,
        comment: event.comment || null,
        relation: event.relation || null,
        toState: event.transition?.toState || null,
        queue: event.transition?.queueName || null
      });
    }
  } catch {
    // Ignore malformed rows in test utility script.
  }
}

console.log(JSON.stringify({ parent, child, events }, null, 2));
