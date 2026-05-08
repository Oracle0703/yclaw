import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';

const { invokeMock, messageErrorMock, messageSuccessMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageErrorMock: vi.fn(),
  messageSuccessMock: vi.fn(),
}));

vi.mock('antd', () => ({
  Button: ({
    children,
    danger,
    disabled,
    onClick,
    type,
  }: {
    children?: React.ReactNode;
    danger?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    type?: string;
  }) => (
    <button
      type="button"
      data-danger={danger ? 'true' : undefined}
      data-type={type}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  Card: ({
    children,
    title,
  }: {
    children?: React.ReactNode;
    title?: React.ReactNode;
  }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  ),
  Drawer: ({
    children,
    open,
    title,
  }: {
    children?: React.ReactNode;
    open?: boolean;
    title?: React.ReactNode;
  }) => (open ? (
    <aside role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </aside>
  ) : null),
  Modal: ({
    children,
    open,
    title,
  }: {
    children?: React.ReactNode;
    open?: boolean;
    title?: React.ReactNode;
  }) => (open ? (
    <section role="dialog" aria-label={typeof title === 'string' ? title : undefined}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  ) : null),
  Checkbox: ({
    checked,
    children,
    onChange,
    'aria-label': ariaLabel,
  }: {
    checked?: boolean;
    children?: React.ReactNode;
    onChange?: (event: { target: { checked: boolean } }) => void;
    'aria-label'?: string;
  }) => (
    <label>
      <input
        aria-label={ariaLabel}
        type="checkbox"
        checked={checked ?? false}
        onChange={(event) => onChange?.({ target: { checked: event.target.checked } })}
      />
      {children}
    </label>
  ),
  Input: Object.assign(
    ({
      value,
      onChange,
      placeholder,
      'aria-label': ariaLabel,
      type,
    }: {
      value?: string | number;
      onChange?: (event: { target: { value: string } }) => void;
      placeholder?: string;
      'aria-label'?: string;
      type?: string;
    }) => (
      <input
        aria-label={ariaLabel}
        placeholder={placeholder}
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange?.({ target: { value: event.target.value } })}
      />
    ),
    {
      TextArea: ({
        value,
        onChange,
        placeholder,
      }: {
        value?: string;
        onChange?: (event: { target: { value: string } }) => void;
        placeholder?: string;
      }) => (
        <textarea
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(event) => onChange?.({ target: { value: event.target.value } })}
        />
      ),
    },
  ),
  Radio: Object.assign(
    ({
      checked,
      children,
      onChange,
      'aria-label': ariaLabel,
    }: {
      checked?: boolean;
      children?: React.ReactNode;
      onChange?: () => void;
      'aria-label'?: string;
    }) => (
      <label>
        <input
          aria-label={ariaLabel}
          type="radio"
          checked={checked ?? false}
          onChange={() => onChange?.()}
        />
        {children}
      </label>
    ),
    {
      Group: ({
        value,
        onChange,
        options,
        'aria-label': ariaLabel,
      }: {
        value?: string;
        onChange?: (event: { target: { value: string } }) => void;
        options?: Array<{ label: React.ReactNode; value: string }>;
        'aria-label'?: string;
      }) => (
        <div role="tablist" aria-label={ariaLabel}>
          {options?.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={value === option.value}
              onClick={() => onChange?.({ target: { value: option.value } })}
            >
              {option.label}
            </button>
          ))}
        </div>
      ),
    },
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  },
  message: {
    error: messageErrorMock,
    success: messageSuccessMock,
  },
}));

vi.mock('@ant-design/icons', () => ({
  FireOutlined: () => <span>fire</span>,
  SyncOutlined: () => <span>sync</span>,
}));

