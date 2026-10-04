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
    setStatus(`${nextProgram.label} loaded.`)
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
          <div className="pmachine-panel-heading">
            <div><span className="pmachine-overline">SOURCE</span><h3>Pascal program</h3></div>
            <label className="pmachine-select-label">
              <span className="sr-only">Program example</span>
              <select value={programId} onChange={chooseProgram} disabled={busy}>
                {PROGRAMS.map((program) => <option key={program.id} value={program.id}>{program.label}</option>)}
              </select>
            </label>
          </div>
          <textarea className="pmachine-source" value={source} onChange={(event) => setSource(event.target.value)} spellCheck="false" disabled={busy} aria-label="Pascal program source" />
        </div>

        <aside className="pmachine-control-panel">
          <div className="pmachine-panel-heading compact">
            <div><span className="pmachine-overline">TARGET</span><h3>Execution node</h3></div>
            <span className="pmachine-chip">ESP32</span>
          </div>
          <label className="pmachine-field">
            <span>Registered node</span>
            <select value={targetNode} onChange={(event) => setTargetNode(event.target.value)} disabled={busy}>
              <option value="">Select an ESP32</option>
              {nodes.map((node) => <option key={nodeId(node)} value={nodeId(node)}>{nodeLabel(node)} · {nodeAddress(node)}</option>)}
            </select>
          </label>
          <div className="pmachine-target-card">
            <span className="pmachine-target-label">ADDRESS</span>
            <strong>{nodeAddress(selectedNode) || 'Waiting for target'}</strong>
            <span>{selectedNode ? nodeLabel(selectedNode) : 'No PMachine target available'}</span>
          </div>
          <button className="pmachine-run-button" type="button" disabled={busy || !selectedNode} onClick={() => void runOnEsp32()}>
            <span className="pmachine-run-icon">{busy ? '...' : '>'}</span>
            {busy ? 'Running on ESP32' : 'Run on ESP32'}
          </button>
          <p className="pmachine-status" role="status">{status}</p>
        </aside>
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
