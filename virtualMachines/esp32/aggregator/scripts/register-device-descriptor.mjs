import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const descriptorFilename = 'device-descriptor.v1.json-schema';
export const descriptorSchemaUrl = new URL(`../data/services/librarian/schemas/${descriptorFilename}`, import.meta.url);

export async function registerDeviceDescriptor(origin) {
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Expected an HTTP(S) Data Librarian origin');
  const schemaText = await fs.readFile(descriptorSchemaUrl, 'utf8');
  const schema = JSON.parse(schemaText);
  async function request(route, options) {
    const response = await fetch(new URL(route, base), {
      ...options, signal: AbortSignal.timeout(30000)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${route}: HTTP ${response.status}: ${text}`);
    return JSON.parse(text);
  }
  const { types } = await request('/api/librarian/data-types');
  if (!types.some(type => type.id === 'device-descriptor')) {
    await request('/api/librarian/data-types', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'device-descriptor', label: schema.title, isIso: false })
    });
  }
  const { schemas } = await request('/api/librarian/schemas');
  const existing = schemas.find(item => item.path === descriptorFilename);
  if (existing) {
    const stored = await request(`/api/librarian/file/${encodeURIComponent(descriptorFilename)}`);
    if (!isDeepStrictEqual(stored, schema))
      throw new Error(`Existing ${descriptorFilename} differs; publish a new version instead of overwriting it`);
  } else {
    await request('/api/librarian/upload/schemas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'x-filename': descriptorFilename },
      body: schemaText
    });
  }
  const catalog = await request('/api/librarian/schemas');
  const registered = catalog.schemas.find(item => item.path === descriptorFilename);
  if (registered) {
    registered.structure = (await request(
      `/api/librarian/schema-structure?path=${encodeURIComponent(descriptorFilename)}`)).structure;
  }
  if (!registered || registered.typeId !== 'device-descriptor' || !registered.structure)
    throw new Error('Device descriptor was not exposed correctly in the Data Librarian catalog');
  return registered;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await registerDeviceDescriptor(process.argv[2] || 'http://127.0.0.1:4300');
  console.log(`Registered ${result.typeId} v${result.version}: ${result.path}`);
}
