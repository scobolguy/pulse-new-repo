import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-librarian-http-catalog-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const legacy = [{ id: 'legacy-type', label: 'Legacy', builtin: false, isIso: false }];
  await fs.writeFile(path.join(root, 'data-types.json'), JSON.stringify(legacy));
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });

  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const entry = fileURLToPath(new URL('../../aggregator/data-librarian.mjs', import.meta.url));
  const child = spawn(process.execPath, [entry], {
    cwd: path.dirname(entry),
    env: { ...process.env, LIBRARIAN_DATA_ROOT: root, LIBRARIAN_PORT: String(port), LIBRARIAN_CATALOG_MAX_BYTES: '262144' },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  t.after(() => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  }));
  const origin = `http://127.0.0.1:${port}`;
  const startupDeadline = Date.now() + 15000;
  while (Date.now() < startupDeadline) {
    if (child.exitCode !== null) throw new Error(`Librarian startup failed: ${errors}`);
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return { root, origin, catalogRoot: path.join(root, 'services', 'librarian'), legacy };
    } catch {
      // Retry connection failures only during child startup.
    }
    await delay(50);
  }
  throw new Error(`Librarian startup timeout: ${errors}`);
}

test('HTTP catalog errors never silently reset persisted data; valid raw imports use Pascalish storage', async t => {
  const { origin, root, catalogRoot, legacy } = await fixture(t);
  const get = endpoint => fetch(`${origin}${endpoint}`);
  const migrated = await get('/api/librarian/data-types');
  assert.equal(migrated.status, 200);
  const normalized = [{
    ...legacy[0], logicalId: 'legacy-type', canonicalId: 'type:legacy-type',
    aliases: ['legacy-type', 'type:legacy-type']
  }];
  assert.deepEqual((await migrated.json()).types, normalized);
  await assert.rejects(fs.stat(path.join(root, 'data-types.json')), error => error.code === 'ENOENT');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(catalogRoot, 'data-types.json'), 'utf8')), normalized);

  for (const [name, endpoint, valid, invalid] of [
    ['subschemas', '/api/librarian/subschemas', [], {}],
    ['data-types', '/api/librarian/data-types', legacy, {}],
    ['mapper-rulesets', '/api/librarian/mapper-rulesets', [], {}],
    ['schema-lifecycle', '/api/librarian/schemas', {}, []]
  ]) {
    const file = path.join(catalogRoot, `${name}.json`);
    for (const bad of ['not JSON', 'null', JSON.stringify(invalid)]) {
      await fs.writeFile(file, bad);
      const response = await get(endpoint);
      assert.equal(response.status, 500, `${name}: corrupt catalog must not become empty`);
      assert.equal(typeof (await response.json()).error, 'string');
      assert.equal(await fs.readFile(file, 'utf8'), bad);
    }
    await fs.writeFile(file, JSON.stringify(valid));
    assert.equal((await get(endpoint)).status, 200);
  }
  const file = path.join(catalogRoot, 'data-types.json');
  await fs.writeFile(file, 'broken');
  const update = await fetch(`${origin}/api/librarian/data-types`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'new-type', label: 'New' })
  });
  assert.equal(update.status, 500);
  assert.equal(await fs.readFile(file, 'utf8'), 'broken');

  const upload = text => fetch(`${origin}/api/librarian/upload/data`, {
    method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-filename': 'data-types.json' },
    body: text
  });
  const content = '[\n\t{"id":"imported","label":"Imported","builtin":false,"isIso":false}\n]\n';
  assert.equal((await upload(content)).status, 200);
  assert.equal(await fs.readFile(file, 'utf8'), content);
  assert.equal((await upload('not JSON')).status, 500);
  assert.equal(await fs.readFile(file, 'utf8'), content);
  assert.equal((await upload(Buffer.from([0xff]))).status, 500);
  assert.equal(await fs.readFile(file, 'utf8'), content);
  assert.equal((await upload(JSON.stringify(['x'.repeat(262145)]))).status, 500);
  assert.equal(await fs.readFile(file, 'utf8'), content);
  assert.deepEqual((await fs.readdir(catalogRoot)).filter(name => name.startsWith('.pulse-')), []);
});

