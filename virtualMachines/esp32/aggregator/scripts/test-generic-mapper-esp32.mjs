import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';

const host = process.env.ESP32_HOST || '192.168.2.155';
const baseUrl = `http://${host}`;
const aggregatorRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const remotePcode = '/generic-mapper.pcode';
const remoteMap = '/generic-mapper.map.json';
const sourcePath = path.resolve(aggregatorRoot, '..', 'src', 'generic-mapper.pas');

const input = {
  finEnvelope: {
    block4: {
      fields: {
        '20': 'GM-ESP32-0001',
        '21': 'CBDS-E2E-ESP32-0001',
        '23B': 'CRED',
        '32A': { components: { valueDate: '260920', currency: 'USD', amount: '1000,00' } },
        '50K': '/000000001\nGENERIC APPLICANT',
        '52A': 'BANKUS33XXX',
        '57A': 'BANKGB22XXX',
        '59': '/000000002\nGENERIC BENEFICIARY',
        '70': 'INVOICE ESP32',
        '71A': 'SHA'
      }
    },
    meta: { createdAt: '2026-09-20T12:00:00.000Z' }
  }
};

async function postForm(url, values) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values),
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} => ${response.status}: ${text.slice(0, 300)}`);
  return text;
}

async function main() {
  const sourceText = await fs.readFile(sourcePath, 'utf8');
  const artifact = compilePascalishProgramWithAntlr(sourceText);
  const compactProgramMap = {
    ...artifact.programMap,
    typeRegistry: undefined,
    sourceMap: undefined,
    classDeclarations: undefined,
    variableDeclarations: undefined
  };
  const signedMap = attachPcodeSignature(compactProgramMap, artifact.pcodeText);

  await postForm(`${baseUrl}/ffs/upload`, { file: remotePcode, body: artifact.pcodeText });
  await postForm(`${baseUrl}/ffs/upload`, {
    file: remoteMap,
    body: `${JSON.stringify(signedMap, null, 2)}\n`
  });

  const raw = await postForm(`${baseUrl}/pmachine/execute_file`, {
    file: remotePcode,
    programMap: remoteMap,
    inputQueue: 'swift.mt103.inbound',
    message: JSON.stringify(input),
    runRouter: '0',
    max: '65536'
  });
  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error(`ESP32 returned non-JSON execute result: ${raw.slice(0, 1200)}`);
  }
  assert.equal(result.publishedCount, 1);
  assert.equal(result.deliveries?.[0]?.queueName, 'swift.pacs008.outbound');
  assert.equal(result.globals?.GenericMapper__self__processed, 1);

  const output = result.deliveries[0].message;
  assert.match(output, /<MsgId>GM-ESP32-0001<\/MsgId>/);
  assert.match(output, /<EndToEndId>CBDS-E2E-ESP32-0001<\/EndToEndId>/);
  assert.match(output, /<IntrBkSttlmDt>2026-09-20<\/IntrBkSttlmDt>/);
  assert.match(output, /<IntrBkSttlmAmt[^>]*Ccy="USD"[^>]*>1000\.00<\/IntrBkSttlmAmt>/);
  assert.match(output, /<Nm>GENERIC APPLICANT<\/Nm>/);
  assert.match(output, /<Nm>GENERIC BENEFICIARY<\/Nm>/);

  console.log(JSON.stringify({
    status: 'PASS',
    host,
    runtime: 'esp32-pmachine',
    workerCount: 1,
    inputQueue: 'swift.mt103.inbound',
    outputQueue: result.deliveries[0].queueName,
    processedByGenericMapper: result.globals.GenericMapper__self__processed,
    stepCount: result.stepCount
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
