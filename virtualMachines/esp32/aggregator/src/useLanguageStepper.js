import { useState } from 'react'
import { buildExecutionTabs, getExecutableSteps } from './languageStepDebugger'

// Drives the shared single-step "narrator" UI state for Cobolish/VBish/Pascalish
// editor pages: which call tabs are open, which is active, and the step log.
// `singleStep` returns its status message synchronously so callers can fold it
// into their own single status line instead of it being silently shadowed by a
// separately-owned status state.
export function useLanguageStepper(languageId, editorRef) {
  const [stepTabs, setStepTabs] = useState([])
  const [activeStepTab, setActiveStepTab] = useState('main')
  const [stepIndex, setStepIndex] = useState(0)
  const [stepLog, setStepLog] = useState([])
  const [debugState, setDebugState] = useState({ runtime: 'source-narrator', status: 'ready', sourceLine: null, sourceText: '', variables: {}, operandStack: [], callStack: [], exception: null })

  function singleStep(source) {
    const { main, callables } = buildExecutionTabs(languageId, source)
    const tabs = stepTabs.length ? stepTabs : [main]
    const activeTab = tabs.find((tab) => tab.id === activeStepTab) || main
    const steps = getExecutableSteps(languageId, activeTab, callables)
    if (stepTabs.length === 0) setStepTabs([main])
    const step = steps[stepIndex]
    if (!step) {
      setDebugState(current => ({ ...current, status: 'completed' }))
      return 'No further executable statements in this tab.'
    }
    const assignment = /(?:MOVE\s+(.+?)\s+TO\s+([A-Za-z_][A-Za-z0-9_-]*)\.?|([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(.+?);?$)/i.exec(step.value || '')
    const name = assignment?.[2] || assignment?.[3]
    const value = assignment?.[1] || assignment?.[4]
    setDebugState(current => ({
      ...current,
      status: 'paused',
      sourceLine: step.line,
      sourceText: step.value || '',
      lastInstruction: `${step.kind}: ${step.value || ''}`,
      variables: name ? { ...current.variables, [name]: value } : current.variables,
      callStack: activeTab?.label && activeTab.label !== 'MAIN' ? [activeTab.label] : ['MAIN'],
      exception: null
    }))
    setStepIndex((current) => current + 1)
    editorRef.current?.revealLineInCenter(step.line)
    editorRef.current?.setPosition({ lineNumber: step.line, column: 1 })
    if ((step.kind === 'PERFORM' || step.kind === 'CALL') && step.target) {
      setStepTabs((current) => (current.some((tab) => tab.id === step.target.id) ? current : [...current, step.target]))
      setActiveStepTab(step.target.id)
      setStepIndex(0)
      setStepLog((current) => [...current, `${step.kind} ${step.value}: opened ${step.target.label}`])
      return `Stepped ${step.kind} ${step.value}.`
    }
    setStepLog((current) => [...current, step.kind === 'DISPLAY' ? `DISPLAY: ${step.value}` : step.value])
    return `Stepped ${step.kind} at source line ${step.line}.`
  }

  function selectStepTab(tabId) {
    setActiveStepTab(tabId)
    setStepIndex(0)
  }

  return { stepTabs, activeStepTab, stepLog, debugState, singleStep, selectStepTab }
}
