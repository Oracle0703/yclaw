import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@renderer/entries/automation/components/TaskList', () => ({
  TaskList: ({
    onSelect,
  }: {
    onSelect: (task: { id: string; stepsCount?: number } | 'new') => void;
  }) => (
    <button type="button" onClick={() => onSelect({ id: 'task-1', stepsCount: 3 })}>
      选择任务
    </button>
  ),
}));

vi.mock('@renderer/entries/automation/components/StepEditor', () => ({
  StepEditor: () => <div>StepEditor Mock</div>,
}));

vi.mock('@renderer/entries/automation/components/ExecutionPanel', () => ({
  ExecutionPanel: ({ totalSteps }: { totalSteps: number }) => <div>总步骤:{totalSteps}</div>,
}));

import AutomationApp from '@renderer/entries/automation/App';

describe('Automation App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses selected task summary stepsCount as execution total when editor has no local steps', () => {
    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));
    fireEvent.click(screen.getByRole('button', { name: /打开执行面板/ }));

    expect(screen.getByText('总步骤:3')).toBeDefined();
  });
});
