import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        workbench: resolve(__dirname, 'src/renderer/entries/workbench/index.html'),
        stock: resolve(__dirname, 'src/renderer/entries/stock/index.html'),
        automation: resolve(__dirname, 'src/renderer/entries/automation/index.html'),
        browser: resolve(__dirname, 'src/renderer/entries/browser/index.html'),
        'plugin-center': resolve(__dirname, 'src/renderer/entries/plugin-center/index.html'),
        'plugin-host': resolve(__dirname, 'src/renderer/plugin-host/index.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
});
