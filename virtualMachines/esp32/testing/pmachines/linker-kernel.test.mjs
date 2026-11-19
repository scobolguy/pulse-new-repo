import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { canonicalImageBytes, imageContentHash, ImageKernelContext } from '../../pmachines/javascript/src/image-kernel.mjs';
import { counterImage } from './linker-kernel-fixture.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const signed = (image = counterImage(), id = image.moduleId) => {
  const result = structuredClone(image);
  result.moduleId = id;
  result.contentHash = imageContentHash(result);
  return result;
};
const install = (task, image, slot = 7, entry = 0, arity = 1) => {
  const handle = task.stage(image);
  task.bind(handle, slot, entry, arity);
  task.commit(handle);
  return handle;
};
const textImage = () => signed({
  ...counterImage(), moduleId: 'utf8',
  instructions: [
    { op: 'PUSH_STR', operand: 'é🧪\0\x01', target: 0, argCount: 0 },
    { op: 'RET', operand: '', target: 0, argCount: 0 },
  ], entries: [{ entry: 0, params: [], returnsValue: true }], globals: [],
});

test('checked images execute entry zero, numeric CALLs, pinned slots and task-local globals in the JS engine', async () => {
  const task = new ImageKernelContext(), other = new ImageKernelContext();
  const image = signed();
  const stage = task.stage(image);
  task.bind(stage, 7, 0, 1);
  assert.throws(() => task.call(7, [20]), /Unpublished/);
  assert.throws(() => task.stage(image), /already staged/);
  task.commit(stage);
  assert.throws(() => task.commit(stage), /stage/);
  image.instructions[1].operand = '99';
  assert.equal(await task.call(7, [20]), 41);
  assert.equal(await task.call(7, [20]), 42);
  await assert.rejects(task.call(7, []), /arity/);
  await assert.rejects(task.call(7, [Number.MAX_SAFE_INTEGER]), /scalar/);
  install(other, signed());
  assert.equal(await other.call(7, [20]), 41);
  assert.throws(() => task.bind(other.stage(signed(counterImage(), 'foreign')), 8, 0, 1), /stage/);
  assert.throws(() => task.stage(signed(counterImage(), 'counter@exact-content')), /already staged/);
  const conflict = signed();
  conflict.instructions[1].operand = '3';
  conflict.contentHash = imageContentHash(conflict);
  assert.throws(() => task.stage(conflict), /Conflicting/);
  const active = task.call(7, [20]);
  assert.throws(() => task.release(), /active/);
  await assert.rejects(task.call(7, [20]), /active/);
  await active;
  task.release();
  assert.throws(() => task.call(7, [20]), /released/);
  assert.throws(() => task.stage(signed()), /released/);
});

test('commit publishes all or none and abort releases reservations; initialization remains caller policy', async () => {
  const task = new ImageKernelContext();
  const first = task.stage(signed(counterImage(), 'one'));
  const second = task.stage(signed(counterImage(), 'two'));
  task.bind(first, 7, 0, 1);
  task.bind(second, 7, 0, 1);
  task.bind(second, 8, 0, 1);
  task.commit(first);
  assert.throws(() => task.commit(second), /owned/);
  assert.throws(() => task.call(8, [20]), /Unpublished/);
  task.abort(second);
  assert.throws(() => task.abort(second), /stage/);
  const failing = signed({
    ...counterImage(), moduleId: 'failed-initialization',
    instructions: [{ op: 'JMP', operand: '', target: 0, argCount: 0 }],
    entries: [{ entry: 0, params: [], returnsValue: true }], globals: [],
  });
  const initializer = task.stage(failing);
  task.bind(initializer, 8, 0, 0);
  await assert.rejects(task.callStaged(initializer, 0, [], { maxSteps: 10 }), /step limit/);
  task.abort(initializer);
  assert.throws(() => task.call(8), /Unpublished/);
});

