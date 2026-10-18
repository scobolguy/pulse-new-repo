// ISAM library: a keyed, ordered record store with COBOL file-status semantics.
// It owns no I/O; callers supply a storage adapter, so any runtime can host it.

export const ISAM_LIMITS = Object.freeze({ maxHandles: 1024, maxRecords: 100000 });

export const ISAM_STATUS = Object.freeze({
  SUCCESS: '00',
  END_OF_FILE: '10',
  DUPLICATE_KEY: '22',
  RECORD_NOT_FOUND: '23',
  PERMANENT_ERROR: '30',
  FILE_NOT_FOUND: '35',
  MODE_CONFLICT: '37',
  ALREADY_OPEN: '41'
});

export const ISAM_OPEN_MODES = Object.freeze(['INPUT', 'OUTPUT', 'I-O', 'EXTEND']);
export const ISAM_START_COMPARISONS = Object.freeze(['=', '>', '>=', '<', '<=']);

export function compareIsamKeys(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

export function parseIsamStore(source, keyName) {
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`ISAM index file contains invalid JSON: ${error.message}`);
  }
  if (parsed?.version !== 1 || parsed.keyName !== keyName || !Array.isArray(parsed.records)) {
    throw new Error('ISAM index file has an unsupported or mismatched format');
  }
  const records = new Map();
  for (const row of parsed.records) {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || typeof row[1] !== 'string'
      || records.has(row[0])) {
      throw new Error('ISAM index file contains an invalid or duplicate record');
    }
    records.set(row[0], row[1]);
  }
  return records;
}

export function serializeIsamStore(keyName, records, limits = ISAM_LIMITS) {
  const ordered = [...records.entries()].sort(([left], [right]) => compareIsamKeys(left, right));
  if (ordered.length > limits.maxRecords) throw new Error('ISAM record capacity exceeded');
  return JSON.stringify({ version: 1, keyName, records: ordered });
}

/**
 * Creates an ISAM library instance.
 * @param {{ exists(root, path, context): unknown, read(root, path, context): unknown,
 *           write(root, path, contents, context): unknown }} storage
 */
