import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createPascalishXsdParser } from '../../aggregator/src/librarian/xsd-parser.mjs';
import { isSchemaBranch, schemaNodeNotice } from '../../aggregator/src/librarian/schema-tree.mjs';

const ns = 'http://www.w3.org/2001/XMLSchema';
const schema = inner => `<s:schema xmlns:s="${ns}" xmlns:t="urn:test" xmlns:alias="urn:test" xmlns:f="urn:foreign" targetNamespace="urn:test">${inner}</s:schema>`;
const typeReference = name => ({ kind: 'complexType', name, namespace: 'urn:test' });
const leaf = (name, valueType = 's:string', required = true) => ({ name, kind: 'leaf', valueType, required, children: [] });
async function parser(t) {
  const instance = await createPascalishXsdParser({
    logger: { warn() {} }, schemaRoot: fileURLToPath(new URL('../../aggregator/data/services/librarian/schemas/', import.meta.url))
  });
  t.after(() => instance.stop());
  return instance;
}
function descendants(tree) {
  return [tree, ...tree.children.flatMap(descendants)];
}

test('forward complex types expand per occurrence and namespace aliases resolve by identity', async t => {
  const instance = await parser(t);
  const tree = await instance.parse(schema(`
    <s:element name="Document"><s:complexType><s:sequence>
      <s:element name="First" type="t:Record"/><s:element name="Second" type="alias:Record" minOccurs="0"/>
    </s:sequence></s:complexType></s:element>
    <s:complexType name="Record"><s:sequence><s:element name="Id" type="s:string"/></s:sequence></s:complexType>
  `));
  const [first, second] = tree.children[0].children[0].children[0].children;
  assert.equal(first.kind, 'branch');
  assert.deepEqual(first.typeReference, typeReference('Record'));
  assert.deepEqual(first.children[0].children, [leaf('Id')]);
  assert.deepEqual(second.children, first.children);
  assert.equal(second.required, false);
  assert.equal(second.recursive, undefined);
  assert.equal(tree.children[1].name, 'Record');
  assert.equal(tree.children[1].valueType, 'complextype');
});

test('global element refs inherit declaration content and QName scope but preserve occurrence optionality', async t => {
  const instance = await parser(t);
  const tree = await instance.parse(schema(`
    <s:element name="Document"><s:complexType><s:sequence>
      <s:element xmlns:alias="urn:other" ref="t:Shared" minOccurs="0"/>
    </s:sequence></s:complexType></s:element>
    <s:element name="Shared" type="alias:Record"/>
    <s:complexType name="Record"><s:sequence><s:element name="Id" type="s:string"/></s:sequence></s:complexType>
  `));
  const shared = tree.children[0].children[0].children[0].children[0];
  assert.equal(shared.name, 'Shared');
  assert.equal(shared.required, false);
  assert.equal(shared.valueType, 'alias:Record');
  assert.deepEqual(shared.reference, { kind: 'element', name: 'Shared', namespace: 'urn:test' });
  assert.deepEqual(shared.typeReference, typeReference('Record'));
  assert.deepEqual(shared.children[0].children, [leaf('Id')]);
  const noNamespace = await instance.parse(`<s:schema xmlns:s="${ns}">
    <s:element name="Root"><s:complexType><s:sequence><s:element ref="Shared"/></s:sequence></s:complexType></s:element>
    <s:element name="Shared" type="s:int"/>
  </s:schema>`);
  const child = noNamespace.children[0].children[0].children[0].children[0];
  assert.deepEqual(child, { ...leaf('Shared', 's:int'), reference: { kind: 'element', name: 'Shared', namespace: '' } });
});

test('self and mutual type recursion stop at explicit branch references, not scalar leaves', async t => {
  const instance = await parser(t);
  const tree = await instance.parse(schema(`
    <s:element name="Document" type="t:A"/>
    <s:complexType name="A"><s:sequence><s:element name="Next" type="t:B"/></s:sequence></s:complexType>
    <s:complexType name="B"><s:sequence><s:element name="Back" type="t:A" minOccurs="0"/></s:sequence></s:complexType>
  `));
  const back = descendants(tree.children[0]).find(node => node.name === 'Back');
  assert.equal(back.recursive, true);
  assert.equal(back.kind, 'branch');
  assert.equal(back.required, false);
  assert.deepEqual(back.typeReference, typeReference('A'));
  assert.deepEqual(back.children, []);
  const self = await instance.parse(schema(`
    <s:element name="Node"><s:complexType><s:sequence>
      <s:element ref="t:Node" minOccurs="0"/>
    </s:sequence></s:complexType></s:element>
  `));
  const reference = self.children[0].children[0].children[0].children[0];
  assert.equal(reference.recursive, true);
  assert.equal(reference.kind, 'branch');
  assert.equal(reference.required, false);
  assert.deepEqual(reference.children, []);
});

