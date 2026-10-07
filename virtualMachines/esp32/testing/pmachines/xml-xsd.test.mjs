import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { createXmlBindings } from '../../pmachines/javascript/src/xml-bindings.mjs';
import { createPascalishXsdParser } from '../../aggregator/src/librarian/xsd-parser.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { executeProgram, parsePcode } from '../../pmachines/javascript/src/runtime.mjs';
import { loadOpcodeMap } from '../../pmachines/javascript/src/opcodes.mjs';

const namespace = 'http://www.w3.org/2001/XMLSchema';
const schema = inner => `<xs:schema xmlns:xs="${namespace}">${inner}</xs:schema>`;
const leaf = (name, valueType = 'xs:string', required = true) => ({ name, kind: 'leaf', valueType, required, children: [] });
const branch = (name, valueType, children) => ({ name, kind: 'branch', valueType, children });
const root = children => branch('root', 'xsd', children);
const quiet = { warn() {}, error() {} };
async function parser(t) {
  const instance = await createPascalishXsdParser({ logger: quiet });
  t.after(() => instance.stop());
  return instance;
}

test('XML adapter preserves namespace scopes, attribute/text decoding and sibling boundaries', () => {
  const bindings = createXmlBindings();
  const handle = bindings['host.xml_parse'](`<r xmlns="urn:outer" xmlns:p="urn:first" plain='a &gt; b'>
    <p:child xmlns:p="urn:second" label='caf\u00e9 &amp; \u540d'>&lt;text&gt;</p:child>
    <p:child><![CDATA[<!DOCTYPE harmless> &unchanged;]]></p:child>
  </r>`);
  assert.equal(bindings['host.xml_count'](handle), 3);
  assert.equal(bindings['host.xml_namespace'](handle, 0), 'urn:outer');
  assert.equal(bindings['host.xml_attribute'](handle, 0, 'plain'), 'a > b');
  assert.equal(bindings['host.xml_first_child'](handle, 0), 1);
  assert.equal(bindings['host.xml_next_sibling'](handle, 1), 2);
  assert.equal(bindings['host.xml_namespace'](handle, 1), 'urn:second');
  assert.equal(bindings['host.xml_namespace'](handle, 2), 'urn:first');
  assert.equal(bindings['host.xml_qname_namespace'](handle, 1, 'p:T'), 'urn:second');
  assert.equal(bindings['host.xml_qname_local'](handle, 1, 'p:T'), 'T');
  assert.equal(bindings['host.xml_attribute'](handle, 1, 'label'), 'caf\u00e9 & \u540d');
  assert.equal(bindings['host.xml_text'](handle, 1), '<text>');
  assert.equal(bindings['host.xml_text'](handle, 2), '<!DOCTYPE harmless> &unchanged;');
  assert.equal(bindings['host.xml_attribute'](handle, 0, 'absent'), '');
  assert.equal(bindings['host.xml_attribute'](handle, 0, 'constructor'), '');
  assert.equal(bindings['host.xml_attribute_integer'](handle, 0, 'absent', 1), 1);
  assert.throws(() => bindings['host.xml_count'](999), /handle/);
  assert.throws(() => bindings['host.xml_local_name'](handle, -1), /bounds/);
});

test('XML adapter rejects malformed documents, DTDs, unknown entities and invalid namespace declarations', () => {
  for (const content of [
    '<r>', '<r><x></r>', '<r/><other/>', '<p:r/>', '<r p:a="1"/>',
    '<!DOCTYPE r SYSTEM "file:///not-opened"><r/>', '<!DOCTYPE r [<!ENTITY x "expanded">]><r>&x;</r>',
    '<r>&unknown;</r>', '<r>&unfinished</r>', '<r>&#0;</r>', '<r>&#xD800;</r>', '<r>\u0000</r>',
    '<r>\ud800</r>', '<r a="1" a="2"/>',
    '<r xmlns:p="same" xmlns:q="same" p:a="1" q:a="2"/>',
    '<r xmlns:xml="wrong"/>', '<r xmlns:p="http://www.w3.org/XML/1998/namespace"/>'
  ]) {
    assert.throws(() => createXmlBindings()['host.xml_parse'](content), undefined, content);
  }
  const bindings = createXmlBindings();
  const handle = bindings['host.xml_parse']('<r min="invalid"/>');
  assert.throws(() => bindings['host.xml_attribute_integer'](handle, 0, 'min', 1), /integer attribute/);
  assert.throws(() => bindings['host.xml_qname_local'](handle, 0, 'missing:T'), /Unbound/);
  assert.throws(() => bindings['host.xml_qname_local'](handle, 0, 'bad name'), /qualified name/);
  assert.throws(() => bindings['host.xml_parse']('<__proto__/>'), /reserved JavaScript keyword/);
});

