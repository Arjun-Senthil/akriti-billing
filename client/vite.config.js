import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    // Proxy: any request from the frontend starting with /api
    // gets forwarded to the Express backend at localhost:3001.
    //
    // This means in your React code you write:
    //   axios.get('/api/customers')        ← clean, no hardcoded host
    // instead of:
    //   axios.get('http://localhost:3001/api/customers')
    //
    // When you deploy to production, you point this proxy at your
    // real server URL — one config change, nothing in component code changes.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
