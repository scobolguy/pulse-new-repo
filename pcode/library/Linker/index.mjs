import { Worker } from 'node:worker_threads';
import { SERVICE_HOST_BINDINGS } from '../../../virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';

const bindingCapabilities = Object.fromEntries(Object.entries(SERVICE_HOST_BINDINGS)
  .filter(([, binding]) => binding.capabilities || binding.capability)
  .map(([name, binding]) => [name, binding.capabilities || [binding.capability]]));
let worker;
let workerFailure;

export function invokeLinker(operation, payload) {
  if (!['link', 'resolve', 'bindings'].includes(operation)) throw new Error(`Unknown linker operation: ${operation}`);
  if (workerFailure) throw workerFailure;
  if (!worker) {
    worker = new Worker(new URL('./worker.mjs', import.meta.url));
    worker.on('error', error => { workerFailure = error; });
    worker.unref();
  }
  const request = JSON.stringify(payload);
  const control = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2);
  const output = new SharedArrayBuffer(Math.min(64 * 1024 * 1024, Math.max(1024 * 1024, Buffer.byteLength(request) * 4)));
  worker.postMessage({ operation, request, control, output });
  if (Atomics.wait(new Int32Array(control), 0, 0, 300000) === 'timed-out') {
    worker.terminate();
    worker = undefined;
    throw new Error('Shared P-code linker worker timed out');
  }
  const length = Atomics.load(new Int32Array(control), 1);
  const result = JSON.parse(Buffer.from(output, 0, length).toString('utf8'));
  if (result.error) {
    const error = new Error(result.error);
    if (result.name) error.name = result.name;
    throw error;
  }
  return result.value;
}

export function linkPcodeLibraries(program, libraries = []) {
  if (!program || typeof program.pcodeText !== 'string' || !program.programMap) {
    throw new Error('[PCODE-LINK] Root program requires pcodeText and programMap');
  }
  if (!Array.isArray(libraries)) throw new TypeError('[PCODE-LINK] Libraries must be an array');
  if (libraries.length === 0) return program;
  return invokeLinker('link', { program, libraries, bindingCapabilities });
}

export function resolvePcodeLibraries(program, libraries, required) {
  return invokeLinker('resolve', { program, libraries, required, bindingCapabilities });
}

export function bindExecutionResources({ programDefaults = [], deployment = [], overrides = [] } = {}) {
  return invokeLinker('bindings', { programDefaults, deployment, overrides });
}
