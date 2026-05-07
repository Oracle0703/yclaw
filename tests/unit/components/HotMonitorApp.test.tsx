import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPC_CHANNELS } from '@shared/constants/channels';

const { invokeMock, messageErrorMock, messageSuccessMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  messageErrorMock: vi.fn(),
  messageSuccessMock: vi.fn(),
}));

vi.mock('antd', () => ({
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

      return null;
    });
  });

  it('loads existing hot sources, runs and reports', async () => {
    render(<HotMonitorApp />);

    expect(await screen.findByText('热点监控')).toBeDefined();
    expect((await screen.findAllByText('AI 热榜')).length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText('批次：batch-1')).toBeDefined();
    expect(await screen.findByText('AI 热榜 报告')).toBeDefined();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_SOURCE_LIST);
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_LIST, {});
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_LIST, {});
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_TIMELINE_PRESETS);
    });
  });

  it('starts a hot source and reloads runs for that source', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '立即运行' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_START, {
        sourceId: 'source-1',
      });
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_LIST, {
        sourceId: 'source-1',
      });
      expect(messageSuccessMock).toHaveBeenCalledWith('热点采集已启动');
    });
  });

  it('opens a browser tab directly from hot monitor workspace', async () => {
    render(<HotMonitorApp />);

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

    expect(await screen.findByText('暂无运行记录')).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_RUN_LIST, {
      sourceId: 'source-1',
    });
  });

  it('fills the draft from a NewsNow preset source', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '知乎热榜' }));

    expect((screen.getByPlaceholderText('采集源名称') as HTMLInputElement).value).toBe('知乎热榜');
    expect((screen.getByPlaceholderText('站点标识，如 douyin / weibo') as HTMLInputElement).value)
      .toBe('zhihu');
    expect((screen.getByPlaceholderText('入口 URL') as HTMLInputElement).value)
      .toBe('https://newsnow.busiyi.world/api/s?id=zhihu&latest');
    expect((screen.getByPlaceholderText('解析器标识，如 douyin.hot') as HTMLInputElement).value)
      .toBe('newsnow.hot');
  });

  it('creates a TrendRadar multi-platform batch source for the 11 configured platforms', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: 'TrendRadar 11平台' }));
    fireEvent.click(screen.getByRole('button', { name: '创建HOT采集源' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        expect.objectContaining({
          name: 'TrendRadar 多平台热榜',
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

  it('starts a TrendRadar aggregate crawl without requiring a selected source', async () => {
    let aggregateStarted = false;
    invokeMock.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.HOT_SOURCE_LIST) return [];
      if (channel === IPC_CHANNELS.HOT_RUN_LIST) {
        return aggregateStarted
          ? [
            {
              batchId: 'batch-trendradar',
              sourceId: 'source-trendradar',
              sourceName: 'TrendRadar 多平台热榜',
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
          name: 'TrendRadar 多平台热榜',
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
          tags: ['TrendRadar', '多平台', '热榜'],
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
          name: 'TrendRadar 多平台热榜',
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

  it('creates an RSS source with keyword filters', async () => {
    render(<HotMonitorApp />);

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
    fireEvent.click(screen.getByRole('button', { name: '创建HOT采集源' }));

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

    fireEvent.click(await screen.findByRole('button', { name: '工作日时间线' }));
    fireEvent.change(screen.getByPlaceholderText('采集源名称'), {
      target: { value: '工作日热榜' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建HOT采集源' }));

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

    fireEvent.change(await screen.findByPlaceholderText('兴趣描述'), {
      target: { value: '关注 AI 基建' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生成AI摘要' }));

    expect(await screen.findByText('AI摘要：AI 芯片投资升温')).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_AI_SUMMARIZE, {
      interest: '关注 AI 基建',
      batchId: 'batch-1',
    });
  });

  it('sends the latest hot report to a webhook target', async () => {
    render(<HotMonitorApp />);

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

  it('searches and previews generated reports', async () => {
    render(<HotMonitorApp />);

    fireEvent.change(await screen.findByPlaceholderText('搜索报告'), {
      target: { value: 'AI' },
    });
    fireEvent.click(screen.getByRole('button', { name: '预览报告' }));

    expect(await screen.findByText(/<!DOCTYPE html>/)).toBeDefined();
    expect(await screen.findByText(/AI 芯片投资升温/)).toBeDefined();
    expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_DETAIL, {
      reportId: 'report-1',
    });
  });

  it('generates and opens TrendRadar-style html reports', async () => {
    render(<HotMonitorApp />);

    fireEvent.click(await screen.findByRole('button', { name: '生成报告' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开报告' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.HOT_REPORT_GENERATE, {
        sourceId: 'source-1',
        batchId: 'batch-1',
        format: 'html',
      });
      expect(invokeMock).toHaveBeenCalledWith(IPC_CHANNELS.BROWSER_CREATE_TAB, {
        url: 'file:///E:/allsite/yclaw/output/html/2026-05-06/16-15.html#all',
      });
    });
  });
});
