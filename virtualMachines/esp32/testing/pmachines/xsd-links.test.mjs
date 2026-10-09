import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createPascalishXsdParser } from '../../aggregator/src/librarian/~xsd-parser.mjs';
import { createFilesystemBindings } from '../../pmachines/javascript/src/filesystem-bindings.mjs';
import { createXmlBindings } from '../../pmachines/javascript/src/xml-bindings.mjs';

const xsd = 'http://www.w3.org/2001/XMLSchema';
const schema = (inner, namespace = 'urn:main', declarations = '') =>
  `<s:schema xmlns:s="${xsd}" ${namespace ? `targetNamespace="${namespace}" xmlns:t="${namespace}"` : ''} ${declarations}>${inner}</s:schema>`;
const leaves = node => [node, ...node.children.flatMap(leaves)].filter(item => item.kind === 'leaf');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-xsd-links-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const parser = await createPascalishXsdParser({ schemaRoot: root, logger: { warn() {} } });
  t.after(() => parser.stop());
  async function write(name, content) {
    const target = path.join(root, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
    return target;
  }
  return { root, parser, write };
}

test('XML document append preserves forest indices and QName scope and consumes the donor', () => {
  const bindings = createXmlBindings();
  const first = bindings['host.xml_parse']('<r xmlns:p="urn:first"><p:a/></r>');
  const second = bindings['host.xml_parse']('<r xmlns:p="urn:second"><p:b><p:c/></p:b></r>');
  assert.equal(bindings['host.xml_append_document'](first, second), 2);
  assert.equal(bindings['host.xml_count'](first), 5);
  assert.equal(bindings['host.xml_next_sibling'](first, 0), 2);
  assert.equal(bindings['host.xml_end'](first, 0), 2);
  assert.equal(bindings['host.xml_end'](first, 2), 5);
  assert.equal(bindings['host.xml_first_child'](first, 2), 3);
  assert.equal(bindings['host.xml_parent'](first, 4), 3);
  assert.equal(bindings['host.xml_parent'](first, 2), -1);
  assert.equal(bindings['host.xml_namespace'](first, 1), 'urn:first');
  assert.equal(bindings['host.xml_qname_namespace'](first, 3, 'p:T'), 'urn:second');
  assert.throws(() => bindings['host.xml_count'](second), /handle/);
  assert.throws(() => bindings['host.xml_append_document'](first, first), /itself/);
  const bounded = createXmlBindings({ maxNodes: 2 });
  const handle = bounded['host.xml_parse']('<r/>');
  const donor = bounded['host.xml_parse']('<r/>');
  bounded['host.xml_append_document'](handle, donor);
  assert.throws(() => bounded['host.xml_parse']('<r/>'), /capacity/);
});

test('generic relative paths stay confined and BOM-aware reads preserve strict existing UTF-8 behavior', async t => {
  const { root, write } = await fixture(t);
  await write('folder/base.xsd', '<r/>');
  await write('other.xsd', Buffer.from('\ufeff<r>\u540d</r>', 'utf16le'));
  const bigEndian = Buffer.from('\ufeff<r>BE</r>', 'utf16le');
  bigEndian.swap16();
  await write('be.xsd', bigEndian);
  await write('bad.xsd', Buffer.from([0xff]));
  const { handlers } = await createFilesystemBindings({ schemas: { path: root } });
  const resolve = reference => handlers['host.fs_resolve_relative']('schemas', 'folder/base.xsd', reference);
  assert.equal(await resolve('../other.xsd'), 'other.xsd');
  assert.equal(await resolve('./base.xsd'), 'folder/base.xsd');
  assert.equal(await handlers['host.fs_read_text_auto']('schemas', 'other.xsd'), '<r>\u540d</r>');
  assert.equal(await handlers['host.fs_read_text_auto']('schemas', 'be.xsd'), '<r>BE</r>');
  await assert.rejects(handlers['host.fs_read_text']('schemas', 'other.xsd'), /encoded data|encoding/i);
  await assert.rejects(handlers['host.fs_read_text_auto']('schemas', 'bad.xsd'), /encoded data|encoding/i);
  for (const reference of [
    '../../outside.xsd', 'https://example.invalid/file.xsd', 'file:///C:/outside.xsd',
    '//server/share/file.xsd', 'C:/outside.xsd', '%2e%2e/secret.xsd',
    'base.xsd?query=1', 'base.xsd#part', '..\\other.xsd', 'nul.xsd', 'base.xsd:stream'
  ]) await assert.rejects(resolve(reference), /Invalid|escapes/);
  await assert.rejects(handlers['host.fs_write_text']('schemas', 'new.xsd', 'denied'), /denied/);
});

