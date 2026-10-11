import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { applyMappingAction, emptyMapping, fieldsOf, parseMapping, prototypeMapping, publicationPayload, rulesOf, validateConversionRule } from '../out/dataMapperModel.js';

test('prototype preserves the Aggregator rules format and exposes all embedded fields', () => {
  const map = parseMapping(JSON.stringify(prototypeMapping()));
  assert.equal(fieldsOf(map, 'source').length, 6);
  assert.equal(fieldsOf(map, 'target').length, 7);
  const mapped = applyMappingAction(map, { type: 'connect', sourcePath: 'amount', targetPath: 'transfer.instructedAmount' });
  assert.equal(rulesOf(mapped).length, 2);
  assert.deepEqual(rulesOf(mapped)[1], { sourcePath: 'amount', targetPath: 'transfer.instructedAmount',
    kind: 'leaf', sourceValueType: 'decimal', targetValueType: 'decimal', conversionRule: '' });
  assert.equal(rulesOf(map).length, 1);
});

test('conversion and removal preserve legacy items and unrelated metadata', () => {
  const map = parseMapping(JSON.stringify({ custom: { retained: true }, items: [
    { sourcePath: 'a', targetPath: 'b', vendor: 42 },
  ] }));
  const changed = applyMappingAction(map, { type: 'conversion', index: 0, conversionRule: 'output := trim(src);' });
  assert.equal(changed.rules, undefined);
  assert.equal(changed.items[0].vendor, 42);
  assert.deepEqual(changed.custom, { retained: true });
  assert.deepEqual(applyMappingAction(changed, { type: 'remove', index: 0 }).items, []);
  assert.equal(fieldsOf(map, 'source')[0].path, 'a');
});

test('invalid inputs fail explicitly', () => {
  for (const text of ['{', '[]', '{}', '{"rules":[{}]}', '{"rules":[{"sourcePath":"a","targetPath":"b","conversionRule":5}]}']) {
    assert.throws(() => parseMapping(text));
  }
  const map = prototypeMapping();
  for (const action of [
    { type: 'connect', sourcePath: 'reference', targetPath: 'transfer.id' },
    { type: 'connect', sourcePath: 'missing', targetPath: 'transfer.id' },
    { type: 'connect', sourcePath: 'amount', targetPath: 'transfer' },
    { type: 'remove', index: -1 }, { type: 'remove', index: 0.5 },
    { type: 'conversion', index: 0, conversionRule: 'x'.repeat(1001) },
    { type: 'conversion', index: 0, conversionRule: {} }, { type: 'unknown' }, null,
  ]) assert.throws(() => applyMappingAction(map, action));
});

test('legacy field aliases import, and cleared legacy conversions cannot reappear at runtime', () => {
  const map = parseMapping(JSON.stringify({ ...prototypeMapping(), rules: [
    { from: 'reference', to: 'transfer.id', conversion: 'output := trim(src);', vendor: 7 },
  ] }));
  assert.equal(map.rules[0].sourcePath, 'reference');
  const changed = applyMappingAction(map, { type: 'conversion', index: 0, conversionRule: '' });
  assert.equal(publicationPayload(changed).rules[0].conversion, '');
  assert.equal(changed.rules[0].vendor, 7);
});

test('publication rejects missing identity, unsafe IDs, missing schema fields and invalid conversions', () => {
  assert.throws(() => publicationPayload({ ...emptyMapping(), id: '' }), /id is required/);
  assert.throws(() => publicationPayload({ ...prototypeMapping(), id: '../unsafe' }), /Map ID/);
  assert.throws(() => publicationPayload({ ...prototypeMapping(), rules: [{ sourcePath: 'removed', targetPath: 'transfer.id' }] }), /no longer/);
  assert.throws(() => publicationPayload({ ...prototypeMapping(), rules: [] }), /at least one/);
  assert.throws(() => validateConversionRule('output := ([src)];'), /delimiters/);
  assert.throws(() => validateConversionRule('output := "abc;'), /quotes/);
  validateConversionRule('output := trim(src);');
  validateConversionRule('');
});

