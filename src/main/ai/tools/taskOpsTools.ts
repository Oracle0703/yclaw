import type { AIServiceContext } from '@shared/types';
import type { AITool } from '../types';

function ensureTaskOpsContext(context: AIServiceContext) {
  if (!context.taskOperations) {
    throw new Error('task operations context is unavailable');
  }

  return context.taskOperations;
}

export const taskOpsTools: AITool[] = [
  {
    name: 'ops_task_summary',
    description: '汇总任务运营中台的任务、告警、结果与复盘状态',
    parameters: {
      taskId: { type: 'string', description: '可选，指定任务 ID' },
    },
    confirmationLevel: 0,
    async execute(params, context) {
      try {
        const taskOps = ensureTaskOpsContext(context);
        const taskId = typeof params.taskId === 'string' ? params.taskId : undefined;
        const tasks = taskId
          ? taskOps.tasks.filter((task) => task.id === taskId)
          : taskOps.tasks;

        if (tasks.length === 0) {
          return { success: false, error: `Task "${taskId}" not found` };
        }

        const taskIds = new Set(tasks.map((task) => task.id));
        const alerts = taskOps.alerts.filter((alert) => taskIds.has(alert.taskId));
        const reviews = taskOps.reviews.filter((review) => taskIds.has(review.taskId));
        const results = taskOps.results.filter((result) => taskIds.has(result.taskId));

        return {
          success: true,
          data: {
            task: taskId ? tasks[0] : null,
            summary: {
              totalTasks: tasks.length,
              workspaceCount: taskOps.workspaces.length,
            },
            alerts: {
              total: alerts.length,
              critical: alerts.filter((alert) => alert.level === 'critical').length,
              claimed: alerts.filter((alert) => alert.status === 'claimed').length,
            },
            reviews: {
              total: reviews.length,
            },
            results: {
              total: results.length,
              failed: results.filter(
                (result) => result.status === 'failed' || result.qualityStatus === 'failed',
              ).length,
            },
            runners: {
              total: taskOps.runners.length,
              online: taskOps.runners.filter((runner) => runner.status === 'online').length,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'failed to summarize task operations',
        };
      }
    },
  },
  {
    name: 'ops_alert_summary',
    description: '汇总当前告警状态、等级与责任归属',
    parameters: {},
    confirmationLevel: 0,
    async execute(_, context) {
      try {
        const taskOps = ensureTaskOpsContext(context);
        return {
          success: true,
          data: {
            total: taskOps.alerts.length,
            unread: taskOps.alerts.filter((alert) => !alert.read).length,
            critical: taskOps.alerts.filter((alert) => alert.level === 'critical').length,
            claimed: taskOps.alerts.filter((alert) => alert.status === 'claimed').length,
            items: taskOps.alerts.slice(0, 5),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'failed to summarize alerts',
        };
      }
    },
  },
  {
    name: 'ops_runner_status',
    description: '汇总 Runner 在线率、负载与容量状态',
    parameters: {},
    confirmationLevel: 0,
    async execute(_, context) {
      try {
        const taskOps = ensureTaskOpsContext(context);
        return {
          success: true,
          data: {
            total: taskOps.runners.length,
            online: taskOps.runners.filter((runner) => runner.status === 'online').length,
            saturated: taskOps.runners.filter(
              (runner) => runner.maxConcurrency > 0 && runner.runningCount >= runner.maxConcurrency,
            ).length,
            items: taskOps.runners.slice(0, 5),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'failed to summarize runners',
        };
      }
    },
  },
  {
    name: 'ops_review_draft',
    description: '基于批次、告警、结果和历史复盘生成复盘初稿',
    parameters: {
      batchId: { type: 'string', description: '可选，指定批次 ID' },
      taskId: { type: 'string', description: '可选，指定任务 ID' },
    },
    confirmationLevel: 1,
    async execute(params, context) {
      try {
        const taskOps = ensureTaskOpsContext(context);
        const batchId = typeof params.batchId === 'string' ? params.batchId : undefined;
        const taskId = typeof params.taskId === 'string' ? params.taskId : undefined;

        const alerts = taskOps.alerts.filter((alert) =>
          (batchId ? alert.batchId === batchId : true) && (taskId ? alert.taskId === taskId : true),
        );
        const reviews = taskOps.reviews.filter((review) =>
          (batchId ? review.batchId === batchId : true) && (taskId ? review.taskId === taskId : true),
        );
        const results = taskOps.results.filter((result) =>
          (batchId ? result.batchId === batchId : true) && (taskId ? result.taskId === taskId : true),
        );

        const targetLabel = batchId ?? taskId ?? '当前任务集';
        const latestReview = reviews[0];
        const draft = [
          `复盘对象：${targetLabel}`,
          `告警概况：共 ${alerts.length} 条，Critical ${alerts.filter((alert) => alert.level === 'critical').length} 条。`,
          `结果概况：共 ${results.length} 条，失败/质量失败 ${results.filter((result) => result.status === 'failed' || result.qualityStatus === 'failed').length} 条。`,
          latestReview?.conclusion ? `历史结论：${latestReview.conclusion}` : '历史结论：暂无',
          latestReview?.followUpActions?.length
            ? `建议动作：${latestReview.followUpActions.join('、')}`
            : '建议动作：补充模板修复、结果校验与告警处理人。',
        ].join('\n');

        return {
          success: true,
          data: {
            title: `批次 ${targetLabel} 复盘初稿`,
            draft,
            evidence: {
              alerts: alerts.length,
              results: results.length,
              reviews: reviews.length,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'failed to generate review draft',
        };
      }
    },
  },
];
