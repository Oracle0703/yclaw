// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, render, screen } from '@testing-library/react';

const { dataCenterApiMock } = vi.hoisted(() => ({
  dataCenterApiMock: {
    getOverview: vi.fn(async () => ({ totalResults: 0, suspiciousResults: 0, failedExports: 0, recentExports: [] })),
    listResults: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
    listExports: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
    listDatasets: vi.fn(async () => []),
    getApiStatus: vi.fn(async () => ({ running: false })),
    createExport: vi.fn(async () => ({ id: 'export-new', status: 'succeeded' })),
    saveDataset: vi.fn(async () => ({ id: 'dataset-1' })),
    listWebhookTargets: vi.fn(async () => []),
    saveWebhookTarget: vi.fn(async () => ({ id: 'webhook-1' })),
    testWebhookTarget: vi.fn(async () => ({ status: 'succeeded' })),
    deleteWebhookTarget: vi.fn(async () => true),
    listApiTokens: vi.fn(async () => []),
    createApiToken: vi.fn(async () => ({ token: { id: 'token-1' }, plainTextToken: 'token-secret' })),
    revokeApiToken: vi.fn(async () => ({ id: 'token-1', enabled: false })),
    cancelExport: vi.fn(async () => ({ id: 'export-1', status: 'cancelled' })),
    startApi: vi.fn(async () => ({ running: true, host: '127.0.0.1', port: 3941 })),
    stopApi: vi.fn(async () => ({ running: false })),
    retryExport: vi.fn(async () => ({ id: 'export-1', status: 'succeeded' })),
    listQualityRules: vi.fn(async () => [
      {
        ruleId: 'failed-result',
        name: '失败结果',
        description: '识别状态为 failed 的结果',
        severity: 'error',
        enabled: true,
        params: {},
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      },
    ]),
    saveQualityRule: vi.fn(async (rule: unknown) => rule),
    scanQuality: vi.fn(async () => ({
      scannedAt: '2026-04-22T00:00:00.000Z',
      totalResults: 3,
      issueCount: 2,
      affectedResults: 2,
      batchScore: {
        batchId: 'batch-1',
        score: 88,
        grade: 'good',
      },
      scores: [
        { resultId: 'result-empty', score: 92, grade: 'excellent', deductions: [] },
        { resultId: 'result-failed', score: 72, grade: 'watch', deductions: [] },
      ],
      batchInsight: {
        id: 'insight:batch-1',
        batchId: 'batch-1',
        taskId: 'task-1',
        score: 88,
        grade: 'good',
        totalResults: 3,
        issueCount: 2,
        affectedResults: 2,
        failedRate: 0.33,
        suspiciousRate: 0,
        duplicateRate: 0,
        topRules: [{ ruleId: 'failed-result', count: 1 }],
        topFields: [{ fieldPath: 'status', count: 1 }],
        severityBreakdown: { error: 1, warning: 1 },
        statusBreakdown: { failed: 1, normal: 2 },
        scoreTrendHint: 'down',
        summary: '质量分 88，较上一批下降。',
        createdAt: '2026-04-22T00:00:00.000Z',
      },
      rules: [
        { ruleId: 'empty-data', name: '空数据', severity: 'warning', hitCount: 1, sampleResultIds: ['result-empty'] },
        { ruleId: 'failed-result', name: '失败结果', severity: 'error', hitCount: 1, sampleResultIds: ['result-failed'] },
      ],
      issues: [
        {
          id: 'empty-data:result-empty',
          ruleId: 'empty-data',
          severity: 'warning',
          resultId: 'result-empty',
          taskId: 'task-1',
          batchId: 'batch-1',
          message: '结果数据为空',
          createdAt: '2026-04-22T00:00:00.000Z',
        },
      ],
    })),
  },
}));