test('XML byte, node and depth capacities are explicit and invalid parses do not leak handles', () => {
  assert.throws(() => createXmlBindings({ maxBytes: 0 }), /limit/);
  assert.throws(() => createXmlBindings({ maxBytes: 3 })['host.xml_parse']('<r/>'), /capacity/);
  assert.throws(() => createXmlBindings({ maxNodes: 1 })['host.xml_parse']('<r><x/></r>'), /capacity/);
  assert.throws(() => createXmlBindings({ maxDepth: 2 })['host.xml_parse']('<r><x><y><z/></y></x></r>'), /depth|nested/i);
  assert.equal(createXmlBindings({ maxDepth: 2 })['host.xml_parse']('<r><x/></r>'), 1);
  const handles = createXmlBindings();
  for (let index = 1; index <= 8; index++) assert.equal(handles['host.xml_parse']('<r/>'), index);
  assert.throws(() => handles['host.xml_parse']('<r/>'), /capacity/);
  const bindings = createXmlBindings({ maxNodes: 1 });
  assert.throws(() => bindings['host.xml_parse']('<r><x/></r>'), /capacity/);
  assert.equal(bindings['host.xml_parse']('<r/>'), 1);
  assert.throws(() => bindings['host.xml_parse']('<r/>'), /capacity/);
});

test('Pascalish XML library is desktop-only and document handles are invocation-scoped', async t => {
  const compiled = compilePascalishProgramWithAntlr(`service 'xml-library'; use "XML"; var document: XMLDocument;
post '/parse'; begin document.load(host.event_body()); return host.json_set('{}', 'name', document.localName(0)) end
get '/stale'; begin return host.json_set('{}', 'name', document.localName(0)) end
end.`, { hostServices: true });
  assert.deepEqual(compiled.programMap.targets, ['js']);
  assert.throws(() => encodeHostedImage(compiled.pcodeText), /Desktop-only/);
  const host = await createPascalishServiceHost({ compiled, collectorId: 'xml-test', httpPort: null, udpPort: null, logger: quiet });
  t.after(() => host.stop());
  await host.start();
  assert.deepEqual((await host.dispatch({ method: 'POST', path: '/parse', body: '<root/>' })).body, { name: 'root' });
  await assert.rejects(host.dispatch({ method: 'GET', path: '/stale', body: '' }), /handle/);
});

test('Pascalish XSD tree matches the original parser on its correctly parsed subset', async t => {
  const instance = await parser(t);
  const baseline = execFileSync('git', ['show', '6240217f:virtualMachines/esp32/aggregator/data-librarian.mjs'], { encoding: 'utf8' });
  const start = baseline.indexOf('function buildXsdTree(');
  const end = baseline.indexOf('function decodeTextBuffer(', start);
  assert.ok(start >= 0 && end > start);
  const original = vm.runInNewContext(`${baseline.slice(start, end)}\nbuildXsdTree`);
  for (const content of [
    schema('<xs:element name="A" type="xs:string"/><xs:element name="B" type="xs:int" minOccurs="0"/>'),
    schema('<xs:complexType name="Record"><xs:sequence><xs:element name="A" type="xs:string"/></xs:sequence></xs:complexType>'),
    schema('<xs:element name="Document"><xs:complexType><xs:sequence><xs:element name="Id" type="xs:string"/></xs:sequence></xs:complexType></xs:element>'),
    schema('<xs:simpleType name="Code"><xs:restriction base="xs:string"><xs:enumeration value="A"/><xs:enumeration value="B"/></xs:restriction></xs:simpleType><xs:element name="Cd" type="Code"/>')
  ]) {
    assert.deepEqual(await instance.parse(content), JSON.parse(JSON.stringify(original(content))));
  }
});

