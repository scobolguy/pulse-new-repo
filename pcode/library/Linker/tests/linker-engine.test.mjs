import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../../../languages/pascalish/src/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../../../virtualMachines/esp32/pmachines/javascript/src/service-host.mjs';
import { executeProgram, parsePcode } from '../../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';

const source = `service 'linker-engine-test';
uses Linker;
post '/link';
begin
  Linker_Init();
  return Linker_Link(host.event_body())
end
post '/resolve';
begin
  Linker_Init();
  return Linker_Resolve(host.event_body())
end
post '/resources';
begin
  Linker_Init();
  return Linker_BindResources(host.event_body())
end
post '/resource';
begin
  Linker_Init();
  return Linker_Resource(host.event_body(), 'input', 'file')
end
end.`;

const primitives = {
  'host.string_length': text => String(text).length,
  'host.string_slice': (text, start, end) => String(text).slice(start, end),
  'host.string_index': (text, value) => String(text).indexOf(value),
  'host.string_lower': text => String(text).toLowerCase(),
  'host.string_upper': text => String(text).toUpperCase(),
  'host.string_codepoint_at': (text, index) => String(text).codePointAt(index) ?? -1,
  'host.string_codepoint_width': (text, index) => {
    const cp = String(text).codePointAt(index);
    return cp === undefined ? 0 : cp > 0xffff ? 2 : 1;
  },
  'host.string_from_codepoint': value => String.fromCodePoint(value),
  'host.integer_text': value => String(value),
  'host.text_hash_utf8': text => createHash('sha256').update(text).digest('hex'),
};

const root = {
  untouched: { payload: '😀' },
  pcodeText: 'JMP MAIN\nMAIN:\nCALL PUBLIC_GET 0\nPRINT\nPRINT_NL\nHALT\n',
  programMap: { procedures: {}, globals: [], sourceMap: { 0: { file: 'root' }, 1: { file: 'main' } } },
};
const library = {
  id: 'Test',
  version: '1.2.0',
  exports: { PUBLIC_GET: 'get' },
  initialize: 'init',
  inferCapabilities: true,
  pcodeText: `JMP MAIN
GET:
LOAD shared
CALL HELPER 1
RET
HELPER:
LOAD value
JMP DONE
DONE:
RET
INIT:
PUSH_STR "linked"
STORE shared
RET
UNUSED:
CALL_EXT host.write 0
RET
MAIN:
HALT
`,
  programMap: {
    procedures: {
      GET: { name: 'get', params: [], locals: [] },
      HELPER: { name: 'helper', params: ['value'], locals: [] },
      INIT: { name: 'init', params: [], locals: [] },
      UNUSED: { name: 'unused', params: [], locals: [] },
    },
    globals: ['shared'],
    sourceMap: { 1: { file: 'lib' } },
    requiredHostCapabilities: ['filesystem.write'],
  },
};

