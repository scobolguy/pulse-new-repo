import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

const SEARCH_BATCH_SIZE = 128;

export async function createPascalishLibrarianSearchRoutes({ logger = console } = {}) {
  const fileName = fileURLToPath(new URL('../../../src/librarian/routes/search.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(fileName, 'utf8'), {
    fileName, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-http-search',
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: 10000000, maxExecutionMs: 10000, logger
  });
  await host.start();
  return {
    async dispatch({ method, path, q = '', ext = '', files = [] }) {
      if (typeof q !== 'string' || typeof ext !== 'string') {
        throw new TypeError('Search query and extension must be strings');
      }
      const matches = new Set();
      const batches = files.length
        ? Array.from({ length: Math.ceil(files.length / SEARCH_BATCH_SIZE) }, (_, index) =>
          files.slice(index * SEARCH_BATCH_SIZE, (index + 1) * SEARCH_BATCH_SIZE))
        : [[]];
      for (const batch of batches) {
        const result = await host.dispatch({
          transport: 'internal', method: 'POST', path: '/dispatch',
          body: JSON.stringify({
            method, path, q, ext,
            files: batch.map(file => ({ name: file.name, ext: file.ext }))
          })
        });
        if (result.status !== 200 || !result.body || typeof result.body !== 'object'
          || typeof result.body.matched !== 'boolean' || !Number.isInteger(result.body.status)
          || !Object.hasOwn(result.body, 'body')) {
          throw Object.assign(new Error(result.body?.error || 'Invalid Pascalish Librarian search route result'), {
            status: result.status
          });
        }
        if (!result.body.matched) {
          throw new Error('Pascalish Librarian search route did not match');
        }
        if (result.body.status !== 200 || !Array.isArray(result.body.body?.files)
          || result.body.body.files.some(file => typeof file.name !== 'string' || typeof file.ext !== 'string')) {
          throw Object.assign(new Error('Invalid Pascalish Librarian search result'), {
            status: result.body.status || result.status
          });
        }
        for (const file of result.body.body.files) {
          matches.add(JSON.stringify([file.name, file.ext]));
        }
      }
      return {
        matched: true,
        status: 200,
        body: { files: files.filter(file => matches.has(JSON.stringify([file.name, file.ext]))) }
      };
    },
    stop: () => host.stop()
  };
}
