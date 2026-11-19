import { createHash } from 'node:crypto';
import { executeProgram } from './runtime.mjs';

const defaults = Object.freeze({
  maxInstructions: 200000, maxImageBytes: 8 * 1024 * 1024, maxGlobals: 4096,
  maxSlots: 4096, maxModules: 64, maxArity: 8,
});
const ops = new Set(('ADD AND CALL CONCAT EQ GE GT HALT JMP JZ LE LOAD LOAD_NAME LT MUL NEQ NOP NOT OR '
  + 'PUSH_INT PUSH_STR RET STORE STORE_NAME STREQ STRNEQ SUB').split(' '));
const controls = new Set(['CALL', 'JMP', 'JZ']);
const variables = new Set(['LOAD', 'LOAD_NAME', 'STORE', 'STORE_NAME']);
const check = (condition, message) => { if (!condition) throw new Error(message); };
const uint = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const scalar = value => typeof value === 'string'
  || (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647);

export function canonicalImageBytes(image) {
  const fields = [image.formatVersion, image.abi, image.moduleId, image.instructions.length];
  for (const i of image.instructions) fields.push(i.op, i.operand, i.target, i.argCount);
  fields.push(image.entries.length);
  for (const e of image.entries) fields.push(e.entry, e.returnsValue ? 1 : 0, e.params.length, ...e.params);
  fields.push(image.globals.length, ...image.globals);
  return Buffer.from('PMI1' + fields.map(value => {
    const text = String(value);
    return `${Buffer.byteLength(text)}:${text}`;
  }).join(''), 'utf8');
}

export function imageContentHash(image) {
  return createHash('sha256').update(canonicalImageBytes(image)).digest('hex');
}

function names(values) {
  check(Array.isArray(values) && values.every(name => typeof name === 'string'
    && Buffer.byteLength(name) > 0 && Buffer.byteLength(name) <= 256)
    && new Set(values).size === values.length, 'Invalid image variable');
}

function freezeImage(input, limits) {
  check(input?.formatVersion === 1 && input.abi === 'pulse-scalar-v1', 'Unsupported image ABI');
  check(typeof input.moduleId === 'string' && Buffer.byteLength(input.moduleId) > 0
    && Buffer.byteLength(input.moduleId) <= 256, 'Invalid module identity');
  check(typeof input.contentHash === 'string' && /^[a-f0-9]{64}$/.test(input.contentHash), 'Invalid content identity');
  check(Array.isArray(input.instructions) && input.instructions.length > 0
    && input.instructions.length <= limits.maxInstructions, 'Image instruction limit');
  check(Array.isArray(input.entries) && input.entries.length > 0
    && input.entries.length <= input.instructions.length, 'Image entry limit');
  check(Array.isArray(input.globals) && input.globals.length <= limits.maxGlobals, 'Image globals limit');
  names(input.globals);
  const entries = new Map();
  for (const e of input.entries) {
    check(uint(e.entry) && e.entry < input.instructions.length && !entries.has(e.entry), 'Invalid image entry');
    names(e.params);
    check(e.params.length <= limits.maxArity && typeof e.returnsValue === 'boolean', 'Image arity limit');
    entries.set(e.entry, e);
  }
  let minimumBytes = Buffer.byteLength(input.moduleId) + Buffer.byteLength(input.abi);
  for (const i of input.instructions) {
    check(i && typeof i.op === 'string' && typeof i.operand === 'string'
      && uint(i.target) && uint(i.argCount), 'Invalid image instruction');
    minimumBytes += Buffer.byteLength(i.op) + Buffer.byteLength(i.operand) + 8;
    check(minimumBytes <= limits.maxImageBytes, 'Image byte limit');
    check(ops.has(i.op), 'Unsupported image opcode');
    check(i.argCount <= limits.maxArity, 'Image arity limit');
    if (controls.has(i.op)) {
      check(i.target < input.instructions.length, 'Image target bounds');
      check(i.operand === '', 'Unresolved image target');
      if (i.op === 'CALL')
        check(entries.get(i.target)?.params.length === i.argCount, 'Image call arity mismatch');
    } else check(i.target === 0, 'Unexpected image target');
    if (i.op !== 'CALL') check(i.argCount === 0, 'Unexpected image arity');
    if (i.op === 'PUSH_INT') {
      const n = Number(i.operand);
      check(scalar(n) && String(n) === i.operand, 'Invalid image integer');
    } else if (variables.has(i.op)) names([i.operand]);
    else if (i.op !== 'PUSH_STR') check(i.operand === '', 'Unexpected image operand');
  }
  for (const e of input.entries)
    for (const p of e.params) minimumBytes += Buffer.byteLength(p) + 2;
  for (const g of input.globals) minimumBytes += Buffer.byteLength(g) + 2;
  check(minimumBytes <= limits.maxImageBytes, 'Image byte limit');
  const bytes = canonicalImageBytes(input);
  check(bytes.length <= limits.maxImageBytes, 'Image byte limit');
  check(createHash('sha256').update(bytes).digest('hex') === input.contentHash, 'Corrupt image identity');
  const image = Object.freeze({
    formatVersion: input.formatVersion, abi: input.abi, moduleId: input.moduleId, contentHash: input.contentHash,
    instructions: Object.freeze(input.instructions.map(i => Object.freeze({
      op: i.op, operand: i.operand, target: i.target, argCount: i.argCount,
    }))),
    entries: Object.freeze(input.entries.map(e => Object.freeze({
      entry: e.entry, params: Object.freeze([...e.params]), returnsValue: e.returnsValue,
    }))),
    globals: Object.freeze([...input.globals]),
  });
  return { image, bytes: bytes.length, globals: Object.fromEntries(input.globals.map(g => [g, 0])), active: 0 };
}

