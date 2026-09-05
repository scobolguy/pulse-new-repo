import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000'
const mcpProxyTarget = process.env.VITE_MCP_PROXY_TARGET || 'http://localhost:4011'
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [bobConsolePlugin, react()],
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
        target: mcpProxyTarget,
        changeOrigin: true,
        rewrite: () => '/query',
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
        target: mcpProxyTarget,
        changeOrigin: true,
        rewrite: () => '/query',
      },
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
