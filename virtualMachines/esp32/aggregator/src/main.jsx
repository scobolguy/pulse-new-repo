import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

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
  const actorUserId = localStorage.getItem('pulse.actorUserId') || 'anonymous'
  const authToken = localStorage.getItem('pulse.authToken') || ''
  if (authToken) {
    headers.set('authorization', `Bearer ${authToken}`)
  }
  headers.set('x-user-id', actorUserId)
  nextInit.headers = headers

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
