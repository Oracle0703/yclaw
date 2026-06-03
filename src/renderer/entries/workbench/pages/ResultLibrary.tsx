import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Descriptions, List, Space, Tag, Typography, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type {
  DataCenterResultDetail,
  DataExportJob,
  ExtractionResult,
  HotReportSummary,
  HotSource,
  SigninRunSummary,
} from '@shared/types';
import type { TaskSummary } from '@main/services/TaskService';
import { IPC_CHANNELS } from '@shared/constants';
import { PageShell } from '../../../shared/components/PageShell';
import { useIpc } from '../../../shared/hooks';
import {
  buildResultLibraryViewModel,
  type UnifiedResultItem,
} from '../task-toolbench/resultLibraryViewModel';
import { isJdSigninTask, normalizeIpcError } from '../task-toolbench/runtime';

export default function ResultLibrary() {
  const { invoke } = useIpc();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [items, setItems] = useState<UnifiedResultItem[]>([]);
  const [selected, setSelected] = useState<UnifiedResultItem | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<unknown>(null);
  const selectedTaskId = searchParams.get('taskId') ?? undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tasks = await invoke<TaskSummary[]>(IPC_CHANNELS.TASK_LIST);
      const [standardResults, signinRuns, hotSources, hotReports] = await Promise.all([
        invoke<ExtractionResult[]>(IPC_CHANNELS.RESULT_LIST, { taskId: selectedTaskId }).catch(() => []),
        loadSigninRuns(invoke, tasks.filter((task) => (!selectedTaskId || task.id === selectedTaskId) && isJdSigninTask(task))),
        invoke<HotSource[]>(IPC_CHANNELS.HOT_SOURCE_LIST).catch(() => []),
        invoke<HotReportSummary[]>(IPC_CHANNELS.HOT_REPORT_LIST, {}).catch(() => []),
      ]);
      const visibleHotSources = selectedTaskId
        ? hotSources.filter((source) => source.taskId === selectedTaskId)
        : hotSources;
      const visibleHotSourceIds = new Set(visibleHotSources.map((source) => source.id));
      const visibleHotReports = hotReports.filter((report) => visibleHotSourceIds.has(report.sourceId));
      const model = buildResultLibraryViewModel({
        standardResults,
        signinRuns,
        hotReports: visibleHotReports,
        hotSources: visibleHotSources,
      });
      setItems(model.items);
      setSelected(model.items[0] ?? null);
      setSelectedDetail(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [invoke, selectedTaskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportItem = async (item: UnifiedResultItem) => {
    try {
      if (item.sourceType === 'hot' && item.detailRef.sourceType === 'hot') {
        await invoke(IPC_CHANNELS.HOT_REPORT_REVEAL, { reportId: item.detailRef.reportId });
        message.success('已打开报告位置');
        return;
      }

      if (item.sourceType === 'standard') {
        const job = await invoke<DataExportJob>(IPC_CHANNELS.DATA_CENTER_EXPORTS_CREATE, {
          name: `任务结果-${item.id}`,
          query: {
            taskId: item.taskId,
            batchId: item.batchId ?? undefined,
            page: 1,
            pageSize: 500,
          },
          format: 'json',
          targetType: 'file',
          targetConfig: {},
        });
        if (job.status === 'failed') {
          message.error(`导出失败：${job.error ?? '未知错误'}`);
        } else {
          message.success(job.outputPath ? `导出任务完成：${job.outputPath}` : `导出任务已创建：${job.id}`);
        }
        return;
      }

      const blob = new Blob([JSON.stringify(item.raw, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${item.id.replace(/[:/]/g, '-')}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      message.success('已生成专项 JSON 导出');
    } catch (err) {
      message.error(`导出失败：${normalizeIpcError(err)}`);
    }
  };

  const selectItem = async (item: UnifiedResultItem) => {
    setSelected(item);
    setSelectedDetail(null);

    try {
      if (item.detailRef.sourceType === 'standard') {
        const detail = await invoke<DataCenterResultDetail>(IPC_CHANNELS.DATA_CENTER_RESULTS_DETAIL, {
          resultId: item.detailRef.resultId,
        });
        setSelectedDetail(detail);
        return;
      }
      if (item.detailRef.sourceType === 'hot') {
        const detail = await invoke<HotReportSummary>(IPC_CHANNELS.HOT_REPORT_DETAIL, {
          reportId: item.detailRef.reportId,
        });
        setSelectedDetail(detail);
      }
    } catch (err) {
      message.error(`加载详情失败：${normalizeIpcError(err)}`);
    }
  };

  return (
    <PageShell title="结果库" loading={loading} error={error} onRetry={() => void load()}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div className="taskbench-page-head">
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>
              结果库
            </Typography.Title>
            <Typography.Text type="secondary">
              标准采集结果、京东签到专项和热点报告统一展示，来源差异保持可见。
            </Typography.Text>
          </div>
          <Space wrap>
            <Button onClick={() => navigate('/')}>返回任务台</Button>
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              刷新
            </Button>
          </Space>
        </div>

        <Card title="结果列表">
          <List
            dataSource={items}
            locale={{ emptyText: '暂无结果' }}
            renderItem={(item) => (
              <List.Item
                onClick={() => void selectItem(item)}
                actions={[
                  <Button
                    key="export"
                    type="link"
                    icon={<DownloadOutlined />}
                    onClick={(event) => {
                      event.stopPropagation();
                      void exportItem(item);
                    }}
                  >
                    {item.sourceType === 'hot' ? '打开报告' : 'JSON'}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Typography.Text strong>{item.title}</Typography.Text>
                      <Tag color={getResultSourceColor(item.sourceType)}>{item.sourceType}</Tag>
                      <Tag color={item.status === 'failed' ? 'error' : 'success'}>{item.statusLabel}</Tag>
                    </Space>
                  }
                  description={`${item.createdAt} · ${item.batchId ?? '未绑定批次'} · ${item.summary}`}
                />
              </List.Item>
            )}
          />
        </Card>

        {selected ? (
          <Card title="结果详情">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="结果 ID">{selected.id}</Descriptions.Item>
              <Descriptions.Item label="来源">{selected.sourceType}</Descriptions.Item>
              <Descriptions.Item label="任务 ID">{selected.taskId}</Descriptions.Item>
              <Descriptions.Item label="批次">{selected.batchId ?? '未绑定批次'}</Descriptions.Item>
              <Descriptions.Item label="状态">{selected.statusLabel}</Descriptions.Item>
              <Descriptions.Item label="详情入口">
                {getDetailChannelLabel(selected)}
              </Descriptions.Item>
              {selectedDetail ? (
                <Descriptions.Item label="详情数据">
                  <pre className="taskbench-debug-block">{JSON.stringify(selectedDetail, null, 2)}</pre>
                </Descriptions.Item>
              ) : null}
              <Descriptions.Item label="原始数据">
                <pre className="taskbench-debug-block">{JSON.stringify(selected.raw, null, 2)}</pre>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        ) : null}
      </Space>
    </PageShell>
  );
}

function getResultSourceColor(sourceType: UnifiedResultItem['sourceType']): string {
  if (sourceType === 'signin') return 'purple';
  if (sourceType === 'hot') return 'orange';
  return 'blue';
}

function getDetailChannelLabel(item: UnifiedResultItem): string {
  if (item.detailRef.sourceType === 'standard') return 'DATA_CENTER_RESULTS_DETAIL';
  if (item.detailRef.sourceType === 'hot') return 'HOT_REPORT_DETAIL';
  return 'SIGNIN_TASK_HISTORY';
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
