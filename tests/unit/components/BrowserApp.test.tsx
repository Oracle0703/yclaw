import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';

const { invokeMock, messageErrorMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageErrorMock: vi.fn(),
}));

vi.mock('antd', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
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
  Col: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Row: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: React.ReactNode }) => <strong>{children}</strong>,
  },
  message: {
    error: messageErrorMock,
  },
}));

vi.mock('@ant-design/icons', () => ({
  PlusOutlined: () => <span>plus</span>,
}));

vi.mock('@ant-design/pro-components', () => ({
  ProCard: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  ),
}));

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({
    children,
    extra,
    title,
  }: {
    children: React.ReactNode;
    extra: React.ReactNode;
    title: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <div>{extra}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@renderer/entries/browser/components/TabBar', () => ({
  TabBar: () => <div>TabBar</div>,
}));

vi.mock('@renderer/entries/browser/components/AddressBar', () => ({
  AddressBar: ({
    onBack,
    onForward,
    onReload,
  }: {
    onBack: () => void;
    onForward: () => void;
    onReload: () => void;
  }) => (
    <div>
      <button type="button" onClick={onBack}>后退</button>
      <button type="button" onClick={onForward}>前进</button>
      <button type="button" onClick={onReload}>刷新</button>
    </div>
  ),
}));

vi.mock('@renderer/entries/browser/components/WebViewContainer', () => ({
  WebViewContainer: () => <div>WebView</div>,
}));

vi.mock('@renderer/entries/browser/components/InterventionPanel', () => ({
  InterventionPanel: () => <div>InterventionPanel</div>,
}));

vi.mock('@renderer/entries/browser/components/RecorderPanel', () => ({
  RecorderPanel: () => <div>RecorderPanel</div>,
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    invoke: invokeMock,
  }),
  useIpcEvent: vi.fn(),
}));

vi.mock('@renderer/shared/hooks/useLoading', () => ({
  useLoading: () => ({
    withLoading: async <T,>(task: () => Promise<T>) => task(),
  }),
}));

import BrowserApp from '@renderer/entries/browser/App';

const tabs = [
  {
    id: 1,
    title: '首页',
    url: 'https://example.com',
    loading: false,
    canGoBack: true,
    canGoForward: true,
  },
];

