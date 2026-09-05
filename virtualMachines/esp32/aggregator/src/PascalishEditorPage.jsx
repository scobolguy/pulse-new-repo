import React, { useEffect, useMemo, useRef, useState } from 'react'
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'))
import { initializePascalishLanguage } from './pascalishLanguage'
import { useLanguageStepper } from './useLanguageStepper'
import StepDebugPanel from './components/StepDebugPanel'

// Compile errors arrive as one blob; split them into per-line diagnostics.
// ANTLR reports 0-based columns, so shift to Monaco's 1-based columns.
function parseCompileDiagnostics(rawText) {
  const diagnostics = []
  for (const rawLine of String(rawText || '').split('\n')) {
    const match = /line\s+(\d+):(\d+)\s+(.*)$/i.exec(rawLine.trim())
    if (!match) continue
    diagnostics.push({
      line: Math.max(1, Number.parseInt(match[1], 10) || 1),
      column: Math.max(1, (Number.parseInt(match[2], 10) || 0) + 1),
      message: String(match[3] || '').trim(),
    })
  }
  return diagnostics
}

function offendingTokenLength(message) {
  const match = /(?:input|at:|token recognition error at:)\s*'((?:[^'\\]|\\.)*)'/i.exec(String(message || ''))
  return match ? Math.max(1, match[1].length) : 0
}

const DEFAULT_PROGRAM = [
  'daemon "librarian-aware-demo" refresh 2 s;',
  'role code_librarian;',
  'library "payments-common" from librarian;',
  'use "payments-common" as payments;',
  'interop wfl "pain2-routing" as routingFlow;',
  '',
  'var myLegacyMessage : envelope<swift-mt103> from librarian;',
  '',
  'router "mt103-route" input "swift.mt103.inbound" description "Route MT103" enabled true begin',
  '  output "swift.mt103.parsed"',
  '    when "output := 1;"',
  '    transform "output := src;";',
  'end;',
].join('\n')

