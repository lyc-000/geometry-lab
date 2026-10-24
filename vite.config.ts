import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves the project from /<repository-name>/. The CI workflow
// provides VITE_BASE_PATH; local development and custom domains use "/".
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 4317,
    strictPort: true,
    watch: {
      ignored: ['**/.tmp/**', '**/*.tmpdir/**', '**/dist/**'],
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('/mathjs/') ||
            id.includes('/fraction.js/') ||
            id.includes('/decimal.js/') ||
            id.includes('/complex.js/') ||
            id.includes('/typed-function/') ||
            id.includes('/seedrandom/') ||
            id.includes('/tiny-emitter/')
          ) {
            return 'math-engine';
          }
          if (
            id.includes('/three/') ||
            id.includes('/three-stdlib/') ||
            id.includes('@react-three') ||
            id.includes('/three-mesh-bvh/')
          ) {
            return 'three-vendor';
          }
          if (id.includes('@radix-ui') || id.includes('lucide-react')) {
            return 'ui-vendor';
          }
          return 'vendor';
        },
      },
    },
  },
});
