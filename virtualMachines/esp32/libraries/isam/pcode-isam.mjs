import { readFile } from 'node:fs/promises';
import { executeProgram, parsePcode, parseProgramMapMappings } from '../../pmachines/javascript/src/runtime.mjs';
import { createJsonCollectionBindings } from '../../pmachines/javascript/src/json-collection-bindings.mjs';
import { createJsonObjectBindings } from '../../pmachines/javascript/src/json-object-bindings.mjs';

let library;
let operations = Promise.resolve();
const openFiles = new Map();
const lockedFiles = new Set();
const MAX_KEY_BYTES = 256;
const MAX_RECORD_BYTES = 200000;
const MAX_IMAGE_BYTES = 240000;
const COBOL_FILE_METADATA_PREFIX = '__COBOL_FILE_V1__:';

function pathIdentity(root, filePath) {
  const canonicalPath = filePath.replace(/\\/g, '/');
  return `${root}\0${process.platform === 'win32' ? canonicalPath.toLowerCase() : canonicalPath}`;
}

function validateOpen(root, filePath, keyName) {
  if (typeof root !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(root)) {
    throw new Error('ISAM root must name a granted filesystem alias');
  }
  if (typeof filePath !== 'string' || !filePath || filePath.length > 4096
    || filePath.includes(':') || /[\x00-\x1f]/.test(filePath)
    || /^[\\/]/.test(filePath) || /^[a-z]:/i.test(filePath)) {
    throw new Error('ISAM path must be a relative path');
  }
  const parts = filePath.split(/[\\/]/);
  if (parts.some(part => !part || part === '.' || part === '..' || /[ .]$/.test(part)
    || /[<>?"*|]/.test(part)
    || /^(con|prn|aux|nul|conin\$|conout\$|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3])(?:\.|$)/i.test(part))) {
    throw new Error('ISAM path contains an invalid or reserved component');
  }
  if (typeof keyName !== 'string' || !keyName.trim() || Buffer.byteLength(keyName) > MAX_KEY_BYTES) {
    throw new Error('ISAM key name must be non-empty and bounded');
  }
}

function validateText(value, label, maximum) {
  if (typeof value !== 'string') throw new Error(`ISAM ${label} must be a string`);
  if (Buffer.byteLength(value) > maximum || Buffer.from(value).toString('utf8') !== value) {
    throw new Error(`ISAM ${label} must be valid UTF-8 and within its size limit`);
  }
}

function decodeCobolFileMetadata(keyName) {
  if (!keyName.startsWith(COBOL_FILE_METADATA_PREFIX)) return null;
  let metadata;
  try {
    metadata = JSON.parse(keyName.slice(COBOL_FILE_METADATA_PREFIX.length));
  } catch (error) {
    throw new Error('Invalid COBOL ISAM file metadata', { cause: error });
  }
  if (!metadata || metadata.organization !== 'INDEXED'
    || !['SEQUENTIAL', 'RANDOM', 'DYNAMIC'].includes(metadata.access)
    || typeof metadata.keyName !== 'string' || !Array.isArray(metadata.alternateKeys)) {
    throw new Error('Invalid COBOL ISAM file metadata');
  }
  validateOpen('data', 'metadata', metadata.keyName);
  for (const alternate of metadata.alternateKeys) {
    if (!alternate || typeof alternate.name !== 'string' || !alternate.name
      || !Number.isSafeInteger(alternate.offset) || alternate.offset < 0
      || !Number.isSafeInteger(alternate.length) || alternate.length < 1
      || typeof alternate.duplicates !== 'boolean') {
      throw new Error('Invalid COBOL ISAM alternate-key metadata');
    }
  }
  return metadata;
}

