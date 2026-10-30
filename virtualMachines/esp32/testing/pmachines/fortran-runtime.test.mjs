import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parseFortran } from '../../../../languages/mnf/src/parse.mjs';
import { formatSpecificationText } from '../../../../languages/mnf/src/format-spec.mjs';
import { render, walk } from '../../../../languages/mnf/runtime/fortran-library.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

async function compareFormats(executable) {
  const cases = [];
  const add = (format, items) => cases.push({ format, items });
  const corpus = path.resolve(root, '..', '..', 'languages', 'mnf', 'validation', 'corpus');
  const formats = new Map();
  for (const name of (await readdir(corpus)).filter(name => /\.f$/i.test(name))) {
    const ast = parseFortran(await readFile(path.join(corpus, name), 'utf8'), { fileName: name });
    for (const unit of ast.units) for (const statement of unit.body) if (statement.kind === 'format') {
      formats.set(formatSpecificationText(statement.spec), statement.spec);
    }
  }
  for (const [format, spec] of formats) {
    const lastGroup = [...spec].reverse().find(item => item.t === 'group');
    const edits = [...walk(spec), ...walk(lastGroup ? spec.slice(spec.indexOf(lastGroup)) : spec)]
      .filter(edit => 'IFEDGLA'.includes(edit.t));
    add(format, edits.map((edit, index) => {
      if (edit.t === 'I') return { tag: 'I', value: [0, 42, -7][index % 3] };
      if (edit.t === 'A') return { tag: 'C', value: 'TEXT' };
      if (edit.t === 'L') return { tag: 'L', value: index % 2 };
      return { tag: 'R', value: { real: Math.fround([0, .25, 1.25, -2.5, 250, 1e9][index % 6]) } };
    }));
  }
  for (const kind of ['F8.1', 'F9.2', 'E14.5', 'D14.5', 'G14.5', 'E14.5E3']) {
    for (const value of [0, -0, .1, .25, 1.25, 1.15, 9.95, 250, -1.25, 1e-20, 1e20]) {
      for (const tag of ['R', 'D']) add(`(${kind})`, [{ tag, value: { real: tag === 'R' ? Math.fround(value) : value } }]);
    }
  }
  for (const scale of [-3, -1, 0, 1, 2, 4]) add(`(${scale}P,3E16.5)`, [0, .125, -125].map(real => ({ tag: 'D', value: { real } })));
  add('(SP,I4.0,SS,I4.3)', [{ tag: 'I', value: 0 }, { tag: 'I', value: -7 }]);
  add('("A""B",T8,A,TL2,A,TR1,3HXYZ,/,:)', [{ tag: 'C', value: 'abcd' }, { tag: 'C', value: 'Q' }]);
  add('(2F8.2)', [{ tag: 'Z', value: [{ real: 1.25 }, { real: -2.5 }] }]);
  add('*', [{ tag: 'C', value: 'a'.repeat(100) }, ...[.25, 250, 1e9].map(real => ({ tag: 'R', value: { real } }))]);
  add('*', [{ tag: 'D', value: { real: 1.0000000000000002 } }, { tag: 'Z', value: [{ real: 1 }, { real: 2 }] }]);
  for (const tag of ['R', 'D']) add('*', [.1, -.2, .3, 10, 1000000, 1e-8, 1e15, 1e16, 1e23, 1.2345678901234567]
    .map(real => ({ tag, value: { real: tag === 'R' ? Math.fround(real) : real } })));
  for (const format of ['(I0)', '(I2.3)', '(F4)', '(Q3)', '(0I3)', '(A)', '(2X)']) add(format, [{ tag: 'I', value: 42 }]);
  const hex = text => Buffer.from(text).toString('hex');
  const input = cases.map(({ format, items }) => [
    hex(format), items.length,
    ...items.map(({ tag, value }) => `${tag} ${tag === 'C' ? hex(value) : tag === 'Z' ? value.map(part => part.real).join(' ') : value?.real ?? value}`),
  ].join('\n')).join('\n') + '\n';
  const probe = spawnSync(executable, ['--probe'], { input, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  assert.ifError(probe.error);
  assert.equal(probe.status, 0, probe.stderr);
  const outputs = probe.stdout.split('END\r\n').join('END\n').split('END\n');
  assert.equal(outputs.pop(), '');
  assert.equal(outputs.length, cases.length);
  cases.forEach(({ format, items }, index) => {
    let expected;
    try { expected = render(format, items); }
    catch { assert.match(outputs[index], /^ERR /, format); return; }
    const actual = outputs[index].split(/\r?\n/).filter(Boolean).map(line => {
      assert.match(line, /^ROW /, `${format}: ${Buffer.from(line.slice(4), 'hex')}`);
      return Buffer.from(line.slice(4), 'hex').toString();
    });
    assert.deepEqual(actual, expected, `${format} ${JSON.stringify(items)}`);
  });
  console.log(`Compared ${cases.length} firmware FORMAT outputs against JS, including ${formats.size} distinct corpus formats.`);
}

test('Arduino FORTRAN RTL numeric, FORMAT input/output and bounded storage agree with JS', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pulse-fortran-cpp-'));
  try {
    for (const [name, sources] of [
      ['fortran', ['testing/pmachines/fortran-runtime.test.cpp', 'pmachines/arduino/src/fortran_runtime.cpp']],
      ['objects', ['testing/pmachines/managed-objects.test.cpp']],
      ['format', ['testing/pmachines/fortran-format.test.cpp', 'pmachines/arduino/src/fortran_format.cpp', 'pmachines/arduino/src/fortran_files.cpp', 'pmachines/arduino/src/fortran_runtime.cpp']],
      ['files', ['testing/pmachines/fortran-files.test.cpp', 'pmachines/arduino/src/fortran_format.cpp', 'pmachines/arduino/src/fortran_files.cpp', 'pmachines/arduino/src/fortran_runtime.cpp']],
    ]) {
      const executable = path.join(directory, `${name}${process.platform === 'win32' ? '.exe' : ''}`);
      const compiled = spawnSync(process.env.CXX || 'g++', [
        '-std=c++17', '-Wall', '-Wextra', '-Werror', ...sources.map(source => path.resolve(root, source)), '-o', executable,
      ], { encoding: 'utf8', windowsHide: true });
      assert.ifError(compiled.error);
      assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
      const result = spawnSync(executable, [], { encoding: 'utf8', windowsHide: true });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      if (name === 'format') await compareFormats(executable);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
