import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { boundedGet, isPreExecutionBusy } from '../../pmachines/javascript/src/device-federation.mjs';

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const config = JSON.parse(await fs.readFile(value('--config', new URL('../../config/federated-device-cache.json', import.meta.url)), 'utf8'));
const reportPath = value('--report');
assert.ok(reportPath, '--report is required');
const duration = Number(value('--soak-ms', '240000'));
assert.ok(Number.isSafeInteger(duration) && duration >= 60000 && duration <= 600000, 'Bounded soak: 60000..600000 ms');
let report;
try { report = JSON.parse(await fs.readFile(reportPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; report = {}; }
const origin = `http://${config.httpHost}:${config.aggregationHttpPort}`;
const read = async (url, maxBytes = 49152) => {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const response = await boundedGet(url, { signal: AbortSignal.timeout(100000), timeoutMs: 100000, maxBytes });
    if (isPreExecutionBusy(response.status, response.text) && attempt < 3) {
      report.deployment.busyRetries.push({ at: new Date().toISOString(), url, attempt: attempt + 1 });
      await new Promise(resolve => setTimeout(resolve, 250 + Math.floor(Math.random() * 751)));
      continue;
    }
    assert.equal(response.status, 200, `${url}: ${response.status} ${response.text}`);
    return JSON.parse(response.text);
  }
};
async function pages(path, field, limit) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let cursor = '', revision = '', first, result = [];
    try {
      for (let index = 0; index < limit; index++) {
        const page = await read(`${origin}${path}?${new URLSearchParams({ cursor, revision })}`);
        first ??= page;
        assert.equal(page.revision, first.revision);
        result.push(...page[field]);
        if (!page.nextCursor) {
          assert.equal(result.length, first.total);
          return { metadata: first, values: result };
        }
        cursor = page.nextCursor; revision = page.revision;
      }
      throw new Error('Aggregation proof page limit exceeded');
    } catch (error) {
      if (!/revision changed|cursor expired/.test(error.message) || attempt === 2) throw error;
    }
  }
}
if (report.deployment) {
  report.previousDeploymentAttempt = report.deployment;
  report.previousDeploymentAttempt.note = 'Interrupted to recognize the actual explicit ESP32 preexecution busy envelope; errors retained, not erased';
}
report.deployment = {
  architecture: 'Physical ESP32 Kasa; separate Pascalish-compiled JS p-machine Tuya and passive SSDP contexts on one PC; central JavaScript materialized full-snapshot cache',
  independence: 'PC logical collector identities are not proof of physically independent failure domains',
  realTrafficOnly: true,
  apis: { names: `${origin}/api/devices/names`, devices: `${origin}/api/devices`,
    sourceHealth: `${origin}/api/devices/source-health` },
  startedAt: new Date().toISOString(), requestedSoakMs: duration, samples: [], errors: [], busyRetries: []
};
const save = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2));
const started = performance.now();
do {
  const sample = { at: new Date().toISOString(), elapsedMs: Math.floor(performance.now() - started) };
  try {
    sample.synchronization = await read(`${origin}/api/devices/refresh`);
    const names = await pages('/api/devices/names', 'names', 15);
    const devices = await pages('/api/devices', 'records', 75);
    sample.names = names.values;
    sample.devices = devices.values;
    sample.completeness = devices.metadata.completeness;
    sample.sourceHealth = devices.metadata.sources;
    assert.equal(new Set(sample.devices.map(record => record.key)).size, sample.devices.length);
    assert.ok(sample.devices.every(record => record.confidence === 'PROVISIONAL' && record.evidence.length === 1),
      'This live deployment has only one configured collector per protocol; no fake corroboration');
    sample.esp32 = await read(`${config.esp32Origin}/pmachine/service_host/status?collectorId=${encodeURIComponent(config.kasaCollectorId)}`, 4096);
    for (const protocol of ['tuya', 'ssdp']) sample[protocol] =
      await read(`http://${config.httpHost}:${config[`${protocol}HttpPort`]}/pmachine/service_host/status`, 4096);
  } catch (error) {
    sample.error = error.message;
    report.deployment.errors.push({ at: sample.at, error: error.message });
  }
  report.deployment.samples.push(sample);
  await save();
  const remaining = duration - (performance.now() - started);
  if (remaining <= 0) break;
  await new Promise(resolve => setTimeout(resolve, Math.min(30000, remaining)));
} while (true);
const final = report.deployment.samples.at(-1);
report.deployment.completedAt = new Date().toISOString();
report.deployment.measuredSoakMs = Math.floor(performance.now() - started);
report.deployment.realProtocols = [...new Set(report.deployment.samples.flatMap(sample =>
  (sample.devices ?? []).map(record => record.device.protocol)))].sort();
report.deployment.completeAtEnd = final.completeness;
report.deployment.collectionWarnings = final.sourceHealth?.filter(source => source.collection !== 'ok') ?? [];
report.deployment.success = !report.deployment.errors.length && final.sourceHealth?.every(source => source.synchronization === 'ok') &&
  report.deployment.realProtocols.join(',') === 'kasa,ssdp,tuya' &&
  final.names.includes('Bedroom') && final.names.includes('Den');
report.deployment.finiteObservationOnly = true;
await save();
console.log(JSON.stringify({ success: report.deployment.success, measuredSoakMs: report.deployment.measuredSoakMs,
  realProtocols: report.deployment.realProtocols, names: final.names, errors: report.deployment.errors,
  esp32: final.esp32, sourceHealth: final.sourceHealth }, null, 2));
if (!report.deployment.success) process.exitCode = 1;
