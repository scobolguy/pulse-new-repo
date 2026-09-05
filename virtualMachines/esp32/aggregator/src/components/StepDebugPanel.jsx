import React from 'react'
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'))

// Shared tab-bar + step-log presentation for the single-step "narrator" feature,
// reused by the Cobolish, VBish, and Pascalish editor pages.
export default function StepDebugPanel({ stepTabs, activeStepTab, onSelectTab, stepLog, tabListLabel, monacoLanguage, testIdPrefix }) {
  if (stepTabs.length === 0) return null
  const activeTab = stepTabs.find((tab) => tab.id === activeStepTab)
  return (
    <>
      <div role="tablist" aria-label={tabListLabel} style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
        {stepTabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={tab.id === activeStepTab} onClick={() => onSelectTab(tab.id)}>{tab.label}</button>
        ))}
      </div>
      <div style={{ height: 170, minHeight: 170, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 6, overflow: 'hidden' }}>
        <React.Suspense fallback={<div style={{ padding: 12, opacity: 0.6 }}>Loading editor...</div>}>
          <MonacoEditor
            height="100%"
            language={monacoLanguage}
            theme="pascalishWorkbench"
            value={activeTab?.content || ''}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on', wordWrap: 'on', automaticLayout: true }}
          />
        </React.Suspense>
      </div>
      {stepLog.length > 0 && (
        <div data-testid={`${testIdPrefix}-step-log`} style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {stepLog.join('\n')}
        </div>
      )}
    </>
  )
}
