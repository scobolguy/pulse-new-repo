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
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon: class { constructor(id) { this.id = id } },
    EventEmitter: class {
      constructor() { this.fireCount = 0; this.event = () => {} }
      fire() { this.fireCount++ }
      dispose() { this.disposed = true }
    },
    Uri: { joinPath: (_base, ...parts) => parts.join('/') },
    window: {
      showErrorMessage() {},
      async showInformationMessage() {},
      async showWarningMessage() {},
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: path.resolve(fileURLToPath(new URL('../..', import.meta.url))) } }],
      getConfiguration: () => ({ get: (_key, fallback) => fallback }),
      asRelativePath: uri => uri.fsPath,
      async findFiles() { return [] },
    },
  }
  const context = vm.createContext({
    require: name => name === 'vscode' ? vscode : name === './distributedNetwork'
      ? { readDistributedNetwork } : require(name),
    module: { exports: {} }, URL, URLSearchParams, Buffer,
  })
  vm.runInContext(`${source}\nmodule.exports.test = { activate, CatalogStudioTreeProvider, DataMapperViewProvider, PulseInfrastructureTreeProvider, WflDeployViewProvider, NodeInventoryTreeProvider, validateWflDeployment, previewWflDeployment, explainWflDeploymentUnavailable, getDistributedNetworkItems, getNetworkItems, getMessageBrokerItems, getLibrarianDataTypes, registerDataTypeMessages, getCatalogStudioHostHtml, vscode };`, context)
  context.requestPayload = requestPayload
  vm.runInContext('requestJson = async (...args) => { if (requestPayload && requestPayload.name === "Error") throw requestPayload; if (typeof requestPayload === "function") return requestPayload(...args); return requestPayload; };', context)
  return context.module.exports.test
}

test('Data Librarian lists its data types immediately without a wrapper node or command', async () => {
  const view = await loadView({ types: [
    { id: 'pacs.008', label: 'PACS.008', isIso: true },
    { id: 'device-descriptor', label: 'Device Descriptor', isIso: false },
  ] })
  const provider = new view.CatalogStudioTreeProvider()
  const children = await provider.getChildren()
  assert.equal(provider.getTreeItem(children[0]), children[0])
  assert.deepEqual(Array.from(children, item => item.label), ['PACS.008', 'Device Descriptor'])
  assert.deepEqual(Array.from(children, item => item.id), ['data-type:pacs.008', 'data-type:device-descriptor'])
  assert.equal(children[0].description, 'pacs.008 (ISO)')
  assert.equal(children[1].description, 'device-descriptor')
  assert.equal(children[0].collapsibleState, 0)
  assert.equal((await provider.getChildren(children[0])).length, 0)
  assert.ok(children.every(item => !item.command))
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
    const children = await provider.getChildren()
    assert.equal(children.length, 1)
    assert.equal(children[0].label, label)
    if (detail) assert.match(children[0].tooltip, detail)
  }
})

