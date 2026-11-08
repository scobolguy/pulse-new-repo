import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { compilePascalishProgramWithAntlr } from '../../virtualMachines/esp32/aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from '../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';
import { deployAssemblerish } from './deploy.mjs';

export async function installTimerDot(baseUrl, { confirmed = false } = {}) {
  if (!confirmed) throw new Error('Installing the timer-dot demo requires --confirm-install');
  const origin = new URL(baseUrl);
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('Provide an HTTP(S) board URL');
  async function request(path, values) {
    const deadline = Date.now() + 60000;
    for (;;) {
      const response = await fetch(new URL(path, origin), {
        ...(values ? { method: 'POST', body: new URLSearchParams(values) } : {}),
        signal: AbortSignal.timeout(10000),
      });
      const text = await response.text();
      if (path === '/ffs/upload' && response.status === 503 &&
          text === 'FFS storage unavailable: no SD or remote filesystem' && Date.now() < deadline) {
        await delay(1000);
        continue;
      }
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
      return text;
    }
  }
  const hostStatus = JSON.parse(await request('/pmachine/service_host/status'));
  const hardwareStatus = await deployAssemblerish({ action: 'status', baseUrl });
  if (hostStatus.running || hardwareStatus.installed || hardwareStatus.busy) {
    throw new Error('Existing hosted service or hardware handler: stop it explicitly before installing this demo');
  }
  const source = name => readFile(new URL(`./examples/${name}`, import.meta.url), 'utf8');
  const [handlerSource, serviceSource, daemonSource] = await Promise.all([
    source('timer-dot.asmish'), source('timer-dot-service.pas'), source('timer-dot-daemon.pas'),
  ]);
  const service = compilePascalishProgramWithAntlr(serviceSource, { hostServices: true });
  const daemon = compilePascalishProgramWithAntlr(daemonSource, { hostServices: true });
  const prefix = `/timer-dot-${Date.now().toString(36)}`;
  const files = [];
  let hosted = false, installed = false;
  try {
    for (const [name, artifact] of [['service', service], ['daemon', daemon]]) {
      for (const [suffix, content] of [
        ['pcode', artifact.pcodeText],
        ['map.json', JSON.stringify(attachPcodeSignature(compactServiceHostProgramMap(artifact.programMap), artifact.pcodeText))],
      ]) {
        const file = `${prefix}-${name}.${suffix}`;
        await request('/ffs/upload', { file, body: content });
        files.push(file);
      }
    }
    await request('/pmachine/service_host/install', {
      serviceFile: `${prefix}-service.pcode`, serviceMap: `${prefix}-service.map.json`,
      daemons: JSON.stringify([{ file: `${prefix}-daemon.pcode`, map: `${prefix}-daemon.map.json`, udpPort: 0 }]),
      collectorId: 'timer-dot-demo',
    });
    hosted = true;
    await deployAssemblerish({
      action: 'install', baseUrl, sourceText: handlerSource, fileName: 'timer-dot.asmish',
      allowedPins: [], confirmed: true,
    });
    installed = true;
    const initial = await deployAssemblerish({ action: 'status', baseUrl });
    const deadline = Date.now() + 12000;
    let status;
    do {
      await delay(500);
      status = await deployAssemblerish({ action: 'status', baseUrl });
      if (status.failures !== initial.failures || status.faulted) {
        throw new Error(`Timer-dot handler failed: ${JSON.stringify(status)}`);
      }
    } while (status.delivered - initial.delivered < 5 && Date.now() < deadline);
    if (status.delivered - initial.delivered < 5) throw new Error('Timer failed to deliver five events');
    return { running: true, intervalMs: 1000, status, files };
  } catch (error) {
    if (installed) await deployAssemblerish({ action: 'remove', baseUrl, confirmed: true });
    if (hosted) await request('/pmachine/service_host/stop', {});
    for (const file of files) await request('/ffs/delete', { file });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('--url');
  const url = urlIndex >= 0 ? args[urlIndex + 1] : process.env.PMACHINE_URL;
  if (!url) throw new Error('Provide --url http://board-address');
  installTimerDot(url, { confirmed: args.includes('--confirm-install') })
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
