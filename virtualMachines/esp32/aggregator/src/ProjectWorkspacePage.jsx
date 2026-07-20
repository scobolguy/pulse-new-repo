import { useEffect, useMemo, useState } from 'react'
import { getDefaultProjectWorkspace, hydrateProjectWorkspaceFromServer, loadProjectWorkspace, saveProjectWorkspace, upsertProjectDocument } from './projectWorkspace'

const DOCUMENT_GROUPS = [
  { key: 'pascalish', label: 'Pascalish Code' },
  { key: 'workflow', label: 'Work Flow Language' },
  { key: 'canvas', label: 'Flow Canvas' },
  { key: 'qa', label: 'QA Plan' },
  { key: 'pm', label: 'PM Plan' },
]

const PROJECT_ASSET_GROUPS = [
  {
    key: 'programs',
    label: 'Programs',
    fields: [
      { key: 'id', label: 'ID', placeholder: 'payment.main' },
      { key: 'fileName', label: 'File', placeholder: 'payment.pas' },
      { key: 'language', label: 'Language', placeholder: 'pascalish' },
    ],
  },
  {
    key: 'flows',
    label: 'Flows',
    fields: [
      { key: 'id', label: 'ID', placeholder: 'payments.main.flow' },
      { key: 'fileName', label: 'File', placeholder: 'payments.flw' },
      { key: 'contains', label: 'Contains', placeholder: 'fraud-check.flow,settlement.flow', isList: true },
    ],
  },
  {
    key: 'daemons',
    label: 'Daemons',
    fields: [
      { key: 'id', label: 'ID', placeholder: 'daemon.scheduler' },
      { key: 'name', label: 'Name', placeholder: 'Scheduler Daemon' },
      { key: 'entryRef', label: 'Entry', placeholder: 'scheduler.tick' },
      { key: 'schedule', label: 'Schedule', placeholder: '*/5 * * * *' },
    ],
  },
  {
    key: 'services',
    label: 'Services',
    fields: [
      { key: 'id', label: 'ID', placeholder: 'service.mapper' },
      { key: 'name', label: 'Name', placeholder: 'Mapper Service' },
      { key: 'protocol', label: 'Protocol', placeholder: 'http' },
      { key: 'contractRef', label: 'Contract', placeholder: 'contract.payment.v1' },
    ],
  },
  {
    key: 'rulesets',
    label: 'Rule Sets',
    fields: [
      { key: 'id', label: 'ID', placeholder: 'CBDS_MT103_TO_PACS008' },
      { key: 'label', label: 'Label', placeholder: 'CBDS MT103 -> PACS.008' },
      { key: 'sourcePatterns', label: 'Source patterns', placeholder: 'swift-mt103,mt103', isList: true },
      { key: 'targetPatterns', label: 'Target patterns', placeholder: 'pacs.008,pacs008', isList: true },
      { key: 'priority', label: 'Priority', placeholder: '0' },
    ],
  },
  {
    key: 'messageDefinitions',
    label: 'Message Definitions',
    fields: [
      { key: 'id', label: 'ID', placeholder: 'swift-mt103' },
      { key: 'name', label: 'Name', placeholder: 'SWIFT MT103' },
      { key: 'schemaRef', label: 'Schema ref', placeholder: 'swift-mt103.json' },
      { key: 'format', label: 'Format', placeholder: 'swift-fin' },
      { key: 'version', label: 'Version', placeholder: 'v1' },
    ],
  },
]

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function toListText(value) {
  return Array.isArray(value) ? value.join(',') : ''
}

function createAssetTemplate(groupKey) {
  const group = PROJECT_ASSET_GROUPS.find((item) => item.key === groupKey)
  if (!group) return {}
  const next = {}
  for (const field of group.fields) {
    next[field.key] = field.isList ? [] : ''
  }
  return next
}

