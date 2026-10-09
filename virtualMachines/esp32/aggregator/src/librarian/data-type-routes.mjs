import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createPascalishLibrarianDataTypeRoutes({ logger = console } = {}) {
  const fileName = fileURLToPath(new URL('../../../src/librarian/routes/data-types.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-http-data-types',
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: null, maxExecutionMs: null, logger
  });
  await host.start();

  async function dispatch(input) {
    const result = await host.dispatch({
      transport: 'internal', method: 'POST', path: '/dispatch',
      body: JSON.stringify({
        phase: '', error: '', label: '', newId: '', errorStatus: 0, catalogDecision: 0,
        ...input
      })
    });
    if (result.status !== 200 || !result.body || typeof result.body !== 'object'
      || typeof result.body.matched !== 'boolean' || !Number.isInteger(result.body.status)
      || !Object.hasOwn(result.body, 'body')) {
      throw Object.assign(new Error(result.body?.error || 'Invalid Pascalish data-type route result'), {
        status: result.status
      });
    }
    return result.body;
  }

  return {
    dispatch,
    stop: () => host.stop()
  };
}
