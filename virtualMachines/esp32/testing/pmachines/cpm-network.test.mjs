import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { compilePascalishProgramWithAntlr as compile } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';

const logger = { error() {}, warn() {} };
async function fixture(t, body, { declarations = '', result = 'network.schedule()' } = {}) {
  const compiled = compile(`use "CPMNetwork";
    service 'cpm-test';
    ${declarations}
    var network: CPMNetwork<string>;
    post '/run'; begin ${body.trim() ? `${body.replace(/;\s*$/, '')};` : ''} return ${result} end
    end.`, { hostServices: true });
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'cpm-test', httpPort: null, udpPort: null,
    desktopBudget: true, maxBodyBytes: 65536, logger
  });
  t.after(() => host.stop());
  await host.start();
  return { host, compiled, run: async () => (await host.dispatch({ method: 'POST', path: '/run' })).body };
}

test('generic network schedules a diamond and returns deterministic order, floats and critical path', async t => {
  const f = await fixture(t, `
    network.initialize('project');
    network.addNode('A', 3, 'design', 'project');
    network.addNode('B', 4, 'build', 'project');
    network.addNode('C', 2, 'review', 'project');
    network.addNode('D', 1, 'release', 'project');
    network.addDependency('A', 'B');
    network.addDependency('A', 'C');
    network.addDependency('B', 'D');
    network.addDependency('C', 'D')`);
  const schedule = await f.run();
  assert.equal(schedule.duration, 8);
  const node = id => schedule.nodes.find(node => node.id === id);
  assert.deepEqual([node('C').earliestStart, node('C').earliestFinish, node('C').latestStart, node('C').latestFinish,
    node('C').totalFloat, node('C').freeFloat], [3, 5, 5, 7, 2, 2]);
  assert.deepEqual(schedule.criticalPath, ['@project:entry', 'A', 'B', 'D', '@project:exit']);
  assert.deepEqual(schedule.topologicalOrder, ['@project:entry', 'A', 'B', 'C', 'D', '@project:exit']);
});

test('generic classes specialize scalar and nested record payloads in the same application', async t => {
  const compiled = compile(`use "CPMNetwork";
    service 'typed';
    type Detail = record owner: string; ready: boolean; end;
    type Job = record detail: Detail; cost: integer; end;
    var jobs: CPMNetwork<Job>; counts: CPMNetwork<integer>; labels: CPMNetwork<string>;
        job, copy: Job; item: CPMNode<Job>; answer: integer;
    get '/run'; begin
      jobs.initialize('jobs'); counts.initialize('numbers'); labels.initialize('labels');
      job.detail.owner := 'Alice'; job.detail.ready := true; job.cost := 42;
      jobs.addNode('job', 7, job, 'jobs');
      counts.addNode('number', 5, 17, 'numbers');
      labels.addNode('label', 1, 'payload', 'labels');
      item := jobs.node('job');
      copy := item.payload;
      copy.cost := copy.cost + counts.payload('number');
      jobs.setPayload('job', copy);
      copy := jobs.payload('job');
      return host.json_set(host.json_set(host.json_set('{}', 'owner', copy.detail.owner),
        'cost', copy.cost), 'label', labels.payload('label'))
    end end.`, { hostServices: true });
  const host = await createPascalishServiceHost({ compiled, collectorId: 'typed', httpPort: null, udpPort: null,
    desktopBudget: true, logger });
  t.after(() => host.stop());
  await host.start();
  assert.deepEqual((await host.dispatch({ method: 'GET', path: '/run' })).body, { owner: 'Alice', cost: 59, label: 'payload' });
});

