import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compileSolutionDsl } from './compile-solution-dsl.mjs';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { buildDeploymentBindingManifest } from '../src/backend/deploymentBindingManifest.mjs';
import { applySolutionDeliveries } from '../src/backend/solutionRuntimeBindings.mjs';
import { createDatabaseProvider } from '../src/backend/databaseProviders/index.mjs';
import MsmqQueueManagerAdapter from '../src/broker/queueManagerProviders/MsmqQueueManagerAdapter.mjs';
import { executeProgram, parsePcode } from './run-js-pmachine.mjs';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';

const solutionSource = await fs.readFile(new URL('../data/payment-ingestion.solution', import.meta.url), 'utf8');
const artifact = compileSolutionDsl(solutionSource, { fileName: 'payment-ingestion.solution' });
const workflow = compileWorkflowDSLWithAntlr(artifact.wfl);
const bindings = buildDeploymentBindingManifest(workflow.symbols);
const instructions = parsePcode(artifact.pcodeText);
const opcodeMap = await loadOpcodeMap();

const database = createDatabaseProvider('mssql', {
  driver: process.env.MSSQL_DRIVER || 'msnodesqlv8',
  connectionString: process.env.MSSQL_DATABASE_CONNECTION_STRING || process.env.GROUP_MSSQL_CONNECTION_STRING
});
const queuePrefix = process.env.MSMQ_QUEUE_PREFIX || 'pulse-solution-js-live';
const queue = new MsmqQueueManagerAdapter('qm-secondary', { queuePrefix });
const inputQueue = 'swift.mt103.inbound';
const outputQueue = 'swift.pacs008.outbound';
const databaseSchema = {
  table: 'PaymentMessages',
  columns: {
    reference: 'nvarchar(max)',
    payload: 'nvarchar(max)',
    status: 'nvarchar(32)'
  }
};
const sourceMarker = 'LIVE-JS-PMACHINE-';

function createMessage(index) {
  const id = String(index).padStart(3, '0');
  return JSON.stringify({
    finEnvelope: {
      block4: {
        fields: {
          '20': `${sourceMarker}${id}`,
          '21': `E2E-${id}`,
          '23B': 'CRED',
          '32A': { components: { valueDate: '260915', currency: 'CAD', amount: '12500,45' } },
          '33B': { components: { currency: 'CAD', amount: '12500,45' } },
          '50K': '/123456789\nALPHA IMPORTS LTD',
          '52A': 'ROYCCAT2',
          '53A': 'BOFACATT',
          '56A': 'CITIUS33',
          '57A': 'TDOMCATTTOR',
          '59': '/000987654321\nBETA SUPPLIES INC',
          '70': `INV-${id}`,
          '71A': 'SHA',
          '71B': '15,00',
          '72': '/INS/LIVE JS PMACHINE'
        }
      }
    }
  });
}

async function invokeConversionService({ payload }) {
  const input = typeof payload === 'string' ? JSON.parse(payload) : payload;
  assert.ok(input?.finEnvelope?.block4?.fields?.['20'], `service request lost MT103 field 20; payload=${JSON.stringify(payload).slice(0, 600)}`);
  const servicePayload = JSON.stringify({ ...input, httpVerb: 'GET' });
  const serviceRuntime = await executeProgram({
    instructions,
    opcodeMap,
    inputQueue: 'ConversionService.in',
    sourceMessage: servicePayload
  });
  const delivery = serviceRuntime.deliveries.find(item => item.queueName === 'ConversionService.out');
  assert.ok(delivery, 'ConversionService produced no reply');
  const body = JSON.parse(delivery.message);
  const transaction = body?.Document?.FIToFICstmrCdtTrf?.CdtTrfTxInf;
  const settlementAmount = transaction?.IntrBkSttlmAmt;
  assert.equal(body?.Document?.FIToFICstmrCdtTrf?.GrpHdr?.MsgId, input.finEnvelope.block4.fields['20'], `mapper lost field 20: ${delivery.message}`);
  assert.equal(transaction?.PmtId?.EndToEndId, input.finEnvelope.block4.fields['21']);
  assert.equal(transaction?.PmtTpInf?.LclInstrm?.Prtry, 'CRED');
  assert.equal(transaction?.IntrBkSttlmDt, '2026-09-15');
  assert.equal(settlementAmount?.['@Ccy'], 'CAD');
  assert.equal(settlementAmount?.['#text'], '12500.45');
  assert.equal(transaction?.Dbtr?.Nm, 'ALPHA IMPORTS LTD');
  assert.equal(transaction?.Cdtr?.Nm, 'BETA SUPPLIES INC');
  assert.equal(transaction?.RmtInf?.Ustrd, input.finEnvelope.block4.fields['70']);
  assert.equal(transaction?.ChrgBr, 'SHA');
  assert.equal(transaction?.InstrForNxtAgt?.InstrInf, input.finEnvelope.block4.fields['72']);
  return { success: true, response: { body } };
}

