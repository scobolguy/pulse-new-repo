const path = require('node:path')
const vscode = require('vscode')

const VIEW_TYPE = 'pulseCatalogStudio.webview'
const SIDEBAR_VIEW_TYPE = 'pulseCatalogStudio.sidebar'
const VFL_EDITOR_VIEW_TYPE = 'pulseCatalogStudio.vflEditor'

const DEFAULT_VFL_TEMPLATE = Object.freeze({
  schemaVersion: 1,
  kind: 'visual-flow-language',
  metadata: {
    name: 'New Visual Flow',
    description: 'Describe the infrastructure flow represented by this Visual Flow Language document.',
    createdBy: 'Pulse Catalog Studio',
  },
  catalog: {
    seedObjects: [
      'daemon.gateway.primary',
      'daemon.message-broker.primary',
      'daemon.data-librarian.primary',
    ],
  },
  animation: {
    mode: 'none',
    target: 'workflow',
    useMermaidPreview: true,
  },
  nodes: [],
  edges: [],
})

const DEFAULT_PALETTE_OBJECTS = Object.freeze([
  {
    id: 'daemon.gateway.primary',
    label: 'Primary Gateway',
    kind: 'daemon',
    type: 'gateway',
    source: 'seeded',
    description: 'Permanent ingress daemon and route termination point.',
  },
  {
    id: 'daemon.message-broker.primary',
    label: 'Primary Message Broker',
    kind: 'daemon',
    type: 'message-broker',
    source: 'seeded',
    description: 'Permanent broker daemon for flow transport.',
  },
  {
    id: 'daemon.queue-manager.primary',
    label: 'Primary Queue Manager',
    kind: 'daemon',
    type: 'queue-manager',
    source: 'seeded',
    description: 'Durable queue management daemon.',
  },
  {
    id: 'daemon.data-librarian.primary',
    label: 'Data Librarian',
    kind: 'daemon',
    type: 'data-librarian',
    source: 'seeded',
    description: 'Catalog authority and seeded object curator.',
  },
  {
    id: 'service.router.primary',
    label: 'Router Engine',
    kind: 'service',
    type: 'router-service',
    source: 'seeded',
    description: 'Typed routing surface for strongly typed messages.',
  },
  {
    id: 'service.mapper.primary',
    label: 'Mapper Engine',
    kind: 'service',
    type: 'mapper-service',
    source: 'seeded',
    description: 'Strongly typed transformation service.',
  },
  {
    id: 'map.mt103-to-pacs008',
    label: 'MT103 -> PACS.008',
    kind: 'map',
    type: 'message-map',
    source: 'seeded',
    description: 'Canonical map from SWIFT MT103 to ISO 20022 PACS.008.',
  },
  {
    id: 'queue.swift.mt103.inbound',
    label: 'swift.mt103.inbound',
    kind: 'queue',
    type: 'durable-queue',
    source: 'seeded',
    description: 'Inbound MT103 queue target.',
  },
])

const EDGE_TYPES = Object.freeze([
  { id: 'message-broker-call', label: 'Message Broker Call' },
  { id: 'file-feed', label: 'File Feed' },
  { id: 'service-call', label: 'Service Call' },
])

function getCatalogStudioUrl() {
  const configured = vscode.workspace.getConfiguration('pulse').get('catalogStudio.url', 'http://localhost:5173/')
  const value = String(configured || 'http://localhost:5173/').trim()
  if (!value) {
    return 'http://localhost:5173/'
  }
  return value.endsWith('/') ? value : `${value}/`
}