test('Pascalish fixes annotation nesting, namespace aliases, quotes, entities and foreign element confusion', async t => {
  const instance = await parser(t);
  const content = `<s:schema xmlns:s="${namespace}" xmlns:f="urn:foreign">
    <!-- <s:element name="Fake"/> -->
    <s:element name='Document'><s:annotation><s:documentation>Ignore &gt; markup</s:documentation></s:annotation>
      <s:complexType><s:sequence>
        <s:element name='Id' type='s:string' minOccurs='0'/>
        <s:element name='A&amp;B' type='s:int'/>
        <f:element name='Foreign'/>
      </s:sequence></s:complexType>
    </s:element>
    <s:element name='Sibling' type='s:string'/>
  </s:schema>`;
  assert.deepEqual(await instance.parse(content), root([
    { name: 'Document', kind: 'branch', valueType: 'complex', required: true, children: [
      branch('complextype', 'complextype', [branch('sequence', 'sequence', [
        leaf('Id', 's:string', false), leaf('A&B', 's:int')
      ])])
    ] },
    leaf('Sibling', 's:string')
  ]));
  assert.deepEqual(await instance.parse(`<schema xmlns="${namespace}"><element name="A" type="string"/></schema>`),
    root([leaf('A', 'string')]));
  assert.deepEqual(await instance.parse(schema('<xs:element name="A"><xs:annotation><xs:documentation>Leaf</xs:documentation></xs:annotation></xs:element>')),
    root([leaf('A', 'complex')]));
  assert.deepEqual(await instance.parse(schema('<xs:complexType name="Base"><xs:complexContent><xs:extension base="xs:anyType"><xs:choice><xs:element name="Optional" type=" xs:string " minOccurs=" +0 "/></xs:choice><xs:all><xs:element name="Other" type="xs:string"/></xs:all></xs:extension></xs:complexContent></xs:complexType>')),
    root([branch('Base', 'complextype', [
      branch('choice', 'choice', [leaf('Optional', ' xs:string ', false)]),
      branch('all', 'all', [leaf('Other')])
    ])]));
  assert.equal(await instance.parse('<message><element name="NotXsd"/></message>'), null);
});

test('XSD enum metadata respects QName namespace identities and declaration order', async t => {
  const instance = await parser(t);
  const content = `<s:schema xmlns:s="${namespace}" xmlns:t="urn:types" xmlns:f="urn:foreign" targetNamespace="urn:types">
    <s:element name="Code" type="t:Code"/>
    <s:element name="ForeignCode" type="f:Code"/>
    <s:simpleType name="Code"><s:restriction base="s:string">
      <s:enumeration value=""/><s:enumeration value="A&amp;B"/><s:enumeration value="\u540d"/>
    </s:restriction></s:simpleType>
  </s:schema>`;
  assert.deepEqual(await instance.parse(content), root([
    { ...leaf('Code', 't:Code'), isEnum: true, enumValues: ['', 'A&B', '\u540d'] },
    leaf('ForeignCode', 'f:Code')
  ]));
  await assert.rejects(instance.parse(schema('<xs:element name="A" minOccurs="bad"/>')), /integer attribute/);
  await assert.rejects(instance.parse('<broken>'), /Invalid XML/);
  assert.deepEqual(await instance.parse(schema('<xs:element name="Recovered" type="xs:string"/>')), root([leaf('Recovered')]));
});