describe('Browser App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }
      return null;
    });
  });

  it('shows an error when loading tabs fails', async () => {
    invokeMock.mockRejectedValueOnce(new Error('list tabs failed'));

    render(<BrowserApp />);

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('list tabs failed');
    });
  });

  it('shows an error when reload fails', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }

      if (channel === IPC_CHANNELS.BROWSER_RELOAD) {
        throw new Error('reload failed');
      }

      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));

    await waitFor(() => {
      expect(messageErrorMock).toHaveBeenCalledWith('reload failed');
    });
  });

  it('opens the selected platform workspace instead of navigating immediately', async () => {
    invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }

      if (channel === IPC_CHANNELS.BROWSER_CREATE_TAB) {
        return {
          id: 2,
          title: '小红书',
          url: (payload as { url: string }).url,
          loading: false,
          canGoBack: false,
          canGoForward: false,
          sessionPartition: 'default',
        };
      }

      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /抖音/ }));

    expect(screen.getByText('抖音运营工作台')).toBeDefined();
    expect(screen.getByText('评论草稿助手')).toBeDefined();
    expect(screen.getByText(/不做无水印下载/)).toBeDefined();
  });

  it('opens the requested entry from the selected platform workspace', async () => {
    invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }

      if (channel === IPC_CHANNELS.BROWSER_CREATE_TAB) {
        return {
          id: 2,
          title: '抖音',
          url: (payload as { url: string }).url,
          loading: false,
          canGoBack: false,
          canGoForward: false,
          sessionPartition: 'default',
        };
      }

      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
    fireEvent.click(screen.getByRole('button', { name: '打开平台主页' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.BROWSER_CREATE_TAB, {
        url: 'https://www.douyin.com',
      });
    });
  });

  it('searches seeded Douyin results and switches the current analysis target', async () => {
    render(<BrowserApp />);

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
    fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
      target: { value: '夏季穿搭' },
    });
    fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));

    await waitFor(() => {
      expect(screen.getByText('夏季穿搭 第 1 条样本')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 2 条样本/ }));

    expect(screen.getByText('当前分析对象')).toBeDefined();
    expect(screen.getAllByText('夏季穿搭 第 2 条样本').length).toBeGreaterThan(0);
    expect(screen.getByText(/评论讨论集中在购买判断/)).toBeDefined();
  });

  it('generates comment drafts for the selected platform workspace', async () => {
    invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }

      if (channel === IPC_CHANNELS.AI_CONFIG_GET) {
        return {
          provider: 'openai',
          apiKey: 'test-key',
        };
      }

      if (channel === IPC_CHANNELS.AI_CHAT) {
        expect(payload).toMatchObject({
          message: expect.stringContaining('夏季穿搭 第 1 条样本'),
          conversationId: null,
        });
        return {
          conversationId: 'draft-conv',
          message: {
            id: 'assistant-draft',
            role: 'assistant',
            content: '第一条模型回复\n第二条模型回复\n第三条模型回复',
            timestamp: 1,
          },
        };
      }

      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
    fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
      target: { value: '夏季穿搭' },
    });
    fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));
    fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 1 条样本/ }));
    fireEvent.change(screen.getByRole('combobox', { name: '评论草稿语气' }), {
      target: { value: '友好' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生成评论草稿' }));

    await waitFor(() => {
      expect(screen.getByText(/当前来源：模型回复/)).toBeDefined();
      expect(
        (
          screen.getByPlaceholderText(
            '这里记录当前视频的评论草稿、判断依据和人工复核备注。',
          ) as HTMLTextAreaElement
        ).value,
      ).toBe('第一条模型回复');
    });
  });

  it('falls back to canned drafts when AI is unavailable', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }

      if (channel === IPC_CHANNELS.AI_CONFIG_GET) {
        return {
          provider: 'openai',
        };
      }

      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
    fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
      target: { value: '夏季穿搭' },
    });
    fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));
    fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 1 条样本/ }));
    fireEvent.click(screen.getByRole('button', { name: '生成评论草稿' }));

    await waitFor(() => {
      expect(screen.getAllByText(/固定模板/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/夏季穿搭 第 1 条样本/).length).toBeGreaterThan(0);
    });
  });

  it('queues manual review actions for the selected platform', async () => {
    render(<BrowserApp />);

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
    fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
      target: { value: '夏季穿搭' },
    });
    fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));
    fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 1 条样本/ }));
    fireEvent.click(screen.getByRole('button', { name: '关注对象加入复核清单，由人工逐个确认' }));

    expect(screen.getByText('待复核')).toBeDefined();
    expect(screen.getAllByText('关注对象加入复核清单，由人工逐个确认').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/目标视频：夏季穿搭 第 1 条样本/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '标记可执行' }));

    expect(screen.getByText('可执行')).toBeDefined();
  });

  it('creates an automation task draft for ready review actions', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }

      if (channel === IPC_CHANNELS.TASK_CREATE) {
        return {
          id: 'task-douyin-review',
          name: '抖音 · 关注复核 · 04/27 02:30',
        };
      }

      if (channel === IPC_CHANNELS.WINDOW_OPEN) {
        return null;
      }

      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
    fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
      target: { value: '夏季穿搭' },
    });
    fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));
    fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 1 条样本/ }));
    fireEvent.click(screen.getByRole('button', { name: '关注对象加入复核清单，由人工逐个确认' }));
    fireEvent.click(screen.getByRole('button', { name: '标记可执行' }));
    fireEvent.click(screen.getByRole('button', { name: '生成执行任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.TASK_CREATE,
        expect.objectContaining({
          name: expect.stringContaining('抖音'),
          entryUrl: 'https://example.com',
          schedule: { type: 'manual' },
          steps: expect.arrayContaining([
            expect.objectContaining({
              action: expect.objectContaining({
                type: 'click',
                selector: '[data-yclaw-confirm="follow-button"]',
              }),
            }),
          ]),
        }),
      );
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW_OPEN, { module: 'automation' });
      expect(screen.getByText(/已建任务：抖音 · 关注复核/)).toBeDefined();
    });
  });

  it('creates a comment draft task with the current draft content as input value', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }

      if (channel === IPC_CHANNELS.TASK_CREATE) {
        return {
          id: 'task-douyin-comment',
          name: '抖音 · 评论草案 · 04/27 02:31',
        };
      }

      if (channel === IPC_CHANNELS.WINDOW_OPEN) {
        return null;
      }

      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
    fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
      target: { value: '夏季穿搭' },
    });
    fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));
    fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 1 条样本/ }));
    fireEvent.change(
      screen.getByPlaceholderText('这里记录当前视频的评论草稿、判断依据和人工复核备注。'),
      {
        target: { value: '这条内容的信息量很足，我补充一个观察点：关注供应链波动。' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: '评论草稿生成后人工确认再发送' }));
    fireEvent.click(screen.getByRole('button', { name: '标记可执行' }));
    fireEvent.click(screen.getByRole('button', { name: '生成执行任务' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.TASK_CREATE,
        expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({
              action: expect.objectContaining({
                type: 'input',
                selector: '[data-yclaw-confirm="comment-input"]',
                params: expect.objectContaining({
                  value: '这条内容的信息量很足，我补充一个观察点：关注供应链波动。',
                }),
              }),
            }),
          ]),
        }),
      );
      expect(screen.getByText(/已建任务：抖音 · 评论草案/)).toBeDefined();
    });
  });

  it('requires authorization confirmation before starting a Douyin download', async () => {
    render(<BrowserApp />);

    await waitFor(() => expect(screen.getByText('example.com')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
    fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
      target: { value: '夏季穿搭' },
    });
    fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));
    fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 1 条样本/ }));
    fireEvent.click(screen.getByRole('button', { name: '申请授权下载' }));

    expect(screen.queryByRole('button', { name: '开始下载' })).toBeNull();

    fireEvent.click(screen.getByLabelText('我确认这是自有内容或已授权内容'));

    expect(screen.getByRole('button', { name: '开始下载' })).toBeDefined();
  });

  it('records the completed Douyin download after manual confirmation', async () => {
    render(<BrowserApp />);

    await waitFor(() => expect(screen.getByText('example.com')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
    fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
      target: { value: '夏季穿搭' },
    });
    fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));
    fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 1 条样本/ }));
    fireEvent.click(screen.getByRole('button', { name: '申请授权下载' }));
    fireEvent.click(screen.getByLabelText('我确认这是自有内容或已授权内容'));
    fireEvent.click(screen.getByRole('button', { name: '开始下载' }));
    fireEvent.click(screen.getByRole('button', { name: '标记已完成下载归档' }));

    expect(screen.getByText(/下载状态：已完成/)).toBeDefined();
    expect(screen.getByText(/来源链接：https:\/\/www\.douyin\.com\/video\/1001/)).toBeDefined();
  });

  it('switches to HOT采集 mode and loads source, run and report panels', async () => {
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
        return [
          {
            id: 'source-1',
            taskId: 'task-1',
            name: '抖音热榜',
            sourceKind: 'browser',
            siteKey: 'douyin',
            entryUrl: 'https://www.douyin.com/hot',
            parserKey: 'douyin.hot',
            sessionId: null,
            schedule: { type: 'cron', cron: '0 * * * *' },
            enabled: true,
            tags: ['热点'],
            createdAt: '2026-04-27T00:00:00.000Z',
            updatedAt: '2026-04-27T00:00:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        return [
          {
            batchId: 'batch-1',
            sourceId: 'source-1',
            sourceName: '抖音热榜',
            status: 'success',
            startedAt: '2026-04-27T00:00:00.000Z',
            finishedAt: '2026-04-27T00:02:00.000Z',
            resultCount: 12,
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
            title: '抖音热榜 报告',
            format: 'md',
            filePath: '/tmp/report-1.md',
            createdAt: '2026-04-27T00:03:00.000Z',
          },
        ];
      }
      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => expect(screen.getByText('example.com')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'HOT采集' }));

    await waitFor(() => {
      expect(screen.getByText('HOT采集源')).toBeDefined();
      expect(screen.getAllByText('抖音热榜').length).toBeGreaterThan(0);
      expect(screen.getByText('最近运行')).toBeDefined();
      expect(screen.getByText('HOT报告')).toBeDefined();
      expect(screen.getByText('抖音热榜 报告')).toBeDefined();
    });
  });

  it('creates a hot source and triggers report generation from the browser hot workspace', async () => {
    invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
        return [
          {
            id: 'source-1',
            taskId: 'task-1',
            name: '抖音热榜',
            sourceKind: 'browser',
            siteKey: 'douyin',
            entryUrl: 'https://www.douyin.com/hot',
            parserKey: 'douyin.hot',
            sessionId: null,
            schedule: { type: 'manual' },
            enabled: true,
            tags: ['热点'],
            createdAt: '2026-04-27T00:00:00.000Z',
            updatedAt: '2026-04-27T00:00:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        return [
          {
            batchId: 'batch-1',
            sourceId: 'source-1',
            sourceName: '抖音热榜',
            status: 'success',
            startedAt: '2026-04-27T00:00:00.000Z',
            finishedAt: '2026-04-27T00:02:00.000Z',
            resultCount: 12,
            reportStatus: 'pending',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) {
        return [];
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_CREATE) {
        expect(payload).toMatchObject({
          name: '微博热搜',
          sourceKind: 'api',
          siteKey: 'weibo',
        });
        return {
          id: 'source-2',
          taskId: 'task-2',
          name: '微博热搜',
          sourceKind: 'api',
          siteKey: 'weibo',
          entryUrl: 'https://weibo.com/hot',
          parserKey: 'weibo.hot',
          sessionId: null,
          schedule: { type: 'manual' },
          enabled: true,
          tags: ['微博'],
          createdAt: '2026-04-27T00:05:00.000Z',
          updatedAt: '2026-04-27T00:05:00.000Z',
        };
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_GENERATE) {
        expect(payload).toEqual({
          sourceId: 'source-1',
          batchId: 'batch-1',
          format: 'md',
        });
        return {
          id: 'report-1',
          sourceId: 'source-1',
          batchId: 'batch-1',
          title: '抖音热榜 报告',
          format: 'md',
          filePath: '/tmp/report-1.md',
          createdAt: '2026-04-27T00:03:00.000Z',
        };
      }
      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => expect(screen.getByText('example.com')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'HOT采集' }));

    await waitFor(() => expect(screen.getByText('HOT采集源')).toBeDefined());

    fireEvent.change(screen.getByPlaceholderText('采集源名称'), {
      target: { value: '微博热搜' },
    });
    fireEvent.change(screen.getByPlaceholderText('站点标识，如 douyin / weibo'), {
      target: { value: 'weibo' },
    });
    fireEvent.change(screen.getByPlaceholderText('入口 URL'), {
      target: { value: 'https://weibo.com/hot' },
    });
    fireEvent.change(screen.getByPlaceholderText('解析器标识，如 douyin.hot'), {
      target: { value: 'weibo.hot' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建HOT采集源' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        expect.objectContaining({
          name: '微博热搜',
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_GENERATE, {
        sourceId: 'source-1',
        batchId: 'batch-1',
        format: 'md',
      });
    });
  });

  it('loads hot source detail, updates it and deletes it from the browser hot workspace', async () => {
    let currentSources = [
      {
        id: 'source-1',
        taskId: 'task-1',
        name: '抖音热榜',
        sourceKind: 'browser' as const,
        siteKey: 'douyin',
        entryUrl: 'https://www.douyin.com/hot',
        parserKey: 'douyin.hot',
        sessionId: null,
        schedule: { type: 'manual' as const },
        enabled: true,
        tags: ['热点'],
        createdAt: '2026-04-27T00:00:00.000Z',
        updatedAt: '2026-04-27T00:00:00.000Z',
      },
    ];

    invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
        return currentSources;
      }
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        return [];
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) {
        return [];
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_DETAIL) {
        expect(payload).toEqual({ sourceId: 'source-1' });
        return currentSources[0];
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_UPDATE) {
        expect(payload).toMatchObject({
          sourceId: 'source-1',
          updates: {
            name: '抖音热榜更新版',
            sourceKind: 'browser',
            siteKey: 'douyin',
          },
        });
        currentSources = [
          {
            ...currentSources[0],
            name: '抖音热榜更新版',
            updatedAt: '2026-04-27T01:00:00.000Z',
          },
        ];
        return currentSources[0];
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_DELETE) {
        expect(payload).toEqual({ sourceId: 'source-1' });
        currentSources = [];
        return null;
      }
      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => expect(screen.getByText('example.com')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'HOT采集' }));

    await waitFor(() => expect(screen.getByText('HOT采集源')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: '加载详情' }));

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('采集源名称') as HTMLInputElement;
      expect(nameInput.value).toBe('抖音热榜');
    });

    fireEvent.change(screen.getByPlaceholderText('采集源名称'), {
      target: { value: '抖音热榜更新版' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_SOURCE_UPDATE, {
        sourceId: 'source-1',
        updates: expect.objectContaining({
          name: '抖音热榜更新版',
        }),
      });
      expect(screen.getAllByText('抖音热榜更新版').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: '删除采集源' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_SOURCE_DELETE, {
        sourceId: 'source-1',
      });
      expect(screen.queryByText('抖音热榜更新版')).toBeNull();
    });
  });

  it('loads hot run detail and allows rerunning the source from the browser hot workspace', async () => {
    invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
      if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
        return tabs;
      }
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) {
        return [
          {
            id: 'source-1',
            taskId: 'task-1',
            name: '抖音热榜',
            sourceKind: 'browser',
            siteKey: 'douyin',
            entryUrl: 'https://www.douyin.com/hot',
            parserKey: 'douyin.hot',
            sessionId: null,
            schedule: { type: 'manual' },
            enabled: true,
            tags: ['热点'],
            createdAt: '2026-04-27T00:00:00.000Z',
            updatedAt: '2026-04-27T00:00:00.000Z',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        return [
          {
            batchId: 'batch-1',
            sourceId: 'source-1',
            sourceName: '抖音热榜',
            status: 'failed',
            startedAt: '2026-04-27T00:00:00.000Z',
            finishedAt: '2026-04-27T00:02:00.000Z',
            resultCount: 2,
            reportStatus: 'pending',
          },
        ];
      }
      if (channel === IPC_CHANNELS.HOT_REPORT_LIST) {
        return [];
      }
      if (channel === IPC_CHANNELS.HOT_RUN_DETAIL) {
        expect(payload).toEqual({
          sourceId: 'source-1',
          batchId: 'batch-1',
        });
        return {
          batchId: 'batch-1',
          sourceId: 'source-1',
          sourceName: '抖音热榜',
          taskId: 'task-1',
          status: 'failed',
          startedAt: '2026-04-27T00:00:00.000Z',
          finishedAt: '2026-04-27T00:02:00.000Z',
          resultCount: 2,
          reportStatus: 'pending',
          error: 'selector missing',
          breakpoint: {
            stepIndex: 0,
            error: 'selector missing',
          },
          stepResults: [
            {
              stepId: 'step-1',
              success: false,
              duration: 120,
              error: 'selector missing',
              startedAt: '2026-04-27T00:00:30.000Z',
              finishedAt: '2026-04-27T00:00:30.120Z',
              screenshot: 'shots/step-1.png',
              domSnapshot: 'snapshots/step-1.html',
            },
            {
              stepId: 'step-2',
              success: true,
              duration: 80,
              startedAt: '2026-04-27T00:00:31.000Z',
              finishedAt: '2026-04-27T00:00:31.080Z',
            },
          ],
          linkedResultIds: ['result-1', 'result-2'],
        };
      }
      if (channel === IPC_CHANNELS.HOT_RUN_START) {
        expect(payload).toEqual({ sourceId: 'source-1' });
        return {
          sourceId: 'source-1',
          taskId: 'task-1',
          started: true,
        };
      }
      return null;
    });

    render(<BrowserApp />);

    await waitFor(() => expect(screen.getByText('example.com')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'HOT采集' }));

    await waitFor(() => expect(screen.getByText('最近运行')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));

    await waitFor(() => {
      expect(screen.getByText('运行详情')).toBeDefined();
      expect(screen.getByText(/^错误：selector missing$/)).toBeDefined();
      expect(screen.getByText(/步骤结果 2 条/)).toBeDefined();
      expect(screen.getByText(/关联结果 2 条/)).toBeDefined();
      expect(screen.getByText(/失败定位：第 1 步/)).toBeDefined();
      expect(screen.getByText(/开始：2026-04-27T00:00:00.000Z/)).toBeDefined();
      expect(screen.getByText(/结束：2026-04-27T00:02:00.000Z/)).toBeDefined();
      expect(screen.getByText(/断点错误：selector missing/)).toBeDefined();
      expect(screen.getByText(/step-1 · 失败 · 120ms/)).toBeDefined();
      expect(screen.getByText(/step-2 · 成功 · 80ms/)).toBeDefined();
      expect(screen.getByText(/截图：shots\/step-1\.png/)).toBeDefined();
      expect(screen.getByText(/DOM快照：snapshots\/step-1\.html/)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: '重新运行' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_START, {
        sourceId: 'source-1',
      });
    });
  });
});
