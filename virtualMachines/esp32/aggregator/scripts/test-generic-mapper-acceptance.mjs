import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compileWorkflowDSLWithAntlr } from './workflow-antlr-compiler.mjs';

const root = new URL('../', import.meta.url);
const read = file => fs.readFile(new URL(file, root), 'utf8');
const parseJson = async file => JSON.parse(await read(file));

const workflow = compileWorkflowDSLWithAntlr(await read('../src/generic-mapper.wfl'));
const contract = await parseJson('libraries/generic-mapper-runtime/library.json');
const map = await parseJson('data/cbds/cbds-mt103-to-pacs008.map.json');
const outputProof = await parseJson('data/cbds/cbds-mt103-to-pacs008-output.json');
const input = await parseJson('data/cbds/pascalish-demo/mt103-input.json');
const esp32BaseUrl = String(process.env.ESP32_BASE_URL || '').replace(/\/+$/, '');

const operation = contract.runtime.operations.RuntimeMapMt103ToPacs008;
const queues = workflow.symbols.queues;
const store = workflow.symbols.databases[0];

assert.equal(operation.mapperId, map.id);
assert.equal(operation.sourceTypeId, 'swift-mt103');
assert.equal(operation.targetTypeId, 'pacs');
assert.equal(queues.find(item => item.symbol === 'generic_mapper_input')?.managerId, 'qm-secondary');
assert.equal(queues.find(item => item.symbol === 'generic_mapper_output')?.managerId, 'qm-secondary');
assert.equal(store?.managerId, 'db-mssql');
assert.equal(input.block4['21'], 'CBDS-E2E-0001');
assert.equal(outputProof.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId, 'CBDS-E2E-0001');

async function runEsp32Acceptance() {
  const latencies = [];
  const failures = [];

  for (let index = 1; index <= 100; index += 1) {
    const message = [
      'MT103',
      `:20:GENERIC-MAPPER-${String(index).padStart(4, '0')}`,
      `:32A:260920USD${(1000 + index).toFixed(2).replace('.', ',')}`,
      `:50K:GENERIC APPLICANT ${index}`,
      ':57A:GENERICBANKXXX',
      `:59:/000${String(index).padStart(6, '0')}`,
      `GENERIC BENEFICIARY ${index}`
    ].join('\n');
    const query = new URLSearchParams({
      serviceId: 'mt103-to-pacs-service',
      rules: '/hrr.json',
      mappings: '/hdm.json',
      inputQueue: 'swift.mt103.parsed',
      message
    });
    const started = performance.now();
    try {
      const response = await fetch(`${esp32BaseUrl}/pmachine/router/run?${query}`, {
        method: 'POST',
        signal: AbortSignal.timeout(20_000)
      });
      const body = await response.text();
      const payload = JSON.parse(body);
      const delivery = (payload.deliveries || []).find(item =>
        item.outputQueue === 'tx.pacs.created' || item.queueName === 'tx.pacs.created'
      );
      if (!response.ok || payload.publishedCount !== 1 || !delivery) {
        failures.push({ index, status: response.status, publishedCount: payload.publishedCount });
      } else {
        latencies.push(performance.now() - started);
      }
    } catch (error) {
      failures.push({ index, error: error.message });
    }
  }

  const sorted = latencies.slice().sort((a, b) => a - b);
  const percentile = ratio => sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
    : 0;
  const totalMs = latencies.reduce((sum, value) => sum + value, 0);
  assert.equal(failures.length, 0, `ESP32 acceptance failures: ${JSON.stringify(failures.slice(0, 3))}`);

  return {
    node: esp32BaseUrl,
    transactions: 100,
    successful: latencies.length,
    averageMs: Number((totalMs / latencies.length).toFixed(2)),
    medianMs: Number(percentile(0.5).toFixed(2)),
    p95Ms: Number(percentile(0.95).toFixed(2)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
    throughputPerSecond: Number((latencies.length / (totalMs / 1000)).toFixed(2))
  };
}

const esp32 = esp32BaseUrl ? await runEsp32Acceptance() : null;

console.log(JSON.stringify({
  status: 'PASS',
  mapperId: map.id,
  inputQueue: 'swift.mt103.inbound',
  outputQueue: 'swift.pacs008.outbound',
  dataStore: store.physicalName || 'GenericMapperMessages',
  persistedEndToEndId: input.block4['21'],
  outputEndToEndId: outputProof.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId,
  ...(esp32 ? { esp32 } : {})
}, null, 2));