test('remaining catalog HTTP mutations preserve concurrent creates, merged updates, duplicates and lifecycles', async t => {
  const { origin, catalogRoot } = await fixture(t);
  const request = async (method, endpoint, body) => {
    const response = await fetch(`${origin}/api/librarian/${endpoint}`, {
      method, headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  };
  const initialTypes = await request('GET', 'data-types');
  assert.equal(initialTypes.status, 200);
  const createTypes = await Promise.all(Array.from({ length: 24 }, (_, index) =>
    request('POST', 'data-types', { id: `concurrent-${index}`, label: `Type ${index}` })));
  for (const result of createTypes) assert.equal(result.status, 200, JSON.stringify(result.body));
  const types = await request('GET', 'data-types');
  assert.equal(types.body.types.length, 25);
  for (let index = 0; index < 24; index += 1) assert.ok(types.body.types.some(type => type.id === `concurrent-${index}`));
  const duplicateTypes = await Promise.all(Array.from({ length: 12 }, () =>
    request('POST', 'data-types', { id: 'duplicate', label: 'Duplicate' })));
  assert.equal(duplicateTypes.filter(result => result.status === 200).length, 1);
  assert.equal(duplicateTypes.filter(result => result.status === 409).length, 11);
  const typeUpdates = await Promise.all([
    request('PATCH', 'data-types/concurrent-0', { label: 'Changed' }),
    request('PATCH', 'data-types/concurrent-0', { isIso: true })
  ]);
  for (const result of typeUpdates) assert.equal(result.status, 200);
  const updatedType = (await request('GET', 'data-types')).body.types.find(type => type.id === 'concurrent-0');
  assert.equal(updatedType.label, 'Changed');
  assert.equal(updatedType.isIso, true);
  const typeRenames = await Promise.all(['concurrent-1', 'concurrent-2'].map(id =>
    request('POST', `data-types/${id}/rename`, { newId: 'one-rename' })));
  assert.deepEqual(typeRenames.map(result => result.status).sort(), [200, 409]);

  const ruleset = index => ({ id: `RULE_${index}`, label: `Rule ${index}`, sourcePatterns: ['a.*'], targetPatterns: ['b.*'] });
  const createRules = await Promise.all(Array.from({ length: 24 }, (_, index) =>
    request('POST', 'mapper-rulesets', ruleset(index))));
  for (const result of createRules) assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal((await request('GET', 'mapper-rulesets')).body.rulesets.length, 24);
  const ruleUpdates = await Promise.all([
    request('PUT', 'mapper-rulesets/RULE_0', { description: 'Concurrent description' }),
    request('PUT', 'mapper-rulesets/RULE_0', { priority: 17 })
  ]);
  for (const result of ruleUpdates) assert.equal(result.status, 200);
  const updatedRule = (await request('GET', 'mapper-rulesets')).body.rulesets.find(rule => rule.id === 'RULE_0');
  assert.equal(updatedRule.description, 'Concurrent description');
  assert.equal(updatedRule.priority, 17);
  const duplicateRules = await Promise.all(Array.from({ length: 12 }, () =>
    request('POST', 'mapper-rulesets', ruleset('DUPLICATE'))));
  assert.equal(duplicateRules.filter(result => result.status === 200).length, 1);
  assert.equal(duplicateRules.filter(result => result.status === 409).length, 11);
  const ruleDeletes = await Promise.all(Array.from({ length: 24 }, (_, index) =>
    request('DELETE', `mapper-rulesets/RULE_${index}`)));
  for (const result of ruleDeletes) assert.equal(result.status, 200);
  assert.deepEqual((await request('GET', 'mapper-rulesets')).body.rulesets.map(rule => rule.id), ['RULE_DUPLICATE']);

  const paths = Array.from({ length: 24 }, (_, index) => `lifecycle-${index}.json`);
  await Promise.all(paths.map(name => fs.writeFile(path.join(catalogRoot, 'schemas', name), '{}')));
  const lifecycleResults = await Promise.all(paths.map(schemaPath => request('POST', 'schema-lifecycle', {
    path: schemaPath, activeFrom: '2020-01-01', rejectAfter: '2100-01-01', keepForDisplay: false
  })));
  for (const result of lifecycleResults) assert.equal(result.status, 200, JSON.stringify(result.body));
  const lifecycles = JSON.parse(await fs.readFile(path.join(catalogRoot, 'schema-lifecycle.json'), 'utf8'));
  assert.deepEqual(Object.keys(lifecycles).sort(), [...paths].sort());
  for (const lifecycle of Object.values(lifecycles)) {
    assert.deepEqual(lifecycle, { activeFrom: '2020-01-01T00:00:00.000Z', rejectAfter: '2100-01-01T00:00:00.000Z', keepForDisplay: false });
  }
  const rename = await request('POST', 'schemas/rename', { path: paths[0], newName: 'renamed-lifecycle' });
  assert.equal(rename.status, 200);
  const remove = await request('DELETE', 'schemas', { path: paths[1] });
  assert.equal(remove.status, 200);
  const changed = JSON.parse(await fs.readFile(path.join(catalogRoot, 'schema-lifecycle.json'), 'utf8'));
  assert.equal(Object.hasOwn(changed, paths[0]), false);
  assert.equal(Object.hasOwn(changed, paths[1]), false);
  assert.deepEqual(changed['renamed-lifecycle.json'], lifecycles[paths[0]]);
  assert.equal(Object.keys(changed).length, 23);
});

test('catalog projection does not enqueue an entire large catalog beyond host capacity', async t => {
  const { origin, catalogRoot } = await fixture(t);
  const names = Array.from({ length: 9 }, (_, index) => `Field${index}`);
  await fs.writeFile(path.join(catalogRoot, 'schemas', 'many.json'), JSON.stringify({
    type: 'object', properties: Object.fromEntries(names.map(name => [name, { type: 'string' }]))
  }));
  const definitions = Array.from({ length: 300 }, (_, index) => ({
    id: `sub-${index}`, label: `Sub ${index}`, parentSchemaPath: 'many.json',
    accessibleFields: names.filter((name, bit) => ((index + 1) & (1 << bit)) !== 0)
  }));
  await fs.writeFile(path.join(catalogRoot, 'subschemas.json'), JSON.stringify(definitions));
  const response = await fetch(`${origin}/api/librarian/subschemas`);
  assert.equal(response.status, 200);
  const { subschemas } = await response.json();
  assert.equal(subschemas.length, 300);
  for (let index = 0; index < definitions.length; index += 1) {
    assert.equal(subschemas[index].name, definitions[index].id);
    assert.deepEqual(subschemas[index].availableFields, names);
    assert.deepEqual(subschemas[index].structure.children.map(node => node.name), definitions[index].accessibleFields);
  }
});

test('lifecycle validation failures never mutate persisted catalogs and status applies to virtual schemas', async t => {
  const { origin, catalogRoot } = await fixture(t);
  await fs.writeFile(path.join(catalogRoot, 'schemas', 'lifecycle.json'), JSON.stringify({ A: 'value' }));
  const post = async body => {
    const response = await fetch(`${origin}/api/librarian/schema-lifecycle`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'lifecycle.json', ...body })
    });
    return { status: response.status, body: await response.json() };
  };
  const saved = await post({ activeFrom: '2100-01-01', keepForDisplay: false });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.lifecycle.status, 'scheduled');
  const file = path.join(catalogRoot, 'schema-lifecycle.json');
  const previous = await fs.readFile(file, 'utf8');
  for (const [candidate, message] of [
    [{ activeFrom: 'bad', rejectAfter: 'bad' }, 'activeFrom must be a valid date/time'],
    [{ rejectAfter: {} }, 'rejectAfter must be a valid date/time'],
    [{ activeFrom: '2020-01-01', rejectAfter: '2020-01-01' }, 'rejectAfter must be later than activeFrom']
  ]) {
    assert.deepEqual(await post(candidate), { status: 400, body: { error: message } });
    assert.equal(await fs.readFile(file, 'utf8'), previous);
  }
  await fs.writeFile(path.join(catalogRoot, 'subschemas.json'), JSON.stringify([{
    id: 'virtual', parentSchemaPath: 'lifecycle.json', accessibleFields: ['A']
  }]));
  const listed = await fetch(`${origin}/api/librarian/schemas`);
  assert.equal(listed.status, 200);
  const catalog = await listed.json();
  assert.equal(catalog.schemas.length, 2);
  for (const schema of catalog.schemas) assert.deepEqual(schema.lifecycle, saved.body.lifecycle);
});

