import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
  StepEditor: ({
    steps,
    onChange,
  }: {
    steps: Array<{ id: string }>;
    onChange: (steps: Array<{
      id: string;
      name: string;
      action: { type: string; selector: string };
    }>) => void;
  }) => (
    <div>
      <div>编辑器步骤数:{steps.length}</div>
      <button
        type="button"
        onClick={() =>
          onChange([
            {
              id: 'step-1',
              name: '打开页面',
              action: { type: 'click', selector: '#open' },
            },
            {
              id: 'step-2',
              name: '采集价格',
              action: { type: 'extract', selector: '.price' },
            },
            {
              id: 'step-3',
              name: '截图存档',
              action: { type: 'screenshot', selector: 'body' },
            },
          ])
        }
      >
        模拟编辑步骤
      </button>
    </div>
  ),
}));

vi.mock('@renderer/entries/automation/components/ExecutionPanel', () => ({
  ExecutionPanel: ({ totalSteps }: { totalSteps: number }) => <div>总步骤:{totalSteps}</div>,
}));

import AutomationApp from '@renderer/entries/automation/App';

describe('Automation App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.electronAPI.invoke.mockResolvedValue({
      success: true,
      data: {
        id: 'task-1',
        name: '采集任务',
        steps: [
          {
            id: 'step-1',
            name: '打开页面',
            action: { type: 'click', selector: '#open' },
          },
          {
            id: 'step-2',
            name: '采集数据',
            action: { type: 'extract', selector: '.price' },
          },
        ],
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
      },
    });
  });

  it('uses selected task summary stepsCount as execution total when persisted steps fail to load', async () => {
    window.electronAPI.invoke.mockRejectedValueOnce(new Error('load task failed'));

    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));
    fireEvent.click(screen.getByRole('button', { name: /打开执行面板/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('task:get', { taskId: 'task-1' });
    });
    expect(screen.getByText('总步骤:3')).toBeDefined();
  });

  it('loads persisted task steps into editor when selecting an existing task', async () => {
    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith('task:get', { taskId: 'task-1' });
    });
    expect(await screen.findByText('编辑器步骤数:2')).toBeDefined();
  });

  it('saves edited steps for the selected task', async () => {
    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: '选择任务' }));
    await screen.findByText('编辑器步骤数:2');

    fireEvent.click(screen.getByRole('button', { name: '模拟编辑步骤' }));
    fireEvent.click(screen.getByRole('button', { name: '保存任务' }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(
        'task:save',
        expect.objectContaining({
          taskId: 'task-1',
          steps: expect.arrayContaining([
            expect.objectContaining({ id: 'step-3' }),
          ]),
        }),
      );
    });
  });

  it('creates a new task when saving after clicking 新建任务', async () => {
    window.electronAPI.invoke.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'task-new-1',
        name: '未命名任务',
        steps: [
          {
            id: 'step-new-1',
            name: '打开首页',
            action: { type: 'click', selector: '#home' },
          },
        ],
        createdAt: '2026-04-16T00:00:00.000Z',
        updatedAt: '2026-04-16T00:00:00.000Z',
      },
    });

    render(<AutomationApp />);

    fireEvent.click(screen.getByRole('button', { name: /新建任务/ }));
    fireEvent.click(screen.getByRole('button', { name: '模拟编辑步骤' }));
    fireEvent.click(screen.getByRole('button', { name: '保存任务' }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(
        'task:save',
        expect.objectContaining({
          taskId: null,
          steps: expect.arrayContaining([
            expect.objectContaining({ id: 'step-3' }),
          ]),
        }),
      );
    });
  });
});
