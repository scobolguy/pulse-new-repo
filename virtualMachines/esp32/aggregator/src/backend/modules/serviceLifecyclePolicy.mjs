import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../../pmachines/javascript/src/service-host.mjs';

export async function createServiceLifecyclePolicy({
  logger = console,
  source = '../../../../src/service-lifecycle/orchestration.pas',
  collectorId = 'pulse-service-orchestration',
} = {}) {
  const fileName = fileURLToPath(new URL(source, import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true,
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId,
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: 1000000, maxExecutionMs: 5000, logger,
  });
  await host.start();
  return {
    async dispatch(path, payload) {
      const response = await host.dispatch({
        transport: 'internal', method: 'POST', path, body: JSON.stringify(payload),
      });
      if (response.status !== 200 || typeof response.body?.ok !== 'boolean') {
        throw new Error(response.body?.error || 'Invalid Pascalish orchestration response');
      }
      if (!response.body.ok) throw new Error(response.body.error);
      return response.body;
    },
    stop: () => host.stop(),
  };
}
