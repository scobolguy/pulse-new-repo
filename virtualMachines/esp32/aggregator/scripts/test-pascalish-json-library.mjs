import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';

const source = `
use "JSON";
service 'json-library-test';
var document: JSONDocument;
post '/roundtrip';
begin
  document.load(host.event_body());
  if not JSON_ContainsEncodedToken(document.value('tokens'), document.text('token')) then
    return '{"error":"token missing"}';
  document.setText('name', document.pathText('meta.name'));
  document.setInteger('rank', document.pathInteger('meta.rank'));
  document.setBoolean('enabled', true);
  document.embed('embedded', document.value('payload'));
  document.appendText('items', 'tail');
  document.merge('{"merged":true}');
  return document.serialize()
end
end.`;

const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true });
assert.deepEqual(compiled.programMap.libraries, ['JSON']);

const host = await createPascalishServiceHost({
  compiled,
  collectorId: 'json-library-test',
  httpPort: null,
  udpPort: null,
  logger: { warn() {}, error() {} },
});

try {
  await host.start();
  const response = await host.dispatch({
    method: 'POST',
    path: '/roundtrip',
    body: JSON.stringify({
      tokens: ['YWxsb3dlZA=='],
      token: 'YWxsb3dlZA==',
      meta: { name: 'nested value', rank: 7 },
      payload: { id: 'nested-object' },
      items: ['first'],
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    tokens: ['YWxsb3dlZA=='],
    token: 'YWxsb3dlZA==',
    meta: { name: 'nested value', rank: 7 },
    payload: { id: 'nested-object' },
    items: ['first', 'tail'],
    name: 'nested value',
    rank: 7,
    enabled: true,
    embedded: { id: 'nested-object' },
    merged: true,
  });

  const missingToken = await host.dispatch({
    method: 'POST',
    path: '/roundtrip',
    body: JSON.stringify({
      tokens: ['YW5vdGhlcg=='],
      token: 'YWxsb3dlZA==',
      meta: { name: 'nested value', rank: 7 },
      payload: {},
      items: [],
    }),
  });
  assert.deepEqual(missingToken.body, { error: 'token missing' });

  await assert.rejects(
    host.dispatch({ method: 'POST', path: '/roundtrip', body: '{invalid json' }),
    /Invalid JSON/,
  );
  console.log('[pascalish-json-library] PASS: JSON document access and updates execute through the hosted runtime');
} finally {
  await host.stop();
}