vi.mock('antd', () => ({
  Alert: ({ message, description }: { message?: React.ReactNode; description?: React.ReactNode }) => (
    <div>
      <div>{message}</div>
      <div>{description}</div>
    </div>
  ),
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
  Drawer: ({ children, open }: { children?: React.ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  Form: Object.assign(
    ({ children }: { children?: React.ReactNode }) => <form>{children}</form>,
    { Item: ({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => <label>{label}{children}</label> },
  ),
  Input: ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
  Modal: ({
    children,
    onOk,
    open,
    title,
  }: {
    children?: React.ReactNode;
    onOk?: () => void;
    open?: boolean;
    title?: React.ReactNode;
  }) =>
    open ? (
      <div>
        {title ? <h4>{title}</h4> : null}
        {children}
        <button type="button" onClick={onOk}>
          {title}确认
        </button>
      </div>
    ) : null,
  Select: ({ children }: { children?: React.ReactNode }) => <select>{children}</select>,
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Statistic: ({ title, value }: { title?: React.ReactNode; value?: React.ReactNode }) => <div>{title}:{value}</div>,
  Switch: ({ checkedChildren, unCheckedChildren }: { checkedChildren?: React.ReactNode; unCheckedChildren?: React.ReactNode }) => (
    <button type="button">{checkedChildren ?? unCheckedChildren}</button>
  ),
  Table: ({ columns, dataSource }: { columns?: Array<{ title?: string; render?: (_: unknown, record: unknown) => React.ReactNode; dataIndex?: string }>; dataSource?: Record<string, unknown>[] }) => (
    <table>
      <thead>
        <tr>{columns?.map((column) => <th key={String(column.title)}>{column.title}</th>)}</tr>
      </thead>
      <tbody>
        {dataSource?.map((record, index) => (
          <tr key={index}>
            {columns?.map((column) => (
              <td key={String(column.title)}>
                {column.render ? column.render(undefined, record) : String(record[column.dataIndex ?? ''] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  Tabs: ({ items }: { items: Array<{ key: string; label: React.ReactNode; children: React.ReactNode }> }) => (
    <div>
      {items.map((item) => (
        <section key={item.key}>
          <h2>{item.label}</h2>
          {item.children}
        </section>
      ))}
    </div>
  ),
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
  message: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@ant-design/pro-components', () => ({
  ProCard: ({ title, children, extra }: { title?: React.ReactNode; children?: React.ReactNode; extra?: React.ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {extra}
      {children}
    </section>
  ),
}));

vi.mock('@renderer/shared/components/PageShell', () => ({
  PageShell: ({ title, subtitle, children }: { title?: string; subtitle?: string; children?: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </main>
  ),
}));

vi.mock('@renderer/shared/hooks', () => ({
  useIpc: () => ({
    dataCenter: dataCenterApiMock,
  }),
}));

import DataCenterApp from '@renderer/entries/data-center/App';

describe('DataCenter App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders overview, result asset and export tabs', async () => {
    await act(async () => {
      render(<DataCenterApp />);
    });

    expect(screen.getByText('数据中心')).toBeDefined();
    expect(screen.getAllByText('数据总览').length).toBeGreaterThan(0);
    expect(screen.getAllByText('结果资产').length).toBeGreaterThan(0);
    expect(screen.getAllByText('导出任务').length).toBeGreaterThan(0);
    expect(dataCenterApiMock.listResults).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(screen.queryByText('来自热点监控')).toBeNull();
  });

  it('scopes result assets and export jobs to the hot-monitor batch route context', async () => {
    await act(async () => {
      render(
        <DataCenterApp
          routeContext={{
            source: 'hot-monitor',
            taskId: 'task-hot-1',
            batchId: 'batch-hot-1',
          }}
        />,
      );
    });

    expect(screen.getByText('来自热点监控')).toBeDefined();
    expect(screen.getByText(/Task：task-hot-1/)).toBeDefined();
    expect(screen.getByText(/Batch：batch-hot-1/)).toBeDefined();
    expect(screen.getByText(/结果、新建导出和质量扫描将默认限定在该批次。/)).toBeDefined();
    expect(dataCenterApiMock.listResults).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      taskId: 'task-hot-1',
      batchId: 'batch-hot-1',
    });

    await act(async () => {
      screen.getByText('导出 JSONL').click();
    });

    expect(dataCenterApiMock.createExport).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          page: 1,
          pageSize: 500,
          taskId: 'task-hot-1',
          batchId: 'batch-hot-1',
        },
        format: 'jsonl',
      }),
    );

    await act(async () => {
      screen.getByText('新建导出').click();
    });
    await act(async () => {
      screen.getByText('新建导出确认').click();
    });

    expect(dataCenterApiMock.createExport).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          page: 1,
          pageSize: 200,
          taskId: 'task-hot-1',
          batchId: 'batch-hot-1',
        },
      }),
    );
  });

  it('describes task-only route context without mentioning a batch scope', async () => {
    await act(async () => {
      render(
        <DataCenterApp
          routeContext={{
            source: 'hot-monitor',
            taskId: 'task-hot-1',
          }}
        />,
      );
    });

    expect(screen.getByText(/Task：task-hot-1/)).toBeDefined();
    expect(screen.getByText(/结果、新建导出和质量扫描将默认限定在该任务。/)).toBeDefined();
    expect(screen.queryByText(/结果、新建导出和质量扫描将默认限定在该批次。/)).toBeNull();
  });

  it('scopes quality scan to the hot-monitor batch route context', async () => {
    await act(async () => {
      render(
        <DataCenterApp
          routeContext={{
            source: 'hot-monitor',
            taskId: 'task-hot-1',
            batchId: 'batch-hot-1',
          }}
        />,
      );
    });

    expect(screen.getByText('扫描当前批次')).toBeDefined();

    await act(async () => {
      screen.getByText('扫描当前批次').click();
    });

    expect(dataCenterApiMock.scanQuality).toHaveBeenCalledWith({
      query: {
        taskId: 'task-hot-1',
        batchId: 'batch-hot-1',
      },
      limit: 200,
    });
  });

  it('renders primary data-center actions', async () => {
    dataCenterApiMock.listExports.mockResolvedValueOnce({
      items: [
        {
          id: 'export-0',
          name: '等待导出',
          query: { page: 1, pageSize: 20, taskId: 'task-hot-1', batchId: 'batch-hot-1' },
          targetType: 'file',
          targetConfig: {},
          format: 'jsonl',
          status: 'pending',
          resultCount: 0,
          retryCount: 0,
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z',
        },
        {
          id: 'export-1',
          name: '失败导出',
          query: {
            page: 1,
            pageSize: 20,
            status: ['failed', 'ignored'],
            keyword: 'AI',
            createdFrom: '2026-04-01T00:00:00.000Z',
            createdTo: '2026-04-30T23:59:59.999Z',
          },
          targetType: 'file',
          targetConfig: {},
          format: 'jsonl',
          status: 'failed',
          resultCount: 0,
          retryCount: 1,
          createdAt: '2026-04-21T00:00:00.000Z',
          updatedAt: '2026-04-21T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    dataCenterApiMock.listWebhookTargets.mockResolvedValueOnce([
      {
        id: 'webhook-1',
        name: '测试回调',
        url: 'http://127.0.0.1:3000/hook',
        headers: null,
        secretHash: null,
        enabled: true,
        timeoutMs: 10000,
        maxRetries: 3,
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:00:00.000Z',
      },
    ]);
    dataCenterApiMock.listApiTokens.mockResolvedValueOnce([
      {
        id: 'token-1',
        name: '只读 Token',
        tokenHash: 'hash',
        scopes: ['results:read'],
        enabled: true,
        lastUsedAt: null,
        createdAt: '2026-04-22T00:00:00.000Z',
        revokedAt: null,
      },
    ]);

    await act(async () => {
      render(<DataCenterApp />);
    });

    expect(screen.getByText('保存数据集')).toBeDefined();
    expect(screen.getByText('新建导出')).toBeDefined();
    expect(screen.getByText('Task：task-hot-1 / Batch：batch-hot-1 / 每页 20')).toBeDefined();
    expect(screen.getByText('全部结果 / 状态：failed、ignored / 关键词：AI / 时间：2026-04-01 至 2026-04-30 / 每页 20')).toBeDefined();
    expect(screen.getByText('全部状态')).toBeDefined();
    expect(screen.getByText('取消任务')).toBeDefined();
    expect(screen.getByText('保存 Webhook')).toBeDefined();
    expect(screen.getByText('测试连通性')).toBeDefined();
    expect(screen.getByText('删除 Webhook')).toBeDefined();
    expect(screen.getByText('生成 Token')).toBeDefined();
    expect(screen.getByText('只读模板')).toBeDefined();
    expect(screen.getByText('吊销 Token')).toBeDefined();
    expect(screen.getByText('启动 API')).toBeDefined();
    expect(screen.getByText('重试')).toBeDefined();
    expect(screen.getByText('立即扫描')).toBeDefined();
    expect(screen.getByText('停用规则')).toBeDefined();

    await act(async () => {
      screen.getByText('停用规则').click();
    });

    expect(dataCenterApiMock.saveQualityRule).toHaveBeenCalledWith({
      ruleId: 'failed-result',
      enabled: false,
    });

    await act(async () => {
      screen.getByText('立即扫描').click();
    });

    expect(dataCenterApiMock.scanQuality).toHaveBeenCalledWith({ limit: 200 });
    expect(screen.getByText('规则命中')).toBeDefined();
    expect(screen.getByText('质量评分')).toBeDefined();
    expect(screen.getByText('批次洞察')).toBeDefined();
    expect(screen.getByText('Top 规则')).toBeDefined();
    expect(screen.getByText('质量分 88，较上一批下降。')).toBeDefined();
    expect(screen.getAllByText('失败结果').length).toBeGreaterThan(0);
  });
});
