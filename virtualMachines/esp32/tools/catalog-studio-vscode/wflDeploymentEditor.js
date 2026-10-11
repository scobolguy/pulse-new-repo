const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { pathToFileURL } = require('node:url')

const VIEW_TYPE = 'pulseCatalogStudio.wflDeploymentEditor'

function compilerRoot(vscode, uri) {
  let directory = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath
  if (!directory) throw new Error('Open a workspace containing the Pulse compilers.')
  for (const candidate of [directory, path.join(directory, 'virtualMachines', 'esp32')]) {
    if (fs.existsSync(path.join(candidate, 'aggregator', 'scripts', 'build-vfl-deployment.mjs'))) return candidate
  }
  while (path.dirname(directory) !== directory) {
    directory = path.dirname(directory)
    if (fs.existsSync(path.join(directory, 'aggregator', 'scripts', 'build-vfl-deployment.mjs'))) return directory
  }
  throw new Error('Pulse WFL/VFL compilers were not found in this workspace.')
}

function compileOptions(environment, definesText) {
  const variables = JSON.parse(definesText || '{}')
  if (!variables || Array.isArray(variables) || typeof variables !== 'object' || Object.values(variables).some(value => typeof value !== 'string')) {
    throw new Error('Defines must be a JSON object with string values.')
  }
  return { ...(environment ? { environment } : {}), variables }
}

async function compileDocument(vscode, document, options) {
  if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before compiling referenced source.')
  const root = compilerRoot(vscode, document.uri)
  const compiler = await import(pathToFileURL(path.join(root, 'aggregator', 'scripts', 'compile-workflow-dsl.mjs')).href)
  return { root, compiled: compiler.compileWorkflowDSL(document.getText(), options) }
}

async function buildDocument(vscode, document, options, write = false) {
  const { root, compiled } = await compileDocument(vscode, document, options)
  const builder = await import(pathToFileURL(path.join(root, 'aggregator', 'scripts', 'build-vfl-deployment.mjs')).href)
  const result = await builder.buildVflDeployments(compiled, { artifactRoot: path.dirname(document.fileName), write })
  return { root, ...result }
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
}

