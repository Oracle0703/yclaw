import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
