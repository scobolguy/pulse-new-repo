import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TopologyPage from './TopologyPage.jsx'
import DataMapper from './DataMapper.jsx'
import FlowDesignerPage from './FlowDesignerPage.jsx'
import NetworkDevicesPage from './NetworkDevicesPage.jsx'
import ProjectTreePage from './ProjectTreePage.jsx'
import ProvisioningAgentPage from './ProvisioningAgentPage.jsx'
import PascalishEditorPage from './PascalishEditorPage.jsx'
import LanguageCompilerPage from './LanguageCompilerPage.jsx'

const TOOL_ROUTES = [
  { path: '/query', label: 'Query', shortLabel: 'Q', description: 'Ask BOB, submit files, and inspect operational results.' },
  { path: '/projects', label: 'Projects', shortLabel: 'P', description: 'Browse project and subproject build trees and inspect flows per node.' },
  { path: '/data-mapper', label: 'Data Mapper', shortLabel: 'M', description: 'Define and test transformations between message formats.' },
  { path: '/flow-designer', label: 'Flow Designer', shortLabel: 'F', description: 'Compose typed processing flows and bind deployment targets.' },
  { path: '/pascalish', label: 'Pascalish', shortLabel: 'Ps', description: 'Author and compile Pascalish programs with Monaco editor, Librarian type autocomplete, and F7 run shortcuts.' },
  { path: '/cobolish', label: 'COBOLISH', shortLabel: 'Cb', description: 'Author COBOL-85 compatible programs, services, and daemons.' },
  { path: '/vbish', label: 'VBish', shortLabel: 'Vb', description: 'Author VB-like programs, services, and daemons.' },
  { path: '/topology', label: 'Topology', shortLabel: 'T', description: 'Inspect nodes, services, and runtime connectivity.' },
  { path: '/bluetooth-devices', label: 'Bluetooth Devices', shortLabel: 'B', description: 'Inspect nearby BLE devices, inferred types, manufacturers, and signal strength.' },
  { path: '/provisioning-agent', label: 'Provisioning Agent', shortLabel: 'A', description: 'Run fleet provisioning jobs with retry policy and job history.' },
]

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
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const [currentSearch, setCurrentSearch] = useState(window.location.search)

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname)
      setCurrentSearch(window.location.search)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateTo = (path) => {
    if (path === '/query') {
      window.location.assign('/bob-console.html')
      return
    }
    window.history.pushState(null, '', path)
    setCurrentPath(path)
    setCurrentSearch('')
  }

  // Default: redirect to BOB Console
  if (currentPath === '/' || currentPath === '/index.html') {
    window.location.replace('/bob-console.html')
    return null
  }

  if (currentPath === '/query') {
    window.location.replace('/bob-console.html')
    return null
  }

  let currentPage = null
  if (currentPath === '/topology') {
    currentPage = <TopologyPage />
  } else if (currentPath === '/bluetooth-devices') {
    currentPage = <NetworkDevicesPage />
  } else if (currentPath === '/projects') {
    currentPage = <ProjectTreePage />
  } else if (currentPath === '/data-mapper') {
    currentPage = <DataMapper />
  } else if (currentPath === '/flow-designer') {
    const params = new URLSearchParams(currentSearch || '')
    const projectId = String(params.get('projectId') || 'default').trim() || 'default'
    const projectLabel = String(params.get('projectLabel') || projectId).trim() || projectId
    const subprojectPath = String(params.get('subproject') || '').trim()
    currentPage = (
      <FlowDesignerPage
        projectId={projectId}
        projectLabel={projectLabel}
        subprojectPath={subprojectPath}
      />
    )
  } else if (currentPath === '/pascalish') {
    currentPage = <PascalishEditorPage />
  } else if (currentPath === '/cobolish') {
    currentPage = <LanguageCompilerPage languageId="cobolish" />
  } else if (currentPath === '/vbish') {
    currentPage = <LanguageCompilerPage languageId="vbish" />
  } else if (currentPath === '/provisioning-agent') {
    currentPage = <ProvisioningAgentPage />
  }

  const activeTool = TOOL_ROUTES.find(tool => tool.path === currentPath) || TOOL_ROUTES[0]

  return (
    <div className="tool-workbench">
      <header className="tool-workbench-titlebar">
        <strong>PULSE Workbench</strong>
        <span>{activeTool.label}</span>
      </header>
      <div className="tool-workbench-body">
        <nav className="tool-activity-bar" aria-label="Workbench tools">
          {TOOL_ROUTES.map(tool => (
            <button
              key={tool.path}
              type="button"
              className={currentPath === tool.path ? 'active' : ''}
              onClick={() => navigateTo(tool.path)}
              aria-label={tool.label}
              title={tool.label}
            >
              {tool.shortLabel}
            </button>
          ))}
        </nav>
        <aside className="tool-explorer">
          <div className="tool-explorer-heading">TOOLS</div>
          {TOOL_ROUTES.map(tool => (
            <button
              key={tool.path}
              type="button"
              className={currentPath === tool.path ? 'active' : ''}
              onClick={() => navigateTo(tool.path)}
            >
              {tool.label}
            </button>
          ))}
        </aside>
        <main className="tool-workbench-main">
          <header className="tool-page-bar">
            <div>
              <h1>{activeTool.label}</h1>
              <p>{activeTool.description}</p>
            </div>
            <span className="tool-page-context">LOCAL WORKSPACE</span>
          </header>
          <div className="tool-page-content">
            {currentPage}
          </div>
        </main>
      </div>
      <footer className="tool-status-bar">
        <span>PULSE</span>
        <span>Connected</span>
        <span className="tool-status-spacer" />
        <span>Local runtime</span>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
)
