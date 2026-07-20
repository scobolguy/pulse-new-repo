import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ESP32_HOST = process.env.ESP32_HOST || '192.168.2.157';
const BASE_URL = `http://${ESP32_HOST}`;

const LOCAL_PASCAL = path.resolve(process.cwd(), 'data', 'mt103-to-pacs.service.pas');
const LOCAL_ROUTER_RULES = path.resolve(process.cwd(), '..', 'pcode', 'mt103-to-pacs.router-rules.json');
const LOCAL_DATA_MAPPINGS = path.resolve(process.cwd(), '..', 'pcode', 'mt103-to-pacs.data-mappings.json');
const LOCAL_ARTIFACT = path.resolve(process.cwd(), '..', 'pcode', 'mt103-to-pacs.artifact.json');
const REMOTE_ROUTER_RULES = '/hrr.json';
const REMOTE_DATA_MAPPINGS = '/hdm.json';

async function compilePascalish() {
  await execFileAsync(process.execPath, [
    'scripts/compile-pascal.mjs',
    '--in', LOCAL_PASCAL,
    '--router-out', LOCAL_ROUTER_RULES,
    '--mapping-out', LOCAL_DATA_MAPPINGS,
    '--artifact-out', LOCAL_ARTIFACT
  ], {
    cwd: process.cwd(),
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8
  });
}

async function postForm(url, params, label) {
  const body = new URLSearchParams(params);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label} failed (${res.status}): ${text.slice(0, 220)}`);
  }
  return text;
}

async function uploadRemoteFile(remotePath, content) {
  await postForm(`${BASE_URL}/ffs/upload`, {
    file: remotePath,
    body: content
  }, `upload ${remotePath}`);
}

async function invokeService() {
  const mt103 = [
    'MT103',
    ':20:HB-ESP32-DEPLOY-001',
    ':32A:260514USD22500,',
    ':50K:APPLICANT CORP',
    ':57A:BKTRUS33',
    ':59:/000123456',
    'BENEFICIARY LTD'
  ].join('\n');

  const query = new URLSearchParams({
    serviceId: 'mt103-to-pacs-service',
    rules: REMOTE_ROUTER_RULES,
    mappings: REMOTE_DATA_MAPPINGS,
    inputQueue: 'swift.mt103.parsed',
    message: mt103
  });

  const res = await fetch(`${BASE_URL}/pmachine/router/run?${query.toString()}`, {
    method: 'POST'
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`invoke service failed (${res.status}): ${text.slice(0, 220)}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`invoke returned non-JSON: ${text.slice(0, 220)}`);
  }

  return payload;
}

async function main() {
  await compilePascalish();

  const [routerRulesText, mappingsText] = await Promise.all([
    fs.readFile(LOCAL_ROUTER_RULES, 'utf8'),
    fs.readFile(LOCAL_DATA_MAPPINGS, 'utf8')
  ]);

  await uploadRemoteFile(REMOTE_ROUTER_RULES, routerRulesText);
  await uploadRemoteFile(REMOTE_DATA_MAPPINGS, mappingsText);

  const result = await invokeService();
  assert.ok(Array.isArray(result.deliveries), 'deliveries array missing');
  assert.ok(result.deliveries.length > 0, 'no deliveries produced');

  const first = result.deliveries[0] || {};

  console.log(JSON.stringify({
    status: 'ok',
    host: ESP32_HOST,
    rulesFile: REMOTE_ROUTER_RULES,
    mappingsFile: REMOTE_DATA_MAPPINGS,
    publishedCount: result.publishedCount,
    delivery: {
      outputQueue: first.outputQueue,
      messageFormat: first.messageFormat || 'unknown',
      outputType: first.outputType || null,
      messagePreview: String(first.message || '').slice(0, 240)
    }
  }, null, 2));
}

main().catch((errorValue) => {
  console.error('[deploy-esp32-mt103-pacs-service] failed:', errorValue?.message || String(errorValue));
  process.exitCode = 1;
});
