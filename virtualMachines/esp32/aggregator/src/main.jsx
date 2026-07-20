import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import NetworkDevicesPage from './NetworkDevicesPage.jsx'
import TopologyPage from './TopologyPage.jsx'
import CatalogStudioPage from './CatalogStudioPage.jsx'
import FlowDesignerPage from './FlowDesignerPage.jsx'
import ProjectWorkspacePage from './ProjectWorkspacePage.jsx'
import EvolutionTestPage from './EvolutionTestPage.jsx'
import QueryPage from './QueryPage.jsx'
import { PROJECT_DEFINITIONS, getProjectDefinition, hydrateProjectWorkspaceFromServer, loadActiveProjectId, saveActiveProjectId } from './projectWorkspace'

const originalFetch = window.fetch.bind(window)
const apiBaseUrls = String(import.meta.env.VITE_API_BASES || '')
  .split(',')
  .map(value => value.trim().replace(/\/$/, ''))
  .filter(Boolean)

function shouldUseApiGatewayFailover(input) {
  if (!apiBaseUrls.length) return false
  if (typeof input !== 'string') return false
  return input.startsWith('/api') || input.startsWith('/status') || input.startsWith('/services')
}

function buildGatewayUrl(baseUrl, inputPath) {
  return `${baseUrl}${inputPath.startsWith('/') ? inputPath : `/${inputPath}`}`
}

function getRotatedGatewayCandidates() {
  if (apiBaseUrls.length <= 1) return apiBaseUrls
  const start = Math.floor(Math.random() * apiBaseUrls.length)
  return apiBaseUrls.slice(start).concat(apiBaseUrls.slice(0, start))
}

window.fetch = async (input, init = {}) => {
  const nextInit = { ...init }
  const headers = new Headers(nextInit.headers || {})
  const storedActorUserId = String(localStorage.getItem('pulse.actorUserId') || '').trim()
  const authToken = localStorage.getItem('pulse.authToken') || ''
  const actorUserId = (!authToken && (!storedActorUserId || storedActorUserId.toLowerCase() === 'anonymous'))
    ? 'system-admin'
    : (storedActorUserId || 'system-admin')
  if (authToken) {
    headers.set('authorization', `Bearer ${authToken}`)
  }
  headers.set('x-user-id', actorUserId)
  nextInit.headers = headers

  const executeRequest = async () => {
    if (!shouldUseApiGatewayFailover(input)) {
      return originalFetch(input, nextInit)
    }

    const candidates = getRotatedGatewayCandidates()
    let lastNetworkError = null

    for (let i = 0; i < candidates.length; i += 1) {
      const url = buildGatewayUrl(candidates[i], input)
      try {
        const response = await originalFetch(url, nextInit)
        if (response.status >= 500 && i < candidates.length - 1) {
          continue
        }
        return response
      } catch (error) {
        lastNetworkError = error
        if (i === candidates.length - 1) {
          throw error
        }
      }
    }

    if (lastNetworkError) {
      throw lastNetworkError
    }
    return originalFetch(input, nextInit)
  }

  let response = await executeRequest()
  if (response.status === 401 && authToken) {
    headers.delete('authorization')
    nextInit.headers = headers
    response = await executeRequest()
  }
  return response
}

function AppShell() {
  const [page, setPage] = useState('project')
  const [activeProjectId, setActiveProjectId] = useState(() => loadActiveProjectId())

  useEffect(() => {
    saveActiveProjectId(activeProjectId)
  }, [activeProjectId])

  useEffect(() => {
    void hydrateProjectWorkspaceFromServer(activeProjectId)
  }, [activeProjectId])

  const activeProject = getProjectDefinition(activeProjectId)

  return (
    <>
      <nav className="app-nav">
        <button
          type="button"
          className={`app-nav-button ${page === 'project' ? 'active' : ''}`}
          onClick={() => setPage('project')}
        >
          Project
        </button>
        <button
          type="button"
          className={`app-nav-button ${page === 'query' ? 'active' : ''}`}
          onClick={() => setPage('query')}
        >
          Query
        </button>
        <button
          type="button"
          className={`app-nav-button ${page === 'catalog' ? 'active' : ''}`}
          onClick={() => setPage('catalog')}
        >
          Catalog Studio
        </button>
        <button
          type="button"
          className={`app-nav-button ${page === 'flow' ? 'active' : ''}`}
          onClick={() => setPage('flow')}
        >
          Flow Designer
        </button>
        <button
          type="button"
          className={`app-nav-button ${page === 'topology' ? 'active' : ''}`}
          onClick={() => setPage('topology')}
        >
          Topology
        </button>
        <button
          type="button"
          className={`app-nav-button ${page === 'devices' ? 'active' : ''}`}
          onClick={() => setPage('devices')}
        >
          Devices
        </button>
        <button
          type="button"
          className={`app-nav-button ${page === 'evolution' ? 'active' : ''}`}
          onClick={() => setPage('evolution')}
        >
          Evolution
        </button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto', color: 'var(--text-h)' }}>
          Project
          <select
            value={activeProjectId}
            onChange={(event) => setActiveProjectId(event.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8 }}
          >
            {PROJECT_DEFINITIONS.map((project) => (
              <option key={project.id} value={project.id}>{project.label}</option>
            ))}
          </select>
        </label>
      </nav>
      {page === 'project' ? (
        <ProjectWorkspacePage
          project={activeProject}
          onSelectProject={setActiveProjectId}
          onOpenCatalog={() => setPage('catalog')}
          onOpenFlow={() => setPage('flow')}
        />
      ) : null}
      {page === 'query' ? <QueryPage /> : null}
      {page === 'catalog' ? <CatalogStudioPage projectId={activeProject.id} projectLabel={activeProject.label} /> : null}
      {page === 'flow' ? <FlowDesignerPage projectId={activeProject.id} projectLabel={activeProject.label} /> : null}
      {page === 'topology' ? <TopologyPage /> : null}
      {page === 'devices' ? <NetworkDevicesPage /> : null}
      {page === 'evolution' ? <EvolutionTestPage /> : null}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
)
