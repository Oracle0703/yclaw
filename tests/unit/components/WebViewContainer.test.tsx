/**
 * 回归测试: WebViewContainer 占位组件
 *
 * - #1: WebViewContainer.tsx 文件缺失问题
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { WebViewContainer } from '@renderer/entries/browser/components/WebViewContainer';

describe('Regression: WebViewContainer', () => {
  it('should be importable (file exists)', () => {
    expect(WebViewContainer).toBeDefined();
    expect(typeof WebViewContainer).toBe('function');
  });

  it('should render empty state when tabId is null', () => {
    render(<WebViewContainer tabId={null} url="" />);
    expect(screen.getByText(/新建标签页/)).toBeDefined();
  });

  it('should render container with tab info when tabId is provided', () => {
    const { container } = render(<WebViewContainer tabId={42} url="https://example.com" />);
    const el = container.querySelector('[data-tab-id="42"]');
    expect(el).toBeTruthy();
    expect(screen.getByText(/Tab #42/)).toBeDefined();
    expect(screen.getByText(/example\.com/)).toBeDefined();
  });
});
