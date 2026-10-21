// Only instances issued by this heap are references; integers remain integers.
export class ObjectRef {
  constructor() { Object.freeze(this); }
}

export class ManagedObjects {
  static MAX_FIELDS = 64;
  static HANDLE_CAPACITY = 128;
  static ARENA_BYTES = 8192;
  #blocks = new Map();
  #top = 0;
  #attempts = 0;
  #memory;
  #scope;
  #stats = { liveHandles: 0, liveBytes: 0, peakHandles: 0, peakBytes: 0,
    allocations: 0, compactions: 0, failures: 0 };

  constructor(memory = null, scope = null) { this.#memory = memory; this.#scope = scope; }
  get stats() { return { ...this.#stats }; }
  #fail(message) { ++this.#stats.failures; throw new Error(message); }
  #block(ref) {
    if (ref === 0) throw new Error('nil object dereference');
    if (!(ref instanceof ObjectRef)) throw new TypeError('object reference required');
    const block = this.#blocks.get(ref);
    if (!block) throw new Error('invalid object handle');
    return block;
  }
  #count(count) {
    if (!Number.isInteger(count)) throw new TypeError('object field count must be an integer');
    if (count < 0 || count > ManagedObjects.MAX_FIELDS) throw new RangeError('object field capacity exceeded');
  }
  #compact() {
    let offset = 0;
    for (const block of [...this.#blocks.values()].sort((a, b) => a.offset - b.offset)) {
      block.offset = offset;
      offset += block.bytes;
    }
    this.#top = offset;
    ++this.#stats.compactions;
  }
  create(count) {
    this.#count(count);
    if (++this.#attempts >= 64) {
      this.#attempts = 0;
      if (this.#top > this.#stats.liveBytes) this.#compact();
    }
    const bytes = Math.max(1, count) * 8;
    if (this.#blocks.size >= ManagedObjects.HANDLE_CAPACITY) this.#fail('managed heap handle capacity exceeded');
    if (bytes > ManagedObjects.ARENA_BYTES - this.#top && this.#top > this.#stats.liveBytes) this.#compact();
    if (bytes > ManagedObjects.ARENA_BYTES - this.#top) this.#fail('managed heap arena exhausted');
    const reservation = this.#memory?.reserve(this.#scope, bytes);
    const ref = new ObjectRef();
    this.#blocks.set(ref, { values: Array(count).fill(0), bytes, offset: this.#top, refs: 0, reservation });
    this.#top += bytes;
    ++this.#stats.allocations;
    ++this.#stats.liveHandles;
    this.#stats.liveBytes += bytes;
    this.#stats.peakHandles = Math.max(this.#stats.peakHandles, this.#stats.liveHandles);
    this.#stats.peakBytes = Math.max(this.#stats.peakBytes, this.#stats.liveBytes);
    return ref;
  }
  #field(ref, index) {
    const block = this.#block(ref);
    if (!Number.isInteger(index)) throw new TypeError('object field index must be an integer');
    if (index < 0 || index >= block.values.length) throw new RangeError('object field index out of range');
    return block;
  }
  get(ref, index) { return this.#field(ref, index).values[index]; }
  set(ref, index, value) {
    const block = this.#field(ref, index);
    if (value instanceof ObjectRef) {
      const seen = new Set();
      const reaches = candidate => {
        const node = this.#block(candidate);
        if (candidate === ref) return true;
        if (seen.has(candidate)) return false;
        seen.add(candidate);
        return node.values.some(child => child instanceof ObjectRef && reaches(child));
      };
      if (reaches(value)) throw new Error('reference cycle is not supported');
    }
    block.values[index] = value;
    return 0;
  }
  length(ref) { return ref === 0 ? 0 : this.#block(ref).values.length; }
  resize(ref, count) {
    const length = this.length(ref);
    const result = this.create(count);
    const block = this.#block(result);
    for (let index = 0; index < Math.min(length, count); ++index)
      block.values[index] = this.get(ref, index);
    return result;
  }
  references(ref) { return this.#block(ref).refs; }
  reconcile(roots) {
    for (const block of this.#blocks.values()) block.refs = 0;
    const mark = value => { if (value instanceof ObjectRef) ++this.#block(value).refs; };
    for (const value of roots) mark(value);
    for (const block of this.#blocks.values()) for (const value of block.values) mark(value);
    const pending = [...this.#blocks].filter(([, block]) => block.refs === 0);
    while (pending.length) {
      const [ref, block] = pending.pop();
      for (const value of block.values) {
        if (value instanceof ObjectRef) {
          const child = this.#block(value);
          if (--child.refs === 0) pending.push([value, child]);
        }
      }
      if (block.offset + block.bytes === this.#top) this.#top = block.offset;
      this.#blocks.delete(ref);
      if (block.reservation) this.#memory.release(block.reservation);
      --this.#stats.liveHandles;
      this.#stats.liveBytes -= block.bytes;
    }
  }
  reset() {
    for (const block of this.#blocks.values())
      if (block.reservation) this.#memory.release(block.reservation);
    this.#blocks.clear();
    this.#top = 0;
    this.#attempts = 0;
    this.#stats.liveHandles = this.#stats.liveBytes = 0;
  }
}