const mock = `
export const Uri = { joinPath: (base, ...parts) => ({ toString: () => base.toString() + '/' + parts.join('/') }) };
export class Range { constructor(start, end) { this.start = start; this.end = end; } }
export class WorkspaceEdit {
  constructor() { this.splices = []; }
  replace(uri, range, text) { this.splices.push({ start: range.start, end: range.end, text }); }
  createFile(uri, options) { this.createdUri = uri; this.options = options; }
  insert(uri, position, text) { this.text = text; }
}
export class Position {}
export const ViewColumn = { Beside: -2 };
export const workspace = {
  isTrusted: true,
  getConfiguration: () => ({ get: (_, fallback) => fallback }),
  onDidChangeConfiguration() { return { dispose() {} }; },
  async openTextDocument() { return { save: async () => true }; },
  onDidChangeTextDocument(handler) { globalThis.mapperChanged = handler; return { dispose() { globalThis.mapperChangeDisposed = true; } }; },
  async applyEdit(edit) {
    if (globalThis.mapperReject) return false;
    if (edit.createdUri) { globalThis.mapperCreated = edit; return true; }
    let text = globalThis.mapperDocument.text;
    for (const splice of [...edit.splices].sort((a, b) => b.start - a.start)) {
      text = text.slice(0, splice.start) + splice.text + text.slice(splice.end);
    }
    globalThis.mapperDocument.text = text;
    globalThis.mapperDocument.version++;
    globalThis.mapperChanged({ document: globalThis.mapperDocument });
    return true;
  },
};
export const window = {
  registerCustomEditorProvider: () => ({ dispose() {} }),
  showSaveDialog: async () => ({ toString: () => 'test:import-file' }),
  showErrorMessage: async message => { globalThis.mapperError = message; },
  showQuickPick: async choices => globalThis.mapperCancel ? undefined : choices[0],
  showWarningMessage: async (_, options, choice) => globalThis.mapperCancel || globalThis.mapperDeclineClear ? undefined : choice,
  showInputBox: async options => options.title === 'Mapping ID' ? 'edited-map' : 'Edited map',
};
export const commands = {
  registerCommand(name, handler) { globalThis.mapperRegistered.set(name, handler); return { dispose() {} }; },
  async executeCommand(...args) { globalThis.mapperCommand = args; },
};
`;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'vscode') return { url: `data:text/javascript,${encodeURIComponent(mock)}`, shortCircuit: true };
    return next(specifier, context);
  },
});
const { DataMapperEditor, registerDataMapper } = await import('../out/dataMapperEditor.js');
const { mappingToMapl, maplToMapping } = await import('../out/maplDocument.js');
hooks.deregister();
const parseMapl = text => maplToMapping(text);

