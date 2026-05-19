import fetch from 'node-fetch';

const msg = { message: 'MT103:test' };

console.log('Sending enqueue request...');
fetch('http://localhost:4000/api/queue/swift.mt103.inbound/enqueue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(msg)
})
  .then(r => {
    console.log('Status:', r.status);
    console.log('Headers:', Object.fromEntries(r.headers));
    return r.text();
  })
  .then(t => {
    console.log('Response body:', t);
  })
  .catch(e => {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
  });
