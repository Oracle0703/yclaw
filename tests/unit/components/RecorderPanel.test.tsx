import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecorderPanel } from '@renderer/entries/browser/components/RecorderPanel';
import { IPC_CHANNELS } from '@shared/constants';

describe('RecorderPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.RECORDER_START) {
        return { success: true, data: { recording: true } } as never;
      }

      if (channel === IPC_CHANNELS.RECORDER_STOP) {
        return {
          success: true,
          data: [
            {
              id: 'recorded-1',
              name: '点击价格',
              action: { type: 'click', selector: '.price' },
            },
          ],
        } as never;
      }

      return { success: true, data: null } as never;
    });
  });

  it('starts recording through recorder:start', async () => {
    render(<RecorderPanel tabId={101} onRecorded={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /开始录制/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.RECORDER_START, {
        tabId: 101,
      });
    });
  });

  it('stops recording and previews recorded steps', async () => {
    const onRecorded = vi.fn();
    render(<RecorderPanel tabId={101} onRecorded={onRecorded} />);

    expect(screen.getByRole('button', { name: /停止录制/ })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: /开始录制/ }));
    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.RECORDER_START, {
        tabId: 101,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /停止录制/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.RECORDER_STOP, {
        tabId: 101,
      });
    });
    expect(onRecorded).toHaveBeenCalledWith([
      {
        id: 'recorded-1',
        name: '点击价格',
        action: { type: 'click', selector: '.price' },
      },
    ]);
    expect(screen.getByText(/点击价格/)).toBeDefined();
  });
});
