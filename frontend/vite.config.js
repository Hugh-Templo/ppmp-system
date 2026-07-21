import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so Electron loadFile() resolves JS/CSS correctly.
  base: './',
  server: {
    host: true, // listen on all interfaces so the tunnel/LAN can reach it
    port: 5173,
    // Allow the frontend to be served through tunnels (localtunnel, cloudflare, ngrok)
    allowedHosts: true,
    proxy: {
      // Forward API calls to the FastAPI backend running on this machine.
      // This lets us expose only port 5173 while /api still reaches :8000.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
