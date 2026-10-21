export class PMachineMemoryError extends Error {
  constructor(message, diagnostics) {
    super(message);
    this.name = 'PMachineMemoryError';
    this.code = 'PMACHINE_MEMORY_EXHAUSTED';
    this.memory = diagnostics;
  }
}

function byteCount(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a nonnegative safe integer`);
  }
  return value;
}

// This owns VM storage, not the JavaScript engine's object heap.
export class PMachineMemory {
  #limit;
  #used = 0;
  #peak = 0;
  #failures = 0;
  #scopes = new Set();
  #blocks = new Map();
  #nextHandle = 1;

  constructor({ limitBytes } = {}) {
    this.#limit = limitBytes === undefined ? null : byteCount(limitBytes, 'limitBytes');
  }

  createScope(lifetime = 'invocation', parent = null) {
    if (!['program', 'invocation', 'procedure'].includes(lifetime)) {
      throw new TypeError(`Invalid memory lifetime: ${lifetime}`);
    }
    if (parent !== null) this.#requireScope(parent);
    if (parent && lifetime === 'program') throw new TypeError('Program storage cannot have a parent scope');
    const scope = Object.freeze({ lifetime, parent });
    this.#scopes.add(scope);
    return scope;
  }

  assertScopeOpen(scope) {
    this.#requireScope(scope);
  }

  allocate(scope, bytes, { lazy = false } = {}) {
    this.#requireScope(scope);
    byteCount(bytes, 'bytes');
    if (typeof lazy !== 'boolean') throw new TypeError('lazy must be boolean');
    if (!lazy) this.#admit(bytes);
    const handle = this.#nextHandle++;
    const block = { scope, bytes, data: null, committed: !lazy, reservation: false };
    if (!lazy) block.data = this.#buffer(bytes);
    this.#blocks.set(handle, block);
    if (!lazy) this.#charge(bytes);
    return handle;
  }

  reserve(scope, bytes) {
    this.#requireScope(scope);
    byteCount(bytes, 'bytes');
    this.#admit(bytes);
    const handle = this.#nextHandle++;
    this.#blocks.set(handle, { scope, bytes, data: null, committed: true, reservation: true });
    this.#charge(bytes);
    return handle;
  }

  materialize(handle) {
    const block = this.#requireBlock(handle);
    if (!block.committed) {
      this.#admit(block.bytes);
      const data = this.#buffer(block.bytes);
      block.data = data;
      block.committed = true;
      this.#charge(block.bytes);
    }
    return block.bytes;
  }

  resize(handle, bytes) {
    byteCount(bytes, 'bytes');
    const block = this.#requireBlock(handle);
    if (!block.committed) {
      block.bytes = bytes;
      return;
    }
    const delta = bytes - block.bytes;
    if (delta > 0) this.#admit(delta);
    if (!block.reservation) {
      const data = this.#buffer(bytes);
      data.set(block.data.subarray(0, bytes));
      block.data = data;
    }
    block.bytes = bytes;
    this.#charge(delta);
  }

  write(handle, offset, bytes) {
    const block = this.#requireBlock(handle);
    if (block.reservation) throw new TypeError('Budget reservations do not expose byte storage');
    if (!(bytes instanceof Uint8Array)) throw new TypeError('bytes must be a Uint8Array');
    this.#bounds(block, offset, bytes.length);
    this.materialize(handle);
    block.data.set(bytes, offset);
  }

  read(handle, offset, length) {
    const block = this.#requireBlock(handle);
    if (block.reservation) throw new TypeError('Budget reservations do not expose byte storage');
    this.#bounds(block, offset, length);
    this.materialize(handle);
    return block.data.slice(offset, offset + length);
  }

  transfer(handle, scope) {
    this.#requireScope(scope);
    this.#requireBlock(handle).scope = scope;
  }

  release(handle) {
    const block = this.#requireBlock(handle);
    if (block.committed) this.#used -= block.bytes;
    this.#blocks.delete(handle);
  }

  closeScope(scope) {
    this.#requireScope(scope);
    for (const child of [...this.#scopes]) {
      if (child.parent === scope) this.closeScope(child);
    }
    for (const [handle, block] of this.#blocks) {
      if (block.scope === scope) this.release(handle);
    }
    this.#scopes.delete(scope);
  }

  diagnostics() {
    const byLifetime = { program: 0, invocation: 0, procedure: 0 };
    let deferredBytes = 0;
    for (const block of this.#blocks.values()) {
      if (!block.committed) deferredBytes += block.bytes;
      else byLifetime[block.scope.lifetime] += block.bytes;
    }
    return {
      version: 1,
      limitBytes: this.#limit,
      usedBytes: this.#used,
      peakBytes: this.#peak,
      allocationFailures: this.#failures,
      liveBlocks: this.#blocks.size,
      liveScopes: this.#scopes.size,
      deferredBytes,
      byLifetime,
    };
  }

  #bounds(block, offset, length) {
    byteCount(offset, 'offset');
    byteCount(length, 'length');
    if (offset > block.bytes || length > block.bytes - offset) {
      throw new RangeError('VM memory access is outside the allocation');
    }
  }

  #requireScope(scope) {
    if (!this.#scopes.has(scope)) throw new TypeError('VM memory scope is closed or belongs to another machine');
  }

  #requireBlock(handle) {
    const block = this.#blocks.get(handle);
    if (!block) throw new TypeError('VM memory handle is invalid or has been released');
    return block;
  }

  #admit(bytes) {
    if (bytes > Number.MAX_SAFE_INTEGER - this.#used
      || (this.#limit !== null && bytes > this.#limit - this.#used)) {
      ++this.#failures;
      throw new PMachineMemoryError(`VM memory budget exceeded: requested ${bytes} bytes`, this.diagnostics());
    }
  }

  #buffer(bytes) {
    try {
      return new Uint8Array(bytes);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      ++this.#failures;
      throw new PMachineMemoryError(`VM backing allocation failed: requested ${bytes} bytes`, this.diagnostics());
    }
  }

  #charge(bytes) {
    this.#used += bytes;
    this.#peak = Math.max(this.#peak, this.#used);
  }
}

export function managedStorage(memory, scope, target = {}) {
  const handles = new Map();
  const array = Array.isArray(target);
  const tracked = key => typeof key === 'string' && (!array || /^(0|[1-9]\d*)$/.test(key));
  const sizeOf = value => typeof value === 'string' ? 16 + Buffer.byteLength(value, 'utf8') : 16;
  const proxy = new Proxy(target, {
    get(object, key, receiver) {
      if (tracked(key)) memory.assertScopeOpen(scope);
      return Reflect.get(object, key, receiver);
    },
    set(object, key, value) {
      memory.assertScopeOpen(scope);
      if (array && key === 'length') {
        if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new RangeError('Invalid array length');
        for (const [name, handle] of handles) {
          if (Number(name) >= value) {
            memory.release(handle);
            handles.delete(name);
          }
        }
      } else if (tracked(key)) {
        const bytes = sizeOf(value);
        if (handles.has(key)) memory.resize(handles.get(key), bytes);
        else handles.set(key, memory.reserve(scope, bytes));
      }
      return Reflect.set(object, key, value);
    },
    deleteProperty(object, key) {
      memory.assertScopeOpen(scope);
      if (handles.has(key)) {
        memory.release(handles.get(key));
        handles.delete(key);
      }
      return Reflect.deleteProperty(object, key);
    },
  });
  try {
    for (const [key, value] of Object.entries(target)) proxy[key] = value;
  } catch (error) {
    for (const handle of handles.values()) memory.release(handle);
    throw error;
  }
  return proxy;
}
