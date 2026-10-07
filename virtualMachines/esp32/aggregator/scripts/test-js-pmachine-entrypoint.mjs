import assert from 'node:assert/strict';
import * as legacy from './run-js-pmachine.mjs';
import * as runtime from '../../pmachines/javascript/src/runtime.mjs';
import * as publicApi from '../../pmachines/javascript/index.mjs';

for (const name of [
  'executeProgram',
  'parsePcode',
  'parseProgramMapMappings',
  'runCli',
  'runSingleMessageForEvolution'
]) {
  assert.equal(typeof legacy[name], 'function', `${name} remains exported`);
  assert.equal(legacy[name], runtime[name], `${name} uses the canonical runtime`);
  assert.equal(publicApi[name], runtime[name], `${name} uses the public package API`);
}

console.log('[js-pmachine-entrypoint] PASS: legacy and public APIs share the canonical runtime');
