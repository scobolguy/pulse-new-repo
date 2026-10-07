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
    EventEmitter: class { fire() {} },
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
  vm.runInContext(`${source}\nmodule.exports.test = { PulseInfrastructureTreeProvider, getDistributedNetworkItems, getMessageBrokerItems };`, context)
  context.requestPayload = requestPayload
  vm.runInContext('requestJson = async () => { if (requestPayload instanceof Error) throw requestPayload; return requestPayload; };', context)
  return context.module.exports.test
}

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
