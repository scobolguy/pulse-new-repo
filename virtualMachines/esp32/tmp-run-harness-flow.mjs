const headers = {
  'content-type': 'application/json',
  'x-user-id': 'systemadmin'
};

const ref = `HARNESS${Date.now()}`;
const mt103 = [
  'MT103',
  `:20:${ref}`,
  ':23B:CRED',
  ':32A:260522USD1250,50',
  ':50K:/123456789',
  'SENDER CORP',
  '1 MAIN ST',
  'NEW YORK NY',
  ':59:/987654321',
  'RECEIVER LTD',
  '2 OAK AVE',
  'LONDON',
  ':71A:SHA'
].join('\n');

async function call(method, url, body) {
  const response = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

function print(label, payload) {
  console.log(`\n== ${label} ==`);
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  console.log(`ref=${ref}`);
  print('start', await call('POST', 'http://127.0.0.1:4000/api/lifecycle/test/start', { txId: ref, message: mt103 }));
  print('mapped-to-pacs', await call('POST', 'http://127.0.0.1:4000/api/lifecycle/test/step', { eventName: 'mapped_to_pacs' }));
  print('submitted-to-lynx', await call('POST', 'http://127.0.0.1:4000/api/lifecycle/test/step', { eventName: 'submitted_to_lynx' }));
  print('lynx-approved', await call('POST', 'http://127.0.0.1:4000/api/lifecycle/simulators/bank-of-canada/approve', {}));
  print('sent-to-correspondent', await call('POST', 'http://127.0.0.1:4000/api/lifecycle/test/step', { eventName: 'sent_to_correspondent' }));
  print('statement-matched', await call('POST', 'http://127.0.0.1:4000/api/lifecycle/simulators/correspondent/send-mt940', { statementRef: ref }));
  print('trace', await call('GET', `http://127.0.0.1:4000/api/transactions/${ref}/trace?traceLimit=200`));
  print('timeline', await call('GET', `http://127.0.0.1:4000/api/transactions/${ref}/timeline?traceLimit=200`));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
