const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const test = require('node:test')
const { pathToFileURL } = require('node:url')
const editor = require('../../../tools/catalog-studio-vscode/wflDeploymentEditor')

test('WFL compiler options validate defines rather than coercing invalid values', () => {
  assert.deepEqual(editor.compileOptions('test', '{"region":"eu"}'), { environment: 'test', variables: { region: 'eu' } })
  assert.throws(() => editor.compileOptions('', '{"port":42}'), /string values/)
  assert.throws(() => editor.compileOptions('', '[]'), /JSON object/)
  assert.throws(() => editor.compileOptions('', 'bad'), SyntaxError)
})

test('WFL editor escapes document source and its webview script parses', () => {
  const html = editor.getEditorHtml({ fileName: 'deployment.wfl', getText: () => '</textarea><script>alert(1)</script>' })
  assert.ok(html.includes('&lt;/textarea&gt;'))
  assert.ok(html.includes('Linked VFL documents'))
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1])
})

test('VFL executable inspector is separate from the embedded FLOW editor; webview script parses', () => {
  const filename = path.resolve(__dirname, '../../../tools/catalog-studio-vscode/extension.js')
  const nativeRequire = createRequire(filename)
  const context = {
    require: name => name === 'vscode' ? { TreeItem: class {} } : nativeRequire(name), module: { exports: {} }, exports: {}, Buffer, console,
    setTimeout, clearTimeout, URL, URLSearchParams
  }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.testHtml = getVflEditorHtml; module.exports.setVscode = api => vscode = api;', context)
  context.module.exports.setVscode({
    workspace: { getConfiguration: () => ({ get: (_name, fallback) => fallback }) },
    Uri: { joinPath: (...args) => args.join('/') }
  })
  const parsed = { valid: true, value: { nodes: [], edges: [], metadata: { name: 'Test' } }, diagnostics: [], prettyText: '{}' }
  const webview = { cspSource: 'test', asWebviewUri: value => value }
  const document = { uri: { fsPath: 'test.vfl' }, getText: () => '{}' }
  const html = context.module.exports.testHtml(webview, 'root', document, parsed, { isWfl: false })
  assert.ok(html.includes('id="nodeSource"'))
  assert.ok(html.includes('id="createDeployment"'))
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1])
  const embedded = context.module.exports.testHtml(webview, 'root', document, parsed, { isWfl: true })
  assert.ok(!embedded.includes('id="nodeSource"'))
})

