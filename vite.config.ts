import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          if (/data\/(shanghai|beijing|shenzhen|guangzhou)\.json/.test(id)) return 'networks';
        },
      },
    },
  },
});