test('bounds, identity, ABI, arity, integer overflow and aggregate resource checks fail closed', () => {
  const changes = [
    image => { image.instructions[5].target = 0xffffffff; },
    image => { image.instructions[5].target = 0x100000000; },
    image => { image.instructions[5].argCount = 2; },
    image => { image.instructions[0].op = 'CALL_EXT'; },
    image => { image.instructions[1].operand = '2147483648'; },
    image => { image.instructions[1].operand = '+1'; },
    image => { image.instructions[0].target = 1; },
    image => { image.instructions[5].operand = 'unresolvedLabel'; },
    image => { image.entries.push(image.entries[0]); },
    image => { image.abi = 'unknown'; },
  ];
  for (const change of changes) {
    const image = counterImage();
    change(image);
    assert.throws(() => new ImageKernelContext().stage(signed(image)));
  }
  const corrupt = signed();
  corrupt.instructions[1].operand = '2';
  assert.throws(() => new ImageKernelContext().stage(corrupt), /Corrupt/);
  for (const limits of [{ maxInstructions: 1 }, { maxImageBytes: 10 }, { maxGlobals: 0 },
    { maxModules: 0 }, { maxArity: 0 }])
    assert.throws(() => new ImageKernelContext(limits).stage(signed()), /limit/);
  const task = new ImageKernelContext({ maxInstructions: counterImage().instructions.length, maxSlots: 1 });
  const handle = task.stage(signed());
  assert.throws(() => task.bind(handle, 1, 0, 1), /bounds/);
  assert.throws(() => task.bind(handle, 0, 0, 0), /arity/);
  assert.throws(() => task.stage(signed(counterImage(), 'extra')), /resource/);
  task.abort(handle);
  task.abort(task.stage(signed()));
});

test('wide record offsets and decoded UTF-8/control strings execute without a text loader', async () => {
  const task = new ImageKernelContext();
  const image = signed({
    ...counterImage(), moduleId: 'wide',
    instructions: [
      ...Array.from({ length: 65536 }, () => ({ op: 'NOP', operand: '', target: 0, argCount: 0 })),
      { op: 'PUSH_INT', operand: '17', target: 0, argCount: 0 },
      { op: 'RET', operand: '', target: 0, argCount: 0 },
    ], entries: [{ entry: 65536, params: [], returnsValue: true }], globals: [],
  });
  install(task, image, 0, 65536, 0);
  assert.equal(await task.call(0), 17);
  install(task, textImage(), 1, 0, 0);
  assert.equal(await task.call(1), 'é🧪\0\x01');
});

test('same canonical fixture executes through shared C++ native/Arduino kernel and native VM', { timeout: 180000 }, async () => {
  const build = path.join(root, '.linker-kernel-build');
  await mkdir(build, { recursive: true });
  try {
    const executable = path.join(build, process.platform === 'win32' ? 'linker-kernel.exe' : 'linker-kernel');
    const source = path.join(root, 'virtualMachines', 'esp32', 'testing', 'pmachines', 'linker-kernel.test.cpp');
    const native = path.join(root, 'virtualMachines', 'esp32', 'pmachines', 'native', 'src', 'native_service.cpp');
    const arduino = path.join(root, 'virtualMachines', 'esp32', 'pmachines', 'arduino', 'src', 'pmachine_dynamic_library.cpp');
    const built = spawnSync(process.env.CXX || 'g++', ['-std=c++17', '-O0', '-Wall', '-Wextra', source, native,
      arduino, '-o', executable, ...(process.platform === 'win32' ? ['-lws2_32'] : [])],
    { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(built.status, 0, `${built.error || ''}\n${built.stdout}\n${built.stderr}`);
    const image = signed();
    const result = spawnSync(executable, [image.contentHash], {
      input: canonicalImageBytes(image), encoding: 'utf8', cwd: root, windowsHide: true,
    });
    assert.equal(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), ['41,42,41', textImage().contentHash]);
    const size = await stat(executable);
    console.log(`C++ kernel/native-engine test executable: ${size.size} bytes (unstripped -O0; not firmware flash)`);
  } finally { await rm(build, { recursive: true, force: true }); }
});