test('Pascalish resolves nested chameleon includes, diamonds, cycles, imports and enum namespace identity', async t => {
  const { parser, write } = await fixture(t);
  await write('main.xsd', schema(`
    <s:include schemaLocation="parts/left.xsd"/><s:include schemaLocation="parts/right.xsd"/>
    <s:import namespace="urn:foreign" schemaLocation="foreign.xsd"/>
    <s:element name="Document" type="t:Record"/>
  `));
  await write('parts/left.xsd', schema('<s:include schemaLocation="./common.xsd"/>', ''));
  await write('parts/right.xsd', schema('<s:include schemaLocation="common.xsd"/>', ''));
  await write('parts/common.xsd', schema(`
    <s:include schemaLocation="../main.xsd"/>
    <s:complexType name="Record"><s:sequence>
      <s:element name="Local" type="Code"/><s:element ref="f:Shared" minOccurs="0"/>
    </s:sequence></s:complexType>
    <s:simpleType name="Code"><s:restriction base="s:string"><s:enumeration value="LOCAL"/></s:restriction></s:simpleType>
  `, '', 'xmlns:f="urn:foreign"'));
  await write('foreign.xsd', schema(`
    <s:element name="Shared" type="t:Record"/>
    <s:complexType name="Record"><s:sequence><s:element name="ForeignCode" type="t:Code"/></s:sequence></s:complexType>
    <s:simpleType name="Code"><s:restriction base="s:string"><s:enumeration value="FOREIGN"/></s:restriction></s:simpleType>
  `, 'urn:foreign'));
  const tree = await parser.parseFile('main.xsd');
  assert.equal(tree.children.length, 2, 'Entry and same-namespace included declarations are displayed; imports are not separate roots');
  assert.equal(tree.children[1].name, 'Record');
  const fields = leaves(tree.children[0]);
  assert.deepEqual(fields.map(node => node.name), ['Local', 'ForeignCode']);
  assert.deepEqual(fields[0].enumValues, ['LOCAL']);
  assert.deepEqual(fields[1].enumValues, ['FOREIGN']);
  const shared = tree.children[0].children[0].children[1];
  assert.equal(shared.required, false);
  assert.deepEqual(shared.reference, { kind: 'element', name: 'Shared', namespace: 'urn:foreign' });
  assert.equal(shared.typeReference.namespace, 'urn:foreign');
  assert.deepEqual(await parser.parseFile('./main.xsd'), tree);
  assert.equal(parser.getStatus().cachedEntries, 1);
});

test('one chameleon file may be instantiated in two different included namespaces', async t => {
  const { parser, write } = await fixture(t);
  await write('main.xsd', schema(`
    <s:include schemaLocation="common.xsd"/><s:import namespace="urn:second" schemaLocation="second.xsd"/>
    <s:element name="Main" type="t:Record"/><s:element name="Second" type="b:Record"/>
  `, 'urn:main', 'xmlns:b="urn:second"'));
  await write('second.xsd', schema('<s:include schemaLocation="common.xsd"/>', 'urn:second'));
  await write('common.xsd', schema(`
    <s:complexType name="Record"><s:sequence><s:element name="Id" type="s:string"/></s:sequence></s:complexType>
  `, ''));
  const tree = await parser.parseFile('main.xsd');
  assert.equal(tree.children[0].typeReference.namespace, 'urn:main');
  assert.equal(tree.children[1].typeReference.namespace, 'urn:second');
  assert.deepEqual(tree.children.slice(0, 2).flatMap(leaves).map(node => node.name), ['Id', 'Id']);
  await write('second.xsd', schema('<s:import namespace="urn:main" schemaLocation="common.xsd"/>', 'urn:second'));
  await assert.rejects(parser.parseFile('main.xsd'), /import namespace mismatch/);
});

test('explicit import of the no-namespace schema works; location-free imports stay unresolved', async t => {
  const { parser, write } = await fixture(t);
  await write('plain.xsd', schema('<s:element name="Shared" type="s:int"/>', ''));
  await write('main.xsd', schema(`
    <s:import schemaLocation="plain.xsd"/>
    <s:import namespace="urn:unknown"/>
    <s:element ref="Shared"/><s:element name="Unknown" type="u:Record"/>
  `, 'urn:main', 'xmlns:u="urn:unknown"'));
  const tree = await parser.parseFile('main.xsd');
  assert.equal(tree.children[0].kind, 'leaf');
  assert.equal(tree.children[0].reference.namespace, '');
  assert.equal(tree.children[1].unresolved, true);
  assert.deepEqual(tree.children[1].children, []);
  await write('main.xsd', schema('<s:import namespace="urn:unknown" schemaLocation="missing.xsd"/>'));
  await assert.rejects(parser.parseFile('main.xsd'), /ENOENT/);
});