test('expanded nested subnetworks retain explicit milestones and cross-network dependencies', async t => {
  const f = await fixture(t, `
    network.initialize('project');
    network.addSubnetwork('build', 'project');
    network.addSubnetwork('test', 'project');
    network.addSubnetwork('unit', 'test');
    network.addNode('design', 2, 'd', 'project');
    network.addNode('compile', 3, 'c', 'build');
    network.addNode('verify', 4, 'v', 'unit');
    network.addNode('publish', 1, 'p', 'project');
    network.addDependency('design', network.entry('build'));
    network.addDependency(network.exit('build'), network.entry('test'));
    network.addDependency(network.exit('test'), 'publish')`);
  const schedule = await f.run();
  assert.equal(schedule.duration, 10);
  assert.deepEqual(schedule.criticalPath, ['@project:entry', 'design', '@build:entry', 'compile', '@build:exit',
    '@test:entry', '@unit:entry', 'verify', '@unit:exit', '@test:exit', 'publish', '@project:exit']);
  assert.deepEqual(schedule.subnetworks.map(group => [group.id, group.parent, group.earliestStart, group.earliestFinish, group.elapsedDuration]),
    [['project', '', 0, 10, 10], ['build', 'project', 2, 5, 3], ['test', 'project', 5, 9, 4], ['unit', 'test', 5, 9, 4]]);
  const ranks = new Map(schedule.topologicalOrder.map((id, index) => [id, index]));
  for (const edge of schedule.edges) {
    assert.ok(ranks.get(schedule.nodes[edge.from].id) < ranks.get(schedule.nodes[edge.to].id));
  }
});

test('parallel equal-duration branches are all critical and duplicates do not add dependencies', async t => {
  const f = await fixture(t, `
    network.initialize('root');
    network.addNode('A', 5, 'a', 'root');
    network.addNode('B', 5, 'b', 'root');
    network.addNode('C', 0, 'c', 'root');
    network.addDependency('A', 'C');
    network.addDependency('B', 'C');
    network.addDependency('B', 'C')`);
  const schedule = await f.run();
  assert.equal(schedule.duration, 5);
  assert.deepEqual(schedule.criticalNodes, ['@root:entry', '@root:exit', 'A', 'B', 'C']);
  assert.ok(schedule.criticalEdges.some(edge => edge.from === 'A' && edge.to === 'C'));
  assert.ok(schedule.criticalEdges.some(edge => edge.from === 'B' && edge.to === 'C'));
  assert.equal(schedule.edges.length, 9);
  assert.deepEqual(await f.run(), schedule, 'initialize gives an independent repeatable schedule');
});

test('empty subnetworks and zero-duration milestones produce a valid zero-duration schedule', async t => {
  const f = await fixture(t, `network.initialize('root'); network.addSubnetwork('empty', 'root')`);
  const schedule = await f.run();
  assert.equal(schedule.duration, 0);
  assert.equal(schedule.nodes.length, 4);
  assert.equal(schedule.criticalNodes.length, 4);
});

test('cycle detection includes cycles crossing subnetwork boundaries and never returns a partial order', async t => {
  for (const [body, pattern] of [
    [`network.initialize('root'); network.addNode('A', 1, 'a', 'root'); network.addNode('B', 2, 'b', 'root');
      network.addDependency('A', 'B'); network.addDependency('B', 'A')`, /cycle/],
    [`network.initialize('root'); network.addSubnetwork('child', 'root');
      network.addDependency(network.exit('child'), network.entry('child'))`, /cycle/]
  ]) {
    const f = await fixture(t, body);
    await assert.rejects(f.run(), pattern);
  }
});

test('invalid identities, missing nodes/networks, negative durations, capacity and overflow fail explicitly', async t => {
  for (const [body, pattern] of [
    ["network.initialize('');", /identity/],
    ["network.initialize('root'); network.addNode('@reserved', 1, 'a', 'root')", /identity/],
    ["network.initialize('root'); network.addNode('A', -1, 'a', 'root')", /negative/],
    ["network.initialize('root'); network.addNode('A', 2147483648, 'a', 'root')", /32-bit/],
    ["network.initialize('root'); network.addNode('A', 1, 'a', 'missing')", /unknown subnetwork/],
    ["network.initialize('root'); network.addSubnetwork('child', 'missing')", /unknown subnetwork/],
    ["network.initialize('root'); network.addSubnetwork('root', 'root')", /duplicate subnetwork/],
    ["network.initialize('root'); network.addNode('A', 1, 'a', 'root'); network.addNode('A', 1, 'a', 'root')", /duplicate node/],
    ["network.initialize('root'); network.addDependency('unknown', network.exit('root'))", /unknown node/],
    ["network.initialize('root'); network.addDependency(network.entry('root'), network.entry('root'))", /self dependency/],
    ["network.initialize('root'); network.payload(network.entry('root'))", /milestone/],
    ["network.initialize('root'); network.addNode('A', 2147483647, 'a', 'root'); network.addNode('B', 1, 'b', 'root'); network.addDependency('A', 'B')", /overflow/]
  ]) {
    const f = await fixture(t, body);
    await assert.rejects(f.run(), pattern, body);
  }
  const additions = Array.from({ length: 31 }, (_, i) => `network.addNode('n${i}', 0, '', 'root')`).join(';');
  const f = await fixture(t, `network.initialize('root'); ${additions}`);
  await assert.rejects(f.run(), /node capacity/);
  const uninitialized = await fixture(t, '');
  await assert.rejects(uninitialized.run(), /initialized/);
});