test('complex-content extensions include base fields and cyclic bases remain explicit', async t => {
  const instance = await parser(t);
  const tree = await instance.parse(schema(`
    <s:element name="Document" type="t:Derived"/>
    <s:complexType name="Derived"><s:complexContent><s:extension base="alias:Base">
      <s:sequence><s:element name="Extra" type="s:int"/></s:sequence>
    </s:extension></s:complexContent></s:complexType>
    <s:complexType name="Base"><s:sequence><s:element name="Id" type="s:string"/></s:sequence></s:complexType>
  `));
  assert.deepEqual(descendants(tree.children[0]).filter(node => node.kind === 'leaf').map(node => node.name), ['Id', 'Extra']);
  const cyclic = await instance.parse(schema(`
    <s:element name="Document" type="t:A"/>
    <s:complexType name="A"><s:complexContent><s:extension base="t:B"/></s:complexContent></s:complexType>
    <s:complexType name="B"><s:complexContent><s:extension base="t:A"/></s:complexContent></s:complexType>
  `));
  assert.ok(descendants(cyclic.children[0]).some(node => node.recursive && node.typeReference.name === 'A'));
});

test('missing local references and invalid ref declarations fail while external references remain visible', async t => {
  const instance = await parser(t);
  for (const inner of [
    '<s:element ref="t:Missing"/>',
    '<s:element name="Missing" type="t:Missing"/>',
    '<s:element name="Wrong" ref="t:Shared"/><s:element name="Shared" type="s:string"/>',
    '<s:element ref="t:Shared" type="s:string"/><s:element name="Shared" type="s:string"/>',
    '<s:element ref="t:Shared"/><s:element name="Shared"/><s:element name="Shared"/>',
    '<s:complexType name="Same"/><s:complexType name="Same"/>',
    '<s:complexType name="Same"/><s:simpleType name="Same"/>'
  ]) {
    await assert.rejects(instance.parse(schema(inner)), /Unresolved local|Duplicate|cannot also/);
  }
  const external = await instance.parse(schema('<s:element ref="f:Shared"/><s:element name="Foreign" type="f:Record"/>'));
  for (const node of external.children) {
    assert.equal(node.unresolved, true);
    assert.equal(node.kind, 'branch');
    assert.deepEqual(node.children, []);
  }
  assert.equal(external.children[0].reference.namespace, 'urn:foreign');
  assert.equal(external.children[1].typeReference.namespace, 'urn:foreign');
  assert.equal((await instance.parse(schema('<s:element name="Recovered" type="s:string"/>'))).children[0].name, 'Recovered');
});

test('depth limit and 1000-node expansion admission yield explicit truncation without dropping siblings', async t => {
  const instance = await parser(t);
  const definitions = Array.from({ length: 20 }, (_, index) =>
    `<s:complexType name="T${index}"><s:sequence><s:element name="Next${index}" type="${index < 19 ? `t:T${index + 1}` : 's:string'}"/></s:sequence></s:complexType>`).join('');
  const deep = await instance.parse(schema(`<s:element name="Document" type="t:T0"/>${definitions}`));
  const cuts = descendants(deep.children[0]).filter(node => node.truncated);
  assert.equal(cuts.length, 1);
  assert.equal(cuts[0].name, 'Next3');
  assert.deepEqual(cuts[0].typeReference, typeReference('T4'));
  for (const node of cuts) {
    assert.equal(node.truncationReason, 'depth');
    assert.equal(node.kind, 'branch');
    assert.deepEqual(node.children, []);
  }
  const fields = Array.from({ length: 998 }, (_, index) => `<s:element name="F${index}" type="s:string"/>`).join('');
  const wide = await instance.parse(schema(`
    <s:element name="Document" type="t:Wide"/>
    <s:complexType name="Wide"><s:sequence>${fields}<s:element name="Tail" type="t:Child"/></s:sequence></s:complexType>
    <s:complexType name="Child"><s:sequence><s:element name="Id" type="s:string"/></s:sequence></s:complexType>
  `));
  const sequence = wide.children[0].children[0];
  assert.equal(sequence.children.length, 999);
  assert.deepEqual(sequence.children[997], leaf('F997'));
  const tail = sequence.children[998];
  assert.equal(tail.truncated, true);
  assert.equal(tail.truncationReason, 'nodes');
  assert.deepEqual(tail.typeReference, typeReference('Child'));
  assert.deepEqual(tail.children, []);
  assert.equal(wide.children.length, 3);
});

test('UI and accessibility distinguish unexpanded reference branches from scalar leaves', () => {
  assert.equal(schemaNodeNotice({ recursive: true }), 'recursive reference');
  assert.equal(schemaNodeNotice({ truncated: true, truncationReason: 'depth' }), 'expansion limited (depth)');
  assert.equal(schemaNodeNotice({ unresolved: true }), 'unresolved external reference');
  assert.equal(schemaNodeNotice(leaf('Id')), '');
  for (const node of [{ recursive: true }, { truncated: true }, { unresolved: true }, { kind: 'branch' }]) {
    assert.equal(isSchemaBranch({ ...node, children: [] }), true);
  }
  assert.equal(isSchemaBranch(leaf('Id')), false);
});
