import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createPascalishLibrarianMetadataRoutes({ logger = console } = {}) {
  const fileName = fileURLToPath(new URL('../../../src/librarian/routes/metadata.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-http-metadata',
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: 10000000, maxExecutionMs: 10000, logger
  });
  await host.start();
  return {
    async dispatch({ method, path, files }) {
      const result = await host.dispatch({
        transport: 'internal', method: 'POST', path: '/dispatch',
        body: JSON.stringify({ method, path, files })
      });
      if (result.status !== 200 || !result.body || typeof result.body !== 'object'
        || typeof result.body.matched !== 'boolean' || !Number.isInteger(result.body.status)
        || !Object.hasOwn(result.body, 'body')) {
        throw Object.assign(new Error(result.body?.error || 'Invalid Pascalish Librarian route result'), {
          status: result.status
        });
      }
      return result.body;
    },
    stop: () => host.stop()
  };
}
