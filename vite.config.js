import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: true,
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: { target: 'esnext', chunkSizeWarningLimit: 4000 },
  optimizeDeps: { exclude: ['@babylonjs/core'] },
});
