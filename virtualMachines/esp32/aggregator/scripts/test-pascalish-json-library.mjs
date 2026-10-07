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
  document.setBoolean('disabled', false);
  document.embed('embedded', document.value('payload'));
  document.appendText('items', 'tail');
  document.merge('{"merged":true}');
  return document.serialize()
end
post '/read-integer';
begin
  document.load(host.event_body());
  document.setInteger('copy', document.intValue('number'));
  return document.serialize()
end
post '/invalid-embed';
begin
  document.load('{}');
  document.embed('value', host.event_body());
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
      meta: { name: 'Unicode \u540d \ud83d\ude00, quote ", slash \\, newline \n', rank: 7 },
      payload: { id: 'nested-object' },
      items: ['first'],
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    tokens: ['YWxsb3dlZA=='],
    token: 'YWxsb3dlZA==',
    meta: { name: 'Unicode \u540d \ud83d\ude00, quote ", slash \\, newline \n', rank: 7 },
    payload: { id: 'nested-object' },
    items: ['first', 'tail'],
    name: 'Unicode \u540d \ud83d\ude00, quote ", slash \\, newline \n',
    rank: 7,
    enabled: true,
    disabled: false,
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
  for (const body of ['null', '[]', 'true', '17', '"text"']) {
    await assert.rejects(
      host.dispatch({ method: 'POST', path: '/roundtrip', body }),
      /Expected a JSON object/,
    );
  }
  const validInput = {
    tokens: ['YWxsb3dlZA=='],
    token: 'YWxsb3dlZA==',
    meta: { name: 'nested value', rank: 7 },
    payload: {},
    items: [],
  };
  const invalidInputs = [
    { body: { ...validInput, token: 42 }, error: /Expected string field/ },
    { body: { ...validInput, meta: { rank: 7 } }, error: /Expected string field/ },
    { body: { ...validInput, payload: undefined }, error: /Missing JSON field/ },
    { body: { ...validInput, meta: { name: 'value', rank: 1.5 } }, error: /Expected integer field/ },
    { body: { ...validInput, meta: { name: 'value', rank: 2147483648 } }, error: /Expected integer field/ },
    { body: { ...validInput, meta: [] }, error: /Expected JSON path object/ },
    { body: { ...validInput, items: {} }, error: /Expected array field/ },
  ];
  for (const { body, error } of invalidInputs) {
    await assert.rejects(
      host.dispatch({ method: 'POST', path: '/roundtrip', body: JSON.stringify(body) }),
      error,
    );
  }
  for (const number of [-2147483648, 0, 2147483647]) {
    const result = await host.dispatch({
      method: 'POST', path: '/read-integer', body: JSON.stringify({ number }),
    });
    assert.deepEqual(result.body, { number, copy: number });
  }
  for (const number of [2147483648, -2147483649, 1.5, '7', null]) {
    await assert.rejects(
      host.dispatch({ method: 'POST', path: '/read-integer', body: JSON.stringify({ number }) }),
      /Invalid integer field/,
    );
  }
  await assert.rejects(
    host.dispatch({ method: 'POST', path: '/read-integer', body: '{}' }),
    /Invalid integer field/,
  );
  await assert.rejects(
    host.dispatch({ method: 'POST', path: '/invalid-embed', body: '{invalid JSON' }),
    /Invalid embedded JSON/,
  );
  // Rejection must not poison the host's event queue or leave stale document state.
  const recovered = await host.dispatch({
    method: 'POST', path: '/read-integer', body: '{"number":11}',
  });
  assert.deepEqual(recovered.body, { number: 11, copy: 11 });
  console.log('[pascalish-json-library] PASS: JSON access, escaping, booleans, integer bounds, malformed inputs, and recovery');
} finally {
  await host.stop();
}
