import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ESP32_TARGET = process.env.ESP32_NODE_NAME || process.env.ESP32_HOST || 'neptune.child1';
const NODE_REGISTRY_URL = process.env.NODE_REGISTRY_URL || 'http://127.0.0.1:4000/api/nodes';

const SERVICE_ID = 'helloService';
const LOCAL_PASCAL = path.resolve(process.cwd(), 'data', 'helloService.service.pas');
const LOCAL_ROUTER_RULES = path.resolve(process.cwd(), '..', 'pcode', 'helloService.router-rules.json');
const LOCAL_DATA_MAPPINGS = path.resolve(process.cwd(), '..', 'pcode', 'helloService.data-mappings.json');
const LOCAL_ARTIFACT = path.resolve(process.cwd(), '..', 'pcode', 'helloService.artifact.json');
const REMOTE_ROUTER_RULES = '/helloService.hrr.json';
const REMOTE_DATA_MAPPINGS = '/helloService.hdm.json';

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

function normalizeNodeName(value) {
  return String(value || '').trim().toLowerCase();
}

function collectHostCandidates(nodePayload, requestedHost) {
  const wanted = normalizeNodeName(requestedHost);
  const entries = Array.isArray(nodePayload) ? nodePayload : [];
  const picked = [];

  const add = (host) => {
    const value = String(host || '').trim();
    if (!value) return;
    if (!picked.includes(value)) picked.push(value);
  };

  add(requestedHost);

  for (const entry of entries) {
    const nodeName = normalizeNodeName(entry?.nodeName || entry?.details?.nodeName || '');
    const host = String(entry?.ip || '').trim();
    if (!host || host === '127.0.0.1') continue;

    if (nodeName === wanted || nodeName.includes(wanted) || wanted.includes(nodeName)) {
      add(host);
    }
  }

  return picked;
}

async function resolveHostCandidates(requestedHostOrNodeName) {
  try {
    const res = await fetch(NODE_REGISTRY_URL, { method: 'GET' });
    if (!res.ok) return [requestedHostOrNodeName];
    const payload = await res.json();
    return collectHostCandidates(payload, requestedHostOrNodeName);
  } catch {
    return [requestedHostOrNodeName];
  }
}

async function uploadRemoteFile(baseUrl, remotePath, content) {
  await postForm(`${baseUrl}/ffs/upload`, {
    file: remotePath,
    body: content
  }, `upload ${remotePath}`);
}

async function invokeHelloServiceGet(baseUrl) {
  const query = new URLSearchParams({
    serviceId: SERVICE_ID,
    rules: REMOTE_ROUTER_RULES,
    mappings: REMOTE_DATA_MAPPINGS,
    inputQueue: 'helloService.in',
    message: ''
  });

  const res = await fetch(`${baseUrl}/pmachine/router/run?${query.toString()}`, {
    method: 'GET'
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
  const hostCandidates = await resolveHostCandidates(ESP32_TARGET);

  const [routerRulesText, mappingsText] = await Promise.all([
    fs.readFile(LOCAL_ROUTER_RULES, 'utf8'),
    fs.readFile(LOCAL_DATA_MAPPINGS, 'utf8')
  ]);

  let resolvedHost = null;
  let result = null;
  let lastError = null;
  for (const hostCandidate of hostCandidates) {
    const baseUrl = `http://${hostCandidate}`;
    try {
      await uploadRemoteFile(baseUrl, REMOTE_ROUTER_RULES, routerRulesText);
      await uploadRemoteFile(baseUrl, REMOTE_DATA_MAPPINGS, mappingsText);
      result = await invokeHelloServiceGet(baseUrl);
      resolvedHost = hostCandidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!result || !resolvedHost) {
    throw lastError || new Error('No reachable ESP32 host found for deployment');
  }

  assert.ok(Array.isArray(result.deliveries), 'deliveries array missing');
  assert.ok(result.deliveries.length > 0, 'no deliveries produced');

  const helloDelivery = result.deliveries.find((delivery) => {
    return String(delivery?.outputQueue || '') === 'helloService.out'
      && String(delivery?.message || '') === 'hello, world';
  });

  assert.ok(helloDelivery, 'unexpected output message');

  console.log(JSON.stringify({
    status: 'ok',
    requestedTarget: ESP32_TARGET,
    host: resolvedHost,
    hostCandidates,
    serviceId: result.serviceId || SERVICE_ID,
    delivery: {
      outputQueue: helloDelivery.outputQueue,
      message: helloDelivery.message
    },
    publishedCount: result.publishedCount,
    matchedRuleCount: result.matchedRuleCount
  }, null, 2));
}

main().catch((errorValue) => {
  console.error('[deploy-esp32-helloService] failed:', errorValue?.message || String(errorValue));
  process.exitCode = 1;
});