export function createIsamLibrary(storage, limits = ISAM_LIMITS) {
  for (const method of ['exists', 'read', 'write']) {
    if (typeof storage?.[method] !== 'function') throw new Error(`ISAM storage adapter requires ${method}()`);
  }
  const files = new Map();
  const handles = new Map();
  let nextHandle = 1;

  function handleOf(value) {
    const handle = Number(value);
    const state = handles.get(handle);
    if (!Number.isSafeInteger(handle) || !state) throw new Error('Invalid ISAM file handle');
    return state;
  }

  async function persist(file, records, context) {
    await storage.write(file.root, file.path, serializeIsamStore(file.keyName, records, limits), context);
    file.records = records;
  }

  function setStatus(handle, status) {
    handle.status = status;
    return status;
  }

  function unavailable(handle) {
    return setStatus(handle, handle.status === ISAM_STATUS.ALREADY_OPEN ? ISAM_STATUS.ALREADY_OPEN : ISAM_STATUS.FILE_NOT_FOUND);
  }

  async function open(root, path, keyName, mode, context) {
    if (typeof root !== 'string' || typeof path !== 'string' || typeof keyName !== 'string') {
      throw new Error('ISAM open requires a storage root, path, and key name');
    }
    if (!ISAM_OPEN_MODES.includes(mode)) throw new Error(`Unsupported ISAM open mode: ${mode}`);
    if (handles.size >= limits.maxHandles) throw new Error('ISAM open-handle capacity exceeded');

    const identity = `${root}\0${path}`;
    if ([...handles.values()].some(handle => handle.identity === identity)) {
      const id = nextHandle++;
      handles.set(id, { identity, file: null, mode, status: ISAM_STATUS.ALREADY_OPEN, cursor: 0 });
      return id;
    }

    let file = files.get(identity);
    const exists = Boolean(await storage.exists(root, path, context));
    if (mode === 'OUTPUT') {
      file = { root, path, keyName, records: new Map() };
      await persist(file, file.records, context);
      files.set(identity, file);
    } else if (exists && (!file || file.keyName !== keyName)) {
      file = { root, path, keyName, records: parseIsamStore(await storage.read(root, path, context), keyName) };
      files.set(identity, file);
    }

    const id = nextHandle++;
    const available = exists || mode === 'OUTPUT';
    handles.set(id, {
      identity,
      file: available ? file : null,
      mode,
      status: available ? ISAM_STATUS.SUCCESS : ISAM_STATUS.FILE_NOT_FOUND,
      cursor: 0
    });
    return id;
  }

  function read(value, key) {
    const handle = handleOf(value);
    if (!handle.file) return { status: unavailable(handle), record: '' };
    if (typeof key !== 'string') throw new Error('ISAM read key must be a string');
    const record = handle.file.records.get(key);
    return {
      status: setStatus(handle, record === undefined ? ISAM_STATUS.RECORD_NOT_FOUND : ISAM_STATUS.SUCCESS),
      record: record ?? ''
    };
  }

  function readNext(value) {
    const handle = handleOf(value);
    if (!handle.file) return { status: unavailable(handle), record: '' };
    const ordered = [...handle.file.records.entries()].sort(([left], [right]) => compareIsamKeys(left, right));
    if (handle.cursor >= ordered.length) return { status: setStatus(handle, ISAM_STATUS.END_OF_FILE), record: '' };
    const [key, record] = ordered[handle.cursor++];
    handle.lastKey = key;
    return { status: setStatus(handle, ISAM_STATUS.SUCCESS), record };
  }

  function start(value, key, comparison) {
    const handle = handleOf(value);
    if (!handle.file) return unavailable(handle);
    if (typeof key !== 'string' || !ISAM_START_COMPARISONS.includes(comparison)) {
      throw new Error('ISAM START received an invalid key or comparison');
    }
    const ordered = [...handle.file.records.keys()].sort(compareIsamKeys);
    const index = ordered.findIndex(candidate => {
      const order = compareIsamKeys(candidate, key);
      return comparison === '=' ? order === 0
        : comparison === '>' ? order > 0
          : comparison === '>=' ? order >= 0
            : comparison === '<' ? order < 0
              : order <= 0;
    });
    if (index < 0) return setStatus(handle, ISAM_STATUS.RECORD_NOT_FOUND);
    handle.cursor = index;
    return setStatus(handle, ISAM_STATUS.SUCCESS);
  }

  async function write(value, key, record, context) {
    const handle = handleOf(value);
    if (!handle.file) return unavailable(handle);
    if (handle.mode === 'INPUT') return setStatus(handle, ISAM_STATUS.MODE_CONFLICT);
    if (typeof key !== 'string' || typeof record !== 'string') throw new Error('ISAM WRITE requires string key and record values');
    if (handle.file.records.has(key)) return setStatus(handle, ISAM_STATUS.DUPLICATE_KEY);
    const records = new Map(handle.file.records);
    records.set(key, record);
    await persist(handle.file, records, context);
    return setStatus(handle, ISAM_STATUS.SUCCESS);
  }

  async function rewrite(value, key, record, context) {
    const handle = handleOf(value);
    if (!handle.file) return unavailable(handle);
    if (handle.mode === 'INPUT' || handle.mode === 'EXTEND') return setStatus(handle, ISAM_STATUS.MODE_CONFLICT);
    if (typeof key !== 'string' || typeof record !== 'string') throw new Error('ISAM REWRITE requires string key and record values');
    if (!handle.file.records.has(key)) return setStatus(handle, ISAM_STATUS.RECORD_NOT_FOUND);
    const records = new Map(handle.file.records);
    records.set(key, record);
    await persist(handle.file, records, context);
    return setStatus(handle, ISAM_STATUS.SUCCESS);
  }

  async function remove(value, key, context) {
    const handle = handleOf(value);
    if (!handle.file) return unavailable(handle);
    if (handle.mode !== 'I-O') return setStatus(handle, ISAM_STATUS.MODE_CONFLICT);
    if (typeof key !== 'string') throw new Error('ISAM DELETE key must be a string');
    if (!handle.file.records.has(key)) return setStatus(handle, ISAM_STATUS.RECORD_NOT_FOUND);
    const records = new Map(handle.file.records);
    records.delete(key);
    await persist(handle.file, records, context);
    return setStatus(handle, ISAM_STATUS.SUCCESS);
  }

  function status(value) {
    return handleOf(value).status;
  }

  function close(value) {
    const handle = handleOf(value);
    handles.delete(Number(value));
    return setStatus(handle, ISAM_STATUS.SUCCESS);
  }

  return { open, read, readNext, start, write, rewrite, delete: remove, status, close };
}
