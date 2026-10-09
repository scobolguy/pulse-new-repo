import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../pmachines/javascript/src/service-host.mjs';
import { createFilesystemBindings } from '../../../pmachines/javascript/src/filesystem-bindings.mjs';

export async function createPascalishXsdParser({ logger = console, schemaRoot } = {}) {
  const storageRoots = { schemas: { path: schemaRoot, readOnly: true } };
  const reader = await createFilesystemBindings(storageRoots, { maxFileBytes: 1000000 });
  const sourcePath = fileURLToPath(new URL('../../../src/librarian/xsd-parser.pas', import.meta.url));
  const compiled = compilePascalishProgramWithAntlr(await fs.readFile(sourcePath, 'utf8'), {
    fileName: sourcePath, hostServices: true
  });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'pulse-data-librarian-xsd-parser', httpPort: null, udpPort: null,
    maxBodyBytes: 1000000, maxResponseBytes: 1000000,
    desktopBudget: true, maxSteps: null, maxExecutionMs: null, maxEvents: 256,
    storageRoots, maxFileBytes: 1000000, logger
  });
  await host.start();
  const cache = new Map();
  const pending = new Map();
  let cacheBytes = 0;
  let stopped = false;
  const readAbort = new AbortController();
  async function parseUncached(content, key, file = false) {
    const result = await host.dispatch({ method: 'POST', path: file ? '/parse-file' : '/parse', transport: 'internal', body: content });
    if (result.status !== 200) throw new Error(`Pascalish XSD parsing failed (${result.status})`);
    const tree = file ? result.body?.tree : result.body;
    const dependencies = file ? result.body?.dependencies : [];
    if (tree !== null && (!tree || tree.name !== 'root' || !Array.isArray(tree.children))) {
      throw new Error('Invalid Pascalish XSD tree result');
    }
    if (!Array.isArray(dependencies) || dependencies.some(item => typeof item.path !== 'string'
      || !/^[a-f0-9]{64}$/.test(item.hash))) throw new Error('Invalid Pascalish XSD dependency result');
    const serialized = JSON.stringify(tree);
    const bytes = Buffer.byteLength(serialized) + (file ? Buffer.byteLength(JSON.stringify(dependencies)) : 0);
    if (!stopped) {
      while (cache.size >= 256 || cacheBytes + bytes > 32000000) {
        const oldest = cache.keys().next().value;
        cacheBytes -= cache.get(oldest).bytes;
        cache.delete(oldest);
      }
      cache.set(key, { serialized, bytes, dependencies });
      cacheBytes += bytes;
    }
    return serialized;
  }
  async function parseFileUncached(relativePath, key) {
    const cached = cache.get(key);
    if (cached) {
      let unchanged = true;
      for (const dependency of cached.dependencies) {
        const content = await reader.handlers['host.fs_read_text_auto']('schemas', dependency.path, { signal: readAbort.signal });
        if (createHash('sha256').update(content, 'utf16le').digest('hex') !== dependency.hash) {
          unchanged = false;
          break;
        }
      }
      if (unchanged) {
        readAbort.signal.throwIfAborted();
        if (cache.get(key) === cached) {
          cache.delete(key);
          cache.set(key, cached);
        }
        return cached.serialized;
      }
      if (cache.get(key) === cached) {
        cacheBytes -= cached.bytes;
        cache.delete(key);
      }
    }
    return parseUncached(relativePath, key, true);
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
        if (pending.size >= 256) throw Object.assign(new Error('XSD pending parse capacity exceeded'), { status: 503 });
        const work = parseUncached(content, key).finally(() => pending.delete(key));
        pending.set(key, work);
      }
      return JSON.parse(await pending.get(key));
    },
    parseFile: async relativePath => {
      if (stopped) throw Object.assign(new Error('XSD parser is stopped'), { status: 503 });
      if (typeof relativePath !== 'string') throw new Error('Expected schema-relative path');
      relativePath = await reader.handlers['host.fs_resolve_relative']('schemas', 'root.xsd', relativePath, { signal: readAbort.signal });
      if (stopped) throw Object.assign(new Error('XSD parser is stopped'), { status: 503 });
      const key = `file:${createHash('sha256').update(relativePath, 'utf16le').digest('hex')}`;
      if (!pending.has(key)) {
        if (pending.size >= 256) throw Object.assign(new Error('XSD pending parse capacity exceeded'), { status: 503 });
        const work = parseFileUncached(relativePath, key).finally(() => pending.delete(key));
        pending.set(key, work);
      }
      return JSON.parse(await pending.get(key));
    },
    getStatus: () => ({
      cachedEntries: cache.size, cachedBytes: cacheBytes, pendingParses: pending.size, stopped
    }),
    stop: () => {
      stopped = true;
      readAbort.abort(new Error('XSD parser is stopped'));
      cache.clear();
      cacheBytes = 0;
      return host.stop();
    }
  };
}