test('compiler rejects generic arity/type errors instead of silently erasing payload types', () => {
  const source = body => `use "CPMNetwork"; service 'invalid';
    var network: CPMNetwork<integer>; text: string;
    get '/run'; begin ${body ? `${body};` : ''} return '{}' end end.`;
  for (const body of [
    "network.addNode('A', 1, 'not an integer', 'root')",
    "network.addNode('A', 1, 7)",
    "network.setPayload('A', 'wrong')",
    "text := network.payload('A')"
  ]) assert.throws(() => compile(source(body), { hostServices: true }), /Generic/);
  assert.throws(() => compile(source('').replace('CPMNetwork<integer>', 'CPMNetwork'), { hostServices: true }), /type arguments/);
  assert.throws(() => compile(source('').replace('CPMNetwork<integer>', 'CPMNetwork<integer, string>'), { hostServices: true }), /type arguments/);
  assert.throws(() => compile(source('').replace('CPMNetwork<integer>', 'string<integer>'), { hostServices: true }), /Parse failed|generic arguments/);
});

test('record-array runtime indexing preserves all typed leaves and rejects out-of-range indexes', async t => {
  const compiled = compile(`service 'array';
    type Item = record name: string; count: integer; end;
    var records: array [2..4] of Item; item, copy: Item; index: integer;
    post '/run'; begin
      index := host.json_integer(host.event_body(), 'index');
      item.name := 'typed'; item.count := 17;
      records[index] := item;
      copy := records[index];
      return host.json_set(host.json_set('{}', 'name', copy.name), 'count', copy.count)
    end end.`, { hostServices: true });
  const host = await createPascalishServiceHost({ compiled, collectorId: 'array', httpPort: null, udpPort: null, logger });
  t.after(() => host.stop());
  await host.start();
  const run = async index => (await host.dispatch({ method: 'POST', path: '/run', body: JSON.stringify({ index }) })).body;
  assert.deepEqual(await run(2), { name: 'typed', count: 17 });
  assert.deepEqual(await run(4), { name: 'typed', count: 17 });
  await assert.rejects(run(1), /index out of range/);
  await assert.rejects(run(5), /index out of range/);
});

test('the full 32-node and 256-edge capacities work and overflowing additions fail explicitly', async t => {
  const nodes = Array.from({ length: 30 }, (_, i) => `network.addNode('n${i}', 0, '', 'root')`).join(';');
  const full = await fixture(t, `network.initialize('root'); ${nodes}`);
  assert.equal((await full.run()).nodes.length, 32);

  const pairs = [];
  for (let from = 0; from < 23; from++) {
    for (let to = from + 1; to < 23; to++) pairs.push(`network.addDependency('n${from}', 'n${to}')`);
  }
  const f = await fixture(t, `network.initialize('root'); ${nodes.split(';').slice(0, 23).join(';')};
    ${pairs.slice(0, 209).join(';')}`);
  const schedule = await f.run();
  assert.equal(schedule.edges.length, 256);
  // Reuse the computed graph so each overflow check doesn't rebuild 256 edges.
  for (const addition of [pairs[209], "network.addSubnetwork('extra', 'root')"]) {
    const overflow = await fixture(t, `network.graph := '${JSON.stringify(schedule)}'; ${addition}`);
    await assert.rejects(overflow.run(), /dependency capacity/);
  }

  const almostFull = await fixture(t, `network.initialize('root'); ${nodes.split(';').slice(0, 29).join(';')};
    network.addSubnetwork('extra', 'root')`);
  await assert.rejects(almostFull.run(), /node capacity/);
});

