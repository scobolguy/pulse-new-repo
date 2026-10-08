import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const { readDistributedNetwork } = require('../../tools/catalog-studio-vscode/distributedNetwork.js')
const base = 'http://127.0.0.1:4310'
const device = (key, confidence = 'PROVISIONAL') => ({
  key, device: { name: key, address: '192.168.2.28', protocol: 'kasa', deviceType: 'wallSwitch' }, confidence,
})
const page = (records, total = records.length, nextCursor = '', revision = '1', completeness = true) =>
  ({ records, total, nextCursor, revision, completeness })

test('reads all fenced pages and keeps provisional, conflicting and corroborated records', async () => {
  const urls = []
  const result = await readDistributedNetwork(base, async url => {
    urls.push(new URL(url))
    return urls.length === 1 ? page([device('a'), device('b', 'CONFLICTING')], 3, 'b', '5', false)
      : page([device('c', 'CORROBORATED')], 3, '', '5', false)
  })
  assert.equal(result.records.length, 3)
  assert.equal(result.completeness, false)
  assert.equal(urls[0].pathname, '/api/devices')
  assert.equal(urls[1].searchParams.get('cursor'), 'b')
  assert.equal(urls[1].searchParams.get('revision'), '5')
})

test('restarts a changed revision without leaking records from the old snapshot', async () => {
  let calls = 0
  const result = await readDistributedNetwork(base, async () => {
    calls++
    if (calls === 1) return page([device('old')], 2, 'old')
    if (calls === 2) throw new Error('HTTP 503: Aggregation revision changed; restart pagination')
    return page([device('new')], 1, '', '2')
  })
  assert.deepEqual(result.records.map(record => record.key), ['new'])
  assert.equal(calls, 3)
})

test('fails explicitly on malformed, truncated, duplicate and looping pages', async () => {
  for (const invalid of [
    {},
    page([device('a')], 2),
    page([device('a'), device('a')]),
    page([{ key: 'a', device: { name: 'a' } }]),
    page([], 151),
  ]) await assert.rejects(readDistributedNetwork(base, async () => invalid))
  await assert.rejects(readDistributedNetwork(base, async () => page([device('a')], 2, 'a')), /duplicate|advance/)
})

test('revision retry attempts are bounded and empty cache is valid', async () => {
  let calls = 0
  await assert.rejects(readDistributedNetwork(base, async () => {
    calls++; throw new Error('Aggregation cursor expired')
  }), /cursor expired/)
  assert.equal(calls, 3)
  assert.deepEqual(await readDistributedNetwork(base, async () => page([])), { records: [], completeness: true })
  await assert.rejects(readDistributedNetwork('file:///cache', async () => page([])), /HTTP/)
})

async function loadView(requestPayload) {
  const file = new URL('../../tools/catalog-studio-vscode/extension.js', import.meta.url)
  const source = await fs.readFile(file, 'utf8')
  const vscode = {
    TreeItem: class { constructor(label, collapsibleState) { this.label = label; this.collapsibleState = collapsibleState } },
    TreeItemCollapsibleState: { None: 0, Expanded: 2 },
    ThemeIcon: class { constructor(id) { this.id = id } },
    EventEmitter: class {
      constructor() { this.fireCount = 0; this.event = () => {} }
      fire() { this.fireCount++ }
      dispose() { this.disposed = true }
    },
    Uri: { joinPath: (_base, ...parts) => parts.join('/') },
    window: { showErrorMessage() {} },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: path.resolve(fileURLToPath(new URL('../..', import.meta.url))) } }],
      getConfiguration: () => ({ get: (_key, fallback) => fallback }),
    },
  }
  const context = vm.createContext({
    require: name => name === 'vscode' ? vscode : name === './distributedNetwork'
      ? { readDistributedNetwork } : require(name),
    module: { exports: {} }, URL, URLSearchParams, Buffer,
  })
  vm.runInContext(`${source}\nmodule.exports.test = { activate, CatalogStudioTreeProvider, PulseInfrastructureTreeProvider, getDistributedNetworkItems, getMessageBrokerItems, getLibrarianDataTypes, registerDataTypeMessages, getCatalogStudioHostHtml, vscode };`, context)
  context.requestPayload = requestPayload
  vm.runInContext('requestJson = async (...args) => { if (requestPayload && requestPayload.name === "Error") throw requestPayload; if (typeof requestPayload === "function") return requestPayload(...args); return requestPayload; };', context)
  return context.module.exports.test
}

