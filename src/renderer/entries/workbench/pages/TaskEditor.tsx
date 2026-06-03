import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  List,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { HotSource, TaskFlow } from '@shared/types';
import { IPC_CHANNELS } from '@shared/constants';
import { PageShell } from '../../../shared/components/PageShell';
import { useIpc } from '../../../shared/hooks';
import { getTaskTemplateById, listTaskTemplates, type TaskTemplateDefinition } from '../task-toolbench/templates';
import { createDefaultJdSigninConfig, normalizeIpcError } from '../task-toolbench/runtime';
import {
  buildHotSourceDraft,
  type HotTemplateFormValues,
} from '../task-toolbench/hotTemplateAdapter';

interface JdSigninFormValues {
  name: string;
  entryUrl: string;
  sessionId?: string;
  mode: NonNullable<TaskFlow['signin']>['mode'];
  fallbackApiEnabled: boolean;
  maxRetryPerDay: number;
  enabled: boolean;
}

type TaskEditorFormValues = JdSigninFormValues & HotTemplateFormValues;

const DEFAULT_TEMPLATE_ID = 'jd-signin';

export default function TaskEditor() {
  const { invoke } = useIpc();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<TaskEditorFormValues>();
  const templates = useMemo(() => listTaskTemplates(), []);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    searchParams.get('templateId') ?? DEFAULT_TEMPLATE_ID,
  );
  const [editingTaskId, setEditingTaskId] = useState(searchParams.get('taskId'));
  const [editingSourceId, setEditingSourceId] = useState(searchParams.get('sourceId'));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const selectedTemplate = useMemo(
    () => getTaskTemplateById(selectedTemplateId) ?? getTaskTemplateById(DEFAULT_TEMPLATE_ID)!,
    [selectedTemplateId],
  );

  const hydrateForm = useCallback(
    (task: TaskFlow | null, template: TaskTemplateDefinition) => {
      if (template.adapter === 'hot') {
        form.setFieldsValue({
          name: task?.name ?? getTemplateFieldValue(template, 'name', '热点监控'),
          entryUrl:
            task?.entryUrl
            ?? template.defaultEntryUrl
            ?? getTemplateFieldValue(template, 'entryUrl', 'https://newsnow.busiyi.world/'),
          sessionId: task?.sessionId ?? '',
          sourceKind: getTemplateFieldValue(template, 'sourceKind', 'api'),
          siteKey: getTemplateFieldValue(template, 'siteKey', 'trendradar'),
          parserKey: getTemplateFieldValue(template, 'parserKey', 'newsnow.batch'),
          platformIds: '',
          enabled: task?.enabled ?? true,
        });
        return;
      }

      const signin = task?.signin ?? createDefaultJdSigninConfig();
      form.setFieldsValue({
        name: task?.name ?? '京东签到',
        entryUrl: task?.entryUrl ?? template.defaultEntryUrl ?? 'https://interact.jd.com/',
        sessionId: task?.sessionId ?? '',
        mode: signin.mode,
        fallbackApiEnabled: signin.fallbackApiEnabled,
        maxRetryPerDay: signin.maxRetryPerDay,
        enabled: task?.enabled ?? true,
      });
    },
    [form],
  );

  useEffect(() => {
    let cancelled = false;
    const taskId = searchParams.get('taskId');
    const sourceId = searchParams.get('sourceId');
    const templateId = searchParams.get('templateId') ?? DEFAULT_TEMPLATE_ID;
    setSelectedTemplateId(templateId);
    setEditingTaskId(taskId);
    setEditingSourceId(sourceId);

    if (!taskId) {
      hydrateForm(null, getTaskTemplateById(templateId) ?? selectedTemplate);
      return;
    }

    setLoading(true);
    setError(null);
    void invoke<TaskFlow | null>(IPC_CHANNELS.TASK_DETAIL, { taskId })
      .then((task) => {
        if (!cancelled) {
          if (task?.templateId || task?.kind === 'jd-signin') {
            setSelectedTemplateId(task.templateId ?? 'jd-signin');
          }
          hydrateForm(task, selectedTemplate);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrateForm, invoke, searchParams, selectedTemplate]);

  const saveHotTask = async (runAfterSave: boolean) => {
    const values = await form.validateFields();
    const draft = buildHotSourceDraft({
      name: values.name,
      sourceKind: values.sourceKind ?? 'api',
      siteKey: values.siteKey ?? 'trendradar',
      entryUrl: values.entryUrl,
      parserKey: values.parserKey ?? 'newsnow.batch',
      platformIds: values.platformIds,
      sessionId: values.sessionId,
      enabled: values.enabled,
    });

    setSaving(true);
    try {
      const source = editingSourceId
        ? await invoke<HotSource>(IPC_CHANNELS.HOT_SOURCE_UPDATE, {
            sourceId: editingSourceId,
            updates: draft,
          })
        : await invoke<HotSource>(IPC_CHANNELS.HOT_SOURCE_CREATE, draft);

      setEditingSourceId(source.id);
      setEditingTaskId(source.taskId);
      message.success(runAfterSave ? '热点任务已保存，开始运行' : '热点任务已保存');

      if (runAfterSave) {
        const started = await invoke<{ sourceId: string; taskId: string; started: boolean }>(
          IPC_CHANNELS.HOT_RUN_START,
          { sourceId: source.id },
        );
        if (!started.started) {
          message.warning('热点任务已保存，但运行启动器未就绪');
        }
        navigate(`/runs?taskId=${encodeURIComponent(source.taskId)}`);
      }

      return source;
    } catch (err) {
      message.error(`保存失败：${normalizeIpcError(err)}`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveSigninTask = async (runAfterSave: boolean) => {
    if (selectedTemplate.adapter !== 'signin') {
      message.warning(selectedTemplate.runDisabledReason ?? '该模板暂未接入运行');
      return null;
    }

    const values = await form.validateFields();
    if (runAfterSave && !values.sessionId?.trim()) {
      form.setFields([{ name: 'sessionId', errors: ['立即运行前需要填写会话 ID'] }]);
      return null;
    }

    setSaving(true);
    try {
      const saved = await invoke<TaskFlow>(IPC_CHANNELS.SIGNIN_TASK_SAVE, {
        taskId: editingTaskId || undefined,
        name: values.name,
        entryUrl: values.entryUrl,
        sessionId: values.sessionId?.trim() || null,
        enabled: values.enabled,
        signin: createDefaultJdSigninConfig({
          mode: values.mode,
          fallbackApiEnabled: values.fallbackApiEnabled,
          maxRetryPerDay: values.maxRetryPerDay,
        }),
      });
      setEditingTaskId(saved.id);
      message.success(runAfterSave ? '任务已保存，开始运行' : '任务已保存');

      if (runAfterSave) {
        await invoke(IPC_CHANNELS.SIGNIN_TASK_RUN_NOW, { taskId: saved.id });
        navigate(`/runs?taskId=${encodeURIComponent(saved.id)}`);
      }

      return saved;
    } catch (err) {
      message.error(`保存失败：${normalizeIpcError(err)}`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveTask = (runAfterSave: boolean) => {
    if (selectedTemplate.status !== 'ready') {
      message.warning(selectedTemplate.runDisabledReason ?? '该模板暂未接入运行');
      return Promise.resolve(null);
    }
    if (selectedTemplate.adapter === 'hot') {
      return saveHotTask(runAfterSave);
    }
    return saveSigninTask(runAfterSave);
  };

  return (
    <PageShell title="任务编辑器" loading={loading} error={error}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div className="taskbench-page-head">
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>
              任务编辑器
            </Typography.Title>
            <Typography.Text type="secondary">
              选择模板，配置参数，保存任务或立即运行京东签到闭环。
            </Typography.Text>
          </div>
          <Space wrap>
            <Button onClick={() => navigate('/')}>返回任务台</Button>
            <Button icon={<SaveOutlined />} loading={saving} onClick={() => void saveTask(false)}>
              保存草稿
            </Button>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={saving}
              disabled={selectedTemplate.status !== 'ready'}
              onClick={() => void saveTask(true)}
            >
              保存并立即运行
            </Button>
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={6}>
            <Card title="模板目录">
              <List
                dataSource={templates}
                renderItem={(template) => (
                  <List.Item
                    className={template.id === selectedTemplateId ? 'taskbench-template-active' : undefined}
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setEditingTaskId(null);
                      setEditingSourceId(null);
                      hydrateForm(null, template);
                    }}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Typography.Text strong>{template.name}</Typography.Text>
                          <Tag color={template.status === 'ready' ? 'green' : 'default'}>
                            {template.status === 'ready' ? '可运行' : '预览'}
                          </Tag>
                        </Space>
                      }
                      description={template.description}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          <Col xs={24} lg={11}>
            <Card title={selectedTemplate.name}>
              {selectedTemplate.status !== 'ready' ? (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={selectedTemplate.runDisabledReason ?? '该模板暂未接入运行'}
                />
              ) : null}
              <Form<TaskEditorFormValues>
                form={form}
                layout="vertical"
                initialValues={{
                  name: '京东签到',
                  entryUrl: 'https://interact.jd.com/',
                  mode: 'api-first-browser-fallback',
                  fallbackApiEnabled: true,
                  maxRetryPerDay: 1,
                  enabled: true,
                }}
              >
                <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
                  <Input placeholder={selectedTemplate.adapter === 'hot' ? '热点监控' : '京东签到'} />
                </Form.Item>
                <Form.Item
                  name="entryUrl"
                  label="入口 URL"
                  rules={[{ required: true, message: '请输入入口 URL' }, { type: 'url', message: '请输入合法 URL' }]}
                >
                  <Input placeholder={selectedTemplate.defaultEntryUrl ?? 'https://interact.jd.com/'} />
                </Form.Item>
                <Form.Item name="sessionId" label="会话 ID">
                  <Input placeholder="已登录浏览器会话 ID" />
                </Form.Item>
                {selectedTemplate.adapter === 'hot' ? (
                  <>
                    <Form.Item name="sourceKind" label="来源类型" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { label: 'API', value: 'api' },
                          { label: '浏览器', value: 'browser' },
                          { label: 'RSS', value: 'rss' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      name="siteKey"
                      label="站点标识"
                      rules={[{ required: true, message: '请输入站点标识' }]}
                    >
                      <Input placeholder="trendradar" />
                    </Form.Item>
                    <Form.Item
                      name="parserKey"
                      label="解析器"
                      rules={[{ required: true, message: '请输入解析器' }]}
                    >
                      <Input placeholder="newsnow.batch" />
                    </Form.Item>
                    <Form.Item name="platformIds" label="平台 ID">
                      <Input placeholder="多个平台用英文逗号分隔" />
                    </Form.Item>
                  </>
                ) : (
                  <>
                    <Form.Item name="mode" label="签到策略" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { label: 'API 优先，浏览器兜底', value: 'api-first-browser-fallback' },
                          { label: '浏览器优先，API 兜底', value: 'browser-first-api-fallback' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name="fallbackApiEnabled" label="启用兜底" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item name="maxRetryPerDay" label="每日最大重试">
                      <InputNumber min={0} max={10} style={{ width: '100%' }} />
                    </Form.Item>
                  </>
                )}
                <Form.Item name="enabled" label="启用任务" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Form>
            </Card>
          </Col>

          <Col xs={24} lg={7}>
            <Card title="运行预览">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Alert
                  type={selectedTemplate.status === 'ready' ? 'success' : 'warning'}
                  showIcon
                  message={
                    selectedTemplate.status === 'ready'
                      ? getReadyPreviewTitle(selectedTemplate)
                      : '预览模板不可运行'
                  }
                  description={
                    selectedTemplate.status === 'ready'
                      ? getReadyPreviewDescription(selectedTemplate)
                      : selectedTemplate.runDisabledReason
                  }
                />
                <div>
                  <Typography.Text strong>能力需求</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    {selectedTemplate.requiredCapabilities.map((capability) => (
                      <Tag key={capability}>{capability}</Tag>
                    ))}
                  </div>
                </div>
                <Typography.Paragraph type="secondary">
                  {selectedTemplate.adapter === 'hot'
                    ? '保存草稿会校验热点源最小参数；立即运行会启动关联热点源。'
                    : '保存草稿允许参数暂不完整；立即运行会校验入口 URL 和会话 ID。'}
                </Typography.Paragraph>
              </Space>
            </Card>
          </Col>
        </Row>
      </Space>
    </PageShell>
  );
}

function getTemplateFieldValue<T>(
  template: TaskTemplateDefinition,
  name: string,
  fallback: T,
): T {
  const value = template.parameterFields.find((field) => field.name === name)?.defaultValue;
  return (value ?? fallback) as T;
}

function getReadyPreviewTitle(template: TaskTemplateDefinition): string {
  if (template.adapter === 'hot') return '热点监控闭环可运行';
  return '京东签到闭环可运行';
}

function getReadyPreviewDescription(template: TaskTemplateDefinition): string {
  if (template.adapter === 'hot') {
    return '保存后调用 HOT_SOURCE_CREATE 或 HOT_SOURCE_UPDATE，立即运行调用 HOT_RUN_START。';
  }
  return '保存后调用 SIGNIN_TASK_SAVE，立即运行调用 SIGNIN_TASK_RUN_NOW。';
}
