import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HotReportService } from '@main/services/hot/HotReportService';

describe('HotReportService', () => {
  const sourceRepository = {
    getSource: vi.fn(),
  };
  const batchService = {
    getBatch: vi.fn(),
  };
  const resultService = {
    listResults: vi.fn(),
  };
  const executionLogService = {
    query: vi.fn(),
  };
  const reportRepository = {
    saveReport: vi.fn(),
    listReports: vi.fn(),
    getReportByBatchId: vi.fn(),
    getReport: vi.fn(),
    deleteReport: vi.fn(),
  };
  const writeFile = vi.fn();
  const unlinkFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    reportRepository.getReport.mockReturnValue(null);
    sourceRepository.getSource.mockReturnValue({
      id: 'source-1',
      taskId: 'task-1',
      name: '抖音热榜',
      siteKey: 'douyin',
      entryUrl: 'https://www.douyin.com/hot',
    });
    batchService.getBatch.mockReturnValue({
      id: 'batch-1',
      taskId: 'task-1',
      status: 'success',
      startedAt: '2026-04-27T00:00:00.000Z',
      finishedAt: '2026-04-27T00:02:00.000Z',
      stepResults: [],
      createdAt: '2026-04-27T00:00:00.000Z',
    });
    resultService.listResults.mockReturnValue([
      {
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: { title: '热点 1', heat: 9999 },
        status: 'normal',
        createdAt: '2026-04-27T00:01:00.000Z',
      },
    ]);
    executionLogService.query.mockReturnValue([
      {
        level: 'info',
        message: '采集完成',
        createdAt: '2026-04-27T00:02:00.000Z',
      },
    ]);
  });

  it('deletes report metadata and removes the generated report file when present', () => {
    reportRepository.getReport.mockReturnValue({
      id: 'report-1',
      sourceId: 'source-1',
      batchId: 'batch-1',
      title: '抖音热榜 报告',
      format: 'html',
      filePath: '/tmp/hot-reports/html/2026-04-27/08-05.html',
      createdAt: '2026-04-27T00:05:00.000Z',
    });
    reportRepository.deleteReport.mockReturnValue(true);
    const service = new HotReportService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      executionLogService: executionLogService as never,
      reportRepository: reportRepository as never,
      unlinkFile,
    });

    const result = service.deleteReport('report-1');

    expect(unlinkFile).toHaveBeenCalledWith('/tmp/hot-reports/html/2026-04-27/08-05.html');
    expect(reportRepository.deleteReport).toHaveBeenCalledWith('report-1');
    expect(result).toEqual({ deleted: true });
  });

  it('reveals the generated report file in the system file manager', () => {
    const revealFile = vi.fn();
    reportRepository.getReport.mockReturnValue({
      id: 'report-1',
      sourceId: 'source-1',
      batchId: 'batch-1',
      title: '抖音热榜 报告',
      format: 'html',
      filePath: '/tmp/hot-reports/html/2026-04-27/08-05.html',
      createdAt: '2026-04-27T00:05:00.000Z',
    });
    const service = new HotReportService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      executionLogService: executionLogService as never,
      reportRepository: reportRepository as never,
      revealFile,
    });

    const result = service.revealReport('report-1');

    expect(revealFile).toHaveBeenCalledWith('/tmp/hot-reports/html/2026-04-27/08-05.html');
    expect(result).toEqual({ revealed: true });
  });

  it('generates a markdown report file and persists the report metadata', () => {
    const service = new HotReportService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      executionLogService: executionLogService as never,
      reportRepository: reportRepository as never,
      writeFile,
      outputDir: '/tmp/hot-reports',
      now: () => new Date('2026-04-27T00:05:00.000Z'),
      createId: () => 'report-1',
    });

    const report = service.generateReport({
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'md',
    });

    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/hot-reports/report-1.md',
      expect.stringContaining('# 抖音热榜 报告'),
    );
    expect(reportRepository.saveReport).toHaveBeenCalledWith({
      id: 'report-1',
      sourceId: 'source-1',
      batchId: 'batch-1',
      title: '抖音热榜 报告',
      format: 'md',
      filePath: '/tmp/hot-reports/report-1.md',
      createdAt: '2026-04-27T00:05:00.000Z',
    });
    expect(report).toEqual({
      id: 'report-1',
      sourceId: 'source-1',
      batchId: 'batch-1',
      title: '抖音热榜 报告',
      format: 'md',
      filePath: '/tmp/hot-reports/report-1.md',
      createdAt: '2026-04-27T00:05:00.000Z',
    });
  });

  it('renders searchable hot result summaries and reads report content for preview', () => {
    const reportRepositoryWithDetail = {
      ...reportRepository,
      getReport: vi.fn(() => ({
        id: 'report-1',
        sourceId: 'source-1',
        batchId: 'batch-1',
        title: '抖音热榜 报告',
        format: 'md',
        filePath: '/tmp/hot-reports/report-1.md',
        createdAt: '2026-04-27T00:05:00.000Z',
      })),
    };
    resultService.listResults.mockReturnValue([
      {
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          title: 'AI 芯片投资升温',
          url: 'https://example.com/ai-chip',
          rank: 1,
          keywordGroups: ['AI'],
          isNew: true,
        },
        status: 'normal',
        createdAt: '2026-04-27T00:01:00.000Z',
      },
    ]);
    const readFile = vi.fn(() => '# 抖音热榜 报告\n\nAI 芯片投资升温');
    const service = new HotReportService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      executionLogService: executionLogService as never,
      reportRepository: reportRepositoryWithDetail as never,
      writeFile,
      readFile,
      outputDir: '/tmp/hot-reports',
      createId: () => 'report-1',
    });

    service.generateReport({ sourceId: 'source-1', batchId: 'batch-1', format: 'md' });
    const content = writeFile.mock.calls[0][1] as string;
    const detail = service.getReportDetail('report-1');

    expect(content).toContain('1. [AI 芯片投资升温](https://example.com/ai-chip)');
    expect(content).toContain('关键词组：AI');
    expect(content).toContain('新增：是');
    expect(detail).toEqual(expect.objectContaining({
      id: 'report-1',
      content: '# 抖音热榜 报告\n\nAI 芯片投资升温',
    }));
  });

  it('generates a TrendRadar-style html snapshot with hash tabs and latest copy', () => {
    sourceRepository.getSource.mockReturnValue({
      id: 'source-1',
      taskId: 'task-1',
      name: 'TrendRadar 多平台热榜',
      siteKey: 'trendradar',
      parserKey: 'newsnow.batch',
      entryUrl: 'https://newsnow.busiyi.world/api/s',
    });
    resultService.listResults.mockReturnValue([
      {
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          title: 'AI 芯片投资升温',
          url: 'https://example.com/ai-chip',
          rank: 2,
          sourceId: 'zhihu',
          sourceName: '知乎',
          updatedTime: '2026-05-06T08:14:00.000Z',
          keywordGroups: ['AI 相关'],
          isNew: true,
        },
        status: 'normal',
        createdAt: '2026-05-06T08:14:00.000Z',
      },
      {
        id: 'result-2',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          title: 'A 股芯片板块走强',
          url: 'https://example.com/chip',
          rank: 5,
          sourceId: 'baidu',
          updatedTime: '2026-05-06T08:14:00.000Z',
          keywordGroups: ['芯片'],
        },
        status: 'normal',
        createdAt: '2026-05-06T08:14:00.000Z',
      },
    ]);
    const service = new HotReportService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      executionLogService: executionLogService as never,
      reportRepository: reportRepository as never,
      writeFile,
      outputDir: 'E:/allsite/yclaw/output',
      now: () => new Date('2026-05-06T08:15:00.000Z'),
      createId: () => 'report-html-1',
    });

    const report = service.generateReport({
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'html',
    });

    expect(writeFile).toHaveBeenCalledWith(
      'E:/allsite/yclaw/output/html/2026-05-06/16-15.html',
      expect.stringContaining('<div class="tab-bar">'),
    );
    const html = writeFile.mock.calls[0][1] as string;
    expect(html).toContain('TrendRadar');
    expect(html).toContain('data-tab-index="0"');
    expect(html).toContain('data-tab-index="1"');
    expect(html).toContain('history.replaceState(null, \'\', \'#tab-\' + idx)');
    expect(html).toContain("if (hash === '#all') activateTab('all');");
    expect(html).toContain('else activateTab(\'all\');');
    expect(html).toContain('AI 相关');
    expect(html).toContain('AI 芯片投资升温');
    expect(html).toContain('class="badge-new"');
    expect(html).toContain('百度热搜');
    expect(writeFile).toHaveBeenCalledWith(
      'E:/allsite/yclaw/output/html/latest/current.html',
      html,
    );
    expect(reportRepository.saveReport).toHaveBeenCalledWith(expect.objectContaining({
      id: 'report-html-1',
      format: 'html',
      filePath: 'E:/allsite/yclaw/output/html/2026-05-06/16-15.html',
    }));
    expect(report.filePath).toBe('E:/allsite/yclaw/output/html/2026-05-06/16-15.html');
  });

  it('does not overwrite aggregate latest html when generating a single-source html report', () => {
    sourceRepository.getSource.mockReturnValue({
      id: 'source-1',
      taskId: 'task-1',
      name: '今日头条',
      siteKey: 'toutiao',
      parserKey: 'newsnow.hot',
      entryUrl: 'https://newsnow.busiyi.world/api/s?id=toutiao&latest',
    });
    resultService.listResults.mockReturnValue([
      {
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          title: '头条热点',
          url: 'https://example.com/toutiao',
          rank: 1,
          sourceId: 'toutiao',
        },
        status: 'normal',
        createdAt: '2026-05-06T08:14:00.000Z',
      },
    ]);
    const service = new HotReportService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      executionLogService: executionLogService as never,
      reportRepository: reportRepository as never,
      writeFile,
      outputDir: 'E:/allsite/yclaw/output',
      now: () => new Date('2026-05-06T10:00:00.000Z'),
      createId: () => 'report-html-2',
    });

    service.generateReport({
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'html',
    });

    expect(writeFile).toHaveBeenCalledWith(
      'E:/allsite/yclaw/output/html/2026-05-06/18-00.html',
      expect.any(String),
    );
    expect(writeFile).not.toHaveBeenCalledWith(
      'E:/allsite/yclaw/output/html/latest/current.html',
      expect.any(String),
    );
  });

  it('applies a single source keyword filter when generating the report without losing raw crawl results', () => {
    sourceRepository.getSource.mockReturnValue({
      id: 'source-1',
      taskId: 'task-1',
      name: '知乎热榜',
      siteKey: 'zhihu',
      parserKey: 'newsnow.hot',
      entryUrl: 'https://newsnow.busiyi.world/api/s?id=zhihu&latest',
      filter: {
        keywordGroups: [{ name: '游戏', include: ['暗黑4'] }],
      },
    });
    resultService.listResults.mockReturnValue([
      {
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          title: '暗黑4 新赛季更新',
          url: 'https://example.com/diablo',
          rank: 1,
          sourceId: 'zhihu',
        },
        status: 'normal',
        createdAt: '2026-05-06T08:14:00.000Z',
      },
      {
        id: 'result-2',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          title: '普通社会新闻',
          url: 'https://example.com/news',
          rank: 2,
          sourceId: 'zhihu',
        },
        status: 'normal',
        createdAt: '2026-05-06T08:14:00.000Z',
      },
    ]);
    const service = new HotReportService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      executionLogService: executionLogService as never,
      reportRepository: reportRepository as never,
      writeFile,
      outputDir: 'E:/allsite/yclaw/output',
      now: () => new Date('2026-05-06T10:00:00.000Z'),
      createId: () => 'report-html-filtered',
    });

    service.generateReport({
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'html',
    });

    const html = writeFile.mock.calls[0][1] as string;
    expect(resultService.listResults).toHaveBeenCalledWith({ batchId: 'batch-1' });
    expect(html).toContain('暗黑4 新赛季更新');
    expect(html).toContain('游戏');
    expect(html).not.toContain('普通社会新闻');
  });

  it('projects TrendRadar config into keyword hotlist and standalone sections while keeping total count', () => {
    sourceRepository.getSource.mockReturnValue({
      id: 'source-1',
      taskId: 'task-1',
      name: 'TrendRadar 多平台热榜',
      siteKey: 'trendradar',
      parserKey: 'newsnow.batch',
      entryUrl: 'https://newsnow.busiyi.world/api/s',
    });
    resultService.listResults.mockReturnValue([
      {
        id: 'result-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          title: 'OpenAI 发布新模型',
          url: 'https://example.com/openai',
          rank: 1,
          sourceId: 'zhihu',
          sourceName: '知乎',
          updatedTime: '2026-05-06T08:14:00.000Z',
        },
        status: 'normal',
        createdAt: '2026-05-06T08:14:00.000Z',
      },
      {
        id: 'result-2',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          title: '中国资产关注度上升',
          url: 'https://example.com/china',
          rank: 2,
          sourceId: 'baidu',
          sourceName: '百度热搜',
          updatedTime: '2026-05-06T08:14:00.000Z',
        },
        status: 'normal',
        createdAt: '2026-05-06T08:14:00.000Z',
      },
      {
        id: 'result-3',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          title: '知乎热议：体育赛事',
          url: 'https://example.com/zhihu-sports',
          rank: 3,
          sourceId: 'zhihu',
          sourceName: '知乎',
          updatedTime: '2026-05-06T08:14:00.000Z',
        },
        status: 'normal',
        createdAt: '2026-05-06T08:14:00.000Z',
      },
      {
        id: 'result-4',
        taskId: 'task-1',
        batchId: 'batch-1',
        data: {
          title: '华尔街盘前速递',
          url: 'https://example.com/wscn',
          rank: 4,
          sourceId: 'wallstreetcn-hot',
          sourceName: '华尔街见闻',
          updatedTime: '2026-05-06T08:14:00.000Z',
        },
        status: 'normal',
        createdAt: '2026-05-06T08:14:00.000Z',
      },
    ]);
    const service = new HotReportService({
      sourceRepository: sourceRepository as never,
      batchService: batchService as never,
      resultService: resultService as never,
      executionLogService: executionLogService as never,
      reportRepository: reportRepository as never,
      writeFile,
      outputDir: 'E:/allsite/yclaw/output',
      now: () => new Date('2026-05-06T08:15:00.000Z'),
      createId: () => 'report-html-3',
      trendRadarConfigService: {
        loadProfile: () => ({
          platformIds: ['toutiao', 'baidu', 'zhihu', 'wallstreetcn-hot'],
          platformNames: {
            zhihu: '知乎',
            'wallstreetcn-hot': '华尔街见闻',
          },
          displayMode: 'keyword',
          filterMethod: 'keyword',
          standalone: {
            platformIds: ['zhihu', 'wallstreetcn-hot'],
            maxItems: 20,
          },
          filter: {
            keywordGroups: [
              { name: 'AI 相关', include: ['/OpenAI|AI/'] },
              { name: '中国', include: ['中国'] },
            ],
            excludeKeywords: ['震惊'],
          },
        }),
      } as never,
    });

    service.generateReport({
      sourceId: 'source-1',
      batchId: 'batch-1',
      format: 'html',
    });

    const html = writeFile.mock.calls[0][1] as string;
    expect(html).toContain('新闻总数</span><span class="info-value">4 条</span>');
    expect(html).toContain('AI 相关');
    expect(html).toContain('中国');
    expect(html).toContain('独立展示区');
    expect(html).toContain('知乎');
    expect(html).toContain('华尔街见闻');
    expect(html).toContain('知乎热议：体育赛事');
    expect(html).toContain('华尔街盘前速递');
  });
});