export default function ProjectWorkspacePage({ project, onSelectProject, onOpenCatalog, onOpenFlow }) {
  const projectId = project?.id || getDefaultProjectWorkspace().projectId
  const [workspace, setWorkspace] = useState(() => loadProjectWorkspace(projectId))
  const [projectRootPath, setProjectRootPath] = useState('')
  const [projectRootInput, setProjectRootInput] = useState('')
  const [isSavingRoot, setIsSavingRoot] = useState(false)
  const [statusText, setStatusText] = useState('')

  async function refreshProjectsRoot() {
    try {
      const response = await fetch('/api/projects/root')
      if (!response.ok) return null
      const payload = await response.json()
      const nextRoot = String(payload?.projectsRoot || '')
      setProjectRootPath(nextRoot)
      setProjectRootInput(nextRoot)
      return nextRoot
    } catch {
      return null
    }
  }

  useEffect(() => {
    setWorkspace(loadProjectWorkspace(projectId))
    setProjectRootPath('')
    setProjectRootInput('')
    setStatusText('')
    let cancelled = false

    void refreshProjectsRoot().then((rootPath) => {
      if (cancelled || !rootPath) return
      setStatusText(`Project root loaded: ${rootPath}`)
    })

    void hydrateProjectWorkspaceFromServer(projectId).then((result) => {
      if (cancelled || !result?.workspace) return
      setWorkspace(result.workspace)
      const workspacePath = String(result.projectRoot || '')
      if (workspacePath) {
        setProjectRootPath(workspacePath)
      }
      setStatusText(`Loaded project workspace from ${workspacePath || 'server storage'}.`)
    })

    return () => {
      cancelled = true
    }
  }, [projectId])

  useEffect(() => {
    saveProjectWorkspace(projectId, workspace)
  }, [projectId, workspace])

  const documents = workspace.documents || {}
  const projectModel = workspace.projectModel || {}
  const assetLists = {
    programs: Array.isArray(projectModel.programs) ? projectModel.programs : [],
    flows: Array.isArray(projectModel.flows) ? projectModel.flows : [],
    daemons: Array.isArray(projectModel.daemons) ? projectModel.daemons : [],
    services: Array.isArray(projectModel.services) ? projectModel.services : [],
    rulesets: Array.isArray(projectModel.rulesets) ? projectModel.rulesets : [],
    messageDefinitions: Array.isArray(projectModel.messageDefinitions) ? projectModel.messageDefinitions : [],
  }
  const knownFlowIds = useMemo(() => {
    const seen = new Set()
    const next = []
    for (const flow of assetLists.flows) {
      const flowId = String(flow?.id || '').trim()
      if (!flowId) continue
      const lower = flowId.toLowerCase()
      if (seen.has(lower)) continue
      seen.add(lower)
      next.push(flowId)
    }
    return next
  }, [assetLists.flows])
  const savedLabel = useMemo(() => workspace.projectLabel || project?.label || 'Project', [workspace.projectLabel, project?.label])

  function updateDocument(kind, patch) {
    setWorkspace((current) => {
      const next = upsertProjectDocument(current, kind, patch)
      setStatusText(`Saved ${next.documents?.[kind]?.label || kind} to ${savedLabel}.`)
      return next
    })
  }

  function updateAssetGroup(groupKey, nextItems) {
    setWorkspace((current) => {
      const currentModel = current.projectModel && typeof current.projectModel === 'object' ? current.projectModel : {}
      const next = {
        ...current,
        projectModel: {
          ...currentModel,
          [groupKey]: nextItems,
        },
      }
      setStatusText(`Saved ${groupKey} in ${savedLabel}.`)
      return next
    })
  }

  function updateAssetField(groupKey, index, field, rawValue, isList = false) {
    const currentItems = Array.isArray(assetLists[groupKey]) ? assetLists[groupKey] : []
    if (!currentItems[index]) return
    const nextItems = currentItems.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      return {
        ...item,
        [field]: isList ? splitList(rawValue) : String(rawValue || ''),
      }
    })
    updateAssetGroup(groupKey, nextItems)
  }

  function addAsset(groupKey) {
    const currentItems = Array.isArray(assetLists[groupKey]) ? assetLists[groupKey] : []
    updateAssetGroup(groupKey, [...currentItems, createAssetTemplate(groupKey)])
  }

  function removeAsset(groupKey, index) {
    const currentItems = Array.isArray(assetLists[groupKey]) ? assetLists[groupKey] : []
    updateAssetGroup(groupKey, currentItems.filter((_, itemIndex) => itemIndex !== index))
  }

  function toggleFlowContains(flowIndex, nestedFlowId, enabled) {
    const currentItems = Array.isArray(assetLists.flows) ? assetLists.flows : []
    if (!currentItems[flowIndex]) return
    const nextItems = currentItems.map((item, index) => {
      if (index !== flowIndex) return item
      const contains = new Set(Array.isArray(item?.contains) ? item.contains.map((part) => String(part || '').trim()).filter(Boolean) : [])
      if (enabled) {
        contains.add(nestedFlowId)
      } else {
        contains.delete(nestedFlowId)
      }
      return {
        ...item,
        contains: Array.from(contains),
      }
    })
    updateAssetGroup('flows', nextItems)
  }

  async function handleSaveProjectRoot() {
    const nextRoot = String(projectRootInput || '').trim()
    if (!nextRoot) {
      setStatusText('Project root path is required.')
      return
    }

    setIsSavingRoot(true)
    try {
      const response = await fetch('/api/projects/root', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectsRoot: nextRoot }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setStatusText(`Failed to update project root: ${payload?.error || response.statusText}`)
        return
      }

      const appliedRoot = String(payload?.projectsRoot || nextRoot)
      setProjectRootPath(appliedRoot)
      setProjectRootInput(appliedRoot)
      setStatusText(`Project root updated to ${appliedRoot}.`)
      const hydrated = await hydrateProjectWorkspaceFromServer(projectId)
      if (hydrated?.workspace) {
        setWorkspace(hydrated.workspace)
      }
    } catch (error) {
      setStatusText(`Failed to update project root: ${error?.message || String(error)}`)
    } finally {
      setIsSavingRoot(false)
    }
  }

  return (
    <div className="project-workspace-page" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 0.12, textTransform: 'uppercase', opacity: 0.72 }}>Project Workspace</div>
          <h1 style={{ margin: '4px 0 0' }}>{project?.label || 'Untitled Project'}</h1>
          <div style={{ opacity: 0.78, maxWidth: 860 }}>{project?.description || 'Keep the project bundle together: Pascalish, WFL, QA, PM, and flow canvas artifacts are stored per project.'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onOpenFlow}>Open Flow Designer</button>
          <button type="button" onClick={onOpenCatalog}>Open Catalog Studio</button>
          {typeof onSelectProject === 'function' ? (
            <button type="button" onClick={() => onSelectProject(projectId)}>Refresh Project</button>
          ) : null}
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <article style={{ border: '1px solid rgba(148, 163, 184, 0.22)', borderRadius: 14, padding: 14, background: 'rgba(15, 23, 42, 0.55)', gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 12, letterSpacing: 0.1, textTransform: 'uppercase', opacity: 0.68 }}>Project Storage Root</div>
          <div style={{ marginTop: 6, opacity: 0.82 }}>By default, project folders are saved under Documents/Pulse. Update the path below to move all project directories.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={projectRootInput}
              onChange={(event) => setProjectRootInput(event.target.value)}
              placeholder="C:\\Users\\you\\Documents\\Pulse"
              style={{ flex: '1 1 520px', minWidth: 260, borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.24)', background: 'rgba(2, 6, 23, 0.62)', color: 'inherit', padding: '10px 12px' }}
            />
            <button type="button" onClick={handleSaveProjectRoot} disabled={isSavingRoot}>
              {isSavingRoot ? 'Saving...' : 'Save Root'}
            </button>
          </div>
        </article>
        <article style={{ border: '1px solid rgba(148, 163, 184, 0.22)', borderRadius: 14, padding: 14, background: 'rgba(15, 23, 42, 0.55)', gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 12, letterSpacing: 0.1, textTransform: 'uppercase', opacity: 0.68 }}>Project Assets</div>
          <div style={{ marginTop: 6, opacity: 0.82 }}>A project contains programs, flows, daemons, and services. Flows may reference nested flows through the Contains field.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 12 }}>
            {PROJECT_ASSET_GROUPS.map((group) => {
              const items = Array.isArray(assetLists[group.key]) ? assetLists[group.key] : []
              return (
                <section key={group.key} style={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12, padding: 10, background: 'rgba(2, 6, 23, 0.42)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 700 }}>{group.label}</div>
                    <button type="button" onClick={() => addAsset(group.key)}>Add</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {items.map((item, index) => (
                      <div key={`${group.key}-${index}`} style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: 10, padding: 8, background: 'rgba(2, 6, 23, 0.56)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {group.fields.map((field) => (
                            <label key={`${group.key}-${index}-${field.key}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                              {field.label}
                              <input
                                type="text"
                                value={field.isList ? toListText(item?.[field.key]) : String(item?.[field.key] || '')}
                                onChange={(event) => updateAssetField(group.key, index, field.key, event.target.value, field.isList)}
                                placeholder={field.placeholder}
                                style={{ borderRadius: 8, border: '1px solid rgba(148, 163, 184, 0.24)', background: 'rgba(2, 6, 23, 0.62)', color: 'inherit', padding: '8px 10px' }}
                              />
                              {group.key === 'flows' && field.key === 'contains' ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                  {knownFlowIds
                                    .filter((flowId) => flowId !== String(item?.id || '').trim())
                                    .map((flowId) => {
                                      const checked = Array.isArray(item?.contains) && item.contains.includes(flowId)
                                      return (
                                        <label key={`${group.key}-${index}-contains-${flowId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(event) => toggleFlowContains(index, flowId, event.target.checked)}
                                          />
                                          {flowId}
                                        </label>
                                      )
                                    })}
                                </div>
                              ) : null}
                            </label>
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                          <button type="button" onClick={() => removeAsset(group.key, index)}>Remove</button>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 ? <div style={{ opacity: 0.72, fontSize: 12 }}>No {group.label.toLowerCase()} yet.</div> : null}
                  </div>
                </section>
              )
            })}
          </div>
        </article>
        {DOCUMENT_GROUPS.map((group) => {
          const document = documents[group.key] || {}
          return (
            <article key={group.key} style={{ border: '1px solid rgba(148, 163, 184, 0.22)', borderRadius: 14, padding: 14, background: 'rgba(15, 23, 42, 0.55)' }}>
              <div style={{ fontSize: 12, letterSpacing: 0.1, textTransform: 'uppercase', opacity: 0.68 }}>{group.label}</div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{document.fileName || 'untitled'}</div>
              <textarea
                value={document.content || ''}
                onChange={(event) => updateDocument(group.key, { content: event.target.value })}
                style={{ width: '100%', minHeight: group.key === 'canvas' ? 180 : 220, marginTop: 10, borderRadius: 12, border: '1px solid rgba(148, 163, 184, 0.24)', background: 'rgba(2, 6, 23, 0.62)', color: 'inherit', padding: 12, font: 'inherit', resize: 'vertical' }}
                placeholder={`Edit ${group.label}`}
              />
            </article>
          )
        })}
      </section>

      <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 0 0', opacity: 0.82 }}>
        <div>Project root: {projectRootPath || projectId}</div>
        <div>{statusText || 'Project documents persist locally under the active project.'}</div>
      </footer>
    </div>
  )
}