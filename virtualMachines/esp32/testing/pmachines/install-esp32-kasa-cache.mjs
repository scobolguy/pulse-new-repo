import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';
import { isPreExecutionBusy } from '../../pmachines/javascript/src/device-federation.mjs';

export async function installKasaCache(config, { reportPath, captureOnly = false } = {}) {
  const idle = async (path, values) => {
    for (let attempt = 0; attempt <= 3; attempt++) {
      // Never retry a transport failure or a success-shaped installation response.
      const response = await requestEsp32(new URL(path, config.esp32Origin), {
        ...(values ? { method: 'POST', body: new URLSearchParams(values) } : {}), timeoutMs: 10000
      });
      const text = await response.text();
      if (isPreExecutionBusy(response.status, text) && attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 250 + Math.floor(Math.random() * 751)));
        continue;
      }
      assert.equal(response.status, 200, `${path}: ${response.status} ${text}`);
      if (path === '/ffs/upload') {
        assert.equal(text, 'File uploaded', 'Unexpected FFS upload acknowledgement');
        return { uploaded: true };
      }
      return JSON.parse(text);
    }
  };
  let report = { startedAt: new Date().toISOString(), warnings: [], checks: [] };
  if (reportPath) {
    try { report = JSON.parse(await fs.readFile(reportPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const selected = await idle('/pmachine/service_host/status?collectorId=shared-devices');
  if (!report.before && selected.collectorId === 'shared-devices') report.before = selected;
  report.recovery = {
    note: 'Retained FFS images are not overwritten. Restore only this prior shared-devices context; no uploadfs.',
    endpoint: `${config.esp32Origin}/pmachine/service_host/install`,
    values: { serviceFile: '/dcs.phi', serviceMap: '/dcs.map.json', collectorId: 'shared-devices',
      daemons: JSON.stringify([{ file: '/kcd.phi', map: '/kcd.map.json' }, { file: '/tcd.phi', map: '/tcd.map.json', udpPort: 6667 }]),
      observationTtlMs: '180000', announcementIntervalMs: '60000',
      networkPeers: JSON.stringify(config.kasaPeers.map(ip => ({ ip, port: 9999 }))) }
  };
  const save = async () => { if (reportPath) await fs.writeFile(reportPath, JSON.stringify(report, null, 2)); };
  await save();
  if (captureOnly) return report;
  const compile = async (name, file, adjust = source => source) => {
    const compiled = compilePascalishProgramWithAntlr(adjust(await fs.readFile(new URL(`../../src/${name}`, import.meta.url), 'utf8')), { hostServices: true });
    const image = encodeHostedImage(compiled.pcodeText);
    const map = attachPcodeSignature({ ...compactServiceHostProgramMap(compiled.programMap), hostImageFormat: 'PHI1' }, image);
    assert.ok(Number.parseInt(image.slice(4, 12), 16) <= 512);
    return { file, mapFile: file.replace('.phi', '.map.json'), image, map };
  };
  const suffix = randomBytes(4).toString('hex');
  const service = await compile('device-cache-service.pas', `/fs${suffix}.phi`);
  const daemon = await compile('kasa-collector-daemon.pas', `/fk${suffix}.phi`, source =>
    source.replace("'192.168.2.28'", `'${config.kasaPeers[0]}'`).replace("'192.168.2.29'", `'${config.kasaPeers[1]}'`));
  for (const unit of [service, daemon]) {
    const image = await requestEsp32(new URL(`/ffs/upload_stream?file=${encodeURIComponent(unit.file)}`, config.esp32Origin), {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: unit.image, timeoutMs: 30000
    });
    assert.equal(image.status, 200, await image.text());
    await idle('/ffs/upload', { file: unit.mapFile, body: JSON.stringify(unit.map) });
  }
  // Selective replacement only; unrelated contexts, WiFi configuration and LittleFS remain intact.
  for (const id of ['shared-devices', config.kasaCollectorId]) {
    const current = await idle(`/pmachine/service_host/status?collectorId=${encodeURIComponent(id)}`);
    if (current.collectorId === id) await idle(`/pmachine/service_host/stop?collectorId=${encodeURIComponent(id)}`, {});
  }
  report.install = { serviceFile: service.file, serviceMap: service.mapFile,
    daemons: JSON.stringify([{ file: daemon.file, map: daemon.mapFile }]), collectorId: config.kasaCollectorId,
    observationTtlMs: '180000', announcementIntervalMs: '60000',
    networkPeers: JSON.stringify(config.kasaPeers.map(ip => ({ ip, port: 9999 }))) };
  await save();
  try {
    await idle('/pmachine/service_host/install', report.install);
    report.afterInstall = await idle(`/pmachine/service_host/status?collectorId=${encodeURIComponent(config.kasaCollectorId)}`);
    assert.equal(report.afterInstall.daemons.length, 1);
    assert.equal(report.afterInstall.daemons[0].udpPort, 0);
    report.checks.push('Physical ESP32 selectively replaced with signed Kasa-only cache context; retained shared images and WiFi/LittleFS');
  } catch (error) {
    report.installError = error.message;
    await save();
    throw error;
  }
  await save();
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const index = args.indexOf('--report');
  const config = JSON.parse(await fs.readFile(new URL('../../config/federated-device-cache.json', import.meta.url), 'utf8'));
  const report = await installKasaCache(config, { captureOnly: args.includes('--capture-only'), reportPath: index < 0 ? undefined : args[index + 1] });
  console.log(JSON.stringify({ before: report.before, afterInstall: report.afterInstall, checks: report.checks }));
}
