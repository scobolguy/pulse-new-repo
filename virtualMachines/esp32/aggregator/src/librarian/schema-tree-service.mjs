import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createPascalishSchemaTreeService({ logger = console } = {}) {
  const sourcePath = fileURLToPath(new URL('../../../src/librarian/schema-tree.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(sourcePath, 'utf8'), {
    fileName: sourcePath, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-schema-tree', httpPort: null, udpPort: null,
    maxBodyBytes: 1000000, maxResponseBytes: 1000000, maxEvents: 256,
    desktopBudget: true, maxSteps: null, maxExecutionMs: null, logger
  });
  await host.start();
  const cache = new Map();
  const pending = new Map();
  let cachedBytes = 0;
  let stopped = false;
  async function execute(body, key) {
    const response = await host.dispatch({ method: 'POST', path: '/walk', transport: 'internal', body });
    if (response.status !== 200 || !Array.isArray(response.body?.availableFields)
      || response.body.availableFields.some(field => typeof field !== 'string')
      || (JSON.parse(body).project === 1 && !Object.hasOwn(response.body, 'structure'))) {
      throw new Error('Invalid Pascalish schema-tree result');
    }
    const serialized = JSON.stringify(response.body);
    const bytes = Buffer.byteLength(serialized);
    if (!stopped) {
      while (cache.size >= 256 || cachedBytes + bytes > 32000000) {
        const oldest = cache.keys().next().value;
        cachedBytes -= cache.get(oldest).bytes;
        cache.delete(oldest);
      }
      cache.set(key, { serialized, bytes });
      cachedBytes += bytes;
    }
    return serialized;
  }
  async function walk(structure, accessibleFields) {
    if (stopped) throw Object.assign(new Error('Schema-tree service is stopped'), { status: 503 });
    const body = JSON.stringify({
      structure: structure ?? null, project: accessibleFields === undefined ? 0 : 1,
      ...(accessibleFields === undefined ? {} : { accessibleFields })
    });
    if (Buffer.byteLength(body) > 1000000) throw Object.assign(new Error('Schema-tree request capacity exceeded'), { status: 413 });
    // Preserve lone UTF-16 surrogates instead of collapsing them to UTF-8 replacement characters.
    const key = createHash('sha256').update(body, 'utf16le').digest('hex');
    if (cache.has(key)) {
      const entry = cache.get(key);
      cache.delete(key);
      cache.set(key, entry);
      return JSON.parse(entry.serialized);
    }
    if (!pending.has(key)) {
      if (pending.size >= 256) throw Object.assign(new Error('Schema-tree pending capacity exceeded'), { status: 503 });
      pending.set(key, execute(body, key).finally(() => pending.delete(key)));
    }
    return JSON.parse(await pending.get(key));
  }
  return {
    collect: async structure => (await walk(structure)).availableFields,
    project: (structure, accessibleFields = []) => walk(structure, accessibleFields || []),
    getStatus: () => ({ cachedEntries: cache.size, cachedBytes, pending: pending.size, stopped }),
    stop: () => {
      stopped = true;
      cache.clear();
      cachedBytes = 0;
      return host.stop();
    }
  };
}
