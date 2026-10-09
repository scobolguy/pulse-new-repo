import assert from 'node:assert/strict';
import Module from 'node:module';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { runPcodeOnEsp32 } from '../../../aggregator/scripts/run-pascal-on-esp32-node.mjs';
import { signPcodeText } from '../../../aggregator/scripts/pcode-signing.mjs';
import { executeProgram, loadOpcodeMap, parsePcode, parseProgramMapMappings } from '../../../pmachines/javascript/index.mjs';
import { startEsp32DebugSession, controlEsp32DebugSession } from '../../../aggregator/src/backend/modules/esp32PmachineDebugBridge.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const program = fileURLToPath(new URL('../../../src/towers-of-hanoi-program.pas', import.meta.url));
const collectorProgram = fileURLToPath(new URL('../../../src/discovery-collector-service.pas', import.meta.url));
const source = await readFile(program, 'utf8');
const collectorSource = await readFile(collectorProgram, 'utf8');
const artifact = compilePascalishProgramWithAntlr(source, { fileName: 'towers-of-hanoi-program.pas' });

const vscodeMock = `
  export class EventEmitter {
    listeners = [];
    event = listener => { this.listeners.push(listener); return { dispose() {} }; };
    fire(message) { for (const listener of this.listeners) listener(message); }
    dispose() {}
  }
  export const Uri = { file: fsPath => ({ fsPath }), parse: value => ({ toString: () => value }) };
  export class TreeItem {
    constructor(label, collapsibleState) { this.label = label; this.collapsibleState = collapsibleState; }
  }
  export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
  export class ThemeIcon { constructor(id) { this.id = id; } }
  export const env = { openExternal: async () => true };
  export const workspace = {
    isTrusted: true,
    getWorkspaceFolder: () => ({ uri: { fsPath: ${JSON.stringify(root)} } }),
    getConfiguration: () => ({ get: (_, fallback) => fallback }),
    onDidChangeConfiguration: handler => { globalThis.pulseTestConfigurationHandler = handler; return { dispose() {} }; },
    onDidGrantWorkspaceTrust: handler => { globalThis.pulseTestTrustHandler = handler; return { dispose() {} }; },
  };
  export class DebugAdapterInlineImplementation { constructor(adapter) { this.implementation = adapter; } }
  export const debug = {
    registerDebugAdapterDescriptorFactory: (_, factory) => { globalThis.pulseTestFactory = factory; return {}; },
    onDidReceiveDebugSessionCustomEvent: () => ({ dispose() {} }),
  };
  export const ViewColumn = { Beside: -2 };
  export const ProgressLocation = { Notification: 15 };
  export const window = {
    registerCustomEditorProvider: () => ({ dispose() {} }),
    registerCustomTextEditorProvider: () => ({ dispose() {} }),
    createOutputChannel: () => ({ dispose() {}, appendLine() {} }),
    createWebviewPanel: () => { throw new Error('webview not available in tests'); },
    registerTreeDataProvider: (id, provider) => {
      if (id === 'pulse-pmachine.services') globalThis.pulseTestServicesProvider = provider;
      if (id === 'pulse-pmachine.servers') globalThis.pulseTestServersProvider = provider;
      if (id === 'pulse-pmachine.dataLibrarian') globalThis.pulseTestLibrarianProvider = provider;
      return { dispose() {} };
    },
  };
  export const registeredCommands = new Map();
  export const commands = { registerCommand: (name, handler) => {
    registeredCommands.set(name, handler);
    if (name === 'pulse-pmachine.runCurrentFile') globalThis.pulseTestRunCommand = handler;
    return {};
  } };
  export const languages = {
    registerCodeLensProvider: () => ({}),
    createDiagnosticCollection: () => ({ dispose() {}, set() {}, delete() {}, clear() {} }),
  };
`;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'vscode') return { url: `data:text/javascript,${encodeURIComponent(vscodeMock)}`, shortCircuit: true };
    return next(specifier, context);
  },
});
const vscode = await import('vscode');
const originalModuleLoad = Module._load;
Module._load = function (specifier, parent, isMain) {
  if (specifier === 'vscode') return vscode;
  return originalModuleLoad.call(this, specifier, parent, isMain);
};
const { activate, loadPmachineTargets } = await import('../out/extension.js');
Module._load = originalModuleLoad;
activate({ subscriptions: [], extensionUri: {} });
hooks.deregister();

