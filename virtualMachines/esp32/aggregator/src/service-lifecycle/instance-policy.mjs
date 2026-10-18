import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createServiceInstancePolicy({ logger = console } = {}) {
  const fileName = fileURLToPath(new URL('../../../src/service-lifecycle/instance.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true,
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-service-instance-policy',
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: 100000, maxExecutionMs: 2000, logger, lifecycle: false,
  });
  await host.start();
  return {
    async dispatch(path, payload) {
      if (!['/evaluate', '/report', '/gate', '/transport-policy', '/transaction-action'].includes(path)) {
        throw new Error(`Unsupported service-instance policy route: ${path}`);
      }
      const response = await host.dispatch({
        transport: 'internal', method: 'POST', path, body: JSON.stringify(payload),
      });
      if (response.status !== 200 || typeof response.body?.ok !== 'boolean') {
        throw new Error(response.body?.error || 'Invalid Pascalish service-instance policy response');
      }
      if (!response.body.ok) throw new Error(response.body.error);
      return response.body;
    },
    stop: () => host.stop(),
  };
}
