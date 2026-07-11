const headers = {
  'content-type': 'application/json',
  'x-user-id': 'systemadmin'
};

const ref = `FLOW${Date.now()}`;
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

function printStep(label, payload) {
  console.log(`\n== ${label} ==`);
  console.log(JSON.stringify(payload, null, 2));
}

async function main() {
  console.log(`ref=${ref}`);

  printStep('enable-auto-restart', await call('POST', 'http://127.0.0.1:4000/api/lifecycle/auto-restart', {
    enabled: true,
    reason: 'trace-flow'
  }));

  printStep('start-gateways', await call('POST', 'http://127.0.0.1:4000/api/runtime/classes/gateway/actions/start', {
    targets: ['swift', 'boc'],
    swift: { intervalMs: 150, batchSize: 10 },
    boc: { intervalMs: 150, batchSize: 10, approvalMode: 'test' }
  }));

  printStep('start-reconcile-worker', await call('POST', 'http://127.0.0.1:4000/api/lifecycle/workers/start', {
    workerId: 'lifecycle-correspondent-to-reconciled',
    fromState: 'sent_correspondent_unreconciled',
    eventName: 'statement_matched',
    context: { statement_match: true, statementMatch: true },
    intervalMs: 150,
    batchSize: 10,
    consumerService: 'lifecycle-correspondent-to-reconciled',
    sourceService: 'lifecycle-correspondent-to-reconciled'
  }));

  printStep('ingest-mt103', await call('POST', 'http://127.0.0.1:4000/api/queue/swift.mt103.parsed/enqueue', {
    message: mt103,
    sourceService: 'mapping-service-demo'
  }));

  for (let i = 0; i < 16; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const trace = await call('GET', `http://127.0.0.1:4000/api/transactions/${ref}/trace?traceLimit=200`);
    const timeline = await call('GET', `http://127.0.0.1:4000/api/transactions/${ref}/timeline?traceLimit=200`);
    const stateId = trace.body?.currentState?.stateId || null;
    const historyCount = Array.isArray(trace.body?.history) ? trace.body.history.length : 0;
    const traceCount = Array.isArray(trace.body?.trace) ? trace.body.trace.length : 0;
    const timelineCount = Array.isArray(timeline.body?.timeline) ? timeline.body.timeline.length : 0;
    console.log(`poll=${i} traceStatus=${trace.status} timelineStatus=${timeline.status} state=${stateId} history=${historyCount} trace=${traceCount} timeline=${timelineCount}`);
    if (stateId === 'reconciled') {
      printStep('final-trace', trace);
      printStep('final-timeline', timeline);
      return;
    }
  }

  printStep('final-trace-nonterminal', await call('GET', `http://127.0.0.1:4000/api/transactions/${ref}/trace?traceLimit=200`));
  printStep('final-timeline-nonterminal', await call('GET', `http://127.0.0.1:4000/api/transactions/${ref}/timeline?traceLimit=200`));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
