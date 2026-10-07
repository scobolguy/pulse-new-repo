import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

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
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Service is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for Data Librarian');
}

const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-subschema-policy-'));
const schemaRoot = path.join(runtimeRoot, 'services', 'librarian', 'schemas');
const longField = 'LongField'.repeat(80);
fs.mkdirSync(schemaRoot, { recursive: true });
fs.writeFileSync(path.join(schemaRoot, 'policy-test.xsd'), `
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Document">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Header">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="Id" type="xs:string"/>
              <xs:element name="${longField}" type="xs:string"/>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>
`);

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const librarian = spawn(process.execPath, ['data-librarian.mjs'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: {
    ...process.env,
    LIBRARIAN_PORT: String(port),
    PULSE_LIBRARIAN_DATA_ROOT: runtimeRoot,
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let errorText = '';
librarian.stderr.on('data', chunk => { errorText += chunk; });

try {
  await waitForLibrarian(baseUrl, librarian);

  const createResponse = await fetch(`${baseUrl}/api/librarian/subschemas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'policy-allowed',
      label: 'Policy Allowed',
      parentSchemaPath: 'policy-test.xsd',
      accessibleFields: ['Document.Header.Id', `Document.Header.${longField}`],
    }),
  });
  assert.equal(createResponse.status, 201, await createResponse.text());

  const invalidResponse = await fetch(`${baseUrl}/api/librarian/subschemas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'policy-denied',
      label: 'Policy Denied',
      parentSchemaPath: 'policy-test.xsd',
      accessibleFields: ['Document.Header.NotPresent'],
    }),
  });
  assert.equal(invalidResponse.status, 400);
  assert.match((await invalidResponse.json()).error, /not present in parent schema/);
  console.log('[librarian-subschema-policy] PASS: Pascalish JSON policy allows known fields and rejects unknown paths');
} finally {
  librarian.kill();
  await new Promise(resolve => {
    if (librarian.exitCode != null) return resolve();
    librarian.once('exit', resolve);
  });
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  if (errorText.trim()) process.stderr.write(errorText);
}