test('Data Librarian has a dedicated contributed view and browses nested schema fields', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(manifest.contributes.views.explorer.some(view => view.id === 'pulse-pmachine.dataLibrarian'));
  for (const command of ['showDataLibrarian', 'refreshLibrarian', 'openLibrarianSchema']) {
    assert.ok(manifest.contributes.commands.some(entry => entry.command === `pulse-pmachine.${command}`));
    assert.ok(vscode.registeredCommands.has(`pulse-pmachine.${command}`));
  }
  const originalFetch = globalThis.fetch;
  const originalWorkspace = { ...vscode.workspace };
  const originalWindow = { ...vscode.window };
  const originalExecute = vscode.commands.executeCommand;
  let requests = 0;
  let snapshot;
  let focused;
  const schema = { path: 'payments/payment.json', name: 'Payment', typeId: 'payment', structure: { children: [
    { name: 'transfer', kind: 'branch', valueType: 'object', children: [
      { name: 'amount', kind: 'leaf', valueType: 'decimal' },
    ] },
    { name: 'reference', kind: 'leaf', valueType: 'string' },
  ] } };
  globalThis.fetch = async url => {
    requests++;
    assert.equal(url, 'http://127.0.0.1:4000/api/librarian/schemas');
    return Response.json({ schemas: [{ path: 'unparsed.xsd', name: 'Unparsed', structure: null }, schema] });
  };
  vscode.workspace.openTextDocument = async options => { snapshot = options; return { options }; };
  vscode.window.showTextDocument = async document => assert.deepEqual(document.options, snapshot);
  vscode.commands.executeCommand = async command => { focused = command; };
  try {
    const provider = globalThis.pulseTestLibrarianProvider;
    const schemas = await provider.getChildren();
    assert.deepEqual(schemas.map(item => item.label), ['Payment', 'Unparsed']);
    assert.equal(schemas[0].description, 'payment');
    assert.match(schemas[1].description, /no field structure/);
    assert.deepEqual(await provider.getChildren(schemas[1]), []);
    const fields = await provider.getChildren(schemas[0]);
    assert.deepEqual(fields.map(item => item.label), ['transfer', 'reference']);
    assert.equal(fields[0].collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    const nested = await provider.getChildren(fields[0]);
    assert.equal(nested[0].label, 'transfer.amount');
    assert.equal(nested[0].description, 'decimal');
    assert.deepEqual(await provider.getChildren(nested[0]), []);
    assert.equal(requests, 1, 'expanding fields uses the captured catalog, not additional requests');
    await vscode.registeredCommands.get('pulse-pmachine.openLibrarianSchema')(nested[0]);
    assert.equal(snapshot.language, 'json');
    assert.deepEqual(JSON.parse(snapshot.content), schema);
    await vscode.registeredCommands.get('pulse-pmachine.showDataLibrarian')();
    assert.equal(focused, 'pulse-pmachine.dataLibrarian.focus');
    let refreshes = 0;
    provider.onDidChangeTreeData(() => { refreshes++; });
    vscode.registeredCommands.get('pulse-pmachine.refreshLibrarian')();
    globalThis.pulseTestConfigurationHandler({ affectsConfiguration: key => key === 'pulse-pmachine.backendUrl' });
    globalThis.pulseTestTrustHandler();
    assert.equal(refreshes, 3);
    vscode.workspace.isTrusted = false;
    assert.match((await provider.getChildren())[0].label, /Trust this workspace/);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(vscode.workspace, originalWorkspace);
    Object.assign(vscode.window, originalWindow);
    vscode.commands.executeCommand = originalExecute;
  }
});

test('the unified VSIX contributes and activates the Pulse Studio Deploy panel', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.version, '0.1.15');
  assert.equal(manifest.displayName, 'Pulse Studio & PMachine Debugger');
  assert.ok(manifest.contributes.viewsContainers.activitybar.some(item => item.id === 'pulseCatalogStudio'));
  assert.ok(manifest.contributes.views.pulseCatalogStudio.some(item => item.id === 'pulseCatalogStudio.deploy'));
  for (const command of [
    'pulseCatalogStudio.refreshDeployView',
    'pulseCatalogStudio.validateWflDeployment',
    'pulseCatalogStudio.previewWflDeployment',
    'pulseCatalogStudio.deployWflDeployment',
    'pulseCatalogStudio.deployNetworkCache',
  ]) {
    assert.ok(manifest.contributes.commands.some(item => item.command === command));
    assert.ok(vscode.registeredCommands.has(command));
  }
});