test('Pulse Studio activates at startup with visible native librarian and mapper views', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../../tools/catalog-studio-vscode/package.json', import.meta.url), 'utf8'))
  const sidebar = manifest.contributes.views.pulseCatalogStudio.find(view => view.id === 'pulseCatalogStudio.sidebar')
  assert.equal(sidebar.type, 'tree')
  assert.equal(sidebar.name, 'Data Librarian')
  assert.equal(sidebar.visibility, 'visible')
  assert.ok(manifest.activationEvents.includes('onStartupFinished'))
  const mapper = manifest.contributes.views.pulseCatalogStudio.find(view => view.id === 'pulseCatalogStudio.dataMapper')
  assert.equal(mapper.type, 'tree')
  assert.equal(mapper.visibility, 'visible')
  for (const id of ['pulseCatalogStudio.deploy', 'pulseCatalogStudio.nodeInventory']) {
    const view = manifest.contributes.views.pulseCatalogStudio.find(item => item.id === id)
    assert.equal(view.type, 'tree')
    assert.equal(view.visibility, 'visible')
  }
  assert.ok(manifest.contributes.commands.some(command => command.command === 'pulseCatalogStudio.refreshDataLibrarian'))
  assert.equal(manifest.contributes.commands.filter(command => command.command === 'pulseCatalogStudio.refreshDataMapper').length, 1)
  assert.ok(manifest.contributes.menus['view/title'].some(menu =>
    menu.command === 'pulseCatalogStudio.refreshDataLibrarian' && menu.when === 'view == pulseCatalogStudio.sidebar'))
  assert.ok(manifest.contributes.menus['view/item/context'].some(menu =>
    menu.command === 'pulseCatalogStudio.stopHostedContext' && menu.when.includes('inventory-hosted-context')))

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
  assert.ok(registrations.has('pulseCatalogStudio.deploy'))
  assert.ok(registrations.has('pulseCatalogStudio.nodeInventory'))
  assert.ok(context.subscriptions.includes(provider))
  const mapperProvider = registrations.get(mapper.id)
  assert.ok(mapperProvider instanceof view.DataMapperViewProvider)
  commands.get('pulseCatalogStudio.refreshDataMapper')()
  assert.equal(mapperProvider._onDidChangeTreeData.fireCount, 1)
  commands.get('pulseCatalogStudio.refreshDataLibrarian')()
  assert.equal(provider._onDidChangeTreeData.fireCount, 1)
})

test('native mapper automatically loads maps and expanded field connections from port 4200', async () => {
  const urls = []
  const view = await loadView(async url => {
    urls.push(url)
    return url.endsWith('/maps') ? { maps: [{ id: 'example map', name: 'Example Map', fileName: 'example-map.map' }] }
      : { map: { sourceSchemaPath: 'source.json', targetSchemaPath: 'target.json',
        rules: [{ sourcePath: 'amount', targetPath: 'payment.amount', conversionRule: 'output := src;' }] } }
  })
  const provider = new view.DataMapperViewProvider()
  const roots = await provider.getChildren()
  assert.equal(roots[0].label, 'Example Map')
  assert.equal(roots[0].collapsibleState, 2)
  assert.equal(roots[0].command.command, 'pulseCatalogStudio.openMapFile')
  assert.deepEqual(Array.from(roots[0].command.arguments), ['example-map.map'])
  const children = await provider.getChildren(roots[0])
  assert.deepEqual(Array.from(children, item => item.label), [
    'Source: source.json', 'Target: target.json', 'amount -> payment.amount',
  ])
  assert.match(children[2].tooltip, /output := src;/)
  assert.equal((await provider.getChildren(children[2])).length, 0)
  assert.deepEqual(urls, [
    'http://127.0.0.1:4200/api/mapper/maps',
    'http://127.0.0.1:4200/api/mapper/maps/example%20map',
  ])
})

test('left-click command opens the matching local map file in the Data Mapper editor', async () => {
  const view = await loadView({ maps: [{ id: 'example-map', name: 'Example Map', fileName: 'example-map.map' }] })
  const commands = new Map()
  const opened = []
  view.vscode.workspace.fs = { stat: async uri => ({ uri }) }
  view.vscode.Uri.joinPath = (base, ...parts) => ({ fsPath: path.join(base.fsPath, ...parts) })
  view.vscode.commands = { registerCommand: (id, handler) => {
    commands.set(id, handler)
    return { dispose() {} }
  }, executeCommand: async (...args) => { opened.push(args) } }
  view.vscode.languages = { createDiagnosticCollection: () => ({ dispose() {} }) }
  view.vscode.window.registerTreeDataProvider = () => ({ dispose() {} })
  view.vscode.window.registerCustomTextEditorProvider = () => ({ dispose() {} })
  view.vscode.window.showErrorMessage = message => { throw new Error(message) }
  view.activate({ extensionUri: '/extension', subscriptions: [] })
  const provider = new view.DataMapperViewProvider()
  const [map] = await provider.getChildren()
  await commands.get(map.command.command)(...map.command.arguments)
  assert.deepEqual(opened[0], [
    'vscode.openWith',
    { fsPath: path.join(path.resolve(fileURLToPath(new URL('../..', import.meta.url))),
      'aggregator', 'data', 'data-maps', 'example-map.map') },
    'pulse-pmachine.dataMapper',
  ])
})

