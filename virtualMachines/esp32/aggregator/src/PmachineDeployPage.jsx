import { useEffect, useMemo, useState } from 'react'

const PROGRAMS = [
  {
    id: 'hello',
    label: 'Hello from PMachine',
    source: [
      'program PmachineHello;',
      'begin',
      "  writeln('Hello from PMachine');",
      'end.',
    ].join('\n'),
  },
  {
    id: 'hanoi',
    label: 'Towers of Hanoi',
    source: [
      'program "towers-of-hanoi";',
      '',
      'var',
      '  diskCount: integer;',
      '',
      'procedure Hanoi(n, fromPeg, toPeg, auxPeg: integer);',
      'begin',
      '  if n = 1 then',
      "    writeln('Move disk ', n, ' from ', fromPeg, ' to ', toPeg)",
      '  else',
      '  begin',
      '    Hanoi(n - 1, fromPeg, auxPeg, toPeg);',
      "    writeln('Move disk ', n, ' from ', fromPeg, ' to ', toPeg);",
      '    Hanoi(n - 1, auxPeg, toPeg, fromPeg)',
      '  end',
      'end;',
      '',
      'begin',
      '  diskCount := 5;',
      "  writeln('Towers of Hanoi for ', diskCount, ' disks:');",
      '  Hanoi(diskCount, 1, 3, 2)',
      'end.',
    ].join('\n'),
  },
]

function nodeLabel(node) {
  return String(node?.nodeName || node?.name || node?.nodeId || node?.id || node?.ip || '').trim()
}

function nodeId(node) {
  return String(node?.nodeId || node?.id || node?.nodeName || node?.ip || '').trim()
}

function nodeAddress(node) {
  return String(node?.ip || node?.address || '').trim()
}

function readNodes(payload) {
  const candidates = Array.isArray(payload) ? payload : payload?.nodes
  return Array.isArray(candidates) ? candidates.filter((node) => {
    if (!nodeAddress(node)) return false
    const services = node?.details?.services || node?.services || []
    return Array.isArray(services) && services.some((service) => {
      const name = typeof service === 'string' ? service : service?.name || service?.serviceName
      return String(name || '').trim().toLowerCase().includes('pmachine')
    })
  }) : []
}

