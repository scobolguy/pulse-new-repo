import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { createHostCacheStore } from '../../pmachines/javascript/src/host-cache.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';

const source = body => `service 'cache-test';
type SomeItem = record count: integer; label: string; end;
var table: cache of SomeItem; item, copy: SomeItem; result: integer;
get '/api/run'; begin ${body} end end.`;
const compile = body => compilePascalishProgramWithAntlr(source(body), { hostServices: true });
const definition = name => ({ name, capacity: 50, fields: [{ name: '__value', type: 'integer' }] });
const payload = value => JSON.stringify({ __value: value });

test('typed record cache put/get, assignment, direct field access, removal and lifetime', async t => {
  const compiled = compile(`item.count := 42; item.label := 'answer';
    if host.event_query('read') = '' then table.put('key', item, 100);
    copy := table.get('key');
    result := table.get('key').count;
    if host.event_query('remove') = 'yes' then result := table.remove('key');
    return host.json_set(host.json_set('{}', 'count', copy.count), 'label', copy.label);`);
  assert.deepEqual(compiled.programMap.hostCaches[0], {
    name: 'table', capacity: 50, fields: [{ name: 'count', type: 'integer' }, { name: 'label', type: 'string' }]
  });
  assert.deepEqual(compactServiceHostProgramMap(compiled.programMap).hostCaches, compiled.programMap.hostCaches);
  let time = 1000;
  const host = await createPascalishServiceHost({ compiled, collectorId: 'cache-test', httpPort: null, udpPort: 0, clock: () => time });
  t.after(() => host.stop());
  await host.start();
  const dispatch = query => host.dispatch({ method: 'GET', path: '/api/run', body: '', query });
  assert.deepEqual((await dispatch({})).body, { count: 42, label: 'answer' });
  time = 1099;
  assert.deepEqual((await dispatch({ read: 'yes' })).body, { count: 42, label: 'answer' });
  time = 1100;
  await assert.rejects(dispatch({ read: 'yes' }), /missing or expired/);
  await dispatch({});
  await dispatch({ read: 'yes', remove: 'yes' });
  await assert.rejects(dispatch({ read: 'yes' }), /missing or expired/);
});

test('compiler rejects malformed cache calls and mismatched types', () => {
  for (const [body, message] of [
    ["table.put('key', item);", /requires 3/],
    ["table.get(42);", /key must be string/],
    ["table.put('key', 'wrong', 10);", /type mismatch/],
    ["table.put('key', item, '10');", /TTL must be integer/],
    ["result := table.get('key');", /type mismatch/],
    ["copy := table.get('key').missing;", /Unknown cache result field/],
    ["table.fetch('key');", /Unknown cache method/],
    ["table['key'] := item;", /not an array|Parse failed/],
    ["table := item;", /cannot be assigned/],
    ["result := table;", /explicit keyed methods/]
  ]) assert.throws(() => compile(body), message, body);
  assert.throws(() => compilePascalishProgramWithAntlr(source('')), /hosted unit variables/);
  assert.throws(() => compilePascalishProgramWithAntlr(source('').replace('cache of SomeItem', 'cache of real'), { hostServices: true }), /support integer/);
  assert.throws(() => compilePascalishProgramWithAntlr(source('').replace('cache of SomeItem', 'cache of array [0..1] of integer'), { hostServices: true }), /support integer/);
});

test('bounded storage evicts least recently observed, not lexicographic, and reads never refresh', () => {
  let time = 10;
  const store = createHostCacheStore([definition('a'), definition('b')], { clock: () => time });
  store.put('a', 'z-first', payload(1), 100);
  for (let i = 0; i < 49; i++) store.put('a', `a-${i}`, payload(i), 100);
  assert.equal(store.get('a', 'z-first'), payload(1));
  store.put('a', 'new', payload(2), 100);
  assert.throws(() => store.get('a', 'z-first'), /missing/);
  assert.equal(store.get('a', 'a-0'), payload(0));
  store.put('a', 'a-0', payload(99), 100);
  store.put('a', 'newer', payload(3), 100);
  assert.throws(() => store.get('a', 'a-1'), /missing/);
  assert.equal(store.get('a', 'a-0'), payload(99));
  store.put('b', 'a-0', payload(7), 1);
  time++;
  assert.throws(() => store.get('b', 'a-0'), /expired/);
  assert.equal(store.get('a', 'a-0'), payload(99));
  assert.equal(store.remove('a', 'a-0'), 1);
  assert.equal(store.remove('a', 'a-0'), 0);
});