test('native mapper displays empty, offline and malformed responses explicitly', async () => {
  for (const [payload, label] of [
    [{ maps: [] }, 'No maps registered'],
    [new Error('Mapper offline'), 'Data Mapper unavailable'],
    [{ maps: [{}] }, 'Data Mapper unavailable'],
    [{}, 'Data Mapper unavailable'],
  ]) {
    const view = await loadView(payload)
    const rows = await new view.DataMapperViewProvider().getChildren()
    assert.equal(rows[0].label, label)
  }
  for (const map of [{}, { rules: [{}] }]) {
    const view = await loadView({ map })
    const rows = await new view.DataMapperViewProvider().getChildren({ kind: 'data-map', mapId: 'bad' })
    assert.equal(rows[0].label, 'Data Mapper unavailable')
  }
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

test('Network discovery fallback never probes the Data Librarian port', async () => {
  const urls = []
  const view = await loadView(async url => {
    urls.push(url)
    throw new Error('Aggregator unavailable')
  })
  const rows = await view.getNetworkItems()
  assert.equal(rows[0].label, 'Network discovery not reachable')
  assert.deepEqual(urls, ['http://127.0.0.1:4000/api/nodes'])
  assert.doesNotMatch(rows[0].description, /:4300/)
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

test('Deploy view lists workspace WFL documents and opens them on selection', async () => {
  const view = await loadView({})
  const uri = { fsPath: 'C:\\workspace\\deployment.wfl' }
  view.vscode.workspace.findFiles = async () => [uri]
  view.vscode.workspace.asRelativePath = () => 'deployments/deployment.wfl'
  const rows = await new view.WflDeployViewProvider().getChildren()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].label, 'deployment.wfl')
  assert.equal(rows[0].contextValue, 'wfl-deployment')
  assert.equal(rows[0].resourceUri, uri)
  assert.equal(rows[0].command.command, 'vscode.open')
  assert.equal(rows[0].description, 'deployments/deployment.wfl')
})

test('Node Inventory keeps named registrations distinct from observed hosted contexts and aggregates', async () => {
  const view = await loadView(async url => {
    if (url.endsWith('/api/nodes')) return { nodes: [{ id: 'esp32-a', name: 'ESP32 A', ip: '192.168.1.50', port: 80 }] }
    if (url.endsWith('/api/services')) return { services: [{ serviceId: 'link10', file: 'link10.pcode', enabled: true }] }
    if (url.endsWith('/pmachine/service_host/status')) return {
      running: true,
      services: [{
        collectorId: 'collector-a', bootId: 'boot-a', entries: 12, cacheEntries: 3, cacheBytes: 64,
        daemons: [{ udpPort: 4210, intervalMs: 1000, timerRuns: 7, failures: 1 }],
      }],
    }
    throw new Error(`Unexpected URL ${url}`)
  })
  const provider = new view.NodeInventoryTreeProvider()
  const [node] = await provider.getChildren()
  assert.equal(node.contextValue, 'inventory-node')
  const items = await provider.getChildren(node)
  const registration = items.find(item => item.kind === 'inventory-registered-service')
  const hosted = items.find(item => item.kind === 'inventory-hosted-context')
  assert.equal(registration.label, 'link10')
  assert.equal(registration.description, 'registered')
  assert.match(registration.tooltip, /does not prove/)
  assert.equal(hosted.label, 'Hosted context: collector-a')
  const details = await provider.getChildren(hosted)
  assert.match(details[0].label, /aggregate\): 12/)
  assert.equal(details[1].label, 'Distributed cache entries: 3')
  assert.equal(details[2].kind, 'inventory-daemon')
  assert.equal(details[2].description, 'UDP 4210 · 1000 ms interval · runs 7 · failures 1')
})

test('Node Inventory presents unavailable runtime status explicitly rather than claiming it is empty', async () => {
  const view = await loadView(async url => {
    if (url.endsWith('/api/nodes')) return { nodes: [{ id: 'esp32-a', ip: '192.168.1.50' }] }
    if (url.endsWith('/api/services')) return { services: [] }
    throw new Error('HTTP 503: Hosted runtime busy')
  })
  const provider = new view.NodeInventoryTreeProvider()
  const [node] = await provider.getChildren()
  const rows = await provider.getChildren(node)
  assert.ok(rows.some(item => item.label === 'No named services registered'))
  const runtime = rows.find(item => item.label === 'Hosted runtime status unavailable')
  assert.ok(runtime)
  assert.match(runtime.tooltip, /503/)
})

test('Node Inventory unregister and stop actions are separately confirmed and call distinct APIs', async () => {
  const calls = []
  const view = await loadView(async (url, _timeout, _details, options = {}) => {
    calls.push({ url, method: options.method || 'GET' })
    return { ok: true }
  })
  const prompts = []
  view.vscode.window.showWarningMessage = async (message, options, action) => {
    prompts.push({ message, options, action })
    return action
  }
  const provider = new view.NodeInventoryTreeProvider()
  const node = { nodeId: 'esp32-a' }
  await provider.unregisterNamedService({
    node, serviceId: 'link10', address: '192.168.1.50', port: 80,
  })
  await provider.stopHostedContext({
    kind: 'inventory-hosted-context', node, collectorId: 'collector-a',
    address: '192.168.1.50', port: 80, label: 'Hosted context: collector-a',
  })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].method, 'DELETE')
  assert.match(calls[0].url, /\/api\/services\/link10$/)
  assert.equal(calls[1].method, 'POST')
  assert.match(calls[1].url, /\/pmachine\/service_host\/stop\?collectorId=collector-a$/)
  assert.equal(prompts.length, 2)
  assert.ok(prompts[0].message.includes('does not stop a hosted context'))
  assert.ok(prompts[1].message.includes('transient table/cache state'))
  assert.ok(prompts.every(prompt => prompt.options.modal === true))
})

