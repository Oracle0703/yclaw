import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = resolve(__dirname, '../../..');

describe('UI component standards', () => {
  it('keeps monitor pages on Ant Design components instead of native form controls', () => {
    const monitoredFiles = [
      'src/renderer/entries/hot-monitor/App.tsx',
      'src/renderer/entries/comment-monitor/App.tsx',
    ];

    for (const file of monitoredFiles) {
      const content = readFileSync(resolve(rootDir, file), 'utf-8');

      expect(content, file).not.toMatch(/<button\b/);
      expect(content, file).not.toMatch(/<input\b/);
      expect(content, file).not.toMatch(/<textarea\b/);
      expect(content, file).not.toMatch(/<select\b/);
    }
  });

  it('documents Ant Design Pro before Ant Design for reusable UI', () => {
    const content = readFileSync(resolve(rootDir, 'AGENTS.md'), 'utf-8');

    expect(content).toContain('Ant Design Pro');
    expect(content).toContain('优先使用 Ant Design Pro 组件');
    expect(content).toContain('其次使用 Ant Design 组件');
  });
});