test('expired entries reclaimed before live eviction, typed validation and monotonic time', () => {
  let time = 0;
  const store = createHostCacheStore([definition('a')], { clock: () => time });
  store.put('a', 'live-first', payload(1), 100);
  store.put('a', 'expired', payload(2), 1);
  for (let i = 0; i < 48; i++) store.put('a', `k${i}`, payload(i), 100);
  time = 1;
  store.put('a', 'new', payload(3), 100);
  assert.equal(store.get('a', 'live-first'), payload(1));
  for (const ttl of [0, -1, 1.5, 2147483648, '10']) assert.throws(() => store.put('a', 'x', payload(1), ttl), /TTL/);
  for (const key of ['', ' ', 42, 'x'.repeat(257)]) assert.throws(() => store.get('a', key), /key/);
  for (const json of ['{}', 'null', '[]', 'bad', '{"__value":"x"}', '{"__value":1,"extra":2}']) {
    assert.throws(() => store.put('a', 'x', json, 1), /item/);
  }
  assert.throws(() => store.get('unknown', 'x'), /Undeclared/);
  time = 0;
  assert.throws(() => store.get('a', 'live-first'), /clock/);
  store.clear();
  time = 2;
  assert.throws(() => store.get('a', 'live-first'), /missing/);
});

test('scalar and nested boolean records compile and execute with typed values', async t => {
  const compiled = compilePascalishProgramWithAntlr(`service 'nested-cache';
    type Flags = record ready: boolean; end;
    type Item = record flags: Flags; end;
    var numbers: cache of integer; records: cache of Item; item, copy: Item; answer: integer;
    get '/api/run'; begin
      numbers.put('n', 7, 10); answer := numbers.get('n');
      item.flags.ready := true; records.put('r', item, 10);
      copy := records.get('r'); item.flags := records.get('r').flags;
      return host.json_set('{}', 'answer', answer + copy.flags.ready);
    end end.`, { hostServices: true });
  const host = await createPascalishServiceHost({ compiled, collectorId: 'nested', httpPort: null, udpPort: 0, clock: () => 10 });
  t.after(() => host.stop());
  await host.start();
  assert.deepEqual((await host.dispatch({ method: 'GET', path: '/api/run' })).body, { answer: 8 });
});

test('store budgets fail atomically and store instances are isolated', () => {
  const a = createHostCacheStore([definition('a')], { clock: () => 0, maxStorageBytes: 30 });
  const b = createHostCacheStore([definition('a')], { clock: () => 0 });
  a.put('a', 'key', payload(1), 10);
  assert.throws(() => b.get('a', 'key'), /missing/);
  assert.throws(() => a.put('a', 'other', payload(123456789), 10), /capacity/);
  assert.equal(a.get('a', 'key'), payload(1));
  assert.throws(() => a.put('a', 'key', 'x'.repeat(2049), 10), /size/);
});

test('companion daemon cache declarations must match the hosting service', async () => {
  const daemon = compilePascalishProgramWithAntlr(`daemon 'cache-daemon' refresh 10 ms;
    var table: cache of integer; begin end.`, { hostServices: true });
  await assert.rejects(createPascalishServiceHost({
    compiled: compile(''), daemons: [daemon], collectorId: 'test', httpPort: null, udpPort: 0
  }), /Daemon cache declaration must match/);
});

test('hardware fixture fits the signed image limit and verifies all 50 typed records on JS', async t => {
  const compiled = compilePascalishProgramWithAntlr(
    await fs.readFile(new URL('./fixtures/cache-probe.pas', import.meta.url), 'utf8'),
    { hostServices: true });
  const image = encodeHostedImage(compiled.pcodeText);
  assert.ok(Number.parseInt(image.slice(4, 12), 16) <= 512);
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'cache-probe', httpPort: null, udpPort: 0
  });
  t.after(() => host.stop());
  await host.start();
  const result = await host.dispatch({ method: 'POST', path: '/api/cache-probe/seed', body: '{}' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { sum: 1225 });
});
