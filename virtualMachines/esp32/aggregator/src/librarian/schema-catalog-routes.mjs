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
    desktopBudget: true, maxSteps: null, maxExecutionMs: null, logger
  });
  await host.start();
  return {
    async dispatch({ method, path, physicalSchemas = [], subschemas = [] }) {
      if (method.toUpperCase() !== 'GET' || !['/api/librarian/schemas', '/api/librarian/subschemas'].includes(path)) {
        return dispatchBatch({ method, path, physicalSchemas: [], subschemas: [] });
      }
      const result = { matched: true, status: 200, body: {
        ...(path === '/api/librarian/schemas' ? { schemas: [] } : {}), subschemas: []
      } };
      let batch = { physicalSchemas: [], subschemas: [] };
      let bytes = 0;
      async function flush() {
        const response = await dispatchBatch({ method, path, ...batch });
        if (!response.matched || response.status !== 200 || !Array.isArray(response.body?.subschemas)
          || (path === '/api/librarian/schemas' && !Array.isArray(response.body?.schemas))) {
          throw new Error('Invalid Pascalish schema-catalog batch result');
        }
        if (result.body.schemas) result.body.schemas.push(...response.body.schemas);
        result.body.subschemas.push(...response.body.subschemas);
        batch = { physicalSchemas: [], subschemas: [] };
        bytes = 0;
      }
      // Virtual schemas occur twice in the response; budget both copies below the host limit.
      for (const key of ['physicalSchemas', 'subschemas']) {
        const entries = key === 'physicalSchemas' ? physicalSchemas : subschemas;
        if (key === 'physicalSchemas' && path === '/api/librarian/subschemas') continue;
        for (const entry of entries) {
          const size = Buffer.byteLength(JSON.stringify(entry)) * (key === 'subschemas' ? 2 : 1) + 2;
          if (size > 900000) throw Object.assign(new Error('Schema catalog entry capacity exceeded'), { status: 413 });
          if (bytes + size > 900000) await flush();
          batch[key].push(entry);
          bytes += size;
        }
      }
      if (bytes || (path === '/api/librarian/subschemas' ? !subschemas.length : !physicalSchemas.length && !subschemas.length)) {
        await flush();
      }
      return result;
    },
    stop: () => host.stop()
  };
  async function dispatchBatch({ method, path, physicalSchemas, subschemas }) {
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
  }
}