test('left-hand Pulse Studio tree shows Data Mapper beside Data Librarian and lists its data types', async () => {
  const view = await loadView({ types: [
    { id: 'pacs.008', label: 'PACS.008', isIso: true },
    { id: 'device-descriptor', label: 'Device Descriptor', isIso: false },
  ] })
  const provider = new view.CatalogStudioTreeProvider()
  const roots = await provider.getChildren()
  assert.equal(roots.length, 2)
  assert.equal(roots[0].label, 'Data Librarian')
  assert.equal(roots[0].collapsibleState, 2)
  assert.equal(roots[1].label, 'Data Mapper')
  assert.equal(roots[1].collapsibleState, 0)
  assert.equal(roots[1].command.command, 'pulseCatalogStudio.openDataMapper')
  assert.equal(provider.getTreeItem(roots[0]), roots[0])
  const children = await provider.getChildren(roots[0])
  assert.deepEqual(Array.from(children, item => item.label), ['PACS.008', 'Device Descriptor'])
  assert.deepEqual(Array.from(children, item => item.id), ['data-type:pacs.008', 'data-type:device-descriptor'])
  assert.equal(children[0].description, 'pacs.008 (ISO)')
  assert.equal(children[1].description, 'device-descriptor')
  assert.equal(children[0].collapsibleState, 0)
  assert.equal((await provider.getChildren(children[0])).length, 0)
  assert.equal((await provider.getChildren(roots[1])).length, 0)
  provider.refresh()
  assert.equal(provider._onDidChangeTreeData.fireCount, 1)
  provider.dispose()
  assert.equal(provider._onDidChangeTreeData.disposed, true)
})

test('left-hand Data Librarian tree shows empty, unavailable and malformed registries explicitly', async () => {
  for (const [payload, label, detail] of [
    [{ types: [] }, 'No data types registered'],
    [new Error('Librarian offline'), 'Data Librarian unavailable', /Librarian offline/],
    [{ types: [{ label: 'Missing ID' }] }, 'Data Librarian unavailable', /invalid data type/],
  ]) {
    const view = await loadView(payload)
    const provider = new view.CatalogStudioTreeProvider()
    const [root] = await provider.getChildren()
    const children = await provider.getChildren(root)
    assert.equal(children.length, 1)
    assert.equal(children[0].label, label)
    if (detail) assert.match(children[0].tooltip, detail)
  }
})

test('Pulse Studio sidebar contribution and activation both register a tree with a refresh command', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../../tools/catalog-studio-vscode/package.json', import.meta.url), 'utf8'))
  const sidebar = manifest.contributes.views.pulseCatalogStudio.find(view => view.id === 'pulseCatalogStudio.sidebar')
  assert.equal(sidebar.type, 'tree')
  assert.ok(manifest.contributes.commands.some(command => command.command === 'pulseCatalogStudio.refreshDataLibrarian'))
  assert.ok(manifest.contributes.menus['view/title'].some(menu =>
    menu.command === 'pulseCatalogStudio.refreshDataLibrarian' && menu.when === 'view == pulseCatalogStudio.sidebar'))

  const view = await loadView({ types: [] })
  const registrations = new Map()
  const commands = new Map()
  view.vscode.languages = { createDiagnosticCollection: () => ({ dispose() {} }) }
  view.vscode.window.registerTreeDataProvider = (id, provider) => {
    registrations.set(id, provider)
    return { dispose() {} }
  }
  view.vscode.window.registerCustomTextEditorProvider = () => ({ dispose() {} })
  view.vscode.commands = { registerCommand: (id, handler) => {
    commands.set(id, handler)
    return { dispose() {} }
  } }
  const context = { extensionUri: '/extension', subscriptions: [] }
  view.activate(context)
  const provider = registrations.get(sidebar.id)
  assert.ok(provider instanceof view.CatalogStudioTreeProvider)
  assert.ok(registrations.has('pulseCatalogStudio.infrastructure'))
  assert.ok(context.subscriptions.includes(provider))
  commands.get('pulseCatalogStudio.refreshDataLibrarian')()
  assert.equal(provider._onDidChangeTreeData.fireCount, 1)
})

test('Pulse Studio webviews use VS Code-only routes without browser links', async () => {
  const view = await loadView({ types: [] })
  const webview = {
    cspSource: 'vscode-resource:',
    asWebviewUri: value => value,
  }
  const flowDesignerHtml = view.getCatalogStudioHostHtml(webview, 'extension')
  const dataMapperHtml = view.getCatalogStudioHostHtml(webview, 'extension', 'data-mapper?host=vscode')

  assert.match(flowDesignerHtml, /src="http:\/\/localhost:5173\/flow-designer\?host=vscode"/)
  assert.match(dataMapperHtml, /src="http:\/\/localhost:5173\/data-mapper\?host=vscode"/)
  assert.doesNotMatch(flowDesignerHtml, /Open in Browser|Open Pulse Studio/)
  assert.doesNotMatch(dataMapperHtml, /Open in Browser|Open Pulse Studio/)
})

