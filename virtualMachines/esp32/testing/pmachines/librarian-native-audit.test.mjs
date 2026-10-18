import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { auditDerivedXsdStructures, auditSchemaCorpus } from '../../aggregator/scripts/audit-librarian-native.mjs';

test('native audit identifies oversized desktop modules without advertising read-only parity', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL('../../aggregator/scripts/audit-librarian-native.mjs', import.meta.url)),
  ], { maxBuffer: 1000000 });
  const report = JSON.parse(stdout);
  assert.equal(report.profile, 'esp32_s3_n16r8');
  assert.equal(report.version, 4);
  assert.deepEqual(report.extendedTables.compilerDeclarations.map(({ name, elementCount }) =>
    ({ name, elementCount })), [{ name: 'nodeOffsets', elementCount: 4 }]);
  assert.equal(report.extendedTables.hostedDeclarationConfigurationDetected, false);
  assert.equal(report.extendedTables.hardwareVerified, false);
  assert.ok(report.modules.every(item => Array.isArray(item.extendableDeclarations)));
  const module = name => report.modules.find(item => item.source.endsWith(name));
  assert.equal(module('s3-readonly.pas').fitsCurrentImageBudget, true);
  assert.equal(module('s3-readonly.pas').nativeTarget, true);
  assert.equal(module('s3-readonly.pas').serviceId, 'pulse-librarian-s3-readonly');
  assert.deepEqual(module('s3-readonly.pas').missingNativeBindings, []);
  assert.ok(report.modules.every(item => typeof item.serviceId === 'string' && item.serviceId.length > 0));
  assert.equal(module('xsd-parser.pas').fitsCurrentImageBudget, false);
  assert.equal(module('xsd-parser.pas').nativeTarget, false);
  assert.ok(module('xsd-parser.pas').desktopOnlyBindings.includes('host.xml_parse'));
  assert.ok(module('xsd-parser.pas').missingNativeBindings.includes('host.xml_parse'));
  assert.ok(report.explicitDesktopRoutes.some(route =>
    route.method === 'POST' && route.path === '/api/librarian/upload/:dest'));
  assert.ok(report.middlewareRoutes.some(route => route.path === '/api/librarian/llm/actions/:id'));
  assert.ok(report.middlewareRoutes.some(route =>
    route.method === 'ANY' && route.path === '/api/librarian/file/:path(*)'));
  assert.ok(report.consumers.some(consumer => consumer.source.endsWith('DataMapper.jsx')));
  assert.ok(report.consumers.some(consumer => consumer.source.endsWith('esp32LibrarianBackend.ts')));
  assert.ok(report.consumers.some(consumer => consumer.source === path.join('aggregator', 'data-mapper.mjs')));
  assert.ok(report.consumers.some(consumer => consumer.source === path.join('aggregator', 'backend.mjs')));
  assert.ok(report.consumers.some(consumer =>
    consumer.source === path.join('aggregator', 'data-librarian.mjs')
      && consumer.classification === 'desktop-implementation'));
  assert.ok(report.consumers.some(consumer =>
    consumer.source === path.join('aggregator', 'data', 'service-manifest.json')
      && consumer.classification === 'deployment-configuration'));
  assert.ok(report.consumers.some(consumer =>
    consumer.source === path.join('src', 'librarian', 'routes', 'metadata.pas')
      && consumer.classification === 'pascalish-policy'));
  assert.equal(report.derivedStructures, null);
  assert.ok(report.schemaCorpus.count > 0);
  assert.ok(report.notes.some(note => note.includes('not the authoritative operational storage')));
});

test('corpus audit measures nested files and exact native/filesystem boundary crossings', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-librarian-corpus-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, 'nested'));
  await fs.writeFile(path.join(directory, 'small.xsd'), Buffer.alloc(2048));
  await fs.writeFile(path.join(directory, 'nested', 'medium.xsd'), Buffer.alloc(2049));
  await fs.writeFile(path.join(directory, 'large.json-schema'), Buffer.alloc(262145));
  await fs.writeFile(path.join(directory, 'ignored.txt'), Buffer.alloc(1000000));
  const corpus = await auditSchemaCorpus(directory);
  assert.equal(corpus.count, 3);
  assert.equal(corpus.totalBytes, 266242);
  assert.equal(corpus.exceedsNativeIngress, 2);
  assert.equal(corpus.exceedsCurrentFilesystemRead, 1);
  assert.deepEqual(corpus.byExtension['.xsd'], { count: 2, bytes: 4097, maximumBytes: 2049 });
  assert.equal(corpus.largest[0].path, 'large.json-schema');
  assert.equal(corpus.largest[1].path, path.join('nested', 'medium.xsd'));
});

test('derived inventory measures fresh Pascalish trees rather than assuming source size', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-librarian-derived-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const source = '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">'
    + '<xs:element name="Document"><xs:complexType><xs:sequence>'
    + Array.from({ length: 500 }, (_, index) => `<xs:element name="F${index}" type="xs:string"/>`).join('')
    + '</xs:sequence></xs:complexType></xs:element></xs:schema>';
  await fs.writeFile(path.join(directory, 'large.xsd'), source);
  const [result] = await auditDerivedXsdStructures(directory, ['large.xsd']);
  assert.equal(result.path, 'large.xsd');
  assert.equal(result.sourceBytes, Buffer.byteLength(source));
  assert.ok(result.treeBytes > result.sourceBytes);
  assert.ok(result.treeBytes > 20480);
  assert.ok(result.resultBytes > result.treeBytes);
  assert.equal(result.treeExceedsNativeHttpResponse, true);
  assert.equal(result.dependencyCount, 1);
  assert.ok(Number.isInteger(result.desktopElapsedMs) && result.desktopElapsedMs >= 0);
  await assert.rejects(auditDerivedXsdStructures(directory, ['missing.xsd']), error =>
    error.cause?.code === 'ENOENT');
});
