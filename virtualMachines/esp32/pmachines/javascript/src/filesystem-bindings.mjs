import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function failure(message, status = 400, code = 'EINVAL') {
  return Object.assign(new Error(message), { status, code });
}

// Grants must name operator-owned directories: portable Node APIs cannot prevent
// an external process racing a directory replacement between checks and I/O.
export async function createFilesystemBindings(storageRoots = {}, { maxFileBytes = 262144, maxPageBytes = 262144 } = {}) {
  if (!storageRoots || typeof storageRoots !== 'object' || Array.isArray(storageRoots)) {
    throw failure('Invalid storage root grants');
  }
  for (const [label, value] of Object.entries({ maxFileBytes, maxPageBytes })) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 1000000) throw failure(`Invalid ${label}`);
  }
  const roots = new Map();
  for (const [alias, grant] of Object.entries(storageRoots)) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(alias) || !grant || typeof grant !== 'object'
      || typeof grant.path !== 'string' || !path.isAbsolute(grant.path)
      || (grant.readOnly !== undefined && typeof grant.readOnly !== 'boolean')) {
      throw failure(`Invalid storage root grant: ${alias}`);
    }
    const info = await fs.lstat(grant.path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw failure(`Storage root must be a real directory: ${alias}`);
    roots.set(alias, { path: await fs.realpath(grant.path), readOnly: grant.readOnly !== false });
  }

  function grantFor(alias, write) {
    const grant = roots.get(alias);
    if (!grant || (write && grant.readOnly)) throw failure(`Storage access denied: ${alias}`, 403, 'EACCES');
    return grant;
  }
  function partsOf(relative, allowRoot = false) {
    if (typeof relative !== 'string' || relative.length > 4096 || relative.includes(':')
      || [...relative].some(character => character.charCodeAt(0) < 32)
      || path.isAbsolute(relative) || /^[\\/]/.test(relative)) throw failure('Invalid storage path');
    if (allowRoot && (relative === '' || relative === '.')) return [];
    const parts = relative.split(/[\\/]/);
    if (!parts.length || parts.some(part => !part || part === '.' || part === '..'
      || /[ .]$/.test(part) || /[<>?"*|]/.test(part)
      || /^(con|prn|aux|nul|conin\$|conout\$|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3]) *(?:\.|$)/i.test(part))) {
      throw failure('Invalid storage path');
    }
    return parts;
  }
  function checkInfo(info) {
    if (info.isSymbolicLink()) throw failure('Storage links are not allowed', 403, 'EACCES');
    if (!info.isDirectory() && !info.isFile()) throw failure('Unsupported storage entry', 403, 'EACCES');
    if (info.isFile() && info.nlink > 1) throw failure('Storage hard links are not allowed', 403, 'EACCES');
  }
  async function resolve(alias, relative, { write = false, allowRoot = false, allowMissing = false } = {}) {
    const grant = grantFor(alias, write);
    const parts = partsOf(relative, allowRoot);
    let target = grant.path;
    let info;
    try { info = await fs.lstat(target); }
    catch (error) {
      if (error.code === 'ENOENT') throw failure('Storage root unavailable', 503, 'ESTORAGE');
      throw error;
    }
    checkInfo(info);
    for (const [index, part] of parts.entries()) {
      if (!info.isDirectory()) throw failure('Storage parent is not a directory');
      target = path.join(target, part);
      try {
        info = await fs.lstat(target);
      } catch (error) {
        if (error.code === 'ENOENT' && allowMissing && index === parts.length - 1) return { target, info: null };
        throw error;
      }
      checkInfo(info);
      const real = await fs.realpath(target);
      const fromRoot = path.relative(grant.path, real);
      if (fromRoot === '..' || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) {
        throw failure('Storage path escapes root', 403, 'EACCES');
      }
    }
    return { target, info };
  }
  function checkSignal(context) { context?.signal?.throwIfAborted(); }
  function metadata(info, name) {
    return { name, kind: info.isDirectory() ? 'directory' : 'file', size: info.size, modifiedAt: info.mtime.toISOString() };
  }
  const handlers = {
    'host.fs_exists': async (alias, relative, context) => {
      checkSignal(context);
      try {
        await resolve(alias, relative);
        return 1;
      } catch (error) {
        if (error.code === 'ENOENT') return 0;
        throw error;
      }
    },
    'host.fs_stat': async (alias, relative, context) => {
      checkSignal(context);
      const { info } = await resolve(alias, relative, { allowRoot: true });
      return JSON.stringify(metadata(info, relative));
    },
    'host.fs_list': async (alias, relative, cursor, limit, context) => {
      checkSignal(context);
      if (typeof cursor !== 'string' || cursor.length > 4096 || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
        throw failure('Invalid directory page');
      }
      const { target, info } = await resolve(alias, relative, { allowRoot: true });
      if (!info.isDirectory()) throw failure('Storage path is not a directory');
      // Scan without materializing the directory; keep only the next bounded page.
      const names = [];
      const directory = await fs.opendir(target);
      for await (const entry of directory) {
        checkSignal(context);
        if (entry.name <= cursor) continue;
        names.push(entry.name);
        names.sort();
        if (names.length > limit + 1) names.pop();
      }
      const entries = [];
      for (const name of names.slice(0, limit)) {
        checkSignal(context);
        const child = await resolve(alias, relative === '' || relative === '.' ? name : `${relative}/${name}`);
        entries.push(metadata(child.info, name));
      }
      const result = JSON.stringify({ entries, nextCursor: names.length > limit ? names[limit - 1] : '' });
      if (Buffer.byteLength(result) > maxPageBytes) throw failure('Directory page capacity exceeded', 413, 'EFBIG');
      return result;
    },
    'host.fs_read_text': async (alias, relative, context) => {
      checkSignal(context);
      const { target, info } = await resolve(alias, relative);
      if (!info.isFile()) throw failure('Storage path is not a file');
      checkSignal(context);
      const file = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      try {
        const openedInfo = await file.stat();
        checkInfo(openedInfo);
        if (!openedInfo.isFile() || openedInfo.size > maxFileBytes) throw failure('File capacity exceeded', 413, 'EFBIG');
        const bytes = Buffer.alloc(maxFileBytes + 1);
        let size = 0;
        while (size < bytes.length) {
          checkSignal(context);
          const { bytesRead } = await file.read(bytes, size, bytes.length - size, null);
          if (!bytesRead) break;
          size += bytesRead;
        }
        if (size > maxFileBytes) throw failure('File capacity exceeded', 413, 'EFBIG');
        checkSignal(context);
        return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, size));
      } finally { await file.close(); }
    },
    'host.fs_write_text': async (alias, relative, value, context) => {
      checkSignal(context);
      if (typeof value !== 'string' || Buffer.byteLength(value) > maxFileBytes) {
        throw failure('File capacity exceeded', 413, 'EFBIG');
      }
      const { target, info } = await resolve(alias, relative, { write: true, allowMissing: true });
      if (info && !info.isFile()) throw failure('Storage path is not a file');
      checkSignal(context);
      const temporary = path.join(path.dirname(target), `.pulse-${randomUUID()}.tmp`);
      let created = false;
      try {
        const file = await fs.open(temporary, 'wx', 0o600);
        created = true;
        try {
          await file.writeFile(value, { encoding: 'utf8', signal: context?.signal });
          await file.sync();
        } finally { await file.close(); }
        checkSignal(context);
        await resolve(alias, relative, { write: true, allowMissing: true });
        checkSignal(context);
        await fs.rename(temporary, target);
      } finally {
        if (created) await fs.rm(temporary, { force: true });
      }
      return 0;
    },
    'host.fs_mkdir': async (alias, relative, context) => {
      checkSignal(context);
      const { target } = await resolve(alias, relative, { write: true, allowMissing: true });
      checkSignal(context);
      await fs.mkdir(target);
      return 0;
    },
    'host.fs_rename': async (alias, relative, destination, context) => {
      checkSignal(context);
      const source = await resolve(alias, relative, { write: true });
      const next = await resolve(alias, destination, { write: true, allowMissing: true });
      if (next.info) throw failure('Storage rename destination exists', 409, 'EEXIST');
      checkSignal(context);
      await fs.rename(source.target, next.target);
      return 0;
    },
    'host.fs_delete': async (alias, relative, context) => {
      checkSignal(context);
      const { target, info } = await resolve(alias, relative, { write: true });
      if (!info.isFile()) throw failure('Storage delete requires a file');
      checkSignal(context);
      await fs.unlink(target);
      return 0;
    }
  };
  const checkedHandlers = Object.fromEntries(Object.entries(handlers).map(([name, handler]) => [
    name,
    async (...args) => {
      try { return await handler(...args); }
      catch (error) {
        if (error.status || error.name === 'AbortError') throw error;
        const status = { ENOENT: 404, EACCES: 403, EPERM: 403, EEXIST: 409, ENOTEMPTY: 409 }[error.code] || 500;
        throw Object.assign(new Error(`Storage operation ${name} failed (${error.code || error.name})`, { cause: error }), {
          status, code: error.code || 'EIO'
        });
      }
    }
  ]));
  return {
    handlers: checkedHandlers,
    capabilities: roots.size ? ['filesystem.read', ...(Array.from(roots.values()).some(root => !root.readOnly) ? ['filesystem.write'] : [])] : [],
    roots: [...roots].map(([name, grant]) => ({ name, readOnly: grant.readOnly })),
    limits: { maxFileBytes, maxPageBytes }
  };
}
