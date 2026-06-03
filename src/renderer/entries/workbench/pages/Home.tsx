import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  List,
  Result,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { TaskSummary } from '@main/services/TaskService';
import type { ExtractionResult, SigninRunSummary } from '@shared/types';
import { IPC_CHANNELS } from '@shared/constants';
import { PageShell } from '../../../shared/components/PageShell';
import { useIpc } from '../../../shared/hooks';
import { listTaskTemplates } from '../task-toolbench/templates';
import {
  buildTaskWorkbenchViewModel,
  type TaskWorkbenchViewModel,
  type WorkbenchStatusItem,
} from '../task-toolbench/taskWorkbenchViewModel';
import { isJdSigninTask, normalizeIpcError } from '../task-toolbench/runtime';

export default function Home() {
  const navigate = useNavigate();
  const { invoke } = useIpc();
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState<TaskWorkbenchViewModel | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const templates = useMemo(() => listTaskTemplates(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const errors: string[] = [];

    try {
      const tasks = await invoke<TaskSummary[]>(IPC_CHANNELS.TASK_LIST);
      const signinTasks = tasks.filter(isJdSigninTask);
      const [standardResults, signinStatuses, signinHistories] = await Promise.all([
        invoke<ExtractionResult[]>(IPC_CHANNELS.RESULT_LIST, {}).catch((err: unknown) => {
          errors.push(`结果加载失败：${normalizeIpcError(err)}`);
          return [];
        }),
        loadSigninStatuses(invoke, signinTasks, errors),
        loadSigninHistories(invoke, signinTasks, errors),
      ]);

      setModel(
        buildTaskWorkbenchViewModel({
          tasks,
          signinStatuses,
          standardResults,
          signinHistories,
          templates,
          errors,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [invoke, templates]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell title="任务台" loading={loading} error={error} onRetry={() => void load()}>
      {model ? (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div className="taskbench-page-head">
            <div>
              <Typography.Title level={2} style={{ margin: 0 }}>
                任务台
              </Typography.Title>
              <Typography.Text type="secondary">
                查看真实任务状态、失败待处理项和最近结果。
              </Typography.Text>
            </div>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={() => void load()}>
                刷新
              </Button>
              <Button onClick={() => navigate('/tasks/editor')}>新建任务</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/tasks/editor?templateId=jd-signin')}
              >
                从模板创建
              </Button>
            </Space>
          </div>

          {model.errors.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              message="部分数据加载失败"
              description={model.errors.join('；')}
            />
          ) : null}

          {model.emptyState ? (
            <Card className="taskbench-empty-card">
              <Result
                title={model.emptyState.title}
                subTitle={model.emptyState.description}
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/tasks/editor?templateId=jd-signin')}
                  >
                    从模板创建
                  </Button>
                }
              />
            </Card>
          ) : null}

          <Row gutter={[16, 16]}>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="任务" value={model.totals.tasks} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="运行中" value={model.totals.running} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="待处理" value={model.totals.failed} />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="结果" value={model.totals.results} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <StatusListCard
                title="正在运行"
                items={model.runningItems}
                emptyText="暂无运行中任务"
                onOpen={(item) => navigate(item.navigateTo)}
              />
            </Col>
            <Col xs={24} lg={12}>
              <StatusListCard
                title="失败待处理"
                items={model.failedItems}
                emptyText="暂无失败或需介入项"
                danger
                onOpen={(item) => navigate(item.navigateTo)}
              />
            </Col>
            <Col xs={24} lg={12}>
              <StatusListCard
                title="最近完成"
                items={model.recentCompletedItems}
                emptyText="暂无完成记录"
                onOpen={(item) => navigate(item.navigateTo)}
              />
            </Col>
            <Col xs={24} lg={12}>
              <Card title="最近结果">
                <List
                  locale={{ emptyText: '暂无结果' }}
                  dataSource={model.recentResults}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          key="open"
                          type="link"
                          onClick={() => navigate(`/results?taskId=${encodeURIComponent(item.taskId)}`)}
                        >
                          查看
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Typography.Text strong>{item.title}</Typography.Text>
                            <Tag color={item.sourceType === 'signin' ? 'purple' : 'blue'}>
                              {item.sourceType === 'signin' ? 'signin' : 'standard'}
                            </Tag>
                          </Space>
                        }
                        description={`${item.statusLabel} · ${item.batchId ?? '未绑定批次'} · ${item.summary}`}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>

          <Card title="推荐模板">
            <Row gutter={[16, 16]}>
              {model.recommendedTemplates.map((template) => (
                <Col xs={24} md={8} key={template.id}>
                  <Card
                    size="small"
                    hoverable={template.status === 'ready'}
                    onClick={() => {
                      if (template.status === 'ready') {
                        navigate(`/tasks/editor?templateId=${template.id}`);
                      }
                    }}
                  >
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <div className="taskbench-template-title">
                        <Typography.Text strong>{template.name}</Typography.Text>
                        <Tag color={template.status === 'ready' ? 'green' : 'default'}>
                          {template.status === 'ready' ? '可运行' : '预览'}
                        </Tag>
                      </div>
                      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                        {template.description}
                      </Typography.Paragraph>
                      <Button
                        block
                        type={template.status === 'ready' ? 'primary' : 'default'}
                        disabled={template.status !== 'ready'}
                        icon={template.status === 'ready' ? <PlayCircleOutlined /> : undefined}
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/tasks/editor?templateId=${template.id}`);
                        }}
                      >
                        {template.status === 'ready' ? '进入配置' : template.runDisabledReason}
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Space>
      ) : null}
    </PageShell>
  );
}

function StatusListCard({
  title,
  items,
  emptyText,
  danger,
  onOpen,
}: {
  title: string;
  items: WorkbenchStatusItem[];
  emptyText: string;
  danger?: boolean;
  onOpen: (item: WorkbenchStatusItem) => void;
}) {
  return (
    <Card title={title}>
      <List
        locale={{ emptyText }}
        dataSource={items}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Button key="open" type="link" icon={<RightOutlined />} onClick={() => onOpen(item)}>
                打开
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <Typography.Text strong>{item.taskName}</Typography.Text>
                  <Tag color={danger ? 'error' : item.rawStatus === 'success' ? 'success' : 'processing'}>
                    {item.statusLabel}
                  </Tag>
                </Space>
              }
              description={`${item.summary} · ${formatDateTime(item.occurredAt)}`}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}

async function loadSigninStatuses(
  invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>,
  tasks: TaskSummary[],
  errors: string[],
): Promise<Record<string, SigninRunSummary | null>> {
  const entries = await Promise.all(
    tasks.map(async (task) => {
      try {
        return [
          task.id,
          await invoke<SigninRunSummary | null>(IPC_CHANNELS.SIGNIN_TASK_STATUS, {
            taskId: task.id,
          }),
        ] as const;
      } catch (err) {
        errors.push(`${task.name} 签到状态加载失败：${normalizeIpcError(err)}`);
        return [task.id, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

async function loadSigninHistories(
  invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>,
  tasks: TaskSummary[],
  errors: string[],
): Promise<Record<string, SigninRunSummary[]>> {
  const entries = await Promise.all(
    tasks.map(async (task) => {
      try {
        return [
          task.id,
          await invoke<SigninRunSummary[]>(IPC_CHANNELS.SIGNIN_TASK_HISTORY, {
            taskId: task.id,
          }),
        ] as const;
      } catch (err) {
        errors.push(`${task.name} 签到历史加载失败：${normalizeIpcError(err)}`);
        return [task.id, []] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}
