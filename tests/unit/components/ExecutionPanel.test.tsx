import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutionPanel } from '@renderer/entries/automation/components/ExecutionPanel';

// window.electronAPI is mocked globally in tests/setup.ts

describe('ExecutionPanel', () => {
  const defaultProps = {
    taskId: 'task-1',
    status: 'idle',
    currentStep: 0,
    totalSteps: 5,
    logs: [] as string[],
    hasBreakpoint: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render execution panel header', () => {
    render(<ExecutionPanel {...defaultProps} />);
    expect(screen.getByText('执行面板')).toBeDefined();
  });

  it('should display status', () => {
    render(<ExecutionPanel {...defaultProps} status="running" />);
    expect(screen.getByText(/running/)).toBeDefined();
  });

  it('should render start button', () => {
    render(<ExecutionPanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /启\s*动/ })).toBeDefined();
  });

  it('should render pause button', () => {
    render(<ExecutionPanel {...defaultProps} status="running" />);
    expect(screen.getByRole('button', { name: /暂\s*停/ })).toBeDefined();
  });

  it('should render resume button', () => {
    render(<ExecutionPanel {...defaultProps} status="paused" />);
    expect(screen.getByRole('button', { name: /继\s*续/ })).toBeDefined();
  });

  it('should render stop button', () => {
    render(<ExecutionPanel {...defaultProps} status="running" />);
    expect(screen.getByRole('button', { name: /停\s*止/ })).toBeDefined();
  });

  it('should display progress', () => {
    render(<ExecutionPanel {...defaultProps} status="running" currentStep={3} totalSteps={5} />);
    expect(screen.getByText('3 / 5')).toBeDefined();
  });

  it('should display logs', () => {
    const logs = ['Step 1 completed', 'Step 2 failed'];
    render(<ExecutionPanel {...defaultProps} logs={logs} />);
    expect(screen.getByText('Step 1 completed')).toBeDefined();
    expect(screen.getByText('Step 2 failed')).toBeDefined();
  });

  it('should show breakpoint resume button when hasBreakpoint', () => {
    render(<ExecutionPanel {...defaultProps} hasBreakpoint={true} />);
    expect(screen.getByText(/从断点继续/)).toBeDefined();
  });

  it('should disable start when running', () => {
    render(<ExecutionPanel {...defaultProps} status="running" />);
    const startBtn = screen.getByRole('button', { name: /启\s*动/ });
    expect(startBtn).toHaveProperty('disabled', true);
  });

  it('should call invoke on start click', () => {
    render(<ExecutionPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /启\s*动/ }));
    expect(window.electronAPI.invoke).toHaveBeenCalled();
  });
});
