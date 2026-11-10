import { upstreamCases } from '../tests/upstream-cases.mjs';
import { runFixture } from '../tests/upstream-runner.mjs';

const root = process.env.KOTLIN_CORPUS_ROOT;
if (!root) throw new Error('Set KOTLIN_CORPUS_ROOT to the pinned compiler/testData directory');
const args = process.argv.slice(2);
if (args.length > 1 || args.length === 1 && args[0] !== '--supported')
  throw new Error('Usage: node scripts/test-upstream.mjs [--supported]');
const supportedOnly = Boolean(args.length);
const cases = upstreamCases.filter(item => supportedOnly
  ? item.status === 'supported' : item.status !== 'blocked');
// --supported runs the certified set; the full audit additionally verifies that
// every classification still holds: supported cases must pass, while rejected
// and failing cases must still not pass (a pass is an upgrade the manifest must
// record). Blocked cases need harness features and are skipped by both modes.
let failures = 0, upgrades = 0;
for (const fixture of cases) {
  let error;
  try {
    await runFixture(root, fixture);
  } catch (caught) {
    error = caught;
  }
  if (fixture.status === 'supported') {
    if (error) {
      failures++;
      console.error(`FAIL ${fixture.path}: ${error.message.split('\n')[0]}`);
    } else {
      console.log(`PASS ${fixture.path}`);
    }
  } else if (error) {
    console.log(`EXPECTED-${fixture.status.toUpperCase()} ${fixture.path}`);
  } else {
    upgrades++;
    console.error(`UPGRADE ${fixture.path}: passes but is classified '${fixture.status}'`);
  }
}
const supported = cases.filter(item => item.status === 'supported').length;
console.log(`${supported - failures}/${supported} supported upstream cases passed`
  + (supportedOnly ? '' : `; ${cases.length - supported} known-unsupported cases verified; ${upgrades} upgrades pending`));
if (failures || upgrades) process.exitCode = 1;
