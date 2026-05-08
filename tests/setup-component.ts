/**
 * Vitest 组件测试 setup
 * - Mock Electron APIs
 * - 轻量替代部分 Pro 组件
 */
import React from 'react';
import { vi } from 'vitest';

vi.mock('@ant-design/pro-components', () => {
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

const mockElectronAPI = {
  invoke: vi.fn().mockResolvedValue({ success: true, data: null }),
  on: vi.fn().mockReturnValue(() => {}),
  off: vi.fn(),
};

Object.defineProperty(globalThis.window ?? globalThis, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
  configurable: true,
});
