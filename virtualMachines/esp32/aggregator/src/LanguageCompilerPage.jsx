import React, { useRef, useState } from 'react'
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'))
import { initializePascalishLanguage } from './pascalishLanguage'
import { useLanguageStepper } from './useLanguageStepper'
import StepDebugPanel from './components/StepDebugPanel'
import { MNF_STARTER, getDocumentTypeById } from './documentRegistry'

const LANGUAGE_CONFIG = {
  csharp: {
    label: 'C# (ECMA-334 subset)',
    fileName: 'program.cs',
    monacoLanguage: 'csharp',
    source: getDocumentTypeById('csharp').starterContent
  },
  mnf: {
    label: 'Minnesota FORTRAN (MNF)',
    fileName: 'program.ftn',
    monacoLanguage: 'mnf',
    source: MNF_STARTER
  },
  cobolish: {
    label: 'COBOLISH',
    fileName: 'program.cob',
    monacoLanguage: 'cobolish',
    source: [
      'IDENTIFICATION DIVISION.',
      'PROGRAM-ID. PAYMENTS-CORE.',
      'PULSE SERVICE "payments-core" ON LOCAL.',
      'PROCEDURE DIVISION.',
      '    INTEROP PASCALISH "router-mapper" AS ROUTER-MAPPER.',
      '    PERFORM ANNOUNCE-READY.',
      '    GOBACK.',
      'ANNOUNCE-READY.',
      '    DISPLAY "PAYMENTS READY".',
      'END PROGRAM PAYMENTS-CORE.'
    ].join('\n')
  },
  vbish: {
    label: 'VBish',
    fileName: 'program.vbs',
    monacoLanguage: 'vbish',
    source: [
      'Program "fibonacci-series"',
      '',
      'Sub Main()',
      '  Dim i As Integer',
      '  Dim a As Integer',
      '  Dim b As Integer',
      '  Dim temp As Integer',
      '  ',
      '  a = 0',
      '  b = 1',
      '  Print "Fib(1) = 1"',
      '  ',
      '  For i = 2 To 10',
      '    temp = a + b',
      '    a = b',
      '    b = temp',
      '    Print "Fib(", i, ") = ", b',
      '  Next i',
      'End Sub'
    ].join('\n')
  }
}

export default function LanguageCompilerPage({ languageId }) {
  const config = LANGUAGE_CONFIG[languageId]
  const [source, setSource] = useState(config.source)
  const [status, setStatus] = useState('Ready')
  const [error, setError] = useState('')
  const [runResult, setRunResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const editorRef = useRef(null)
  const editorInitializedRef = useRef(false)
  const { stepTabs, activeStepTab, stepLog, debugState, singleStep, selectStepTab } = useLanguageStepper(languageId, editorRef)

  async function compile(mode = 'compile') {
    setBusy(true)
    try {
      const response = await fetch('/api/develop/compile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: config.fileName, content: source, mode })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `${config.label} compilation failed (${response.status}).`)
      const summary = payload.compile || {}
      const result = payload.run || null
      setRunResult(result)
      setStatus(result
        ? `Ran ${summary.runtimeKind || 'program'} ${summary.programId || ''}; ${result.stdout?.length || 0} output line(s), ${result.deliveries?.length || 0} delivery(s).`
        : `Compiled ${summary.runtimeKind || 'program'} ${summary.programId || ''}; ${Number(summary.interop || 0)} interop declaration(s).`)
      setError('')
    } catch (errorValue) {
      setError(errorValue.message)
    } finally {
      setBusy(false)
    }
  }

  function handleSingleStep() {
    setStatus(singleStep(source))
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => compile()} disabled={busy}>Compile</button>
        <button type="button" onClick={() => compile('compile-run')} disabled={busy}>Compile &amp; Run</button>
        {!['mnf', 'csharp'].includes(languageId) && <button type="button" onClick={handleSingleStep} disabled={busy}>Single Step</button>}
        <span style={{ fontSize: 12, opacity: 0.75 }}>{status}</span>
      </div>
      {languageId === 'mnf' && <div style={{ fontSize: 12 }}>Fixed form: labels 1-5 | continuation 6 | statements 7-72 | sequence field 73-80. Use spaces, not tabs.</div>}
      {languageId === 'csharp' && <div style={{ fontSize: 12 }}>ECMA-334 subset: int, bool, string, control flow, static methods and generic methods. JavaScript p-machine target.</div>}
      {error && <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', color: '#fca5a5', fontSize: 12 }}>{error}</div>}
      {runResult && (
        <div data-testid="language-runtime-output" style={{ height: 150, minHeight: 150, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 6, overflow: 'hidden' }}>
          <React.Suspense fallback={<div style={{ padding: 12, opacity: 0.6 }}>Loading runtime output...</div>}>
            <MonacoEditor
              height="100%"
              language="json"
              theme="pascalishWorkbench"
              value={JSON.stringify(runResult, null, 2)}
              options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', wordWrap: 'on', automaticLayout: true }}
            />
          </React.Suspense>
        </div>
      )}
      {!['mnf', 'csharp'].includes(languageId) && <StepDebugPanel
        stepTabs={stepTabs}
        activeStepTab={activeStepTab}
        onSelectTab={selectStepTab}
        stepLog={stepLog}
        debugState={debugState}
        tabListLabel={`${config.label} execution tabs`}
        testIdPrefix={languageId}
      />}
      <div style={{ flex: 1, minHeight: 320, height: '60vh', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 6, overflow: 'hidden' }}>
        <React.Suspense fallback={<div style={{ padding: 20, opacity: 0.6 }}>Loading editor...</div>}>
          <MonacoEditor
            height="100%"
            language={config.monacoLanguage}
            theme="pascalishWorkbench"
            value={source}
            onChange={(value) => {
              if (!editorInitializedRef.current && !value) return
              setSource(value || '')
            }}
            onMount={(editor) => {
              editorRef.current = editor
              if (!editor.getValue().trim() && config.source) {
                editor.setValue(config.source)
                setSource(config.source)
              }
              editorInitializedRef.current = true
            }}
            beforeMount={(monaco) => initializePascalishLanguage(monaco)}
            options={{
              minimap: { enabled: false }, fontSize: 13, automaticLayout: true,
              wordWrap: languageId === 'mnf' ? 'off' : 'on',
              ...(languageId === 'mnf' ? { rulers: [5, 6, 72, 80], insertSpaces: true, tabSize: 6, autoIndent: 'none' } : {})
            }}
          />
        </React.Suspense>
      </div>
    </div>
  )
}