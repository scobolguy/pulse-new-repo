import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createFilesystemBindings } from '../../pmachines/javascript/src/filesystem-bindings.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { HOST_PROFILES } from '../../pmachines/shared/contracts/host-capabilities.mjs';
import { encodeHostedImage } from '../../pmachines/shared/contracts/hosted-image.mjs';
import { createJsPmachineNodeServer } from '../../pmachines/javascript/server.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';

async function fixture(t, options = {}) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-filesystem-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'root');
  const outside = path.join(temporary, 'outside');
  await fs.mkdir(root);
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'secret.txt'), 'outside');
  const adapter = await createFilesystemBindings({
    catalog: { path: root, readOnly: false },
    readonly: { path: root }
  }, options);
  return { ...adapter, root, outside };
}

test('grants are opt-in and read-only by default', async t => {
  const empty = await createFilesystemBindings();
  assert.deepEqual(empty.capabilities, []);
  await assert.rejects(empty.handlers['host.fs_read_text']('catalog', 'file'), /access denied/);
  await assert.rejects(empty.handlers['host.fs_exists']('catalog', 'file'), /access denied/);
  const { handlers, roots, capabilities, root } = await fixture(t);
  assert.deepEqual(capabilities, ['filesystem.read', 'filesystem.write']);
  assert.deepEqual(roots, [{ name: 'catalog', readOnly: false }, { name: 'readonly', readOnly: true }]);
  for (const [name, args] of [
    ['host.fs_write_text', ['readonly', 'file', 'body']],
    ['host.fs_mkdir', ['readonly', 'dir']],
    ['host.fs_rename', ['readonly', 'file', 'other']],
    ['host.fs_delete', ['readonly', 'file']]
  ]) await assert.rejects(handlers[name](...args), error => error.status === 403);
  assert.deepEqual(await fs.readdir(root), []);
  assert.equal(await handlers['host.fs_exists']('readonly', 'missing'), 0);
  await fs.writeFile(path.join(root, 'file'), '');
  assert.equal(await handlers['host.fs_exists']('readonly', 'file'), 1);
});

test('atomic UTF-8 writes, reads, metadata, rename and file deletion', async t => {
  const { handlers, root } = await fixture(t);
  const body = '\ufeffUnicode \u540d \ud83d\ude00\n';
  assert.equal(await handlers['host.fs_mkdir']('catalog', 'schemas'), 0);
  assert.equal(await handlers['host.fs_write_text']('catalog', 'schemas/example.json', body), 0);
  assert.equal(await handlers['host.fs_read_text']('readonly', 'schemas/example.json'), body);
  const stat = JSON.parse(await handlers['host.fs_stat']('catalog', 'schemas/example.json'));
  assert.equal(stat.kind, 'file');
  assert.equal(stat.size, Buffer.byteLength(body));
  assert.ok(Number.isFinite(Date.parse(stat.modifiedAt)));
  await handlers['host.fs_write_text']('catalog', 'schemas/example.json', '{}');
  assert.equal(await fs.readFile(path.join(root, 'schemas', 'example.json'), 'utf8'), '{}');
  await handlers['host.fs_rename']('catalog', 'schemas/example.json', 'schemas/renamed.json');
  await assert.rejects(handlers['host.fs_stat']('catalog', 'schemas/example.json'), error => error.code === 'ENOENT' && error.status === 404);
  await handlers['host.fs_delete']('catalog', 'schemas/renamed.json');
  assert.deepEqual(await fs.readdir(path.join(root, 'schemas')), []);
});

test('sorted directory pages expose metadata and continuation without absolute paths', async t => {
  const { handlers, root } = await fixture(t);
  for (const name of ['c.txt', 'a.txt', 'b.txt']) await fs.writeFile(path.join(root, name), name);
  const first = JSON.parse(await handlers['host.fs_list']('catalog', '.', '', 2));
  assert.deepEqual(first.entries.map(item => item.name), ['a.txt', 'b.txt']);
  assert.equal(first.nextCursor, 'b.txt');
  assert.ok(!JSON.stringify(first).includes(root));
  const second = JSON.parse(await handlers['host.fs_list']('catalog', '', first.nextCursor, 2));
  assert.deepEqual(second.entries.map(item => item.name), ['c.txt']);
  assert.equal(second.nextCursor, '');
  assert.deepEqual(JSON.parse(await handlers['host.fs_list']('catalog', '.', 'z.txt', 2)), { entries: [], nextCursor: '' });
});

