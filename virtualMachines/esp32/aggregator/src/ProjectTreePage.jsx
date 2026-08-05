import { useEffect, useMemo, useState } from 'react'

function flattenPathSegments(value) {
  return String(value || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function computeProjectStats(node) {
  let subprojectCount = 0
  let flowCount = Number(node?.flowCount || 0)

  const stack = Array.isArray(node?.children) ? [...node.children] : []
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue
    subprojectCount += 1
    flowCount += Number(current.flowCount || 0)
    if (Array.isArray(current.children) && current.children.length > 0) {
      for (const child of current.children) stack.push(child)
    }
  }

  return { subprojectCount, flowCount }
}

function findNodeBySubprojectPath(rootNode, subprojectPath) {
  const normalizedPath = String(subprojectPath || '').trim()
  if (!normalizedPath) return rootNode

  const wanted = flattenPathSegments(normalizedPath).join('/').toLowerCase()
  const stack = [rootNode]
  while (stack.length > 0) {
    const current = stack.pop()
    const currentPath = String(current?.subprojectPath || '').trim().toLowerCase()
    if (currentPath === wanted) return current
    if (Array.isArray(current?.children)) {
      for (const child of current.children) stack.push(child)
    }
  }
  return rootNode
}

function formatNodePath(node) {
  const projectId = String(node?.projectId || '').trim()
  const subprojectPath = String(node?.subprojectPath || '').trim()
  return subprojectPath ? `${projectId}/subprojects/${subprojectPath}` : projectId
}

function normalizeIdToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeSubprojectTokenPath(value) {
  const parts = String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => normalizeIdToken(segment))
    .filter(Boolean)
  return parts.join('/')
}

function buildWorkspaceApiPath(projectId, subprojectPath = '') {
  const base = `/api/projects/${encodeURIComponent(String(projectId || '').trim())}/workspace`
  const normalizedSubproject = normalizeSubprojectTokenPath(subprojectPath)
  if (!normalizedSubproject) return base
  return `${base}?subproject=${encodeURIComponent(normalizedSubproject)}`
}

