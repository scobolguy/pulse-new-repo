import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compileSolutionDsl } from './compile-solution-dsl.mjs';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';
import { buildDeploymentBindingManifest } from '../src/backend/deploymentBindingManifest.mjs';
import { createDatabaseProvider } from '../src/backend/databaseProviders/index.mjs';
import MsmqQueueManagerAdapter from '../src/broker/queueManagerProviders/MsmqQueueManagerAdapter.mjs';
import { executeProgram, parsePcode } from './run-js-pmachine.mjs';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';
import { createEsp32PmachineExecutor, createPortableDaemonRuntime } from '../src/backend/portableDaemonRuntime.mjs';

const solutionSource = await fs.readFile(new URL('../data/payment-ingestion.solution', import.meta.url), 'utf8');
const artifact = compileSolutionDsl(solutionSource, { fileName: 'payment-ingestion.solution' });
const workflow = compileWorkflowDSLWithAntlr(artifact.wfl);
const bindings = buildDeploymentBindingManifest(workflow.symbols);
const instructions = parsePcode(artifact.pcodeText);
const serviceInstructions = parsePcode(artifact.pcodeText);
const opcodeMap = await loadOpcodeMap();
const database = createDatabaseProvider('mssql', {
  driver: process.env.MSSQL_DRIVER || 'msnodesqlv8',
  connectionString: process.env.MSSQL_DATABASE_CONNECTION_STRING || process.env.GROUP_MSSQL_CONNECTION_STRING
});
const queuePrefix = process.env.MSMQ_QUEUE_PREFIX || 'pulse-portable-daemon-e2e';
const queue = new MsmqQueueManagerAdapter('qm-secondary', { queuePrefix });
const inputQueue = 'swift.mt103.inbound';
const outputQueue = 'swift.pacs008.outbound';
const marker = `PORTABLE-DAEMON-E2E-${Date.now()}-`;
const databaseSchema = {
  table: 'PaymentMessages',
  columns: { reference: 'nvarchar(max)', payload: 'nvarchar(max)', status: 'nvarchar(32)' }
};
const remoteFiles = ['/portable-daemon.pcode', '/portable-daemon.program.json'];

function createMessage() {
  return JSON.stringify({
    finEnvelope: {
      block4: {
        fields: {
          '20': `${marker}001`,
          '21': 'E2E-PORTABLE-001',
          '23B': 'CRED',
          '32A': { components: { valueDate: '260915', currency: 'CAD', amount: '12500,45' } },
          '33B': { components: { currency: 'CAD', amount: '12500,45' } },
          '50K': '/123456789\nALPHA IMPORTS LTD',
          '59': '/000987654321\nBETA SUPPLIES INC',
          '70': 'PORTABLE DAEMON E2E',
          '71A': 'SHA',
          '72': '/INS/PORTABLE E2E'
        }
      }
    }
  });
}