test('Data Librarian loads lazily-parsed schema structures on expand and caches them until refresh', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  const structure = { children: [{ name: 'Document', kind: 'branch', valueType: 'object', children: [
    { name: 'Id', kind: 'leaf', valueType: 'string' },
  ] }] };
  globalThis.fetch = async url => {
    urls.push(String(url));
    if (String(url).endsWith('/api/librarian/schemas')) {
      return Response.json({ schemas: [
        { path: 'iso/pain.001.xsd', name: 'Pain', structure: null, structureLoaded: false, mtime: 'm1' },
        { path: 'broken.xsd', name: 'Broken', structure: null, structureLoaded: false },
      ] });
    }
    if (String(url).includes('broken.xsd')) return Response.json({ error: 'parse failed' }, { status: 500 });
    return Response.json({ path: 'iso/pain.001.xsd', mtime: 'm2', structure });
  };
  try {
    const provider = globalThis.pulseTestLibrarianProvider;
    const schemas = await provider.getChildren();
    assert.deepEqual(schemas.map(item => item.label), ['Broken', 'Pain']);
    assert.equal(schemas[1].collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.doesNotMatch(String(schemas[1].description), /no field structure/);
    const fields = await provider.getChildren(schemas[1]);
    assert.deepEqual(fields.map(item => item.label), ['Document']);
    assert.equal((await provider.getChildren(fields[0]))[0].label, 'Document.Id');
    await provider.getChildren(schemas[1]);
    assert.deepEqual(urls.filter(url => url.includes('schema-structure')),
      ['http://127.0.0.1:4000/api/librarian/schema-structure?path=iso%2Fpain.001.xsd']);
    assert.match((await provider.getChildren(schemas[0]))[0].label, /Field structure unavailable/);
    provider.refresh();
    await provider.getChildren(schemas[1]);
    assert.equal(urls.filter(url => url.includes('pain.001')).length, 2, 'refresh drops loaded structures');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Data Librarian falls back to the Librarian service when the backend is unreachable', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(url);
    if (String(url).startsWith('http://127.0.0.1:4000')) throw new TypeError('fetch failed');
    return Response.json({ schemas: [{ path: 'direct.json' }] });
  };
  try {
    const items = await globalThis.pulseTestLibrarianProvider.getChildren();
    assert.equal(items[0].label, 'direct.json');
    assert.deepEqual(urls, ['http://127.0.0.1:4000/api/librarian/schemas', 'http://127.0.0.1:4300/api/librarian/schemas']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Data Librarian surfaces catalog errors, empty catalogs, and recovers on refresh', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = { ...vscode.window };
  const errors = [];
  const output = [];
  Object.assign(vscode.window, {
    createOutputChannel: () => ({ dispose() {}, appendLine: line => output.push(line) }),
    showErrorMessage: message => errors.push(message),
  });
  activate({ subscriptions: [], extensionUri: {} });
  try {
    const provider = globalThis.pulseTestLibrarianProvider;
    for (const response of [
      () => Response.json({ error: 'Catalog unavailable' }, { status: 502 }),
      () => Response.json({ schemas: {} }),
      () => Response.json({ schemas: [{ path: 'broken', structure: { children: [{}] } }] }),
    ]) {
      globalThis.fetch = async () => response();
      const items = await provider.getChildren();
      assert.match(items[0].label, /unavailable - refresh/);
      assert.ok(items[0].tooltip);
    }
    assert.equal(errors.length, 3);
    assert.equal(output.length, 3);
    globalThis.fetch = async () => Response.json({ schemas: [] });
    provider.refresh();
    assert.match((await provider.getChildren())[0].label, /No schemas registered/);
    globalThis.fetch = async () => Response.json({ schemas: [{ path: 'recovered.json' }] });
    provider.refresh();
    assert.equal((await provider.getChildren())[0].label, 'recovered.json');
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(vscode.window, originalWindow);
  }
});

test('Services Explorer reads the services directory, endpoints, and configuration', async () => {
  const originalFetch = globalThis.fetch;
  const originalOpenExternal = vscode.env.openExternal;
  const opened = [];
  globalThis.fetch = async url => {
    assert.equal(url, 'http://127.0.0.1:4000/api/services');
    return Response.json({ services: [
      { id: 'collector', name: 'Pascalish Discovery Collector', provider: 'pascalish', protocol: 'http+udp', configurationRef: 'service.collector' },
      { id: 'rabbit', name: 'RabbitMQ Broker', provider: 'rabbitmq', protocol: 'amqp', endpoint: null },
      { id: 'gateway', name: 'Pulse Gateway', endpoint: 'http://127.0.0.1:4000' },
    ] });
  };
  vscode.env.openExternal = async uri => { opened.push(uri.toString()); return true; };
  try {
    const provider = globalThis.pulseTestServicesProvider;
    const items = await provider.getChildren();
    assert.deepEqual(items.map(item => item.label), ['Pascalish Discovery Collector', 'Pulse Gateway']);
    assert.equal(items[0].contextValue, 'pulseServiceOffering');
    assert.match(items[0].tooltip, /No endpoint configured/);
    assert.equal(items[0].collapsibleState, vscode.TreeItemCollapsibleState.None);
    assert.deepEqual(await provider.getChildren(items[0]), []);
    assert.match(items[0].tooltip, /service.collector/);
    assert.equal(items[1].command.command, 'pulse-pmachine.openServiceEndpoint');
    await vscode.registeredCommands.get('pulse-pmachine.openServiceEndpoint')(...items[1].command.arguments);
    assert.deepEqual(opened, ['http://127.0.0.1:4000/']);
    const servers = await globalThis.pulseTestServersProvider.getChildren();
    assert.deepEqual(servers.map(item => item.label), ['RabbitMQ Broker']);
    let refreshes = 0;
    provider.onDidChangeTreeData(() => { refreshes += 1; });
    vscode.registeredCommands.get('pulse-pmachine.refreshServices')();
    globalThis.pulseTestConfigurationHandler({ affectsConfiguration: key => key === 'pulse-pmachine.backendUrl' });
    assert.equal(refreshes, 2);
  } finally {
    globalThis.fetch = originalFetch;
    vscode.env.openExternal = originalOpenExternal;
  }
});

test('Services Explorer shows every occurrence of a service as a distinct instance leaf', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ services: [
    { id: 'worker', serviceId: 'worker', name: 'Worker', instanceId: 'one', nodeId: 'node-a', endpoint: 'http://node-a:4111', status: 'running' },
    { id: 'worker', serviceId: 'worker', name: 'Worker', instanceId: 'two', nodeId: 'node-b', endpoint: 'http://node-b:4112', status: 'running' },
    { id: 'sql', name: 'MSSQL', provider: 'mssql', kind: 'database' }
  ] });
  try {
    const provider = globalThis.pulseTestServicesProvider;
    const groups = await provider.getChildren();
    assert.equal(groups.length, 1);
    assert.equal(groups[0].label, 'Worker');
    assert.equal(groups[0].collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    const instances = await provider.getChildren(groups[0]);
    assert.deepEqual(instances.map(item => item.label), ['node-a / one', 'node-b / two']);
    assert.notEqual(instances[0].id, instances[1].id);
    for (const instance of instances) {
      assert.equal(instance.collapsibleState, vscode.TreeItemCollapsibleState.None);
      assert.equal(instance.contextValue, 'pulseServiceEndpoint');
      assert.deepEqual(await provider.getChildren(instance), []);
    }
    assert.deepEqual((await globalThis.pulseTestServersProvider.getChildren()).map(item => item.label), ['MSSQL']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Services Explorer surfaces HTTP and malformed directory failures and recovers on refresh', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = { ...vscode.window };
  const errors = [];
  const output = [];
  Object.assign(vscode.window, {
    createOutputChannel: () => ({ dispose() {}, appendLine: line => output.push(line) }),
    showErrorMessage: message => errors.push(message),
  });
  try {
    activate({ subscriptions: [], extensionUri: {} });
    const provider = globalThis.pulseTestServicesProvider;
    for (const response of [new Response('offline', { status: 503 }), Response.json({ catalog: {} })]) {
      globalThis.fetch = async () => response;
      const items = await provider.getChildren();
      assert.match(items[0].label, /Services unavailable/);
    }
    assert.equal(errors.length, 2);
    assert.equal(output.length, 2);
    assert.match(errors[0], /HTTP 503/);
    assert.match(errors[1], /does not contain services/);
    globalThis.fetch = async () => Response.json({ services: [] });
    provider.refresh();
    assert.equal((await provider.getChildren())[0].label, 'No services registered');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(vscode.window)) delete vscode.window[key];
    Object.assign(vscode.window, originalWindow);
  }
});

test('run target picker includes discovered JavaScript PMachines as JavaScript targets', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json([
    {
      nodeName: 'magic-js-pmachine-03',
      ip: '127.0.10.103',
      port: 4103,
      details: { runtime: 'js-pmachine', hardware: 'PMachine JavaScript VM', services: ['PMachine'] },
    },
    { nodeName: 'js-hardware', ip: '192.168.2.10', details: { hardware: 'PMachine JavaScript VM', services: ['PMachine'] } },
    { nodeName: 'js-service', ip: '192.168.2.11', serviceName: 'js-pmachine', services: ['PMachine'] },
    { nodeName: 'ESP32-VM-1078', ip: '192.168.2.115', details: { services: [{ name: 'PMachine' }] } },
    { nodeName: 'sensor', ip: '192.168.2.12', details: { services: ['DHT11'] } },
  ]);
  try {
    const targets = await loadPmachineTargets();
    assert.deepEqual(targets.map(({ runtime, nodeId }) => ({ runtime, nodeId })), [
      { runtime: 'js', nodeId: undefined },
      { runtime: 'js', nodeId: 'magic-js-pmachine-03' },
      { runtime: 'js', nodeId: 'js-hardware' },
      { runtime: 'js', nodeId: 'js-service' },
      { runtime: 'esp32', nodeId: 'ESP32-VM-1078' },
    ]);
    assert.equal(targets[1].description, '127.0.10.103 · JavaScript PMachine');
    assert.equal(targets[4].description, '192.168.2.115 · ESP32 PMachine');
    assert.ok(targets.slice(1, 4).every(target => target.host === undefined));
    assert.equal(targets[4].host, '192.168.2.115');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('editor runs a discovered JavaScript target through the backend, not its registry address', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = { ...vscode.window };
  const output = [];
  const errors = [];
  const requests = [];
  Object.assign(vscode.window, {
    activeTextEditor: { document: {
      uri: { fsPath: program }, fileName: program, languageId: 'pascalish', getText: () => source,
    } },
    createOutputChannel: () => ({
      clear() {}, appendLine: line => output.push(line), show() {}, dispose() {},
    }),
    showQuickPick: async targets => targets.find(target => target.nodeId === 'magic-js-pmachine-01'),
    withProgress: async (_, task) => task(),
    showErrorMessage: message => errors.push(message),
  });
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/api/pmachine/nodes')) {
      return Response.json([{
        nodeName: 'magic-js-pmachine-01', ip: '127.0.10.101', port: 4101,
        details: { runtime: 'js-pmachine', services: ['PMachine'] },
      }]);
    }
    assert.equal(url, 'http://127.0.0.1:4000/api/pmachine/deploy-and-run');
    return Response.json({ result: { stdout: ['Move disk 1 from 1 to 3'], stepCount: 802 } });
  };
  try {
    activate({ subscriptions: [], extensionUri: {}, globalState: { get() {}, async update() {} } });
    await globalThis.pulseTestRunCommand();
    assert.deepEqual(errors, []);
    assert.equal(requests.length, 2);
    const body = JSON.parse(requests[1].options.body);
    assert.equal(body.runtime, 'js');
    assert.equal(body.targetNodeId, 'magic-js-pmachine-01');
    assert.equal(body.pcodeText, artifact.pcodeText);
    assert.equal(body.sourceFileName, 'towers-of-hanoi-program.pas');
    assert.equal(body.inputQueue, 'vscode.pmachine');
    const { generatedAt: sentAt, ...sentMap } = body.programMap;
    const { generatedAt: compiledAt, ...compiledMap } = artifact.programMap;
    assert.ok(sentAt);
    assert.ok(compiledAt);
    assert.deepEqual(sentMap, compiledMap);
    assert.ok(output.includes('Move disk 1 from 1 to 3'));
    assert.ok(output.includes('Completed on magic-js-pmachine-01 (802 steps).'));
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(vscode.window)) delete vscode.window[key];
    Object.assign(vscode.window, originalWindow);
  }
});

