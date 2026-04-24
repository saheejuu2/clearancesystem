import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'

  return {
    // dev: '/'  →  build: '/clearancesystem/frontend/dist/'
    base: isBuild ? '/clearancesystem/frontend/dist/' : '/',

    server: {
      proxy: {
        '/clearancesystem/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/clearancesystem\/api/, ''),
        },
      },
    },

    plugins: [
      react(),
      tailwindcss(),
      legacy({
        targets: ['chrome >= 109', 'firefox >= 115', 'edge >= 109'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      }),
    ],

    build: {
      target: ['chrome109', 'firefox115', 'edge109'],
    },
  }
})
