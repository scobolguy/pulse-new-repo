import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';

test('Pascalish service requirements are emitted and survive host-map compaction', async () => {
  const source = await fs.readFile(new URL('../../src/librarian/s3-readonly.pas', import.meta.url), 'utf8');
  const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });

  assert.deepEqual(compiled.programMap.serviceLifecycle, {
    version: 1,
    requires: ['pulse-filesystem']
  });
  assert.deepEqual(
    compactServiceHostProgramMap(compiled.programMap).serviceLifecycle,
    compiled.programMap.serviceLifecycle
  );
});

test('Pascalish rejects duplicate, self, and non-canonical service requirements', () => {
  for (const [source, error] of [
    [`service 'alpha'; requires service 'beta'; requires service 'beta'; end.`, /requires 'beta' more than once/],
    [`service 'alpha'; requires service 'alpha'; end.`, /cannot require itself/],
    [`service 'alpha'; requires service 'filesystem'; end.`, /Invalid required service id/],
    [`program 'alpha'; requires service 'beta'; end.`, /Parse failed|extraneous input/i],
    [`service 'alpha'; requires service ''; end.`, /Invalid required service id/],
    [`service 'alpha'; requires service pulse-filesystem; end.`, /Parse failed|extraneous input/i]
  ]) {
    assert.throws(() => compilePascalishProgramWithAntlr(source, { hostServices: true }), error);
  }
});
