import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';

export async function createPascalishXsdParser({ logger = console } = {}) {
  const sourcePath = fileURLToPath(new URL('../../../src/librarian/xsd-parser.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(sourcePath, 'utf8'), {
    fileName: sourcePath, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-xsd-parser', httpPort: null, udpPort: null,
    maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: 10000000, maxExecutionMs: 10000, maxEvents: 256, logger
  });
  await host.start();
  const cache = new Map();
  const pending = new Map();
  let cacheBytes = 0;
  let stopped = false;
  async function parseUncached(content, key) {
    const result = await host.dispatch({ method: 'POST', path: '/parse', transport: 'internal', body: content });
    if (result.status !== 200) throw new Error(`Pascalish XSD parsing failed (${result.status})`);
    if (result.body !== null && (!result.body || result.body.name !== 'root' || !Array.isArray(result.body.children))) {
      throw new Error('Invalid Pascalish XSD tree result');
    }
    const serialized = JSON.stringify(result.body);
    const bytes = Buffer.byteLength(serialized);
    if (!stopped) {
      while (cache.size >= 256 || cacheBytes + bytes > 8000000) {
        const oldest = cache.keys().next().value;
        cacheBytes -= cache.get(oldest).bytes;
        cache.delete(oldest);
      }
      cache.set(key, { serialized, bytes });
      cacheBytes += bytes;
    }
    return serialized;
  }
  return {
    parse: async content => {
      if (stopped) throw Object.assign(new Error('XSD parser is stopped'), { status: 503 });
      if (typeof content !== 'string') throw Object.assign(new Error('Expected XML text'), { status: 400 });
      if (Buffer.byteLength(content) > 1000000) throw Object.assign(new Error('XSD input capacity exceeded'), { status: 413 });
      // UTF-8 would collapse distinct lone surrogates into the replacement character.
      const key = createHash('sha256').update(content, 'utf16le').digest('hex');
      if (cache.has(key)) {
        const cached = cache.get(key);
        cache.delete(key);
        cache.set(key, cached);
        return JSON.parse(cached.serialized);
      }
      if (!pending.has(key)) {
        const work = parseUncached(content, key).finally(() => pending.delete(key));
        pending.set(key, work);
      }
      return JSON.parse(await pending.get(key));
    },
    getStatus: () => ({
      cachedEntries: cache.size, cachedBytes: cacheBytes, pendingParses: pending.size, stopped
    }),
    stop: () => {
      stopped = true;
      cache.clear();
      cacheBytes = 0;
      return host.stop();
    }
  };
}