async function uploadEsp32(baseUrl, pcodeText, mapText) {
  for (const [file, body] of [[remoteFiles[0], pcodeText], [remoteFiles[1], mapText]]) {
    const response = await fetch(`${baseUrl}/ffs/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ file, body })
    });
    if (!response.ok) throw new Error(`FFS upload failed (${response.status}): ${await response.text()}`);
  }
}

async function deleteEsp32(baseUrl) {
  for (const file of remoteFiles) {
    await fetch(`${baseUrl}/ffs/delete?file=${encodeURIComponent(file)}`, { method: 'POST' }).catch(() => {});
  }
}

async function runJs(message) {
  const invokeConversionService = async ({ payload }) => {
    const servicePayload = JSON.stringify({ ...(typeof payload === 'string' ? JSON.parse(payload) : payload), httpVerb: 'GET' });
    const service = await executeProgram({
      instructions: serviceInstructions,
      opcodeMap,
      inputQueue: 'ConversionService.in',
      sourceMessage: servicePayload
    });
    const reply = service.deliveries.find(item => item.queueName === 'ConversionService.out');
    assert.ok(reply, 'JS ConversionService produced no reply');
    return { response: JSON.parse(reply.message) };
  };
  const runtime = await executeProgram({
    instructions,
    opcodeMap,
    inputQueue: 'IncomingMessages',
    sourceMessage: message,
    runtimeContext: { invokeSubflow: invokeConversionService }
  });
  return runtime;
}

async function main() {
  const message = createMessage();
  const signedMap = attachPcodeSignature(structuredClone(artifact.programMap), artifact.pcodeText);
  const esp32BaseUrl = String(process.env.ESP32_BASE_URL || 'http://192.168.2.155').replace(/\/+$/, '');
  const results = {};

  await database.createTable(databaseSchema);
  await database.query(`DELETE FROM [PaymentMessages] WHERE [payload] LIKE '%${marker}%'`);
  await queue.createQueue(inputQueue, { managerId: 'qm-secondary', provider: 'msmq' });
  await queue.createQueue(outputQueue, { managerId: 'qm-secondary', provider: 'msmq' });
  await queue.truncateQueue(inputQueue);
  await queue.truncateQueue(outputQueue);

  try {
    await queue.enqueue(inputQueue, message, 'portable-daemon-e2e', `${marker}001`);
    const jsDaemon = createPortableDaemonRuntime({
      queueManager: queue,
      databaseManagers: new Map([['db-mssql', database]]),
      bindingManifest: bindings,
      databaseSchemas: { MessageStore: databaseSchema },
      physicalQueues: { input: inputQueue, output: outputQueue },
      conversionRuntime: runJs,
      workerId: 'portable-js-e2e'
    });
    results.js = await jsDaemon.processOnce();
    assert.equal(results.js.status, 'completed');
    const jsOutput = String(results.js.execution.deliveries.find(item => item.queueName === 'OutgoingPayments')?.message || '');
    assert.match(jsOutput, /PORTABLE-DAEMON-E2E/, JSON.stringify({ jsOutput, globals: results.js.execution.globals }));

    await queue.truncateQueue(inputQueue);
    await queue.enqueue(inputQueue, message, 'portable-daemon-e2e', `${marker}002`);
    await uploadEsp32(esp32BaseUrl, artifact.pcodeText, `${JSON.stringify(signedMap)}\n`);
    const espDaemon = createPortableDaemonRuntime({
      queueManager: queue,
      databaseManagers: new Map([['db-mssql', database]]),
      bindingManifest: bindings,
      databaseSchemas: { MessageStore: databaseSchema },
      physicalQueues: { input: inputQueue, output: outputQueue },
      conversionRuntime: createEsp32PmachineExecutor({
        baseUrl: esp32BaseUrl,
        pcodeFile: remoteFiles[0],
        programMapFile: remoteFiles[1],
        inputQueue: 'IncomingMessages'
      }),
      workerId: 'portable-esp32-e2e'
    });
    results.esp32 = await espDaemon.processOnce();
    assert.equal(results.esp32.status, 'completed');
    assert.match(String(results.esp32.execution.deliveries.find(item => item.queueName === 'OutgoingPayments')?.message || ''), /Document/);

    const rows = await database.query(`SELECT [reference], [status] FROM [PaymentMessages] WHERE [payload] LIKE '%${marker}%' ORDER BY [reference]`);
    assert.equal(rows.length, 2);
    assert.deepEqual([...new Set(rows.map(row => row.status))], ['received']);
    assert.equal(await queue.getQueueLength(outputQueue), 2);
    console.log(JSON.stringify({ status: 'PASS', esp32: esp32BaseUrl, databaseRows: rows.length, outputQueueDepth: 2, results }, null, 2));
  } finally {
    await queue.truncateQueue(inputQueue).catch(() => {});
    await queue.truncateQueue(outputQueue).catch(() => {});
    await database.query(`DELETE FROM [PaymentMessages] WHERE [payload] LIKE '%${marker}%'`).catch(() => {});
    await deleteEsp32(esp32BaseUrl);
    queue.close();
    await database.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[portable-daemon-e2e] FAIL:', error?.stack || error);
  process.exitCode = 1;
});