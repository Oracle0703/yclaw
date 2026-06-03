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
  DownloadOutlined: () => <span>download</span>,
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
  function MockListItem({
    actions,
    children,
    onClick,
  }: {
    actions?: React.ReactNode[];
    children?: React.ReactNode;
    onClick?: () => void;
  }) {
    return (
      <div role="button" tabIndex={0} onClick={onClick}>
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
    Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
      <button type="button" onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}>
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

import ResultLibrary from '@renderer/entries/workbench/pages/ResultLibrary';

describe('ResultLibrary page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.value = new URLSearchParams('taskId=task-jd');
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TASK_LIST) {
        return [{ id: 'task-jd', name: '京东签到', kind: 'jd-signin', status: 'idle', updatedAt: '2026-06-01' }];
      }
      if (channel === IPC_CHANNELS.RESULT_LIST) {
        return [];
      }
      if (channel === IPC_CHANNELS.SIGNIN_TASK_HISTORY) {
        return [
          {
            taskId: 'task-jd',
            status: 'success',
            reward: { detailText: '获得 10 京豆' },
            runAt: '2026-06-01T09:00:00.000Z',
            retryCount: 0,
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST || channel === IPC_CHANNELS.HOT_REPORT_LIST) {
        return [];
      }
      return null;
    });
  });

  it('renders sign-in projected results without calling standard result detail', async () => {
    render(<ResultLibrary />);

    expect(await screen.findByText('京东签到')).toBeDefined();
    expect(screen.getAllByText(/未绑定批次/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/获得 10 京豆/).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(invokeMock).not.toHaveBeenCalledWith(IPC_CHANNELS.RESULT_DETAIL, expect.anything());
    });
  });

  it('loads hot reports and opens hot report files without using standard result export', async () => {
    searchParamsState.value = new URLSearchParams('');
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TASK_LIST || channel === IPC_CHANNELS.RESULT_LIST) {
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
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) {
        return [
          {
            id: 'report-hot',
            sourceId: 'source-hot',
            batchId: 'batch-hot',
            title: '热点报告',
            format: 'html',
            filePath: '/tmp/report.html',
            createdAt: '2026-06-03T10:00:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_DETAIL) {
        return {
          id: 'report-hot',
          sourceId: 'source-hot',
          batchId: 'batch-hot',
          title: '热点报告详情',
          format: 'html',
          filePath: '/tmp/report.html',
          createdAt: '2026-06-03T10:00:00.000Z',
        };
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_REVEAL) {
        return { revealed: true };
      }
      return [];
    });

    render(<ResultLibrary />);

    expect(await screen.findByText('热点报告')).toBeDefined();
    fireEvent.click(screen.getByText('热点报告'));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_DETAIL, {
        reportId: 'report-hot',
      });
    });

    fireEvent.click(
      screen.getAllByRole('button', { name: /打开报告/ }).find((element) => element.tagName === 'BUTTON')!,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_REVEAL, {
        reportId: 'report-hot',
      });
      expect(invokeMock).not.toHaveBeenCalledWith(IPC_CHANNELS.RESULT_EXPORT, expect.anything());
    });
  });

  it('uses Data Center detail and export jobs for standard results', async () => {
    searchParamsState.value = new URLSearchParams('');
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.TASK_LIST) {
        return [];
      }
      if (channel === IPC_CHANNELS.RESULT_LIST) {
        return [
          {
            id: 'result-1',
            taskId: 'task-1',
            batchId: 'batch-1',
            data: { title: '标准结果' },
            status: 'normal',
            createdAt: '2026-06-03T10:00:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST || channel === IPC_CHANNELS.HOT_REPORT_LIST) {
        return [];
      }
      if (channel === IPC_CHANNELS.DATA_CENTER_RESULTS_DETAIL) {
        return {
          result: {
            id: 'result-1',
            taskId: 'task-1',
            batchId: 'batch-1',
            data: { title: '标准结果详情' },
            status: 'normal',
            createdAt: '2026-06-03T10:00:00.000Z',
          },
          batch: null,
          logs: [],
          exports: [],
        };
      }
      if (channel === IPC_CHANNELS.DATA_CENTER_EXPORTS_CREATE) {
        return { id: 'export-1', status: 'succeeded', outputPath: '/tmp/export.json' };
      }
      return [];
    });

    render(<ResultLibrary />);

    expect(await screen.findByText('标准结果')).toBeDefined();
    fireEvent.click(screen.getByText('标准结果'));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.DATA_CENTER_RESULTS_DETAIL, {
        resultId: 'result-1',
      });
    });

    fireEvent.click(
      screen.getAllByRole('button', { name: /JSON/ }).find((element) => element.tagName === 'BUTTON')!,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.DATA_CENTER_EXPORTS_CREATE,
        expect.objectContaining({
          name: '任务结果-result-1',
          query: {
            taskId: 'task-1',
            batchId: 'batch-1',
            page: 1,
            pageSize: 500,
          },
          format: 'json',
          targetType: 'file',
          targetConfig: {},
        }),
      );
      expect(invokeMock).not.toHaveBeenCalledWith(IPC_CHANNELS.RESULT_EXPORT, expect.anything());
    });
  });
});