vi.mock('@ant-design/pro-components', () => ({
  ProTable: ({
    columns,
    dataSource,
    options,
    pagination,
    rowKey,
    search,
    toolBarRender,
  }: {
    columns: Array<{
      title: React.ReactNode;
      dataIndex?: string;
      key?: string;
      render?: (_: unknown, record: Record<string, unknown>) => React.ReactNode;
    }>;
    dataSource?: Array<Record<string, unknown>>;
    options?: false | { reload?: () => void };
    pagination?: false | { pageSize?: number; showSizeChanger?: boolean };
    rowKey?: string;
    search?: false;
    toolBarRender?: () => React.ReactNode[];
  }) => {
    const pageSize = pagination && typeof pagination === 'object'
      ? pagination.pageSize
      : undefined;
    const rows = typeof pageSize === 'number'
      ? dataSource?.slice(0, pageSize)
      : dataSource;
    return (
    <section
      data-testid="hot-monitor-pro-table"
      data-search-disabled={search === false}
      data-pagination-page-size={pageSize ?? ''}
      data-pagination-size-changer={
        pagination && typeof pagination === 'object'
          ? String(pagination.showSizeChanger)
          : ''
      }
    >
      <div role="toolbar" aria-label="任务表格工具栏">
        {options && options.reload ? (
          <button type="button" aria-label="刷新" onClick={() => options.reload?.()}>
            刷新
          </button>
        ) : null}
        {toolBarRender?.().map((item, index) => (
          <React.Fragment key={index}>{item}</React.Fragment>
        ))}
      </div>
      <table aria-label="热点任务列表">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key ?? column.dataIndex ?? column.title)} scope="col">
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows?.map((record) => (
            <tr key={String(record[rowKey ?? 'id'])}>
              {columns.map((column) => (
                <td key={String(column.key ?? column.dataIndex ?? column.title)}>
                  {column.render
                    ? column.render(undefined, record)
                    : String(record[column.dataIndex ?? ''] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
  },
}));

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({
    children,
    extra,
    title,
  }: {
    children: React.ReactNode;
    extra?: React.ReactNode;
    title: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <div>{extra}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    invoke: invokeMock,
  }),
}));

import HotMonitorApp from '@renderer/entries/hot-monitor/App';

describe('HotMonitorApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
        return [
          {
            id: 'source-1',
            taskId: 'task-1',
            name: 'AI 热榜',
            sourceKind: 'api',
            siteKey: 'newsnow',
            entryUrl: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
            parserKey: 'newsnow.hot',
            enabled: true,
            tags: ['AI'],
            createdAt: '2026-05-06T00:00:00.000Z',
            updatedAt: '2026-05-06T00:00:00.000Z',
          },
        ];
      }

      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        return [
          {
            batchId: 'batch-1',
            sourceId: 'source-1',
            sourceName: 'AI 热榜',
            status: 'success',
            startedAt: '2026-05-06T00:00:00.000Z',
            finishedAt: '2026-05-06T00:02:00.000Z',
            resultCount: 3,
            reportStatus: 'generated',
          },
        ];
      }

      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) {
        return [
          {
            id: 'report-1',
            sourceId: 'source-1',
            batchId: 'batch-1',
            title: 'AI 热榜 报告',
            format: 'html',
            filePath: 'E:/allsite/yclaw/output/html/2026-05-06/16-15.html',
            createdAt: '2026-05-06T00:00:00.000Z',
          },
        ];
      }

      if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) {
        return [
          {
            preset: 'workday',
            label: '工作日',
            windows: [{ start: '09:00', end: '18:30', daysOfWeek: [1, 2, 3, 4, 5] }],
            schedule: { type: 'cron', cron: '*/30 9-18 * * 1-5' },
          },
        ];
      }

      if (channel === IPC_CHANNELS.HOT_AI_SUMMARIZE) {
        return {
          summary: 'AI摘要：AI 芯片投资升温',
          matchedResultIds: ['result-1'],
          prompt: '关注 AI 基建',
        };
      }

      if (channel === IPC_CHANNELS.HOT_NOTIFICATION_SEND) {
        return { status: 'succeeded', attempts: 1 };
      }

      if (channel === IPC_CHANNELS.BROWSER_CREATE_TAB) {
        return {
          id: 101,
          url: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
          title: '热点监控标签页',
        };
      }

      if (channel === IPC_CHANNELS.HOT_REPORT_DETAIL) {
        return {
          id: 'report-1',
          sourceId: 'source-1',
          batchId: 'batch-1',
          title: 'AI 热榜 报告',
          format: 'html',
          filePath: 'E:/allsite/yclaw/output/html/2026-05-06/16-15.html',
          content: '<!DOCTYPE html><html><body><div class="tab-bar">AI 热榜 报告</div><p>AI 芯片投资升温</p></body></html>',
          createdAt: '2026-05-06T00:00:00.000Z',
        };
      }

      if (channel === IPC_CHANNELS.HOT_REPORT_DELETE) {
        return { deleted: true };
      }

      if (channel === IPC_CHANNELS.HOT_REPORT_REVEAL) {
        return { revealed: true };
      }

      if (channel === IPC_CHANNELS.HOT_SOURCE_DETAIL) {
        return {
          id: 'source-1',
          taskId: 'task-1',
          name: 'AI 热榜',
          sourceKind: 'api',
          siteKey: 'newsnow',
          entryUrl: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
          parserKey: 'newsnow.hot',
          platformIds: [],
          sessionId: null,
          schedule: null,
          filter: null,
          timeline: null,
          enabled: true,
          tags: ['AI'],
          createdAt: '2026-05-06T00:00:00.000Z',
          updatedAt: '2026-05-06T00:00:00.000Z',
        };
      }

      if (channel === IPC_CHANNELS.HOT_CONFIG_SAVE) {
        return {
          configDir: 'E:/allsite/TrendRadar/config',
          files: [
            'E:/allsite/TrendRadar/config/config.yaml',
            'E:/allsite/TrendRadar/config/frequency_words.txt',
            'E:/allsite/TrendRadar/config/timeline.yaml',
          ],
        };
      }

      return null;
    });
  });

  it('loads existing hot sources, runs and reports in a task-first workspace', async () => {
    const { container } = render(<HotMonitorApp />);

    expect(await screen.findByText('热点监控')).toBeDefined();
    expect(await screen.findByText('任务列表')).toBeDefined();
    expect(await screen.findByTestId('hot-monitor-pro-table')).toBeDefined();
    expect(await screen.findByRole('table', { name: '热点任务列表' })).toBeDefined();
    expect(await screen.findByRole('toolbar', { name: '任务表格工具栏' })).toBeDefined();
    expect(await screen.findByText('最近采集源')).toBeDefined();
    expect(await screen.findByText('最近报告')).toBeDefined();
    expect(screen.queryByText('采集运行工作台')).toBeNull();
    expect(container.querySelector('.hot-monitor-workbench-grid')).toBeNull();
    expect(container.querySelector('.hot-monitor-app')).toBeTruthy();
    expect((await screen.findAllByText('AI 热榜')).length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText('2026/05/06 08:02:00')).toBeDefined();
    expect(screen.queryByText('批次：batch-1')).toBeNull();
    expect(screen.queryByText('开始：2026/05/06 08:00:00')).toBeNull();
    expect(await screen.findByText('AI 热榜 报告')).toBeDefined();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_SOURCE_LIST);
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_LIST, {});
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_LIST, {});
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_TIMELINE_PRESETS);
    });
  });

  it('keeps the config editor behind a drawer entry point', async () => {
    render(<HotMonitorApp />);

    expect(await screen.findByRole('button', { name: '配置' })).toBeDefined();
    expect(screen.getByRole('button', { name: '新增任务' })).toBeDefined();
    expect(screen.queryByRole('tab', { name: 'config.yaml' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '配置' }));

    expect(await screen.findByRole('dialog', { name: '热点配置' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'config.yaml' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'frequency_words.txt' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'timeline.yaml' })).toBeDefined();
    expect(screen.queryByPlaceholderText('采集源名称')).toBeNull();
    expect(screen.queryByRole('button', { name: '创建HOT采集源' })).toBeNull();
  });

  it('opens source task creation and editing in a dedicated modal', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '新增任务' }));

    expect(await screen.findByRole('dialog', { name: '新增采集任务' })).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText('采集源名称'), {
      target: { value: '自定义热榜任务' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        expect.objectContaining({ name: '自定义热榜任务' }),
      );
    });

    const taskRow = screen.getAllByText('AI 热榜')[1].closest('tr');
    const loadDetailButton = Array.from(taskRow?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent === '加载详情');
    expect(loadDetailButton).toBeDefined();
    fireEvent.click(loadDetailButton as HTMLButtonElement);

    expect(await screen.findByRole('dialog', { name: '编辑采集任务' })).toBeDefined();
  });

  it('renders RSS subscription and report mode config without version checking', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '配置' }));

    expect(screen.queryByText('版本检测')).toBeNull();
    expect(await screen.findByText('数据源 - RSS 订阅配置')).toBeDefined();
    expect(screen.getByLabelText('启用 RSS 抓取')).toBeDefined();
    expect(screen.getByLabelText('启用新鲜度过滤')).toBeDefined();
    expect(screen.getByLabelText('源 ID（唯一标识，英文）')).toBeDefined();
    expect(screen.getByLabelText('显示名称')).toBeDefined();
    expect(screen.getByLabelText('RSS URL')).toBeDefined();
    expect(screen.getByLabelText('最大文章年龄（天，可选）')).toBeDefined();
    expect(screen.getAllByText('报告模式').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('报告模式 current')).toBeDefined();
    expect(screen.getByLabelText('分组维度 keyword')).toBeDefined();
  });

  it('adds an RSS feed and saves hot config files to the local config directory', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '配置' }));
    fireEvent.change(await screen.findByLabelText('源 ID（唯一标识，英文）'), {
      target: { value: 'hackernews' },
    });
    fireEvent.change(screen.getByLabelText('显示名称'), {
      target: { value: 'Hacker News' },
    });
    fireEvent.change(screen.getByLabelText('RSS URL'), {
      target: { value: 'https://news.ycombinator.com/rss' },
    });
    fireEvent.change(screen.getByLabelText('最大文章年龄（天，可选）'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加 RSS 源' }));

    expect(screen.getByText('Hacker News')).toBeDefined();
    expect(screen.getByText('hackernews')).toBeDefined();

    fireEvent.click(screen.getByLabelText('报告模式 incremental'));
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_CONFIG_SAVE,
        expect.objectContaining({
          config: expect.stringContaining('rss:'),
          frequency: expect.stringContaining('[WORD_GROUPS]'),
          timeline: expect.stringContaining('presets:'),
        }),
      );
      const saveCall = invokeMock.mock.calls.find((call) => call[0] === IPC_CHANNELS.HOT_CONFIG_SAVE);
      expect(saveCall?.[1].config).toContain('mode: "incremental"');
      expect(saveCall?.[1].config).toContain('id: "hackernews"');
      expect(messageSuccessMock).toHaveBeenCalledWith(
        '配置已保存到 E:/allsite/TrendRadar/config',
      );
    });
  });

  it('shows task table rows, one latest source summary and three recent reports with toolbar drawers', async () => {
    const makeSource = (index: number) => ({
      id: `source-${index}`,
      taskId: `task-${index}`,
      name: `采集源 ${index}`,
      sourceKind: 'api',
      siteKey: 'newsnow',
      entryUrl: `https://example.com/source-${index}`,
      parserKey: 'newsnow.hot',
      enabled: true,
      tags: [],
      createdAt: `2026-05-06T00:${String(index).padStart(2, '0')}:00.000Z`,
      updatedAt: `2026-05-06T00:${String(index).padStart(2, '0')}:00.000Z`,
    });
    const makeRun = (index: number) => ({
      batchId: `batch-${index}`,
      sourceId: `source-${index}`,
      sourceName: `任务源 ${index}`,
      status: index === 1 ? 'running' : 'success',
      startedAt: `2026-05-06T00:${String(index).padStart(2, '0')}:00.000Z`,
      finishedAt: index === 1 ? null : `2026-05-06T00:${String(index).padStart(2, '0')}:30.000Z`,
      resultCount: index,
      reportStatus: 'generated',
    });
    const makeReport = (index: number) => ({
      id: `report-${index}`,
      sourceId: `source-${index}`,
      batchId: `batch-${index}`,
      title: `报告 ${index}`,
      format: 'html',
      filePath: `E:/allsite/yclaw/output/html/report-${index}.html`,
      createdAt: `2026-05-06T00:${String(index).padStart(2, '0')}:00.000Z`,
    });
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) return Array.from({ length: 12 }, (_, index) => makeSource(index + 1));
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) return Array.from({ length: 12 }, (_, index) => makeRun(index + 1));
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) return Array.from({ length: 12 }, (_, index) => makeReport(index + 1));
      if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) return [];
      return null;
    });

    render(<HotMonitorApp />);

    expect(await screen.findByText('任务列表')).toBeDefined();
    expect(screen.getByText('采集源 12')).toBeDefined();
    expect(screen.queryByText('采集源 11')).toBeNull();
    expect(screen.getByText('任务源 12')).toBeDefined();
    expect(screen.getByText('任务源 8')).toBeDefined();
    expect(screen.queryByText('任务源 7')).toBeNull();
    const taskTable = screen.getByTestId('hot-monitor-pro-table');
    expect(taskTable.dataset.paginationPageSize).toBe('5');
    expect(taskTable.dataset.paginationSizeChanger).toBe('false');
    expect(screen.getByText('报告 12')).toBeDefined();
    expect(screen.getByText('报告 10')).toBeDefined();
    expect(screen.queryByText('报告 9')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '全部采集源' }));

    expect(await screen.findByRole('dialog', { name: '全部采集源' })).toBeDefined();
    expect(screen.getByText('采集源 11')).toBeDefined();
    expect(screen.getAllByText('采集源 12').length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: '历史报告' }));

    expect(await screen.findByRole('dialog', { name: '全部报告' })).toBeDefined();
    expect(screen.getByText('报告 9')).toBeDefined();
  });

  it('formats run and report timestamps with Asia Shanghai time', async () => {
    render(<HotMonitorApp />);

    expect((await screen.findAllByText(/2026\/05\/06 08:02:00/)).length).toBeGreaterThan(0);
  });

  it('only shows task actions for matching statuses and opens failed details in a modal', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) return [];
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        return [
          {
            batchId: 'batch-success',
            sourceId: 'source-success',
            sourceName: '成功任务',
            status: 'success',
            startedAt: '2026-05-06T00:00:00.000Z',
            finishedAt: '2026-05-06T00:03:00.000Z',
            resultCount: 8,
            reportStatus: 'pending',
          },
          {
            batchId: 'batch-failed',
            sourceId: 'source-failed',
            sourceName: '失败任务',
            status: 'failed',
            startedAt: '2026-05-06T00:01:00.000Z',
            finishedAt: '2026-05-06T00:02:00.000Z',
            resultCount: 0,
            reportStatus: 'none',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_RUN_DETAIL) {
        return {
          taskId: 'task-failed',
          sourceId: 'source-failed',
          batchId: 'batch-failed',
          status: 'failed',
          startedAt: '2026-05-06T00:01:00.000Z',
          finishedAt: '2026-05-06T00:02:00.000Z',
          stepResults: [
            {
              stepId: 'fetch',
              success: false,
              duration: 120,
              error: 'API request failed: 403 Forbidden',
              startedAt: '2026-05-06T00:01:00.000Z',
              finishedAt: '2026-05-06T00:02:00.000Z',
              screenshot: null,
              domSnapshot: null,
            },
          ],
          linkedResultIds: [],
          breakpoint: { stepIndex: 0, error: 'API request failed: 403 Forbidden' },
          error: 'API request failed: 403 Forbidden',
        };
      }
      return null;
    });

    render(<HotMonitorApp />);

    expect(await screen.findByText('成功任务')).toBeDefined();
    expect(screen.getByText('失败任务')).toBeDefined();
    expect(screen.queryByText('开始：2026/05/06 08:00:00')).toBeNull();
    expect(screen.queryByText('批次：batch-success')).toBeNull();

    const successRow = screen.getByText('成功任务').closest('tr');
    expect(successRow?.querySelectorAll('button')).toHaveLength(4);
    expect(successRow?.textContent).toContain('加载详情');
    expect(successRow?.textContent).toContain('查看运行');
    expect(successRow?.textContent).toContain('重新运行');
    expect(successRow?.textContent).toContain('生成报告');
    expect(successRow?.textContent).not.toContain('查看详情');

    const failedRow = screen.getByText('失败任务').closest('tr');
    expect(failedRow?.querySelectorAll('button')).toHaveLength(4);
    expect(failedRow?.textContent).toContain('加载详情');
    expect(failedRow?.textContent).toContain('查看运行');
    expect(failedRow?.textContent).toContain('查看详情');
    expect(failedRow?.textContent).toContain('重新运行');
    expect(failedRow?.textContent).not.toContain('生成报告');

    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));

    expect(await screen.findByRole('dialog', { name: '运行详情' })).toBeDefined();
    expect(screen.getAllByText(/API request failed: 403 Forbidden/).length).toBeGreaterThan(0);
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_DETAIL, {
      sourceId: 'source-failed',
      batchId: 'batch-failed',
    });
  });

  it('renders hot config file tabs and module actions', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '配置' }));

    expect(await screen.findByRole('tab', { name: 'config.yaml' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'frequency_words.txt' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'timeline.yaml' })).toBeDefined();
    expect(screen.getByText('配置模块')).toBeDefined();
    expect(screen.queryByText('版本检测')).toBeNull();
    expect(screen.getByText('数据源 - RSS 订阅配置')).toBeDefined();
    expect(screen.getByRole('button', { name: '添加热榜平台' })).toBeDefined();
    expect(screen.getByRole('button', { name: '加载默认配置' })).toBeDefined();
    expect(screen.getByRole('button', { name: '复制配置' })).toBeDefined();
    expect(screen.getByRole('button', { name: '保存配置' })).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'frequency_words.txt' }));
    expect(screen.getByRole('button', { name: '新增关键词组' })).toBeDefined();
    expect(screen.getByLabelText('全局排除词')).toBeDefined();
    expect(screen.getByLabelText('关键词组名称 1')).toBeDefined();
    expect(screen.getByLabelText('包含词 1')).toBeDefined();
    expect(screen.getByLabelText('必须词 1')).toBeDefined();
    expect(screen.getByLabelText('组内排除词 1')).toBeDefined();
    expect(screen.getByLabelText('组内最大显示数量 1')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'timeline.yaml' }));
    expect(screen.getByRole('button', { name: '新建调度模式' })).toBeDefined();
    expect(screen.getByRole('button', { name: '新增时间段' })).toBeDefined();
  });

  it('configures hot platform crawling, ordering and custom platform ids', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '配置' }));

    expect(await screen.findByText('数据源 - 热榜平台')).toBeDefined();
    const crawlToggle = screen.getByLabelText('启动热榜抓取') as HTMLInputElement;
    expect(crawlToggle.checked).toBe(true);

    const baiduRow = screen.getByText('baidu').closest('.browser-workspace-list-item');
    expect(baiduRow?.textContent).toContain('拖拽排序');
    const moveUpButton = Array.from(baiduRow?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent === '上移');
    expect(moveUpButton).toBeDefined();
    fireEvent.click(moveUpButton as HTMLButtonElement);

    fireEvent.change(screen.getByPlaceholderText('新增平台ID'), {
      target: { value: 'github-trending' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加平台' }));
    expect(screen.getByText('github-trending')).toBeDefined();

    fireEvent.click(crawlToggle);
    fireEvent.click(screen.getByRole('button', { name: '添加热榜平台' }));
    fireEvent.click(await screen.findByRole('button', { name: '创建任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        expect.objectContaining({
          enabled: false,
          platformIds: expect.arrayContaining(['github-trending']),
        }),
      );
      const createCall = invokeMock.mock.calls.find((call) => call[0] === IPC_CHANNELS.HOT_SOURCE_CREATE);
      expect(createCall?.[1].platformIds.slice(0, 2)).toEqual(['baidu', 'toutiao']);
    });
  });

  it('starts a hot source and reloads runs for that source', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '立即运行' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_START, {
        sourceId: 'source-1',
      });
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_LIST, {});
      expect(messageSuccessMock).toHaveBeenCalledWith('热点采集已启动');
    });
  });

  it('keeps the task table refresh button and reloads workspace data from it', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '刷新' }));

    await waitFor(() => {
      expect(invokeMock.mock.calls.filter((call) => call[0] === IPC_CHANNELS.HOT_RUN_LIST).length)
        .toBeGreaterThanOrEqual(2);
      expect(invokeMock.mock.calls.filter((call) => call[0] === IPC_CHANNELS.HOT_SOURCE_LIST).length)
        .toBeGreaterThanOrEqual(2);
      expect(invokeMock.mock.calls.filter((call) => call[0] === IPC_CHANNELS.HOT_REPORT_LIST).length)
        .toBeGreaterThanOrEqual(2);
    });
  });

  it('refreshes the task list after a manually started run reaches a terminal status', async () => {
    let runStarted = false;
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
        return [
          {
            id: 'source-1',
            taskId: 'task-1',
            name: 'AI 热榜',
            sourceKind: 'api',
            siteKey: 'newsnow',
            entryUrl: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
            parserKey: 'newsnow.hot',
            enabled: true,
            tags: ['AI'],
            createdAt: '2026-05-06T00:00:00.000Z',
            updatedAt: '2026-05-06T00:00:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        return [
          {
            batchId: runStarted ? 'batch-finished' : 'batch-initial',
            sourceId: 'source-1',
            sourceName: 'AI 热榜',
            status: runStarted ? 'success' : 'running',
            startedAt: '2026-05-06T00:00:00.000Z',
            finishedAt: runStarted ? '2026-05-06T00:02:00.000Z' : null,
            resultCount: runStarted ? 9 : 0,
            reportStatus: 'pending',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) return [];
      if (channel === IPC_CHANNELS.HOT_RUN_START) {
        runStarted = true;
        return { sourceId: 'source-1', taskId: 'task-1', started: true };
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_GENERATE) {
        return {
          id: 'report-finished',
          sourceId: 'source-1',
          batchId: 'batch-finished',
          format: 'html',
          filePath: 'E:/allsite/yclaw/output/html/2026-05-06/16-20.html',
        };
      }
      return null;
    });

    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '立即运行' }));

    await waitFor(() => {
      expect(screen.getByText('9 条')).toBeDefined();
      expect(screen.getByText('2026/05/06 08:02:00')).toBeDefined();
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_GENERATE, {
        sourceId: 'source-1',
        batchId: 'batch-finished',
        format: 'html',
      });
      expect(invokeMock.mock.calls.filter((call) => call[0] === IPC_CHANNELS.HOT_REPORT_LIST).length)
        .toBeGreaterThanOrEqual(2);
    });
  });

  it('opens a browser tab directly from hot monitor workspace', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '配置' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开活动标签页' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.BROWSER_CREATE_TAB, {
        url: 'about:blank',
      });
      expect(messageSuccessMock).toHaveBeenCalledWith('浏览器活动标签页已打开');
    });
  });

  it('shows an empty run state when the selected source has no runs', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
        return [
          {
            id: 'source-1',
            taskId: 'task-1',
            name: 'AI 热榜',
            sourceKind: 'api',
            siteKey: 'newsnow',
            entryUrl: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
            parserKey: 'newsnow.hot',
            enabled: true,
            tags: ['AI'],
            createdAt: '2026-05-06T00:00:00.000Z',
            updatedAt: '2026-05-06T00:00:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) return [];
      return null;
    });

    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '查看运行' }));

    expect(await screen.findByRole('dialog', { name: 'AI 热榜任务' })).toBeDefined();
    expect((await screen.findAllByText('暂无运行记录')).length).toBeGreaterThanOrEqual(1);
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_LIST, {
      sourceId: 'source-1',
    });
  });

  it('opens source runs in a drawer without replacing the overview run list', async () => {
    invokeMock.mockImplementation(async (channel: string, payload?: { sourceId?: string }) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
        return [
          {
            id: 'source-1',
            taskId: 'task-1',
            name: 'AI 热榜',
            sourceKind: 'api',
            siteKey: 'newsnow',
            entryUrl: 'https://example.com/ai',
            parserKey: 'newsnow.hot',
            enabled: true,
            tags: ['AI'],
            createdAt: '2026-05-06T00:00:00.000Z',
            updatedAt: '2026-05-06T00:00:00.000Z',
          },
          {
            id: 'source-2',
            taskId: 'task-2',
            name: '财经热榜',
            sourceKind: 'api',
            siteKey: 'newsnow',
            entryUrl: 'https://example.com/finance',
            parserKey: 'newsnow.hot',
            enabled: true,
            tags: ['财经'],
            createdAt: '2026-05-06T00:00:00.000Z',
            updatedAt: '2026-05-06T00:01:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        if (payload?.sourceId === 'source-1') {
          return [
            {
              batchId: 'batch-source-1',
              sourceId: 'source-1',
              sourceName: 'AI 热榜',
              status: 'success',
              startedAt: '2026-05-06T00:05:00.000Z',
              finishedAt: '2026-05-06T00:06:00.000Z',
              resultCount: 5,
              reportStatus: 'pending',
            },
          ];
        }
        return [
          {
            batchId: 'batch-source-1',
            sourceId: 'source-1',
            sourceName: 'AI 热榜',
            status: 'success',
            startedAt: '2026-05-06T00:05:00.000Z',
            finishedAt: '2026-05-06T00:06:00.000Z',
            resultCount: 5,
            reportStatus: 'pending',
          },
          {
            batchId: 'batch-source-2',
            sourceId: 'source-2',
            sourceName: '财经热榜',
            status: 'success',
            startedAt: '2026-05-06T00:07:00.000Z',
            finishedAt: '2026-05-06T00:08:00.000Z',
            resultCount: 7,
            reportStatus: 'pending',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) return [];
      return null;
    });

    render(<HotMonitorApp />);

    expect((await screen.findAllByText('财经热榜')).length).toBeGreaterThanOrEqual(2);

    const aiTaskRow = screen.getAllByText('AI 热榜')[0].closest('tr');
    const viewRunButton = Array.from(aiTaskRow?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent === '查看运行');
    expect(viewRunButton).toBeDefined();
    fireEvent.click(viewRunButton as HTMLButtonElement);

    expect(await screen.findByRole('dialog', { name: 'AI 热榜任务' })).toBeDefined();
    expect(screen.getAllByText('财经热榜').length).toBeGreaterThanOrEqual(2);
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_LIST, {
      sourceId: 'source-1',
    });
  });

  it('fills the draft from a NewsNow preset source', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '配置' }));
    fireEvent.click(await screen.findByRole('button', { name: '知乎热榜' }));

    expect((screen.getByPlaceholderText('采集源名称') as HTMLInputElement).value).toBe('知乎热榜');
    expect((screen.getByPlaceholderText('站点标识，如 douyin / weibo') as HTMLInputElement).value)
      .toBe('zhihu');
    expect((screen.getByPlaceholderText('入口 URL') as HTMLInputElement).value)
      .toBe('https://newsnow.busiyi.world/api/s?id=zhihu&latest');
    expect((screen.getByPlaceholderText('解析器标识，如 douyin.hot') as HTMLInputElement).value)
      .toBe('newsnow.hot');
  });

  it('creates a multi-platform batch source for the 11 configured platforms', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '配置' }));
    fireEvent.click(await screen.findByRole('button', { name: '多平台热榜' }));
    fireEvent.click(await screen.findByRole('button', { name: '创建任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        expect.objectContaining({
          name: '多平台热榜',
          sourceKind: 'api',
          siteKey: 'trendradar',
          entryUrl: 'https://newsnow.busiyi.world/api/s',
          parserKey: 'newsnow.batch',
          platformIds: [
            'toutiao',
            'baidu',
            'wallstreetcn-hot',
            'thepaper',
            'bilibili-hot-search',
            'cls-hot',
            'ifeng',
            'tieba',
            'weibo',
            'douyin',
            'zhihu',
          ],
        }),
      );
    });
  });

  it('starts an aggregate crawl without requiring a selected source', async () => {
    let aggregateStarted = false;
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        return aggregateStarted
          ? [
            {
              batchId: 'batch-trendradar',
              sourceId: 'source-trendradar',
              sourceName: '多平台热榜',
              status: 'success',
              resultCount: 205,
              reportStatus: 'pending',
            },
          ]
          : [];
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) return [];
      if (channel === IPC_CHANNELS.HOT_SOURCE_CREATE) {
        return {
          id: 'source-trendradar',
          taskId: 'task-trendradar',
          name: '多平台热榜',
          sourceKind: 'api',
          siteKey: 'trendradar',
          entryUrl: 'https://newsnow.busiyi.world/api/s',
          parserKey: 'newsnow.batch',
          platformIds: [
            'toutiao',
            'baidu',
            'wallstreetcn-hot',
            'thepaper',
            'bilibili-hot-search',
            'cls-hot',
            'ifeng',
            'tieba',
            'weibo',
            'douyin',
            'zhihu',
          ],
          enabled: true,
          tags: ['多平台', '热榜'],
          createdAt: '2026-05-06T00:00:00.000Z',
          updatedAt: '2026-05-06T00:00:00.000Z',
        };
      }
      if (channel === IPC_CHANNELS.HOT_RUN_START) {
        aggregateStarted = true;
        return { sourceId: 'source-trendradar', taskId: 'task-trendradar', started: true };
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_GENERATE) {
        return {
          id: 'report-trendradar',
          sourceId: 'source-trendradar',
          batchId: 'batch-trendradar',
          format: 'html',
          filePath: 'E:/allsite/yclaw/output/html/2026-05-06/16-15.html',
        };
      }
      return null;
    });

    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '一键聚合采集' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        expect.objectContaining({
          name: '多平台热榜',
          parserKey: 'newsnow.batch',
          platformIds: [
            'toutiao',
            'baidu',
            'wallstreetcn-hot',
            'thepaper',
            'bilibili-hot-search',
            'cls-hot',
            'ifeng',
            'tieba',
            'weibo',
            'douyin',
            'zhihu',
          ],
        }),
      );
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_START, {
        sourceId: 'source-trendradar',
      });
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_GENERATE, {
        sourceId: 'source-trendradar',
        batchId: 'batch-trendradar',
        format: 'html',
      });
      expect(messageSuccessMock).toHaveBeenCalledWith('多平台聚合采集已启动');
      expect(messageSuccessMock).toHaveBeenCalledWith('多平台聚合采集完成，HTML报告已生成');
    });
  });

  it('starts the selected aggregate source instead of reusing the first aggregate template', async () => {
    let aggregateStarted = false;
    invokeMock.mockImplementation(async (channel: string, payload?: { sourceId?: string }) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
        return [
          {
            id: 'source-old-aggregate',
            taskId: 'task-old-aggregate',
            name: '早间热点',
            sourceKind: 'api',
            siteKey: 'trendradar',
            entryUrl: 'https://newsnow.busiyi.world/api/s',
            parserKey: 'newsnow.batch',
            platformIds: ['baidu'],
            enabled: true,
            tags: ['多平台', '热榜'],
            createdAt: '2026-05-06T00:00:00.000Z',
            updatedAt: '2026-05-06T00:00:00.000Z',
          },
          {
            id: 'source-selected-aggregate',
            taskId: 'task-selected-aggregate',
            name: 'AI 重点热点',
            sourceKind: 'api',
            siteKey: 'trendradar',
            entryUrl: 'https://newsnow.busiyi.world/api/s',
            parserKey: 'newsnow.batch',
            platformIds: ['zhihu', 'weibo'],
            enabled: true,
            tags: ['AI'],
            createdAt: '2026-05-06T01:00:00.000Z',
            updatedAt: '2026-05-06T01:00:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_DETAIL) {
        return {
          id: 'source-selected-aggregate',
          taskId: 'task-selected-aggregate',
          name: 'AI 重点热点',
          sourceKind: 'api',
          siteKey: 'trendradar',
          entryUrl: 'https://newsnow.busiyi.world/api/s',
          parserKey: 'newsnow.batch',
          platformIds: ['zhihu', 'weibo'],
          sessionId: null,
          schedule: { type: 'manual' },
          filter: null,
          timeline: null,
          enabled: true,
          tags: ['AI'],
          createdAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T01:00:00.000Z',
        };
      }
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        if (payload?.sourceId === 'source-selected-aggregate') {
          return aggregateStarted
            ? [
              {
                batchId: 'batch-selected-aggregate',
                sourceId: 'source-selected-aggregate',
                sourceName: 'AI 重点热点',
                status: 'success',
                resultCount: 88,
                reportStatus: 'pending',
              },
            ]
            : [];
        }
        return [];
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) return [];
      if (channel === IPC_CHANNELS.HOT_RUN_START) {
        aggregateStarted = true;
        return { sourceId: payload?.sourceId, taskId: 'task-selected-aggregate', started: true };
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_GENERATE) {
        return {
          id: 'report-selected-aggregate',
          sourceId: 'source-selected-aggregate',
          batchId: 'batch-selected-aggregate',
          format: 'html',
          filePath: 'E:/allsite/yclaw/output/html/2026-05-06/17-00.html',
        };
      }
      return null;
    });

    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '全部采集源' }));
    const drawer = await screen.findByRole('dialog', { name: '全部采集源' });
    const selectedSourceCard = within(drawer)
      .getByText('AI 重点热点')
      .closest('.browser-review-queue-card');
    const loadDetailButton = Array.from(selectedSourceCard?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent === '加载详情');
    fireEvent.click(loadDetailButton as HTMLButtonElement);

    await screen.findByRole('dialog', { name: '编辑采集任务' });
    fireEvent.click(screen.getAllByRole('button', { name: '一键聚合采集' })[0]);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_START, {
        sourceId: 'source-selected-aggregate',
      });
      expect(invokeMock).not.toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_START, {
        sourceId: 'source-old-aggregate',
      });
      expect(invokeMock).not.toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        expect.objectContaining({ parserKey: 'newsnow.batch' }),
      );
    });
    expect(drawer).toBeDefined();
  });

  it('can save an edited task as a new source instead of overwriting the existing task', async () => {
    render(<HotMonitorApp />);

    const latestSourceSection = await screen.findByLabelText('最近采集源');
    fireEvent.click(within(latestSourceSection).getByRole('button', { name: '加载详情' }));
    await screen.findByRole('dialog', { name: '编辑采集任务' });
    fireEvent.change(screen.getByPlaceholderText('采集源名称'), {
      target: { value: 'AI 热榜副本' },
    });
    fireEvent.click(screen.getByRole('button', { name: '另存为新任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        expect.objectContaining({
          name: 'AI 热榜副本',
          siteKey: 'newsnow',
          parserKey: 'newsnow.hot',
        }),
      );
      expect(invokeMock).not.toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_UPDATE,
        expect.objectContaining({
          sourceId: 'source-1',
        }),
      );
    });
  });

  it('shows source configuration summaries for different task types', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
        return [
          {
            id: 'source-batch',
            taskId: 'task-batch',
            name: '多平台热点',
            sourceKind: 'api',
            siteKey: 'trendradar',
            entryUrl: 'https://newsnow.busiyi.world/api/s',
            parserKey: 'newsnow.batch',
            platformIds: ['baidu', 'zhihu', 'weibo'],
            schedule: { type: 'cron', cron: '*/30 * * * *' },
            enabled: true,
            tags: ['多平台'],
            createdAt: '2026-05-06T01:00:00.000Z',
            updatedAt: '2026-05-06T01:00:00.000Z',
          },
          {
            id: 'source-rss',
            taskId: 'task-rss',
            name: '科技 RSS',
            sourceKind: 'rss',
            siteKey: 'rss',
            entryUrl: 'https://example.com/feed.xml',
            parserKey: 'rss.feed',
            schedule: { type: 'manual' },
            enabled: false,
            tags: ['RSS'],
            createdAt: '2026-05-06T00:00:00.000Z',
            updatedAt: '2026-05-06T00:00:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_TIMELINE_PRESETS) return [];
      return null;
    });

    render(<HotMonitorApp />);

    expect(await screen.findByText('多平台热点')).toBeDefined();
    expect(screen.getByText('3个平台 · 定时 */30 * * * * · 已启用')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '全部采集源' }));

    expect(await screen.findByText('科技 RSS')).toBeDefined();
    expect(screen.getByText('RSS订阅 · 手动运行 · 已停用')).toBeDefined();
  });

  it('creates an RSS source with keyword filters', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '配置' }));
    fireEvent.click(await screen.findByRole('button', { name: 'RSS订阅' }));
    fireEvent.change(screen.getByPlaceholderText('采集源名称'), {
      target: { value: '科技 RSS' },
    });
    fireEvent.change(screen.getByPlaceholderText('入口 URL'), {
      target: { value: 'https://example.com/feed.xml' },
    });
    fireEvent.change(screen.getByPlaceholderText('关键词，逗号分隔'), {
      target: { value: 'AI,芯片' },
    });
    fireEvent.change(screen.getByPlaceholderText('过滤词，逗号分隔'), {
      target: { value: '广告' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        expect.objectContaining({
          name: '科技 RSS',
          sourceKind: 'rss',
          siteKey: 'rss',
          entryUrl: 'https://example.com/feed.xml',
          parserKey: 'rss.feed',
          filter: {
            keywordGroups: [{ name: '默认关键词', include: ['AI', '芯片'], exclude: ['广告'] }],
            excludeKeywords: ['广告'],
          },
        }),
      );
    });
  });

  it('applies a timeline preset to the hot source draft', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '配置' }));
    fireEvent.click(await screen.findByRole('tab', { name: 'timeline.yaml' }));
    fireEvent.click(await screen.findByRole('button', { name: '工作日时间线' }));
    fireEvent.click(screen.getByRole('button', { name: '新增任务' }));
    fireEvent.change(screen.getByPlaceholderText('采集源名称'), {
      target: { value: '工作日热榜' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        expect.objectContaining({
          name: '工作日热榜',
          schedule: { type: 'cron', cron: '*/30 9-18 * * 1-5' },
          timeline: {
            preset: 'workday',
            windows: [{ start: '09:00', end: '18:30', daysOfWeek: [1, 2, 3, 4, 5] }],
          },
        }),
      );
    });
  });

  it('requests an AI summary for the selected hot run', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '配置' }));
    fireEvent.click(await screen.findByRole('tab', { name: 'frequency_words.txt' }));
    fireEvent.change(await screen.findByLabelText('全局排除词'), {
      target: { value: '震惊,广告' },
    });
    fireEvent.change(screen.getByLabelText('关键词组名称 1'), {
      target: { value: 'AI 基建' },
    });
    fireEvent.change(screen.getByLabelText('包含词 1'), {
      target: { value: 'AI,OpenAI,/芯片|半导体/' },
    });
    fireEvent.change(screen.getByLabelText('必须词 1'), {
      target: { value: '算力' },
    });
    fireEvent.change(screen.getByLabelText('组内排除词 1'), {
      target: { value: '广告' },
    });
    fireEvent.change(screen.getByLabelText('组内最大显示数量 1'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));

    await waitFor(() => {
      const saveCall = invokeMock.mock.calls.find((call) => call[0] === IPC_CHANNELS.HOT_CONFIG_SAVE);
      expect(saveCall?.[1].frequency).toContain('[GLOBAL_FILTER]');
      expect(saveCall?.[1].frequency).toContain('震惊');
      expect(saveCall?.[1].frequency).toContain('广告');
      expect(saveCall?.[1].frequency).toContain('[WORD_GROUPS]');
      expect(saveCall?.[1].frequency).toContain('[AI 基建]');
      expect(saveCall?.[1].frequency).toContain('AI');
      expect(saveCall?.[1].frequency).toContain('OpenAI');
      expect(saveCall?.[1].frequency).toContain('/芯片|半导体/');
      expect(saveCall?.[1].frequency).toContain('+算力');
      expect(saveCall?.[1].frequency).toContain('!广告');
      expect(saveCall?.[1].frequency).toContain('@5');
    });
  });

  it('sends the latest hot report to a webhook target', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '配置' }));
    fireEvent.change(await screen.findByPlaceholderText('通知Webhook URL'), {
      target: { value: 'https://hooks.example.com/hot' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送热点通知' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_NOTIFICATION_SEND, {
        reportId: 'report-1',
        target: { type: 'webhook', url: 'https://hooks.example.com/hot' },
      });
    });
  });

  it('shows reports as compact rows without file paths and can reveal storage location', async () => {
    render(<HotMonitorApp />);

    fireEvent.change(await screen.findByPlaceholderText('搜索报告'), {
      target: { value: 'AI' },
    });
    expect(screen.queryByText('E:/allsite/yclaw/output/html/2026-05-06/16-15.html')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '预览报告' }));

    const previewDrawer = await screen.findByRole('dialog', { name: '报告预览' });
    expect(within(previewDrawer).getByTitle('AI 热榜 报告')).toBeDefined();
    expect(within(previewDrawer).getByRole('button', { name: '关闭预览' })).toBeDefined();
    expect(screen.queryByRole('button', { name: '打开报告' })).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_DETAIL, {
      reportId: 'report-1',
    });

    fireEvent.click(within(previewDrawer).getByRole('button', { name: '关闭预览' }));
    expect(screen.queryByTitle('AI 热榜 报告')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '打开存储位置' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_REVEAL, {
        reportId: 'report-1',
      });
      expect(messageSuccessMock).toHaveBeenCalledWith('已打开报告存储位置');
    });
  });

  it('generates and deletes html reports', async () => {
    const { container } = render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '生成报告' }));
    const deleteReportButton = await screen.findByRole('button', { name: '删除报告' });
    expect(deleteReportButton.getAttribute('data-danger')).toBe('true');
    fireEvent.click(deleteReportButton);

    expect(container.querySelector('[data-type="primary"]')).toBeTruthy();
    expect(container.querySelector('[data-danger="true"]')).toBeTruthy();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_GENERATE, {
        sourceId: 'source-1',
        batchId: 'batch-1',
        format: 'html',
      });
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_DELETE, {
        reportId: 'report-1',
      });
    });
  });
});
