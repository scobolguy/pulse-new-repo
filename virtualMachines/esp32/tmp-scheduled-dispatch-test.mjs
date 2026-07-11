const headers = {
  'content-type': 'application/json',
  'x-user-id': 'systemadmin'
};

const tx = `TEST-SCHED-${Date.now()}`;
const child = `PACS-${tx}`;
const body = {
  queueName: 'swift.mt103.inbound',
  delayMs: 1200,
  sourceService: 'api:test',
  message: `MT103\n:20:${tx}\n:32A:260514USD12500,`,
  comment: `Scheduled test dispatch for ${tx}`,
  parentEntityId: tx,
  childEntityId: child
};

const post = await fetch('http://127.0.0.1:4000/api/journal/dispatch-queue', {
  method: 'POST',
  headers,
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(8000)
});
console.log('POST', post.status);
console.log(await post.text());

const get1 = await fetch('http://127.0.0.1:4000/api/journal/dispatch-queue', {
  headers: { 'x-user-id': 'systemadmin' },
  signal: AbortSignal.timeout(8000)
});
const q1 = await get1.json();
console.log('GET1', get1.status, 'pending', q1?.summary?.pending, 'dispatched', q1?.summary?.dispatched);

await new Promise((resolve) => setTimeout(resolve, 2500));

const get2 = await fetch('http://127.0.0.1:4000/api/journal/dispatch-queue', {
  headers: { 'x-user-id': 'systemadmin' },
  signal: AbortSignal.timeout(8000)
});
const q2 = await get2.json();
console.log('GET2', get2.status, 'pending', q2?.summary?.pending, 'dispatched', q2?.summary?.dispatched);

const mine = (q2.items || []).filter((item) => item.parentEntityId === tx);
console.log('itemsForTx', JSON.stringify(mine, null, 2));
