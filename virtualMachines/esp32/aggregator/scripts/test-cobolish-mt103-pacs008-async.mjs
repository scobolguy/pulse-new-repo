import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { compileCobolishToPmachine } from './compile-interoperable-language.mjs';
import { runSingleMessageForEvolution } from './run-js-pmachine.mjs';

const ROOT = path.resolve('.');
const DEMO_DIR = path.join(ROOT, 'data', 'cbds', 'cobolish-demo');
const COBOLISH_PATH = path.join(DEMO_DIR, 'cbds-converter.cob');
const PCODE_PATH = path.join(DEMO_DIR, 'cbds-converter.async.pcode');
const PROGRAM_MAP_PATH = path.join(DEMO_DIR, 'cbds-converter.async.program.json');
const INPUT_PATH = path.join(DEMO_DIR, 'mt103-input.json');
const INPUT_QUEUE = 'swift.mt103.parsed';
const OUTPUT_QUEUE = 'cbds.pacs.outbound';
async function main() {
  const source = await fs.readFile(COBOLISH_PATH, 'utf8');
  const input = JSON.parse(await fs.readFile(INPUT_PATH, 'utf8'));
  const artifact = compileCobolishToPmachine(source, { fileName: path.basename(COBOLISH_PATH) });

  await fs.mkdir(DEMO_DIR, { recursive: true });
  await fs.writeFile(PCODE_PATH, artifact.pcodeText, 'utf8');
  await fs.writeFile(PROGRAM_MAP_PATH, `${JSON.stringify(artifact.programMap, null, 2)}\n`, 'utf8');

  const runResult = await runSingleMessageForEvolution({
    pcode: path.relative(ROOT, PCODE_PATH),
    programMap: path.relative(ROOT, PROGRAM_MAP_PATH),
    inputQueue: INPUT_QUEUE,
    message: JSON.stringify(input)
  });
  const delivery = (runResult.deliveries || []).find((item) => item.queueName === OUTPUT_QUEUE);
  assert.ok(delivery, `No ${OUTPUT_QUEUE} reply was returned`);
  const pacs = JSON.parse(String(delivery.message || '{}'));
  assert.equal(runResult.error, null);
    assert.equal(pacs.Document.FIToFICstmrCdtTrf.GrpHdr.MsgId, 'CBDSREF123456');
    assert.equal(pacs.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt, '2026-07-02');
    assert.equal(pacs.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt, '12500.45');

  console.log(JSON.stringify({
    status: 'ok',
    service: artifact.runtimeUnit,
    sent: { queue: INPUT_QUEUE, transport: 'JavaScript async PMachine invocation' },
    received: { queue: OUTPUT_QUEUE, deliveries: runResult.deliveries.length },
    pacs008: pacs
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
