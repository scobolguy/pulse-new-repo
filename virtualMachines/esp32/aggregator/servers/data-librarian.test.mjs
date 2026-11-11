import assert from 'node:assert/strict';
import test from 'node:test';
import { DataLibrarian } from './data-librarian.mjs';

test('DataLibrarian displays every legacy Librarian collection', async () => {
  const payloads = {
    '/api/librarian/files': { files: [{ path: 'schemas/a.xsd' }] },
    '/api/librarian/schemas': { schemas: [{ path: 'schemas/a.xsd', name: 'A' }] },
    '/api/librarian/subschemas': { subschemas: [{ id: 'a-sub', name: 'A subset' }] },
    '/api/librarian/data-types': { dataTypes: [{ id: 'mt103', label: 'MT103' }] },
    '/api/librarian/mapper-rulesets': { mapperRulesets: [{ id: 'map-a', name: 'Map A' }] },
  };
  const librarian = new DataLibrarian({
    baseUrl: 'http://librarian',
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      json: async () => payloads[new URL(url).pathname],
    }),
  });

  const model = await librarian.displayModel();
  assert.equal(model.objectCount, 5);
  assert.deepEqual(model.groups.map(group => group.kind), [
    'data-type', 'file', 'mapper-ruleset', 'schema', 'subschema',
  ]);
  assert.equal((await librarian.getObject('schema', 'schemas/a.xsd')).name, 'A');
});
