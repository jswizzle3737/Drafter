import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup.html'),
        sidepanel: path.resolve(__dirname, 'sidepanel.html'),
        studio: path.resolve(__dirname, 'studio.html'),
      },
    },
  },
});
