import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createPascalishXsdParser } from '../../aggregator/src/librarian/xsd-parser.mjs';
import { createXmlBindings } from '../../pmachines/javascript/src/xml-bindings.mjs';
import { schemaSimpleTypeSummary } from '../../aggregator/src/librarian/schema-tree.mjs';

const ns = 'http://www.w3.org/2001/XMLSchema';
const schema = (body, namespace = 'urn:test', declarations = '') =>
  `<s:schema xmlns:s="${ns}" ${namespace ? `targetNamespace="${namespace}" xmlns:t="${namespace}"` : ''} ${declarations}>${body}</s:schema>`;
const enumeration = values => values.map(value => `<s:enumeration value="${value}"/>`).join('');
const atomic = (name, values, base = 's:string') =>
  `<s:simpleType name="${name}"><s:restriction base="${base}">${enumeration(values)}</s:restriction></s:simpleType>`;
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-xsd-simple-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const parser = await createPascalishXsdParser({ schemaRoot: root, logger: { warn() {} } });
  t.after(() => parser.stop());
  const write = async (name, value) => {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), value);
  };
  return { parser, write };
}

test('atomic restriction inheritance preserves lexical enums, narrows explicitly and respects namespace aliases', async t => {
  const { parser } = await fixture(t);
  const tree = await parser.parse(schema(`
    <s:element name="Inherited" type="alias:Final"/><s:element name="Narrowed" type="t:Narrow"/>
    <s:element name="Other" type="f:Final"/>
    <s:simpleType name="Final"><s:restriction base="t:Middle"/></s:simpleType>
    <s:simpleType name="Middle"><s:restriction base="t:Base"><s:maxLength value="10"/></s:restriction></s:simpleType>
    ${atomic('Narrow', ['B'], 't:Final')}
    ${atomic('Base', ['', 'A&amp;B', 'B', 'B', '\u540d'])}
  `, 'urn:test', 'xmlns:alias="urn:test" xmlns:f="urn:other"'));
  assert.deepEqual(tree.children[0].enumValues, ['', 'A&B', 'B', '\u540d']);
  assert.equal(tree.children[0].valueType, 'alias:Final');
  assert.equal(tree.children[0].isEnum, true);
  assert.equal(tree.children[0].kind, 'leaf');
  assert.deepEqual(tree.children[1].enumValues, ['B']);
  assert.equal(tree.children[2].unresolved, true);
  assert.equal(tree.children[2].enumValues, undefined);
});

test('inline simple types and nested restriction bases do not leak unrelated nested enum facets', async t => {
  const { parser } = await fixture(t);
  const tree = await parser.parse(schema(`
    <s:element name="Inline" minOccurs="0"><s:simpleType><s:restriction base="t:Base">
      ${enumeration(['A&amp;B', '', '\u540d'])}
    </s:restriction></s:simpleType></s:element>
    <s:element name="Nested"><s:simpleType><s:restriction>
      <s:simpleType><s:restriction base="s:string">${enumeration(['BASE'])}</s:restriction></s:simpleType>
      ${enumeration(['LOCAL'])}
    </s:restriction></s:simpleType></s:element>
    <s:element name="Plain"><s:simpleType><s:restriction base="s:int"/></s:simpleType></s:element>
    ${atomic('Base', ['A&amp;B', '', '\u540d'])}
  `));
  assert.equal(tree.children[0].valueType, 'simple');
  assert.equal(tree.children[0].required, false);
  assert.equal(tree.children[0].kind, 'leaf');
  assert.deepEqual(tree.children[0].children, []);
  assert.deepEqual(tree.children[0].enumValues, ['A&B', '', '\u540d']);
  assert.deepEqual(tree.children[1].enumValues, ['LOCAL']);
  assert.equal(tree.children[2].isEnum, undefined);
  assert.equal(tree.children[2].kind, 'leaf');
});

test('list item enum metadata is distinct from whole-list lexical enums', async t => {
  const { parser } = await fixture(t);
  const tree = await parser.parse(schema(`
    <s:element name="List" type="t:Codes"/><s:element name="Restricted" type="t:Pairs"/>
    <s:element name="Inline"><s:simpleType><s:list>
      <s:simpleType><s:restriction base="s:string">${enumeration(['X', 'Y'])}</s:restriction></s:simpleType>
    </s:list></s:simpleType></s:element>
    <s:element name="Builtin" type="s:NMTOKENS"/>
    <s:simpleType name="Codes"><s:list itemType="t:Code"/></s:simpleType>
    ${atomic('Pairs', ['A B', 'B A'], 't:Codes')}
    ${atomic('Code', ['A', 'B'])}
  `));
  const [list, restricted, inline, builtin] = tree.children;
  assert.equal(list.kind, 'leaf');
  assert.equal(list.isEnum, undefined);
  assert.equal(list.simpleType.variety, 'list');
  assert.equal(list.simpleType.finite, false);
  assert.deepEqual(list.simpleType.itemType.enumValues, ['A', 'B']);
  assert.equal(list.simpleType.itemType.finite, true);
  assert.deepEqual(restricted.enumValues, ['A B', 'B A']);
  assert.equal(restricted.isEnum, true);
  assert.equal(restricted.simpleType.variety, 'list');
  assert.deepEqual(restricted.simpleType.itemType.enumValues, ['A', 'B']);
  assert.deepEqual(inline.simpleType.itemType.enumValues, ['X', 'Y']);
  assert.equal(inline.isEnum, undefined);
  assert.equal(builtin.simpleType.variety, 'list');
  assert.equal(builtin.simpleType.itemType.typeReference.name, 'NMTOKEN');
});

