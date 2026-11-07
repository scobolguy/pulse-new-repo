import test from 'node:test';
import assert from 'node:assert/strict';
import { upstreamCases } from './upstream-cases.mjs';
import { runFixture, stripDiagnosticMarkers } from './upstream-runner.mjs';

test('upstream diagnostic markers retain source lines and names', () => {
  const result = stripDiagnosticMarkers('first\n<!VAL_REASSIGNMENT, OTHER!>value<!> = 1\n');
  assert.equal(result.source, 'first\nvalue = 1\n');
  assert.deepEqual(result.markers, [{ names: ['VAL_REASSIGNMENT', 'OTHER'], line: 2 }]);
});

const root = process.env.KOTLIN_CORPUS_ROOT;
if (!root) {
  test('JetBrains Kotlin corpus (set KOTLIN_CORPUS_ROOT to run)', { skip: true }, () => {});
} else {
  for (const fixture of upstreamCases.filter(item => item.status === 'supported')) {
    test(`JetBrains Kotlin ${fixture.path}`, () => runFixture(root, fixture));
  }
}
