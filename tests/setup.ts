/**
 * Vitest 全局 setup
 * - Mock Electron APIs
 * - 设置全局 DOM 环境
 */
import React from 'react';
import { vi } from 'vitest';

vi.mock('@ant-design/pro-components', async () => {
  const actual = await vi.importActual<typeof import('@ant-design/pro-components')>(
    '@ant-design/pro-components',
  );

  const renderContainer = ({
    children,
    title,
    extra,
    ...props
  }: {
    children?: React.ReactNode;
    title?: React.ReactNode;
    extra?: React.ReactNode;
    [key: string]: unknown;
  }) =>
    React.createElement(
      'section',
      props,
      title || extra
        ? [
            React.createElement(
              'header',
              { key: 'header' },
              [title, extra].filter(Boolean).map((node, index) =>
                React.createElement('div', { key: index }, node),
              ),
            ),
            children,
          ]
        : children,
    );

  return {
    ...actual,
    ProCard: renderContainer,
    PageContainer: renderContainer,
    ProLayout: ({
      children,
      headerTitleRender,
      menuFooterRender,
      title,
      logo,
      ...props
    }: {
      children?: React.ReactNode;
      headerTitleRender?: (logo: React.ReactNode, title: React.ReactNode) => React.ReactNode;
      menuFooterRender?: (props?: { collapsed?: boolean }) => React.ReactNode;
      title?: React.ReactNode;
      logo?: React.ReactNode;
      [key: string]: unknown;
    }) =>
      React.createElement(
        'div',
        props,
        [
          headerTitleRender ? headerTitleRender(logo, title) : null,
          children,
          menuFooterRender ? menuFooterRender({ collapsed: false }) : null,
        ].filter(Boolean),
      ),
  };
});

// Mock window.electronAPI for renderer tests
const mockElectronAPI = {
  invoke: vi.fn().mockResolvedValue({ success: true, data: null }),
  on: vi.fn().mockReturnValue(() => {}),
  off: vi.fn(),
};

// Attach electronAPI to the existing window (don't replace window itself)
Object.defineProperty(globalThis.window ?? globalThis, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
  configurable: true,
});
