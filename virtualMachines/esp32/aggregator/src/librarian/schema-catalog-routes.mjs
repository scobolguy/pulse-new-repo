import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createPascalishLibrarianSchemaCatalogRoutes({ logger = console } = {}) {
  const fileName = fileURLToPath(new URL('../../../src/librarian/routes/schema-catalog.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-http-schema-catalog',
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: 10000000, maxExecutionMs: 10000, logger
  });
  await host.start();
  return {
    async dispatch({ method, path, physicalSchemas = [], subschemas = [] }) {
      const result = await host.dispatch({
        transport: 'internal', method: 'POST', path: '/dispatch',
        body: JSON.stringify({ method, path, physicalSchemas, subschemas })
      });
      if (result.status !== 200 || !result.body || typeof result.body !== 'object'
        || typeof result.body.matched !== 'boolean' || !Number.isInteger(result.body.status)
        || !Object.hasOwn(result.body, 'body')) {
        throw Object.assign(new Error(result.body?.error || 'Invalid Pascalish Librarian schema-catalog result'), {
          status: result.status
        });
      }
      return result.body;
    },
    stop: () => host.stop()
  };
}