export default function PascalishEditorPage() {
  const [source, setSource] = useState(DEFAULT_PROGRAM)
  const [types, setTypes] = useState([])
  const [status, setStatus] = useState('Loading Librarian types...')
  const [runMenuOpen, setRunMenuOpen] = useState(false)
  const [runBusy, setRunBusy] = useState(false)
  const [runError, setRunError] = useState('')
  const [diagnostics, setDiagnostics] = useState([])
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const typeNamesRef = useRef([])
  const typeFieldMapRef = useRef({})
  const mapNamesRef = useRef([])
  const { stepTabs, activeStepTab, stepLog, singleStep, selectStepTab } = useLanguageStepper('pascalish', editorRef)

  const typeNames = useMemo(() => {
    return (types || [])
      .map((item) => String(item?.id || item?.name || item?.typeName || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  }, [types])

  useEffect(() => {
    typeNamesRef.current = typeNames
  }, [typeNames])

  useEffect(() => {
    let cancelled = false
    fetch('/api/mapper/maps/names')
      .then((r) => r.ok ? r.json() : { maps: [] })
      .then((data) => { if (!cancelled) mapNamesRef.current = Array.isArray(data.maps) ? data.maps : [] })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    function collectPathsFromSchemaNode(node, prefix = '', out = []) {
      if (!node || typeof node !== 'object') return out
      const rawName = String(node.name || '').trim()
      const normalizedName = rawName && rawName !== 'root' ? rawName : ''
      const nextPrefix = normalizedName
        ? (prefix ? `${prefix}.${normalizedName}` : normalizedName)
        : prefix
      if (nextPrefix) out.push(nextPrefix)
      for (const child of Array.isArray(node.children) ? node.children : []) {
        collectPathsFromSchemaNode(child, nextPrefix, out)
      }
      return out
    }

    function buildTypeFieldMap(schemas) {
      const map = {}
      for (const schema of Array.isArray(schemas) ? schemas : []) {
        const typeId = String(schema?.typeId || '').trim().toLowerCase()
        if (!typeId) continue
        if (!map[typeId]) map[typeId] = new Set()
        for (const fieldPath of collectPathsFromSchemaNode(schema?.structure, '')) {
          if (fieldPath) map[typeId].add(fieldPath)
        }
      }
      const output = {}
      for (const [typeId, setValues] of Object.entries(map)) {
        output[typeId] = Array.from(setValues).sort((a, b) => a.localeCompare(b))
      }
      return output
    }

    async function loadTypes() {
      try {
        const [typesResponse, schemasResponse] = await Promise.all([
          fetch('/api/librarian/data-types'),
          fetch('/api/librarian/schemas'),
        ])
        const typePayload = await typesResponse.json().catch(() => ({}))
        const schemaPayload = await schemasResponse.json().catch(() => ({}))
        if (cancelled) return
        if (!typesResponse.ok) {
          setStatus(`Failed to load types (${typesResponse.status}).`)
          return
        }
        const nextTypes = Array.isArray(typePayload.types) ? typePayload.types : []
        const schemas = schemasResponse.ok && Array.isArray(schemaPayload.schemas) ? schemaPayload.schemas : []
        typeFieldMapRef.current = buildTypeFieldMap(schemas)
        setTypes(nextTypes)
        setStatus(`Loaded ${nextTypes.length} types and ${schemas.length} schemas.`)
      } catch (error) {
        if (!cancelled) setStatus(`Type load failed: ${error.message}`)
      }
    }

    loadTypes()
    const timer = setInterval(loadTypes, 15000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  async function runPascalishAction(mode) {
    setRunMenuOpen(false)
    setRunBusy(true)
    try {
      const response = await fetch('/api/develop/compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: source, mode }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || `Pascalish action failed (${response.status}).`)
      }
      const compile = payload.compile || {}
      const baseMessage = `Compiled: ${Number(compile.routers || 0)} router(s), ${Number(compile.mappings || 0)} mapping(s).`
      if (mode === 'compile-run') {
        setStatus(`${baseMessage} Runtime artifacts updated.`)
      } else if (mode === 'compile-debug') {
        setStatus(`${baseMessage} Opening debugger...`)
        window.dispatchEvent(new CustomEvent('pulse:open-debugger', {
          detail: { fsmId: payload?.debug?.fsmId || 'startup-fsm' },
        }))
      } else {
        setStatus(baseMessage)
      }
      setRunError('')
      setDiagnostics([])
    } catch (errorValue) {
      const parsed = parseCompileDiagnostics(errorValue.message)
      setDiagnostics(parsed)
      // Keep the raw banner only when there is no line-level detail to show inline.
      setRunError(parsed.length > 0 ? '' : errorValue.message)
    } finally {
      setRunBusy(false)
    }
  }

  useEffect(() => {
    const monaco = monacoRef.current
    const model = editorRef.current?.getModel?.()
    if (!monaco || !model) return

    monaco.editor.setModelMarkers(model, 'pascalish-compile', diagnostics.map((item) => {
      const lineLength = model.getLineMaxColumn(Math.min(item.line, model.getLineCount()))
      const tokenLength = offendingTokenLength(item.message)
      const endColumn = tokenLength > 0
        ? Math.min(item.column + tokenLength, lineLength)
        : lineLength
      return {
        severity: monaco.MarkerSeverity.Error,
        message: item.message,
        startLineNumber: item.line,
        endLineNumber: item.line,
        startColumn: item.column,
        endColumn: Math.max(endColumn, item.column + 1),
      }
    }))
  }, [diagnostics])

  function goToDiagnostic(item) {
    const editor = editorRef.current
    if (!editor) return
    editor.revealLineInCenter(item.line)
    editor.setPosition({ lineNumber: item.line, column: item.column })
    editor.focus()
  }

  useEffect(() => {
    function handleRunShortcut(event) {
      if (runBusy) return
      if (event.key !== 'F7') return
      const activeTag = String(document?.activeElement?.tagName || '').toLowerCase()
      if (activeTag === 'input' || activeTag === 'textarea') return
      event.preventDefault()
      if (event.shiftKey) { runPascalishAction('compile-debug'); return }
      if (event.ctrlKey || event.metaKey) { runPascalishAction('compile-run'); return }
      runPascalishAction('compile')
    }
    window.addEventListener('keydown', handleRunShortcut)
    return () => window.removeEventListener('keydown', handleRunShortcut)
  }, [runBusy, source])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => runPascalishAction('compile')} disabled={runBusy}>Compile</button>
            <button type="button" onClick={() => runPascalishAction('compile-run')} disabled={runBusy}>Compile &amp; Run</button>
            <button type="button" onClick={() => runPascalishAction('compile-debug')} disabled={runBusy}>Compile &amp; Debug</button>
            <button type="button" onClick={() => setStatus(singleStep(source))} disabled={runBusy}>Single Step</button>
          </div>
          <span style={{ fontSize: 12, opacity: 0.75 }}>{status}</span>
        </div>
        <span style={{ fontSize: 11, opacity: 0.55 }}>F7 compile · Ctrl+F7 run · Shift+F7 debug</span>
      </div>

      {runError && (
        <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', color: '#fca5a5', fontSize: 12 }}>
          {runError}
        </div>
      )}

      <StepDebugPanel
        stepTabs={stepTabs}
        activeStepTab={activeStepTab}
        onSelectTab={selectStepTab}
        stepLog={stepLog}
        tabListLabel="Pascalish execution tabs"
        monacoLanguage="pascalish"
        testIdPrefix="pascalish"
      />

      <div style={{ flex: 1, minHeight: 0, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 6, overflow: 'hidden' }}>
        <React.Suspense fallback={<div style={{ padding: 20, opacity: 0.6 }}>Loading editor…</div>}>
          <MonacoEditor
            height="100%"
            language="pascalish"
            theme="pascalishWorkbench"
            value={source}
            onChange={(value) => setSource(value || '')}
            beforeMount={(monaco) => initializePascalishLanguage(monaco, typeNamesRef, typeFieldMapRef, mapNamesRef)}
            onMount={(editor, monaco) => { editorRef.current = editor; monacoRef.current = monaco }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineHeight: 22,
              wordWrap: 'on',
              smoothScrolling: true,
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              formatOnType: false,
            }}
          />
        </React.Suspense>
      </div>

      <div style={{ fontSize: 11, opacity: 0.55 }}>
        Tip: <code>var myMsg : swift-mt103 from librarian;</code> — type declarations autocomplete Librarian types.
        {typeNames.length > 0 && (
          <> &nbsp;·&nbsp; Types: {typeNames.slice(0, 10).join(', ')}{typeNames.length > 10 ? ` +${typeNames.length - 10} more` : ''}</>
        )}
      </div>

      {diagnostics.length > 0 && (
        <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 6 }}>
          <div style={{ padding: '6px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.7, borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
            Problems ({diagnostics.length})
          </div>
          {diagnostics.map((item, index) => (
            <div
              key={`${item.line}-${item.column}-${index}`}
              role="button"
              tabIndex={0}
              onClick={() => goToDiagnostic(item)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); goToDiagnostic(item) } }}
              style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}
            >
              <span style={{ color: '#f87171' }}>✖</span>
              <span style={{ flex: 1, minWidth: 0 }}>{item.message}</span>
              <span style={{ opacity: 0.55, whiteSpace: 'nowrap' }}>Ln {item.line}, Col {item.column}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
