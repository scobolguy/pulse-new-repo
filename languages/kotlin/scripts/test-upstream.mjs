import { upstreamCases } from '../tests/upstream-cases.mjs';
import { runFixture } from '../tests/upstream-runner.mjs';

const root = process.env.KOTLIN_CORPUS_ROOT;
if (!root) throw new Error('Set KOTLIN_CORPUS_ROOT to the pinned compiler/testData directory');
const args = process.argv.slice(2);
if (args.length > 1 || args.length === 1 && args[0] !== '--supported')
  throw new Error('Usage: node scripts/test-upstream.mjs [--supported]');
const cases = args.length ? upstreamCases.filter(item => item.status === 'supported') : upstreamCases;
let failures = 0;
for (const fixture of cases) {
  try {
    await runFixture(root, fixture);
    console.log(`PASS ${fixture.path}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${fixture.path}: ${error.message.split('\n')[0]}`);
  }
}
console.log(`${cases.length - failures}/${cases.length} upstream cases passed`);
if (failures) process.exitCode = 1;
