import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createDiscoveryPolicy({ logger = console } = {}) {
  const fileName = fileURLToPath(new URL('../../../src/service-lifecycle/discovery.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true,
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-lan-discovery-policy', httpPort: null, udpPort: null,
    lifecycle: false, maxBodyBytes: 65536, maxResponseBytes: 65536,
    desktopBudget: true, maxSteps: 200000, maxExecutionMs: 2000, logger,
  });
  await host.start();
  return {
    async dispatch(path, payload = {}) {
      const response = await host.dispatch({
        transport: 'internal', method: 'POST', path, body: JSON.stringify(payload),
      });
      if (response.status !== 200 || response.body?.ok !== true) {
        throw new Error(response.body?.error || 'Invalid Pascalish discovery response');
      }
      return response.body;
    },
    stop: () => host.stop(),
  };
}
