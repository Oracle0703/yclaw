import { beforeEach, describe, expect, it } from 'vitest';
import { ToolRegistry } from '@main/ai/ToolRegistry';
import { taskOpsTools } from '@main/ai/tools/taskOpsTools';
import type { AIServiceContext } from '@shared/types/ai';

const mockContext: AIServiceContext = {
  currentModule: 'automation',
  systemMetrics: { cpu: 42, memory: 58, disk: 40, uptime: 7200 },
  recentTasks: [
    { name: '价格采集', status: 'failed', updatedAt: '2026-04-21T10:00:00.000Z' },
  ],
  installedPlugins: [],
  taskOperations: {
    workspaces: [{ id: 'workspace-1', name: '电商巡检组' }],
    tasks: [
      {
        id: 'task-1',
        name: '价格采集',
        status: 'failed',
        updatedAt: '2026-04-21T10:00:00.000Z',
        currentRevisionId: 'revision-1',
      },
    ],
    alerts: [
      {
        id: 'alert-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        message: '任务失败',
        createdAt: '2026-04-21T10:05:00.000Z',
        read: false,
        status: 'claimed',
        level: 'critical',
        assignee: 'alice',
      },
    ],
    reviews: [
      {
        id: 'review-1',
        taskId: 'task-1',
        batchId: 'batch-1',
        reviewType: 'failure',
        conclusion: '更新模板选择器',
        owner: 'alice',
        followUpActions: ['update-template'],
        createdAt: '2026-04-21T10:10:00.000Z',
      },
    ],
    runners: [
      {
        id: 'runner-1',
        name: 'runner-a',
        kind: 'remote',
        status: 'online',
        runningCount: 2,
        maxConcurrency: 4,
      },
    ],
    results: [
      {
        taskId: 'task-1',
        batchId: 'batch-1',
        status: 'failed',
        qualityStatus: 'failed',
        revisionId: 'revision-1',
      },
    ],
  },
};

describe('ToolRegistry task operations tools', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    taskOpsTools.forEach((tool) => registry.register(tool));
  });

  it('summarizes task operations status for ai tool calls', async () => {
    const result = await registry.execute('ops_task_summary', { taskId: 'task-1' }, mockContext);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      task: {
        id: 'task-1',
        currentRevisionId: 'revision-1',
      },
      alerts: {
        total: 1,
        critical: 1,
      },
      reviews: {
        total: 1,
      },
      results: {
        total: 1,
        failed: 1,
      },
    });
  });

  it('drafts a review from batch, alert and result evidence', async () => {
    const result = await registry.execute('ops_review_draft', { batchId: 'batch-1' }, mockContext);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      title: expect.stringContaining('batch-1'),
      draft: expect.stringContaining('更新模板选择器'),
    });
  });
});