test('portable linker executes linking, dependency policy and resource policy in generated P-code', async t => {
  const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true, nativeTarget: true });
  assert.doesNotMatch(compiled.pcodeText, /CALL_EXT host\.(?:json_|xml_|number_parse_integer|link|resolve)/);
  assert.doesNotMatch(compiled.pcodeText, /^\s*(?:DIV|MOD|ARR_|ARRAY|OBJ_)/m);
  const usedBindings = new Set([...compiled.pcodeText.matchAll(/CALL_EXT (\S+)/g)].map(match => match[1]));
  for (const binding of usedBindings) {
    assert.ok(binding in primitives || ['host.event_body', 'host.event_method', 'host.event_path', 'host.http_status', 'host.http_header', 'host.raise_error'].includes(binding), binding);
  }
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'linker-engine-test', httpPort: null, udpPort: null,
    desktopBudget: true, bindings: primitives, maxBodyBytes: 262144,
    logger: { warn() {}, error() {} },
  });
  t.after(() => host.stop());
  await host.start();
  const invoke = async (path, body) => (await host.dispatch({ method: 'POST', path, body: JSON.stringify(body) })).body;

  await t.test('closure, globals, branches, exports, initialization and source maps', async () => {
    const linked = await invoke('/link', { program: root, libraries: [library] });
    assert.deepEqual(linked.untouched, root.untouched);
    assert.match(linked.pcodeText, /JMP LIB_TEST_DONE/);
    assert.doesNotMatch(linked.pcodeText, /UNUSED|host.write/);
    assert.ok(linked.programMap.procedures.LIB_TEST_HELPER);
    assert.deepEqual(linked.programMap.globals, ['LIB_TEST_GLOBAL_SHARED']);
    assert.deepEqual(linked.programMap.sourceMap[0], { file: 'root' });
    assert.deepEqual(linked.programMap.sourceMap[2], { file: 'main' });
    assert.deepEqual(linked.programMap.sourceMap[6], { file: 'lib' });
    assert.equal(linked.programMap.linkedLibraries[0].version, '1.2.0');
    assert.equal(linked.programMap.linkedLibraries[0].hash, primitives['host.text_hash_utf8'](library.pcodeText));
    const execution = await executeProgram({
      instructions: parsePcode(linked.pcodeText), programMap: linked.programMap,
      inputQueue: '', sourceMessage: '',
    });
    assert.equal(execution.error, null);
    assert.deepEqual(execution.stdout, ['linked']);
  });

  await t.test('no libraries returns the unchanged program', async () => {
    assert.deepEqual(await invoke('/link', { program: root, libraries: [] }), root);
  });

  await t.test('capabilities include only linked host calls', async () => {
    const read = {
      ...library, id: 'Read', initialize: undefined,
      pcodeText: 'JMP MAIN\nGET:\nCALL_EXT host.read 0\nRET\nUNUSED:\nCALL_EXT host.write 0\nRET\nMAIN:\nHALT\n',
      programMap: { ...library.programMap, globals: [] },
    };
    const linked = await invoke('/link', {
      program: root, libraries: [read],
      bindingCapabilities: { 'host.read': ['artifact.read'], 'host.write': ['filesystem.write'] },
    });
    assert.deepEqual(linked.programMap.requiredHostCapabilities, ['artifact.read']);
  });

  await t.test('dependency closure, exact pins, missing, ambiguous and cyclic graphs', async () => {
    const empty = { pcodeText: 'JMP MAIN\nMAIN:\nHALT\n', programMap: { procedures: {} }, exports: {} };
    const a = { ...empty, id: 'A', dependencies: [{ id: 'B', version: '2', hash: primitives['host.text_hash_utf8'](empty.pcodeText) }] };
    const b = { ...empty, id: 'B', version: '2' };
    const request = { program: root, libraries: [a, b, { ...empty, id: 'Unused' }], required: ['A'] };
    assert.deepEqual((await invoke('/resolve', request)).programMap.linkedLibraries.map(item => item.id), ['B', 'A']);
    for (const [libraries, pattern] of [
      [[a], /Missing library B/],
      [[a, { ...b, version: '3' }], /wrong version/],
      [[a, b, b], /Ambiguous/],
      [[{ ...a, dependencies: ['B'] }, { ...b, dependencies: ['A'] }], /cycle/],
      [[{ ...a, dependencies: [{ id: 'B', hash: 'bad' }] }, b], /hash/],
    ]) await assert.rejects(invoke('/resolve', { ...request, libraries }), pattern);
  });

  await t.test('duplicate labels, unresolved imports, contract and target conflicts fail explicitly', async () => {
    for (const [program, lib, pattern] of [
      [{ ...root, pcodeText: 'MAIN:\nMAIN:\nHALT\n' }, library, /Duplicate root label/],
      [root, { ...library, pcodeText: library.pcodeText.replace('GET:\n', 'GET:\nGET:\n') }, /Duplicate library label/],
      [root, { ...library, pcodeText: library.pcodeText.replace('CALL HELPER 1', 'CALL MISSING 1') }, /unresolved procedure/],
      [{ ...root, pcodeText: 'PUBLIC_GET:\nRET\n' + root.pcodeText }, library, /collides/],
      [{ ...root, programMap: { ...root.programMap, hostBindingsVersion: 1 } }, { ...library, programMap: { ...library.programMap, hostBindingsVersion: 2 } }, /conflicts/],
      [{ ...root, programMap: { ...root.programMap, targets: ['js'] } }, { ...library, programMap: { ...library.programMap, targets: ['esp32'] } }, /compatible target/],
    ]) await assert.rejects(invoke('/link', { program, libraries: [lib] }), pattern);
  });

  await t.test('typed resource overlays preserve authority fields and reject invalid assignments', async () => {
    const binding = { symbol: 'input', kind: 'file', physicalName: 'a', provider: 'local', root: 'granted', readOnly: true };
    const override = { ...binding, physicalName: 'b', path: 'input/b' };
    assert.deepEqual(await invoke('/resources', { programDefaults: [binding], deployment: [], overrides: [override] }), [override]);
    assert.deepEqual(await invoke('/resource', [override]), override);
    await assert.rejects(invoke('/resource', []), /Missing resource binding/);
    await assert.rejects(invoke('/resource', [{ ...binding, kind: 'queue' }]), /Wrong resource kind/);
    for (const request of [
      { deployment: [binding, binding] },
      { programDefaults: [binding], overrides: [{ ...binding, kind: 'queue' }] },
      { deployment: [{ ...binding, kind: 'network' }] },
      { deployment: [{ ...binding, physicalName: '  ' }] },
    ]) await assert.rejects(invoke('/resources', request), /\[PCODE-LINK\]/);
  });
});
