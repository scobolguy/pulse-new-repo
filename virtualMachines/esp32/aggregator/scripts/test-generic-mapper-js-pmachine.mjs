import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = path.resolve(root, '..');
const sourcePath = path.join(root, 'data', 'generic-mapper.pas');
const pcodePath = path.join(repositoryRoot, 'artifacts', 'aggregator-pcode', 'generic-mapper-js-test.pcode');
const programMapPath = path.join(repositoryRoot, 'artifacts', 'aggregator-pcode', 'generic-mapper-js-test.program.json');

const input = {
  finEnvelope: {
    block4: {
      fields: {
        '20': 'GM-JS-0001',
        '21': 'CBDS-E2E-0001',
        '23B': 'CRED',
        '32A': {
          components: {
            valueDate: '260920',
            currency: 'USD',
            amount: '1000,00'
          }
        },
        '33B': {
          components: {
            currency: 'USD',
            amount: '1000,00'
          }
        },
        '50K': '/000000001\nGENERIC APPLICANT',
        '52A': 'BANKUS33XXX',
        '57A': 'BANKGB22XXX',
        '59': '/000000002\nGENERIC BENEFICIARY',
        '70': 'INVOICE 1',
        '71A': 'SHA',
        '71B': '5,00',
        '72': '/INS/GENERIC ROUTING'
      }
    },
    meta: {
      createdAt: '2026-09-20T12:00:00.000Z'
    }
  }
};

function getByPath(value, pathText) {
  return pathText.split('.').reduce((current, key) => current?.[key], value);
}

async function main() {
  await fs.mkdir(path.dirname(pcodePath), { recursive: true });

  await execFileAsync(process.execPath, [
    'scripts/compile-pascalish-program-antlr-to-pcode.mjs',
    '--in', path.relative(root, sourcePath),
    '--out', path.relative(root, pcodePath),
    '--map-out', path.relative(root, programMapPath)
  ], { cwd: root, windowsHide: true });

  const { stdout } = await execFileAsync(process.execPath, [
    'scripts/run-js-pmachine.mjs',
    '--pcode', path.relative(root, pcodePath),
    '--program-map', path.relative(root, programMapPath),
    '--input-queue', 'swift.mt103.inbound',
    '--message', JSON.stringify(input)
  ], { cwd: root, windowsHide: true, maxBuffer: 1024 * 1024 * 8 });

  const result = JSON.parse(stdout);
  assert.equal(result.error, null);
  assert.equal(result.publishedCount, 1);
  assert.equal(result.deliveries[0].queueName, 'swift.pacs008.outbound');
  assert.equal(result.globals.GenericMapper__self__processed, 1);

  const output = JSON.parse(result.deliveries[0].message);
  const tx = output.Document.FIToFICstmrCdtTrf.CdtTrfTxInf;
  assert.equal(getByPath(output, 'Document.FIToFICstmrCdtTrf.GrpHdr.MsgId'), 'GM-JS-0001');
  assert.equal(tx.PmtId.InstrId, 'GM-JS-0001');
  assert.equal(tx.PmtId.EndToEndId, 'CBDS-E2E-0001');
  assert.equal(tx.PmtTpInf.LclInstrm.Prtry, 'CRED');
  assert.equal(tx.IntrBkSttlmDt, '2026-09-20');
  assert.equal(tx.IntrBkSttlmAmt['@Ccy'], 'USD');
  assert.equal(tx.IntrBkSttlmAmt['#text'], '1000.00');
  assert.equal(tx.Dbtr.Nm, 'GENERIC APPLICANT');
  assert.equal(tx.Cdtr.Nm, 'GENERIC BENEFICIARY');
  assert.equal(tx.RmtInf.Ustrd, 'INVOICE 1');
  assert.equal(tx.ChrgBr, 'SHA');

  console.log(JSON.stringify({
    status: 'PASS',
    runtime: result.runtime,
    serviceId: result.lifecycle.unitId,
    pcodePath,
    inputQueue: result.inputQueue,
    outputQueue: result.deliveries[0].queueName,
    mapper: 'cbds-mt103-to-pacs008',
    processedByGenericMapper: result.globals.GenericMapper__self__processed,
    stepCount: result.stepCount
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
