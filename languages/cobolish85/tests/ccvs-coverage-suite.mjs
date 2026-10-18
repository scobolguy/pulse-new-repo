// CCVS-guided coverage suite. The cases in tests/ccvs/ are modelled on the NIST CCVS85
// modules NC, SQ, RL, IX, ST, IC, SM, IF, SG and DB. Each is a self-checking COBOL 85
// program; cases that use features the compiler does not yet implement are expected to fail.
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
import { ncCases } from './ccvs/nucleus.mjs';
import { fileCases } from './ccvs/files.mjs';
import { sortCases } from './ccvs/sort.mjs';
import { icCases } from './ccvs/ic.mjs';
import { smCases } from './ccvs/sm.mjs';
import { functionCases } from './ccvs/functions.mjs';
import { segmentationDebugCases } from './ccvs/segmentation-debug.mjs';

const cases = [...ncCases, ...fileCases, ...sortCases, ...icCases, ...smCases, ...functionCases, ...segmentationDebugCases];
const modules = ['NC', 'SQ', 'RL', 'IX', 'ST', 'IC', 'SM', 'IF', 'SG', 'DB'];
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
  assert.equal(new Set(cases.map(entry => entry.id)).size, cases.length, 'case ids are unique');
  for (const module of modules) {
    assert.ok(cases.some(entry => entry.module === module), `module ${module} has cases`);
  }
  for (const entry of cases) {
    assert.ok(entry.expected.length > 0, `${entry.id} has expected output`);
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

for (const entry of cases) {
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
