import { parentPort } from 'node:worker_threads';
import fs from 'node:fs/promises';
import path from 'node:path';
import { compileCobolishToPcode } from '../src/compile-cobolish-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';
import { createFilesystemBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/filesystem-bindings.mjs';
import { createIsamBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/isam-bindings.mjs';
import { createDesktopTextBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-text-bindings.mjs';
import { createDesktopIntrinsicBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-intrinsic-bindings.mjs';
import { configureSource, fixedToFree, evaluateReport } from './corpus.mjs';

parentPort.on('message', async ({ unit, directory }) => {
  let compiled;
  try {
    const source = configureSource(fixedToFree(unit.source));
    await fs.writeFile(path.join(directory, 'configured.cob'), source);
    compiled = compileCobolishToPcode(source, { fileName: `${unit.id}.cob` });
  } catch (error) {
    parentPort.postMessage({ outcome: 'compile_failure', diagnostic: error.message });
    return;
  }
  try {
    await fs.writeFile(path.join(directory, 'program.pcode'), compiled.pcodeText);
    await fs.writeFile(path.join(directory, 'program.json'), JSON.stringify(compiled.programMap, null, 2));
    const data = path.join(directory, 'data');
    await fs.mkdir(data);
    const filesystem = await createFilesystemBindings({ data: { path: data, readOnly: false } });
    const bindings = {
      ...createDesktopTextBindings(), ...createDesktopIntrinsicBindings(),
      ...filesystem.handlers, ...createIsamBindings(filesystem.handlers)
    };
    const execution = await executeProgram({
      instructions: parsePcode(compiled.pcodeText), programMap: compiled.programMap, inputQueue: '', sourceMessage: '',
      runtimeContext: { maxSteps: 200000, cooperative: true, callHost: async (name, args) => {
        if (!bindings[name]) throw new Error(`CCVS host capability unavailable: ${name}`);
        return bindings[name](...args);
      } }
    });
    if (execution.stepLimitHit) parentPort.postMessage({ outcome: 'instruction_limit', diagnostic: '200000 instruction budget exhausted' });
    else if (execution.error) parentPort.postMessage({ outcome: 'runtime_failure', diagnostic: execution.error });
    else {
      const stdout = Array.isArray(execution.stdout) ? execution.stdout.join('\n') : String(execution.stdout || '');
      await fs.writeFile(path.join(directory, 'stdout.txt'), stdout);
      parentPort.postMessage(evaluateReport(stdout));
    }
  } catch (error) {
    parentPort.postMessage({ outcome: 'runtime_failure', diagnostic: error.message });
  }
});
parentPort.postMessage({ ready: true });
