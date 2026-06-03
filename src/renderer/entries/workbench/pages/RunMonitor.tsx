import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, List, Space, Tag, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { HotRunSummary, HotSource, SigninRunSummary, TaskBatch } from '@shared/types';
import type { TaskSummary } from '@main/services/TaskService';
import { IPC_CHANNELS } from '@shared/constants';
import { PageShell } from '../../../shared/components/PageShell';
import { useIpc } from '../../../shared/hooks';
import { buildRunMonitorViewModel, type UnifiedRunRecord } from '../task-toolbench/runMonitorViewModel';
import { isJdSigninTask, normalizeIpcError } from '../task-toolbench/runtime';

export default function RunMonitor() {
  const { invoke } = useIpc();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [runs, setRuns] = useState<UnifiedRunRecord[]>([]);
  const selectedTaskId = searchParams.get('taskId');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tasks = await invoke<TaskSummary[]>(IPC_CHANNELS.TASK_LIST);
      const visibleTasks = selectedTaskId ? tasks.filter((task) => task.id === selectedTaskId) : tasks;
      const [batches, signinRuns, hotSources, hotRuns] = await Promise.all([
        loadBatches(invoke, visibleTasks),
        loadSigninRuns(invoke, visibleTasks.filter(isJdSigninTask)),
        invoke<HotSource[]>(IPC_CHANNELS.HOT_SOURCE_LIST).catch(() => []),
        invoke<HotRunSummary[]>(IPC_CHANNELS.HOT_RUN_LIST, {}).catch(() => []),
      ]);
      const visibleHotSources = selectedTaskId
        ? hotSources.filter((source) => source.taskId === selectedTaskId)
        : hotSources;
      const visibleHotSourceIds = new Set(visibleHotSources.map((source) => source.id));
      const visibleHotRuns = hotRuns.filter((run) => visibleHotSourceIds.has(run.sourceId));
      setRuns(
        buildRunMonitorViewModel({
          batches,
          signinRuns,
          hotRuns: visibleHotRuns,
          hotSources: visibleHotSources,
        }).runs,
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [invoke, selectedTaskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const retryRun = async (run: UnifiedRunRecord) => {
    try {
      if (run.sourceType === 'batch') {
        await invoke(IPC_CHANNELS.BATCH_RETRY, { batchId: run.runId.replace(/^batch:/, '') });
        message.success('已创建重试批次');
      } else if (run.rawStatus === 'needs_intervention') {
        await invoke(IPC_CHANNELS.SIGNIN_TASK_INTERVENTION_RETRY, { taskId: run.taskId });
        message.success('已提交介入后重试');
      } else {
        await invoke(IPC_CHANNELS.SIGNIN_TASK_RUN_NOW, { taskId: run.taskId });
        message.success('已重新运行签到任务');
      }
      await load();
    } catch (err) {
      message.error(`操作失败：${normalizeIpcError(err)}`);
    }
  };

  const generateHotReport = async (run: UnifiedRunRecord) => {
    if (run.sourceType !== 'hot' || !run.batchId) return;
    const sourceId = getHotRunSourceId(run);
    if (!sourceId) {
      message.error('生成报告失败：热点源缺失');
      return;
    }

    try {
      await invoke(IPC_CHANNELS.HOT_REPORT_GENERATE, {
        sourceId,
        batchId: run.batchId,
        format: 'html',
      });
      message.success('热点报告已生成');
      await load();
    } catch (err) {
      message.error(`生成报告失败：${normalizeIpcError(err)}`);
    }
  };

  const selectedRun = useMemo(() => runs[0] ?? null, [runs]);

  return (
    <PageShell title="运行监控" loading={loading} error={error} onRetry={() => void load()}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div className="taskbench-page-head">
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>
              运行监控
            </Typography.Title>
            <Typography.Text type="secondary">
              普通批次、京东签到专项和热点运行在同一列表中展示。
            </Typography.Text>
          </div>
          <Space wrap>
            <Button onClick={() => navigate('/')}>返回任务台</Button>
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              刷新
            </Button>
          </Space>
        </div>

        {runs.length === 0 ? <Alert type="info" showIcon message="还没有运行记录" /> : null}

        <Card title="运行记录">
          <List
            dataSource={runs}
            locale={{ emptyText: '暂无运行记录' }}
            renderItem={(run) => (
              <List.Item
                actions={[
                  run.actions.includes('retry-batch') ||
                  run.actions.includes('intervention-retry') ||
                  run.actions.includes('rerun-signin') ? (
                    <Button key="retry" type="link" onClick={() => void retryRun(run)}>
                      {run.actions.includes('retry-batch') ? '创建重试批次' : '重新运行'}
                    </Button>
                  ) : null,
                  run.actions.includes('generate-hot-report') ? (
                    <Button key="hot-report" type="link" onClick={() => void generateHotReport(run)}>
                      生成报告
                    </Button>
                  ) : null,
                  run.actions.includes('view-hot-report') ? (
                    <Button key="view-hot-report" type="link" onClick={() => navigate(`/results?taskId=${run.taskId}`)}>
                      查看报告
                    </Button>
                  ) : null,
                  <Button key="result" type="link" onClick={() => navigate(`/results?taskId=${run.taskId}`)}>
                    结果
                  </Button>,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Typography.Text strong>{run.runId}</Typography.Text>
                      <Tag color={getRunSourceColor(run.sourceType)}>{run.sourceType}</Tag>
                      <Tag color={run.rawStatus === 'failed' || run.rawStatus === 'needs_intervention' ? 'error' : 'processing'}>
                        {run.statusLabel}
                      </Tag>
                    </Space>
                  }
                  description={run.error ?? '无错误'}
                />
              </List.Item>
            )}
          />
        </Card>

        {selectedRun ? (
          <Card title="最近运行详情">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="来源">{selectedRun.sourceType}</Descriptions.Item>
              <Descriptions.Item label="任务 ID">{selectedRun.taskId}</Descriptions.Item>
              <Descriptions.Item label="状态">{selectedRun.statusLabel}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{selectedRun.startedAt}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{selectedRun.finishedAt ?? '运行中或未结束'}</Descriptions.Item>
              <Descriptions.Item label="失败原因">{selectedRun.error ?? '无'}</Descriptions.Item>
              {selectedRun.sourceType === 'hot' ? (
                <>
                  <Descriptions.Item label="结果数量">{selectedRun.resultCount ?? 0}</Descriptions.Item>
                  <Descriptions.Item label="报告状态">
                    {selectedRun.reportStatus === 'generated' ? '已生成' : '未生成'}
                  </Descriptions.Item>
                </>
              ) : null}
              <Descriptions.Item label="调试信息">
                <pre className="taskbench-debug-block">{JSON.stringify(selectedRun.debug ?? {}, null, 2)}</pre>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        ) : null}
      </Space>
    </PageShell>
  );
}

function getHotRunSourceId(run: UnifiedRunRecord): string | null {
  if (run.sourceType !== 'hot') return null;
  if (
    typeof run.raw === 'object' &&
    run.raw !== null &&
    'sourceId' in run.raw &&
    typeof run.raw.sourceId === 'string'
  ) {
    return run.raw.sourceId;
  }
  return run.runId.split(':')[1] ?? null;
}

function getRunSourceColor(sourceType: UnifiedRunRecord['sourceType']): string {
  if (sourceType === 'signin') return 'purple';
  if (sourceType === 'hot') return 'orange';
  return 'blue';
}

async function loadBatches(
  invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>,
  tasks: TaskSummary[],
): Promise<TaskBatch[]> {
  const nested = await Promise.all(
    tasks.map(async (task) => {
      try {
        return await invoke<TaskBatch[]>(IPC_CHANNELS.TASK_BATCH_LIST, { taskId: task.id });
      } catch {
        return [];
      }
    }),
  );
  return nested.flat();
}

async function loadSigninRuns(
  invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>,
  tasks: TaskSummary[],
): Promise<SigninRunSummary[]> {
  const nested = await Promise.all(
    tasks.map(async (task) => {
      try {
        return await invoke<SigninRunSummary[]>(IPC_CHANNELS.SIGNIN_TASK_HISTORY, { taskId: task.id });
      } catch {
        return [];
      }
    }),
  );
  return nested.flat();
}
