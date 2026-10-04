import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 개발 중에는 auto-app 백엔드로 프록시한다
const backend = process.env.AUTOREG_BACKEND ?? 'http://192.168.0.41:8080'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    proxy: {
      '/api': backend,
      '/files': backend,
    },
  },
})