test('editor installs hosted Pascalish services and their companion daemon on direct HTTP targets', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = { ...vscode.window };
  const output = [];
  const errors = [];
  const requests = [];
  globalThis.fetch = async url => {
    if (url === 'http://127.0.0.1:4000/api/pmachine/nodes') return Response.json([]);
    requests.push(String(url));
    if (String(url).endsWith('/pmachine/service_host/install')) {
      return Response.json({ running: true, udpPort: 4210, collectorId: 'pascalish-discovery-collector' });
    }
    assert.ok(String(url).endsWith('/ffs/upload'));
    return Response.json([]);
  };
  Object.assign(vscode.window, {
    activeTextEditor: { document: {
      uri: { fsPath: collectorProgram }, fileName: collectorProgram, languageId: 'pascalish', getText: () => collectorSource,
    } },
    createOutputChannel: () => ({
      clear() {}, appendLine: line => output.push(line), show() {}, dispose() {},
    }),
    showQuickPick: async targets => targets.find(target => target.host === '127.0.0.1:4111'),
    withProgress: async (_, task) => task(),
    showErrorMessage: message => errors.push(message),
  });
  try {
    activate({ subscriptions: [], extensionUri: {}, globalState: { get() {}, async update() {} } });
    await globalThis.pulseTestRunCommand();
    assert.deepEqual(errors, []);
    assert.equal(requests.length, 5);
    assert.deepEqual(requests.map(url => url.slice('http://127.0.0.1:4111'.length)), [
      '/ffs/upload', '/ffs/upload', '/ffs/upload', '/ffs/upload', '/pmachine/service_host/install',
    ]);
    assert.ok(output.includes('Hosted service installed at http://127.0.0.1:4111.'));
    assert.ok(output.includes('Hosted UDP port: 4210.'));
    assert.ok(output.some(line => line.includes('Service endpoint: http://127.0.0.1:4111/health')));
    const installBody = requests.at(-1);
    assert.ok(installBody.endsWith('/pmachine/service_host/install'));
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(vscode.window)) delete vscode.window[key];
    Object.assign(vscode.window, originalWindow);
  }
});

