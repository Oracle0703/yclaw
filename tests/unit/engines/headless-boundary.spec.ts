import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Headless Runner 自动化边界', () => {
  const rootDir = resolve(__dirname, '../../..');
  const headlessReusableFiles = [
    'src/engines/automation/AutomationEngine.ts',
    'src/engines/automation/FlowRunner.ts',
    'src/engines/automation/SelectorGenerator.ts',
    'src/main/services/TaskService.ts',
  ];

  it('自动化执行链不直接暴露 Electron WebContents 类型', () => {
    for (const file of headlessReusableFiles) {
      const content = readFileSync(resolve(rootDir, file), 'utf-8');

      expect(content, file).not.toMatch(/from ['"]electron['"]/);
      expect(content, file).not.toMatch(/\bWebContents\b/);
    }
  });
});
