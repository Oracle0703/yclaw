/**
 * 回归测试: PR #16 代码审查 — Loading 状态管理 & 组件导入问题
 *
 * - #2: useLoading hook 文件缺失
 * - #3: LoadingProvider 导出命名与文件名不一致
 * - #7: antd reset.css 冗余导入
 * - #8: PageShell 未使用 Spin 导入
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';

// ---- 回归-004: useLoading hook 可从 hooks 路径导入 ----
describe('Regression: useLoading hook availability', () => {
  it('should be importable from hooks/useLoading', async () => {
    const mod = await import('@renderer/shared/hooks/useLoading');
    expect(mod.useLoading).toBeDefined();
    expect(typeof mod.useLoading).toBe('function');
  });

  it('should be importable from hooks index barrel', async () => {
    const mod = await import('@renderer/shared/hooks');
    expect(mod.useLoading).toBeDefined();
    expect(typeof mod.useLoading).toBe('function');
  });

  it('should throw when used outside LoadingProvider', async () => {
    const { useLoading } = await import('@renderer/shared/hooks/useLoading');
    // React hook 在 provider 外使用应该抛出
    const TestComp = () => {
      useLoading();
      return null;
    };
    expect(() => render(<TestComp />)).toThrow('useLoading must be used within a LoadingProvider');
  });
});

// ---- 回归-005: LoadingProvider 从 GlobalLoading 正确导出 ----
describe('Regression: LoadingProvider export', () => {
  it('should export LoadingProvider from GlobalLoading', async () => {
    const mod = await import('@renderer/shared/components/GlobalLoading');
    expect(mod.LoadingProvider).toBeDefined();
    expect(typeof mod.LoadingProvider).toBe('function');
  });

  it('should export useLoading from GlobalLoading', async () => {
    const mod = await import('@renderer/shared/components/GlobalLoading');
    expect(mod.useLoading).toBeDefined();
    expect(typeof mod.useLoading).toBe('function');
  });
});

// ---- 回归-006: PageShell 不导入未使用的组件 ----
describe('Regression: PageShell clean imports', () => {
  it('should render correctly without Spin dependency', async () => {
    const { PageShell } = await import('@renderer/shared/components/PageShell');
    render(<PageShell title="Test">Content</PageShell>);
    expect(screen.getByText('Test')).toBeDefined();
    expect(screen.getByText('Content')).toBeDefined();
  });

  it('should show skeleton when loading', async () => {
    const { PageShell } = await import('@renderer/shared/components/PageShell');
    const { container } = render(
      <PageShell title="Test" loading>
        Content
      </PageShell>,
    );
    // Skeleton 应该渲染，而非 Spin
    expect(container.querySelector('.ant-skeleton')).toBeTruthy();
    // 不应该渲染 Spin
    expect(container.querySelector('.ant-spin')).toBeNull();
  });
});