test('custom editor splices MAPL edits, keeps comments, rejects stale versions, reports invalid MAPL and disposes listeners', async () => {
  const messages = [];
  let receive;
  let dispose;
  let messageDisposed = false;
  const panel = {
    webview: { cspSource: 'http://localhost:43127',
      asWebviewUri: uri => uri.toString(),
      postMessage: async message => { messages.push(message); return true; },
      onDidReceiveMessage: handler => { receive = handler; return { dispose() { messageDisposed = true; } }; },
    },
    onDidDispose: handler => { dispose = handler; },
  };
  const initial = mappingToMapl(prototypeMapping()).replace('end;', '  // keep this comment\n  if source.amount > 0 then target.transfer.status := source.status; end;\nend;');
  const document = {
    uri: { toString: () => 'test:map' }, version: 1, lineCount: 50,
    text: initial, getText() { return this.text; }, positionAt: offset => offset,
  };
  globalThis.mapperDocument = document;
  new DataMapperEditor({ toString: () => 'http://localhost:43127' }, { appendLine() {} })
    .resolveCustomTextEditor(document, panel);
  assert.match(panel.webview.html, /Content-Security-Policy/);
  assert.match(panel.webview.html, /dataMapper.js/);
  await receive({ type: 'ready' });
  const first = messages.findLast(message => message.type === 'state');
  assert.equal(first.rules.length, 1);
  assert.equal(first.source.length, 6, 'built-in prototype structure supplies all source fields');
  assert.equal(first.extras.length, 1);
  await receive({ type: 'edit', version: 1, action: { type: 'connect', sourcePath: 'amount', targetPath: 'transfer.instructedAmount' } });
  assert.equal(parseMapl(document.text).rules.length, 2);
  assert.match(document.text, /\/\/ keep this comment\n  if source\.amount > 0 then .* end;\n  target\.transfer\.instructedAmount := source\.amount;\nend;\n$/);
  assert.match(document.text, /if source\.amount > 0 then/);
  const afterConnect = document.text;
  await receive({ type: 'edit', version: 1, action: { type: 'remove', index: 0 } });
  assert.equal(messages.at(-1).type, 'error');
  assert.equal(messages.at(-1).actionError, true);
  assert.equal(parseMapl(document.text).rules.length, 2);
  globalThis.mapperReject = true;
  await receive({ type: 'edit', version: 2, action: { type: 'remove', index: 0 } });
  assert.match(messages.at(-1).message, /could not apply/);
  globalThis.mapperReject = false;
  await receive({ type: 'text' });
  assert.equal(globalThis.mapperCommand[0], 'vscode.openWith');
  document.text = initial;
  document.version++;
  globalThis.mapperChanged({ document });
  assert.equal(messages.at(-1).rules.length, 1);
  document.text = afterConnect;
  document.version++;
  globalThis.mapperChanged({ document });
  assert.equal(messages.at(-1).rules.length, 2);
  document.text = 'map broken';
  globalThis.mapperChanged({ document });
  assert.equal(messages.at(-1).type, 'error');
  assert.equal(messages.at(-1).actionError, false);
  document.text = afterConnect;
  document.version++;
  globalThis.mapperChanged({ document });
  assert.equal(messages.at(-1).type, 'state');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(url, 'http://127.0.0.1:4000/api/librarian/schemas');
    return Response.json({ schemas: [{ path: 'schemas/new.json', typeId: 'new', name: 'New schema', structure: {
      children: [{ name: 'newField', kind: 'leaf', valueType: 'string' }],
    } }] });
  };
  try {
    globalThis.mapperCancel = true;
    const before = document.text;
    await receive({ type: 'schema', side: 'source', version: document.version });
    assert.equal(document.text, before);
    globalThis.mapperCancel = false;
    globalThis.mapperDeclineClear = true;
    await receive({ type: 'schema', side: 'source', version: document.version });
    assert.equal(document.text, before, 'declining schema change must preserve the current mappings');
    globalThis.mapperDeclineClear = false;
    await receive({ type: 'schema', side: 'source', version: document.version });
    const selected = parseMapl(document.text);
    assert.deepEqual(messages.findLast(message => message.type === 'state').source.map(field => field.path), ['newField']);
    assert.match(document.text, /^map 'vscode-prototype' from new to 'prototype-transfer';/);
    assert.match(document.text, /keep this comment/);
    assert.equal(selected.sourceSchemaPath, 'schemas/new.json');
    assert.equal(selected.rules.length, 0);
    await receive({ type: 'metadata', version: document.version });
    assert.equal(parseMapl(document.text).id, 'edited-map');
    globalThis.fetch = async () => Response.json({ error: 'Invalid embedded JSON' }, { status: 500 });
    await receive({ type: 'schema', side: 'source', version: document.version });
    assert.equal(messages.at(-1).type, 'error');
    assert.match(messages.at(-1).message, /Invalid embedded JSON/);
    assert.equal(messages.at(-1).actionError, true);
  } finally { globalThis.fetch = originalFetch; }
  dispose();
  assert.equal(messageDisposed, true);
  assert.equal(globalThis.mapperChangeDisposed, true);
});

test('import command writes a backend map as a new MAPL file and opens the designer', async () => {
  globalThis.mapperRegistered = new Map();
  globalThis.mapperCancel = false;
  globalThis.mapperCreated = undefined;
  globalThis.mapperError = undefined;
  registerDataMapper({ subscriptions: [], extensionUri: { toString: () => 'test:extension' } }, { appendLine() {} });
  const originalFetch = globalThis.fetch;
  const map = { ...prototypeMapping(), id: 'import-test', vendorMetadata: { preserved: true } };
  globalThis.fetch = async url => {
    if (url.endsWith('/api/mapper/maps')) return Response.json({ maps: [{ id: map.id, name: map.name }] });
    assert.equal(url, 'http://127.0.0.1:4000/api/mapper/maps/import-test');
    return Response.json({ map });
  };
  try {
    await globalThis.mapperRegistered.get('pulse-pmachine.importDataMap')();
    assert.equal(globalThis.mapperError, undefined);
    const imported = parseMapl(globalThis.mapperCreated.text);
    assert.equal(imported.id, 'import-test');
    assert.deepEqual(rulesOf(imported).map(rule => [rule.sourcePath, rule.targetPath]), rulesOf(map).map(rule => [rule.sourcePath, rule.targetPath]));
    assert.deepEqual(globalThis.mapperCreated.options, { overwrite: false });
    assert.equal(globalThis.mapperCommand[0], 'vscode.openWith');
    assert.equal(globalThis.mapperCommand[2], 'pulse-pmachine.dataMapper');
    globalThis.mapperCreated = undefined;
    globalThis.mapperCancel = true;
    await globalThis.mapperRegistered.get('pulse-pmachine.importDataMap')();
    assert.equal(globalThis.mapperCreated, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.mapperCancel = false;
  }
});
