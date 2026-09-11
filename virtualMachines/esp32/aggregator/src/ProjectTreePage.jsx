import { lazy, Suspense, useCallback, useEffect, useState } from 'react'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

function languageForFileName(fileName) {
  const extension = String(fileName || '').split('.').pop()?.toLowerCase()
  if (extension === 'pas') return 'pascal'
  if (extension === 'wfl') return 'wfl'
  if (extension === 'flw') return 'json'
  if (extension === 'json') return 'json'
  if (extension === 'md') return 'markdown'
  if (extension === 'cob' || extension === 'cbl') return 'plaintext'
  if (extension === 'vbs') return 'vb'
  return 'plaintext'
}

function initializeWflLanguage(monaco) {
  if (!monaco.languages.getLanguages().some((language) => language.id === 'wfl')) {
    monaco.languages.register({ id: 'wfl' })
    monaco.languages.setMonarchTokensProvider('wfl', {
      ignoreCase: true,
      keywords: ['DEPLOYMENT', 'PROJECT', 'TARGETS', 'SERVICE', 'PROGRAM', 'DAEMON', 'FILE', 'QUEUE', 'STARTUP', 'WORKFLOW', 'STEP', 'BEGIN', 'END', 'TRUE', 'FALSE'],
      tokenizer: { root: [/[A-Za-z_][A-Za-z0-9_-]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }], strings: [[/"([^"\\]|\\.)*"/, 'string'], [/'([^'\\]|\\.)*'/, 'string']], brackets: [[/[()]/, '@brackets']], whitespace: [[/[ \t\r\n]+/, 'white']], comments: [[/--.*$/, 'comment'], [/\/\/.*$/, 'comment']] }
    })
    monaco.editor.defineTheme('wflWorkbench', { base: 'vs-dark', inherit: true, rules: [{ token: 'keyword', foreground: '4FC1FF', fontStyle: 'bold' }, { token: 'string', foreground: 'CE9178' }], colors: { 'editor.background': '#0f172a' } })
  }
}

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
    if (Array.isArray(current.children)) stack.push(...current.children)
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
  const [resourceFolders, setResourceFolders] = useState({})
  const [deploymentPlan, setDeploymentPlan] = useState(null)
  const [deploymentPlanText, setDeploymentPlanText] = useState('')
  const [metadataLabel, setMetadataLabel] = useState('')
  const [metadataDescription, setMetadataDescription] = useState('')
  const [newResourceFolder, setNewResourceFolder] = useState('programs')
  const [newResourceFileName, setNewResourceFileName] = useState('')
  const [newResourceContent, setNewResourceContent] = useState('')
  const [openSourceTabs, setOpenSourceTabs] = useState([])
  const [activeSourceTabId, setActiveSourceTabId] = useState('')
  const [isMutating, setIsMutating] = useState(false)

  const refreshTree = useCallback(async () => {
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
  }, [selectedProjectId, selectedSubprojectPath])

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshTree()
    }, 0)
    return () => clearTimeout(timer)
  }, [refreshTree])

  const refreshSelectedNodeResources = useCallback(async (node) => {
    if (!node) {
      setResourceFolders({})
      setDeploymentPlan(null)
      return
    }
    const subproject = normalizeSubprojectTokenPath(node.subprojectPath || '')
    const query = subproject ? `?subproject=${encodeURIComponent(subproject)}` : ''
    try {
      const [resourcesResponse, planResponse] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(node.projectId)}/resources${query}`),
        fetch(`/api/projects/${encodeURIComponent(node.projectId)}/deployment-plan${query}`),
      ])
      const workspaceResponse = await fetch(buildWorkspaceApiPath(node.projectId, subproject))
      const resourcesPayload = await resourcesResponse.json().catch(() => ({}))
      const planPayload = await planResponse.json().catch(() => ({}))
      const workspacePayload = await workspaceResponse.json().catch(() => ({}))
      if (resourcesResponse.ok) setResourceFolders(resourcesPayload.resourceFolders || {})
      if (planResponse.ok) {
        setDeploymentPlan(planPayload.plan || null)
        setDeploymentPlanText(planPayload.plan ? JSON.stringify(planPayload.plan, null, 2) : '')
      }
      if (workspaceResponse.ok && workspacePayload.workspace) {
        setMetadataLabel(String(workspacePayload.workspace.projectLabel || node.name || node.projectId))
        setMetadataDescription(String(workspacePayload.workspace.projectDescription || ''))
      }
    } catch {
      setResourceFolders({})
      setDeploymentPlan(null)
    }
  }, [])

  const selectedProject = projects.find((entry) => entry.projectId === selectedProjectId) || projects[0] || null
  const selectedNode = selectedProject ? findNodeBySubprojectPath(selectedProject, selectedSubprojectPath) : null
  const breadcrumbSegments = (() => {
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
  })()

  const childNodes = Array.isArray(selectedNode?.children) ? selectedNode.children : []
  const flowItems = Array.isArray(selectedNode?.flows) ? selectedNode.flows : []
  const parentPath = String(selectedNode?.parentSubprojectPath || '').trim()

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpenSourceTabs([])
      setActiveSourceTabId('')
      void refreshSelectedNodeResources(selectedNode)
    }, 0)
    return () => clearTimeout(timer)
  }, [refreshSelectedNodeResources, selectedNode])

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

  async function createResource() {
    if (!selectedNode) {
      setStatusText('Select a project node before creating a resource.')
      return
    }
    const fileName = String(newResourceFileName || '').trim()
    if (!fileName) {
      setStatusText('Resource file name is required.')
      return
    }
    const subprojectPath = normalizeSubprojectTokenPath(selectedNode.subprojectPath || '')
    setIsMutating(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(selectedNode.projectId)}/resources/${encodeURIComponent(newResourceFolder)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subprojectPath, fileName, content: newResourceContent }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || response.statusText || `HTTP ${response.status}`)
      setNewResourceFileName('')
      setNewResourceContent('')
      await refreshSelectedNodeResources(selectedNode)
      await refreshTree()
      setStatusText(`${newResourceFolder}/${fileName} saved.`)
    } catch (error) {
      setStatusText(`Failed to save resource: ${error?.message || String(error)}`)
    } finally {
      setIsMutating(false)
    }
  }

  async function deleteResource(folder, fileName) {
    if (!selectedNode || (folder === 'deployment' && fileName.startsWith('deployment-plan.'))) return
    const subprojectPath = normalizeSubprojectTokenPath(selectedNode.subprojectPath || '')
    setIsMutating(true)
    try {
      const query = subprojectPath ? `?subproject=${encodeURIComponent(subprojectPath)}` : ''
      const response = await fetch(`/api/projects/${encodeURIComponent(selectedNode.projectId)}/resources/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}${query}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || response.statusText || `HTTP ${response.status}`)
      await refreshSelectedNodeResources(selectedNode)
      await refreshTree()
      setStatusText(`${folder}/${fileName} deleted.`)
    } catch (error) {
      setStatusText(`Failed to delete resource: ${error?.message || String(error)}`)
    } finally {
      setIsMutating(false)
    }
  }

  async function openResourceFile(folder, fileName) {
    if (!selectedNode) return
    const subprojectPath = normalizeSubprojectTokenPath(selectedNode.subprojectPath || '')
    const query = subprojectPath ? `?subproject=${encodeURIComponent(subprojectPath)}` : ''
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(selectedNode.projectId)}/resources/${encodeURIComponent(folder)}${query}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || response.statusText || `HTTP ${response.status}`)
      const file = (payload.files || []).find((item) => item.fileName === fileName)
      if (!file) throw new Error(`${fileName} was not found`)
      const tabId = `${selectedNode.projectId}:${subprojectPath}:${folder}:${fileName}`
      setOpenSourceTabs((current) => current.some((tab) => tab.id === tabId)
        ? current
        : [...current, { id: tabId, folder, fileName, content: file.content, dirty: false }])
      setActiveSourceTabId(tabId)
    } catch (error) {
      setStatusText(`Failed to open ${folder}/${fileName}: ${error?.message || String(error)}`)
    }
  }

  function updateActiveSourceContent(content) {
    setOpenSourceTabs((current) => current.map((tab) => tab.id === activeSourceTabId ? { ...tab, content, dirty: true } : tab))
  }

  function closeSourceTab(tabId) {
    const tab = openSourceTabs.find((item) => item.id === tabId)
    if (tab?.dirty && !window.confirm(`Discard unsaved changes in ${tab.fileName}?`)) return
    const remaining = openSourceTabs.filter((item) => item.id !== tabId)
    setOpenSourceTabs(remaining)
    if (activeSourceTabId === tabId) setActiveSourceTabId(remaining[remaining.length - 1]?.id || '')
  }

  async function saveActiveSourceTab() {
    const tab = openSourceTabs.find((item) => item.id === activeSourceTabId)
    if (!tab || !selectedNode) return
    const subprojectPath = normalizeSubprojectTokenPath(selectedNode.subprojectPath || '')
    setIsMutating(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(selectedNode.projectId)}/resources/${encodeURIComponent(tab.folder)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subprojectPath, fileName: tab.fileName, content: tab.content }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || response.statusText || `HTTP ${response.status}`)
      setOpenSourceTabs((current) => current.map((item) => item.id === tab.id ? { ...item, dirty: false } : item))
      await refreshSelectedNodeResources(selectedNode)
      setStatusText(`${tab.fileName} saved.`)
    } catch (error) {
      setStatusText(`Failed to save ${tab.fileName}: ${error?.message || String(error)}`)
    } finally {
      setIsMutating(false)
    }
  }

  async function saveDeploymentPlan() {
    if (!selectedNode || !deploymentPlan) return
    let parsedPlan
    try {
      parsedPlan = JSON.parse(deploymentPlanText)
    } catch {
      setStatusText('Deployment plan JSON is invalid.')
      return
    }
    const subprojectPath = normalizeSubprojectTokenPath(selectedNode.subprojectPath || '')
    setIsMutating(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(selectedNode.projectId)}/deployment-plan${subprojectPath ? `?subproject=${encodeURIComponent(subprojectPath)}` : ''}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: parsedPlan }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || response.statusText || `HTTP ${response.status}`)
      setDeploymentPlan(payload.plan || deploymentPlan)
      setDeploymentPlanText(JSON.stringify(payload.plan || parsedPlan, null, 2))
      await refreshSelectedNodeResources(selectedNode)
      await refreshTree()
      setStatusText('Deployment plan saved.')
    } catch (error) {
      setStatusText(`Failed to save deployment plan: ${error?.message || String(error)}`)
    } finally {
      setIsMutating(false)
    }
  }

  async function saveMetadata() {
    if (!selectedNode) return
    const subprojectPath = normalizeSubprojectTokenPath(selectedNode.subprojectPath || '')
    setIsMutating(true)
    try {
      const workspacePath = buildWorkspaceApiPath(selectedNode.projectId, subprojectPath)
      const workspaceResponse = await fetch(workspacePath)
      const workspacePayload = await workspaceResponse.json().catch(() => ({}))
      if (!workspaceResponse.ok || !workspacePayload.workspace) throw new Error(workspacePayload?.error || workspaceResponse.statusText)
      const response = await fetch(workspacePath, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspace: {
            ...workspacePayload.workspace,
            projectLabel: String(metadataLabel || selectedNode.projectId).trim(),
            projectDescription: String(metadataDescription || '').trim(),
          },
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || response.statusText || `HTTP ${response.status}`)
      await refreshTree()
      await refreshSelectedNodeResources(selectedNode)
      setStatusText('Project metadata saved.')
    } catch (error) {
      setStatusText(`Failed to save project metadata: ${error?.message || String(error)}`)
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

              <section style={{ marginTop: 12, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0 }}>Metadata</h3>
                  <button type="button" onClick={() => void saveMetadata()} disabled={isMutating}>Save Metadata</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(240px, 2fr)', gap: 8, marginTop: 8 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    Label
                    <input type="text" value={metadataLabel} onChange={(event) => setMetadataLabel(event.target.value)} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    Description
                    <input type="text" value={metadataDescription} onChange={(event) => setMetadataDescription(event.target.value)} />
                  </label>
                </div>
              </section>

              <section style={{ marginTop: 12, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 10 }}>
                <h3 style={{ margin: '0 0 8px' }}>Project Folders</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                  {['programs', 'services', 'daemons', 'artifacts', 'deployment'].map((folder) => (
                    <div key={folder} style={{ border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{folder}</div>
                      <div style={{ fontWeight: 700 }}>{resourceFolders[folder]?.count || 0} files</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                        {(resourceFolders[folder]?.files || []).map((fileName) => {
                          const managedPlanFile = folder === 'deployment' && fileName.startsWith('deployment-plan.')
                          return (
                            <div key={`${folder}/${fileName}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 11 }}>
                              <button type="button" onClick={() => void openResourceFile(folder, fileName)} style={{ border: 0, background: 'transparent', color: 'inherit', padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', cursor: 'pointer' }} title={`Open ${fileName}`}>
                                {fileName}
                              </button>
                              <button type="button" onClick={() => void deleteResource(folder, fileName)} disabled={isMutating || managedPlanFile} title={managedPlanFile ? 'Managed by the deployment plan editor' : `Delete ${fileName}`}>
                                {managedPlanFile ? 'Managed' : 'Delete'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {openSourceTabs.length > 0 ? (
                <section style={{ marginTop: 12, border: '1px solid rgba(148,163,184,0.3)', borderRadius: 10, overflow: 'hidden', background: '#1e1e1e' }}>
                  <div role="tablist" aria-label="Project source files" style={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto', background: '#252526', borderBottom: '1px solid #3e3e42' }}>
                    {openSourceTabs.map((tab) => (
                      <div key={tab.id} role="tab" aria-selected={tab.id === activeSourceTabId} style={{ display: 'flex', alignItems: 'center', gap: 6, background: tab.id === activeSourceTabId ? '#1e1e1e' : '#2d2d30', borderRight: '1px solid #3e3e42', color: '#d4d4d4' }}>
                        <button type="button" onClick={() => setActiveSourceTabId(tab.id)} style={{ border: 0, background: 'transparent', color: 'inherit', padding: '8px 8px 8px 10px', cursor: 'pointer' }}>
                          {tab.dirty ? '● ' : ''}{tab.fileName}
                        </button>
                        <button type="button" onClick={() => closeSourceTab(tab.id)} title={`Close ${tab.fileName}`} style={{ border: 0, background: 'transparent', color: '#aaa', padding: '4px 8px 4px 0', cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const activeTab = openSourceTabs.find((tab) => tab.id === activeSourceTabId) || openSourceTabs[0]
                    if (!activeTab) return null
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 10px', color: '#aaa', fontSize: 12, background: '#1e1e1e' }}>
                          <span>{activeTab.folder}/{activeTab.fileName}</span>
                          <button type="button" onClick={() => void saveActiveSourceTab()} disabled={isMutating || !activeTab.dirty}>Save</button>
                        </div>
                        <div style={{ height: 460, minHeight: 300 }}>
                          <Suspense fallback={<div style={{ padding: 20, color: '#d4d4d4' }}>Loading editor...</div>}>
                            <MonacoEditor
                              height="100%"
                              language={languageForFileName(activeTab.fileName)}
                              theme={languageForFileName(activeTab.fileName) === 'wfl' ? 'wflWorkbench' : 'vs-dark'}
                              value={activeTab.content}
                              onChange={(value) => updateActiveSourceContent(value || '')}
                              beforeMount={(monaco) => initializeWflLanguage(monaco)}
                              options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, wordWrap: 'on' }}
                            />
                          </Suspense>
                        </div>
                      </>
                    )
                  })()}
                </section>
              ) : null}

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

                <div style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Save Resource</div>
                  <select value={newResourceFolder} onChange={(event) => setNewResourceFolder(event.target.value)} style={{ width: '100%', marginBottom: 6 }}>
                    {['programs', 'services', 'daemons', 'artifacts'].map((folder) => <option key={folder} value={folder}>{folder}</option>)}
                  </select>
                  <input type="text" value={newResourceFileName} onChange={(event) => setNewResourceFileName(event.target.value)} placeholder="file-name.pas" style={{ width: '100%', marginBottom: 6 }} />
                  <textarea value={newResourceContent} onChange={(event) => setNewResourceContent(event.target.value)} placeholder="Resource content" rows={3} style={{ width: '100%', marginBottom: 6 }} />
                  <button type="button" onClick={() => void createResource()} disabled={isMutating || isLoading} style={{ width: '100%' }}>Save Resource</button>
                </div>
              </div>

              {deploymentPlan ? (
                <section style={{ marginTop: 14, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0 }}>Deployment Plan</h3>
                    <button type="button" onClick={() => void saveDeploymentPlan()} disabled={isMutating}>Save Plan</button>
                  </div>
                  <textarea
                    value={deploymentPlanText}
                    onChange={(event) => setDeploymentPlanText(event.target.value)}
                    rows={12}
                    style={{ width: '100%', marginTop: 8, fontFamily: 'monospace' }}
                  />
                </section>
              ) : null}

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