test('XSD content cache coalesces concurrent parses without sharing mutable trees or hiding changed input', async t => {
  const instance = await parser(t);
  const content = schema('<xs:element name="Original" type="xs:string"/>');
  const results = await Promise.all(Array.from({ length: 300 }, () => instance.parse(content)));
  assert.deepEqual(instance.getStatus(), { cachedEntries: 1, cachedBytes: Buffer.byteLength(JSON.stringify(results[0])), pendingParses: 0, stopped: false });
  results[0].children[0].name = 'Modified';
  assert.equal(results[1].children[0].name, 'Original');
  assert.equal((await instance.parse(content)).children[0].name, 'Original');
  assert.equal((await instance.parse(content.replace('Original', 'Changed'))).children[0].name, 'Changed');
  await assert.rejects(instance.parse(content.replace('</xs:schema>', '')), /Invalid XML/);
  const replacement = schema('<xs:element name="\ufffd" type="xs:string"/>');
  await instance.parse(replacement);
  await assert.rejects(instance.parse(replacement.replace('\ufffd', '\ud800')), /Invalid XML character/);
  await assert.rejects(instance.parse('x'.repeat(1000001)), /capacity/);
  assert.equal((await instance.parse(content)).children[0].name, 'Original');
  for (let index = 0; index < 257; index++) {
    await instance.parse(schema(`<xs:element name="Cache${index}" type="xs:string"/>`));
  }
  assert.equal(instance.getStatus().cachedEntries, 256);
  for (let index = 0; index < 11; index++) {
    await instance.parse(schema(`<xs:element name="Large${index}${'x'.repeat(780000)}" type="xs:string"/>`));
  }
  assert.equal(instance.getStatus().cachedEntries, 10);
  assert.ok(instance.getStatus().cachedBytes <= 8000000);
  await instance.stop();
  assert.equal(instance.getStatus().cachedBytes, 0);
  await assert.rejects(instance.parse(content), /stopped/);
});

test('explicit desktop execution budget preserves the default ceiling and remains bounded', async t => {
  const opcodeMap = await loadOpcodeMap();
  const run = context => executeProgram({
    instructions: parsePcode('HALT'), opcodeMap, mappingsById: new Map(), inputQueue: '', sourceMessage: '',
    runtimeContext: context
  });
  await assert.rejects(run({ maxSteps: 200001 }), /maxSteps/);
  assert.equal((await run({ desktopBudget: true, maxSteps: 200001 })).stepLimitHit, false);
  await assert.rejects(run({ desktopBudget: true, maxSteps: 10000001 }), /maxSteps/);
  const compiled = compilePascalishProgramWithAntlr(`service 'desktop-budget'; var counter: integer;
get '/count'; begin counter := 0; while counter < 30000 do counter := counter + 1; return counter end end.`,
  { hostServices: true });
  const options = { compiled, collectorId: 'budget-test', httpPort: null, udpPort: null, maxSteps: 1000000, logger: quiet };
  await assert.rejects(createPascalishServiceHost(options), /maxSteps/);
  const host = await createPascalishServiceHost({ ...options, desktopBudget: true });
  t.after(() => host.stop());
  await host.start();
  assert.equal((await host.dispatch({ method: 'GET', path: '/count', body: '' })).body, 30000);
});

test('all checked-in XSD schemas parse within desktop budgets with correct top-level node counts', async t => {
  const instance = await parser(t);
  const directory = new URL('../../aggregator/data/services/librarian/schemas/', import.meta.url);
  const files = (await fs.readdir(directory)).filter(name => name.endsWith('.xsd'));
  assert.ok(files.length >= 100);
  const started = performance.now();
  const results = await Promise.all(files.map(async name => {
    const buffer = await fs.readFile(new URL(name, directory));
    const encoding = buffer[0] === 0xff && buffer[1] === 0xfe ? 'utf-16le'
      : buffer[0] === 0xfe && buffer[1] === 0xff ? 'utf-16be' : 'utf-8';
    const content = new TextDecoder(encoding, { fatal: true }).decode(buffer);
    const bindings = createXmlBindings();
    const handle = bindings['host.xml_parse'](content);
    let cursor = bindings['host.xml_first_child'](handle, 0);
    let expected = 0;
    while (cursor >= 0) {
      if (bindings['host.xml_namespace'](handle, cursor) === namespace
        && ['element', 'complexType', 'sequence', 'choice', 'all'].includes(bindings['host.xml_local_name'](handle, cursor))) expected++;
      cursor = bindings['host.xml_next_sibling'](handle, cursor);
    }
    const result = await instance.parse(content);
    assert.equal(result?.children.length ?? 0, expected, name);
    return content;
  }));
  const coldMs = performance.now() - started;
  const warmStarted = performance.now();
  await Promise.all(results.map(content => instance.parse(content)));
  const warmMs = performance.now() - warmStarted;
  t.diagnostic(`Parsed ${results.length} real XSDs concurrently, including UTF-16: cold ${coldMs.toFixed(0)} ms; cached ${warmMs.toFixed(0)} ms.`);
});
