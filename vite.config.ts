import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The config loads as an ES module ("type": "module"; Vite 8 ships no CJS
      // build), so resolve from import.meta.url rather than __dirname.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'esnext',
    // Vite 8 minifies JS with Oxc and CSS with Lightning CSS by default.
    rolldownOptions: {
      output: {
        // Rolldown dropped the object form of manualChunks. Same result as before:
        // React in its own long-cached chunk.
        manualChunks(id) {
          return /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id) ? 'react-vendor' : undefined
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      // The Worker runs under `npm run cf:dev` (wrangler dev) on 8787. When it
      // isn't running the /api proxy fails and the search falls back to WHMCS.
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
