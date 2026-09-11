const input = [
  'MT103',
  ':20:GUI-DEPLOY-001',
  ':21:GUI-E2E-0001',
  ':23B:CRED',
  ':32A:260702CAD12500,45',
  ':33B:CAD12500,45',
  ':50K:/123456789',
  'ALPHA IMPORTS LTD',
  ':52A:ROYCCAT2',
  ':59:/000987654321',
  'BETA SUPPLIES INC',
  ':70:GUI TEST',
  ':71A:SHA'
].join('\n');

const response = await fetch('http://192.168.2.155/pmachine/execute_file', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    file: '/cbds-con.pc',
    programMap: '/cbds-c.map.json',
    inputQueue: 'swift.mt103.parsed',
    message: input,
    max: '32768'
  })
});
const payload = JSON.parse(await response.text());
const delivery = (Array.isArray(payload.deliveries) ? payload.deliveries : [])
  .find((item) => item.queueName === 'cbds.pacs.outbound');
console.log(JSON.stringify({
  status: response.status,
  publishedCount: payload.publishedCount,
  queue: delivery?.queueName || null,
  messageFormat: delivery?.messageFormat || null,
  messagePreview: String(delivery?.message || '').slice(0, 500)
}, null, 2));
if (!response.ok || !delivery) process.exitCode = 1;
