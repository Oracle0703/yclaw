import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabBar } from '@renderer/entries/browser/components/TabBar';

describe('TabBar', () => {
  const tabs = [
    { id: 1, title: 'Google', url: 'https://google.com', loading: false },
    { id: 2, title: 'GitHub', url: 'https://github.com', loading: true },
  ];
  const onSwitch = vi.fn();
  const onClose = vi.fn();
  const onNew = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render tabs', () => {
    render(
      <TabBar tabs={tabs} activeTabId={1} onSwitch={onSwitch} onClose={onClose} onNew={onNew} />,
    );
    expect(screen.getByText(/Google/)).toBeDefined();
    expect(screen.getByText(/GitHub/)).toBeDefined();
  });

  it('should highlight active tab', () => {
    render(
      <TabBar tabs={tabs} activeTabId={1} onSwitch={onSwitch} onClose={onClose} onNew={onNew} />,
    );
    const activeTab = screen.getByText('Google').closest('.tab');
    expect(activeTab?.className).toContain('active');
  });

  it('should call onSwitch when clicking a tab', () => {
    render(
      <TabBar tabs={tabs} activeTabId={1} onSwitch={onSwitch} onClose={onClose} onNew={onNew} />,
    );
    // Click the tab-title span containing "GitHub" (may include loading emoji)
    const githubTab = screen.getByText(/GitHub/).closest('.tab');
    fireEvent.click(githubTab!);
    expect(onSwitch).toHaveBeenCalledWith(2);
  });

  it('should call onNew when clicking add button', () => {
    render(
      <TabBar tabs={tabs} activeTabId={1} onSwitch={onSwitch} onClose={onClose} onNew={onNew} />,
    );
    const addButton = screen.getByText('+');
    fireEvent.click(addButton);
    expect(onNew).toHaveBeenCalled();
  });

  it('should render empty state when no tabs', () => {
    render(
      <TabBar tabs={[]} activeTabId={null} onSwitch={onSwitch} onClose={onClose} onNew={onNew} />,
    );
    expect(screen.getByText('+')).toBeDefined();
  });
});
