import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants';

const { invokeMock, navigateMock, searchParamsState, messageSuccessMock, messageErrorMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  navigateMock: vi.fn(),
  searchParamsState: { value: new URLSearchParams('taskId=task-jd') },
  messageSuccessMock: vi.fn(),
  messageErrorMock: vi.fn(),
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({ invoke: invokeMock }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [searchParamsState.value],
}));

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));

vi.mock('@ant-design/icons', () => ({
  ReloadOutlined: () => <span>reload</span>,
}));

vi.mock('antd', () => {
  function MockList({
    dataSource = [],
    renderItem,
  }: {
    dataSource?: unknown[];
    renderItem?: (item: unknown) => React.ReactNode;
  }) {
    return <div>{dataSource.map((item, index) => <React.Fragment key={index}>{renderItem?.(item)}</React.Fragment>)}</div>;
  }
  function MockListItem({ actions, children }: { actions?: React.ReactNode[]; children?: React.ReactNode }) {
    return (
      <div>
        {children}
        {actions}
      </div>
    );
  }
  function MockListItemMeta({ title, description }: { title?: React.ReactNode; description?: React.ReactNode }) {
    return (
      <div>
        {title}
        {description}
      </div>
    );
  }
  const List = Object.assign(MockList, {
    Item: Object.assign(MockListItem, {
      Meta: MockListItemMeta,
    }),
  });
  const Descriptions = Object.assign(
    ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    {
      Item: ({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => (
        <div>
          {label}
          {children}
        </div>
      ),
    },
  );

  return {
    Alert: ({ message }: { message?: React.ReactNode }) => <div>{message}</div>,
    Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
    Card: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
      <section>
        {title}
        {children}
      </section>
    ),
    Descriptions,
    List,
    Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Typography: {
      Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
      Title: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
    },
    message: {
      success: messageSuccessMock,
      error: messageErrorMock,
    },
  };
});

import RunMonitor from '@renderer/entries/workbench/pages/RunMonitor';

describe('RunMonitor page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.value = new URLSearchParams('taskId=task-jd');
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TASK_LIST) {
        return [{ id: 'task-jd', name: '京东签到', kind: 'jd-signin', status: 'idle', updatedAt: '2026-06-01' }];
      }
      if (channel === IPC_CHANNELS.TASK_BATCH_LIST) {
        return [];
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_HISTORY) {
        return [
          {
            taskId: 'task-jd',
            status: 'needs_intervention',
            failureReason: 'session_expired',
            detail: '登录态失效',
            runAt: '2026-06-01T09:00:00.000Z',
            retryCount: 0,
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST || channel === IPC_CHANNELS.HOT_RUN_LIST) {
        return [];
      }
      return null;
    });
  });

  it('shows sign-in intervention runs without requiring a standard batch', async () => {
    render(<RunMonitor />);

    expect(await screen.findByText('需人工介入')).toBeDefined();
    expect(screen.getByText('signin:task-jd:2026-06-01T09:00:00.000Z')).toBeDefined();
    expect(screen.getByText('登录态失效')).toBeDefined();
  });

  it('calls sign-in intervention retry for intervention records', async () => {
    render(<RunMonitor />);

    await screen.findByText('需人工介入');
    fireEvent.click(screen.getByRole('button', { name: '重新运行' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.SIGNIN_TASK_INTERVENTION_RETRY, {
        taskId: 'task-jd',
      });
      expect(messageSuccessMock).toHaveBeenCalledWith('已提交介入后重试');
    });
  });

  it('loads hot runs and can generate a hot report', async () => {
    searchParamsState.value = new URLSearchParams('');
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TASK_LIST) {
        return [];
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
        return [
          {
            id: 'source-hot',
            taskId: 'task-hot',
            name: '热点监控',
            sourceKind: 'api',
            siteKey: 'trendradar',
            entryUrl: 'https://newsnow.busiyi.world/',
            parserKey: 'newsnow.batch',
            enabled: true,
            tags: [],
            createdAt: '2026-06-03T09:00:00.000Z',
            updatedAt: '2026-06-03T09:00:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        return [
          {
            batchId: 'batch-hot',
            sourceId: 'source-hot',
            sourceName: '热点监控',
            status: 'success',
            resultCount: 3,
            reportStatus: 'pending',
            startedAt: '2026-06-03T10:00:00.000Z',
            finishedAt: '2026-06-03T10:01:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_GENERATE) {
        return {
          id: 'report-hot',
          sourceId: 'source-hot',
          batchId: 'batch-hot',
          title: '热点报告',
          format: 'html',
          filePath: '/tmp/report.html',
          createdAt: '2026-06-03T10:02:00.000Z',
        };
      }
      return [];
    });

    render(<RunMonitor />);

    expect(await screen.findByText('hot:source-hot:batch-hot')).toBeDefined();
    expect(screen.getByText(/结果数量3/)).toBeDefined();
    expect(screen.getByText(/报告状态未生成/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '生成报告' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_GENERATE, {
        sourceId: 'source-hot',
        batchId: 'batch-hot',
        format: 'html',
      });
      expect(messageSuccessMock).toHaveBeenCalledWith('热点报告已生成');
    });
  });
});
