import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import express from 'express';

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForLibrarian(baseUrl, child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode != null) throw new Error(`Data Librarian exited with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/librarian/schemas`);
      if (response.ok) return;
    } catch {
      // Service is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for Data Librarian');
}

const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-subschema-test-'));
const schemaRoot = path.join(runtimeRoot, 'services', 'librarian', 'schemas');
fs.mkdirSync(schemaRoot, { recursive: true });
fs.writeFileSync(path.join(schemaRoot, 'payments.xsd'), `
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Document">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Header">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="Id" type="xs:string"/>
              <xs:element name="Secret" type="xs:string"/>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
        <xs:element name="Result">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="Id" type="xs:string"/>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>
`);

const librarianPort = await getFreePort();
const librarianBaseUrl = `http://127.0.0.1:${librarianPort}`;
const librarian = spawn(process.execPath, ['data-librarian.mjs'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: {
    ...process.env,
    LIBRARIAN_PORT: String(librarianPort),
    PULSE_LIBRARIAN_DATA_ROOT: runtimeRoot,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let librarianError = '';
librarian.stderr.on('data', chunk => { librarianError += chunk; });

try {
  await waitForLibrarian(librarianBaseUrl, librarian);

  const createResponse = await fetch(`${librarianBaseUrl}/api/librarian/subschemas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'payments-minimal',
      label: 'Payments Minimal',
      parentSchemaPath: 'payments.xsd',
      accessibleFields: ['Document.Header.Id', 'Document.Result.Id'],
    }),
  });
  assert.equal(createResponse.status, 201, await createResponse.text());

  const schemasResponse = await fetch(`${librarianBaseUrl}/api/librarian/schemas`);
  const schemasPayload = await schemasResponse.json();
  const subschema = schemasPayload.schemas.find(schema => schema.name === 'payments-minimal');
  assert.ok(subschema, 'virtual subschema should be present in schema catalog');
  assert.equal(subschema.virtual, true);
  assert.deepEqual(subschema.accessibleFields, ['Document.Header.Id', 'Document.Result.Id']);
  assert.doesNotMatch(JSON.stringify(subschema.structure), /Secret/);

  const invalidResponse = await fetch(`${librarianBaseUrl}/api/librarian/subschemas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'payments-invalid',
      label: 'Payments Invalid',
      parentSchemaPath: 'payments.xsd',
      accessibleFields: ['Document.DoesNotExist'],
    }),
  });
  assert.equal(invalidResponse.status, 400);
  assert.match((await invalidResponse.json()).error, /not present in parent schema/);

  process.env.PULSE_DEVELOP_WORKSPACE_ROOT = runtimeRoot;
  const { registerDevelopDocumentRoutes } = await import(`../src/backend/developDocumentRoutes.mjs?test=${Date.now()}`);
  const app = express();
  app.use(express.json());
  await registerDevelopDocumentRoutes(app);
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const compileUrl = `http://127.0.0.1:${server.address().port}/api/develop/compile`;
  const sourceFor = sourceField => [
    'MAPPER "minimal-map" SOURCE "payments-minimal" TARGET "payments-minimal" BEGIN',
    `  MAP "${sourceField}" TO "Document.Result.Id";`,
    'END;',
  ].join('\n');

  try {
    const allowedResponse = await fetch(compileUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'subschema-test.pas', content: sourceFor('Document.Header.Id'), mode: 'compile-run' }),
    });
    assert.equal(allowedResponse.status, 200, await allowedResponse.text());
    const compiledMappings = JSON.parse(fs.readFileSync(path.join(runtimeRoot, 'data-mappings.json'), 'utf-8'));
    assert.equal(compiledMappings[0].sourceSubschemaId, 'payments-minimal');
    assert.equal(compiledMappings[0].sourceParentTypeId, 'payments');
    assert.equal(compiledMappings[0].targetSubschemaId, 'payments-minimal');
    assert.equal(compiledMappings[0].targetParentTypeId, 'payments');

    const deniedResponse = await fetch(compileUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'subschema-test.pas', content: sourceFor('Document.Header.Secret') }),
    });
    assert.equal(deniedResponse.status, 400);
    assert.match((await deniedResponse.json()).error, /not accessible in subschema/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('[SUBSCHEMA-TEST] Librarian filtering and Pascalish enforcement passed');
} finally {
  librarian.kill();
  await new Promise(resolve => {
    if (librarian.exitCode != null) return resolve();
    librarian.once('exit', resolve);
  });
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  if (librarianError.trim()) process.stderr.write(librarianError);
}
