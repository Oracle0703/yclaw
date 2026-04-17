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

export default defineConfig(({ mode }) => {
    const buildTarget = process.env.YCLAW_BUILD_TARGET ?? (mode === 'feature' ? 'feature' : 'core');
    const featureEntry = process.env.YCLAW_FEATURE_ENTRY;

    const rendererRoot = resolve(__dirname, 'src/renderer');
    const coreInputs = {
      workbench: resolve(__dirname, 'src/renderer/entries/workbench/index.html'),
      browser: resolve(__dirname, 'src/renderer/entries/browser/index.html'),
      'plugin-host': resolve(__dirname, 'src/renderer/plugin-host/index.html'),
    };

    const featureInput = featureEntry
      ? {
          [featureEntry]: resolve(__dirname, `src/renderer/entries/${featureEntry}/index.html`),
        }
      : {};

    return {
      plugins: [react()],
      base: './',
      root: rendererRoot,
      resolve: {
        alias: {
          '@shared': resolve(__dirname, 'src/shared'),
          '@renderer': resolve(__dirname, 'src/renderer'),
          '@main': resolve(__dirname, 'src/main'),
          '@engines': resolve(__dirname, 'src/engines'),
        },
      },
      build: {
        outDir:
          buildTarget === 'feature' && featureEntry
            ? resolve(__dirname, 'dist/features', featureEntry)
            : resolve(__dirname, 'dist/renderer'),
        emptyOutDir: buildTarget !== 'feature',
        chunkSizeWarningLimit: 1600,
        rollupOptions: {
          input: buildTarget === 'feature' ? featureInput : coreInputs,
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
    };
});