export default function ProjectTreePage() {
  const [projects, setProjects] = useState([])
  const [projectsRoot, setProjectsRoot] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedSubprojectPath, setSelectedSubprojectPath] = useState('')
  const [statusText, setStatusText] = useState('Loading project tree...')
  const [isLoading, setIsLoading] = useState(true)
  const [newProjectId, setNewProjectId] = useState('')
  const [newProjectLabel, setNewProjectLabel] = useState('')
  const [newSubprojectName, setNewSubprojectName] = useState('')
  const [newFlowName, setNewFlowName] = useState('')
  const [isMutating, setIsMutating] = useState(false)

  async function refreshTree() {
    setIsLoading(true)
    try {
      const response = await fetch('/api/projects/tree')
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || response.statusText || `HTTP ${response.status}`)
      }
      const payload = await response.json()
      const tree = Array.isArray(payload?.projects) ? payload.projects : []
      setProjects(tree)
      setProjectsRoot(String(payload?.projectsRoot || ''))

      if (tree.length === 0) {
        setSelectedProjectId('')
        setSelectedSubprojectPath('')
        setStatusText('No projects found. Save a project workspace to create one.')
        return
      }

      const currentProject = tree.find((entry) => entry.projectId === selectedProjectId) || tree[0]
      setSelectedProjectId(currentProject.projectId)

      const resolvedNode = findNodeBySubprojectPath(currentProject, selectedSubprojectPath)
      const nextSubprojectPath = String(resolvedNode?.subprojectPath || '').trim()
      setSelectedSubprojectPath(nextSubprojectPath)
      setStatusText(`Loaded ${tree.length} project${tree.length === 1 ? '' : 's'} from ${payload?.projectsRoot || 'configured root'}.`)
    } catch (error) {
      setStatusText(`Failed to load project tree: ${error?.message || String(error)}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshTree()
  }, [])

  const selectedProject = useMemo(() => {
    return projects.find((entry) => entry.projectId === selectedProjectId) || projects[0] || null
  }, [projects, selectedProjectId])

  const selectedNode = useMemo(() => {
    if (!selectedProject) return null
    return findNodeBySubprojectPath(selectedProject, selectedSubprojectPath)
  }, [selectedProject, selectedSubprojectPath])

  const breadcrumbSegments = useMemo(() => {
    if (!selectedProject) return []
    const segments = [{
      label: selectedProject.name || selectedProject.projectId,
      subprojectPath: ''
    }]

    const currentPath = String(selectedNode?.subprojectPath || '').trim()
    if (!currentPath) return segments

    const parts = flattenPathSegments(currentPath)
    let cursor = ''
    for (const part of parts) {
      cursor = cursor ? `${cursor}/${part}` : part
      segments.push({ label: part, subprojectPath: cursor })
    }
    return segments
  }, [selectedProject, selectedNode])

  const stats = useMemo(() => {
    if (!selectedProject) return { subprojectCount: 0, flowCount: 0 }
    return computeProjectStats(selectedProject)
  }, [selectedProject])

  const childNodes = Array.isArray(selectedNode?.children) ? selectedNode.children : []
  const flowItems = Array.isArray(selectedNode?.flows) ? selectedNode.flows : []
  const parentPath = String(selectedNode?.parentSubprojectPath || '').trim()

  function openNode(subprojectPath) {
    setSelectedSubprojectPath(normalizeSubprojectTokenPath(subprojectPath))
  }

  async function createProject() {
    const projectId = normalizeIdToken(newProjectId)
    const projectLabel = String(newProjectLabel || projectId).trim()
    if (!projectId) {
      setStatusText('Project ID is required and must contain letters, numbers, dot, underscore, or dash.')
      return
    }

    setIsMutating(true)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, label: projectLabel })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || response.statusText || `HTTP ${response.status}`)
      }

      setSelectedProjectId(projectId)
      setSelectedSubprojectPath('')
      setNewProjectId('')
      if (!newProjectLabel) setNewProjectLabel('')
      await refreshTree()
      setStatusText(payload?.created ? `Project ${projectId} created and persisted.` : `Project ${projectId} already exists.`)
    } catch (error) {
      setStatusText(`Failed to create project: ${error?.message || String(error)}`)
    } finally {
      setIsMutating(false)
    }
  }

  async function createSubproject() {
    if (!selectedProject) {
      setStatusText('Select a project before creating a subproject.')
      return
    }

    const leaf = normalizeIdToken(newSubprojectName)
    if (!leaf) {
      setStatusText('Subproject name is required.')
      return
    }

    const parentPath = normalizeSubprojectTokenPath(selectedNode?.subprojectPath || '')
    const subprojectPath = parentPath ? `${parentPath}/${leaf}` : leaf

    setIsMutating(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(selectedProject.projectId)}/subprojects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subprojectPath, label: leaf })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || response.statusText || `HTTP ${response.status}`)
      }

      setNewSubprojectName('')
      await refreshTree()
      setSelectedProjectId(selectedProject.projectId)
      setSelectedSubprojectPath(subprojectPath)
      setStatusText(payload?.created ? `Subproject ${subprojectPath} created.` : `Subproject ${subprojectPath} already exists.`)
    } catch (error) {
      setStatusText(`Failed to create subproject: ${error?.message || String(error)}`)
    } finally {
      setIsMutating(false)
    }
  }

  async function createFlowInNode() {
    if (!selectedProject || !selectedNode) {
      setStatusText('Select a project node before creating a flow.')
      return
    }

    const flowToken = normalizeIdToken(newFlowName)
    if (!flowToken) {
      setStatusText('Flow name is required.')
      return
    }

    const normalizedSubprojectPath = normalizeSubprojectTokenPath(selectedNode.subprojectPath || '')
    const flowId = normalizedSubprojectPath ? `${normalizedSubprojectPath.replace(/\//g, '.')}.${flowToken}.flow` : `${flowToken}.flow`
    const flowFileName = `${flowToken}.flw`
    const workspacePath = buildWorkspaceApiPath(selectedProject.projectId, normalizedSubprojectPath)

    setIsMutating(true)
    try {
      const workspaceResponse = await fetch(workspacePath, { method: 'GET' })
      const workspacePayload = await workspaceResponse.json().catch(() => ({}))
      if (!workspaceResponse.ok || !workspacePayload?.workspace || typeof workspacePayload.workspace !== 'object') {
        throw new Error(workspacePayload?.error || workspaceResponse.statusText || `HTTP ${workspaceResponse.status}`)
      }

      const workspace = workspacePayload.workspace
      const projectModel = workspace.projectModel && typeof workspace.projectModel === 'object' ? workspace.projectModel : {}
      const flows = Array.isArray(projectModel.flows) ? projectModel.flows : []
      if (!flows.some((flow) => String(flow?.id || '').trim().toLowerCase() === flowId.toLowerCase())) {
        flows.push({ id: flowId, fileName: flowFileName, contains: [] })
      }

      const nextWorkspace = {
        ...workspace,
        projectModel: {
          ...projectModel,
          flows,
        },
        flow: {
          ...(workspace.flow || {}),
          fileName: workspace?.flow?.fileName || flowFileName,
          payload: workspace?.flow?.payload || null,
          lastSavedAt: workspace?.flow?.lastSavedAt || '',
        },
      }

      const persistResponse = await fetch(workspacePath, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace: nextWorkspace })
      })
      const persistPayload = await persistResponse.json().catch(() => ({}))
      if (!persistResponse.ok) {
        throw new Error(persistPayload?.error || persistResponse.statusText || `HTTP ${persistResponse.status}`)
      }

      setNewFlowName('')
      await refreshTree()
      setStatusText(`Flow ${flowId} added to ${formatNodePath(selectedNode)}.`)
    } catch (error) {
      setStatusText(`Failed to create flow: ${error?.message || String(error)}`)
    } finally {
      setIsMutating(false)
    }
  }

  function openInFlowDesigner() {
    if (!selectedProject || !selectedNode) {
      setStatusText('Select a project node first.')
      return
    }

    const params = new URLSearchParams()
    params.set('projectId', String(selectedProject.projectId || 'default'))
    params.set('projectLabel', String(selectedNode.name || selectedProject.name || selectedProject.projectId || 'project'))
    const normalizedSubprojectPath = normalizeSubprojectTokenPath(selectedNode.subprojectPath || '')
    if (normalizedSubprojectPath) params.set('subproject', normalizedSubprojectPath)
    window.location.assign(`/flow-designer?${params.toString()}`)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.68, letterSpacing: 0.1 }}>Projects</div>
          <h2 style={{ margin: '4px 0 0' }}>Project Build Tree</h2>
          <div style={{ opacity: 0.8, marginTop: 4 }}>Navigate up and down project/subproject nodes. Each node can contain many flows.</div>
        </div>
        <button type="button" onClick={() => void refreshTree()} disabled={isLoading}>{isLoading ? 'Refreshing...' : 'Refresh'}</button>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 12 }}>
        <aside style={{ border: '1px solid rgba(148,163,184,0.3)', borderRadius: 12, padding: 10, background: 'rgba(15,23,42,0.45)' }}>
          <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 8, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Create Project</div>
            <input
              type="text"
              value={newProjectId}
              onChange={(event) => setNewProjectId(event.target.value)}
              placeholder="project-id"
              style={{ width: '100%', marginBottom: 6 }}
            />
            <input
              type="text"
              value={newProjectLabel}
              onChange={(event) => setNewProjectLabel(event.target.value)}
              placeholder="Project label (optional)"
              style={{ width: '100%', marginBottom: 6 }}
            />
            <button type="button" onClick={() => void createProject()} disabled={isMutating || isLoading} style={{ width: '100%' }}>
              {isMutating ? 'Working...' : 'Create Project'}
            </button>
          </div>

          <div style={{ fontWeight: 700, marginBottom: 8 }}>Projects</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {projects.length === 0 ? <div style={{ opacity: 0.7 }}>No projects</div> : null}
            {projects.map((project) => {
              const active = project.projectId === selectedProject?.projectId
              const projectStats = computeProjectStats(project)
              return (
                <button
                  key={project.projectId}
                  type="button"
                  onClick={() => {
                    setSelectedProjectId(project.projectId)
                    setSelectedSubprojectPath('')
                  }}
                  style={{
                    textAlign: 'left',
                    borderRadius: 10,
                    border: active ? '1px solid rgba(14,99,156,0.7)' : '1px solid rgba(148,163,184,0.25)',
                    background: active ? 'rgba(14,99,156,0.2)' : 'rgba(2,6,23,0.4)',
                    color: 'inherit',
                    padding: '8px 10px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{project.name || project.projectId}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{projectStats.subprojectCount} subprojects, {projectStats.flowCount} flows</div>
                </button>
              )
            })}
          </div>
        </aside>

        <article style={{ border: '1px solid rgba(148,163,184,0.3)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.45)', minWidth: 0 }}>
          {!selectedProject ? (
            <div style={{ opacity: 0.75 }}>Select a project to inspect its build tree.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {breadcrumbSegments.map((crumb, index) => (
                    <button
                      key={`${crumb.subprojectPath || 'root'}:${index}`}
                      type="button"
                      onClick={() => openNode(crumb.subprojectPath)}
                      style={{
                        border: '1px solid rgba(148,163,184,0.35)',
                        borderRadius: 999,
                        background: 'rgba(2,6,23,0.5)',
                        color: 'inherit',
                        padding: '4px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      {crumb.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => openNode(parentPath)}
                  disabled={!selectedNode || (!selectedNode.subprojectPath && !parentPath)}
                >
                  Up One Level
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.82 }}>
                Path: {formatNodePath(selectedNode)}
              </div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Create Subproject</div>
                  <input
                    type="text"
                    value={newSubprojectName}
                    onChange={(event) => setNewSubprojectName(event.target.value)}
                    placeholder="subproject-name"
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  <button type="button" onClick={() => void createSubproject()} disabled={isMutating || isLoading} style={{ width: '100%' }}>
                    {isMutating ? 'Working...' : 'Create Subproject'}
                  </button>
                </div>

                <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Create Flow</div>
                  <input
                    type="text"
                    value={newFlowName}
                    onChange={(event) => setNewFlowName(event.target.value)}
                    placeholder="flow-name"
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  <button type="button" onClick={() => void createFlowInNode()} disabled={isMutating || isLoading} style={{ width: '100%' }}>
                    {isMutating ? 'Working...' : 'Create Flow'}
                  </button>
                </div>

                <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Flow Designer</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
                    Open this node in Flow Designer to drag, drop, and connect components.
                  </div>
                  <button type="button" onClick={openInFlowDesigner} disabled={isMutating || isLoading}>
                    Open In Flow Designer
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Node Type</div>
                  <div style={{ fontWeight: 700 }}>{selectedNode.kind}</div>
                </div>
                <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Children</div>
                  <div style={{ fontWeight: 700 }}>{childNodes.length}</div>
                </div>
                <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Flows</div>
                  <div style={{ fontWeight: 700 }}>{flowItems.length}</div>
                </div>
              </div>

              <section style={{ marginTop: 14 }}>
                <h3 style={{ margin: '0 0 8px' }}>Subprojects</h3>
                {childNodes.length === 0 ? (
                  <div style={{ opacity: 0.72 }}>No child subprojects in this node.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                    {childNodes.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => openNode(child.subprojectPath || '')}
                        style={{
                          textAlign: 'left',
                          borderRadius: 10,
                          border: '1px solid rgba(148,163,184,0.3)',
                          background: 'rgba(2,6,23,0.4)',
                          color: 'inherit',
                          padding: '8px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{child.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>{child.flowCount} flows, {child.childrenCount} subprojects</div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section style={{ marginTop: 14 }}>
                <h3 style={{ margin: '0 0 8px' }}>Flows In This Node</h3>
                {flowItems.length === 0 ? (
                  <div style={{ opacity: 0.72 }}>No flows defined in this node yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid rgba(148,163,184,0.35)', padding: '6px 4px' }}>Flow</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid rgba(148,163,184,0.35)', padding: '6px 4px' }}>File</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid rgba(148,163,184,0.35)', padding: '6px 4px' }}>Contains</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid rgba(148,163,184,0.35)', padding: '6px 4px' }}>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flowItems.map((flow, index) => (
                          <tr key={`${flow.id}:${index}`}>
                            <td style={{ borderBottom: '1px solid rgba(148,163,184,0.18)', padding: '6px 4px' }}>{flow.id}</td>
                            <td style={{ borderBottom: '1px solid rgba(148,163,184,0.18)', padding: '6px 4px', opacity: 0.8 }}>{flow.fileName || '-'}</td>
                            <td style={{ borderBottom: '1px solid rgba(148,163,184,0.18)', padding: '6px 4px' }}>{Number(flow.containsCount || 0)}</td>
                            <td style={{ borderBottom: '1px solid rgba(148,163,184,0.18)', padding: '6px 4px', opacity: 0.8 }}>{flow.source}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </article>
      </section>

      <footer style={{ fontSize: 12, opacity: 0.78 }}>
        Root: {projectsRoot || 'not configured'}
      </footer>

      <div style={{ fontSize: 12, opacity: 0.75 }}>{statusText}</div>
    </div>
  )
}
