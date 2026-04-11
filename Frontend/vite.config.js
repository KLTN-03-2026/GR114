import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
<<<<<<< HEAD
})
=======
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api-ai': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-ai/, '/api')
      }
    }
  }
})
>>>>>>> 015cc60cbf8f0c9906a2bb104d5ccd51070c656c