function getEditorHtml(document, environment = '', defines = {}) {
  const nonce = crypto.randomBytes(16).toString('hex')
  return `<!doctype html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <style>
    body { color:var(--vscode-editor-foreground); background:var(--vscode-editor-background); font-family:var(--vscode-font-family); margin:16px; }
    header, .controls { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }
    main { display:grid; grid-template-columns: minmax(300px, 1fr) minmax(250px, 1fr); gap:16px; }
    textarea, input { background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border); padding:6px; }
    #source { width:100%; height:70vh; box-sizing:border-box; font-family:var(--vscode-editor-font-family); }
    button { background:var(--vscode-button-background); color:var(--vscode-button-foreground); border:0; padding:6px 10px; cursor:pointer; }
    button:disabled { opacity:0.5; cursor:wait; } pre { white-space:pre-wrap; overflow-wrap:anywhere; } #status { margin:10px 0; } .error { color:var(--vscode-errorForeground); }
    @media (max-width:700px) { main { grid-template-columns:1fr; } }
    </style></head><body>
    <header><strong>WFL configuration and deployment</strong><button id="openText">Open Text</button></header>
    <div>${escape(document.fileName)}</div>
    <p>VFL owns the executable graph. WFL assigns environment names and placement targets.</p>
    <div class="controls"><label>Environment <input id="environment" value="${escape(environment)}" placeholder="Use file default"></label>
    <label>Defines (JSON) <input id="defines" value="${escape(JSON.stringify(defines))}"></label></div>
    <div class="controls"><button data-action="validate">Validate WFL</button><button data-action="preview">Compile / Preview VFL</button>
    <button data-action="build">Build Artifacts</button><button data-action="deploy">Deploy to Backend JS</button></div>
    <p>Deployment starts workers on the backend's local JS supervisor. Target IDs are placement metadata; remote PMachine installation is not implemented here.</p>
    <div id="status" role="status">Ready. Deployment is never automatic.</div>
    <main><section><h3>WFL source</h3><textarea id="source" spellcheck="false">${escape(document.getText())}</textarea></section>
    <section><h3>Linked VFL documents</h3><div id="references">Validate or preview to list linked graphs.</div><h3>Compilation / deployment results</h3><pre id="result"></pre></section></main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const source = document.getElementById('source');
      let revision = 0;
      source.addEventListener('input', () => vscode.postMessage({ type:'update', text:source.value, revision:++revision }));
      document.getElementById('openText').onclick = () => vscode.postMessage({ type:'openText' });
      for (const button of document.querySelectorAll('[data-action]')) {
        button.onclick = () => {
          for (const item of document.querySelectorAll('[data-action]')) item.disabled = true;
          document.getElementById('status').textContent = 'Working...';
          vscode.postMessage({ type:button.dataset.action, text:source.value, environment:document.getElementById('environment').value, defines:document.getElementById('defines').value });
        };
      }
      window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'source') { source.value = message.text; return; }
        if (message.type === 'result') {
          for (const item of document.querySelectorAll('[data-action]')) item.disabled = false;
          const status = document.getElementById('status');
          status.textContent = message.error || message.status;
          status.className = message.error ? 'error' : '';
          document.getElementById('result').textContent = message.result ? JSON.stringify(message.result, null, 2) : '';
          const references = document.getElementById('references');
          references.replaceChildren();
          for (const reference of message.references || []) {
            const button = document.createElement('button');
            button.textContent = reference;
            button.onclick = () => vscode.postMessage({ type:'openVfl', fileName:reference, environment:document.getElementById('environment').value, defines:document.getElementById('defines').value });
            references.appendChild(button);
          }
        }
      });
    </script></body></html>`
}

async function createWflDocument(vscode, vflUri) {
  const folder = vflUri ? path.dirname(vflUri.fsPath) : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!folder) throw new Error('Open a workspace before creating a WFL document.')
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(folder, vflUri ? `${path.parse(vflUri.fsPath).name}.wfl` : 'deployment.wfl')),
    filters: { 'WFL deployment': ['wfl'] }, saveLabel: 'Create WFL Deployment'
  })
  if (!uri) return
  const relative = vflUri ? path.relative(path.dirname(uri.fsPath), vflUri.fsPath) : 'application.vfl'
  const quote = value => JSON.stringify(value)
  const source = `DEFAULT ENVIRONMENT "dev";\nLET deploymentTarget = "CHOOSE_NODE";\n\nDEPLOYMENT "application" PROJECT "application" TARGETS ("\${deploymentTarget}") BEGIN\n  FLOW "application" FILE ${quote(relative)} TARGETS ("\${deploymentTarget}") STARTUP TRUE;\nEND;\n`
  await vscode.workspace.fs.writeFile(uri, Buffer.from(source, 'utf8'))
  await vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE)
}

