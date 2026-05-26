import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000'
const runtimeDataRoot = process.env.PULSE_RUNTIME_DATA_ROOT || process.env.PULSE_QUEUE_DATA_ROOT || 'C:/pulse-data/esp32/aggregator-data'
const viteCacheDir = process.env.VITE_CACHE_DIR || path.join(runtimeDataRoot, 'vite-cache')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, '../../../documents'),
  cacheDir: viteCacheDir,
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom', 'react-dom/client'],
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
})
