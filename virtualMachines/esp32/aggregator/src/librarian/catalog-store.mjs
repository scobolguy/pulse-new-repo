import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createPascalishCatalogStore({
  root, legacyRoot, maxFileBytes = 262144, logger = console
}) {
  const sourcePath = fileURLToPath(new URL('../../../src/librarian/catalog-store.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(sourcePath, 'utf8'), {
    fileName: sourcePath, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-catalog-store',
    httpPort: null, udpPort: null, maxFileBytes, maxEvents: 64,
    maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    storageRoots: {
      catalog: { path: root, readOnly: false },
      legacy: { path: legacyRoot }
    },
    logger
  });
  await host.start();
  async function dispatch(path, body) {
    const result = await host.dispatch({
      transport: 'internal', method: 'POST', path, body: JSON.stringify(body)
    });
    if (result.status !== 200) {
      throw Object.assign(new Error(result.body?.error || `Pascalish catalog operation failed (${result.status})`), {
        status: result.status, retry: result.body?.retry === true
      });
    }
    return result.body;
  }
  async function read(path, body) {
    try {
      const result = await dispatch(path, body);
      if (!result || !Object.hasOwn(result, 'value')) throw new Error('Invalid Pascalish catalog read result');
      return result.value;
    } catch (error) {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    }
  }
  async function writeText(catalog, content) {
    if (typeof content !== 'string') throw new Error('Catalog content must be JSON text');
    const result = await dispatch('/write', { catalog, content });
    if (result?.stored !== true) throw new Error('Invalid Pascalish catalog write result');
  }
  return {
    read: catalog => read('/read', { catalog }),
    readLegacyDataTypes: () => read('/read-legacy-data-types', {}),
    write: async (catalog, value) => {
      const content = JSON.stringify(value, null, 2);
      if (typeof content !== 'string') throw new Error('Catalog value must be JSON serializable');
      await writeText(catalog, content);
    },
    writeText,
    mutateSubschemas: async body => {
      const result = await dispatch('/subschemas/mutate', body);
      if (result?.stored !== true) throw new Error('Invalid Pascalish subschema mutation result');
      return result;
    },
    stop: () => host.stop(),
    getStatus: () => host.getStatus()
  };
}
