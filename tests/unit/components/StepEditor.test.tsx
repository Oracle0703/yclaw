import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepEditor } from '@renderer/entries/automation/components/StepEditor';
import type { TaskStep } from '@shared/types';

describe('StepEditor', () => {
  const onChange = vi.fn();

  const steps: TaskStep[] = [
    {
      id: 'step-0',
      name: 'Click Login',
      action: { type: 'click', selector: '#login-btn' },
    },
    {
      id: 'step-1',
      name: 'Input Username',
      action: { type: 'input', selector: '#username', params: { value: 'admin' } },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render step list', () => {
    render(<StepEditor steps={steps} onChange={onChange} />);
    expect(screen.getByDisplayValue('Click Login')).toBeDefined();
    expect(screen.getByDisplayValue('Input Username')).toBeDefined();
  });

  it('should show selector field for each step', () => {
    render(<StepEditor steps={steps} onChange={onChange} />);
    expect(screen.getByDisplayValue('#login-btn')).toBeDefined();
    expect(screen.getByDisplayValue('#username')).toBeDefined();
  });

  it('should have add step button', () => {
    render(<StepEditor steps={steps} onChange={onChange} />);
    const addButton = screen.getByText(/添加步骤|添加|新增/);
    expect(addButton).toBeDefined();
  });

  it('should call onChange when adding a step', () => {
    render(<StepEditor steps={steps} onChange={onChange} />);
    const addButton = screen.getByText(/添加步骤|添加|新增/);
    fireEvent.click(addButton);
    expect(onChange).toHaveBeenCalled();
    const newSteps = onChange.mock.calls[0][0] as TaskStep[];
    expect(newSteps.length).toBe(3);
  });

  it('should call onChange when removing a step', () => {
    render(<StepEditor steps={steps} onChange={onChange} />);
    const deleteButtons = screen.getAllByRole('button', { name: /删\s*除/ });
    fireEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalled();
    const newSteps = onChange.mock.calls[0][0] as TaskStep[];
    expect(newSteps.length).toBe(1);
  });

  it('should render action type selectors', () => {
    render(<StepEditor steps={steps} onChange={onChange} />);
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });
});
