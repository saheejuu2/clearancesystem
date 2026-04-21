import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  base: '/hospital-clearance/frontend/dist/',
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      // Target Chrome 109 (last version for Windows 8.1)
      targets: ['chrome >= 109', 'firefox >= 115', 'edge >= 109'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
  build: {
    target: ['chrome109', 'firefox115', 'edge109'],
  },
})
