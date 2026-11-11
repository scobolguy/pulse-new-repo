import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { createExecutionTarget, assertExecution } from './execution-targets.mjs';

export async function readFixture(root, fixture) {
  const contents = await readFile(path.join(root, ...fixture.path.split('/')));
  const hash = createHash('sha256').update(contents).digest('hex');
  assert.equal(hash, fixture.sha256, `Fixture ${fixture.path} differs from the pinned upstream revision`);
  return contents.toString('utf8');
}

export function stripDiagnosticMarkers(source) {
  const markers = [];
  let clean = '', position = 0;
  const markerPattern = /<!([^>]*?)!>|<!>/g;
  for (const match of source.matchAll(markerPattern)) {
    clean += source.slice(position, match.index);
    if (match[1]) {
      markers.push({ names: match[1].split(',').map(name => name.trim()), line: clean.split('\n').length });
    }
    position = match.index + match[0].length;
  }
  return { source: clean + source.slice(position), markers };
}

export function normalizeFixtureSource(source) {
  return source.split(/\r?\n/)
    .filter(line => !/^\s*\/\/\s*(?:FILE|MODULE):/.test(line))
    .join('\n');
}

export async function runFixture(root, fixture, executionTarget) {
  const original = normalizeFixtureSource(await readFixture(root, fixture));
  if (fixture.kind === 'diagnostic') {
    const { source, markers } = stripDiagnosticMarkers(original);
    const expected = markers.find(marker => marker.names.includes('VAL_REASSIGNMENT'));
    assert.ok(expected, `${fixture.path}: missing VAL_REASSIGNMENT marker`);
    let error;
    try {
      compileKotlinToPcode(`${source}\nfun main() {}\n`, { fileName: fixture.path });
    } catch (caught) {
      error = caught;
    }
    assert.ok(error instanceof Error, `${fixture.path}: compiler accepted invalid source`);
    assert.ok(/Val '[^']+' cannot be reassigned/.test(error.message),
      `${fixture.path}: expected VAL_REASSIGNMENT, got ${error.message}`);
    assert.ok(error.message.includes(`${fixture.path}:${expected.line}:`),
      `${fixture.path}: expected first diagnostic on line ${expected.line}, got ${error.message}`);
    return;
  }
  const artifact = compileKotlinToPcode(`${original}\nfun main() { println(box()) }\n`, { fileName: fixture.path });
  const executor = executionTarget || await createExecutionTarget('js');
  try {
    assertExecution(await executor.execute(artifact), ['OK'], fixture.path);
  } finally {
    if (!executionTarget) await executor.stop();
  }
}
