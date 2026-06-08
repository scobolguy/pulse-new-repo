import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ESP32_HOST = process.env.ESP32_HOST || '192.168.2.119';
const BASE_URL = `http://${ESP32_HOST}`;

const LOCAL_PASCAL = path.resolve(process.cwd(), 'data', 'hello-service.pas');
const LOCAL_ROUTER_RULES = path.resolve(process.cwd(), '..', 'pcode', 'hello-router-rules.generated.json');
const LOCAL_DATA_MAPPINGS = path.resolve(process.cwd(), '..', 'pcode', 'hello-data-mappings.generated.json');
const REMOTE_ROUTER_RULES = '/hrr.json';
const REMOTE_DATA_MAPPINGS = '/hdm.json';

async function compilePascalish() {
  await execFileAsync(process.execPath, [
    'scripts/compile-pascal.mjs',
    '--in', LOCAL_PASCAL,
    '--router-out', LOCAL_ROUTER_RULES,
    '--mapping-out', LOCAL_DATA_MAPPINGS,
    '--artifact-out', path.resolve(process.cwd(), '..', 'pcode', 'hello-compiled.artifact.json')
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

async function invokeHelloService() {
  const query = new URLSearchParams({
    serviceId: 'hello',
    rules: REMOTE_ROUTER_RULES,
    mappings: REMOTE_DATA_MAPPINGS,
    inputQueue: 'hello.in',
    message: 'ignored'
  });

  const res = await fetch(`${BASE_URL}/pmachine/router/run?${query.toString()}`);
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

  const result = await invokeHelloService();

  assert.ok(Array.isArray(result.deliveries), 'deliveries array missing');
  assert.ok(result.deliveries.length > 0, 'no deliveries produced');

  const first = result.deliveries[0] || {};
  assert.equal(String(first.outputQueue || ''), 'hello.out', 'unexpected output queue');
  assert.equal(String(first.message || ''), 'hello, world', 'unexpected output message');

  console.log(JSON.stringify({
    status: 'ok',
    host: ESP32_HOST,
    serviceId: result.serviceId || 'hello',
    delivery: {
      outputQueue: first.outputQueue,
      message: first.message
    },
    publishedCount: result.publishedCount
  }, null, 2));
}

main().catch((errorValue) => {
  console.error('[deploy-esp32-hello-service] failed:', errorValue?.message || String(errorValue));
  process.exitCode = 1;
});