export function loadIsamPcode() {
  library ??= Promise.all([
    readFile(new URL('./isam.pas', import.meta.url), 'utf8'),
    import('../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs')
  ]).then(([source, { compilePascalishProgramWithAntlr }]) => {
    const compiled = compilePascalishProgramWithAntlr(source, {
      fileName: 'isam.pas', hostServices: true
    });
    return {
      ...compiled,
      instructions: parsePcode(compiled.pcodeText),
      mappingsById: parseProgramMapMappings(compiled.programMap)
    };
  });
  return library;
}

// State is opaque to the adapter; all file decisions and mutations execute in P-code.
export function createPcodeIsamBindings(filesystem) {
  for (const name of ['host.fs_exists', 'host.fs_read_text', 'host.fs_write_text']) {
    if (typeof filesystem?.[name] !== 'function') throw new Error(`ISAM storage adapter requires ${name}`);
  }
  let state = { next: 1, handles: [] };
  const statuses = new Map();
  const owner = Symbol('pcode-isam-bindings');
  const ownedFiles = new Set();
  let disposed = false;

  function dispatch(operation, request, context) {
    const work = operations.then(async () => {
      if (disposed) throw new Error('ISAM bindings have been disposed');
      context?.signal?.throwIfAborted();
      let identity = null;
      let fileMetadata = null;
      if (operation === 'open') {
        validateOpen(request.root, request.path, request.keyName);
        fileMetadata = decodeCobolFileMetadata(request.keyName);
        if (fileMetadata) validateOpen(request.root, request.path, fileMetadata.keyName);
        identity = pathIdentity(request.root, request.path);
      } else {
        const handle = state.handles.find(item => item.id === request.handle);
        if (handle) identity = pathIdentity(handle.root, handle.path);
        if (operation === 'read' || operation === 'read_alt' || operation === 'start') {
          validateText(request.key, 'key', MAX_KEY_BYTES);
        }
        if (operation === 'write' || operation === 'rewrite') {
          validateText(request.key, 'key', MAX_KEY_BYTES);
          validateText(request.record, 'record', MAX_RECORD_BYTES);
        }
        if (operation === 'delete') validateText(request.key, 'key', MAX_KEY_BYTES);
      }
      const compiled = await loadIsamPcode();
      let writeError;
      const bindings = {
        ...createJsonCollectionBindings(),
        ...createJsonObjectBindings(),
        ...filesystem,
        'host.fs_write_text': async (...args) => {
          try {
            if (typeof args[2] !== 'string' || Buffer.byteLength(args[2]) > MAX_IMAGE_BYTES) {
              throw new Error(`ISAM image exceeds ${MAX_IMAGE_BYTES} bytes`);
            }
            return await filesystem['host.fs_write_text'](...args);
          }
          catch (error) {
            // Let P-code record status 30 without committing; rethrow after its response.
            writeError = error;
            return -1;
          }
        },
        'host.event_method': () => 'POST',
        'host.event_path': () => '/isam',
        'host.event_body': () => {
          const body = {
            key: '', ...request, operation, state,
            duplicate: operation === 'open' && openFiles.has(identity) ? 1 : 0,
            locked: operation === 'open' && lockedFiles.has(identity) ? 1 : 0
          };
          if (operation === 'open') {
            if (fileMetadata) {
              body.keyName = fileMetadata.keyName;
              body.organization = fileMetadata.organization;
              body.access = fileMetadata.access;
              body.alternateKeys = fileMetadata.alternateKeys.map(alternate => ({
                ...alternate, duplicates: Number(alternate.duplicates)
              }));
            } else {
              body.organization = request.keyName === '__SEQUENTIAL__' ? 'SEQUENTIAL'
                : request.keyName.startsWith('__RELATIVE__:') ? 'RELATIVE' : 'INDEXED';
              body.access = 'DYNAMIC';
              body.alternateKeys = [];
            }
            body.optional = request.mode.endsWith('-OPTIONAL') ? 1 : 0;
            if (body.optional) body.mode = request.mode.slice(0, -'-OPTIONAL'.length);
          }
          return JSON.stringify(body);
        },
        'host.string_compare': (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)),
        'host.string_slice': (value, start, end) => {
          validateText(value, 'slice source', MAX_RECORD_BYTES);
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
            || start < 0 || end < start || end > value.length) {
            throw new Error('ISAM string slice bounds are invalid');
          }
          return value.slice(start, end);
        },
        'host.raise_error': message => { throw new Error(message); }
      };
      const result = await executeProgram({
        instructions: compiled.instructions,
        mappingsById: compiled.mappingsById,
        inputQueue: '', sourceMessage: '',
        runtimeContext: {
          desktopBudget: true, maxSteps: 2000000, maxStack: 256, maxCallDepth: 32,
          signal: context?.signal,
          callHost: (name, args) => {
            if (typeof bindings[name] !== 'function') throw new Error(`ISAM host binding unavailable: ${name}`);
            return bindings[name](...args, context);
          }
        }
      });
      if (result.error || result.stepLimitHit) throw new Error(result.error || 'ISAM instruction limit exceeded');
      const response = result.response;
      if (!response || !response.state || typeof response.status !== 'string') {
        throw new Error('Invalid ISAM P-code response');
      }
      state = response.state;
      const handle = operation === 'open' ? response.result : request.handle;
      if (operation === 'open' && response.status === '00') {
        openFiles.set(identity, owner);
        ownedFiles.add(identity);
      }
      if (operation === 'close' || operation === 'close_lock') {
        statuses.delete(handle);
        if (response.status === '00' && identity && openFiles.get(identity) === owner) {
          openFiles.delete(identity);
          ownedFiles.delete(identity);
        }
        if (operation === 'close_lock' && response.status === '00' && identity) lockedFiles.add(identity);
      } else if (operation === 'open') {
        if (!writeError) statuses.set(handle, response.status);
      } else if (operation !== 'count' && operation !== 'current_key') {
        statuses.set(handle, response.status);
      }
      if (writeError) throw writeError;
      return response;
    });
    operations = work.then(() => undefined, () => undefined);
    return work;
  }

  const bindings = {
    'host.isam_open': async (root, path, keyName, mode, context) =>
      (await dispatch('open', { root, path, keyName, mode }, context)).result,
    'host.isam_read': async (handle, key, context) => (await dispatch('read', { handle, key }, context)).record,
    'host.isam_read_alt': async (handle, alternateKeyName, key, context) =>
      (await dispatch('read_alt', { handle, alternateKeyName, key }, context)).record,
    'host.isam_read_next': async (handle, context) => (await dispatch('read_next', { handle }, context)).record,
    'host.isam_current_key': async (handle, context) => (await dispatch('current_key', { handle }, context)).key,
    'host.isam_count': async (handle, context) => Number((await dispatch('count', { handle }, context)).count),
    'host.isam_start': async (handle, key, comparison, context) =>
      Number((await dispatch('start', { handle, key, comparison }, context)).status),
    'host.isam_write': async (handle, key, record, context) =>
      Number((await dispatch('write', { handle, key, record }, context)).status),
    'host.isam_rewrite': async (handle, key, record, context) =>
      Number((await dispatch('rewrite', { handle, key, record }, context)).status),
    'host.isam_delete': async (handle, key, context) =>
      Number((await dispatch('delete', { handle, key }, context)).status),
    'host.isam_close': async (handle, context) => Number((await dispatch('close', { handle }, context)).status),
    'host.isam_close_lock': async (handle, context) => Number((await dispatch('close_lock', { handle }, context)).status),
    'host.isam_status': handle => {
      if (!statuses.has(handle)) throw new Error('Invalid ISAM file handle');
      return statuses.get(handle);
    }
  };
  Object.defineProperty(bindings, 'dispose', {
    value: () => {
      if (disposed) return;
      disposed = true;
      for (const identity of ownedFiles) {
        if (openFiles.get(identity) === owner) openFiles.delete(identity);
      }
      ownedFiles.clear();
      statuses.clear();
    },
    enumerable: false
  });
  return bindings;
}