test('projection budget failures do not persist an unreturnable subschema definition', async t => {
  const { origin, catalogRoot } = await fixture(t);
  const properties = Object.fromEntries(['a', 'b', 'c'].map(value => [value.repeat(180000), { type: 'string' }]));
  const schema = { type: 'object', properties: { A: { type: 'object', properties } } };
  await fs.writeFile(path.join(catalogRoot, 'schemas', 'large.json'), JSON.stringify(schema));
  const fields = await fetch(`${origin}/api/librarian/schema-fields?path=large.json`);
  assert.equal(fields.status, 200);
  assert.equal((await fields.json()).availableFields.length, 4);
  const create = await fetch(`${origin}/api/librarian/subschemas`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'oversize', parentSchemaPath: 'large.json', accessibleFields: ['A'] })
  });
  assert.equal(create.status, 503);
  assert.match((await create.json()).error, /capacity exceeded/i);
  await assert.rejects(fs.stat(path.join(catalogRoot, 'subschemas.json')), error => error.code === 'ENOENT');
  const list = await fetch(`${origin}/api/librarian/subschemas`);
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).subschemas, []);
});

test('HTTP XSD listing, UTF-16, subschema paths, malformed input and recovery use Pascalish parsing', async t => {
  const { origin, catalogRoot } = await fixture(t);
  const content = `<s:schema xmlns:s="http://www.w3.org/2001/XMLSchema"><s:element name="Document">
    <s:annotation><s:documentation>Ignored nesting</s:documentation></s:annotation>
    <s:complexType><s:sequence><s:element name='Id' type='s:string' minOccurs='0'/></s:sequence></s:complexType>
  </s:element></s:schema>`;
  const schemas = path.join(catalogRoot, 'schemas');
  await Promise.all(Array.from({ length: 24 }, (_, index) =>
    fs.writeFile(path.join(schemas, `fixture-${index}.xsd`), content)));
  const file = path.join(schemas, 'utf16.xsd');
  await fs.writeFile(file, Buffer.from(`\ufeff${content}`, 'utf16le'));
  const list = await fetch(`${origin}/api/librarian/schemas`);
  assert.equal(list.status, 200);
  const listed = (await list.json()).schemas;
  assert.equal(listed.length, 25);
  const structure = listed.find(item => item.path === 'utf16.xsd').structure;
  assert.equal(structure.children[0].children[0].children[0].children[0].name, 'Id');
  assert.equal(structure.children[0].children[0].children[0].children[0].required, false);
  const fieldMetadata = await fetch(`${origin}/api/librarian/schema-fields?path=utf16.xsd`);
  assert.equal(fieldMetadata.status, 200);
  assert.deepEqual(await fieldMetadata.json(), { path: 'utf16.xsd', availableFields: ['Document', 'Document.Id'] });
  assert.equal(Object.hasOwn(listed.find(item => item.path === 'utf16.xsd'), 'availableFields'), false);
  for (const [query, status] of [['', 400], ['?path=missing.xsd', 404],
    ['?path=..%2Foutside.xsd', 404], ['?path=utf16.xsd&path=other.xsd', 400]]) {
    const response = await fetch(`${origin}/api/librarian/schema-fields${query}`);
    assert.equal(response.status, status);
    assert.equal(typeof (await response.json()).error, 'string');
  }
  const post = definition => fetch(`${origin}/api/librarian/subschemas`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(definition)
  });
  const valid = await post({ id: 'xsd-sub', parentSchemaPath: 'utf16.xsd', accessibleFields: ['Document.Id'] });
  assert.equal(valid.status, 201, JSON.stringify(await valid.json()));
  const invalid = await post({ id: 'bad-xsd-sub', parentSchemaPath: 'utf16.xsd', accessibleFields: ['Document.Missing'] });
  assert.equal(invalid.status, 400);
  await fs.writeFile(file, '<s:schema>');
  const malformed = await fetch(`${origin}/api/librarian/schemas`);
  assert.equal(malformed.status, 500);
  assert.match((await malformed.json()).error, /Invalid XML|Unbound/);
  const malformedFields = await fetch(`${origin}/api/librarian/schema-fields?path=utf16.xsd`);
  assert.equal(malformedFields.status, 500);
  assert.match((await malformedFields.json()).error, /Invalid XML|Unbound/);
  await fs.writeFile(file, content);
  const recovered = await fetch(`${origin}/api/librarian/schemas`);
  assert.equal(recovered.status, 200);
  const projected = (await recovered.json()).subschemas.find(item => item.name === 'xsd-sub').structure;
  assert.ok(JSON.stringify(projected).includes('"Id"'));
  await fs.writeFile(file, `<s:schema xmlns:s="http://www.w3.org/2001/XMLSchema" xmlns:t="urn:test" targetNamespace="urn:test">
    <s:element name="Document" type="t:Record"/>
    <s:complexType name="Record"><s:sequence>
      <s:element ref="t:Shared" minOccurs="0"/><s:element name="Next" type="t:Record" minOccurs="0"/>
    </s:sequence></s:complexType>
    <s:element name="Shared" type="t:SharedType"/>
    <s:complexType name="SharedType"><s:sequence><s:element name="Id" type="s:string"/></s:sequence></s:complexType>
  </s:schema>`);
  const expanded = await post({ id: 'expanded-xsd', parentSchemaPath: 'utf16.xsd', accessibleFields: ['Document.Shared.Id'] });
  assert.equal(expanded.status, 201, JSON.stringify(await expanded.json()));
  const recursive = await post({ id: 'recursive-xsd', parentSchemaPath: 'utf16.xsd', accessibleFields: ['Document.Next'] });
  assert.equal(recursive.status, 201, JSON.stringify(await recursive.json()));
  const hidden = await post({ id: 'hidden-xsd', parentSchemaPath: 'utf16.xsd', accessibleFields: ['Document.Next.Shared.Id'] });
  assert.equal(hidden.status, 400);
  const expandedList = await fetch(`${origin}/api/librarian/schemas`);
  assert.equal(expandedList.status, 200);
  const projectedSchemas = (await expandedList.json()).subschemas;
  const selected = projectedSchemas.find(item => item.name === 'expanded-xsd');
  assert.ok(selected.availableFields.includes('Document.Shared.Id'));
  assert.ok(JSON.stringify(selected.structure).includes('"Id"'));
  assert.ok(!JSON.stringify(selected.structure).includes('"Next"'));
  const recursiveTree = projectedSchemas.find(item => item.name === 'recursive-xsd').structure;
  assert.ok(JSON.stringify(recursiveTree).includes('"recursive":true'));
  await fs.mkdir(path.join(schemas, 'parts'));
  await fs.writeFile(path.join(schemas, 'parts', 'types.xsd'), `<s:schema xmlns:s="http://www.w3.org/2001/XMLSchema">
    <s:complexType name="Record"><s:sequence><s:element name="Included" type="s:string"/></s:sequence></s:complexType>
  </s:schema>`);
  await fs.writeFile(file, `<s:schema xmlns:s="http://www.w3.org/2001/XMLSchema" xmlns:t="urn:test" targetNamespace="urn:test">
    <s:include schemaLocation="parts/types.xsd"/><s:element name="Document" type="t:Record"/>
  </s:schema>`);
  const linked = await post({ id: 'linked-xsd', parentSchemaPath: 'utf16.xsd', accessibleFields: ['Document.Included'] });
  assert.equal(linked.status, 201, JSON.stringify(await linked.json()));
  const includedPath = path.join(schemas, 'parts', 'types.xsd');
  const original = await fs.readFile(includedPath, 'utf8');
  await fs.writeFile(includedPath, original.replace('Included', 'Changed'));
  const changedList = await fetch(`${origin}/api/librarian/schemas`);
  assert.equal(changedList.status, 200);
  const changedSchemas = (await changedList.json()).subschemas;
  assert.ok(changedSchemas.find(item => item.name === 'linked-xsd').availableFields.includes('Document.Changed'));
  const changedFields = await fetch(`${origin}/api/librarian/schema-fields?path=utf16.xsd`);
  assert.equal(changedFields.status, 200);
  const changedMetadata = await changedFields.json();
  assert.ok(changedMetadata.availableFields.includes('Document.Changed'));
  assert.ok(!changedMetadata.availableFields.includes('Document.Included'));
  const oldPath = await post({ id: 'old-linked-xsd', parentSchemaPath: 'utf16.xsd', accessibleFields: ['Document.Included'] });
  assert.equal(oldPath.status, 400);
  await fs.writeFile(includedPath, `<s:schema xmlns:s="http://www.w3.org/2001/XMLSchema">
    <s:complexType name="Record"><s:sequence>
      <s:element name="Code" type="Alias"/>
      <s:element name="Inline"><s:simpleType><s:restriction base="s:string"><s:enumeration value="INLINE"/></s:restriction></s:simpleType></s:element>
      <s:element name="Codes" type="Codes"/>
    </s:sequence></s:complexType>
    <s:simpleType name="Alias"><s:restriction base="Code"/></s:simpleType>
    <s:simpleType name="Code"><s:restriction base="s:string"><s:enumeration value="A"/><s:enumeration value="B"/></s:restriction></s:simpleType>
    <s:simpleType name="Codes"><s:list itemType="Code"/></s:simpleType>
  </s:schema>`);
  const enums = await post({ id: 'enum-xsd', parentSchemaPath: 'utf16.xsd', accessibleFields: ['Document.Code', 'Document.Inline', 'Document.Codes'] });
  assert.equal(enums.status, 201, JSON.stringify(await enums.json()));
  const enumListing = await fetch(`${origin}/api/librarian/schemas`);
  assert.equal(enumListing.status, 200);
  const enumProjection = (await enumListing.json()).subschemas.find(item => item.name === 'enum-xsd').structure;
  const fields = enumProjection.children[0].children[0].children;
  assert.deepEqual(fields.find(node => node.name === 'Code').enumValues, ['A', 'B']);
  assert.deepEqual(fields.find(node => node.name === 'Inline').enumValues, ['INLINE']);
  assert.deepEqual(fields.find(node => node.name === 'Codes').simpleType.itemType.enumValues, ['A', 'B']);
  assert.equal(fields.find(node => node.name === 'Codes').isEnum, undefined);
  await fs.writeFile(file, `<s:schema xmlns:s="http://www.w3.org/2001/XMLSchema">
    <s:include schemaLocation="../outside.xsd"/>
  </s:schema>`);
  const escaped = await fetch(`${origin}/api/librarian/schemas`);
  assert.equal(escaped.status, 500);
  assert.match((await escaped.json()).error, /escapes/);
});

