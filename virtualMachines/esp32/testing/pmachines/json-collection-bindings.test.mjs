import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJsonCollectionBindings } from '../../pmachines/javascript/src/json-collection-bindings.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';

const bindings = createJsonCollectionBindings();
test('checked JSON arrays retain scalar types, nested objects, escaping and exact string identities', () => {
  const values = [null, true, 7, '\u540d\ud800', { nested: ['quote"', 'slash\\'] }];
  let raw = JSON.stringify(values);
  assert.equal(bindings['host.json_array_count'](raw), 5);
  for (let index = 0; index < values.length; index++) {
    assert.deepEqual(JSON.parse(bindings['host.json_array_get'](raw, index)), values[index]);
  }
  raw = bindings['host.json_array_append'](raw, '{"added":false}');
  raw = bindings['host.json_array_set'](raw, 1, '"updated"');
  raw = bindings['host.json_array_remove'](raw, 0);
  const expected = ['updated', ...values.slice(2), { added: false }];
  assert.deepEqual(JSON.parse(raw), expected);
  assert.equal(bindings['host.json_format'](raw, 2), JSON.stringify(expected, null, 2));
});

test('invalid JSON, non-arrays and out-of-range indices never silently coerce or mutate', () => {
  for (const value of ['not JSON', 'null', '{}', '"text"', 'true', '7']) {
    assert.throws(() => bindings['host.json_array_count'](value));
  }
  for (const index of [-1, 1, 1.5, '0', NaN]) {
    for (const method of ['get', 'set', 'remove']) {
      assert.throws(() => bindings[`host.json_array_${method}`]('[null]', index, 'true'), /out of bounds/);
    }
  }
  assert.throws(() => bindings['host.json_array_get']('[]', 0), /out of bounds/);
  assert.throws(() => bindings['host.json_array_append']('[]', 'invalid'), /Invalid JSON/);
  assert.throws(() => bindings['host.json_array_set']('[null]', 0, 'invalid'), /Invalid JSON/);
  for (const indent of [-1, 11, 1.5, '2']) assert.throws(() => bindings['host.json_format']('[]', indent), /indentation/);
  assert.equal(bindings['host.json_format']('null', 0), 'null');
});

test('JSONArray class executes in Pascalish and does not change existing JSONDocument portability', async t => {
  const compile = source => compilePascalishProgramWithAntlr(source, { hostServices: true });
  const compiled = compile(`service 'arrays'; use "JSONArrays"; var values: JSONArray;
post '/'; begin
  values.load(host.event_body());
  values.append('{"added":true}');
  values.replace(0, '"updated"');
  values.remove(1);
  if values.count() <> 2 then host.raise_error('Unexpected array length');
  return values.formatted(2)
end end.`);
  assert.deepEqual(compiled.programMap.targets, ['js']);
  assert.throws(() => encodeHostedImage(compiled.pcodeText), /Desktop-only/);
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'arrays', httpPort: null, udpPort: null, logger: { warn() {} }
  });
  t.after(() => host.stop());
  await host.start();
  assert.deepEqual((await host.dispatch({ method: 'POST', path: '/', body: '[1,2]' })).body, ['updated', { added: true }]);
  await assert.rejects(host.dispatch({ method: 'POST', path: '/', body: 'null' }), /Expected a JSON array/);
  assert.deepEqual((await host.dispatch({ method: 'POST', path: '/', body: '[1,2]' })).body, ['updated', { added: true }]);
  const portable = compile(`service 'objects'; use "JSON"; var document: JSONDocument;
get '/'; begin document.load('{}'); return document.serialize() end end.`);
  assert.deepEqual(portable.programMap.targets, ['js', 'esp32']);
  assert.doesNotMatch(portable.pcodeText, /CALL_EXT host\.json_(array_|format)/);
});