test('finite union members combine in order, deduplicate and include inline members with XML whitespace tokenization', async t => {
  const { parser } = await fixture(t);
  const tree = await parser.parse(schema(`
    <s:element name="Choice" type="t:Choice"/><s:element name="Alias" type="t:Alias"/>
    <s:simpleType name="Choice"><s:union memberTypes="  t:First&#9; t:Second&#10;">
      <s:simpleType><s:restriction base="s:string">${enumeration(['C', 'A'])}</s:restriction></s:simpleType>
    </s:union></s:simpleType>
    <s:simpleType name="Alias"><s:restriction base="t:Choice"/></s:simpleType>
    ${atomic('First', ['A', 'B'])}${atomic('Second', ['B', '', '\u540d'])}
  `));
  assert.deepEqual(tree.children[0].enumValues, ['A', 'B', '', '\u540d', 'C']);
  assert.deepEqual(tree.children[1].enumValues, tree.children[0].enumValues);
  assert.equal(tree.children[0].isEnum, true);
  assert.equal(tree.children[0].simpleType.variety, 'union');
  assert.equal(tree.children[0].simpleType.members.length, 3);
  assert.deepEqual(tree.children[0].simpleType.members[1].enumValues, ['B', '', '\u540d']);
});

test('infinite, list and unloaded union members never publish a misleading finite enum', async t => {
  const { parser } = await fixture(t);
  const tree = await parser.parse(schema(`
    <s:element name="Open" type="t:Open"/><s:element name="List" type="t:ListUnion"/>
    <s:element name="External" type="t:External"/><s:element name="Restricted" type="t:Restricted"/>
    <s:simpleType name="Open"><s:union memberTypes="t:Code s:string"/></s:simpleType>
    <s:simpleType name="ListUnion"><s:union memberTypes="t:Code s:IDREFS"/></s:simpleType>
    <s:simpleType name="External"><s:union memberTypes="t:Code f:Unknown"/></s:simpleType>
    ${atomic('Restricted', ['A'], 't:Open')}${atomic('Code', ['A', 'B'])}
  `, 'urn:test', 'xmlns:f="urn:unknown"'));
  for (const node of tree.children.slice(0, 3)) {
    assert.equal(node.isEnum, undefined);
    assert.equal(node.enumValues, undefined);
    assert.equal(node.simpleType.finite, false);
  }
  assert.equal(tree.children[1].simpleType.containsList, true);
  assert.equal(tree.children[2].unresolved, true);
  assert.equal(tree.children[2].simpleType.members[1].typeReference.namespace, 'urn:unknown');
  assert.deepEqual(tree.children[3].enumValues, ['A']);
});

test('inherited enums resolve across imports, chameleon includes and referenced global elements and refresh dependencies', async t => {
  const { parser, write } = await fixture(t);
  await write('main.xsd', schema(`
    <s:include schemaLocation="local.xsd"/><s:import namespace="urn:base" schemaLocation="base.xsd"/>
    <s:element ref="t:Shared"/><s:element name="Local" type="t:Local"/>
  `, 'urn:test'));
  await write('local.xsd', schema(`
    <s:import namespace="urn:base"/>
    <s:simpleType name="Local"><s:restriction base="b:Code"/></s:simpleType>
    <s:element name="Shared"><s:simpleType><s:restriction base="Local"/></s:simpleType></s:element>
  `, '', 'xmlns:b="urn:base"'));
  await write('base.xsd', schema(atomic('Code', ['A', 'B']), 'urn:base'));
  const tree = await parser.parseFile('main.xsd');
  assert.deepEqual(tree.children[0].enumValues, ['A', 'B']);
  assert.deepEqual(tree.children[1].enumValues, ['A', 'B']);
  assert.equal(tree.children[0].reference.name, 'Shared');
  await write('base.xsd', schema(atomic('Code', ['C', 'D']), 'urn:base'));
  const updated = await parser.parseFile('main.xsd');
  assert.deepEqual(updated.children[0].enumValues, ['C', 'D']);
  assert.deepEqual(updated.children[1].enumValues, ['C', 'D']);
});