export default function PmachineDeployPage() {
  const [programId, setProgramId] = useState('hello')
  const [source, setSource] = useState(PROGRAMS[0].source)
  const [nodes, setNodes] = useState([])
  const [targetNode, setTargetNode] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Loading ESP32 nodes...')
  const [output, setOutput] = useState([])
  const [result, setResult] = useState(null)
  const [debugSession, setDebugSession] = useState(null)
  const [debugSnapshot, setDebugSnapshot] = useState(null)
  const [debugBusy, setDebugBusy] = useState(false)
  const [breakpointLines, setBreakpointLines] = useState([])
  const [sourceScrollTop, setSourceScrollTop] = useState(0)
  const [memoryTab, setMemoryTab] = useState('globals')

  const sourceLines = useMemo(() => source.split('\n'), [source])
  const currentSourceLine = Number(debugSession?.sourceMap?.[String(debugSnapshot?.pc)]?.sourceLine || 0)

  const selectedNode = useMemo(
    () => nodes.find((node) => nodeId(node) === targetNode),
    [nodes, targetNode],
  )

  useEffect(() => {
    let cancelled = false
    fetch('/api/pmachine/nodes')
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error || `Node lookup failed (${response.status})`)
        return readNodes(payload)
      })
      .then((nextNodes) => {
        if (cancelled) return
        setNodes(nextNodes)
        const firstNode = nextNodes[0]
        if (firstNode) {
          setTargetNode(nodeId(firstNode))
          setStatus(`${nextNodes.length} PMachine node${nextNodes.length === 1 ? '' : 's'} available.`)
        } else {
          setStatus('No PMachine node is available.')
        }
      })
      .catch((error) => { if (!cancelled) setStatus(`Could not load PMachine nodes: ${error.message}`) })
    return () => { cancelled = true }
  }, [])

  function chooseProgram(event) {
    const nextProgram = PROGRAMS.find((program) => program.id === event.target.value)
    if (!nextProgram) return
    setProgramId(nextProgram.id)
    setSource(nextProgram.source)
    setOutput([])
    setResult(null)
    setDebugSnapshot(null)
    setDebugSession(null)
    setBreakpointLines([])
    setStatus(`${nextProgram.label} loaded.`)
  }

  async function debugApi(url, options = {}) {
    const response = await fetch(url, options)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error || `Debug request failed (${response.status})`)
    return payload
  }

  async function readDebugState(sessionId, host = nodeAddress(selectedNode)) {
    const params = new URLSearchParams({ host, sessionId })
    const payload = await debugApi(`/api/pmachine/debug/esp32/session?${params}`)
    setDebugSnapshot(payload.state)
    return payload.state
  }

  async function waitForDebugStop(sessionId, host) {
    let snapshot = null
    for (let attempt = 0; attempt < 100; attempt += 1) {
      snapshot = await readDebugState(sessionId, host)
      if (snapshot.status !== 'running' && snapshot.status !== 'starting') return snapshot
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return snapshot
  }

  async function startDebugSession() {
    if (!selectedNode) return setStatus('Select a PMachine node before debugging.')
    if (!source.trim()) return setStatus('Program source is required.')
    setDebugBusy(true)
    setDebugSnapshot(null)
    setStatus(`Starting debug session on ${nodeLabel(selectedNode)}...`)
    try {
      const host = nodeAddress(selectedNode)
      const payload = await debugApi('/api/pmachine/debug/esp32/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          host,
          source,
          sourceFileName: `${programId}.pas`,
          sourceBreakpoints: breakpointLines,
          maxBytes: 65536,
        }),
      })
      const session = { ...payload.session, sourceMap: payload.sourceMap || {} }
      setDebugSession(session)
      const snapshot = await waitForDebugStop(session.sessionId, host)
      setStatus(`Debug ${snapshot.status} at instruction ${snapshot.pc} on ${nodeLabel(selectedNode)}.`)
    } catch (error) {
      setStatus(`Debug start failed: ${error.message}`)
    } finally {
      setDebugBusy(false)
    }
  }

  async function controlDebugSession(action, pc = null) {
    if (!debugSession || !selectedNode) return
    setDebugBusy(true)
    try {
      const payload = await debugApi(`/api/pmachine/debug/esp32/session/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          host: nodeAddress(selectedNode),
          sessionId: debugSession.sessionId,
          ...(pc == null ? {} : { pc }),
        }),
      })
      if (payload.state) setDebugSnapshot(payload.state)
      if (['step', 'stepin', 'stepout', 'continue', 'pause'].includes(action)) {
        const snapshot = await waitForDebugStop(debugSession.sessionId, nodeAddress(selectedNode))
        setStatus(`Debug ${snapshot.status} at instruction ${snapshot.pc} on ${nodeLabel(selectedNode)}.`)
      } else if (payload.state) {
        setStatus(`Breakpoint ${action === 'breakpoint-set' ? 'set' : 'cleared'} at instruction ${pc}.`)
      }
    } catch (error) {
      setStatus(`Debug action failed: ${error.message}`)
    } finally {
      setDebugBusy(false)
    }
  }

  async function stopDebugSession() {
    if (!debugSession || !selectedNode) return
    setDebugBusy(true)
    try {
      const params = new URLSearchParams({ host: nodeAddress(selectedNode), sessionId: debugSession.sessionId })
      await debugApi(`/api/pmachine/debug/esp32/session?${params}`, { method: 'DELETE' })
      setDebugSession(null)
      setDebugSnapshot(null)
      setStatus('Debug session stopped.')
    } catch (error) {
      setStatus(`Debug stop failed: ${error.message}`)
    } finally {
      setDebugBusy(false)
    }
  }

  async function toggleBreakpoint(sourceLine) {
    const clearing = breakpointLines.includes(sourceLine)
    const nextLines = clearing
      ? breakpointLines.filter((line) => line !== sourceLine)
      : [...breakpointLines, sourceLine].sort((left, right) => left - right)
    setBreakpointLines(nextLines)
    setStatus(`${clearing ? 'Cleared' : 'Set'} breakpoint on source line ${sourceLine}.`)
    if (!debugSession) return

    const pcs = Object.entries(debugSession.sourceMap || {})
      .filter(([, entry]) => Number(entry?.sourceLine) === sourceLine)
      .map(([pc]) => Number(pc))
      .filter(Number.isInteger)
    if (pcs.length === 0) {
      setStatus(`No instruction maps to source line ${sourceLine}.`)
      return
    }
    for (const pc of pcs) {
      await controlDebugSession(clearing ? 'breakpoint-clear' : 'breakpoint-set', pc)
    }
  }

  async function runOnEsp32() {
    if (!source.trim()) {
      setStatus('Program source is required.')
      return
    }
    if (!selectedNode) {
      setStatus('Select a PMachine node before running.')
      return
    }
    setBusy(true)
    setOutput([])
    setResult(null)
    setStatus(`Compiling and running on ${nodeLabel(selectedNode)}...`)
    try {
      const response = await fetch('/api/pmachine/deploy-and-run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source,
          sourceFileName: `${programId}.pas`,
          runtime: 'esp32',
          targetNodeId: nodeId(selectedNode),
          inputQueue: 'pmachine.ui',
          message: '',
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || `ESP32 run failed (${response.status})`)
      const runResult = payload?.result?.result || payload?.result || payload
      const lines = Array.isArray(runResult?.stdout) ? runResult.stdout : []
      setOutput(lines)
      setResult(runResult)
      setStatus(`Run complete on ${nodeLabel(selectedNode)}. ${lines.length} output line${lines.length === 1 ? '' : 's'} captured.`)
    } catch (error) {
      setStatus(`Run failed: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pmachine-runner">
      <section className="pmachine-hero">
        <div>
          <span className="pmachine-kicker">ESP32 / PMACHINE</span>
          <h2>Run Pascal on the edge</h2>
          <p>Compile the program here, send it to a registered ESP32, and inspect its output.</p>
        </div>
        <div className={`pmachine-connection ${selectedNode ? 'ready' : ''}`}>
          <span className="pmachine-connection-dot" />
          {selectedNode ? `READY · ${nodeAddress(selectedNode)}` : 'NO TARGET'}
        </div>
      </section>

      <section className="pmachine-run-grid">
        <div className="pmachine-editor-panel">
          <div className="pmachine-panel-heading pmachine-editor-heading">
            <div className="pmachine-editor-title">
              <div><span className="pmachine-overline">SOURCE</span><h3>Pascal program</h3></div>
              <label className="pmachine-select-label">
                <span className="sr-only">Program example</span>
                <select value={programId} onChange={chooseProgram} disabled={busy || debugBusy || Boolean(debugSession)}>
                  {PROGRAMS.map((program) => <option key={program.id} value={program.id}>{program.label}</option>)}
                </select>
              </label>
            </div>
            <div className="pmachine-debug-toolbar" role="toolbar" aria-label="Debug controls">
              <button type="button" className="pmachine-tool-button primary" onClick={() => void startDebugSession()} disabled={busy || debugBusy || Boolean(debugSession) || !selectedNode}>Start Debug</button>
              <button type="button" className="pmachine-tool-button" onClick={() => void controlDebugSession('step')} disabled={debugBusy || !debugSession || debugSnapshot?.status !== 'paused'}>Step</button>
              <button type="button" className="pmachine-tool-button" onClick={() => void controlDebugSession('stepin')} disabled={debugBusy || !debugSession || debugSnapshot?.status !== 'paused'}>Step In</button>
              <button type="button" className="pmachine-tool-button" onClick={() => void controlDebugSession('stepout')} disabled={debugBusy || !debugSession || debugSnapshot?.status !== 'paused' || Number(debugSnapshot?.callDepth || 0) === 0}>Step Out</button>
              <button type="button" className="pmachine-tool-button" onClick={() => void controlDebugSession('continue')} disabled={debugBusy || !debugSession || debugSnapshot?.status !== 'paused'}>Continue</button>
              <button type="button" className="pmachine-tool-button" onClick={() => void controlDebugSession('pause')} disabled={debugBusy || !debugSession || debugSnapshot?.status !== 'running'}>Pause</button>
              <button type="button" className="pmachine-tool-button danger" onClick={() => void stopDebugSession()} disabled={debugBusy || !debugSession}>Stop</button>
              <span className="pmachine-debug-indicator" aria-live="polite">{debugSession ? `${String(debugSnapshot?.status || debugSession.status).toUpperCase()} · PC ${debugSnapshot?.pc ?? debugSession.pc}` : 'DEBUG IDLE'}</span>
            </div>
          </div>
          <div className="pmachine-source-frame">
            <div className="pmachine-breakpoint-gutter" aria-label="Source breakpoints" style={{ transform: `translateY(-${sourceScrollTop}px)` }}>
              {sourceLines.map((_, index) => {
                const line = index + 1
                const hasBreakpoint = breakpointLines.includes(line)
                const isCurrent = currentSourceLine === line
                return (
                  <button
                    key={line}
                    type="button"
                    className={`pmachine-gutter-line${hasBreakpoint ? ' breakpoint' : ''}${isCurrent ? ' current' : ''}`}
                    aria-label={`${hasBreakpoint ? 'Clear' : 'Set'} breakpoint on line ${line}`}
                    aria-pressed={hasBreakpoint}
                    title={`${hasBreakpoint ? 'Clear' : 'Set'} breakpoint on line ${line}`}
                    disabled={busy || debugBusy}
                    onClick={() => void toggleBreakpoint(line)}
                  >
                    <span className="pmachine-gutter-marker">{hasBreakpoint ? '*' : isCurrent ? '>' : ''}</span>
                    <span>{line}</span>
                  </button>
                )
              })}
            </div>
            <textarea
              className="pmachine-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              onScroll={(event) => setSourceScrollTop(event.currentTarget.scrollTop)}
              spellCheck="false"
              disabled={busy || debugBusy || Boolean(debugSession)}
              aria-label="Pascal program source"
            />
          </div>
        </div>

        <aside className="pmachine-control-panel">
          <div className="pmachine-panel-heading compact">
            <div><span className="pmachine-overline">TARGET</span><h3>Execution node</h3></div>
            <span className="pmachine-chip">ESP32</span>
          </div>
          <label className="pmachine-field">
            <span>Registered node</span>
            <select value={targetNode} onChange={(event) => setTargetNode(event.target.value)} disabled={busy || debugBusy || Boolean(debugSession)}>
              <option value="">Select an ESP32</option>
              {nodes.map((node) => <option key={nodeId(node)} value={nodeId(node)}>{nodeLabel(node)} · {nodeAddress(node)}</option>)}
            </select>
          </label>
          <div className="pmachine-target-card">
            <span className="pmachine-target-label">ADDRESS</span>
            <strong>{nodeAddress(selectedNode) || 'Waiting for target'}</strong>
            <span>{selectedNode ? nodeLabel(selectedNode) : 'No PMachine target available'}</span>
          </div>
          <button className="pmachine-run-button" type="button" disabled={busy || debugBusy || Boolean(debugSession) || !selectedNode} onClick={() => void runOnEsp32()}>
            <span className="pmachine-run-icon">{busy ? '...' : '>'}</span>
            {busy ? 'Running on ESP32' : 'Run on ESP32'}
          </button>
          <p className="pmachine-status" role="status">{status}</p>
        </aside>
      </section>

      <section className="pmachine-memory-panel" aria-label="PMachine memory inspector">
        <div className="pmachine-memory-heading">
          <div><span className="pmachine-overline">DEBUG INSPECTOR</span><h3>Execution memory</h3></div>
          <div className="pmachine-memory-tabs" role="tablist" aria-label="Memory view">
            <button type="button" role="tab" aria-selected={memoryTab === 'globals'} onClick={() => setMemoryTab('globals')}>Globals</button>
            <button type="button" role="tab" aria-selected={memoryTab === 'locals'} onClick={() => setMemoryTab('locals')}>Locals</button>
          </div>
        </div>
        <div className="pmachine-memory-meta">
          {debugSnapshot ? `PC ${debugSnapshot.pc} · call depth ${debugSnapshot.callDepth} · ${debugSnapshot.status}` : 'Start a debug session to inspect values.'}
        </div>
        <div className="pmachine-memory-table-wrap">
          {Object.entries(debugSnapshot?.[memoryTab] || {}).length > 0 ? (
            <table className="pmachine-memory-table">
              <thead><tr><th scope="col">Name</th><th scope="col">Value</th></tr></thead>
              <tbody>
                {Object.entries(debugSnapshot[memoryTab]).map(([name, value]) => (
                  <tr key={name}><th scope="row">{name}</th><td>{String(value)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <div className="pmachine-memory-empty">No {memoryTab} values in this snapshot.</div>}
        </div>
      </section>

      <section className="pmachine-output-panel">
        <div className="pmachine-panel-heading compact">
          <div><span className="pmachine-overline">OUTPUT</span><h3>Program console</h3></div>
          <span className="pmachine-console-caption">writeln -&gt; stdout</span>
        </div>
        <div className="pmachine-console" aria-live="polite">
          {output.length > 0 ? output.map((line, index) => <div className="pmachine-console-line" key={`${index}-${line}`}><span>{String(index + 1).padStart(2, '0')}</span>{line}</div>) : <span className="pmachine-console-empty">Run a program to see its output here.</span>}
        </div>
      </section>

      {result ? <details className="pmachine-result-details"><summary>Run details</summary><pre>{JSON.stringify(result, null, 2)}</pre></details> : null}
    </div>
  )
}
