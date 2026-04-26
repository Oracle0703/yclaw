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
});
