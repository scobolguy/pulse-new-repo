import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createPascalishLibrarianSchemaLookupRoutes({ logger = console } = {}) {
  const fileName = fileURLToPath(new URL('../../../src/librarian/routes/schema-lookup.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-http-schema-lookup',
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: null, maxExecutionMs: null, logger
  });
  await host.start();
  return {
    async dispatch({ method, path, type, name, version, schemas }) {
      const result = await host.dispatch({
        transport: 'internal', method: 'POST', path: '/dispatch',
        body: JSON.stringify({
          method, path, type, name, version: version ?? 0,
          hasVersionFilter: version ? 1 : 0,
          schemas: schemas.map(({ type: schemaType, name: schemaName, version: schemaVersion }) => ({
            type: schemaType, name: schemaName, version: schemaVersion ?? 0
          }))
        })
      });
      if (result.status !== 200 || !result.body || typeof result.body !== 'object'
        || typeof result.body.matched !== 'boolean' || !Number.isInteger(result.body.status)
        || !Object.hasOwn(result.body, 'body')) {
        throw Object.assign(new Error(result.body?.error || 'Invalid Pascalish Librarian schema-lookup result'), {
          status: result.status
        });
      }
      if (result.body.matched && result.body.status === 200
        && (!Number.isInteger(result.body.body?.selectedIndex)
          || result.body.body.selectedIndex < 0 || result.body.body.selectedIndex >= schemas.length)) {
        throw new Error('Pascalish Librarian schema-lookup returned an invalid selected index');
      }
      return result.body;
    },
    stop: () => host.stop()
  };
}
