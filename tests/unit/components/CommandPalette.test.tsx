import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resetCommandRegistry } from '@renderer/shared/components/CommandPalette/CommandRegistry';

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@ant-design/icons', () => ({
  AppstoreOutlined: () => <span>appstore</span>,
  CheckCircleOutlined: () => <span>check</span>,
  DatabaseOutlined: () => <span>database</span>,
  FireOutlined: () => <span>fire</span>,
  FundOutlined: () => <span>fund</span>,
  GlobalOutlined: () => <span>global</span>,
  PlusOutlined: () => <span>plus</span>,
  ReloadOutlined: () => <span>reload</span>,
  RobotOutlined: () => <span>robot</span>,
  SearchOutlined: () => <span>search</span>,
  SettingOutlined: () => <span>setting</span>,
}));

vi.mock('antd', () => {
  const Input = React.forwardRef<
    HTMLInputElement,
    {
      onChange?: (event: { target: { value: string } }) => void;
      value?: string;
      placeholder?: string;
    }
  >(({ onChange, value, placeholder }, ref) => (
    <input
      ref={ref}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange?.({ target: { value: event.currentTarget.value } })}
    />
  ));
  Input.displayName = 'MockInput';

  const List = Object.assign(
    ({
      dataSource,
      renderItem,
    }: {
      dataSource?: unknown[];
      renderItem?: (item: unknown, index: number) => React.ReactNode;
    }) => (
      <div>
        {dataSource?.map((item, index) => (
          <React.Fragment key={index}>{renderItem?.(item, index)}</React.Fragment>
        ))}
      </div>
    ),
    {
      Item: ({
        children,
        onClick,
        ...props
      }: {
        children?: React.ReactNode;
        onClick?: () => void;
        [key: string]: unknown;
      }) => (
        <button type="button" onClick={onClick} {...props}>
          {children}
        </button>
      ),
    },
  );

  return {
  Input,
  List,
  Modal: ({
    children,
    open,
  }: {
    children?: React.ReactNode;
    open?: boolean;
  }) => (open ? <div>{children}</div> : null),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
  };
});

import CommandPalette from '@renderer/shared/components/CommandPalette/CommandPalette';

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCommandRegistry();
    localStorage.clear();
  });

  it('navigates to hot monitor from the command palette', async () => {
    render(<CommandPalette />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.change(screen.getByPlaceholderText('输入命令或搜索...'), {
      target: { value: '热点' },
    });

    const item = await screen.findByTestId('command-item-nav:hot-monitor');
    fireEvent.click(item);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/hot-monitor');
    });
  });
});