test('generic aliases and nested specializations share code without sharing instance state', async t => {
  const compiled = compile(`service 'aliases';
    type Box<T> = record content: T; end;
    type Pair<T> = record first: Box<T>; rest: T; end;
    class Holder<T>; value: T;
      procedure assignValue(item: T); begin self.value := item end;
      function readValue(): T; begin return self.copyValue() end;
      function copyValue(): T; begin return self.value end;
    end;
    var left, right: Holder<Pair<integer>>; item, copy: Pair<integer>;
    get '/run'; begin
      item.first.content := 42; item.rest := 17; left.assignValue(item);
      item.first.content := 9; right.assignValue(item);
      copy := left.readValue();
      return host.json_set(host.json_set('{}', 'first', copy.first.content), 'second', copy.rest)
    end end.`, { hostServices: true });
  const methods = Object.values(compiled.programMap.procedures).filter(item => item.className?.startsWith('Holder__generic_'));
  assert.equal(methods.length, 3, 'one specialization implements both instances');
  const host = await createPascalishServiceHost({ compiled, collectorId: 'aliases', httpPort: null, udpPort: null, logger });
  t.after(() => host.stop());
  await host.start();
  assert.deepEqual((await host.dispatch({ method: 'GET', path: '/run' })).body, { first: 42, second: 17 });
});

test('generic bodies reject invalid writes, returns, recursive layouts and incompatible record fields', () => {
  for (const body of ["self.value := 'wrong'", "return 'wrong'"]) {
    const source = `service 'invalid'; class Holder<T>; value: T;
      function readValue(): T; begin ${body}; return self.value end;
      end; var item: Holder<integer>; get '/run'; begin return '{}' end end.`;
    assert.throws(() => compile(source, { hostServices: true }), /Generic argument\/result type mismatch/);
  }
  assert.throws(() => compile(`service 'recursive';
    type Box<T> = record nested: Box<T>; end;
    var item: Box<integer>;
    get '/run'; begin return '{}' end end.`, { hostServices: true }), /Recursive generic layout/);
  assert.throws(() => compile(`use "CPMNetwork"; service 'shape';
    type Job = record name: string; cost: integer; end;
    type Wrong = record name: string; cost: string; end;
    var network: CPMNetwork<Job>; item: Wrong;
    get '/run'; begin network.addNode('A', 1, item, 'root'); return '{}' end end.`,
  { hostServices: true }), /Generic argument\/result type mismatch/);
  assert.throws(() => compile(`use "CPMNetwork"; service 'indexed';
    var network: CPMNetwork<string>; counts: array [0..1] of integer; index: integer;
    get '/run'; begin counts[index] := network.payload('A'); return '{}' end end.`,
  { hostServices: true }), /Generic argument\/result type mismatch/);
});

test('nested method arguments support seven-leaf payloads and oversized frames fail during compilation', async t => {
  const fields = Array.from({ length: 7 }, (_, i) => `f${i}: integer;`).join(' ');
  const source = `use "CPMNetwork"; service 'frames';
    type Job = record ${fields} end;
    var network: CPMNetwork<Job>; item, copy: Job;
    get '/run'; begin
      network.initialize('root'); network.addSubnetwork('child', 'root');
      item.f6 := 42; network.addNode('A', 1, item, 'child');
      network.addDependency(network.exit('child'), network.exit('root'));
      copy := network.payload('A'); return host.json_set('{}', 'value', copy.f6)
    end end.`;
  const compiled = compile(source, { hostServices: true });
  const host = await createPascalishServiceHost({ compiled, collectorId: 'frames', httpPort: null, udpPort: null,
    desktopBudget: true, logger });
  t.after(() => host.stop());
  await host.start();
  assert.deepEqual((await host.dispatch({ method: 'GET', path: '/run' })).body, { value: 42 });
  assert.throws(() => compile(source.replace('f6: integer;', 'f6: integer; f7: integer;'), { hostServices: true }),
    /operand stack capacity/);
});

test('the documented Pascalish example compiles and executes the nested construction schedule', async t => {
  const source = await readFile(new URL('../../src/cpm-network-example.pas', import.meta.url), 'utf8');
  const compiled = compile(source, { hostServices: true });
  const host = await createPascalishServiceHost({ compiled, collectorId: 'example', httpPort: null, udpPort: null,
    desktopBudget: true, logger });
  t.after(() => host.stop());
  await host.start();
  const schedule = (await host.dispatch({ method: 'GET', path: '/api/cpm/example' })).body;
  assert.equal(schedule.duration, 10);
  assert.ok(schedule.criticalPath.includes('verify'));
});