export class ImageKernelContext {
  #limits;
  #pending = new Map();
  #modules = new Map();
  #slots = new Map();
  #released = false;

  constructor(limits = {}) {
    this.#limits = { ...defaults, ...limits };
    check(Object.values(this.#limits).every(uint), 'Invalid image limits');
  }
  stage(input) {
    check(!this.#released, 'Context released');
    check(this.#modules.size + this.#pending.size < this.#limits.maxModules, 'Image module limit');
    for (const module of [...this.#modules.values(), ...[...this.#pending.values()].map(p => p.module)]) {
      if (module.image.moduleId !== input.moduleId) continue;
      check(module.image.contentHash === input.contentHash, 'Conflicting pinned image identity');
      throw new Error('Image identity already staged or pinned');
    }
    const module = freezeImage(input, this.#limits);
    let instructions = module.image.instructions.length, globals = module.image.globals.length, bytes = module.bytes;
    for (const current of [...this.#modules.values(), ...[...this.#pending.values()].map(p => p.module)]) {
      instructions += current.image.instructions.length;
      globals += current.image.globals.length;
      bytes += current.bytes;
    }
    check(instructions <= this.#limits.maxInstructions && globals <= this.#limits.maxGlobals
      && bytes <= this.#limits.maxImageBytes, 'Context image resource limit');
    const handle = Object.freeze({});
    this.#pending.set(handle, { module, slots: new Map() });
    return handle;
  }
  #stage(handle) {
    check(!this.#released && this.#pending.has(handle), 'Invalid or foreign image stage');
    return this.#pending.get(handle);
  }
  bind(handle, slot, entry, arity) {
    const pending = this.#stage(handle);
    check(uint(slot) && slot < this.#limits.maxSlots, 'Image slot bounds');
    check(uint(entry) && uint(arity)
      && pending.module.image.entries.find(e => e.entry === entry)?.params.length === arity,
    'Image binding arity mismatch');
    check(!this.#slots.has(slot) && !pending.slots.has(slot), 'Image slot already owned');
    pending.slots.set(slot, { module: pending.module, entry, arity });
  }
  commit(handle) {
    const pending = this.#stage(handle);
    check(pending.module.active === 0, 'Staged image has active calls');
    for (const slot of pending.slots.keys()) check(!this.#slots.has(slot), 'Image slot already owned');
    const slots = new Map([...this.#slots, ...pending.slots]);
    const modules = new Map(this.#modules).set(pending.module.image.moduleId, pending.module);
    this.#slots = slots;
    this.#modules = modules;
    this.#pending.delete(handle);
  }
  abort(handle) {
    check(this.#stage(handle).module.active === 0, 'Staged image has active calls');
    this.#pending.delete(handle);
  }
  async #execute(module, entry, args, maxSteps) {
    check(Array.isArray(args) && args.every(scalar), 'Invalid image scalar argument');
    const signature = module.image.entries.find(e => e.entry === entry);
    check(signature && signature.params.length === args.length, 'Image call arity mismatch');
    // A task is single-threaded. Reject overlapping calls instead of racing globals.
    check(module.active === 0, 'Image call already active');
    module.active += 1;
    try {
      const procedures = Object.fromEntries(module.image.entries.map(e =>
        [String(e.entry), { params: [...e.params], locals: [] }]));
      const mappings = new Map();
      mappings.__globals = [...module.image.globals];
      mappings.__proceduresByLabel = procedures;
      const instructions = module.image.instructions.map(i => ({
        mnemonic: i.op,
        operand: i.op === 'CALL' ? { label: String(i.target), argc: i.argCount }
          : i.op === 'PUSH_INT' ? Number(i.operand) : i.operand,
        targetIndex: controls.has(i.op) ? i.target : -1,
      }));
      const invocation = { entry, params: signature.params, args, globals: { ...module.globals },
        returnsValue: signature.returnsValue };
      const result = await executeProgram({
        instructions, mappingsById: mappings, opcodeMap: new Map(), imageInvocation: invocation,
        runtimeContext: { maxSteps, maxStack: 4096, maxCallDepth: 256 },
        debugLogger() {},
      });
      check(!result.stepLimitHit, 'Image execution step limit');
      module.globals = invocation.globals;
      return result.imageResult;
    } finally { module.active -= 1; }
  }
  call(slot, args = [], { maxSteps = 200000 } = {}) {
    check(!this.#released, 'Context released');
    const binding = this.#slots.get(slot);
    check(binding, 'Unpublished image slot');
    return this.#execute(binding.module, binding.entry, args, maxSteps);
  }
  callStaged(handle, entry, args = [], { maxSteps = 200000 } = {}) {
    return this.#execute(this.#stage(handle).module, entry, args, maxSteps);
  }
  release() {
    for (const module of [...this.#modules.values(), ...[...this.#pending.values()].map(p => p.module)])
      check(module.active === 0, 'Context has active calls');
    this.#pending.clear();
    this.#slots.clear();
    this.#modules.clear();
    this.#released = true;
  }
  get moduleCount() { return this.#modules.size; }
  get slotCount() { return this.#slots.size; }
}