function getCatalogStudioApiBase() {
  const configured = vscode.workspace.getConfiguration('pulse').get('catalogStudio.apiBase', 'http://localhost:4000')
  const value = String(configured || 'http://localhost:4000').trim()
  if (!value) {
    return 'http://localhost:4000'
  }
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function getDefaultVflExtension() {
  const configured = vscode.workspace.getConfiguration('pulse').get('catalogStudio.defaultVflExtension', '.vfl')
  const value = String(configured || '.vfl').trim()
  if (!value) {
    return '.vfl'
  }
  return value.startsWith('.') ? value : `.${value}`
}

function getDefaultVflFolder() {
  const configured = vscode.workspace.getConfiguration('pulse').get('catalogStudio.defaultFolder', 'aggregator/data/visual-flows')
  return String(configured || 'aggregator/data/visual-flows').trim()
}

function getDefaultVflText() {
  return `${JSON.stringify(DEFAULT_VFL_TEMPLATE, null, 2)}\n`
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseVflText(text) {
  const rawText = String(text || '')
  if (!rawText.trim()) {
    return {
      valid: true,
      value: JSON.parse(JSON.stringify(DEFAULT_VFL_TEMPLATE)),
      diagnostics: [],
      prettyText: getDefaultVflText(),
    }
  }

  try {
    const value = JSON.parse(rawText)
    const diagnostics = []
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      diagnostics.push('Root value should be a JSON object.')
    }
    if (!Array.isArray(value.nodes)) {
      diagnostics.push('Expected nodes to be an array.')
    }
    if (!Array.isArray(value.edges)) {
      diagnostics.push('Expected edges to be an array.')
    }
    return {
      valid: diagnostics.length === 0,
      value,
      diagnostics,
      prettyText: `${JSON.stringify(value, null, 2)}\n`,
    }
  } catch (error) {
    return {
      valid: false,
      value: null,
      diagnostics: [String(error.message || error)],
      prettyText: rawText,
    }
  }
}

function summarizeVfl(value) {
  if (!value || typeof value !== 'object') {
    return {
      name: 'Invalid document',
      description: 'The current file does not contain a valid VFL object.',
      nodeCount: 0,
      edgeCount: 0,
      seedCount: 0,
    }
  }

  return {
    name: value?.metadata?.name || 'Untitled Visual Flow',
    description: value?.metadata?.description || 'No description set.',
    nodeCount: Array.isArray(value?.nodes) ? value.nodes.length : 0,
    edgeCount: Array.isArray(value?.edges) ? value.edges.length : 0,
    seedCount: Array.isArray(value?.catalog?.seedObjects) ? value.catalog.seedObjects.length : 0,
  }
}

function getCatalogStudioHostHtml(webview, extensionUri) {
  const appUrl = getCatalogStudioUrl()
  const nonce = String(Date.now())
  const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'catalog-studio.svg'))

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-src http: https:; connect-src http: https:;" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Pulse Catalog Studio</title>
      <style>
        :root {
          color-scheme: light dark;
          --border: color-mix(in srgb, currentColor 20%, transparent);
          --panel: color-mix(in srgb, canvas 94%, #0b253f 6%);
          --muted: color-mix(in srgb, currentColor 60%, transparent);
          --accent: #0078d4;
        }
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: canvas; color: canvastext; font-family: 'Segoe UI', system-ui, sans-serif; }
        .shell { display: grid; grid-template-rows: auto 1fr; width: 100%; height: 100%; }
        .toolbar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--panel);
        }
        .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .brand img { width: 18px; height: 18px; }
        .brand-copy { display: flex; flex-direction: column; min-width: 0; }
        .brand-title { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
        .brand-subtitle { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .actions { display: flex; align-items: center; gap: 8px; }
        button, a {
          border: 1px solid var(--border);
          background: transparent;
          color: inherit;
          border-radius: 6px;
          padding: 6px 10px;
          font: inherit;
          text-decoration: none;
          cursor: pointer;
        }
        button.primary {
          border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
          background: color-mix(in srgb, var(--accent) 18%, transparent);
        }
        iframe { width: 100%; height: 100%; border: 0; background: white; }
        .fallback { display: none; padding: 18px; line-height: 1.5; }
        .fallback.visible { display: block; }
        .hidden { display: none; }
        code { font-family: Consolas, monospace; }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="toolbar">
          <div class="brand">
            <img alt="Catalog Studio" src="${iconUri}" />
            <div class="brand-copy">
              <div class="brand-title">Pulse Catalog Studio</div>
              <div class="brand-subtitle">Webview entry point for the typed infrastructure designer</div>
            </div>
          </div>
          <div class="actions">
            <a href="${appUrl}" target="_blank" rel="noreferrer">Open in Browser</a>
            <button id="reloadFrame" class="primary" type="button">Reload</button>
          </div>
        </div>
        <iframe id="catalogFrame" src="${appUrl}"></iframe>
        <div id="fallback" class="fallback hidden">
          <p><strong>Catalog Studio is not reachable yet.</strong></p>
          <p>Start the frontend dev server in the workspace and reload this view.</p>
          <p>Expected URL: <code>${appUrl}</code></p>
          <p>Suggested command: <code>cd aggregator && npm run dev:raw</code></p>
        </div>
      </div>
      <script nonce="${nonce}">
        const frame = document.getElementById('catalogFrame');
        const fallback = document.getElementById('fallback');
        const reloadButton = document.getElementById('reloadFrame');
        const timeoutMs = 2500;
        let loadResolved = false;

        function showFallback() {
          if (loadResolved) return;
          fallback.classList.remove('hidden');
          fallback.classList.add('visible');
          frame.classList.add('hidden');
        }

        function hideFallback() {
          loadResolved = true;
          fallback.classList.remove('visible');
          fallback.classList.add('hidden');
          frame.classList.remove('hidden');
        }

        reloadButton.addEventListener('click', () => {
          loadResolved = false;
          frame.classList.remove('hidden');
          fallback.classList.remove('visible');
          fallback.classList.add('hidden');
          frame.src = frame.src;
          window.setTimeout(showFallback, timeoutMs);
        });

        frame.addEventListener('load', hideFallback);
        window.setTimeout(showFallback, timeoutMs);
      </script>
    </body>
  </html>`
}

function getVflEditorHtml(webview, extensionUri, document, parsed) {
  const appUrl = getCatalogStudioUrl()
  const apiBase = getCatalogStudioApiBase()
  const nonce = String(Date.now())
  const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'catalog-studio.svg'))
  const summary = summarizeVfl(parsed.value)
  const initialText = escapeHtml(parsed.prettyText)

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src http: https:;" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Visual Flow Language Editor</title>
      <style>
        :root {
          color-scheme: light dark;
          --border: color-mix(in srgb, currentColor 16%, transparent);
          --panel: color-mix(in srgb, canvas 94%, #0b253f 6%);
          --panel-soft: color-mix(in srgb, canvas 98%, #0b253f 2%);
          --muted: color-mix(in srgb, currentColor 60%, transparent);
          --accent: #0078d4;
          --danger: #d13438;
          --ok: #107c10;
          --shadow: 0 10px 22px rgba(15, 38, 64, 0.12);
        }
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: canvas; color: canvastext; font-family: 'Segoe UI', system-ui, sans-serif; }
        .shell { display: grid; grid-template-rows: auto 1fr; width: 100%; height: 100%; }
        .toolbar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--panel);
        }
        .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .brand img { width: 18px; height: 18px; }
        .brand-copy { display: flex; flex-direction: column; min-width: 0; }
        .brand-title { font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
        .brand-subtitle { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        button, a {
          border: 1px solid var(--border); background: transparent; color: inherit; border-radius: 6px;
          padding: 6px 10px; font: inherit; text-decoration: none; cursor: pointer;
        }
        button.primary { border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); background: color-mix(in srgb, var(--accent) 18%, transparent); }
        .main { display: grid; grid-template-columns: 320px minmax(0, 1fr) 390px; min-height: 0; }
        .leftbar {
          border-right: 1px solid var(--border);
          background: var(--panel-soft);
          overflow: auto;
          padding: 14px;
        }
        .sidebar { border-left: 1px solid var(--border); background: var(--panel-soft); overflow: auto; padding: 14px; }
        .editor-wrap { min-height: 0; display: grid; grid-template-rows: minmax(300px, 1fr) minmax(220px, 0.65fr) auto; }
        .canvas-wrap { display: grid; grid-template-rows: auto 1fr auto; min-height: 0; border-bottom: 1px solid var(--border); }
        .canvas-toolbar {
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          padding: 10px 14px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, canvas 96%, #0b253f 4%);
          font-size: 12px; color: var(--muted);
        }
        .workflow-canvas {
          position: relative; min-height: 0; overflow: auto; background:
            linear-gradient(90deg, color-mix(in srgb, currentColor 7%, transparent) 1px, transparent 1px),
            linear-gradient(color-mix(in srgb, currentColor 7%, transparent) 1px, transparent 1px);
          background-size: 32px 32px;
          background-position: -1px -1px;
        }
        .workflow-stage { position: relative; min-width: 100%; min-height: 100%; }
        .workflow-edges {
          position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible;
        }
        .workflow-edge-path { fill: none; stroke: color-mix(in srgb, var(--accent) 70%, currentColor); stroke-width: 2.5; }
        .workflow-edge-label { fill: color-mix(in srgb, currentColor 70%, transparent); font-size: 11px; font-family: 'Segoe UI', system-ui, sans-serif; }
        .workflow-edge-path.is-active { stroke: #ffb900; stroke-width: 3.5; }
        .workflow-edge-label.is-active { fill: #ffb900; font-weight: 700; }
        .workflow-empty {
          position: absolute; inset: 20px; display: flex; align-items: center; justify-content: center;
          border: 2px dashed var(--border); border-radius: 12px; color: var(--muted); font-size: 13px;
        }
        .workflow-node {
          position: absolute; width: 180px; border: 1px solid var(--border); border-radius: 10px;
          background: color-mix(in srgb, canvas 96%, #0b253f 4%); box-shadow: var(--shadow);
          padding: 10px; cursor: pointer; user-select: none;
        }
        .workflow-node.selected { border-color: var(--accent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent), var(--shadow); }
        .workflow-node-head { display: flex; justify-content: space-between; gap: 8px; }
        .workflow-node-label { font-size: 13px; font-weight: 700; }
        .workflow-node-kind { font-size: 10px; text-transform: uppercase; color: var(--muted); }
        .workflow-node-type { margin-top: 6px; font-size: 12px; color: var(--muted); }
        .workflow-node-target { margin-top: 8px; font-size: 11px; color: color-mix(in srgb, currentColor 75%, transparent); }
        .workflow-node-actions { margin-top: 8px; display: flex; gap: 8px; }
        .workflow-node-actions button { padding: 4px 7px; font-size: 11px; }
        .workflow-node.is-link-source { border-color: color-mix(in srgb, #ffb900 75%, var(--accent)); box-shadow: 0 0 0 1px color-mix(in srgb, #ffb900 55%, transparent), var(--shadow); }
        .workflow-footer {
          display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px;
          border-top: 1px solid var(--border); background: color-mix(in srgb, canvas 96%, #0b253f 4%); font-size: 12px; color: var(--muted);
        }
        textarea {
          width: 100%; height: 100%; resize: none; border: 0; outline: none; box-sizing: border-box;
          padding: 16px 18px; background: canvas; color: canvastext; font: 13px/1.5 Consolas, 'Courier New', monospace; tab-size: 2;
        }
        .section { margin-bottom: 16px; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, canvas 96%, transparent); box-shadow: var(--shadow); }
        .section h3 { margin: 0; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); color: var(--muted); }
        .section-body { padding: 12px; }
        .summary-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .summary-description { font-size: 13px; color: var(--muted); line-height: 1.45; }
        .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
        .stat { border: 1px solid var(--border); border-radius: 8px; padding: 10px; text-align: center; }
        .stat-value { font-size: 20px; font-weight: 700; }
        .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; }
        .diagnostics { padding: 12px; font-size: 12px; color: var(--ok); }
        .diagnostics.error { color: var(--danger); }
        .catalog-list { display: flex; flex-direction: column; gap: 8px; }
        .catalog-item { border: 1px solid var(--border); border-radius: 8px; padding: 10px; background: color-mix(in srgb, canvas 98%, transparent); }
        .catalog-item.dragging { opacity: 0.55; }
        .catalog-item-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .catalog-item-label { font-size: 13px; font-weight: 700; }
        .catalog-item-kind { font-size: 10px; text-transform: uppercase; color: var(--muted); }
        .catalog-item-description { margin-top: 6px; font-size: 12px; color: var(--muted); line-height: 1.45; }
        .catalog-item-actions { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
        .catalog-item-actions button { padding: 5px 8px; font-size: 11px; }
        .edge-item.active { border-color: color-mix(in srgb, var(--accent) 70%, var(--border)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), var(--shadow); }
        .section-note { color: var(--muted); font-size: 12px; line-height: 1.45; margin-bottom: 10px; }
        .footer {
          display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 10px 14px;
          border-top: 1px solid var(--border); background: var(--panel); font-size: 12px; color: var(--muted);
        }
        .status.ok { color: var(--ok); }
        .status.error { color: var(--danger); }
        code { font-family: Consolas, 'Courier New', monospace; font-size: 12px; }
        @media (max-width: 1080px) {
          .main { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; }
          .leftbar { border-right: 0; border-bottom: 1px solid var(--border); }
          .sidebar { border-left: 0; border-top: 1px solid var(--border); border-bottom: 0; }
        }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="toolbar">
          <div class="brand">
            <img alt="Catalog Studio" src="${iconUri}" />
            <div class="brand-copy">
              <div class="brand-title">Visual Flow Language</div>
              <div class="brand-subtitle">${escapeHtml(document.uri.fsPath)}</div>
            </div>
          </div>
          <div class="actions">
            <button id="insertTemplate" type="button">Reset Template</button>
            <button id="formatDocument" type="button">Format JSON</button>
            <a href="${appUrl}" target="_blank" rel="noreferrer">Open Catalog Studio</a>
          </div>
        </div>
        <div class="main">
          <div class="leftbar">
            <div class="section">
              <h3>Palette</h3>
              <div class="section-body">
                <div class="section-note">Seeded permanent objects appear immediately. The editor then asks the aggregator what additional services, maps, queues, and providers exist.</div>
                <div id="paletteList" class="catalog-list"></div>
              </div>
            </div>
            <div class="section">
              <h3>Edge Semantics</h3>
              <div class="section-body">
                <div class="section-note">These edge types model how flow steps communicate. Message broker calls are likely primary, but file feeds and direct service calls are also first-class.</div>
                <div id="edgeTypeList" class="catalog-list"></div>
              </div>
            </div>
          </div>
          <div class="editor-wrap">
            <div class="canvas-wrap">
              <div class="canvas-toolbar">
                <span>Current Workflow</span>
                <span id="canvasHint">Drag seeded or discovered items from the RHS onto the workflow surface.</span>
                <span>
                  <label for="edgeTypeSelect">Edge Type</label>
                  <select id="edgeTypeSelect">
                    ${EDGE_TYPES.map((edgeType) => `<option value="${edgeType.id}">${edgeType.label}</option>`).join('')}
                  </select>
                  <button id="runAnimation" class="primary" type="button">Run Flow</button>
                </span>
              </div>
              <div id="workflowCanvas" class="workflow-canvas">
                <div id="workflowStage" class="workflow-stage"></div>
                <svg id="workflowEdges" class="workflow-edges"></svg>
                <div id="workflowEmpty" class="workflow-empty">Drop palette or topology items here to build the current workflow.</div>
              </div>
              <div class="workflow-footer">
                <span id="selectedNodeLabel">No workflow node selected.</span>
                <span>Middle pane is the current workflow. RHS is for palette and topology.</span>
              </div>
            </div>
            <textarea id="editor" spellcheck="false">${initialText}</textarea>
            <div class="footer">
              <div id="status" class="status ${parsed.valid ? 'ok' : 'error'}">${parsed.valid ? 'VFL structure valid' : 'Fix JSON or schema issues before saving'}</div>
              <div>Changes apply directly to the underlying <code>.vfl</code> document.</div>
            </div>
          </div>
          <div class="sidebar">
            <div class="section">
              <h3>Summary</h3>
              <div class="section-body">
                <div id="summaryName" class="summary-title">${escapeHtml(summary.name)}</div>
                <div id="summaryDescription" class="summary-description">${escapeHtml(summary.description)}</div>
                <div class="stats">
                  <div class="stat"><div id="statNodes" class="stat-value">${summary.nodeCount}</div><div class="stat-label">Nodes</div></div>
                  <div class="stat"><div id="statEdges" class="stat-value">${summary.edgeCount}</div><div class="stat-label">Edges</div></div>
                  <div class="stat"><div id="statSeeds" class="stat-value">${summary.seedCount}</div><div class="stat-label">Seeds</div></div>
                </div>
              </div>
            </div>
            <div class="section">
              <h3>Deployment Targets</h3>
              <div class="section-body">
                <div class="section-note">Use discovered topology as a concrete execution or routing target for the workflow.</div>
                <div id="topologyList" class="catalog-list"></div>
              </div>
            </div>
            <div class="section">
              <h3>Structure</h3>
              <div class="section-body">
                <div><code>metadata</code> describes the flow.</div>
                <div><code>animation</code> reserves playback/debug intent for future runtime or Mermaid-style visualization.</div>
                <div><code>catalog.seedObjects</code> binds permanent typed objects.</div>
                <div><code>nodes</code> contains the visual items.</div>
                <div><code>edges</code> contains the typed relationships.</div>
              </div>
            </div>
            <div class="section">
              <h3>Diagnostics</h3>
              <div id="diagnostics" class="diagnostics">Document is structurally valid.</div>
            </div>
          </div>
        </div>
      </div>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const apiBase = ${JSON.stringify(apiBase)};
        const seededPalette = ${JSON.stringify(DEFAULT_PALETTE_OBJECTS)};
        const defaultTemplate = ${JSON.stringify(DEFAULT_VFL_TEMPLATE)};
        const editor = document.getElementById('editor');
        const formatButton = document.getElementById('formatDocument');
        const templateButton = document.getElementById('insertTemplate');
        const summaryName = document.getElementById('summaryName');
        const summaryDescription = document.getElementById('summaryDescription');
        const statNodes = document.getElementById('statNodes');
        const statEdges = document.getElementById('statEdges');
        const statSeeds = document.getElementById('statSeeds');
        const diagnostics = document.getElementById('diagnostics');
        const status = document.getElementById('status');
        const paletteList = document.getElementById('paletteList');
        const edgeTypeList = document.getElementById('edgeTypeList');
        const topologyList = document.getElementById('topologyList');
        const workflowCanvas = document.getElementById('workflowCanvas');
        const workflowStage = document.getElementById('workflowStage');
        const workflowEdges = document.getElementById('workflowEdges');
        const workflowEmpty = document.getElementById('workflowEmpty');
        const selectedNodeLabel = document.getElementById('selectedNodeLabel');
        const edgeTypeSelect = document.getElementById('edgeTypeSelect');
        const runAnimationButton = document.getElementById('runAnimation');
        let applyingExternalUpdate = false;
        let debounceHandle = null;
        let selectedWorkflowNodeId = null;
        let edgeSourceNodeId = null;
        let dragState = null;
        let animationTimerHandles = [];

        function clearEdgeAnimation() {
          for (const handle of animationTimerHandles) {
            window.clearTimeout(handle);
          }
          animationTimerHandles = [];
          for (const element of workflowEdges.querySelectorAll('.workflow-edge-path, .workflow-edge-label')) {
            element.classList.remove('is-active');
          }
        }

        function setActiveEdgeByIndex(index) {
          for (const element of workflowEdges.querySelectorAll('.workflow-edge-path, .workflow-edge-label')) {
            element.classList.remove('is-active');
          }
          const path = workflowEdges.querySelector('.workflow-edge-path[data-edge-index="' + index + '"]');
          const label = workflowEdges.querySelector('.workflow-edge-label[data-edge-index="' + index + '"]');
          if (path) {
            path.classList.add('is-active');
          }
          if (label) {
            label.classList.add('is-active');
          }
        }

        function runEdgePlayback() {
          const parsed = safeParseEditorValue();
          if (!parsed || !Array.isArray(parsed.edges) || !parsed.edges.length) {
            vscode.postMessage({ type: 'showError', message: 'Add at least one edge before running flow animation.' });
            return;
          }
          clearEdgeAnimation();
          const stepMs = 420;
          parsed.edges.forEach((_, index) => {
            animationTimerHandles.push(window.setTimeout(() => {
              setActiveEdgeByIndex(index);
            }, index * stepMs));
          });
          animationTimerHandles.push(window.setTimeout(() => {
            clearEdgeAnimation();
          }, parsed.edges.length * stepMs + 240));
        }

        function summarize(value) {
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {
              name: 'Invalid document',
              description: 'The current file does not contain a valid VFL object.',
              nodeCount: 0,
              edgeCount: 0,
              seedCount: 0,
            };
          }
          return {
            name: value?.metadata?.name || 'Untitled Visual Flow',
            description: value?.metadata?.description || 'No description set.',
            nodeCount: Array.isArray(value?.nodes) ? value.nodes.length : 0,
            edgeCount: Array.isArray(value?.edges) ? value.edges.length : 0,
            seedCount: Array.isArray(value?.catalog?.seedObjects) ? value.catalog.seedObjects.length : 0,
          };
        }

        function renderDiagnostics(nextText) {
          const text = String(nextText || '');
          if (!text.trim()) {
            const fallbackSummary = summarize(defaultTemplate);
            summaryName.textContent = fallbackSummary.name;
            summaryDescription.textContent = fallbackSummary.description;
            statNodes.textContent = String(fallbackSummary.nodeCount);
            statEdges.textContent = String(fallbackSummary.edgeCount);
            statSeeds.textContent = String(fallbackSummary.seedCount);
            diagnostics.textContent = 'Empty file will use the default VFL template.';
            diagnostics.classList.remove('error');
            status.textContent = 'VFL structure valid';
            status.classList.remove('error');
            status.classList.add('ok');
            return;
          }

          try {
            const value = JSON.parse(text);
            const issues = [];
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
              issues.push('Root value should be a JSON object.');
            }
            if (!Array.isArray(value?.nodes)) {
              issues.push('Expected nodes to be an array.');
            }
            if (!Array.isArray(value?.edges)) {
              issues.push('Expected edges to be an array.');
            }
            const nextSummary = summarize(value);
            summaryName.textContent = nextSummary.name;
            summaryDescription.textContent = nextSummary.description;
            statNodes.textContent = String(nextSummary.nodeCount);
            statEdges.textContent = String(nextSummary.edgeCount);
            statSeeds.textContent = String(nextSummary.seedCount);

            if (issues.length) {
              diagnostics.innerHTML = issues.map((item) => '<div>' + item + '</div>').join('');
              diagnostics.classList.add('error');
              status.textContent = 'Fix VFL schema issues before saving';
              status.classList.remove('ok');
              status.classList.add('error');
            } else {
              diagnostics.textContent = 'Document is structurally valid.';
              diagnostics.classList.remove('error');
              status.textContent = 'VFL structure valid';
              status.classList.remove('error');
              status.classList.add('ok');
            }
          } catch (error) {
            diagnostics.textContent = error.message || String(error);
            diagnostics.classList.add('error');
            status.textContent = 'Fix JSON parse errors before saving';
            status.classList.remove('ok');
            status.classList.add('error');
          }
        }

        function postContent(nextText) {
          vscode.postMessage({ type: 'updateDocument', text: nextText });
        }

        function safeParseEditorValue() {
          try {
            return JSON.parse(editor.value || '{}');
          } catch {
            return null;
          }
        }

        function makeNodeId(prefix) {
          const randomPart = Math.random().toString(36).slice(2, 8);
          return prefix + '-' + Date.now().toString(36) + '-' + randomPart;
        }

        function nextNodePosition(nodes, fallbackX, fallbackY) {
          const count = Array.isArray(nodes) ? nodes.length : 0;
          return {
            x: Number.isFinite(fallbackX) ? fallbackX : 36 + ((count % 4) * 208),
            y: Number.isFinite(fallbackY) ? fallbackY : 36 + (Math.floor(count / 4) * 124),
          };
        }

        function commitStructuredUpdate(mutator) {
          const parsed = safeParseEditorValue();
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            vscode.postMessage({ type: 'showError', message: 'Fix the VFL document before inserting palette items or topology targets.' });
            return;
          }
          const nextValue = mutator(parsed) || parsed;
          const nextText = JSON.stringify(nextValue, null, 2) + '\n';
          editor.value = nextText;
          renderDiagnostics(nextText);
          renderWorkflowFromDocument(nextValue);
          postContent(nextText);
        }

        function ensureEdgesArray(value) {
          if (!Array.isArray(value.edges)) {
            value.edges = [];
          }
        }

        function upsertSeedObject(seedId) {
          commitStructuredUpdate((value) => {
            if (!value.catalog || typeof value.catalog !== 'object' || Array.isArray(value.catalog)) {
              value.catalog = {};
            }
            if (!Array.isArray(value.catalog.seedObjects)) {
              value.catalog.seedObjects = [];
            }
            if (!value.catalog.seedObjects.includes(seedId)) {
              value.catalog.seedObjects.push(seedId);
            }
            return value;
          });
        }

        function insertPaletteNode(item, position) {
          commitStructuredUpdate((value) => {
            if (!Array.isArray(value.nodes)) {
              value.nodes = [];
            }
            const pos = nextNodePosition(value.nodes, position?.x, position?.y);
            value.nodes.push({
              id: makeNodeId(item.kind || 'node'),
              kind: item.kind || 'service',
              type: item.type || '',
              label: item.label || item.name || item.id,
              sourceCatalogId: item.id || '',
              paletteSource: item.source || 'seeded',
              x: pos.x,
              y: pos.y,
            });
            if (item.id) {
              if (!value.catalog || typeof value.catalog !== 'object' || Array.isArray(value.catalog)) {
                value.catalog = {};
              }
              if (!Array.isArray(value.catalog.seedObjects)) {
                value.catalog.seedObjects = [];
              }
              if (!value.catalog.seedObjects.includes(item.id)) {
                value.catalog.seedObjects.push(item.id);
              }
            }
            return value;
          });
        }

        function insertTopologyTarget(target, position) {
          commitStructuredUpdate((value) => {
            if (!Array.isArray(value.nodes)) {
              value.nodes = [];
            }
            const pos = nextNodePosition(value.nodes, position?.x, position?.y);
            value.nodes.push({
              id: makeNodeId('target'),
              kind: 'device',
              type: 'topology-target',
              label: target.label,
              x: pos.x,
              y: pos.y,
              target: {
                nodeId: target.nodeId,
                ip: target.ip,
                services: target.services || [],
              },
            });
            return value;
          });
        }

        function bindSelectedWorkflowNodeToTarget(target) {
          if (!selectedWorkflowNodeId) {
            vscode.postMessage({ type: 'showError', message: 'Select a workflow node in the middle pane before binding a topology target.' });
            return;
          }
          commitStructuredUpdate((value) => {
            if (!Array.isArray(value.nodes)) {
              return value;
            }
            const selectedNode = value.nodes.find((node) => node.id === selectedWorkflowNodeId);
            if (!selectedNode) {
              return value;
            }
            selectedNode.target = {
              nodeId: target.nodeId,
              ip: target.ip,
              services: target.services || [],
            };
            selectedNode.targetBinding = {
              bindingType: 'topology-target',
              preferredTransport: Array.isArray(target.services) && target.services.length ? 'service-call' : 'message-broker-call',
              targetRef: target.nodeId,
              serviceCandidates: target.services || [],
            };
            return value;
          });
        }

        function deleteWorkflowNode(nodeId) {
          commitStructuredUpdate((value) => {
            if (!Array.isArray(value.nodes)) {
              return value;
            }
            value.nodes = value.nodes.filter((node) => node.id !== nodeId);
            if (Array.isArray(value.edges)) {
              value.edges = value.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
            }
            if (selectedWorkflowNodeId === nodeId) {
              selectedWorkflowNodeId = null;
            }
            if (edgeSourceNodeId === nodeId) {
              edgeSourceNodeId = null;
            }
            return value;
          });
        }

        function createEdgeFromSelection(targetNodeId) {
          if (!edgeSourceNodeId) {
            vscode.postMessage({ type: 'showError', message: 'Choose a source node first by clicking Link on a workflow node.' });
            return;
          }
          if (edgeSourceNodeId === targetNodeId) {
            vscode.postMessage({ type: 'showError', message: 'A node cannot connect to itself.' });
            return;
          }
          const edgeType = edgeTypeSelect.value || 'message-broker-call';
          commitStructuredUpdate((value) => {
            if (!Array.isArray(value.nodes)) {
              return value;
            }
            ensureEdgesArray(value);
            const exists = value.edges.some((edge) => edge.from === edgeSourceNodeId && edge.to === targetNodeId && edge.type === edgeType);
            if (!exists) {
              value.edges.push({
                id: makeNodeId('edge'),
                from: edgeSourceNodeId,
                to: targetNodeId,
                type: edgeType,
                label: edgeType,
              });
            }
            return value;
          });
          edgeSourceNodeId = null;
        }

        function updateNodePosition(nodeId, x, y) {
          commitStructuredUpdate((value) => {
            if (!Array.isArray(value.nodes)) {
              return value;
            }
            const selectedNode = value.nodes.find((node) => node.id === nodeId);
            if (!selectedNode) {
              return value;
            }
            selectedNode.x = x;
            selectedNode.y = y;
            return value;
          });
        }

        function renderPalette(items) {
          paletteList.innerHTML = '';
          if (!Array.isArray(items) || items.length === 0) {
            paletteList.innerHTML = '<div class="section-note">No palette items are available.</div>';
            return;
          }
          for (const item of items) {
            const card = document.createElement('div');
            card.className = 'catalog-item';
            card.draggable = true;
            card.innerHTML = '<div class="catalog-item-head"><div class="catalog-item-label">' + escapeHtml(item.label || item.name || item.id) + '</div><div class="catalog-item-kind">' + escapeHtml((item.kind || 'item') + ' · ' + (item.source || 'seeded')) + '</div></div><div class="catalog-item-description">' + escapeHtml(item.description || 'No description available.') + '</div><div class="catalog-item-actions"><button type="button">Add Node</button><button type="button">Seed Flow</button></div>';
            const buttons = card.querySelectorAll('button');
            buttons[0].addEventListener('click', () => insertPaletteNode(item));
            buttons[1].addEventListener('click', () => upsertSeedObject(item.id));
            card.addEventListener('dragstart', (event) => {
              card.classList.add('dragging');
              event.dataTransfer.setData('application/vnd.pulse.palette+json', JSON.stringify({ kind: 'palette', item }));
              event.dataTransfer.effectAllowed = 'copy';
            });
            card.addEventListener('dragend', () => {
              card.classList.remove('dragging');
            });
            paletteList.appendChild(card);
          }
        }

        function renderEdgeTypes() {
          edgeTypeList.innerHTML = '';
          for (const edgeType of ${JSON.stringify(EDGE_TYPES)}) {
            const card = document.createElement('div');
            const isActive = edgeTypeSelect.value === edgeType.id;
            card.className = 'catalog-item edge-item' + (isActive ? ' active' : '');
            const description = edgeType.id === 'message-broker-call'
              ? 'For broker-mediated message hops and queue-backed transitions.'
              : edgeType.id === 'file-feed'
                ? 'For batch drops, file-based ingress, exports, and scheduled feeds.'
                : 'For direct RPC-like or HTTP/service endpoint invocations.';
            card.innerHTML = '<div class="catalog-item-head"><div class="catalog-item-label">' + escapeHtml(edgeType.label) + '</div><div class="catalog-item-kind">edge type</div></div><div class="catalog-item-description">' + escapeHtml(description) + '</div><div class="catalog-item-actions"><button type="button">Make Active</button></div>';
            card.querySelector('button').addEventListener('click', () => {
              edgeTypeSelect.value = edgeType.id;
              renderEdgeTypes();
            });
            edgeTypeList.appendChild(card);
          }
        }

        function renderTopology(items) {
          topologyList.innerHTML = '';
          if (!Array.isArray(items) || items.length === 0) {
            topologyList.innerHTML = '<div class="section-note">No topology targets are currently available from the aggregator.</div>';
            return;
          }
          for (const item of items) {
            const services = Array.isArray(item.services) ? item.services : [];
            const card = document.createElement('div');
            card.className = 'catalog-item';
            card.draggable = true;
            card.innerHTML = '<div class="catalog-item-head"><div class="catalog-item-label">' + escapeHtml(item.label) + '</div><div class="catalog-item-kind">' + escapeHtml('target · ' + (item.ip || 'n/a')) + '</div></div><div class="catalog-item-description">' + escapeHtml(services.length ? services.slice(0, 5).join(', ') : 'No services described yet.') + '</div><div class="catalog-item-actions"><button type="button">Use As Target</button><button type="button">Bind Selected</button></div>';
            const buttons = card.querySelectorAll('button');
            buttons[0].addEventListener('click', () => insertTopologyTarget(item));
            buttons[1].addEventListener('click', () => bindSelectedWorkflowNodeToTarget(item));
            card.addEventListener('dragstart', (event) => {
              card.classList.add('dragging');
              event.dataTransfer.setData('application/vnd.pulse.palette+json', JSON.stringify({ kind: 'topology', item }));
              event.dataTransfer.effectAllowed = 'copy';
            });
            card.addEventListener('dragend', () => {
              card.classList.remove('dragging');
            });
            topologyList.appendChild(card);
          }
        }

        async function fetchJson(url) {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error('Request failed (' + response.status + ')');
          }
          return response.json();
        }

        function normalizeProviderPalette(payload) {
          const providers = Array.isArray(payload?.providers) ? payload.providers : Array.isArray(payload) ? payload : [];
          return providers.map((provider) => ({
            id: 'provider.' + (provider.id || 'unknown'),
            label: provider.name || provider.id || 'Provider',
            kind: ['platform', 'topology', 'queue', 'broker', 'librarian'].includes(String(provider.id || '').toLowerCase()) ? 'daemon' : 'service',
            type: String(provider.id || 'provider') + '-provider',
            source: 'aggregator',
            description: provider.description || 'Live provider model from the aggregator.',
          }));
        }

        function normalizeTopologyTargets(payload) {
          const nodes = Array.isArray(payload?.nodes) ? payload.nodes : Array.isArray(payload) ? payload : [];
          return nodes.map((node) => {
            const services = node?.capabilities && typeof node.capabilities === 'object' ? Object.keys(node.capabilities) : [];
            return {
              nodeId: node.id || node.nodeId || node.ip || 'node',
              label: node.name || node.nodeName || node.id || node.ip || 'Node',
              ip: node.ip || '',
              services,
            };
          });
        }

        async function hydratePaletteAndTopology() {
          renderPalette(seededPalette);
          renderTopology([]);
          try {
            const [providersPayload, topologyPayload] = await Promise.all([
              fetchJson(apiBase + '/api/platform/providers').catch(() => null),
              fetchJson(apiBase + '/api/nodes').catch(() => null),
            ]);
            const providerPalette = providersPayload ? normalizeProviderPalette(providersPayload) : [];
            const mergedPalette = [...seededPalette];
            for (const provider of providerPalette) {
              if (!mergedPalette.some((item) => item.id === provider.id)) {
                mergedPalette.push(provider);
              }
            }
            renderPalette(mergedPalette);
            renderTopology(topologyPayload ? normalizeTopologyTargets(topologyPayload) : []);
          } catch (error) {
            diagnostics.textContent = 'Palette hydration warning: ' + (error.message || String(error));
            diagnostics.classList.add('error');
          }
        }

        function updateSelectedWorkflowLabel(node) {
          if (!node) {
            selectedNodeLabel.textContent = 'No workflow node selected.';
            return;
          }
          const transport = node?.targetBinding?.preferredTransport ? ' · target via ' + node.targetBinding.preferredTransport : '';
          selectedNodeLabel.textContent = 'Selected: ' + (node.label || node.id || 'workflow node') + transport;
        }

        function nodeCenter(node) {
          const x = Number.isFinite(node.x) ? node.x : 32;
          const y = Number.isFinite(node.y) ? node.y : 32;
          return { x: x + 90, y: y + 34 };
        }

        function renderEdges(nodes, edges) {
          workflowEdges.innerHTML = '';
          const nodeById = new Map(nodes.map((node) => [node.id, node]));
          edges.forEach((edge, index) => {
            const fromNode = nodeById.get(edge.from);
            const toNode = nodeById.get(edge.to);
            if (!fromNode || !toNode) {
              return;
            }
            const start = nodeCenter(fromNode);
            const end = nodeCenter(toNode);
            const curve = Math.max(40, Math.abs(end.x - start.x) * 0.35);
            const d = 'M ' + start.x + ' ' + start.y + ' C ' + (start.x + curve) + ' ' + start.y + ', ' + (end.x - curve) + ' ' + end.y + ', ' + end.x + ' ' + end.y;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'workflow-edge-path');
            path.setAttribute('d', d);
            path.setAttribute('data-edge-index', String(index));
            workflowEdges.appendChild(path);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('class', 'workflow-edge-label');
            label.setAttribute('data-edge-index', String(index));
            label.setAttribute('x', String((start.x + end.x) / 2));
            label.setAttribute('y', String((start.y + end.y) / 2 - 6));
            label.setAttribute('text-anchor', 'middle');
            label.textContent = edge.label || edge.type || 'edge';
            workflowEdges.appendChild(label);
          });
        }

        function renderWorkflowFromDocument(value) {
          clearEdgeAnimation();
          const nodes = Array.isArray(value?.nodes) ? value.nodes : [];
          const edges = Array.isArray(value?.edges) ? value.edges : [];
          workflowStage.innerHTML = '';
          renderEdges(nodes, edges);
          workflowEmpty.style.display = nodes.length ? 'none' : 'flex';
          if (!nodes.length) {
            updateSelectedWorkflowLabel(null);
            return;
          }
          const selectedNode = nodes.find((node) => node.id === selectedWorkflowNodeId) || null;
          updateSelectedWorkflowLabel(selectedNode);
          for (const node of nodes) {
            const element = document.createElement('div');
            element.className = 'workflow-node' + (node.id === selectedWorkflowNodeId ? ' selected' : '');
            const x = Number.isFinite(node.x) ? node.x : 32;
            const y = Number.isFinite(node.y) ? node.y : 32;
            element.style.left = x + 'px';
            element.style.top = y + 'px';
            const targetSummary = node?.target?.nodeId ? ('Target: ' + node.target.nodeId + (node.target.ip ? ' @ ' + node.target.ip : '')) : 'Target: not bound';
            if (node.id === edgeSourceNodeId) {
              element.classList.add('is-link-source');
            }
            const boundTransport = node?.targetBinding?.preferredTransport ? ' · ' + node.targetBinding.preferredTransport : '';
            element.innerHTML = '<div class="workflow-node-head"><div class="workflow-node-label">' + escapeHtml(node.label || node.id || 'Node') + '</div><div class="workflow-node-kind">' + escapeHtml(node.kind || 'node') + '</div></div><div class="workflow-node-type">' + escapeHtml((node.type || 'untyped') + boundTransport) + '</div><div class="workflow-node-target">' + escapeHtml(targetSummary) + '</div><div class="workflow-node-actions"><button type="button">Select</button><button type="button">Link</button><button type="button">Delete</button></div>';
            const buttons = element.querySelectorAll('button');
            buttons[0].addEventListener('click', () => {
              selectedWorkflowNodeId = node.id;
              renderWorkflowFromDocument(safeParseEditorValue() || value);
            });
            buttons[1].addEventListener('click', () => {
              edgeSourceNodeId = node.id;
              selectedWorkflowNodeId = node.id;
              renderWorkflowFromDocument(safeParseEditorValue() || value);
            });
            buttons[2].addEventListener('click', () => deleteWorkflowNode(node.id));
            element.addEventListener('click', () => {
              if (edgeSourceNodeId && edgeSourceNodeId !== node.id) {
                createEdgeFromSelection(node.id);
                return;
              }
              selectedWorkflowNodeId = node.id;
              renderWorkflowFromDocument(safeParseEditorValue() || value);
            });
            element.addEventListener('pointerdown', (event) => {
              if (event.target.closest('button')) {
                return;
              }
              dragState = {
                nodeId: node.id,
                pointerId: event.pointerId,
                originX: event.clientX,
                originY: event.clientY,
                startX: x,
                startY: y,
              };
              element.setPointerCapture(event.pointerId);
            });
            element.addEventListener('pointermove', (event) => {
              if (!dragState || dragState.nodeId !== node.id || dragState.pointerId !== event.pointerId) {
                return;
              }
              const nextX = Math.max(16, dragState.startX + (event.clientX - dragState.originX));
              const nextY = Math.max(16, dragState.startY + (event.clientY - dragState.originY));
              element.style.left = nextX + 'px';
              element.style.top = nextY + 'px';
            });
            element.addEventListener('pointerup', (event) => {
              if (!dragState || dragState.nodeId !== node.id || dragState.pointerId !== event.pointerId) {
                return;
              }
              const nextX = Math.max(16, dragState.startX + (event.clientX - dragState.originX));
              const nextY = Math.max(16, dragState.startY + (event.clientY - dragState.originY));
              dragState = null;
              updateNodePosition(node.id, Math.round(nextX), Math.round(nextY));
            });
            element.addEventListener('pointercancel', () => {
              dragState = null;
            });
            workflowStage.appendChild(element);
          }
        }

        workflowCanvas.addEventListener('dragover', (event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        });

        workflowCanvas.addEventListener('drop', (event) => {
          event.preventDefault();
          const payloadText = event.dataTransfer.getData('application/vnd.pulse.palette+json');
          if (!payloadText) {
            return;
          }
          try {
            const payload = JSON.parse(payloadText);
            const rect = workflowStage.getBoundingClientRect();
            const position = {
              x: Math.max(16, Math.round(event.clientX - rect.left - 90)),
              y: Math.max(16, Math.round(event.clientY - rect.top - 24)),
            };
            if (payload.kind === 'palette') {
              insertPaletteNode(payload.item, position);
              return;
            }
            if (payload.kind === 'topology') {
              insertTopologyTarget(payload.item, position);
            }
          } catch (error) {
            vscode.postMessage({ type: 'showError', message: error.message || String(error) });
          }
        });

        editor.addEventListener('input', () => {
          renderDiagnostics(editor.value);
          const parsed = safeParseEditorValue();
          if (parsed) {
            renderWorkflowFromDocument(parsed);
          }
          if (applyingExternalUpdate) {
            return;
          }
          window.clearTimeout(debounceHandle);
          debounceHandle = window.setTimeout(() => postContent(editor.value), 150);
        });

        formatButton.addEventListener('click', () => {
          try {
            const parsed = JSON.parse(editor.value || '{}');
            const pretty = JSON.stringify(parsed, null, 2) + '\n';
            editor.value = pretty;
            renderDiagnostics(pretty);
            renderWorkflowFromDocument(parsed);
            postContent(pretty);
          } catch (error) {
            vscode.postMessage({ type: 'showError', message: error.message || String(error) });
          }
        });

        templateButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'resetTemplate' });
        });

        edgeTypeSelect.addEventListener('change', () => {
          renderEdgeTypes();
        });

        runAnimationButton.addEventListener('click', () => {
          runEdgePlayback();
        });

        window.addEventListener('message', (event) => {
          const message = event.data || {};
          if (message.type === 'replaceDocument' && typeof message.text === 'string') {
            applyingExternalUpdate = true;
            editor.value = message.text;
            renderDiagnostics(editor.value);
            const parsed = safeParseEditorValue();
            renderWorkflowFromDocument(parsed || defaultTemplate);
            applyingExternalUpdate = false;
          }
        });

        renderDiagnostics(editor.value);
        renderWorkflowFromDocument(safeParseEditorValue() || defaultTemplate);
        renderEdgeTypes();
        hydratePaletteAndTopology();
      </script>
    </body>
  </html>`
}

class CatalogStudioViewProvider {
  constructor(extensionUri) {
    this.extensionUri = extensionUri
  }

  resolveWebviewView(webviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    }
    webviewView.webview.html = getCatalogStudioHostHtml(webviewView.webview, this.extensionUri)
  }
}

