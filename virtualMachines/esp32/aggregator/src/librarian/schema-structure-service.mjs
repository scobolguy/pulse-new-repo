import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createPascalishSchemaStructureService({ logger = console } = {}) {
  const sourcePath = fileURLToPath(new URL('../../../src/librarian/schema-structure.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(sourcePath, 'utf8'), {
    fileName: sourcePath, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-schema-structure',
    httpPort: null, udpPort: null, maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: 10000000, maxExecutionMs: 10000, logger
  });
  await host.start();
  async function parse(path, content) {
    const result = await host.dispatch({
      transport: 'internal', method: 'POST', path, body: JSON.stringify({ content })
    });
    if (result.status !== 200 || !result.body || typeof result.body !== 'object') {
      throw Object.assign(new Error(result.body?.error || 'Invalid Pascalish schema structure result'), {
        status: result.status
      });
    }
    return result.body;
  }
  return {
    parseFilename: async filename => {
      const result = await host.dispatch({
        transport: 'internal', method: 'POST', path: '/schema-filename',
        body: JSON.stringify({ filename })
      });
      if (result.status !== 200 || !result.body || typeof result.body !== 'object') {
        throw Object.assign(new Error(result.body?.error || 'Invalid Pascalish schema filename result'), {
          status: result.status
        });
      }
      if (!result.body.matched) return null;
      const metadata = { ...result.body };
      delete metadata.matched;
      return metadata;
    },
    parseJsonValue: content => parse('/json-value', content),
    parseJsonSchema: content => parse('/json-schema', content),
    parseCopybook: content => parse('/copybook', content),
    enrichSwiftFields: async content => {
      const result = await parse('/enrich-swift', content);
      if (typeof result.content !== 'string') {
        throw new Error('Invalid Pascalish SWIFT metadata response');
      }
      return result.content;
    },
    stop: () => host.stop(),
    getStatus: () => host.getStatus()
  };
}
