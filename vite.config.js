import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Vite's default target assumes a fairly recent browser; older phones fail
    // to parse the bundle and render a blank page with no visible error.
    // Transpiling down to es2017 covers considerably older Android/iOS.
    target: ['es2017', 'safari12', 'chrome64', 'firefox68', 'edge79'],
  },
})
