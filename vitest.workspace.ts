import { defineProject, defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  defineProject({
    extends: './vitest.config.ts',
    test: {
      name: 'unit-node',
      environment: 'node',
      include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['tests/e2e/**', 'tests/unit/components/**/*.{test,spec}.tsx'],
    },
  }),
  defineProject({
    extends: './vitest.config.ts',
    test: {
      name: 'unit-components',
      environment: 'happy-dom',
      include: ['tests/unit/components/**/*.{test,spec}.tsx'],
      exclude: ['tests/e2e/**'],
      setupFiles: ['tests/setup-component.ts'],
    },
  }),
  defineProject({
    extends: './vitest.config.ts',
    test: {
      name: 'integration-node',
      environment: 'node',
      include: ['tests/integration/**/*.{test,spec}.ts'],
      exclude: ['tests/e2e/**'],
    },
  }),
]);
