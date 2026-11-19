import { parentPort } from 'node:worker_threads';

let environment;
async function initialize() {
  const [{ buildLinkerBootstrap }, runtime, { createDesktopTextBindings }, { createHash }] = await Promise.all([
    import('./bootstrap.mjs'),
    import('../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs'),
    import('../../../virtualMachines/esp32/libraries/cobol/text-bindings.mjs'),
    import('node:crypto')
  ]);
  const compiled = await buildLinkerBootstrap();
  const blobs = new Map();
  return {
    compiled,
    instructions: runtime.parsePcode(compiled.pcodeText),
    execute: runtime.executeProgram,
    bindings: {
      ...createDesktopTextBindings(),
      'host.text_hash_utf8': value => createHash('sha256').update(value, 'utf8').digest('hex'),
      'host.blob_load': key => blobs.get(key) ?? '',
      'host.blob_store': (key, value) => {
        if (value === '') blobs.delete(key);
        else blobs.set(key, value);
        return 0;
      }
    }
  };
}

async function invoke({ operation, request, control, output }) {
  const state = new Int32Array(control);
  try {
    environment ??= initialize();
    const { compiled, instructions, execute, bindings } = await environment;
    const result = await execute({
      instructions, programMap: compiled.programMap,
      runtimeContext: {
        desktopBudget: true, maxStack: 4096, maxCallDepth: 256,
        callHost(name, args) {
          if (name === 'host.event_body') return request;
          if (name === 'host.event_method') return 'POST';
          if (name === 'host.event_path') return `/${operation}`;
          if (name === 'host.raise_error') throw new Error(args[0]);
          const handler = bindings[name];
          if (typeof handler !== 'function') throw new Error(`Linker primitive unavailable: ${name}`);
          return handler(...args);
        }
      }
    });
    if (result.error || result.stepLimitHit) throw new Error(result.error || 'Linker instruction budget exceeded');
    respond(JSON.stringify({ value: result.response }));
  } catch (error) {
    respond(JSON.stringify({ error: error.message, name: error.name }));
  }
  function respond(json) {
    let bytes = Buffer.from(json, 'utf8');
    if (bytes.length > output.byteLength) bytes = Buffer.from(JSON.stringify({ error: 'Linker response capacity exceeded' }));
    new Uint8Array(output).set(bytes);
    Atomics.store(state, 1, bytes.length);
    Atomics.store(state, 0, 1);
    Atomics.notify(state, 0);
  }
}

let pending = Promise.resolve();
parentPort.on('message', message => {
  pending = pending.then(() => invoke(message));
});
