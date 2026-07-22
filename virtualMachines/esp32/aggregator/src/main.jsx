import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import QueryPage from './QueryPage.jsx'
import TopologyPage from './TopologyPage.jsx'

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

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateTo = (path) => {
    window.history.pushState(null, '', path)
    setCurrentPath(path)
  }

  let currentPage = <QueryPage />
  if (currentPath === '/topology') {
    currentPage = <TopologyPage />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <nav style={{
        padding: '12px 20px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
      }}>
        <button
          onClick={() => navigateTo('/')}
          style={{
            padding: '8px 16px',
            backgroundColor: currentPath === '/' ? '#333' : '#fff',
            color: currentPath === '/' ? '#fff' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: currentPath === '/' ? 'bold' : 'normal'
          }}
        >
          Ollama Query
        </button>
        <button
          onClick={() => navigateTo('/topology')}
          style={{
            padding: '8px 16px',
            backgroundColor: currentPath === '/topology' ? '#333' : '#fff',
            color: currentPath === '/topology' ? '#fff' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: currentPath === '/topology' ? 'bold' : 'normal'
          }}
        >
          Network Topology
        </button>
      </nav>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {currentPage}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
)