function register(vscode, context) {
  const provider = {
    async resolveCustomTextEditor(document, panel) {
      panel.webview.options = { enableScripts: true }
      const settings = vscode.workspace.getConfiguration('pulse-pmachine', document.uri)
      panel.webview.html = getEditorHtml(document, settings.get('wfl.environment', ''), settings.get('wfl.defines', {}))
      let applying = false
      let queue = Promise.resolve()
      const update = async text => {
        if (text === document.getText()) return
        const edit = new vscode.WorkspaceEdit()
        edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text)
        applying = true
        try {
          if (!await vscode.workspace.applyEdit(edit)) throw new Error('Could not update the WFL document.')
        } finally { applying = false }
      }
      const subscription = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.uri.toString() === document.uri.toString() && !applying) panel.webview.postMessage({ type: 'source', text: document.getText() })
      })
      panel.onDidDispose(() => subscription.dispose())
      panel.webview.onDidReceiveMessage(message => {
        queue = queue.then(async () => {
          if (message.type === 'update') { await update(message.text); return }
          if (message.type === 'openText') {
            await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default', vscode.ViewColumn.Beside)
            return
          }
          if (message.type === 'openVfl') {
            const { compiled } = await compileDocument(vscode, document, compileOptions(message.environment, message.defines))
            const references = compiled.deployments.flatMap(plan => plan.resources.filter(resource => resource.kind === 'flow').map(resource => resource.fileName))
            if (!references.includes(message.fileName)) throw new Error('This VFL file is not referenced by the current WFL.')
            await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(path.resolve(path.dirname(document.fileName), message.fileName)), 'pulseCatalogStudio.vflEditor')
            return
          }
          if (!['validate', 'preview', 'build', 'deploy'].includes(message.type)) throw new Error('Unknown WFL editor action.')
          if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before compiling or deploying referenced source.')
          await update(message.text)
          const options = compileOptions(message.environment, message.defines)
          const { compiled } = await compileDocument(vscode, document, options)
          const references = [...new Set(compiled.deployments.flatMap(plan => plan.resources.filter(resource => resource.kind === 'flow').map(resource => resource.fileName)))]
          let result = compiled
          let status = 'WFL syntax and configuration valid.'
          if (message.type !== 'validate') {
            if (!compiled.deployments.length) throw new Error('WFL contains no deployment declarations.')
            if (message.type === 'deploy') {
              const choice = await vscode.window.showWarningMessage('Build and start these workers on the Pulse backend local JS supervisor? This does not install code on remote nodes.', { modal: true }, 'Deploy')
              if (choice !== 'Deploy') {
                panel.webview.postMessage({ type: 'result', status: 'Deployment cancelled.', references })
                return
              }
            }
            const built = await buildDocument(vscode, document, options, message.type === 'build')
            result = { deployments: built.compiled.deployments, artifacts: built.artifacts.map(({ fileName, programMapFile }) => ({ fileName, programMapFile })) }
            status = message.type === 'build' ? 'Build complete. Pcode and program maps saved under .pulse-build.' : 'VFL source compiled; preview did not write files or deploy.'
            if (message.type === 'deploy') {
              const interpreter = await import(pathToFileURL(path.join(built.root, 'aggregator', 'scripts', 'interpret-workflow.mjs')).href)
              result = await interpreter.executeDeploymentPlan(compiled, false, {
                artifactRoot: path.dirname(document.fileName),
                serviceBaseUrl: vscode.workspace.getConfiguration('pulse').get('catalogStudio.apiBase', 'http://127.0.0.1:4000')
              })
              status = 'Deployment requests submitted. Check Node Inventory for runtime status.'
            }
          }
          panel.webview.postMessage({ type: 'result', status, result, references })
        }).catch(error => {
          panel.webview.postMessage({ type: 'result', error: error.message || String(error) })
          vscode.window.showErrorMessage(`WFL: ${error.message || String(error)}`)
        })
      })
    }
  }
  return vscode.Disposable.from(
    vscode.window.registerCustomTextEditorProvider(VIEW_TYPE, provider, { supportsMultipleEditorsPerDocument: false }),
    vscode.commands.registerCommand('pulseCatalogStudio.openWflEditor', async uri => {
      const target = uri || vscode.window.activeTextEditor?.document?.uri
      if (!target || path.extname(target.fsPath).toLowerCase() !== '.wfl') {
        vscode.window.showErrorMessage('Open a .wfl file first.')
        return
      }
      await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE)
    }),
    vscode.commands.registerCommand('pulseCatalogStudio.newWfl', async uri => {
      try { await createWflDocument(vscode, uri) } catch (error) { vscode.window.showErrorMessage(error.message || String(error)) }
    })
  )
}

module.exports = { register, compileOptions, getEditorHtml, createWflDocument, VIEW_TYPE }
