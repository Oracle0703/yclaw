import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TaskList } from '@renderer/entries/automation/components/TaskList';

describe('TaskList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 0 steps when task summary misses stepsCount', async () => {
    window.electronAPI.invoke.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'task-1',
          name: '采集任务',
          status: 'idle',
          updatedAt: '2026-04-15 10:00:00',
        },
      ],
    });

    render(<TaskList onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('采集任务')).toBeDefined();
    });

    expect(screen.getByText('0')).toBeDefined();
  });
});