test('dependency hashes invalidate same-size same-mtime edits; cache never hides missing or corrupt dependencies', async t => {
  const { parser, write } = await fixture(t);
  await write('main.xsd', schema('<s:include schemaLocation="types.xsd"/><s:element name="Document" type="t:Record"/>'));
  const target = await write('types.xsd', schema('<s:complexType name="Record"><s:sequence><s:element name="Old" type="s:string"/></s:sequence></s:complexType>'));
  const original = await fs.readFile(target, 'utf8');
  const timestamps = await fs.stat(target);
  const initial = await Promise.all(Array.from({ length: 30 }, () => parser.parseFile('main.xsd')));
  assert.equal(leaves(initial[0])[0].name, 'Old');
  initial[0].children[0].name = 'Modified';
  assert.equal(initial[1].children[0].name, 'Document');
  await fs.writeFile(target, original.replace('Old', 'New'));
  await fs.utimes(target, timestamps.atime, timestamps.mtime);
  assert.equal(leaves(await parser.parseFile('main.xsd'))[0].name, 'New');
  await fs.writeFile(target, '<broken>');
  await assert.rejects(parser.parseFile('main.xsd'), /Invalid XML/);
  await fs.rm(target);
  await assert.rejects(parser.parseFile('main.xsd'), /ENOENT/);
  await fs.writeFile(target, original);
  assert.equal(leaves(await parser.parseFile('main.xsd'))[0].name, 'Old');
  assert.ok(parser.getStatus().cachedBytes > 0);
  await parser.stop();
  await assert.rejects(parser.parseFile('main.xsd'), /stopped/);
});

test('same entry content in different directories cannot share the wrong relative dependency tree', async t => {
  const { parser, write } = await fixture(t);
  const entry = schema('<s:include schemaLocation="types.xsd"/><s:element name="Document" type="t:Record"/>');
  await write('first/main.xsd', entry);
  await write('second/main.xsd', entry);
  for (const [folder, name] of [['first', 'First'], ['second', 'Second']]) {
    await write(`${folder}/types.xsd`, schema(`<s:complexType name="Record"><s:sequence><s:element name="${name}" type="s:string"/></s:sequence></s:complexType>`));
  }
  assert.equal(leaves(await parser.parseFile('first/main.xsd'))[0].name, 'First');
  assert.equal(leaves(await parser.parseFile('second/main.xsd'))[0].name, 'Second');
});

test('link namespace mismatches, duplicates, unsupported base rewriting and malformed targets fail explicitly', async t => {
  const { parser, write } = await fixture(t);
  await write('foreign.xsd', schema('<s:complexType name="Record"/>', 'urn:foreign'));
  await write('plain.xml', '<not-a-schema/>');
  await write('types.xsd', schema('<s:complexType name="Same"/>'));
  for (const [inner, expected] of [
    ['<s:include schemaLocation="foreign.xsd"/>', /include namespace mismatch/],
    ['<s:import namespace="urn:other" schemaLocation="foreign.xsd"/>', /import namespace mismatch/],
    ['<s:import namespace="urn:main" schemaLocation="types.xsd"/>', /different namespace/],
    ['<s:include/>', /requires schemaLocation/],
    ['<s:include schemaLocation="plain.xml"/>', /not a schema/],
    ['<s:include schemaLocation="types.xsd"/><s:complexType name="Same"/>', /Duplicate/],
    ['<s:redefine schemaLocation="types.xsd"/>', /not supported/],
    ['<s:override schemaLocation="types.xsd"/>', /not supported/],
    ['<s:include xml:base="nested/" schemaLocation="types.xsd"/>', /xml:base/]
  ]) {
    await write('main.xsd', schema(inner));
    await assert.rejects(parser.parseFile('main.xsd'), expected);
  }
  await write('main.xsd', schema('<s:element name="Recovered" type="s:string"/>'));
  assert.equal((await parser.parseFile('main.xsd')).children[0].name, 'Recovered');
});

