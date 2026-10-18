import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readServiceLifecycleConfig, createServiceLifecycleRuntime, describeBoundHttpListener } from './src/service-lifecycle-runtime.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000'
const runtimeDataRoot = process.env.PULSE_RUNTIME_DATA_ROOT || process.env.PULSE_QUEUE_DATA_ROOT || 'C:/pulse-data/esp32/aggregator-data'
const viteCacheDir = process.env.VITE_CACHE_DIR || path.join(runtimeDataRoot, 'vite-cache')
const bobConsolePath = path.resolve(__dirname, 'public/bob-console.html')

const bobConsolePlugin = {
  name: 'serve-bob-console',
  async generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'bob-console.html',
      source: await fs.readFile(bobConsolePath),
    })
  },
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname
      if (!['GET', 'HEAD'].includes(req.method || '') || pathname !== '/bob-console.html') {
        next()
        return
      }

      try {
        const html = await fs.readFile(bobConsolePath)
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(req.method === 'HEAD' ? undefined : html)
      } catch (error) {
        next(error)
      }
    })
  },
}

const lifecyclePlugin = {
  name: 'pulse-frontend-lifecycle',
  async configureServer(server) {
    const config = readServiceLifecycleConfig({ serviceId: 'pulse-frontend' })
    const runtime = await createServiceLifecycleRuntime({ config })
    server.middlewares.use((req, res, next) => {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname
      if (!['/health', '/ready'].includes(pathname)) return next()
      const readiness = runtime.getReadiness()
      res.statusCode = pathname === '/health' || readiness.ready ? 200 : 503
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(pathname === '/health'
        ? { serviceId: config.serviceId, instanceId: config.instanceId, alive: true } : readiness))
    })
    server.httpServer.once('listening', async () => {
      try {
        const listener = describeBoundHttpListener(server.httpServer.address(), config)
        await runtime.start(listener.endpoint, [listener])
      } catch (error) {
        console.error('[FRONTEND] Lifecycle initialization failed:', error.message)
        await runtime.stop()
        await server.close()
        process.exitCode = 1
      }
    })
    server.httpServer.once('close', () => {
      void runtime.stop().catch(error => console.error('[FRONTEND] Lifecycle shutdown failed:', error.message))
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [lifecyclePlugin, bobConsolePlugin, react()],
  publicDir: path.resolve(__dirname, '../../../documents'),
  cacheDir: viteCacheDir,
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom', 'react-dom/client', 'dayjs', '@braintree/sanitize-url'],
    exclude: ['mermaid'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['neptune', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (_error, _req, res) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'content-type': 'application/json' })
            }
            res.end(JSON.stringify({ error: `Backend unavailable at ${apiProxyTarget}. Start the backend with npm run dev:backend.` }))
          })
        },
      },
      '/mcp-query': {
        target: apiProxyTarget,
        changeOrigin: true,
        rewrite: () => '/api/mcp/query',
      },
      '/status': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/services': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/mcp-query': {
        target: apiProxyTarget,
        changeOrigin: true,
        rewrite: () => '/api/mcp/query',
      },
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