test('remote run uploads signed compiled pcode and executes on the selected JS host and port', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const result = { stdout: ['Towers of Hanoi'], globals: { diskCount: 5 }, stepCount: 802 };
  const programMap = { ...artifact.programMap };
  delete programMap.sourceMap;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return url.endsWith('/pmachine/execute_file') ? Response.json(result) : new Response('ok');
  };
  try {
    const payload = await runPcodeOnEsp32({
      pcodeText: artifact.pcodeText,
      programMap,
      node: '127.0.10.101:4101',
      inputQueue: 'vscode.pmachine',
      message: 'test message',
      sourceFileName: 'towers-of-hanoi-program.pas',
    });
    assert.deepEqual(payload.result, result);
    assert.equal(payload.host, '127.0.10.101:4101');
    assert.equal(payload.source, 'towers-of-hanoi-program.pas');
    assert.equal(payload.pcodeLines, artifact.pcodeText.split('\n').length);
    assert.deepEqual(requests.map(({ url }) => url), [
      'http://127.0.10.101:4101/ffs/upload',
      'http://127.0.10.101:4101/ffs/upload',
      'http://127.0.10.101:4101/pmachine/execute_file',
    ]);
    for (const { options } of requests) {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['content-type'], 'application/x-www-form-urlencoded');
    }
    const pcodeUpload = requests[0].options.body;
    const mapUpload = requests[1].options.body;
    assert.equal(pcodeUpload.get('body'), artifact.pcodeText);
    const signedMap = JSON.parse(mapUpload.get('body'));
    const { signing, ...uploadedMap } = signedMap;
    assert.deepEqual(uploadedMap, programMap);
    assert.equal(signing.signature, signPcodeText(artifact.pcodeText));
    assert.deepEqual(Object.fromEntries(requests[2].options.body), {
      file: pcodeUpload.get('file'),
      programMap: mapUpload.get('file'),
      runRouter: '0',
      inputQueue: 'vscode.pmachine',
      message: 'test message',
      max: '200000',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('remote run rejects missing pcode and invalid maps before contacting a node', async () => {
  await assert.rejects(runPcodeOnEsp32(), /pcodeText is required/);
  for (const programMap of [null, [], 'invalid']) {
    await assert.rejects(runPcodeOnEsp32({ pcodeText: artifact.pcodeText, programMap }), /programMap must be an object/);
  }
});

test('remote run surfaces upload and execution HTTP failures', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const failedRequest of [1, 2, 3]) {
      let requests = 0;
      globalThis.fetch = async () => {
        requests += 1;
        return requests === failedRequest
          ? new Response('node unavailable', { status: 503 })
          : new Response('ok');
      };
      const label = ['upload pcode', 'upload map', 'execute_file'][failedRequest - 1];
      await assert.rejects(
        runPcodeOnEsp32({ pcodeText: artifact.pcodeText, node: '127.0.10.101:4101' }),
        new RegExp(`${label} failed \\(503\\): node unavailable`),
      );
      assert.equal(requests, failedRequest);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function adapter(configuration = {}) {
  const value = globalThis.pulseTestFactory.createDebugAdapterDescriptor({
    configuration: { program, ...configuration },
  }).implementation;
  const events = [];
  value.onDidSendMessage(message => events.push(message));
  return { value, events };
}

async function wait(predicate, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(predicate(), 'debug operation timed out');
}

function validateMoves(stdout) {
  const pegs = { 1: [5, 4, 3, 2, 1], 2: [], 3: [] };
  const moves = stdout.filter(line => line.startsWith('Move disk'));
  assert.equal(moves.length, 31);
  for (const line of moves) {
    const [, disk, from, to] = line.match(/^Move disk (\d+) from (\d+) to (\d+)$/);
    assert.equal(pegs[from].pop(), Number(disk));
    assert.ok(!pegs[to].length || pegs[to].at(-1) > Number(disk), 'illegal Hanoi move');
    pegs[to].push(Number(disk));
  }
  assert.deepEqual(pegs[3], [5, 4, 3, 2, 1]);
}

test('Hanoi compilation and three JS executions preserve all 31 legal moves', async () => {
  const procedures = Object.values(artifact.programMap.procedures);
  assert.deepEqual(procedures[0].params, ['n', 'fromPeg', 'toPeg', 'auxPeg']);
  for (let index = 0; index < 3; index += 1) {
    const result = await executeProgram({
      instructions: parsePcode(artifact.pcodeText),
      opcodeMap: await loadOpcodeMap(),
      mappingsById: parseProgramMapMappings(artifact.programMap),
    });
    assert.equal(result.stepCount, 802);
    assert.equal(result.stepLimitHit, false);
    assert.equal(result.error, null);
    validateMoves(result.stdout);
  }
});

test('native DAP adapter debugs JS Hanoi entry, recursion, variables, step-out and completion', async () => {
  const { value, events } = adapter();
  try {
    await value.launch({ program });
    await value.stopAtProgramEntry();
    assert.equal(value.state.sourceLocation.sourceLine, 18);
    await value.setBreakpoints({ seq: 1, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [{ line: 8 }] });
    await value.resumeUntilPause('continue');
    assert.equal(value.state.sourceLocation.sourceLine, 8);
    assert.deepEqual(value.state.locals, { n: 5, fromPeg: 1, toPeg: 3, auxPeg: 2 });
    const depth = value.state.callStack.length;
    await value.stepToNextSource('step-in');
    assert.ok(value.state.callStack.length >= depth);
    await value.stepToNextSource('step-out');
    assert.ok(value.state.callStack.length < depth);
    await value.setBreakpoints({ seq: 2, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [] });
    await value.resumeUntilPause('continue');
    assert.equal(value.state.status, 'completed');
    validateMoves(value.state.result.stdout);
    assert.equal(events.filter(event => event.event === 'terminated').length, 1);
    assert.equal(events.filter(event => event.event === 'output' && event.body.output.startsWith('Move disk')).length, 31);
  } finally {
    value.dispose();
  }
});

test('JS source step-over executes a full call without entering recursive frames', async () => {
  const { value } = adapter();
  try {
    await value.launch({ program });
    await value.stopAtProgramEntry();
    await value.setBreakpoints({ seq: 1, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [{ line: 21 }] });
    await value.resumeUntilPause('continue');
    assert.equal(value.state.sourceLocation.sourceLine, 21);
    await value.stepToNextSource('step-over');
    assert.equal(value.state.callStack.length, 0);
    assert.equal(value.state.sourceLocation.sourceLine, 22);
    validateMoves(value.state.stdout);
  } finally {
    value.dispose();
  }
});

test('VS Code DAP requests resolve, replace and clear source breakpoints and expose recursive locals', async () => {
  const { value, events } = adapter();
  let seq = 0;
  async function request(command, args = {}) {
    const requestSeq = ++seq;
    value.handleMessage({ type: 'request', seq: requestSeq, command, arguments: args });
    await wait(() => events.some(message => message.type === 'response' && message.request_seq === requestSeq));
    const response = events.find(message => message.type === 'response' && message.request_seq === requestSeq);
    assert.equal(response.success, true, response.message);
    return response.body;
  }
  async function control(command) {
    const start = events.length;
    await request(command, { threadId: 1 });
    await wait(() => events.slice(start).some(message => ['stopped', 'terminated'].includes(message.event)));
  }
  try {
    await request('initialize');
    await request('launch', { program });
    await control('configurationDone');
    let frames = await request('stackTrace', { threadId: 1 });
    assert.equal(frames.stackFrames[0].line, 18);
    const relocated = await request('setBreakpoints', {
      source: { path: program }, breakpoints: [{ line: 10 }]
    });
    assert.deepEqual(relocated.breakpoints, [{ verified: true, line: 12 }]);
    await request('setBreakpoints', { source: { path: program }, breakpoints: [{ line: 8 }] });
    await control('continue');
    frames = await request('stackTrace', { threadId: 1 });
    assert.equal(frames.stackFrames[0].line, 8);
    const scopes = await request('scopes', { frameId: frames.stackFrames[0].id });
    const localsScope = scopes.scopes.find(scope => scope.name === 'Locals');
    const locals = await request('variables', { variablesReference: localsScope.variablesReference });
    assert.deepEqual(Object.fromEntries(locals.variables.map(item => [item.name, JSON.parse(item.value)])), {
      n: 5, fromPeg: 1, toPeg: 3, auxPeg: 2
    });
    assert.equal((await request('evaluate', { expression: 'n' })).result, '5');
    await control('stepIn');
    await control('stepOut');
    assert.equal(value.state.callStack.length, 0);
    const unresolved = await request('setBreakpoints', {
      source: { path: program }, breakpoints: [{ line: 999 }]
    });
    assert.equal(unresolved.breakpoints[0].verified, false);
    await request('setBreakpoints', { source: { path: program }, breakpoints: [] });
    assert.deepEqual(value.state.breakpoints, []);
    await control('continue');
    validateMoves(value.state.result.stdout);
    assert.equal(events.filter(message => message.event === 'terminated').length, 1);
  } finally {
    value.dispose();
  }
});

test('bridge uploads signed map and transports dynamic breakpoint PCs', async () => {
  const savedFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    return Response.json({ sessionId: 'test-session', status: 'paused', pc: 0 });
  };
  try {
    const session = await startEsp32DebugSession({ host: '192.168.2.115', pcode: artifact.pcodeText, programMap: artifact.programMap });
    assert.equal(calls.length, 3);
    const map = JSON.parse(calls[1].init.body.get('body'));
    assert.ok(map.signing.signature);
    assert.equal(map.sourceMap, undefined);
    assert.equal(calls[2].url.searchParams.get('programMap'), session.programMapFile);
    await controlEsp32DebugSession({ host: session.host, sessionId: session.sessionId, action: 'breakpoint-set', pc: 12 });
    assert.equal(calls[3].url.pathname, '/pmachine/debug/session/breakpoint/set');
    assert.equal(calls[3].url.searchParams.get('pc'), '12');
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('remote DAP breakpoint edits preserve action and PC through backend API', async () => {
  const { value } = adapter({ runtime: 'esp32' });
  const savedFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return Response.json({ state: { status: 'paused' } });
  };
  try {
    await value.launch({ program, runtime: 'esp32' });
    value.debugApiUrl = 'http://127.0.0.1:4000';
    value.debugApiHost = '192.168.2.115';
    value.remoteSessionId = value.sessionId = 'test-session';
    await value.setBreakpoints({ seq: 1, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [{ line: 8 }] });
    assert.equal(calls[0].url, 'http://127.0.0.1:4000/api/pmachine/debug/esp32/session/breakpoint-set');
    assert.equal(calls[0].body.pc, value.remoteBreakpointAddresses()[0]);
    await value.setBreakpoints({ seq: 2, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [] });
    assert.ok(calls[1].url.endsWith('/breakpoint-clear'));
    assert.equal(calls[1].body.pc, calls[0].body.pc);
  } finally {
    value.remoteSessionId = '';
    value.sessionId = '';
    value.dispose();
    globalThis.fetch = savedFetch;
  }
});

test('remote source stepping respects depth and emits exactly one stop', async () => {
  for (const mode of ['step-in', 'step-over', 'step-out']) {
    const { value, events } = adapter();
    value.state = { pc: 0, callDepth: 1, sourceLocation: { sourceLine: 12 } };
    const states = [
      { callDepth: 1, sourceLocation: { sourceLine: 12 } },
      { callDepth: 2, sourceLocation: { sourceLine: 8 } },
      { callDepth: 1, sourceLocation: { sourceLine: 13 } },
      { callDepth: 0, sourceLocation: { sourceLine: 22 } },
    ];
    value.advanceEsp32Instruction = async () => { value.state = states.shift(); };
    value.remoteRequest = async () => ({});
    value.waitForEsp32Stop = async () => { value.state = states.at(-1); };
    await value.stepEsp32(mode);
    assert.equal(value.state.callDepth, mode === 'step-in' ? 2 : mode === 'step-over' ? 1 : 0);
    assert.equal(events.filter(event => event.event === 'stopped').length, 1);
    value.dispose();
  }
});

test('DAP async failure does not send a second response for an acknowledged request', async () => {
  const { value, events } = adapter();
  value.remoteEsp32 = true;
  value.continueEsp32 = async () => { throw new Error('device unavailable'); };
  value.handleMessage({ type: 'request', seq: 20, command: 'continue' });
  await wait(() => events.some(event => event.event === 'output'));
  assert.equal(events.filter(event => event.type === 'response' && event.request_seq === 20).length, 1);
  assert.match(events.find(event => event.event === 'output').body.output, /device unavailable/);
  value.dispose();
});

// PMACHINE_TEST_HOST=192.168.2.155 (ESP32) or 127.0.0.1:4111 (JS node).
// Set PMACHINE_TEST_DEBUG_API to drive the session through the backend instead of the in-process bridge.
test('live remote PMachine Hanoi debugger', {
  skip: !process.env.PMACHINE_TEST_HOST,
  timeout: 180000,
}, async () => {
  const runtime = process.env.PMACHINE_TEST_RUNTIME || (process.env.PMACHINE_TEST_HOST.includes(':') ? 'js-node' : 'esp32');
  const { value, events } = adapter({
    runtime,
    debugSession: true,
    targetHost: process.env.PMACHINE_TEST_HOST,
    ...(process.env.PMACHINE_TEST_DEBUG_API ? { debugApiUrl: process.env.PMACHINE_TEST_DEBUG_API } : {}),
  });
  let failed = false;
  try {
    await value.launch({ program, runtime });
    assert.equal(events.find(event => event.event === 'pulseLaunch')?.body.isHanoi, true);
    await value.stopAtProgramEntry();
    assert.equal(value.state.status, 'paused');
    assert.equal(value.state.sourceLocation.sourceLine, 18);
    await value.setBreakpoints({ seq: 1, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [{ line: 8 }] });
    await value.continueEsp32();
    assert.deepEqual(value.state.locals, { n: 5, fromPeg: 1, toPeg: 3, auxPeg: 2 });
    await value.setBreakpoints({ seq: 2, command: 'setBreakpoints' }, { source: { path: program }, breakpoints: [] });
    await value.stepEsp32('step-in');
    assert.equal(value.state.sourceLocation.sourceLine, 12);
    await value.stepEsp32('step-in');
    assert.equal(value.state.callDepth, 2);
    assert.deepEqual(value.state.locals, { n: 4, fromPeg: 1, toPeg: 2, auxPeg: 3 });
    await value.stepEsp32('step-over');
    assert.equal(value.state.callDepth, 2);
    await value.stepEsp32('step-out');
    assert.equal(value.state.callDepth, 1);
    await value.continueEsp32();
    assert.equal(value.state.status, 'stopped');
    validateMoves(value.state.stdout);
    assert.equal(events.filter(event => event.event === 'terminated').length, 1);
    assert.equal(events.filter(event => event.event === 'output' && event.body.output.startsWith('Move disk')).length, 31);
    assert.equal(events.filter(event => event.event === 'pulseOutput' && event.body.line.startsWith('Move disk')).length, 31);
    assert.ok(events.some(event => event.event === 'pulseState' && event.body.locals?.n === 4));
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (value.remoteSessionId) {
      try {
        await value.remoteRequest(`/pmachine/debug/session?id=${encodeURIComponent(value.remoteSessionId)}`, { method: 'DELETE' });
      } catch (error) {
        if (!failed) throw error;
        console.error(`Live test session cleanup also failed: ${error.message}`);
      }
      value.remoteSessionId = value.sessionId = '';
    }
    value.dispose();
  }
});

test('live remote PMachine Hanoi animation runs to completion', {
  skip: !process.env.PMACHINE_TEST_HOST,
  timeout: 600000,
}, async () => {
  const runtime = process.env.PMACHINE_TEST_RUNTIME || (process.env.PMACHINE_TEST_HOST.includes(':') ? 'js-node' : 'esp32');
  const { value, events } = adapter({ runtime, animate: true, animationDelayMs: 50, targetHost: process.env.PMACHINE_TEST_HOST });
  try {
    value.handleMessage({ type: 'request', seq: 1, command: 'launch', arguments: { program, runtime, animate: true, animationDelayMs: 50, targetHost: process.env.PMACHINE_TEST_HOST } });
    value.handleMessage({ type: 'request', seq: 2, command: 'configurationDone' });
    await wait(() => events.some(event => event.event === 'terminated'), 580000);
    assert.equal(events.filter(event => event.event === 'terminated').length, 1);
    assert.equal(events.filter(event => event.event === 'pulseOutput' && event.body.line.startsWith('Move disk')).length, 31);
    const lines = new Set(events.filter(event => event.event === 'pulseState').map(event => event.body.line));
    assert.ok(lines.has(8) && lines.has(18), `animation visited source lines ${[...lines]}`);
  } finally {
    value.dispose();
  }
});