class VflEditorProvider {
  constructor(context) {
    this.context = context
  }

  static register(context) {
    const provider = new VflEditorProvider(context)
    return vscode.window.registerCustomTextEditorProvider(VFL_EDITOR_VIEW_TYPE, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    })
  }

  async resolveCustomTextEditor(document, webviewPanel) {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    }

    let suppressUpdates = 0

    const render = () => {
      const parsed = parseVflText(document.getText())
      webviewPanel.webview.html = getVflEditorHtml(webviewPanel.webview, this.context.extensionUri, document, parsed)
    }

    const replaceDocumentText = async (nextText) => {
      const lastLine = document.lineAt(document.lineCount - 1)
      const fullRange = new vscode.Range(0, 0, document.lineCount - 1, lastLine.range.end.character)
      const edit = new vscode.WorkspaceEdit()
      edit.replace(document.uri, fullRange, nextText)
      suppressUpdates += 1
      try {
        await vscode.workspace.applyEdit(edit)
      } finally {
        suppressUpdates = Math.max(0, suppressUpdates - 1)
      }
    }

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== document.uri.toString()) {
        return
      }
      if (suppressUpdates > 0) {
        return
      }
      webviewPanel.webview.postMessage({ type: 'replaceDocument', text: event.document.getText() })
    })

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose()
    })

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === 'updateDocument' && typeof message.text === 'string') {
        await replaceDocumentText(message.text)
        return
      }
      if (message?.type === 'resetTemplate') {
        const nextText = getDefaultVflText()
        await replaceDocumentText(nextText)
        webviewPanel.webview.postMessage({ type: 'replaceDocument', text: nextText })
        return
      }
      if (message?.type === 'showError' && message.message) {
        vscode.window.showErrorMessage(String(message.message))
      }
    })

    render()
  }
}

