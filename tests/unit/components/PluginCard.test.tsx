import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PluginCard } from '@renderer/entries/plugin-center/components/PluginCard';
import { PluginStatus } from '@shared/types';

const mockPlugin = {
  manifest: {
    name: 'test-plugin',
    version: '1.0.0',
    displayName: 'Test Plugin',
    description: 'A test plugin',
    main: 'index.js',
    permissions: ['fs:read'],
    permissionLevel: 1 as const,
    engines: { yclaw: '>=1.0.0' },
  },
  status: PluginStatus.ACTIVE,
  path: '/plugins/test-plugin',
};

describe('PluginCard', () => {
  const onToggle = vi.fn();
  const onUninstall = vi.fn();
  const onViewDetails = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render plugin info', () => {
    render(
      <PluginCard
        plugin={mockPlugin}
        onToggle={onToggle}
        onUninstall={onUninstall}
        onViewDetails={onViewDetails}
      />,
    );
    expect(screen.getByText('Test Plugin')).toBeDefined();
    expect(screen.getByText('v1.0.0')).toBeDefined();
    expect(screen.getByText('A test plugin')).toBeDefined();
  });

  it('should show active state', () => {
    render(
      <PluginCard
        plugin={mockPlugin}
        onToggle={onToggle}
        onUninstall={onUninstall}
        onViewDetails={onViewDetails}
      />,
    );
    const toggle = screen.getByRole('switch') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('should call onToggle when toggle clicked', () => {
    render(
      <PluginCard
        plugin={mockPlugin}
        onToggle={onToggle}
        onUninstall={onUninstall}
        onViewDetails={onViewDetails}
      />,
    );
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith('test-plugin', false);
  });

  it('should call onUninstall when uninstall clicked', () => {
    render(
      <PluginCard
        plugin={mockPlugin}
        onToggle={onToggle}
        onUninstall={onUninstall}
        onViewDetails={onViewDetails}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /卸\s*载/ }));
    expect(onUninstall).toHaveBeenCalledWith('test-plugin');
  });

  it('should call onViewDetails when details clicked', () => {
    render(
      <PluginCard
        plugin={mockPlugin}
        onToggle={onToggle}
        onUninstall={onUninstall}
        onViewDetails={onViewDetails}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /详\s*情/ }));
    expect(onViewDetails).toHaveBeenCalledWith('test-plugin');
  });

  it('should display inactive plugin correctly', () => {
    const inactivePlugin = {
      ...mockPlugin,
      status: PluginStatus.INACTIVE,
    };
    render(
      <PluginCard
        plugin={inactivePlugin}
        onToggle={onToggle}
        onUninstall={onUninstall}
        onViewDetails={onViewDetails}
      />,
    );
    const toggle = screen.getByRole('switch') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });
});
