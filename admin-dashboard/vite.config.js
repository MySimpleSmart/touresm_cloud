import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react({
    jsxRuntime: 'automatic',
  })],
  server: {
    port: 3001,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: false,
    target: 'es2015',
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
})