test('WFL validate compiles, while Deploy reports that no device deployment occurred', async () => {
  const calls = []
  const view = await loadView(async (url, _timeout, _details, options = {}) => {
    calls.push({ url, method: options.method || 'GET' })
    return { deployments: [{ id: 'board-deploy', resources: [] }] }
  })
  const messages = []
  view.vscode.window.showInformationMessage = async message => { messages.push(message) }
  view.vscode.window.showWarningMessage = async message => { messages.push(message) }
  view.vscode.workspace.fs = { readFile: async () => Buffer.from('DEPLOYMENT "board-deploy"') }
  const item = { resourceUri: { fsPath: 'deployment.wfl' } }
  await view.validateWflDeployment(item)
  await view.explainWflDeploymentUnavailable()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'POST')
  assert.match(messages[0], /WFL valid/)
  assert.match(messages[1], /No deployment was made/)
})

test('WFL preview matches declared targets against node registry IDs', async () => {
  const calls = []
  const view = await loadView(async (url, _timeout, _details, options = {}) => {
    calls.push({ url, method: options.method || 'GET' })
    return url.endsWith('/api/nodes')
      ? { nodes: [{ id: 'esp32-a' }] }
      : { deployments: [{ id: 'bundle-a', targets: ['esp32-a', 'missing-node'], resources: [{ id: 'svc-a' }] }] }
  })
  const messages = []
  view.vscode.window.showInformationMessage = async message => { messages.push(message) }
  view.vscode.workspace.fs = { readFile: async () => Buffer.from('deployment source') }
  await view.previewWflDeployment({ resourceUri: { fsPath: 'deploy.wfl' } })
  assert.deepEqual(calls.map(call => call.method), ['POST', 'GET'])
  assert.match(messages[0], /bundle-a: 1 resource/)
  assert.match(messages[0], /unmatched missing-node/)
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
