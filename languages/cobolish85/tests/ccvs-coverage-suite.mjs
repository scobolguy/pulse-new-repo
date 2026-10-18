// CCVS-guided coverage suite. The cases in tests/ccvs/ are modelled on the NIST CCVS85
// language modules. Executable cases must pass real output checks; external-environment
// cases have separately labelled syntax-only tests, not execution passes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { before, after } from 'node:test';
import { test, traceProgram, traceCheck } from './support/trace.mjs';
import { compileTandemCobol85ToPcode } from '../src/compile-tandem-cobol85-to-pcode.mjs';
import { fixedToFree } from '../validation/corpus.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';
import { createDesktopTextBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-text-bindings.mjs';
import { createDesktopDateBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-date-bindings.mjs';
import { createDesktopIntrinsicBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-intrinsic-bindings.mjs';
import { createIsamBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/isam-bindings.mjs';
import { createFilesystemService } from '../../../virtualMachines/esp32/aggregator/filesystem-service.mjs';
import { createFilesystemServiceClient } from '../../../virtualMachines/esp32/aggregator/src/librarian/filesystem-service-client.mjs';
import { ccvsCases, ccvsModules, executableCases } from './ccvs/catalog.mjs';

let filesystemService;
let filesystemClient;
let dataRoot;

before(async () => {
  dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cobol-ccvs-isam-'));
  filesystemService = await createFilesystemService({
    dataRoot, host: '127.0.0.1', httpPort: 0, lifecycleEnv: {},
    logger: { log() {}, warn() {}, error() {} }
  });
  filesystemClient = createFilesystemServiceClient(
    `http://127.0.0.1:${filesystemService.getStatus().httpPort}`, { env: {} }
  );
});

after(async () => {
  await filesystemClient?.stop();
  await filesystemService?.stop();
  if (dataRoot) await fs.rm(dataRoot, { recursive: true, force: true });
});

test('CCVS coverage catalog is well formed', () => {
  assert.equal(new Set(ccvsCases.map(entry => entry.id)).size, ccvsCases.length, 'case ids are unique');
  for (const module of ccvsModules) {
    assert.ok(ccvsCases.some(entry => entry.module === module), `module ${module} has cases`);
  }
  for (const entry of ccvsCases) {
    assert.ok(ccvsModules.includes(entry.module), `${entry.id} belongs to a known corpus module`);
    assert.ok(['execution', 'syntax'].includes(entry.validation), `${entry.id} declares its validation tier`);
    assert.ok(entry.source.length > 0, `${entry.id} has source`);
    if (entry.validation === 'execution') {
      assert.ok(entry.expected.length > 0, `${entry.id} has expected output`);
      assert.deepEqual(entry.requires, [], `${entry.id} is self-contained`);
    } else {
      assert.deepEqual(entry.expected, [], `${entry.id} does not claim executable output validation`);
      assert.ok(entry.requires.length > 0, `${entry.id} documents its external execution requirements`);
    }
    assert.ok(entry.ccvs.length > 0, `${entry.id} cites CCVS programs`);
  }
});

function createBindings(caseId) {
  // COBOL's logical "data" grant maps to an isolated namespace on the real server.
  const filePath = (root, relative) => {
    assert.equal(root, 'data', 'CCVS file roots must use the data grant');
    return `${caseId}-${relative}`;
  };
  const storage = {
    'host.fs_exists': (root, relative, context) => filesystemClient.exists('isam', filePath(root, relative), context),
    'host.fs_read_text': (root, relative, context) => filesystemClient.readText('isam', filePath(root, relative), context),
    'host.fs_write_text': (root, relative, contents, context) =>
      filesystemClient.writeText('isam', filePath(root, relative), contents, context)
  };
  return {
    ...createDesktopTextBindings(), ...createDesktopDateBindings(), ...createDesktopIntrinsicBindings(),
    ...storage, ...createIsamBindings(storage)
  };
}

for (const entry of executableCases) {
  test(`${entry.id} — ${entry.description}`, async () => {
    traceProgram(import.meta.url, entry.source, {
      category: entry.module,
      module: entry.module,
      ccvs: entry.ccvs.join(', ')
    });
    const check = { description: `Program displays a PASS line for each check (${entry.expected.length})`, expected: entry.expected };
    let compiled;
    try {
      const source = entry.format === 'fixed'
        ? fixedToFree(entry.source, { debug: /WITH\s+DEBUGGING\s+MODE/i.test(entry.source) })
        : entry.source;
      compiled = compileTandemCobol85ToPcode(source, { fileName: `${entry.id}.cob`, copybooks: entry.copybooks ?? undefined });
    } catch (error) {
      traceCheck(import.meta.url, { ...check, actual: `Compile error: ${error.message}` });
      assert.fail(`${entry.id}: compile error: ${error.message.replace(/\s*\n\s*/g, ' / ')}`);
    }

    const bindings = createBindings(entry.id);
    const signal = new AbortController().signal;
    const execution = await executeProgram({
      instructions: parsePcode(compiled.pcodeText),
      programMap: compiled.programMap,
      inputQueue: '',
      sourceMessage: entry.input,
      runtimeContext: {
        callHost: (name, args) => {
          if (!bindings[name]) throw new Error(`host binding unavailable: ${name}`);
          return bindings[name](...args, { signal });
        }
      }
    });
    traceCheck(import.meta.url, {
      ...check,
      actual: execution.error ? [...execution.stdout, `Runtime error: ${execution.error}`] : execution.stdout
    });
    assert.equal(execution.error, null, `${entry.id}: runtime error`);
    assert.equal(execution.stepLimitHit, false, `${entry.id}: execution reached the step limit`);
    assert.deepEqual(execution.stdout, entry.expected, `${entry.id}: output differs from expected`);
  });
}
