import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Keep SSE streams open without premature timeout
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
})