function openCatalogStudioPanel(extensionUri) {
  const panel = vscode.window.createWebviewPanel(
    VIEW_TYPE,
    'Pulse Catalog Studio',
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
    },
  )
  panel.webview.html = getCatalogStudioHostHtml(panel.webview, extensionUri)
  return panel
}

async function createNewVflDocument() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Open a workspace folder before creating a Visual Flow Language document.')
    return
  }

  const defaultFolder = getDefaultVflFolder().replace(/\\/g, '/')
  const defaultExtension = getDefaultVflExtension().replace(/^\./, '')
  const targetUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(workspaceFolder.uri, defaultFolder, `new-visual-flow.${defaultExtension}`),
    filters: {
      'Visual Flow Language': [defaultExtension],
    },
    saveLabel: 'Create Visual Flow Document',
  })

  if (!targetUri) {
    return
  }

  const parentUri = vscode.Uri.file(path.dirname(targetUri.fsPath))
  await vscode.workspace.fs.createDirectory(parentUri)
  await vscode.workspace.fs.writeFile(targetUri, Buffer.from(getDefaultVflText(), 'utf8'))

  const document = await vscode.workspace.openTextDocument(targetUri)
  await vscode.commands.executeCommand('vscode.openWith', document.uri, VFL_EDITOR_VIEW_TYPE)
}

function activate(context) {
  const provider = new CatalogStudioViewProvider(context.extensionUri)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SIDEBAR_VIEW_TYPE, provider),
    vscode.commands.registerCommand('pulseCatalogStudio.open', () => openCatalogStudioPanel(context.extensionUri)),
    vscode.commands.registerCommand('pulseCatalogStudio.newVfl', () => createNewVflDocument()),
    VflEditorProvider.register(context),
  )
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
}
