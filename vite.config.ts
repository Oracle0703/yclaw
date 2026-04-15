/// <reference types="vitest" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (id.includes('@ant-design/pro-components')) {
    return 'pro-components-vendor';
  }

  if (id.includes('antd') || id.includes('@ant-design/icons')) {
    return 'antd-vendor';
  }

  if (id.includes('react-router-dom')) {
    return 'router-vendor';
  }

  if (id.includes('react-dom') || id.includes('/react/')) {
    return 'react-vendor';
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  base: './',
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@main': resolve(__dirname, 'src/main'),
      '@engines': resolve(__dirname, 'src/engines'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      input: {
        workbench: resolve(__dirname, 'src/renderer/entries/workbench/index.html'),
        stock: resolve(__dirname, 'src/renderer/entries/stock/index.html'),
        automation: resolve(__dirname, 'src/renderer/entries/automation/index.html'),
        browser: resolve(__dirname, 'src/renderer/entries/browser/index.html'),
        'plugin-center': resolve(__dirname, 'src/renderer/entries/plugin-center/index.html'),
        'plugin-host': resolve(__dirname, 'src/renderer/plugin-host/index.html'),
      },
      output: {
        manualChunks,
      },
    },
  },
  server: {
    port: 5173,
  },
  test: {
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
});
