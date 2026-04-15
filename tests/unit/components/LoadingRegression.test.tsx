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
import { render, screen } from '@testing-library/react';
import { useLoading as useLoadingDirect } from '@renderer/shared/hooks/useLoading';
import * as hooks from '@renderer/shared/hooks';
import {
  LoadingProvider,
  useLoading as useLoadingFromGlobal,
} from '@renderer/shared/components/GlobalLoading';
import { PageShell } from '@renderer/shared/components/PageShell';

// ---- 回归-004: useLoading hook 可从 hooks 路径导入 ----
describe('Regression: useLoading hook availability', () => {
  it('should be importable from hooks/useLoading', () => {
    expect(useLoadingDirect).toBeDefined();
    expect(typeof useLoadingDirect).toBe('function');
  });

  it('should be importable from hooks index barrel', () => {
    expect(hooks.useLoading).toBeDefined();
    expect(typeof hooks.useLoading).toBe('function');
  });

  it('should throw when used outside LoadingProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // React hook 在 provider 外使用应该抛出
    const TestComp = () => {
      useLoadingDirect();
      return null;
    };
    expect(() => render(<TestComp />)).toThrow('useLoading must be used within a LoadingProvider');
    consoleErrorSpy.mockRestore();
  });
});

// ---- 回归-005: LoadingProvider 从 GlobalLoading 正确导出 ----
describe('Regression: LoadingProvider export', () => {
  it('should export LoadingProvider from GlobalLoading', () => {
    expect(LoadingProvider).toBeDefined();
    expect(typeof LoadingProvider).toBe('function');
  });

  it('should export useLoading from GlobalLoading', () => {
    expect(useLoadingFromGlobal).toBeDefined();
    expect(typeof useLoadingFromGlobal).toBe('function');
  });
});

// ---- 回归-006: PageShell 不导入未使用的组件 ----
describe('Regression: PageShell clean imports', () => {
  it('should render correctly without Spin dependency', () => {
    render(<PageShell title="Test">Content</PageShell>);
    expect(screen.getByText('Test')).toBeDefined();
    expect(screen.getByText('Content')).toBeDefined();
  });

  it('should show skeleton when loading', () => {
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
