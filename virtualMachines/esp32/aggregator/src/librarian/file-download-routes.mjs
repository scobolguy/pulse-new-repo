import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createPascalishLibrarianFileDownloadRoutes({ logger = console } = {}) {
  const fileName = fileURLToPath(new URL('../../../src/librarian/routes/file-download.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-http-file-download',
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: 10000000, maxExecutionMs: 10000, logger
  });
  await host.start();
  return {
    async dispatch({ method, path, filePath, candidateExists }) {
      const result = await host.dispatch({
        transport: 'internal', method: 'POST', path: '/dispatch',
        body: JSON.stringify({ method, path, filePath, candidateExists })
      });
      if (result.status !== 200 || !result.body || typeof result.body !== 'object'
        || typeof result.body.matched !== 'boolean' || !Number.isInteger(result.body.status)
        || !Object.hasOwn(result.body, 'body')) {
        throw Object.assign(new Error(result.body?.error || 'Invalid Pascalish Librarian file-download result'), {
          status: result.status
        });
      }
      if (result.body.matched && result.body.status === 200
        && (!Number.isInteger(result.body.body?.selectedIndex)
          || result.body.body.selectedIndex < 0
          || result.body.body.selectedIndex >= candidateExists.length)) {
        throw new Error('Pascalish Librarian file-download returned an invalid candidate index');
      }
      return result.body;
    },
    stop: () => host.stop()
  };
}
