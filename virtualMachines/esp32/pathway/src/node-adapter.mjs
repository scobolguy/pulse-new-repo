import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';

const maintenance = compilePascalishProgramWithAntlr(
  "daemon 'pathway-maintenance' every 60 seconds; begin host.table_expire('nodes') end.",
  { hostServices: true });

export const isDefinitiveRejection = error => Number.isInteger(error?.status) &&
  error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status);

export async function nodeRequest(origin, path, { values, text, timeoutMs = 2500 } = {}) {
  const response = await fetch(new URL(path, origin), {
    redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
    ...(values ? { method: 'POST', body: new URLSearchParams(values) } :
      text !== undefined ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: text } : {}),
  });
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 262144) {
      throw new Error('Node response capacity exceeded');
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  if (!response.ok) throw Object.assign(new Error(`${path}: HTTP ${response.status}: ${body.slice(0, 256)}`),
    { status: response.status, uncertain: text !== undefined });
  return body;
}

export function createNodeAdapter({ timeoutMs = 2500 } = {}) {
  const request = (node, path, options = {}) => nodeRequest(node.origin, path, { timeoutMs, ...options });
  return {
    async describe(node) {
      const status = JSON.parse(await request(node, '/status'));
      const hosted = await this.inspect(node);
      if (hosted.hostBindingsVersion !== 1) throw new Error('Node lacks hosted service ABI version 1');
      const runtime = /js-pmachine|javascript/.test(status.runtime ?? '') ? 'js' :
        /esp32/.test(hosted.runtime ?? '') ? 'esp32' : null;
      if (!runtime) throw new Error('Node does not expose a supported hosted p-machine');
      const serviceCapabilities = status.serviceCapabilities ?? {};
      if (typeof serviceCapabilities !== 'object' || Array.isArray(serviceCapabilities) ||
          Object.keys(serviceCapabilities).length > 64 ||
          Object.entries(serviceCapabilities).some(([name, capabilities]) =>
            !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name) || !Array.isArray(capabilities) ||
            capabilities.length > 32 || capabilities.some(value => typeof value !== 'string'))) {
        throw new Error('Node exposes invalid service capability grants');
      }
      return { runtime, ...(Object.keys(serviceCapabilities).length ? { serviceCapabilities } : {}) };
    },
    async inspect(node) {
      return JSON.parse(await request(node, '/pmachine/service_host/status'));
    },
    async retire(node, collectorId) {
      const state = await this.inspect(node);
      if (state.running && state.collectorId === collectorId) {
        await request(node, '/pmachine/service_host/stop', { values: { collectorId } });
      }
    },
    async install(node, definition, collectorId) {
      const state = await this.inspect(node);
      if (state.running && state.collectorId !== collectorId) throw new Error('Node occupied by another hosted service');
      if (state.running) return;
      const prefix = `/pw-${collectorId.replace(/[^A-Za-z0-9_-]/g, '-')}`;
      const uploads = [];
      for (const [label, compiled] of [['service', definition.artifact], ['daemon', maintenance]]) {
        const pcodeText = node.runtime === 'esp32' ? encodeHostedImage(compiled.pcodeText) : compiled.pcodeText;
        const programMap = compactServiceHostProgramMap(compiled.programMap);
        if (node.runtime === 'esp32') programMap.hostImageFormat = 'PHI1';
        const pcode = `${prefix}-${label}.pcode`;
        const map = `${prefix}-${label}.json`;
        for (const [file, body] of [[pcode, pcodeText], [map, JSON.stringify(attachPcodeSignature(programMap, pcodeText))]]) {
          await request(node, '/ffs/upload', { values: { file, body } });
        }
        uploads.push({ file: pcode, map });
      }
      await request(node, '/pmachine/service_host/install', { values: {
        serviceFile: uploads[0].file, serviceMap: uploads[0].map,
        daemons: JSON.stringify([{ ...uploads[1], udpPort: 0 }]), collectorId,
        ...(definition.networkPeers ? { networkPeers: JSON.stringify(definition.networkPeers) } : {}),
      } });
      const installed = await this.inspect(node);
      if (!installed.running || installed.collectorId !== collectorId) throw new Error('Node did not acknowledge hosted installation');
    },
    async send(node, definition, record, { requestId } = {}) {
      return JSON.parse(await request(node, definition.path, { text: JSON.stringify({ data: record, ...(requestId ? { requestId } : {}) }) }));
    },
  };
}
