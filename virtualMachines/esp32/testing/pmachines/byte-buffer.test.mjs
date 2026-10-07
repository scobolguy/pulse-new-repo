import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createByteBufferBindings } from '../../pmachines/javascript/src/byte-buffer.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';

test('bounded byte buffer appends bytes and consumes conversions without stale handles', () => {
  const b = createByteBufferBindings();
  const create = b['host.buffer_create'], append = b['host.buffer_append'];
  const handle = create(4096);
  assert.throws(() => create(1), /active/);
  assert.throws(() => append(handle, 256), /integer/);
  assert.throws(() => append(handle + 1, 1), /handle/);
  for (let i = 0; i < 4096; i++) assert.equal(append(handle, i & 255), handle);
  assert.throws(() => append(handle, 0), /capacity/);
  assert.equal(b['host.buffer_hex'](handle), Buffer.from(Array.from({ length: 4096 }, (_, i) => i & 255)).toString('hex'));
  assert.throws(() => append(handle, 0), /handle/);
  const next = create(5);
  assert.notEqual(next, handle);
  for (const byte of Buffer.from('café')) append(next, byte);
  assert.equal(b['host.buffer_text'](next), 'café');
});

test('Pascalish byte-buffer handles are reclaimed after failed and successful invocations', async t => {
  const compiled = compilePascalishProgramWithAntlr(`service 'buffer-test';
function build(): string;
var handle: integer;
begin
  handle := host.buffer_create(1);
  handle := host.buffer_append(handle, 65);
  if host.event_query('overflow') = 'yes' then
    handle := host.buffer_append(handle, 66);
  return host.buffer_text(handle)
end;
get '/buffer';
begin
  return host.json_set('{}', 'value', build())
end
end.`, { hostServices: true });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'buffer-test', httpPort: null, udpPort: 0,
    logger: { warn() {}, error() {} }
  });
  await host.start();
  t.after(() => host.stop());
  await assert.rejects(
    host.dispatch({ method: 'GET', path: '/buffer', query: { overflow: 'yes' } }),
    /capacity exceeded/);
  for (let index = 0; index < 3; index++) {
    const good = await host.dispatch({ method: 'GET', path: '/buffer', query: {} });
    assert.equal(good.status, 200);
    assert.deepEqual(good.body, { value: 'A' });
  }
});

test('byte buffer text is UTF-8, preserves NUL/BOM and rejects invalid encoding', () => {
  const b = createByteBufferBindings();
  const bytes = Buffer.from('\uFEFFcafé\u0000');
  const h = b['host.buffer_create'](bytes.length);
  for (const byte of bytes) b['host.buffer_append'](h, byte);
  assert.equal(b['host.buffer_text'](h), '\uFEFFcafé\u0000');
  const bad = b['host.buffer_create'](1);
  b['host.buffer_append'](bad, 255);
  assert.throws(() => b['host.buffer_text'](bad), /encoded data/);
  b['host.buffer_release'](bad);
  const empty = b['host.buffer_create'](0);
  assert.equal(b['host.buffer_text'](empty), '');
  for (const value of [-1, 4097, 1.5, NaN]) assert.throws(() => b['host.buffer_create'](value), /integer/);
});

test('in-place buffer access is bounded and preserves consuming conversions', () => {
  const b = createByteBufferBindings(), h = b['host.buffer_create'](3);
  for (const byte of [65, 66, 67]) b['host.buffer_append'](h, byte);
  assert.equal(b['host.buffer_length'](h), 3);
  assert.equal(b['host.buffer_get'](h, 1), 66);
  assert.equal(b['host.buffer_set'](h, 1, 90), h);
  for (const index of [-1, 3, 1.5]) {
    assert.throws(() => b['host.buffer_get'](h, index));
    assert.throws(() => b['host.buffer_set'](h, index, 1));
  }
  assert.throws(() => b['host.buffer_set'](h, 0, 256));
  assert.equal(b['host.buffer_text'](h), 'AZC');
  assert.throws(() => b['host.buffer_length'](h), /handle/);
});

test('typed buffer JSON paths retain the handle, reject bad paths/types and release on failure', async t => {
  const json = JSON.stringify({ ignored: 'x'.repeat(1800), system: { info: { code: 7, name: 'café' } } });
  const compiled = compilePascalishProgramWithAntlr(`service 'buffer-json-test';
var handle: integer; index: integer; bytes: string; name: string; code: integer;
get '/buffer-json';
begin
  bytes := host.bytes_from_text('${json}');
  handle := host.buffer_create(host.bytes_length(bytes));
  index := 0;
  while index < host.bytes_length(bytes) do
  begin
    handle := host.buffer_append(handle, host.bytes_get(bytes, index));
    index := index + 1
  end;
  if host.event_query('bad') = 'type' then host.buffer_json_path_integer(handle, 'system.info.name');
  if host.event_query('bad') = 'path' then host.buffer_json_path_text(handle, 'system..info.name');
  if host.event_query('bad') = 'missing' then host.buffer_json_path_text(handle, 'system.info.missing');
  if host.event_query('bad') = 'handle' then host.buffer_json_path_text('not a handle', 'system.info.name');
  name := host.buffer_json_path_text(handle, 'system.info.name');
  code := host.buffer_json_path_integer(handle, 'system.info.code');
  if host.buffer_length(handle) <> host.bytes_length(bytes) then host.raise_error('Buffer was consumed');
  host.buffer_release(handle);
  if host.event_query('bad') = 'released' then host.buffer_json_path_text(handle, 'system.info.name');
  return host.json_set(host.json_set('{}', 'name', name), 'code', code)
end
end.`, { hostServices: true });
  const host = await createPascalishServiceHost({ compiled, collectorId: 'buffer-json-test',
    httpPort: null, udpPort: 0, logger: { warn() {}, error() {} } });
  await host.start();
  t.after(() => host.stop());
  for (const [bad, error] of [['type', /integer field/], ['path', /JSON path/],
    ['missing', /string field/], ['handle', /expected integer/], ['released', /handle/]]) {
    await assert.rejects(host.dispatch({ method: 'GET', path: '/buffer-json', query: { bad } }), error);
    const good = await host.dispatch({ method: 'GET', path: '/buffer-json', query: {} });
    assert.deepEqual(good.body, { name: 'café', code: 7 });
  }
});
