import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { kotlinCoreSpecCases } from '../tests/spec-cases.mjs';
import { createExecutionTarget, assertExecution } from '../tests/execution-targets.mjs';

const origin = process.env.PULSE_ESP32_TEST_URL;
if (!origin) throw new Error('Set PULSE_ESP32_TEST_URL to the ESP32 HTTP origin');
const executor = await createExecutionTarget('esp32', { origin });
try {
  for (const testCase of kotlinCoreSpecCases) {
    const artifact = compileKotlinToPcode(testCase.source, { fileName: `${testCase.id}.kt`, target: 'esp32' });
    assertExecution(await executor.execute(artifact), testCase.stdout, testCase.id);
    console.log(`PASS ${testCase.id}`);
  }
} finally { await executor.stop(); }
console.log(`Passed ${kotlinCoreSpecCases.length} Kotlin cases on ${new URL(origin).origin}`);
