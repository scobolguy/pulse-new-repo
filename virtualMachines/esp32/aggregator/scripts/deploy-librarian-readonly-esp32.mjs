import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { runPcodeOnEsp32 } from './run-pascal-on-esp32-node.mjs';

const sourcePath = fileURLToPath(new URL('../../src/librarian/s3-readonly.pas', import.meta.url));
const node = process.env.ESP32_NODE_NAME || '192.168.2.90';
const ownerAggregatorId = process.env.PULSE_OWNER_AGGREGATOR_ID || '';
const reportTarget = process.env.PULSE_AGGREGATOR_REPORT_TARGET || '';
const filesystemBindingText = process.env.PULSE_FILESYSTEM_BINDING || '';
if (!ownerAggregatorId || !reportTarget || !filesystemBindingText) {
  throw new Error('Explicit owner aggregator, report target URL and Filesystem service binding are required');
}
const tokenFile = process.env.PULSE_AGGREGATOR_BEARER_TOKEN_FILE;
if (!tokenFile) throw new Error('PULSE_AGGREGATOR_BEARER_TOKEN_FILE is required for authenticated native deployment');
const { token } = JSON.parse(await fs.readFile(tokenFile, 'utf8'));
if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
  throw new Error('Invalid aggregator bearer token file');
}
let filesystemBinding;
try { filesystemBinding = JSON.parse(filesystemBindingText); }
catch { throw new Error('PULSE_FILESYSTEM_BINDING must be JSON with instanceId, endpoint and readinessUrl'); }
if (!ownerAggregatorId || !reportTarget || !filesystemBinding
  || typeof filesystemBinding.instanceId !== 'string'
  || typeof filesystemBinding.endpoint !== 'string'
  || typeof filesystemBinding.readinessUrl !== 'string') {
  throw new Error('Explicit owner aggregator, report target URL and Filesystem service binding are required');
}
for (const value of [reportTarget, filesystemBinding.endpoint, filesystemBinding.readinessUrl]) {
  let url;
  try { url = new URL(value); } catch { url = null; }
  if (!url || url.protocol !== 'http:' || !/^http:\/\/[^/:?#]+:\d+(?:\/|$)/.test(value)) {
    throw new Error('Native lifecycle transport requires explicit HTTP URLs and ports');
  }
}

const source = await fs.readFile(sourcePath, 'utf8');
const compiled = compilePascalishProgramWithAntlr(source, {
  fileName: sourcePath,
  hostServices: true
});
if (!compiled.programMap.targets.includes('esp32')
  || !compiled.programMap.requiredHostCapabilities.includes('service.transaction')) {
  throw new Error('The read-only Librarian profile is not an ESP32 logical-service transaction client');
}

const result = await runPcodeOnEsp32({
  pcodeText: compiled.pcodeText,
  programMap: compiled.programMap,
  node,
  sourceFileName: sourcePath,
  networkPeers: [],
  ownerAggregatorId,
  reportTarget: { aggregatorId: ownerAggregatorId, endpoint: reportTarget, bearerToken: token },
  serviceLifecycle: {
    version: 1,
    requires: compiled.programMap.serviceLifecycle.requires,
    bindings: { 'pulse-filesystem': filesystemBinding }
  }
});
console.log(JSON.stringify(result, null, 2));
