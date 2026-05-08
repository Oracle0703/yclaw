import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('antd', () => {
  return {
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    Row: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Col: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Space: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Typography: {
      Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    },
    Form: Object.assign(
      ({ children }: { children: React.ReactNode }) => <form>{children}</form>,
      {
        Item: ({
          children,
          label,
        }: {
          children: React.ReactNode;
          label?: React.ReactNode;
        }) => (
          <div>
            {label ? <span>{label}</span> : null}
            {children}
          </div>
        ),
      },
    ),
    Input: ({
      value,
      onChange,
      placeholder,
    }: {
      value?: string;
      onChange?: (event: { target: { value: string } }) => void;
      placeholder?: string;
    }) => (
      <input
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange?.({ target: { value: event.target.value } })}
      />
    ),
    Select: ({
      value,
      options = [],
      onChange,
    }: {
      value?: string;
      options?: Array<{ value: string; label: string }>;
      onChange?: (value: string) => void;
    }) => (
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
    InputNumber: ({
      value,
      onChange,
    }: {
      value?: number;
      onChange?: (value: number | null) => void;
    }) => (
      <input
        type="number"
        value={value ?? ''}
        onChange={(event) =>
          onChange?.(event.target.value === '' ? null : Number(event.target.value))
        }
      />
    ),
  };
});

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

  it('imports recorded steps into the editor', () => {
    const recordedSteps: TaskStep[] = [
      {
        id: 'recorded-1',
        name: 'Recorded Step',
        action: { type: 'extract', selector: '.price' },
      },
    ];

    render(
      <StepEditor
        steps={steps}
        onChange={onChange}
        recordedSteps={recordedSteps}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /导入录制结果/ }));

    expect(onChange).toHaveBeenCalledWith(recordedSteps);
  });
});
