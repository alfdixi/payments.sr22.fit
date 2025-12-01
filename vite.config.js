import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['payments.sr22.fit'], // 👈 AQUI
  },
  preview: {
    allowedHosts: ['payments.sr22.fit'], // 👈 AQUI TAMBIÉN
  },
})
