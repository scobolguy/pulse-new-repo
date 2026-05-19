import fetch from 'node-fetch';

const backend = 'http://localhost:4000';

const tests = [
  {
    queue: 'swift.mt103.inbound',
    body: { message: 'MT103:\n:20:REF\n:23B:CRED\n:32A:160523USD123,45\n:50A:/ACCT\nCLIENT\n:59:/BEN\nNAME\n:71A:SHA', sourceService: 'probe' }
  },
  {
    queue: 'pacs.inbound',
    body: { message: '<?xml version="1.0"?><Document><CstmrCdtTrfInitn><GrpHdr><MsgId>ID-1</MsgId></GrpHdr></CstmrCdtTrfInitn></Document>', sourceService: 'probe' }
  },
  {
    queue: 'mt202.inbound',
    body: { message: 'MT202:\n:20:REF202\n:21:REL\n:32A:160523USD123,45\n:58A:/DEST\nBANK', sourceService: 'probe' }
  }
];

for (const t of tests) {
  const res = await fetch(`${backend}/api/queue/${t.queue}/enqueue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(t.body)
  });
  const text = await res.text();
  console.log(t.queue, res.status, text.slice(0, 180));
}
