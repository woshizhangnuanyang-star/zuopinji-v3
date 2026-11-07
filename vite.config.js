import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE || '/',
  plugins: [react()],
  build: {
    target: 'es2022',
    rollupOptions: { output: { manualChunks(id) {
      if (id.includes('/node_modules/p5/')) return 'p5-lab';
      if (id.includes('/node_modules/three/')) return 'three';
      if (id.includes('/node_modules/@react-three/')) return 'town-engine';
    } } },
  },
});
