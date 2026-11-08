import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ncCases } from '../../../../languages/cobolish85/tests/ccvs/nucleus.mjs';
import { functionCases } from '../../../../languages/cobolish85/tests/ccvs/functions.mjs';
import { compileTandemCobol85ToPcode } from '../../../../languages/cobolish85/src/compile-tandem-cobol85-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../pmachines/javascript/index.mjs';
import { createDesktopTextBindings } from '../../pmachines/javascript/src/desktop-text-bindings.mjs';
import { createDesktopDateBindings } from '../../pmachines/javascript/src/desktop-date-bindings.mjs';
import { createDesktopIntrinsicBindings } from '../../pmachines/javascript/src/desktop-intrinsic-bindings.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';
import { buildGenericNative } from './build-generic-native.mjs';

const target = process.env.PULSE_COBOL_TEST_NODE;
const cases = [...ncCases, ...functionCases].filter(item => item.validation === 'execution');

test('COBOL nucleus and intrinsic corpus agrees across JavaScript, generic native, and optionally ESP32', {
  timeout: 1800000,
}, async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cobol-differential-'));
  const bindings = { ...createDesktopTextBindings(), ...createDesktopDateBindings(), ...createDesktopIntrinsicBindings() };
  try {
    const executable = path.join(directory, 'reference.exe');
    buildGenericNative(fileURLToPath(new URL('./cobol-differential-native.cpp', import.meta.url)), executable);
    if (target) {
      for (const route of ['/pmachine/status', '/pmachine/service_host/status']) {
        const response = await requestEsp32(new URL(route, target), { timeoutMs: 15000 });
        assert.equal(response.status, 200);
        assert.equal(JSON.parse(await response.text()).running, false);
      }
    }
    for (const item of cases) {
      const artifact = compileTandemCobol85ToPcode(item.source, { copybooks: item.copybooks || {} });
      const expected = await executeProgram({
        instructions: parsePcode(artifact.pcodeText), programMap: artifact.programMap,
        inputQueue: '', sourceMessage: item.input || '',
        runtimeContext: { callHost: (name, args) => {
          assert.equal(typeof bindings[name], 'function', name);
          return bindings[name](...args);
        } },
      });
      assert.equal(expected.error, null, item.id);
      assert.deepEqual(expected.stdout, item.expected, item.id);
      const pcodeFile = path.join(directory, 'fixture.pcode');
      const mapFile = path.join(directory, 'fixture.json');
      await writeFile(pcodeFile, artifact.pcodeText);
      await writeFile(mapFile, JSON.stringify({ ...artifact.programMap, __testInput: item.input || '' }));
      const run = spawnSync(executable, [pcodeFile, mapFile], { encoding: 'utf8', windowsHide: true });
      assert.ifError(run.error);
      assert.equal(run.status, 0, run.stdout + run.stderr);
      const native = JSON.parse(run.stdout);
      assert.equal(native.error, null, `${item.id}: ${native.error}`);
      assert.deepEqual(native.stdout, item.expected, item.id);
      if (target) {
        const pcode = artifact.pcodeText;
        const response = await requestEsp32(new URL('/pmachine/execute_json', target), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, timeoutMs: 25000,
          body: JSON.stringify({
            pcode, programMap: attachPcodeSignature(artifact.programMap, pcode),
            inputQueue: 'generic.cobol.conformance', message: item.input || '', stdin: '',
          }),
        });
        const text = await response.text();
        assert.equal(response.status, 200, text);
        const actual = JSON.parse(text);
        assert.equal(actual.ok, true, `${item.id}: ${text}`);
        assert.ok(actual.instructionCount > 1, 'Must exercise generic dispatch');
        assert.deepEqual(actual.stdout, item.expected, item.id);
      }
      console.log(`PASS ${item.id} JS/generic native${target ? '/ESP32' : ''}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