test('reject traversal, absolute paths, alternate streams and Windows aliases', async t => {
  const { handlers, outside } = await fixture(t);
  for (const relative of [
    '../outside/secret.txt', '..\\outside\\secret.txt', '/outside', '\\outside',
    path.join(outside, 'secret.txt'), 'C:\\outside', 'file:stream', 'dir/../file',
    'dir//file', 'nul.txt', 'CON', 'CON .txt', 'CONOUT$', 'COM\u00b9', 'LPT\u00b3.txt',
    'dir.', 'dir ', 'bad\u0000path'
  ]) {
    await assert.rejects(handlers['host.fs_read_text']('catalog', relative), /Invalid storage path/);
    await assert.rejects(handlers['host.fs_exists']('catalog', relative), /Invalid storage path/);
    await assert.rejects(handlers['host.fs_write_text']('catalog', relative, 'changed'), /Invalid storage path/);
  }
  assert.equal(await fs.readFile(path.join(outside, 'secret.txt'), 'utf8'), 'outside');
});

test('reject directory links and hard links for both reads and writes', async t => {
  const { handlers, root, outside } = await fixture(t);
  await fs.symlink(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.link(path.join(outside, 'secret.txt'), path.join(root, 'hard.txt'));
  for (const relative of ['linked/secret.txt', 'hard.txt']) {
    await assert.rejects(handlers['host.fs_read_text']('catalog', relative), /links are not allowed/);
    await assert.rejects(handlers['host.fs_exists']('catalog', relative), /links are not allowed/);
    await assert.rejects(handlers['host.fs_write_text']('catalog', relative, 'changed'), /links are not allowed/);
    await assert.rejects(handlers['host.fs_delete']('catalog', relative), /links are not allowed/);
  }
  await assert.rejects(handlers['host.fs_rename']('catalog', 'hard.txt', 'new.txt'), /links are not allowed/);
  await assert.rejects(handlers['host.fs_list']('catalog', '.', '', 10), /links are not allowed/);
  assert.equal(await fs.readFile(path.join(outside, 'secret.txt'), 'utf8'), 'outside');
});

test('bounds, errors and cancellation never silently succeed', async t => {
  const { handlers, root } = await fixture(t, { maxFileBytes: 16, maxPageBytes: 16 });
  const boundary = '\u00e9'.repeat(8);
  await handlers['host.fs_write_text']('catalog', 'boundary', boundary);
  assert.equal(await handlers['host.fs_read_text']('catalog', 'boundary'), boundary);
  await assert.rejects(handlers['host.fs_write_text']('catalog', 'boundary', boundary + 'x'), error => error.code === 'EFBIG');
  await fs.writeFile(path.join(root, 'large'), 'x'.repeat(17));
  await assert.rejects(handlers['host.fs_read_text']('catalog', 'large'), error => error.code === 'EFBIG');
  await assert.rejects(handlers['host.fs_write_text']('catalog', 'large', 'x'.repeat(17)), error => error.code === 'EFBIG');
  assert.equal((await fs.readFile(path.join(root, 'large'), 'utf8')).length, 17);
  await assert.rejects(handlers['host.fs_list']('catalog', '.', '', 1), /page capacity/);
  await assert.rejects(handlers['host.fs_list']('catalog', '.', '', 0), /Invalid directory page/);
  await assert.rejects(handlers['host.fs_write_text']('catalog', 'missing/file', ''), error => error.status === 404);
  await assert.rejects(handlers['host.fs_delete']('catalog', '.'), /Invalid storage path/);
  await fs.mkdir(path.join(root, 'directory'));
  await assert.rejects(handlers['host.fs_delete']('catalog', 'directory'), /requires a file/);
  await fs.writeFile(path.join(root, 'invalid-utf8'), Buffer.from([0xff]));
  await assert.rejects(handlers['host.fs_read_text']('catalog', 'invalid-utf8'), /failed/);
  await assert.rejects(handlers['host.fs_rename']('catalog', 'large', 'invalid-utf8'), error => error.code === 'EEXIST');
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(handlers['host.fs_write_text']('catalog', 'cancelled', '', { signal: abort.signal }), error => error.name === 'AbortError');
  assert.deepEqual((await fs.readdir(root)).filter(name => name.startsWith('.pulse-')), []);
});

test('cancellation before replacement preserves the old file and cleans temporary output', async t => {
  const { handlers, root } = await fixture(t);
  await fs.writeFile(path.join(root, 'saved'), 'original');
  const controller = new AbortController();
  const check = controller.signal.throwIfAborted.bind(controller.signal);
  let checks = 0;
  controller.signal.throwIfAborted = () => {
    if (++checks === 3) controller.abort();
    check();
  };
  await assert.rejects(handlers['host.fs_write_text']('catalog', 'saved', 'replacement', {
    signal: controller.signal
  }), error => error.name === 'AbortError');
  assert.equal(await fs.readFile(path.join(root, 'saved'), 'utf8'), 'original');
  assert.deepEqual(await fs.readdir(root), ['saved']);
});

test('grant configuration validates aliases, paths, limits and linked roots', async t => {
  const { root, outside } = await fixture(t);
  for (const grants of [null, [], { BadAlias: { path: root } }, { catalog: { path: 'relative' } },
    { catalog: { path: root, readOnly: 'false' } }]) {
    await assert.rejects(createFilesystemBindings(grants), /Invalid storage root/);
  }
  for (const maxFileBytes of [0, 1.5, '1024', 1000001]) {
    await assert.rejects(createFilesystemBindings({}, { maxFileBytes }), /Invalid maxFileBytes/);
  }
  await assert.rejects(createFilesystemBindings({ catalog: { path: path.join(root, 'missing') } }), error => error.code === 'ENOENT');
  await fs.writeFile(path.join(root, 'file'), '');
  await assert.rejects(createFilesystemBindings({ catalog: { path: path.join(root, 'file') } }), /real directory/);
  await fs.symlink(outside, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(createFilesystemBindings({ catalog: { path: path.join(root, 'link') } }), /real directory/);
});

const compile = source => compilePascalishProgramWithAntlr(source, { hostServices: true });
const filesystemService = () => compile(`service 'catalog-test';
post '/write';
begin
  host.fs_write_text('catalog', 'saved.json', host.event_body());
  return host.fs_read_text('catalog', 'saved.json')
end
get '/capabilities';
begin return host.capabilities() end
end.`);

test('compiler records desktop requirements; ESP32 image encoding refuses them', () => {
  const compiled = filesystemService();
  assert.deepEqual(compiled.programMap.targets, ['js']);
  assert.equal(compiled.programMap.hostCapabilitiesVersion, 1);
  assert.deepEqual(compiled.programMap.requiredHostCapabilities, ['filesystem.read', 'filesystem.write']);
  assert.deepEqual(compactServiceHostProgramMap(compiled.programMap).requiredHostCapabilities, ['filesystem.read', 'filesystem.write']);
  assert.equal(HOST_PROFILES.esp32.filesystem, false);
  assert.throws(() => encodeHostedImage(compiled.pcodeText), /Desktop-only/);
  const portable = compile(`service 'portable'; get '/'; begin return '{}' end end.`);
  assert.deepEqual(portable.programMap.targets, ['js', 'esp32']);
  assert.ok(encodeHostedImage(portable.pcodeText).startsWith('PHI1'));
  const introspection = compile(`service 'profile'; get '/'; begin return host.capabilities() end end.`);
  assert.deepEqual(introspection.programMap.targets, ['js']);
  assert.throws(() => encodeHostedImage(introspection.pcodeText), /Desktop-only/);
});

test('missing capabilities fail installation even when requirement metadata is removed', async () => {
  const compiled = filesystemService();
  delete compiled.programMap.requiredHostCapabilities;
  await assert.rejects(createPascalishServiceHost({
    compiled, collectorId: 'test', httpPort: null, udpPort: null
  }), /capabilities unavailable/);
});

test('invalid, unknown and daemon capability requirements reject installation', async t => {
  const { root } = await fixture(t);
  const options = { collectorId: 'test', httpPort: null, udpPort: null, storageRoots: { catalog: { path: root } } };
  await assert.rejects(createPascalishServiceHost({ ...options, compiled: filesystemService() }), /filesystem.write/);
  const portable = () => compile(`service 'portable'; get '/'; begin return '{}' end end.`);
  for (const requirements of [null, 'filesystem.read', [7]]) {
    const compiled = portable();
    compiled.programMap.hostCapabilitiesVersion = 1;
    compiled.programMap.requiredHostCapabilities = requirements;
    await assert.rejects(createPascalishServiceHost({ ...options, compiled }), /Invalid host capability/);
  }
  const compiled = portable();
  compiled.programMap.hostCapabilitiesVersion = 2;
  await assert.rejects(createPascalishServiceHost({ ...options, compiled }), /Invalid host capability/);
  compiled.programMap.hostCapabilitiesVersion = 1;
  compiled.programMap.requiredHostCapabilities = ['filesystem.execute'];
  await assert.rejects(createPascalishServiceHost({ ...options, compiled }), /filesystem.execute/);
  const daemon = compile(`daemon 'writer' every 60000 ms; begin host.fs_write_text('catalog', 'daemon.txt', 'data') end.`);
  delete daemon.programMap.requiredHostCapabilities;
  await assert.rejects(createPascalishServiceHost({ ...options, compiled: portable(), daemons: [daemon] }), /filesystem.write/);
});

test('real Pascalish HTTP handlers use granted desktop storage and report actual limits', async t => {
  const { root } = await fixture(t);
  const host = await createPascalishServiceHost({
    compiled: filesystemService(), collectorId: 'test', httpPort: 0, udpPort: null,
    storageRoots: { catalog: { path: root, readOnly: false } },
    maxFileBytes: 32768, logger: { warn() {}, error() {} }
  });
  t.after(() => host.stop());
  await host.start();
  const origin = `http://127.0.0.1:${host.getStatus().httpPort}`;
  const response = await fetch(`${origin}/write`, { method: 'POST', body: '{"saved":true}' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { saved: true });
  assert.equal(await fs.readFile(path.join(root, 'saved.json'), 'utf8'), '{"saved":true}');
  const capabilities = await (await fetch(`${origin}/capabilities`)).json();
  assert.equal(capabilities.profile, 'desktop');
  assert.deepEqual(capabilities.filesystem, [{ name: 'catalog', readOnly: false }]);
  assert.equal(capabilities.limits.maxFileBytes, 32768);
  assert.deepEqual(capabilities, host.getStatus().capabilities);
  const statusResponse = await fetch(`${origin}/pmachine/service_host/status`);
  assert.deepEqual((await statusResponse.json()).capabilities, capabilities);
});

test('Pascalish executes all filesystem bindings through the shared host ABI', async t => {
  const { root } = await fixture(t);
  const compiled = compile(`service 'filesystem-lifecycle';
post '/create';
begin
  host.fs_mkdir('catalog', 'archive');
  host.fs_write_text('catalog', 'item.txt', 'content');
  return host.fs_stat('catalog', 'item.txt')
end
get '/list';
begin return host.fs_list('catalog', '.', '', 10) end
post '/move';
begin
  host.fs_rename('catalog', 'item.txt', 'archive/item.txt');
  return host.fs_read_text('catalog', 'archive/item.txt')
end
post '/delete';
begin
  host.fs_delete('catalog', 'archive/item.txt');
  return host.fs_list('catalog', 'archive', '', 10)
end
end.`);
  const host = await createPascalishServiceHost({
    compiled, collectorId: 'test', httpPort: null, udpPort: null,
    storageRoots: { catalog: { path: root, readOnly: false } }
  });
  t.after(() => host.stop());
  await host.start();
  const event = (path, method = 'POST') => ({ path, method, body: '', peer: '127.0.0.1' });
  const created = await host.dispatch(event('/create'));
  assert.equal(created.status, 200);
  assert.equal(created.body.kind, 'file');
  assert.equal(created.body.size, 7);
  const listing = await host.dispatch(event('/list', 'GET'));
  assert.equal(listing.status, 200);
  assert.deepEqual(listing.body.entries.map(entry => entry.name), ['archive', 'item.txt']);
  const moved = await host.dispatch(event('/move'));
  assert.equal(moved.status, 200);
  assert.equal(moved.body, 'content');
  const deleted = await host.dispatch(event('/delete'));
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body, { entries: [], nextCursor: '' });
  assert.deepEqual(await fs.readdir(path.join(root, 'archive')), []);
});

test('deployment uses operator grants, ignores request roots and retains the running service on denial', async t => {
  const { root, outside } = await fixture(t);
  const machine = createJsPmachineNodeServer({
    storageGrants: { trusted: { catalog: { path: root, readOnly: false } } },
    logger: { warn() {}, error() {}, log() {} }
  });
  t.after(async () => {
    if (!machine.listening) return;
    await fetch(`http://127.0.0.1:${machine.address().port}/pmachine/service_host/stop`, { method: 'POST' });
    machine.closeAllConnections();
    await new Promise((resolve, reject) => machine.close(error => error ? reject(error) : resolve()));
  });
  await new Promise((resolve, reject) => {
    machine.once('error', reject);
    machine.listen(0, '127.0.0.1', () => { machine.removeListener('error', reject); resolve(); });
  });
  const origin = `http://127.0.0.1:${machine.address().port}`;
  const form = (route, values) => fetch(`${origin}${route}`, { method: 'POST', body: new URLSearchParams(values) });
  const compiled = filesystemService();
  for (const [file, body] of [
    ['/catalog.pcode', compiled.pcodeText],
    ['/catalog.json', JSON.stringify(attachPcodeSignature(compiled.programMap, compiled.pcodeText))]
  ]) assert.equal((await form('/ffs/upload', { file, body })).status, 200);
  const artifacts = { serviceFile: '/catalog.pcode', serviceMap: '/catalog.json' };
  const denied = await form('/pmachine/service_host/install', {
    ...artifacts, collectorId: 'ungranted',
    storageRoots: JSON.stringify({ catalog: { path: outside, readOnly: false } })
  });
  assert.equal(denied.status, 403);
  assert.match(await denied.text(), /capabilities unavailable/);
  const installed = await form('/pmachine/service_host/install', { ...artifacts, collectorId: 'trusted' });
  assert.equal(installed.status, 200);
  assert.deepEqual((await installed.json()).capabilities.supported, ['filesystem.read', 'filesystem.write']);
  const write = await fetch(`${origin}/write`, { method: 'POST', body: '{"trusted":true}' });
  assert.equal(write.status, 200);
  assert.equal(await fs.readFile(path.join(root, 'saved.json'), 'utf8'), '{"trusted":true}');
  const replacement = await form('/pmachine/service_host/install', { ...artifacts, collectorId: 'ungranted' });
  assert.equal(replacement.status, 409);
  const additional = await form('/pmachine/service_host/install', {
    ...artifacts, collectorId: 'ungranted', additional: 'true', httpPort: '0'
  });
  assert.equal(additional.status, 403);
  const status = await (await fetch(`${origin}/pmachine/service_host/status`)).json();
  assert.equal(status.running, true);
  assert.equal(status.collectorId, 'trusted');
  assert.equal((await fetch(`${origin}/capabilities`)).status, 200);
  assert.deepEqual(await fs.readdir(outside), ['secret.txt']);
});
