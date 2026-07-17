import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
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
