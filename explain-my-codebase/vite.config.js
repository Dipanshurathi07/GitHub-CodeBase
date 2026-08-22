import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:3000'
  const frontendPort = Number(env.VITE_FRONTEND_PORT || 5173)

  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      proxy: {
        '/api': backendUrl,
        '/auth': backendUrl,
      },
    },
  }
})
