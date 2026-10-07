// Nondestructive installation/lease checks against an already-running shared-devices context.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { compilePascalishProgramWithAntlr as compile } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';

const origin = process.argv[2], reportPath = process.argv[3];
if (!origin || !reportPath) throw new Error('Usage: node verify-esp32-shared-device-installation.mjs <origin> <existing-proof.json>');
const id = 'shared-install-probe', wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(path, values) {
  for (let attempt = 0; ; attempt++) {
    const response = await requestEsp32(new URL(path, origin), {
      ...(values ? { method: 'POST', body: new URLSearchParams(values) } : {}), timeoutMs: 30000
    });
    const text = await response.text();
    const busy = response.status === 503 && (
      /^Service host(?: ingress)? busy(?: or unavailable)?$/.test(text) || /"busy"\s*:\s*true/.test(text));
    if (!busy || attempt === 3) return { status: response.status, text };
    await wait(250 + Math.floor(Math.random() * 751));
  }
}
async function status(collectorId = 'shared-devices') {
  const result = await request(`/pmachine/service_host/status?collectorId=${encodeURIComponent(collectorId)}`);
  assert.equal(result.status, 200, result.text);
  return JSON.parse(result.text);
}
const before = await status(), checks = [];
assert.ok([2, 3].includes(before.daemons.length), 'expected a bounded shared collector context');
const sharedImageCount = before.daemons.length + 1;
async function unchanged() {
  const current = await status();
  assert.equal(current.bootId, before.bootId);
  assert.equal(current.daemons.length, before.daemons.length);
  assert.equal(current.daemons[0].failures, before.daemons[0].failures);
}
const service = compile(`service 'install-probe';
get '/api/shared-install-probe'; begin return '{"probe":true}' end
end.`, { hostServices: true });
const daemon = compile(`daemon 'install-idle' refresh 60000 ms begin end.`, { hostServices: true });
for (const [name, unit] of [['sip', service], ['sid', daemon]]) {
  const image = encodeHostedImage(unit.pcodeText);
  const map = attachPcodeSignature({ ...compactServiceHostProgramMap(unit.programMap), hostImageFormat: 'PHI1' }, image);
  const uploaded = await requestEsp32(new URL(`/ffs/upload_stream?file=${encodeURIComponent(`/${name}.phi`)}`, origin), {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: image, timeoutMs: 30000
  });
  assert.equal(uploaded.status, 200, await uploaded.text());
  const mapped = await request('/ffs/upload', { file: `/${name}.map.json`, body: JSON.stringify(map) });
  assert.equal(mapped.status, 200, mapped.text);
}
const common = { serviceFile: '/sip.phi', serviceMap: '/sip.map.json', collectorId: id,
  observationTtlMs: '180000', announcementIntervalMs: '60000' };
const legacy = { ...common, daemonFile: '/sid.phi', daemonMap: '/sid.map.json', udpPort: '45219' };
let installed = false;
try {
  for (const [name, values, expected] of [
    ['invalid multicast metadata rejected transactionally', { ...common,
      daemons: JSON.stringify([{ file: '/scd.phi', map: '/scd.map.json', udpPort: 1900, multicastGroup: '192.168.2.1' }]) }, 400],
    ['four daemons rejected before installation', { ...common,
      daemons: JSON.stringify(Array(4).fill({ file: '/scd.phi', map: '/scd.map.json' })) }, 400],
    ['six image leases overflow before installing another four-image context', { ...common,
      daemons: JSON.stringify(Array(3).fill({ file: '/sid.phi', map: '/sid.map.json' })) }, 400],
    ['owned multicast UDP port conflicts with legacy context port', { ...legacy, udpPort: '1900' }, 409],
    ['duplicate context ID does not replace the running host', { ...legacy, collectorId: 'shared-devices' }, 409]
  ]) {
    const rejected = await request('/pmachine/service_host/install', values);
    assert.equal(rejected.status, expected, `${name}: ${rejected.text}`);
    if (name.startsWith('six image leases')) assert.match(rejected.text, /image capacity/i);
    await unchanged(); checks.push(name); console.log(`PASS: ${name}`);
  }
  const created = await request('/pmachine/service_host/install', legacy);
  assert.equal(created.status, 200, created.text); installed = true;
  const probe = await status(id);
  assert.equal(probe.serviceCount, 2);
  assert.equal(probe.workerTaskCount, 1);
  assert.equal(probe.daemons.length, 1);
  const response = await request('/api/shared-install-probe');
  assert.equal(response.status, 200, response.text);
  assert.deepEqual(JSON.parse(response.text), { probe: true });
  await unchanged();
  checks.push(`${sharedImageCount}-image shared host and legacy service/daemon pair coexist in ${sharedImageCount + 2} leases on one worker`);
  const overflow = await request('/pmachine/service_host/install', { ...legacy, collectorId: 'third-install-probe', udpPort: '45220' });
  assert.ok([400, 409, 503].includes(overflow.status), overflow.text);
  assert.match(overflow.text, /capacity|lease/i);
  assert.equal((await status(id)).bootId, probe.bootId);
  await unchanged();
  checks.push('two-context capacity rejects another context without disturbing either active context');
} finally {
  if (installed) {
    const stopped = await request(`/pmachine/service_host/stop?collectorId=${id}`, {});
    assert.equal(stopped.status, 200, stopped.text);
  }
  await unchanged();
}
const proof = JSON.parse(await fs.readFile(reportPath, 'utf8'));
proof.installationChecks = { checks, sharedBootId: before.bootId, final: await status() };
await fs.writeFile(reportPath, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof.installationChecks));
