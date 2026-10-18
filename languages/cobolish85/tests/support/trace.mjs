import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodeTest from 'node:test';

// When COBOL85_TEST_TRACE names a file, tests append program/expected/actual
// records to it (JSON lines) so scripts/generate-test-report.mjs can render them.
const traceFile = process.env.COBOL85_TEST_TRACE;
const current = new AsyncLocalStorage();

export function test(name, fn) {
  return nodeTest(name, context => current.run({ name }, () => fn(context)));
}

function write(fileUrl, record) {
  if (!traceFile) return;
  const file = path.resolve(fileURLToPath(fileUrl));
  const name = current.getStore()?.name ?? null;
  fs.appendFileSync(traceFile, `${JSON.stringify({ file, test: name, ...record })}\n`);
}

export function traceProgram(fileUrl, source, details = {}) {
  write(fileUrl, { kind: 'program', source, ...details });
}

export function traceCheck(fileUrl, { description, expected, actual, matched }) {
  write(fileUrl, { kind: 'check', description: description ?? null, expected, actual, matched: matched ?? null });
}

export function traceCompileError(fileUrl, compile, source, pattern) {
  traceProgram(fileUrl, source);
  let actual;
  let matched = false;
  try {
    compile(source);
    actual = 'Compiled without error';
  } catch (error) {
    actual = `Compile error: ${error.message}`;
    matched = pattern.test(error.message);
  }
  traceCheck(fileUrl, { description: 'Compiler rejects the program', expected: `Compile error matching ${pattern}`, actual, matched });
}
