import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createPascalishLibrarianSchemaOperationRoutes({ logger = console } = {}) {
  const fileName = fileURLToPath(new URL('../../../src/librarian/routes/schema-operations.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-http-schema-operations',
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: null, maxExecutionMs: null, logger
  });
  await host.start();
  let dispatchQueue = Promise.resolve();

  async function dispatch(input) {
    const resultPromise = dispatchQueue.then(() => host.dispatch({
      transport: 'internal', method: 'POST', path: '/dispatch',
      body: JSON.stringify({
        phase: '', schemaPath: '', newName: '', nextPath: '', error: '',
        errorField: '', hasDependents: '', dependentIds: [], safe: '',
        exists: '', notFound: 0, validation: 0,
        ...input
      })
    }));
    dispatchQueue = resultPromise.then(() => undefined, () => undefined);
    const result = await resultPromise;
    if (result.status !== 200 || !result.body || typeof result.body !== 'object'
      || typeof result.body.matched !== 'boolean' || !Number.isInteger(result.body.status)
      || !Object.hasOwn(result.body, 'body')) {
      throw Object.assign(new Error(result.body?.error || 'Invalid Pascalish schema-operation result'), {
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
