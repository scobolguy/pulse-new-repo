import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileAssemblerishToPcode } from '../src/compile-assemblerish-to-pcode.mjs';
import { simulateAssemblerish } from '../src/simulator.mjs';
import { compilePascalishProgramWithAntlr } from '../../../virtualMachines/esp32/aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../virtualMachines/esp32/pmachines/javascript/src/service-host.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';

test('one-second pin-free timer sends its event to a Pascalish dot receiver', async () => {
  const artifact = compileAssemblerishToPcode(await readFile(new URL('../examples/timer-dot.asmish', import.meta.url), 'utf8'));
  assert.deepEqual(artifact.programMap.assemblerish.trigger, { kind: 'timer', intervalMs: 1000 });
  assert.deepEqual(artifact.programMap.assemblerish.devices, []);
  const simulated = await simulateAssemblerish(artifact, { allowedPins: [] });
  const source = await readFile(new URL('../examples/timer-dot-service.pas', import.meta.url), 'utf8');
  const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });
  const result = await executeProgram({
    instructions: parsePcode(compiled.pcodeText), programMap: compiled.programMap,
    sourceMessage: JSON.stringify(simulated.events[0]),
    runtimeContext: {
      maxSteps: 1000,
      callHost(name) {
        if (name === 'host.event_method') return 'POST';
        if (name === 'host.event_path') return artifact.programMap.assemblerish.target;
        throw new Error(`Unexpected receiver binding: ${name}`);
      },
    },
  });
  assert.equal(result.error, null);
  assert.deepEqual(result.stdout, ['.']);
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'timer-dot-test', httpPort: 0, udpPort: 0,
    logger: { log() {}, warn() {}, error() {} },
  });
  try {
    await host.start();
    const response = await host.dispatch({
      method: 'POST', path: artifact.programMap.assemblerish.target,
      body: JSON.stringify(simulated.events[0]), peer: 'hardware',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true });
  } finally { await host.stop(); }
});