try {
  assert.equal(workflow.deployments[0].resources[1].kind, 'service');
  assert.equal(workflow.deployments[0].resources[1].lifecycle.persistent, true);
  await database.createTable(databaseSchema);
  await database.query(`DELETE FROM [PaymentMessages] WHERE [payload] LIKE '%${sourceMarker}%'`);
  await queue.createQueue(inputQueue, { managerId: 'qm-secondary', provider: 'msmq' });
  await queue.createQueue(outputQueue, { managerId: 'qm-secondary', provider: 'msmq' });
  await queue.truncateQueue(inputQueue);
  await queue.truncateQueue(outputQueue);

  for (let index = 1; index <= 10; index += 1) {
    await queue.enqueue(inputQueue, createMessage(index), 'live-js-pmachine', `live-js-pmachine-${String(index).padStart(3, '0')}`);
  }

  const results = [];
  for (let index = 1; index <= 10; index += 1) {
    const claim = await queue.claim(inputQueue, 'live-js-pmachine-worker');
    assert.ok(claim, `missing input message ${index}`);
    const sourceMessage = claim.message.message;
    const runtime = await executeProgram({
      instructions,
      opcodeMap,
      inputQueue: 'IncomingMessages',
      sourceMessage,
      runtimeContext: { invokeSubflow: invokeConversionService }
    });
    assert.ok(runtime.deliveries.some(item => item.queueName === 'OutgoingPayments'), `message ${index} produced no OutgoingPayments delivery: ${JSON.stringify({ deliveries: runtime.deliveries, orchestration: runtime.orchestration, globals: runtime.globals, error: runtime.error })}`);
    const applied = await applySolutionDeliveries({
      deliveries: runtime.deliveries,
      bindingManifest: bindings,
      databaseManagers: new Map([['db-mssql', database]]),
      queueManagers: new Map([['qm-secondary', queue]]),
      databaseSchemas: { MessageStore: databaseSchema }
    });
    await queue.completeClaim(inputQueue, claim.claimToken, 'live-js-pmachine-worker', { applied });
    results.push({ index, applied });
  }

  const rows = await database.query("SELECT [reference], [status] FROM [PaymentMessages] WHERE [payload] LIKE '%LIVE-JS-PMACHINE-%' ORDER BY [reference]");
  const outputDepth = await queue.getQueueLength(outputQueue);
  assert.equal(rows.length, 10);
  assert.equal(outputDepth, 10);
  assert.equal(results.length, 10);

  console.log(JSON.stringify({
    status: 'PASS',
    execution: 'JS PMachine compiled solution with persistent ConversionService request/reply',
    queues: { prefix: queuePrefix, input: queue.fullQueuePath(inputQueue), output: queue.fullQueuePath(outputQueue), outputDepth },
    database: { database: 'PulseDB', table: 'PaymentMessages', rows: rows.length, statuses: [...new Set(rows.map(row => row.status))] },
    mapper: { sourceType: 'swift-mt103', targetType: 'pacs', map: 'MT103ToPACS008' },
    cleanup: 'queues retained for inspection; database rows retained with LIVE-JS-PMACHINE marker'
  }, null, 2));
} finally {
  queue.close();
  await database.close().catch(() => {});
}
