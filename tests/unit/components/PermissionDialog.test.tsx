import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('antd', () => {
  return {
    Modal: ({
      children,
      title,
      okText,
      cancelText,
      onOk,
      onCancel,
    }: {
      children?: React.ReactNode;
      title?: React.ReactNode;
      okText?: React.ReactNode;
      cancelText?: React.ReactNode;
      onOk?: () => void;
      onCancel?: () => void;
    }) => (
      <section>
        <header>{title}</header>
        <div>{children}</div>
        <footer>
          <button type="button" onClick={onOk}>
            {okText}
          </button>
          <button type="button" onClick={onCancel}>
            {cancelText}
          </button>
        </footer>
      </section>
    ),
    List: Object.assign(
      ({
        dataSource = [],
        renderItem,
      }: {
        dataSource?: string[];
        renderItem: (item: string) => React.ReactNode;
      }) => (
        <ul>
          {dataSource.map((item) => (
            <React.Fragment key={item}>{renderItem(item)}</React.Fragment>
          ))}
        </ul>
      ),
      {
        Item: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
      },
    ),
    Alert: ({ message }: { message?: React.ReactNode }) => <div>{message}</div>,
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    },
  };
});

import { PermissionDialog } from '@renderer/entries/plugin-center/components/PermissionDialog';

describe('PermissionDialog', () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render plugin name', () => {
    render(
      <PermissionDialog
        pluginName="my-plugin"
        permissions={['fs:read']}
        permissionLevel={1}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText(/my-plugin/)).toBeDefined();
  });

  it('should render permission list', () => {
    render(
      <PermissionDialog
        pluginName="test"
        permissions={['fs:read', 'net:request']}
        permissionLevel={2}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('fs:read')).toBeDefined();
    expect(screen.getByText('net:request')).toBeDefined();
  });

  it('should show warning for L3 permissions', () => {
    render(
      <PermissionDialog
        pluginName="dangerous"
        permissions={['shell:exec']}
        permissionLevel={3}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    // Should contain warning text about high-level permissions
    const container = screen.getByText(/高级权限|信任来源/);
    expect(container).toBeDefined();
  });

  it('should call onConfirm when confirm button clicked', () => {
    render(
      <PermissionDialog
        pluginName="test"
        permissions={['fs:read']}
        permissionLevel={1}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /允\s*许/ }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('should call onCancel when cancel button clicked', () => {
    render(
      <PermissionDialog
        pluginName="test"
        permissions={['fs:read']}
        permissionLevel={1}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
    expect(onCancel).toHaveBeenCalled();
  });
});
