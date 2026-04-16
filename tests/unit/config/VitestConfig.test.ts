import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Vitest 测试项目配置', () => {
  const rootDir = resolve(__dirname, '../../..');

  it('为 Node 测试与组件测试拆分独立 workspace 项目', () => {
    const workspacePath = resolve(rootDir, 'vitest.workspace.ts');

    expect(existsSync(workspacePath)).toBe(true);

    const content = readFileSync(workspacePath, 'utf-8');

    expect(content).toContain("name: 'unit-node'");
    expect(content).toContain("name: 'unit-components'");
    expect(content).toContain("environment: 'node'");
    expect(content).toContain("environment: 'happy-dom'");
    expect(content).toContain("include: ['tests/unit/components/**/*.{test,spec}.tsx']");
    expect(content).toContain("setupFiles: ['tests/setup-component.ts']");
  });

  it('根配置不再给全部测试注入组件专用 setup', () => {
    const configPath = resolve(rootDir, 'vitest.config.ts');
    const content = readFileSync(configPath, 'utf-8');

    expect(content).not.toContain('environmentMatchGlobs');
    expect(content).not.toContain('setupFiles');
  });
});
