import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = (env.VITE_BACKEND_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
  const frontendPort = Number(env.VITE_FRONTEND_PORT || 5173)

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: frontendPort,
      strictPort: false,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          ws: false,
        },
        '/auth': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
