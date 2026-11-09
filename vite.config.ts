import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-syntax-highlighter') || id.includes('prismjs')) {
              return 'syntax-highlighter';
            }
            if (id.includes('react-markdown')) {
              return 'markdown';
            }
            if (id.includes('openai') || id.includes('@google/generative-ai')) {
              return 'ai-sdks';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('framer-motion')) {
              return 'motion';
            }
            return 'vendor';
          }
        }
      },
      // @ts-ignore
      checks: {
        pluginTimings: false
      },
      onwarn(warning, warn) {
        if (warning.code === 'PLUGIN_TIMINGS') return;
        warn(warning);
      }
    }
  }
})