test('WFL custom editor registers independently and external edits refresh its source', async () => {
  let provider, receive, changed
  const sent = []
  const commands = []
  const vscode = {
    workspace: {
      getConfiguration: () => ({ get: (_key, fallback) => fallback }),
      onDidChangeTextDocument: callback => { changed = callback; return { dispose() {} } }
    },
    window: { registerCustomTextEditorProvider: (type, item) => { assert.equal(type, editor.VIEW_TYPE); provider = item; return { dispose() {} } } },
    commands: { registerCommand: name => { commands.push(name); return { dispose() {} } } },
    Disposable: { from: (...items) => items }
  }
  editor.register(vscode, {})
  assert.ok(commands.includes('pulseCatalogStudio.openWflEditor'))
  const uri = { toString: () => 'deployment.wfl' }
  const document = { uri, fileName: 'deployment.wfl', getText: () => 'DEFAULT ENVIRONMENT "test";' }
  await provider.resolveCustomTextEditor(document, {
    webview: { postMessage: value => sent.push(value), onDidReceiveMessage: callback => { receive = callback } },
    onDidDispose() {}
  })

  changed({ document })
  assert.deepEqual(sent[0], { type: 'source', text: 'DEFAULT ENVIRONMENT "test";' })
  assert.equal(typeof receive, 'function')
})

  test('VS Code VFL Process palette drops, moves, links and persists boxes without catalog bindings', () => {
    const filename = path.resolve(__dirname, '../../../tools/catalog-studio-vscode/extension.js')
    const nativeRequire = createRequire(filename)
    const host = {
      require: name => name === 'vscode' ? { TreeItem: class {} } : nativeRequire(name),
      module: { exports: {} }, Buffer, console, URL, URLSearchParams
    }
    vm.runInNewContext(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.testHtml = getVflEditorHtml;', host)
    vm.runInNewContext(`vscode = {
      workspace: { getConfiguration: () => ({ get: (_key, fallback) => fallback }) },
      Uri: { joinPath: (...args) => args.join('/') }
    };`, host)
    const initial = { schemaVersion: 1, nodes: [], edges: [], metadata: { name: 'Test' } }
    const html = host.module.exports.testHtml(
      { cspSource: 'test', asWebviewUri: value => value }, 'root',
      { uri: { fsPath: 'test.vfl' } },
      { valid: true, value: initial, prettyText: JSON.stringify(initial) }
    )
    assert.ok(html.indexOf('id="componentList"') < html.indexOf('id="workflowCanvas"'))
    assert.ok(html.indexOf('<div class="catalog-item-label">Process</div>') < html.indexOf('<script'))
    assert.ok(html.includes('.workflow-node.process { border-radius: 0; }'))
    assert.ok(!html.includes('<iframe'))

    class Element {
      constructor() {
        this.children = []
        this.listeners = {}
        this.style = {}
        this.value = ''
        this.classList = { add() {}, remove() {} }
      }
      set innerHTML(value) { this.html = value; this.children = []; this.buttons = [...value.matchAll(/<button\b/g)].map(() => new Element()) }
      get innerHTML() { return this.html || '' }
      addEventListener(type, listener) { this.listeners[type] = listener }
      querySelectorAll(selector) { return selector === 'button' ? this.buttons || [] : [] }
      querySelector() { return (this.buttons || [])[0] || null }
      appendChild(item) { this.children.push(item) }
      append(...items) { this.children.push(...items) }
      replaceChildren() { this.children = [] }
      setAttribute() {}
      setPointerCapture() {}
      getBoundingClientRect() { return { left: -100, top: -50 } }
    }
    const elements = new Map()
    const getElement = id => {
      if (!elements.has(id)) elements.set(id, new Element())
      return elements.get(id)
    }
    getElement('editor').value = JSON.stringify(initial)
    getElement('edgeTypeSelect').value = 'message-broker-call'
    const messages = []
    const windowListeners = {}
    const context = vm.createContext({
      document: { getElementById: getElement, createElement: () => new Element(), createElementNS: () => new Element() },
      acquireVsCodeApi: () => ({ postMessage: message => messages.push(message) }),
      window: { addEventListener: (type, callback) => { windowListeners[type] = callback }, clearTimeout, setTimeout },
      fetch: async () => ({ ok: true, json: async () => ({}) }),
      console
    })
    const script = /<script[^>]*>([\s\S]*?)<\/script>/.exec(html)[1]
    vm.runInContext(script, context)
    const card = getElement('componentList').children[0]
    assert.equal(card.draggable, true)
    assert.ok(card.innerHTML.includes('Process'))
    assert.ok(!card.innerHTML.includes('Seed Flow'))
    const data = new Map()
    const dataTransfer = { setData: (type, value) => data.set(type, value), getData: type => data.get(type) || '' }
    card.listeners.dragstart({ dataTransfer })
    getElement('workflowCanvas').listeners.drop({ preventDefault() {}, dataTransfer, clientX: 300, clientY: 200 })
    const model = () => JSON.parse(getElement('editor').value)
    const first = model().nodes[0]
    assert.equal(first.kind, 'service')
    assert.equal(first.type, 'process')
    assert.equal(first.label, 'Process')
    assert.equal(first.x, 310)
    assert.equal(first.y, 226)
    assert.equal(first.sourceCatalogId, undefined)
    assert.equal(model().catalog, undefined)
    assert.equal(messages.at(-1).type, 'updateDocument')
    assert.deepEqual(JSON.parse(messages.at(-1).text), model())

    const box = getElement('workflowStage').children[0]
    box.listeners.pointerdown({ target: { closest: () => null }, pointerId: 1, clientX: 300, clientY: 200 })
    box.listeners.pointerup({ pointerId: 1, clientX: 340, clientY: 230 })
    assert.equal(model().nodes[0].x, 350)
    assert.equal(model().nodes[0].y, 256)
    card.querySelectorAll('button')[0].listeners.click()
    assert.equal(model().nodes.length, 2)
    assert.notEqual(model().nodes[1].id, first.id)
    vm.runInContext('edgeSourceNodeId = safeParseEditorValue().nodes[0].id; createEdgeFromSelection(safeParseEditorValue().nodes[1].id);', context)
    assert.equal(model().edges.length, 1)
    assert.equal(model().edges[0].from, first.id)
    const saved = messages.at(-1).text
    windowListeners.message({ data: { type: 'replaceDocument', text: JSON.stringify(initial) } })
    assert.equal(model().nodes.length, 0)
    windowListeners.message({ data: { type: 'replaceDocument', text: saved } })
    assert.equal(model().nodes.length, 2)
    assert.equal(model().edges.length, 1)
    vm.runInContext('deleteWorkflowNode(safeParseEditorValue().nodes[0].id);', context)
    assert.equal(model().nodes.length, 1)
    assert.equal(model().edges.length, 0)
    assert.equal(messages.some(message => message.type === 'showError'), false)
  })
test('WFL editor validates the latest queued source without overwriting unrelated text', async () => {
  let provider, receive, text = ''
  let complete
  const result = new Promise(resolve => { complete = resolve })
  const root = path.resolve(__dirname, '../../..')
  const vscode = {
    workspace: {
      isTrusted: true,
      getWorkspaceFolder: () => ({ uri: { fsPath: root } }),
      getConfiguration: () => ({ get: (_key, fallback) => fallback }),
      onDidChangeTextDocument: () => ({ dispose() {} }),
      applyEdit: async edit => { text = edit.text; return true }
    },
    window: { registerCustomTextEditorProvider: (_type, item) => { provider = item; return { dispose() {} } }, showErrorMessage: assert.fail },
    commands: { registerCommand: () => ({ dispose() {} }) },
    WorkspaceEdit: class { replace(_uri, _range, value) { this.text = value } },
    Range: class {},
    Disposable: { from: (...items) => items }
  }
  editor.register(vscode, {})
  const document = {
    uri: { fsPath: path.join(root, 'deployment.wfl'), toString: () => 'deployment.wfl' },
    fileName: path.join(root, 'deployment.wfl'), getText: () => text, positionAt: offset => offset
  }
  await provider.resolveCustomTextEditor(document, {
    webview: {
      postMessage: message => { if (message.type === 'result') complete(message) },
      onDidReceiveMessage: callback => { receive = callback }
    }, onDidDispose() {}
  })
  const source = '// Preserve this comment\nDEFAULT ENVIRONMENT "dev";\nLET region = "eu";\nQUEUE "in" -> "${ENVIRONMENT}.${region}.in";'
  receive({ type: 'update', text: source })
  receive({ type: 'validate', text: source, environment: 'test', defines: '{"region":"us"}' })
  const message = await result
  assert.equal(message.error, undefined)
  assert.equal(message.result.symbols.queues[0].queueName, 'test.us.in')
  assert.equal(text, source)
})

test('new WFL template compiles and preserves a separately stored VFL path', async () => {
  const root = path.resolve(__dirname, '../../..')
  let written, opened
  const output = path.join(root, 'deployment.wfl')
  const graph = path.join(root, 'tests', 'new', 'graph.vfl')
  const vscode = {
    workspace: { fs: { writeFile: async (_uri, bytes) => { written = bytes.toString('utf8') } } },
    Uri: { file: fsPath => ({ fsPath }) },
    window: { showSaveDialog: async () => ({ fsPath: output }) },
    commands: { executeCommand: async (...args) => { opened = args } }
  }
  await editor.createWflDocument(vscode, { fsPath: graph })
  const compiler = await import(pathToFileURL(path.join(root, '..', '..', 'languages', 'wfl', 'src', 'compile-workflow-dsl.mjs')).href)
  const compiled = compiler.compileWorkflowDSL(written, { variables: { deploymentTarget: 'node-1' } })
  assert.equal(compiled.deployments[0].resources[0].fileName, path.relative(root, graph))
  assert.deepEqual(compiled.deployments[0].resources[0].targets, ['node-1'])
  assert.equal(opened[2], editor.VIEW_TYPE)
})
