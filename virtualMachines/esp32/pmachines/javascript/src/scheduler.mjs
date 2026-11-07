import { performance } from 'node:perf_hooks';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { executeProgram } from './runtime.mjs';

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
}

export class PMachineScheduler {
  #contexts = new Map();
  #ready = [];
  #active = new Set();
  #nextId = 1;
  #completed = 0;
  #failed = 0;
  #suspensions = 0;
  #resumptions = 0;
  #yields = 0;

  constructor({ slots = 1, maxContexts = 64, quantum = 256 } = {}) {
    for (const [name, value] of Object.entries({ slots, maxContexts, quantum })) positiveInteger(value, name);
    if (slots > maxContexts) throw new RangeError('slots must not exceed maxContexts');
    Object.defineProperties(this, {
      slots: { value: slots, enumerable: true },
      maxContexts: { value: maxContexts, enumerable: true },
      quantum: { value: quantum, enumerable: true },
    });
  }

  async execute(options, { name = 'program' } = {}) {
    if (typeof name !== 'string' || !name.length) throw new TypeError('Invalid virtual program name');
    const runtimeContext = options?.runtimeContext ?? {};
    if (runtimeContext.executionSlot) throw new Error('Program already belongs to an execution slot');
    const { signal, maxExecutionMs = null } = runtimeContext;
    if (maxExecutionMs !== null) positiveInteger(maxExecutionMs, 'maxExecutionMs');
    signal?.throwIfAborted();
    if (this.#contexts.size >= this.maxContexts) {
      throw Object.assign(new Error('PMachine virtual context capacity exceeded'), { status: 503 });
    }
    const context = {
      id: this.#nextId++, name, state: 'ready', pc: 0, stepCount: 0,
      waitReason: null, activeMs: 0, startedAt: null, suspensions: 0, resumptions: 0,
    };
    this.#contexts.set(context.id, context);
    let rejectAborted;
    const aborted = new Promise((resolve, reject) => { rejectAborted = reject; });
    // Abort may arrive while the interpreter is running between scheduler calls.
    aborted.catch(() => {});
    const onAbort = () => rejectAborted(signal.reason ?? new Error('PMachine execution cancelled'));
    signal?.addEventListener('abort', onAbort, { once: true });
    const checkBudget = () => {
      signal?.throwIfAborted();
      const elapsed = context.activeMs + (context.startedAt === null ? 0 : performance.now() - context.startedAt);
      if (maxExecutionMs !== null && elapsed > maxExecutionMs) {
        throw new Error('PMachine active execution timeout');
      }
    };
    const acquire = async () => {
      checkBudget();
      context.state = 'ready';
      context.waitReason = null;
      await Promise.race([new Promise(resolve => {
        this.#ready.push({ context, resolve });
        this.#drain();
      }), aborted]);
      checkBudget();
    };
    const executionSlot = {
      quantum: this.quantum,
      checkpoint: async metadata => {
        Object.assign(context, metadata);
        checkBudget();
        this.#yields += 1;
        this.#release(context);
        context.state = 'ready';
        await Promise.race([nextTurn(), aborted]);
        await acquire();
      },
      wait: async (operation, metadata) => {
        checkBudget();
        const pending = operation();
        if (!pending || typeof pending.then !== 'function') {
          checkBudget();
          return pending;
        }
        Object.assign(context, metadata);
        const outcome = Promise.resolve(pending).then(
          value => ({ value }), error => ({ error, rejected: true }));
        checkBudget();
        this.#release(context);
        context.state = 'waiting';
        context.suspensions += 1;
        this.#suspensions += 1;
        const result = await Promise.race([outcome, aborted]);
        await acquire();
        context.resumptions += 1;
        this.#resumptions += 1;
        if (result.rejected) throw result.error;
        return result.value;
      },
    };
    try {
      await acquire();
      const result = await executeProgram({
        ...options, runtimeContext: { ...runtimeContext, executionSlot },
      });
      checkBudget();
      this.#completed += 1;
      return result;
    } catch (error) {
      this.#failed += 1;
      throw error;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      this.#ready = this.#ready.filter(entry => entry.context !== context);
      this.#release(context);
      this.#contexts.delete(context.id);
      this.#drain();
    }
  }

  #release(context) {
    if (this.#active.delete(context.id)) {
      context.activeMs += performance.now() - context.startedAt;
      context.startedAt = null;
    }
    this.#drain();
  }

  #drain() {
    while (this.#active.size < this.slots && this.#ready.length) {
      const { context, resolve } = this.#ready.shift();
      this.#active.add(context.id);
      context.state = 'running';
      context.startedAt = performance.now();
      resolve();
    }
  }

  getStatus() {
    const contexts = [...this.#contexts.values()].map(context => ({
      id: context.id, name: context.name, state: context.state,
      pc: context.pc, stepCount: context.stepCount, waitReason: context.waitReason,
      activeExecutionMs: context.activeMs + (context.startedAt === null ? 0 : performance.now() - context.startedAt),
      suspensions: context.suspensions, resumptions: context.resumptions,
    }));
    return {
      slots: this.slots, maxContexts: this.maxContexts, active: this.#active.size,
      available: this.slots - this.#active.size, ready: contexts.filter(c => c.state === 'ready').length,
      waiting: contexts.filter(c => c.state === 'waiting').length, contexts,
      completed: this.#completed, failed: this.#failed, suspensions: this.#suspensions,
      resumptions: this.#resumptions, yields: this.#yields,
    };
  }
}
