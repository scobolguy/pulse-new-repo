import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';

export async function createHostedDeploymentPolicy({ logger = console } = {}) {
  const sourceUrl = new URL('../../src/service-lifecycle/hosted-deployment.pas', import.meta.url);
  const fileName = fileURLToPath(sourceUrl);
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(sourceUrl, 'utf8'), {
    fileName,
    hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled,
    collectorId: 'pulse-hosted-deployment-policy',
    httpPort: null,
    udpPort: null,
    maxBodyBytes: 1000000,
    maxResponseBytes: 1000000,
    desktopBudget: true,
    maxSteps: 1000000,
    maxExecutionMs: 5000,
    logger
  });
  await host.start();
  return {
    async validate({ compiledProgramMap, intent, installAction = false }) {
      const response = await host.dispatch({
        transport: 'internal',
        method: 'POST',
        path: '/validate',
        body: JSON.stringify({ compiledProgramMap, intent, installAction })
      });
      if (response.status !== 200 || response.body?.ok !== true) {
        throw new Error(response.body?.error || 'Invalid Pascalish hosted deployment policy response');
      }
      return response.body.intent;
    },
    stop: () => host.stop()
  };
}
