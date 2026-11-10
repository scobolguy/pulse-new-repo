import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';
import { buildGenericNative } from '../../../virtualMachines/esp32/testing/pmachines/build-generic-native.mjs';
import { requestEsp32 } from '../../../virtualMachines/esp32/testing/pmachines/esp32-http.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';

export async function createExecutionTarget(target, {
  origin = process.env.PULSE_ESP32_TEST_URL, nativeExecutable = process.env.PULSE_KOTLIN_NATIVE_RUNNER
} = {}) {
  if (target === 'js') {
    const opcodeMap = await loadOpcodeMap();
    return {
      async execute(artifact) {
        const mappingsById = new Map();
        mappingsById.__globals = artifact.programMap.globals;
        mappingsById.__proceduresByLabel = artifact.programMap.procedures;
        const result = await executeProgram({
          instructions: parsePcode(artifact.pcodeText), mappingsById, opcodeMap,
          queueTypesByName: new Map(), isoTypeIds: new Set(),
          inputQueue: 'kotlin.validation', sourceMessage: '',
          runtimeContext: { maxSteps: 100000, maxCallDepth: 64 },
        });
        return { stdout: result.stdout, error: result.error ?? null, stepLimitHit: result.stepLimitHit };
      },
      async stop() {},
    };
  }
  if (target === 'native') {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'kotlin-native-'));
    try {
      const executable = nativeExecutable ? path.resolve(nativeExecutable) : path.join(directory, 'runner.exe');
      if (!nativeExecutable)
        buildGenericNative(fileURLToPath(new URL('../../../virtualMachines/esp32/testing/pmachines/generic-native-runner.cpp', import.meta.url)), executable);
      return {
        async execute(artifact) {
          const code = path.join(directory, 'case.pcode'), map = path.join(directory, 'case.json');
          await writeFile(code, artifact.pcodeText);
          await writeFile(map, JSON.stringify(artifact.programMap));
          const result = spawnSync(executable, [code, map], {
            encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024,
          });
          assert.ifError(result.error);
          assert.ok([0, 4].includes(result.status), result.stdout + result.stderr);
          return JSON.parse(result.stdout);
        },
        async stop() { await rm(directory, { recursive: true, force: true }); },
      };
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }
  if (target !== 'esp32') throw new TypeError(`Unknown Kotlin execution target '${target}'`);
  if (!origin) throw new Error('Set PULSE_ESP32_TEST_URL to an explicitly selected idle ESP32');
  const checkIdle = async () => {
    for (const route of ['/pmachine/status', '/pmachine/service_host/status']) {
      const response = await requestEsp32(new URL(route, origin), { timeoutMs: 15000 });
      assert.equal(response.status, 200, await response.text());
      assert.equal(JSON.parse(await response.text()).running, false, 'Do not interrupt an active PMachine or service');
    }
  };
  await checkIdle();
  return {
    async execute(artifact) {
      const response = await requestEsp32(new URL('/pmachine/execute_json', origin), {
        method: 'POST', headers: { 'content-type': 'application/json' }, timeoutMs: 60000,
        body: JSON.stringify({
          pcode: artifact.pcodeText, programMap: attachPcodeSignature(artifact.programMap, artifact.pcodeText),
          max: Math.max(65536, Buffer.byteLength(artifact.pcodeText)), message: '', stdin: '',
          inputQueue: 'kotlin.validation',
        }),
      });
      const text = await response.text();
      assert.equal(response.status, 200, text);
      const result = JSON.parse(text);
      const error = result.runtimeError ?? result.flowState?.__runtime_error ?? null;
      assert.equal(result.ok, !error && !result.stepLimitHit, text);
      return { stdout: result.stdout, error, stepLimitHit: result.stepLimitHit };
    },
    stop: checkIdle,
  };
}

export function assertExecution(result, stdout, id) {
  assert.equal(result.stepLimitHit, false, `${id}: instruction limit reached`);
  assert.equal(result.error, null, `${id}: ${result.error}`);
  assert.deepEqual(result.stdout, stdout, id);
}
