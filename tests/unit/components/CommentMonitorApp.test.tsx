import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants';

const { invokeMock, messageErrorMock, messageSuccessMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageErrorMock: vi.fn(),
  messageSuccessMock: vi.fn(),
}));

vi.mock('antd', () => ({
  Button: ({
    children,
    icon,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    icon?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  Card: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
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
  Input: ({
    value,
    onChange,
    'aria-label': ariaLabel,
    type,
  }: {
    value?: string | number;
    onChange?: (event: { target: { value: string } }) => void;
    'aria-label'?: string;
    type?: string;
  }) => (
    <input
      aria-label={ariaLabel}
      type={type}
      value={value ?? ''}
      onChange={(event) => onChange?.({ target: { value: event.target.value } })}
    />
  ),
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
  Select: ({
    value,
    onChange,
    options,
    'aria-label': ariaLabel,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    options?: Array<{ label: string; value: string }>;
    'aria-label'?: string;
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={(event) => onChange?.(event.target.value)}>
      {options?.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  message: {
    error: messageErrorMock,
    success: messageSuccessMock,
  },
}));

vi.mock('@ant-design/icons', () => ({
  FileTextOutlined: () => <span>file</span>,
  MessageOutlined: () => <span>message</span>,
  PlayCircleOutlined: () => <span>play</span>,
  ReloadOutlined: () => <span>reload</span>,
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
        data-testid="comment-monitor-pro-table"
        data-search-disabled={search === false}
        data-pagination-page-size={pageSize ?? ''}
      >
        <div role="toolbar" aria-label="评论任务表格工具栏">
          {options && options.reload ? (
            <button type="button" aria-label="刷新" onClick={() => options.reload?.()}>
              刷新
            </button>
          ) : null}
          {toolBarRender?.().map((item, index) => (
            <React.Fragment key={index}>{item}</React.Fragment>
          ))}
        </div>
        <table aria-label="评论任务列表">
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

import CommentMonitorApp from '@renderer/entries/comment-monitor/App';

describe('CommentMonitorApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.COMMENT_SOURCE_LIST) {
        return [
          {
            id: 'source-1',
            taskId: 'task-1',
            name: '小红书 AI 评论',
            platform: 'xhs',
            entryKind: 'keyword',
            entryValue: 'AI',
            parserKey: 'xhs.comment',
            limits: {
              maxContents: 5,
              maxCommentsPerContent: 20,
              includeSubComments: false,
              crawlIntervalSeconds: 2,
            },
            enabled: true,
            tags: [],
            createdAt: '2026-05-08T00:00:00.000Z',
            updatedAt: '2026-05-08T00:00:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.COMMENT_RUN_LIST) {
        return [
          {
            batchId: 'batch-1',
            sourceId: 'source-1',
            sourceName: '小红书 AI 评论',
            status: 'success',
            resultCount: 2,
            reportStatus: 'pending',
          },
        ];
      }
      if (channel === IPC_CHANNELS.COMMENT_REPORT_LIST) return [];
      if (channel === IPC_CHANNELS.COMMENT_MEDIACRAWLER_CONFIG_GET) {
        return {
          enabled: true,
          repoPath: 'E:/MediaCrawler',
          pythonPath: 'python',
          outputDir: 'E:/MediaCrawler/data',
          loginType: 'qrcode',
        };
      }
      if (channel === IPC_CHANNELS.COMMENT_RESULT_LIST) {
        return [
          {
            platform: 'douyin',
            commentId: 'comment-1',
            content: '这个 AI 工具很实用',
            authorName: '用户A',
            likeCount: 12,
          },
        ];
      }
      if (channel === IPC_CHANNELS.COMMENT_SOURCE_CREATE) return { id: 'source-new' };
      if (channel === IPC_CHANNELS.COMMENT_SOURCE_DETAIL) {
        return {
          id: 'source-1',
          taskId: 'task-1',
          name: '小红书 AI 评论',
          platform: 'xhs',
          entryKind: 'keyword',
          entryValue: 'AI',
          parserKey: 'xhs.comment',
          limits: {
            maxContents: 5,
            maxCommentsPerContent: 20,
            includeSubComments: false,
            crawlIntervalSeconds: 2,
          },
          enabled: true,
          tags: [],
          createdAt: '2026-05-08T00:00:00.000Z',
          updatedAt: '2026-05-08T00:00:00.000Z',
        };
      }
      if (channel === IPC_CHANNELS.COMMENT_RUN_START) return { started: true };
      if (channel === IPC_CHANNELS.COMMENT_REPORT_GENERATE) return { id: 'report-1' };
      if (channel === IPC_CHANNELS.COMMENT_MEDIACRAWLER_CONFIG_SAVE) {
        return {
          enabled: true,
          repoPath: 'E:/MediaCrawler',
          pythonPath: 'python',
          outputDir: 'E:/MediaCrawler/data',
          loginType: 'qrcode',
        };
      }
      if (channel === IPC_CHANNELS.COMMENT_MEDIACRAWLER_TEST) return { ok: true };
      if (channel === IPC_CHANNELS.COMMENT_MEDIACRAWLER_RUN) {
        return {
          batchId: 'batch-1',
          platform: 'xhs',
          exitCode: 0,
          importedCount: 2,
          outputDir: 'E:/MediaCrawler/data',
        };
      }
      if (channel === IPC_CHANNELS.COMMENT_AI_REPLY_GENERATE) {
        return {
          commentId: 'comment-1',
          platform: 'douyin',
          tone: 'friendly',
          drafts: ['感谢分享，后续会继续更新使用教程。'],
          publishMode: 'manual',
        };
      }
      return null;
    });
  });

  it('loads comment monitor data in a task-first ProTable workspace', async () => {
    const { container } = render(<CommentMonitorApp />);

    expect(await screen.findByText('评论监控')).toBeDefined();
    expect(await screen.findByText('任务列表')).toBeDefined();
    expect(await screen.findByTestId('comment-monitor-pro-table')).toBeDefined();
    expect(await screen.findByRole('table', { name: '评论任务列表' })).toBeDefined();
    expect(await screen.findByRole('toolbar', { name: '评论任务表格工具栏' })).toBeDefined();
    expect(await screen.findByText('最近评论源')).toBeDefined();
    expect(await screen.findByText('最近报告')).toBeDefined();
    expect(container.querySelector('.comment-monitor-grid')).toBeNull();
    expect(container.querySelector('.comment-monitor-app')).toBeTruthy();
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_SOURCE_LIST);
    });
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_RUN_LIST, {});
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_REPORT_LIST, {});
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_RESULT_LIST, { batchId: 'batch-1' });
    });
    expect(screen.getAllByText('小红书 AI 评论').length).toBeGreaterThan(0);
    expect(screen.getByText('这个 AI 工具很实用')).toBeDefined();
  });

  it('creates a source, starts a run and generates a report', async () => {
    render(<CommentMonitorApp />);
    await screen.findAllByText('小红书 AI 评论');

    expect(screen.queryByLabelText('评论源名称')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '新增评论源' }));
    expect(await screen.findByRole('dialog', { name: '新增评论源' })).toBeDefined();

    fireEvent.change(screen.getByLabelText('评论源名称'), { target: { value: '小红书价格评论' } });
    fireEvent.change(screen.getByLabelText('最大内容数'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('单内容最大评论数'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('采集间隔秒数'), { target: { value: '5' } });
    fireEvent.click(screen.getByLabelText('采集二级评论'));
    fireEvent.change(screen.getByLabelText('包含关键词'), { target: { value: 'AI,工具' } });
    fireEvent.change(screen.getByLabelText('排除关键词'), { target: { value: '广告' } });
    fireEvent.change(screen.getByLabelText('最低点赞数'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('会话ID'), { target: { value: 'xhs-session' } });
    fireEvent.click(screen.getByText('创建评论源'));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.COMMENT_SOURCE_CREATE,
        expect.objectContaining({
          name: '小红书价格评论',
          platform: 'xhs',
          entryKind: 'keyword',
          sessionId: 'xhs-session',
          limits: {
            maxContents: 8,
            maxCommentsPerContent: 30,
            crawlIntervalSeconds: 5,
            includeSubComments: true,
          },
          filter: {
            includeKeywords: ['AI', '工具'],
            excludeKeywords: ['广告'],
            minLikeCount: 2,
          },
        }),
      );
    });

    fireEvent.click(screen.getAllByText('启动采集')[0]);
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_RUN_START, { sourceId: 'source-1' });
    });
    expect(messageSuccessMock).toHaveBeenCalledWith('评论采集已启动，运行完成后可在列表中生成报告');

    fireEvent.click(screen.getAllByText('生成报告')[0]);
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_REPORT_GENERATE, {
        sourceId: 'source-1',
        batchId: 'batch-1',
        format: 'html',
      });
    });
  });

  it('generates AI reply drafts for comments without auto publishing', async () => {
    render(<CommentMonitorApp />);

    await screen.findByText('这个 AI 工具很实用');
    fireEvent.click(screen.getByText('AI回复'));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.COMMENT_AI_REPLY_GENERATE,
        expect.objectContaining({
          comment: expect.objectContaining({
            platform: 'douyin',
            commentId: 'comment-1',
            content: '这个 AI 工具很实用',
          }),
          tone: 'friendly',
        }),
      );
    });
    expect(await screen.findByText('感谢分享，后续会继续更新使用教程。')).toBeDefined();
    expect(screen.getByText('人工确认后发布')).toBeDefined();
  });

  it('configures and runs MediaCrawler external executor', async () => {
    render(<CommentMonitorApp />);

    await screen.findAllByText('小红书 AI 评论');
    fireEvent.click(screen.getByRole('button', { name: '外部执行器' }));

    expect(await screen.findByRole('dialog', { name: 'MediaCrawler外部执行器' })).toBeDefined();
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.COMMENT_MEDIACRAWLER_CONFIG_GET);
    });

    fireEvent.change(screen.getByLabelText('MediaCrawler仓库路径'), {
      target: { value: 'E:/MediaCrawler' },
    });
    fireEvent.change(screen.getByLabelText('Python路径'), {
      target: { value: 'python' },
    });
    fireEvent.change(screen.getByLabelText('输出目录'), {
      target: { value: 'E:/MediaCrawler/data' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.COMMENT_MEDIACRAWLER_CONFIG_SAVE,
        expect.objectContaining({
          enabled: true,
          repoPath: 'E:/MediaCrawler',
          pythonPath: 'python',
          outputDir: 'E:/MediaCrawler/data',
          loginType: 'qrcode',
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.COMMENT_MEDIACRAWLER_TEST,
        expect.objectContaining({ repoPath: 'E:/MediaCrawler' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '外部采集' }));
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.COMMENT_MEDIACRAWLER_RUN,
        expect.objectContaining({
          sourceId: 'source-1',
          taskId: 'task-1',
          batchId: 'batch-1',
          platform: 'xhs',
          entryKind: 'keyword',
          entryValue: 'AI',
        }),
      );
    });
    expect(messageSuccessMock).toHaveBeenCalledWith('MediaCrawler 已导入 2 条评论');
  });
});
