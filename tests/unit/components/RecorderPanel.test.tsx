import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('antd', () => {
  function MockList({
    dataSource = [],
    renderItem,
  }: {
    dataSource?: Array<Record<string, unknown>>;
    renderItem: (item: Record<string, unknown>) => React.ReactNode;
  }) {
    return <div>{dataSource.map((item) => React.createElement(React.Fragment, { key: String(item.id) }, renderItem(item)))}</div>;
  }
  function MockListItem({ children }: { children?: React.ReactNode }) {
    return <div>{children}</div>;
  }
  MockList.Item = MockListItem;

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
    Card: ({
      children,
      title,
      extra,
    }: {
      children?: React.ReactNode;
      title?: React.ReactNode;
      extra?: React.ReactNode;
    }) => (
      <section className="yclaw-panel-card">
        <header>
          <div>{title}</div>
          <div>{extra}</div>
        </header>
        {children}
      </section>
    ),
    List: MockList,
    Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    },
    message: {
      error: vi.fn(),
    },
  };
});

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

  it('starts investigation recording with site preset and previews network drafts', async () => {
    vi.mocked(window.electronAPI.invoke).mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.RECORDER_START) {
        return { success: true, data: { recording: true, mode: 'investigation' } } as never;
      }

      if (channel === IPC_CHANNELS.RECORDER_STOP) {
        return {
          success: true,
          data: {
            kind: 'investigation-recording',
            tabId: 101,
            startedAt: '2026-04-29T00:00:00.000Z',
            stoppedAt: '2026-04-29T00:01:00.000Z',
            sitePreset: 'jd',
            domainAllowlist: ['jd.com', 'api.m.jd.com'],
            steps: [],
            network: [
              {
                requestId: 'request-1',
                method: 'POST',
                url: 'https://api.m.jd.com/client.action?functionId=signBeanAct',
                requestHeaders: { cookie: 'pt_key=demo' },
                requestBody: 'functionId=signBeanAct',
                status: 200,
                responseHeaders: { 'content-type': 'application/json' },
                responseBody: '{"success":true}',
              },
            ],
            replayDrafts: [
              {
                method: 'POST',
                url: 'https://api.m.jd.com/client.action?functionId=signBeanAct',
                headers: { cookie: 'pt_key=demo' },
                body: 'functionId=signBeanAct',
                reason: 'matched keyword "sign"',
              },
            ],
          },
        } as never;
      }

      return { success: true, data: null } as never;
    });

    render(<RecorderPanel tabId={101} onRecorded={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /开始调查录制/ }));

    await waitFor(() => {
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.RECORDER_START, {
        tabId: 101,
        options: expect.objectContaining({
          mode: 'investigation',
          sitePreset: 'jd',
          includeNetwork: true,
          domainAllowlist: expect.arrayContaining(['jd.com', 'api.m.jd.com']),
        }),
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /停止录制/ }));

    await waitFor(() => {
      expect(screen.getByText(/网络请求：1/)).toBeDefined();
      expect(screen.getByText(/重放草案：1/)).toBeDefined();
      expect(screen.getByText(/signBeanAct/)).toBeDefined();
    });
  });

  it('creates a tab before starting investigation recording when no active tab exists', async () => {
    const createTab = vi.fn(async () => 202);

    render(<RecorderPanel tabId={null} onCreateTab={createTab} onRecorded={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /开始调查录制/ }));

    await waitFor(() => {
      expect(createTab).toHaveBeenCalled();
      expect(window.electronAPI.invoke).toHaveBeenCalledWith(IPC_CHANNELS.RECORDER_START, {
        tabId: 202,
        options: expect.objectContaining({
          mode: 'investigation',
          sitePreset: 'jd',
        }),
      });
    });
  });
});