test('Pulse Studio loads all Librarian data types through the configured API with a direct-service fallback', async () => {
  const urls = []
  const view = await loadView(async url => {
    urls.push(url)
    if (urls.length === 1) throw new Error('Aggregator unavailable')
    return { types: [
      { id: 'pacs.008', label: 'PACS.008', isIso: true },
      { id: 'device-descriptor', label: 'Device Descriptor', isIso: false },
    ] }
  })
  const types = await view.getLibrarianDataTypes()
  assert.deepEqual(urls, [
    'http://127.0.0.1:4000/api/librarian/data-types',
    'http://127.0.0.1:4300/api/librarian/data-types',
  ])
  assert.deepEqual(JSON.parse(JSON.stringify(types)), [
    { id: 'pacs.008', label: 'PACS.008', isIso: true },
    { id: 'device-descriptor', label: 'Device Descriptor', isIso: false },
  ])
})

test('Pulse Studio displays Librarian loading failures and rejects malformed records', async () => {
  const failedView = await loadView(new Error('Librarian offline'))
  await assert.rejects(failedView.getLibrarianDataTypes(), /Data Librarian types are unavailable.*Librarian offline/)
  let receiveMessage
  const responses = []
  failedView.registerDataTypeMessages({
    onDidReceiveMessage: handler => { receiveMessage = handler },
    postMessage: message => { responses.push(message) },
  })
  await receiveMessage({ type: 'loadDataTypes', requestId: 8 })
  assert.equal(responses[0].type, 'dataTypesFailed')
  assert.equal(responses[0].requestId, 8)
  assert.match(responses[0].message, /Librarian offline/)

  const malformedView = await loadView({ types: [{ label: 'Missing ID' }] })
  await assert.rejects(malformedView.getLibrarianDataTypes(), /invalid data type at index 0/)
})

test('Pulse Studio webview messages return loaded data types with their request ID', async () => {
  const view = await loadView({ types: [{ id: 'example', label: 'Example', isIso: false }] })
  let receiveMessage
  const responses = []
  view.registerDataTypeMessages({
    onDidReceiveMessage: handler => { receiveMessage = handler },
    postMessage: message => { responses.push(message) },
  })
  await receiveMessage({ type: 'loadDataTypes', requestId: 7 })
  assert.deepEqual(JSON.parse(JSON.stringify(responses[0])), {
    type: 'dataTypesLoaded',
    requestId: 7,
    types: [{ id: 'example', label: 'Example', isIso: false }],
  })
})

test('Pulse Studio renders the Librarian data type list beneath its heading', async () => {
  const view = await loadView({})
  const html = view.getCatalogStudioHostHtml({
    asWebviewUri: uri => uri,
    cspSource: 'vscode-resource:',
  }, '/extension')
  assert.ok(html.indexOf('class="brand-title">Pulse Studio') < html.indexOf('Data Librarian Types'))
  assert.match(html, /id="refreshTypes"/)
  assert.match(html, /id="typesList"/)
  assert.match(html, /aria-live="polite"/)
})

test('infrastructure keeps Network and adds cache sibling with names and IPs regardless of confidence', async () => {
  const view = await loadView(page([device('Bedroom'), device('Den', 'CONFLICTING')], 2, '', '1', false))
  const provider = new view.PulseInfrastructureTreeProvider()
  const roots = provider.getChildren()
  assert.ok(roots.some(item => item.label === 'Network' && item.kind === 'network-category'))
  const cache = roots.find(item => item.label === 'Network (Distributed Cache)')
  const children = await provider.getChildren(cache)
  assert.deepEqual(Array.from(children, item => item.label), ['Bedroom', 'Den', 'Cache source coverage is incomplete'])
  assert.equal(children[0].description, '192.168.2.28')
})

test('cache errors and empty state are visible instead of a discovery fallback', async () => {
  const empty = await loadView(page([]))
  assert.equal((await empty.getDistributedNetworkItems())[0].label, 'No cached network devices')
  const failure = await loadView({ error: 'Cache unavailable' })
  const children = await failure.getDistributedNetworkItems()
  assert.equal(children[0].label, 'Distributed cache not reachable')
  assert.match(children[0].tooltip, /Cache unavailable/)
})

