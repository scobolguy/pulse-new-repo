import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPascalishLibrarianSchemaCatalogRoutes } from '../../aggregator/src/librarian/schema-catalog-routes.mjs';

test('Pascalish schema-catalog transport batches multi-megabyte catalogs without changing order or virtual duplication', async t => {
  const service = await createPascalishLibrarianSchemaCatalogRoutes({ logger: { warn() {}, error() {} } });
  t.after(() => service.stop());
  const physicalSchemas = Array.from({ length: 12 }, (_, index) => ({
    path: `schema-${index}.xsd`, structure: { children: [{ name: 'field', description: 'x'.repeat(150000) }] },
  }));
  const subschemas = Array.from({ length: 5 }, (_, index) => ({
    path: `subschemas/sub-${index}`, structure: { children: [{ name: 'field', description: 'y'.repeat(120000) }] },
  }));
  const response = await service.dispatch({ method: 'GET', path: '/api/librarian/schemas', physicalSchemas, subschemas });
  assert.deepEqual(response, { matched: true, status: 200, body: {
    schemas: [...physicalSchemas, ...subschemas], subschemas,
  } });
  const virtual = await service.dispatch({ method: 'GET', path: '/api/librarian/subschemas', physicalSchemas, subschemas });
  assert.deepEqual(virtual, { matched: true, status: 200, body: { subschemas } });
  assert.deepEqual(await service.dispatch({ method: 'GET', path: '/api/librarian/schemas' }),
    { matched: true, status: 200, body: { schemas: [], subschemas: [] } });
  assert.equal((await service.dispatch({ method: 'POST', path: '/not-supported' })).matched, false);
  await assert.rejects(service.dispatch({ method: 'GET', path: '/api/librarian/schemas', physicalSchemas: [
    { structure: 'x'.repeat(950000) },
  ] }), /entry capacity exceeded/);
});