test('simple-type self/mutual recursion and union/list cycles remain explicit and recover after errors', async t => {
  const { parser } = await fixture(t);
  const tree = await parser.parse(schema(`
    <s:element name="Self" type="t:Self"/><s:element name="Mutual" type="t:A"/>
    <s:element name="Union" type="t:Union"/><s:element name="List" type="t:List"/>
    <s:simpleType name="Self"><s:restriction base="t:Self"/></s:simpleType>
    <s:simpleType name="A"><s:restriction base="t:B"/></s:simpleType>
    <s:simpleType name="B"><s:restriction base="t:A"/></s:simpleType>
    <s:simpleType name="Union"><s:union memberTypes="t:Union s:string"/></s:simpleType>
    <s:simpleType name="List"><s:list itemType="t:List"/></s:simpleType>
  `));
  for (const node of tree.children) {
    assert.equal(node.recursive, true);
    assert.equal(node.kind, 'branch');
    assert.deepEqual(node.children, []);
    assert.equal(node.isEnum, undefined);
    assert.equal(node.typeReference.kind, 'simpleType');
  }
  await assert.rejects(parser.parse(schema('<s:element name="Bad" type="t:Bad"/><s:simpleType name="Bad"><s:restriction base="t:Missing"/></s:simpleType>')), /Unresolved local XSD simple type/);
  assert.deepEqual((await parser.parse(schema(`<s:element name="Recovered" type="t:Code"/>${atomic('Code', ['OK'])}`))).children[0].enumValues, ['OK']);
});

test('exact simple-resolution depth boundary emits metadata without pretending inherited enums are known', async t => {
  const { parser } = await fixture(t);
  const definitions = Array.from({ length: 9 }, (_, index) =>
    atomic(`T${index}`, index === 8 ? ['END'] : [], index === 8 ? 's:string' : `t:T${index + 1}`)).join('');
  const tree = await parser.parse(schema(`<s:element name="AtLimit" type="t:T0"/><s:element name="Within" type="t:T1"/>${definitions}`));
  assert.equal(tree.children[0].truncated, true);
  assert.equal(tree.children[0].truncationReason, 'depth');
  assert.equal(tree.children[0].isEnum, undefined);
  assert.equal(tree.children[0].kind, 'branch');
  assert.deepEqual(tree.children[1].enumValues, ['END']);
  assert.equal(tree.children[1].truncated, undefined);
});

test('invalid simple-type shapes, missing facets and nested-list items fail explicitly', async t => {
  const { parser } = await fixture(t);
  for (const body of [
    '<s:restriction/>', '<s:restriction base="t:Missing"/>',
    '<s:restriction base="s:string"><s:enumeration/></s:restriction>',
    '<s:restriction base="s:string"><s:simpleType><s:restriction base="s:string"/></s:simpleType></s:restriction>',
    '<s:list/>', '<s:union/>', '<s:restriction base="s:string"/><s:list itemType="s:string"/>',
    '<s:list itemType="s:string"><s:simpleType><s:restriction base="s:int"/></s:simpleType></s:list>',
    '<s:list itemType="s:NMTOKENS"/>',
    '<s:list><s:simpleType><s:union memberTypes="s:IDREFS s:string"/></s:simpleType></s:list>',
    '<s:restriction base="s:string"/><s:restriction base="s:int"/>'
  ]) {
    await assert.rejects(parser.parse(schema(`<s:element name="Bad" type="t:Bad"/><s:simpleType name="Bad">${body}</s:simpleType>`)),
      /XSD|Duplicate/, body);
  }
  await assert.rejects(parser.parse(schema('<s:element name="Bad" type="s:string"><s:simpleType><s:restriction base="s:int"/></s:simpleType></s:element>')), /inline type/);
});

test('XML attribute presence distinguishes empty enum strings from absent fields', () => {
  const bindings = createXmlBindings();
  const handle = bindings['host.xml_parse']('<r empty=""/>');
  assert.equal(bindings['host.xml_has_attribute'](handle, 0, 'empty'), 1);
  assert.equal(bindings['host.xml_has_attribute'](handle, 0, 'missing'), 0);
  assert.equal(bindings['host.xml_has_attribute'](handle, 0, 'constructor'), 0);
  assert.throws(() => bindings['host.xml_has_attribute'](handle, 0, 1), /attribute name/);
  const numeric = bindings['host.xml_parse']('<r value="&#65;&#x1F600;&#9; &amp;#65;">&#x540D; &amp;#65;<![CDATA[&#65;]]></r>');
  assert.equal(bindings['host.xml_attribute'](numeric, 0, 'value'), 'A\u{1f600}\t &#65;');
  assert.equal(bindings['host.xml_text'](numeric, 0), '\u540d &#65;&#65;');
  assert.throws(() => bindings['host.xml_parse']('<r>&nbsp;</r>'), /Unknown XML entity/);
});

test('UI describes list item enums and union membership without calling lists finite enums', () => {
  assert.equal(schemaSimpleTypeSummary({}), '');
  assert.equal(schemaSimpleTypeSummary({ simpleType: { variety: 'list', itemType: { enumValues: ['', 'A', '\u540d'] } } }),
    'list items: "", "A", "\u540d"');
  assert.equal(schemaSimpleTypeSummary({ simpleType: { variety: 'list' } }), 'list of simple values');
  assert.equal(schemaSimpleTypeSummary({ simpleType: { variety: 'union', members: [{}, {}] } }),
    'union: 2 member types');
});
