import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // API_PROXY_TARGET (not exposed to the browser) lets the dev server proxy to another backend port.
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.API_PROXY_TARGET || 'http://localhost:3000'

  return {
    plugins: [react()],
    // maplibre-gl loads its Web Worker from a file next to it (new URL(..., import.meta.url)):
    // pre-bundling would separate them.
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
    worker: {
      format: 'es',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Two pages: the app and the API documentation (docs.html, served on /docs).
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          docs: path.resolve(__dirname, 'docs.html'),
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
