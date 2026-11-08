import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createCobolHostLibrary } from '../../libraries/cobol/host-library.mjs';
import { createDesktopTextBindings } from '../../pmachines/javascript/src/desktop-text-bindings.mjs';
import { createDesktopIntrinsicBindings } from '../../pmachines/javascript/src/desktop-intrinsic-bindings.mjs';
import { createFilesystemBindings } from '../../pmachines/javascript/src/filesystem-bindings.mjs';

test('COBOL modules load only on demand and retain utility results', async () => {
  const library = createCobolHostLibrary();
  try {
    assert.deepEqual(library.loadedModules(), []);
    const values = await Promise.all([
      library.callHost('host.string_upper', ['Hello']),
      library.callHost('host.string_length', ['Hello']),
    ]);
    assert.deepEqual(values, ['HELLO', 5]);
    assert.deepEqual(library.loadedModules(), ['text']);
    const intrinsic = createDesktopIntrinsicBindings();
    for (const [name, args] of [
      ['host.math_factorial', [5]], ['host.math_numval', ['1.25']],
      ['host.math_integer_of_date', [20200101]], ['host.cobol_ord', ['A']],
    ]) {
      assert.equal(await library.callHost(name, args), intrinsic[name](...args), name);
    }
    assert.equal(await library.callHost('host.string_lower', ['Hello']),
      createDesktopTextBindings()['host.string_lower']('Hello'));
    assert.deepEqual(library.loadedModules(), ['text', 'intrinsic']);
    assert.equal(await library.callHost('host.date_iso', ['0']), '"1970-01-01T00:00:00.000Z"');
    await assert.rejects(library.callHost('host.string_upper', [5]), /Expected string/);
    await assert.rejects(library.callHost('host.isam_count', [1]), /requires granted filesystem/);
    await assert.rejects(library.callHost('host.unknown', []), /unavailable/);
  } finally {
    await library.dispose();
  }
  await assert.rejects(library.callHost('host.string_upper', ['x']), /disposed/);
});

test('lazy ISAM module preserves storage grants, records and lock disposal', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cobol-library-isam-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filesystem = await createFilesystemBindings({ data: { path: directory, readOnly: false } });
  const first = createCobolHostLibrary(filesystem.handlers);
  const second = createCobolHostLibrary(filesystem.handlers);
  try {
    assert.deepEqual(first.loadedModules(), []);
    const handle = await first.callHost('host.isam_open', ['data', 'records.json', 'id', 'OUTPUT']);
    assert.ok(handle > 0);
    assert.deepEqual(first.loadedModules(), ['isam']);
    assert.equal(await first.callHost('host.isam_write', [handle, '1', 'record one']), 0);
    assert.equal(await first.callHost('host.isam_count', [handle]), 1);
    assert.equal(await first.callHost('host.isam_close', [handle]), 0);
    const reading = await first.callHost('host.isam_open', ['data', 'records.json', 'id', 'I-O']);
    assert.equal(await first.callHost('host.isam_read', [reading, '1']), 'record one');
    await first.dispose();
    const reopened = await second.callHost('host.isam_open', ['data', 'records.json', 'id', 'I-O']);
    assert.ok(reopened > 0);
    assert.equal(await second.callHost('host.isam_read', [reopened, '1']), 'record one');
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(second.callHost('host.isam_count', [reopened], { signal: abort.signal }), /abort/i);
    await assert.rejects(second.callHost('host.isam_open', ['data', '..\\escape', 'id', 'I-O']), /invalid/);
  } finally {
    await first.dispose();
    await second.dispose();
  }
});

test('disposing during module loading rejects the call without creating a usable owner', async () => {
  const library = createCobolHostLibrary();
  const call = library.callHost('host.string_upper', ['Hello']);
  const stopped = library.dispose();
  await assert.rejects(call, /disposed/);
  await stopped;
  assert.deepEqual(library.loadedModules(), []);
});

test('native core links and executes without optional COBOL host utilities', { timeout: 7200000 }, async t => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cobol-library-native-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sizes = [];
  for (const enabled of [0, 1]) {
    const executable = path.join(directory, `host-${enabled}.exe`);
    buildGenericNative(path.join(root, 'testing', 'pmachines', 'cobol-host-library.test.cpp'),
      executable, { hostLibrary: Boolean(enabled) });
    const run = spawnSync(executable, [], { encoding: 'utf8', windowsHide: true });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    sizes.push((await stat(executable)).size);
  }
  assert.ok(sizes[0] < sizes[1], `Core-only binary (${sizes[0]}) must be smaller than utility build (${sizes[1]})`);
  t.diagnostic(`Native core-only executable: ${sizes[0]} bytes; with host utilities: ${sizes[1]} bytes (not ESP32 flash measurements).`);
});
import { buildGenericNative } from './build-generic-native.mjs';