test('message brokers appear only under Message Brokers while runtime services stay in Services', async () => {
  const msmq = { id: 'catalog:msmq', name: 'MSMQ', kind: 'messaging', provider: 'msmq' }
  const rabbit = { id: 'catalog:rabbit', name: 'RabbitMQ', provider: 'rabbitmq' }
  const view = await loadView({
    services: [msmq, rabbit, { id: 'runtime:broker', name: 'broker', provider: 'runtime' },
      { id: 'runtime:collector', name: 'collector', kind: 'daemon' }],
    servers: [msmq, rabbit], errors: [],
  })
  const provider = new view.PulseInfrastructureTreeProvider()
  const services = await provider.getChildren({ kind: 'services-category' })
  assert.deepEqual(Array.from(services, item => item.label), ['broker', 'collector'])
  const brokers = await provider.getChildren({ kind: 'message-brokers-category' })
  assert.deepEqual(Array.from(brokers, item => item.label), ['MSMQ', 'RabbitMQ'])
})

test('configured message brokers remain visible when the live services directory is empty', async () => {
  const view = await loadView({ services: [], servers: [], errors: [] })
  const brokers = await view.getMessageBrokerItems()
  assert.deepEqual(Array.from(brokers, item => item.label), ['MSMQ Broker', 'RabbitMQ Broker'])
})

test('Services lists each same-named instance separately with stable identities', async () => {
  const records = [
    { id: 'cache:kasa', instanceId: 'kasa-js', name: 'device-cache', nodeId: 'js-node', endpoint: 'http://127.0.0.1:4309/' },
    { id: 'cache:tuya', instanceId: 'tuya-js', name: 'device-cache', nodeId: 'js-node', endpoint: 'http://127.0.0.1:4307/' },
    { id: 'cache:ssdp', instanceId: 'ssdp-js', name: 'device-cache', nodeId: 'js-node', endpoint: 'http://127.0.0.1:4308/' },
    { id: 'worker', name: 'worker' },
  ]
  const view = await loadView({ services: records, errors: [] })
  const provider = new view.PulseInfrastructureTreeProvider()
  const children = await provider.getChildren({ kind: 'services-category' })
  assert.deepEqual(Array.from(children, item => item.label), [
    'device-cache (kasa-js)', 'device-cache (tuya-js)', 'device-cache (ssdp-js)', 'worker',
  ])
  assert.equal(new Set(children.map(item => item.id)).size, records.length)
  for (let index = 0; index < 3; index++) {
    assert.ok(children[index].description.includes(records[index].instanceId))
    assert.ok(children[index].tooltip.includes(records[index].endpoint))
  }
  const reordered = await loadView({ services: [...records].reverse(), errors: [] })
  const reversed = await new reordered.PulseInfrastructureTreeProvider().getChildren({ kind: 'services-category' })
  assert.deepEqual(Array.from(reversed, item => item.id), Array.from(children, item => item.id).reverse())
})

test('same-named services without instance IDs are distinguished by endpoint', async () => {
  const view = await loadView({ services: [
    { id: 'cache:1', name: 'device-cache', endpoint: 'http://127.0.0.1:4307/' },
    { id: 'cache:2', name: 'device-cache', endpoint: 'http://127.0.0.1:4308/' },
  ], errors: [] })
  const children = await new view.PulseInfrastructureTreeProvider().getChildren({ kind: 'services-category' })
  assert.deepEqual(Array.from(children, item => item.label), [
    'device-cache (http://127.0.0.1:4307/)', 'device-cache (http://127.0.0.1:4308/)',
  ])
})

test('configured message brokers remain visible when the live services directory is unavailable', async () => {
  const view = await loadView(new Error('API unavailable'))
  const brokers = await view.getMessageBrokerItems()
  assert.deepEqual(Array.from(brokers, item => item.label), [
    'MSMQ Broker',
    'RabbitMQ Broker',
    'Live broker status unavailable - showing configured brokers',
  ])
})

test('database servers appear under Servers / Data Bases, not Services', async () => {
  const view = await loadView({
    services: [
      { id: 'catalog:db', name: 'Catalog Database', kind: 'database', provider: 'mssql' },
      { id: 'runtime:db', name: 'Runtime Database', provider: 'postgresql' },
      { id: 'runtime:worker', name: 'Worker', kind: 'daemon' },
    ],
    servers: [
      { id: 'catalog:db', name: 'Catalog Database', kind: 'database', provider: 'mssql' },
      { id: 'runtime:db', name: 'Runtime Database', kind: 'database', provider: 'postgresql' },
    ],
    errors: [],
  })
  const provider = new view.PulseInfrastructureTreeProvider()
  const serverCategories = await provider.getChildren({ kind: 'servers-category' })
  const databasesCategory = serverCategories.find(item => item.label === 'Data Bases')
  assert.ok(databasesCategory)
  const databases = await provider.getChildren(databasesCategory)
  assert.deepEqual(Array.from(databases, item => item.label), ['Access Database', 'Catalog Database', 'Runtime Database'])
  const services = await provider.getChildren({ kind: 'services-category' })
  assert.deepEqual(Array.from(services, item => item.label), ['Worker'])
})
