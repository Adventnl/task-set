import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `npm run dev` serves the UI with hot reload and forwards /api to `npm run worker:dev`.
// The Worker only accepts same-origin writes, so the proxy presents the Worker's own origin.
const WORKER_ORIGIN = 'http://127.0.0.1:8787'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: WORKER_ORIGIN, ws: true, changeOrigin: true, headers: { origin: WORKER_ORIGIN } },
    },
  },
})
