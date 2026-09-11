// Shared tab-bar + step-log presentation for the single-step "narrator" feature,
// reused by the Cobolish, VBish, and Pascalish editor pages.
export default function StepDebugPanel({ stepTabs, activeStepTab, onSelectTab, stepLog, debugState, tabListLabel, testIdPrefix }) {
  if (stepTabs.length === 0) return null
  return (
    <aside
      data-testid={`${testIdPrefix}-debug-panel`}
      aria-label={`${tabListLabel} debugger`}
      style={{
        position: 'absolute',
        top: 52,
        right: 10,
        zIndex: 10,
        width: 'min(340px, calc(100% - 20px))',
        maxHeight: 'calc(100% - 62px)',
        overflow: 'auto',
        padding: 12,
        border: '1px solid rgba(148,163,184,0.35)',
        borderRadius: 8,
        background: 'rgba(15, 23, 42, 0.96)',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
        color: '#e2e8f0'
      }}
    >
      <div role="tablist" aria-label={tabListLabel} style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 10 }}>
        {stepTabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={tab.id === activeStepTab} onClick={() => onSelectTab(tab.id)}>{tab.label}</button>
        ))}
      </div>
      {stepLog.length > 0 && (
        <div data-testid={`${testIdPrefix}-step-log`} style={{ marginBottom: 10, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {stepLog.join('\n')}
        </div>
      )}
      {debugState && (
        <div data-testid={`${testIdPrefix}-debug-state`} style={{ display: 'grid', gap: 8, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-word' }}>
          <div><strong>Runtime:</strong> {debugState.runtime}</div>
          <div><strong>Status:</strong> {debugState.status}</div>
          <div><strong>Source:</strong> {debugState.sourceLine || '-'} {debugState.sourceText || ''}</div>
          <div><strong>Instruction:</strong> {debugState.lastInstruction || '-'}</div>
          <div><strong>Variables:</strong> {JSON.stringify(debugState.variables || {})}</div>
          <div><strong>Operand stack:</strong> {JSON.stringify(debugState.operandStack || [])}</div>
          <div><strong>Call stack:</strong> {JSON.stringify(debugState.callStack || [])}</div>
          {debugState.exception ? <div style={{ color: '#f87171' }}><strong>Exception:</strong> {debugState.exception}</div> : null}
        </div>
      )}
    </aside>
  )
}
