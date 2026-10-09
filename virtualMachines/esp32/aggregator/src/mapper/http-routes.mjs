import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

async function createRouteHost(sourceFile, collectorId, logger) {
  const fileName = fileURLToPath(new URL(sourceFile, import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId,
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    maxEvents: 64, desktopBudget: true, maxSteps: null, maxExecutionMs: null, logger
  });
  await host.start();
  let queue = Promise.resolve();

  async function dispatch(input) {
    const resultPromise = queue.then(() => host.dispatch({
      transport: 'internal', method: 'POST', path: '/dispatch',
      body: JSON.stringify({
        phase: '', method: '', path: '', id: '', newId: '', name: '', scope: '',
        serviceLocal: 'false', localMapError: '', prompt: '', nodeId: '', hasIntent: 'false', csvContent: '',
        sourcePath: '', targetPath: '', payloadKind: '', testCaseId: '',
        error: '', responseStatus: 200, response: null,
        ...input
      })
    }));
    queue = resultPromise.then(() => undefined, () => undefined);
    const result = await resultPromise;
    if (result.status !== 200 || !result.body || typeof result.body !== 'object'
      || typeof result.body.matched !== 'boolean' || typeof result.body.operation !== 'string'
      || !Number.isInteger(result.body.status) || !Object.hasOwn(result.body, 'body')) {
      throw Object.assign(new Error(result.body?.error || 'Invalid Pascalish Mapper route result'), {
        status: result.status
      });
    }
    return result.body;
  }

  return { dispatch, stop: () => host.stop() };
}

export async function createPascalishMapperHttpRoutes({ logger = console } = {}) {
  const maps = await createRouteHost('../../../src/mapper/routes/maps.pas', 'pulse-data-mapper-http-maps', logger);
  const authoring = await createRouteHost('../../../src/mapper/routes/authoring.pas', 'pulse-data-mapper-http-authoring', logger);

  async function dispatch(input) {
    const result = input.path.startsWith('/api/mapper/authoring/')
      ? await authoring.dispatch(input)
      : await maps.dispatch(input);
    return result;
  }

  return {
    dispatch,
    stop: async () => {
      await Promise.all([maps.stop(), authoring.stop()]);
    }
  };
}