test('concurrent HTTP subschema mutations preserve every success and enforce uniqueness', async t => {
  const { origin, catalogRoot } = await fixture(t);
  await fs.writeFile(path.join(catalogRoot, 'schemas', 'parent.json-schema'), JSON.stringify({
    type: 'object', properties: { Document: { type: 'object', properties: {
      Id: { type: 'string' }, Other: { type: 'string' }
    } } }
  }));
  const call = async (method, endpoint, body) => {
    const response = await fetch(`${origin}${endpoint}`, {
      method, headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000)
    });
    return { status: response.status, body: await response.json() };
  };
  const definition = id => ({ id, label: id, parentSchemaPath: 'parent.json-schema', accessibleFields: ['Document.Id'] });
  const results = await Promise.all(Array.from({ length: 24 }, (_, index) =>
    call('POST', '/api/librarian/subschemas', definition(`concurrent-${index}`))));
  for (const result of results) assert.equal(result.status, 201, JSON.stringify(result.body));
  const target = path.join(catalogRoot, 'subschemas.json');
  const created = JSON.parse(await fs.readFile(target, 'utf8'));
  assert.equal(created.length, 24);
  assert.equal(new Set(created.map(item => item.id)).size, 24);
  const duplicates = await Promise.all(Array.from({ length: 2 }, () =>
    call('POST', '/api/librarian/subschemas', definition('duplicate'))));
  assert.deepEqual(duplicates.map(result => result.status).sort(), [201, 409]);
  assert.equal(JSON.parse(await fs.readFile(target, 'utf8')).filter(item => item.id === 'duplicate').length, 1);
  const updates = await Promise.all([
    call('PUT', '/api/librarian/subschemas/concurrent-0', { label: 'Updated label' }),
    call('PUT', '/api/librarian/subschemas/concurrent-0', { accessibleFields: ['Document.Other'] })
  ]);
  for (const result of updates) assert.equal(result.status, 200, JSON.stringify(result.body));
  const updated = JSON.parse(await fs.readFile(target, 'utf8')).find(item => item.id === 'concurrent-0');
  assert.equal(updated.label, 'Updated label');
  assert.deepEqual(updated.accessibleFields, ['Document.Other']);
  const deletes = await Promise.all(Array.from({ length: 12 }, (_, index) =>
    call('DELETE', `/api/librarian/subschemas/concurrent-${index + 1}`)));
  for (const result of deletes) assert.equal(result.status, 200, JSON.stringify(result.body));
  const remaining = JSON.parse(await fs.readFile(target, 'utf8'));
  assert.equal(remaining.length, 13);
  assert.ok(remaining.some(item => item.id === 'concurrent-0' && item.label === 'Updated label'));
  for (let index = 1; index <= 12; index++) assert.ok(!remaining.some(item => item.id === `concurrent-${index}`));
  const missing = await call('PUT', '/api/librarian/subschemas/missing', { label: 'Missing' });
  assert.equal(missing.status, 404);
  const conflict = await call('PUT', '/api/librarian/subschemas/concurrent-0', { id: 'duplicate' });
  assert.equal(conflict.status, 409);
  const renamed = await call('POST', '/api/librarian/schemas/rename', {
    path: 'parent.json-schema', newName: 'renamed'
  });
  assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
  const afterRename = JSON.parse(await fs.readFile(target, 'utf8'));
  assert.equal(afterRename.length, 13);
  assert.ok(afterRename.every(item => item.parentSchemaPath === 'renamed.json-schema'));
  assert.equal((await call('GET', '/api/librarian/subschemas')).body.subschemas.length, 13);
});
