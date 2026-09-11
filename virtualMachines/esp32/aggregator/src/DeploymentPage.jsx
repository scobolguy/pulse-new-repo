import { useEffect, useState } from 'react'

function normalizeProjectFiles(project) {
  const folders = project?.resourceFolders || {}
  return ['programs', 'services', 'daemons', 'artifacts']
    .flatMap((folder) => (folders[folder]?.files || []).map((fileName) => ({ folder, fileName })))
}

export default function DeploymentPage() {
  const [projects, setProjects] = useState([])
  const [nodes, setNodes] = useState([])
  const [projectId, setProjectId] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [targets, setTargets] = useState([])
  const [serviceName, setServiceName] = useState('')
  const [packageVersion, setPackageVersion] = useState('1.0.0')
  const [workloadKind, setWorkloadKind] = useState('service')
  const [statusText, setStatusText] = useState('Loading deployment inventory...')
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployments, setDeployments] = useState([])
  const [manifestResults, setManifestResults] = useState([])

  async function refresh() {
    try {
      const [projectsResponse, nodesResponse, deploymentsResponse] = await Promise.all([
        fetch('/api/projects/tree'),
        fetch('/api/nodes'),
        fetch('/api/pmachine/deployments'),
      ])
      const projectsPayload = await projectsResponse.json().catch(() => ({}))
      const nodesPayload = await nodesResponse.json().catch(() => ({}))
      const deploymentsPayload = await deploymentsResponse.json().catch(() => ({}))
      const nextProjects = Array.isArray(projectsPayload.projects) ? projectsPayload.projects : []
      const nextNodes = Array.isArray(nodesPayload) ? nodesPayload : (Array.isArray(nodesPayload.nodes) ? nodesPayload.nodes : [])
      setProjects(nextProjects)
      setNodes(nextNodes)
      setDeployments(Array.isArray(deploymentsPayload.deployments) ? deploymentsPayload.deployments : [])
      if (!projectId && nextProjects[0]) setProjectId(nextProjects[0].projectId)
      setStatusText(`Loaded ${nextProjects.length} project${nextProjects.length === 1 ? '' : 's'} and ${nextNodes.length} nodes.`)
    } catch (error) {
      setStatusText(`Failed to load deployment inventory: ${error?.message || String(error)}`)
    }
  }

  useEffect(() => { void refresh() }, [])

  const selectedProject = projects.find((project) => project.projectId === projectId) || null
  const projectFiles = normalizeProjectFiles(selectedProject)
  const selectableNodes = nodes.filter((node) => String(node?.ip || '').trim() && String(node?.ip || '').trim() !== '127.0.0.1')

  function toggleFile(file) {
    const key = `${file.folder}/${file.fileName}`
    setSelectedFiles((current) => current.some((item) => `${item.folder}/${item.fileName}` === key)
      ? current.filter((item) => `${item.folder}/${item.fileName}` !== key)
      : [...current, file])
  }

  function toggleTarget(node) {
    const id = String(node.nodeId || node.nodeName || node.ip || '').trim()
    setTargets((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function deploy() {
    if (!selectedProject || targets.length === 0) {
      setStatusText('Select a project and at least one target node.')
      return
    }
    setIsDeploying(true)
    try {
      const contentByFolder = new Map()
      for (const file of selectedFiles) {
        if (contentByFolder.has(file.folder)) continue
        const response = await fetch(`/api/projects/${encodeURIComponent(selectedProject.projectId)}/resources/${encodeURIComponent(file.folder)}`)
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error || `Could not read ${file.folder}`)
        contentByFolder.set(file.folder, Array.isArray(payload.files) ? payload.files : [])
      }
      const deployableFiles = selectedFiles.map((file) => {
        const match = (contentByFolder.get(file.folder) || []).find((entry) => entry.fileName === file.fileName)
        return {
          path: `/projects/${selectedProject.projectId}/${file.folder}/${file.fileName}`,
          content: String(match?.content || '')
        }
      })
      const planResponse = await fetch(`/api/projects/${encodeURIComponent(selectedProject.projectId)}/deployment-plan`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: {
          projectId: selectedProject.projectId,
          status: 'ready',
          targets,
          resources: selectedFiles,
          artifacts: selectedFiles,
          rollout: { strategy: 'all-at-once', batchSize: targets.length },
          rollback: { enabled: true, strategy: 'previous-version' },
        } })
      })
      if (!planResponse.ok) throw new Error('deployment plan could not be saved')
      const deploymentResponse = await fetch('/api/pmachine/deployments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          serviceName: serviceName || `project-${selectedProject.projectId}`,
          packageName: `projects/${selectedProject.projectId}`,
          packageVersion,
          targetNodeIds: targets,
          workloadKind,
          runtimeKind: 'pmachine',
          autoStart: true,
          metadata: { projectId: selectedProject.projectId, selectedFiles },
        })
      })
      const deploymentPayload = await deploymentResponse.json().catch(() => ({}))
      if (!deploymentResponse.ok) throw new Error(deploymentPayload?.error || 'deployment registration failed')
      const nodeResults = await Promise.all(targets.map(async (nodeId) => {
        const node = selectableNodes.find((candidate) => String(candidate.nodeId || candidate.nodeName || candidate.ip || '').trim() === nodeId)
        if (!node?.ip || String(node.ip).startsWith('127.')) return { nodeId, kind: 'js-pmachine', ok: true, registered: true }
        const response = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/deploy`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            nodeId,
            ip: node.ip,
            serviceName: serviceName || `project-${selectedProject.projectId}`,
            packageName: `projects/${selectedProject.projectId}`,
            packageVersion,
            metadata: { projectId: selectedProject.projectId, workloadKind, selectedFiles },
            files: deployableFiles
          })
        })
        return { nodeId, kind: 'addressable', ok: response.ok, payload: await response.json().catch(() => ({})) }
      }))
      setManifestResults(nodeResults)
      const generatedManifests = await Promise.all(targets.map((nodeId) => fetch('/api/deployments/startup-manifests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nodeId })
      }).then(async (response) => ({ nodeId, ok: response.ok, payload: await response.json().catch(() => ({})) }))))
      setManifestResults([...nodeResults, ...generatedManifests])
      await refresh()
      setStatusText(`Deployment registered for ${targets.length} node${targets.length === 1 ? '' : 's'} and startup manifests generated.`)
    } catch (error) {
      setStatusText(`Deployment failed: ${error?.message || String(error)}`)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header>
        <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.68 }}>Deployment</div>
        <h1 style={{ margin: '4px 0' }}>Project Deployment</h1>
        <div style={{ opacity: 0.76 }}>Build a deployment record, target nodes, and boot-time startup manifests from one screen.</div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(320px, 1fr)', gap: 12 }}>
        <article style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Package</h2>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>Project
            <select value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelectedFiles([]) }}>
              {projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.name || project.projectId}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: 12 }}>Service name
            <input value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="mt103-to-pacs008" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: 12 }}>Version
            <input value={packageVersion} onChange={(event) => setPackageVersion(event.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: 12 }}>Workload kind
            <select value={workloadKind} onChange={(event) => setWorkloadKind(event.target.value)}>
              <option value="program">Program</option>
              <option value="service">Service</option>
              <option value="daemon">Daemon</option>
            </select>
          </label>
          <h3>Files</h3>
          {projectFiles.map((file) => {
            const selected = selectedFiles.some((item) => item.folder === file.folder && item.fileName === file.fileName)
            return <label key={`${file.folder}/${file.fileName}`} style={{ display: 'flex', gap: 8, fontSize: 13, margin: '6px 0' }}><input type="checkbox" checked={selected} onChange={() => toggleFile(file)} />{file.folder}/{file.fileName}</label>
          })}
          {projectFiles.length === 0 ? <div style={{ opacity: 0.7 }}>No deployable files in this project.</div> : null}
        </article>

        <article style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Target Nodes</h2>
          {selectableNodes.map((node) => {
            const nodeId = String(node.nodeId || node.nodeName || node.ip || '').trim()
            return <label key={nodeId} style={{ display: 'flex', gap: 8, fontSize: 13, margin: '8px 0' }}><input type="checkbox" checked={targets.includes(nodeId)} onChange={() => toggleTarget(node)} /><span><strong>{node.nodeName || nodeId}</strong><br /><small>{nodeId} · {node.ip}</small></span></label>
          })}
          <button type="button" onClick={() => void deploy()} disabled={isDeploying || !selectedProject} style={{ marginTop: 12 }}>{isDeploying ? 'Deploying...' : 'Deploy and Generate Startup Files'}</button>
        </article>
      </section>

      <section style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Registered Deployments</h2>
        {deployments.map((deployment) => <div key={deployment.deploymentId || deployment.key} style={{ padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.15)' }}><strong>{deployment.serviceName}</strong> · {deployment.targetNodeId || 'unbound'} · {deployment.runtimeState || deployment.state}</div>)}
        {deployments.length === 0 ? <div style={{ opacity: 0.7 }}>No deployments registered.</div> : null}
      </section>
      {manifestResults.length > 0 ? (
        <section style={{ border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Startup Manifest Results</h2>
          {manifestResults.map((result) => <div key={result.nodeId} style={{ padding: '6px 0' }}>{result.nodeId} · {result.ok ? 'generated' : `failed: ${result.payload?.error || 'unknown error'}`}{result.payload?.nodeFile ? ' · uploaded to node' : ''}</div>)}
        </section>
      ) : null}
      <footer style={{ fontSize: 12, opacity: 0.75 }}>{statusText}</footer>
    </div>
  )
}