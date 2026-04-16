/**
 * 回归测试: WebViewContainer 占位组件
 *
 * - #1: WebViewContainer.tsx 文件缺失问题
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('antd', () => {
  function MockDescriptions({ children }: { children?: React.ReactNode }) {
    return <dl>{children}</dl>;
  }
  function MockDescriptionsItem({
    children,
    label,
  }: {
    children?: React.ReactNode;
    label?: React.ReactNode;
  }) {
    return (
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    );
  }
  MockDescriptions.Item = MockDescriptionsItem;

  return {
    Descriptions: MockDescriptions,
    Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    },
  };
});

import { WebViewContainer } from '@renderer/entries/browser/components/WebViewContainer';

describe('Regression: WebViewContainer', () => {
  it('should be importable (file exists)', () => {
    expect(WebViewContainer).toBeDefined();
    expect(typeof WebViewContainer).toBe('function');
  });

  it('should render empty state when tabId is null', () => {
    render(<WebViewContainer tab={null} />);
    expect(screen.getByText(/新建标签页/)).toBeDefined();
  });

  it('should render session console details for the active tab', () => {
    const { container } = render(
      <WebViewContainer
        tab={{
          id: 42,
          title: 'Example',
          url: 'https://example.com',
          loading: false,
          canGoBack: true,
          canGoForward: false,
          sessionPartition: 'persist:workspace-a',
        }}
      />,
    );
    const el = container.querySelector('[data-tab-id="42"]');
    expect(el).toBeTruthy();
    expect(screen.getByText(/Example/)).toBeDefined();
    expect(screen.getByText(/persist:workspace-a/)).toBeDefined();
    expect(screen.getByText(/可后退/)).toBeDefined();
  });

  it('should render intervention state details when provided', () => {
    render(
      <WebViewContainer
        tab={{
          id: 42,
          title: 'Example',
          url: 'https://example.com',
          loading: false,
          canGoBack: true,
          canGoForward: false,
          sessionPartition: 'persist:workspace-a',
        }}
        interventionState={{
          taskId: 'task-1',
          batchId: 'batch-1',
          flowRunnerStatus: 'intervention',
          webContentsId: 42,
          sessionPartition: 'persist:workspace-a',
          breakpoint: {
            stepIndex: 1,
            error: 'need login',
          },
        }}
      />,
    );

    expect(screen.getByText(/need login/)).toBeDefined();
    expect(screen.getByText(/batch-1/)).toBeDefined();
  });

  it('should not expose future-placeholder wording', () => {
    render(
      <WebViewContainer
        tab={{
          id: 7,
          title: 'Example',
          url: 'https://example.com',
          loading: false,
          canGoBack: false,
          canGoForward: false,
          sessionPartition: 'default',
        }}
      />,
    );
    expect(screen.queryByText(/后续迭代|后续实现|WebContentsView 容器占位/)).toBeNull();
  });
});
