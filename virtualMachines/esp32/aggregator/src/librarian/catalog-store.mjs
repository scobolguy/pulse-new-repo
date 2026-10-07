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
    desktopBudget: true, maxSteps: 10000000, maxExecutionMs: 10000,
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
        status: result.status, retry: result.body?.retry === true, catalogDecision: true
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
  async function mutateCatalog(catalog, prepare, normalize = plan => ({ entries: plan.entries, record: plan.record })) {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const stored = await read('/read', { catalog });
      const expected = stored === undefined ? (catalog === 'schema-lifecycle' ? {} : []) : stored;
      const mutation = await prepare(expected);
      const body = { ...mutation, catalog, expected, commit: 0 };
      try {
        const plan = await dispatch('/catalogs/mutate', body);
        if (!plan || !Object.hasOwn(plan, 'entries') || typeof plan.writeNeeded !== 'boolean') {
          throw new Error('Invalid Pascalish catalog mutation plan');
        }
        const normalized = await normalize(plan);
        const content = JSON.stringify(normalized.entries, null, 2);
        if (typeof content !== 'string') throw new Error('Catalog value must be JSON serializable');
        const result = await dispatch('/catalogs/mutate', { ...body, commit: 1, plan, content });
        if (result?.stored !== true) throw new Error('Invalid Pascalish catalog mutation result');
        return { ...result, record: normalized.record };
      } catch (error) {
        if (!error.retry || attempt === 31) throw error;
      }
    }
    throw new Error('Catalog mutation retry limit exceeded');
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
    mutateCatalog,
    mutateSubschemas: async body => {
      const result = await dispatch('/subschemas/mutate', body);
      if (result?.stored !== true) throw new Error('Invalid Pascalish subschema mutation result');
      return result;
    },
    stop: () => host.stop(),
    getStatus: () => host.getStatus()
  };
}