test('network, traversal, ADS and encoded locations are denied without leaving the schema-root grant', async t => {
  const { parser, write } = await fixture(t);
  for (const location of [
    '../outside.xsd', 'https://example.invalid/never-requested.xsd', 'file:///C:/outside.xsd',
    '//server/share/schema.xsd', 'C:/outside.xsd', '%2e%2e/outside.xsd',
    'types.xsd:secret', 'types.xsd?query=1', 'types.xsd#fragment', '..\\outside.xsd'
  ]) {
    await write('main.xsd', schema(`<s:include schemaLocation="${location}"/>`));
    await assert.rejects(parser.parseFile('main.xsd'), /Invalid|escapes/);
  }
  await assert.rejects(parser.parseFile('../outside.xsd'), /escapes/);
});

test('linked graph document and aggregate XML byte capacities are hard failures', async t => {
  const { parser, write } = await fixture(t);
  for (let index = 0; index < 17; index++) {
    await write(`file${index}.xsd`, schema(index < 16 ? `<s:include schemaLocation="file${index + 1}.xsd"/>` : '<s:element name="Id" type="s:string"/>'));
  }
  await assert.rejects(parser.parseFile('file0.xsd'), /linked document capacity/);
  assert.equal((await parser.parseFile('file1.xsd')).children[0].name, 'Id', 'Exactly 16 documents, including an include-only entry, succeed');
  const padding = 'x'.repeat(510000);
  await write('large0.xsd', schema(`<s:include schemaLocation="large1.xsd"/><!--${padding}-->`));
  await write('large1.xsd', schema(`<s:element name="Id" type="s:string"/><!--${padding}-->`));
  await assert.rejects(parser.parseFile('large0.xsd'), /XML document capacity/);
});

test('linked files decode UTF-16 BOMs and links/hardlinks are refused even after a successful cache fill', async t => {
  const { parser, write, root } = await fixture(t);
  await write('main.xsd', schema('<s:include schemaLocation="types.xsd"/><s:element name="Document" type="t:Record"/>'));
  const included = schema('<s:complexType name="Record"><s:sequence><s:element name="Id" type="s:string"/></s:sequence></s:complexType>');
  const target = await write('types.xsd', Buffer.from(`\ufeff${included}`, 'utf16le'));
  assert.equal(leaves(await parser.parseFile('main.xsd'))[0].name, 'Id');
  const alias = path.join(root, 'hardlink.xsd');
  await fs.link(target, alias);
  await assert.rejects(parser.parseFile('main.xsd'), /hard links/);
  await fs.rm(alias);
  assert.equal(leaves(await parser.parseFile('main.xsd'))[0].name, 'Id');
  const directory = path.join(root, 'real');
  await fs.mkdir(directory);
  await fs.writeFile(path.join(directory, 'types.xsd'), included);
  const junction = path.join(root, 'linked');
  await fs.symlink(directory, junction, process.platform === 'win32' ? 'junction' : 'dir');
  await write('main.xsd', schema('<s:include schemaLocation="linked/types.xsd"/>'));
  await assert.rejects(parser.parseFile('main.xsd'), /links are not allowed/);
});

test('cross-document recursive element refs remain finite and definitions require a declared import', async t => {
  const { parser, write } = await fixture(t);
  await write('main.xsd', schema(`
    <s:import namespace="urn:other" schemaLocation="other.xsd"/>
    <s:element name="Document"><s:complexType><s:sequence><s:element ref="b:Other"/></s:sequence></s:complexType></s:element>
  `, 'urn:main', 'xmlns:b="urn:other"'));
  await write('other.xsd', schema(`
    <s:import namespace="urn:main" schemaLocation="main.xsd"/>
    <s:element name="Other"><s:complexType><s:sequence><s:element ref="a:Document" minOccurs="0"/></s:sequence></s:complexType></s:element>
  `, 'urn:other', 'xmlns:a="urn:main"'));
  const tree = await parser.parseFile('main.xsd');
  const other = tree.children[0].children[0].children[0].children[0];
  const cycle = other.children[0].children[0].children[0];
  assert.equal(cycle.recursive, true);
  assert.deepEqual(cycle.children, []);
  assert.equal(cycle.reference.namespace, 'urn:main');
  await write('extra.xsd', schema(`
    <s:element name="Bad" type="b:Missing"/>
  `, 'urn:extra', 'xmlns:b="urn:other"'));
  await write('main.xsd', schema(`
    <s:import namespace="urn:other" schemaLocation="other.xsd"/>
    <s:import namespace="urn:extra" schemaLocation="extra.xsd"/>
    <s:element ref="e:Bad"/>
  `, 'urn:main', 'xmlns:e="urn:extra"'));
  await write('other.xsd', schema('<s:complexType name="Missing"/>', 'urn:other'));
  const unresolved = await parser.parseFile('main.xsd');
  assert.equal(unresolved.children[0].unresolved, true, 'Loading the namespace elsewhere does not grant an undeclared import');
});
