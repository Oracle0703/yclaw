import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Checkbox, Drawer, Input, Modal, Select, Space, Tag, message } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import { IPC_CHANNELS } from '@shared/constants';
import type {
  CommentAiReplyDraft,
  CommentCrawlLimits,
  CommentEntryKind,
  CommentFilterConfig,
  CommentItem,
  CommentPlatform,
  CommentReplyTone,
  CommentReportSummary,
  CommentRunSummary,
  CommentSource,
  CommentSourceDraft,
  MediaCrawlerConfig,
  MediaCrawlerLoginType,
  MediaCrawlerPlatform,
  MediaCrawlerRunResult,
} from '@shared/types';
import { PageShell } from '../../shared/components/PageShell';
import { useIpc } from '../../shared/hooks';
import './styles.css';

const DEFAULT_LIMITS: CommentCrawlLimits = {
  maxContents: 5,
  maxCommentsPerContent: 20,
  includeSubComments: false,
  crawlIntervalSeconds: 2,
};

const DEFAULT_DRAFT: CommentSourceDraft = {
  name: '小红书评论监控',
  platform: 'xhs',
  entryKind: 'keyword',
  entryValue: 'AI',
  parserKey: 'xhs.comment',
  limits: DEFAULT_LIMITS,
  tags: ['评论监控', '小红书'],
};

const DEFAULT_MEDIACRAWLER_CONFIG: MediaCrawlerConfig = {
  enabled: true,
  repoPath: '',
  pythonPath: 'python',
  outputDir: '',
  loginType: 'qrcode',
};

type OverflowDrawer = 'sources' | 'reports' | 'comments' | null;

export default function CommentMonitorApp() {
  const { invoke } = useIpc();
  const [sources, setSources] = useState<CommentSource[]>([]);
  const [runs, setRuns] = useState<CommentRunSummary[]>([]);
  const [reports, setReports] = useState<CommentReportSummary[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [draft, setDraft] = useState<CommentSourceDraft>(DEFAULT_DRAFT);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, CommentAiReplyDraft>>({});
  const [loading, setLoading] = useState(false);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [overflowDrawer, setOverflowDrawer] = useState<OverflowDrawer>(null);
  const [mediaCrawlerOpen, setMediaCrawlerOpen] = useState(false);
  const [mediaCrawlerConfig, setMediaCrawlerConfig] = useState<MediaCrawlerConfig>(
    DEFAULT_MEDIACRAWLER_CONFIG,
  );

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? sources[0] ?? null,
    [selectedSourceId, sources],
  );

  const sortedSources = useMemo(
    () => [...sources].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    [sources],
  );
  const sortedRuns = useMemo(
    () =>
      [...runs].sort(
        (left, right) =>
          Date.parse(right.startedAt ?? right.finishedAt ?? '') -
          Date.parse(left.startedAt ?? left.finishedAt ?? ''),
      ),
    [runs],
  );
  const sortedReports = useMemo(
    () => [...reports].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [reports],
  );
  const latestSource = sortedSources[0] ?? null;
  const recentReports = sortedReports.slice(0, 3);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const sourceQuery = selectedSourceId ? { sourceId: selectedSourceId } : {};
      const [sourceData, runData, reportData] = await Promise.all([
        invoke<CommentSource[]>(IPC_CHANNELS.COMMENT_SOURCE_LIST),
        invoke<CommentRunSummary[]>(IPC_CHANNELS.COMMENT_RUN_LIST, sourceQuery),
        invoke<CommentReportSummary[]>(IPC_CHANNELS.COMMENT_REPORT_LIST, sourceQuery),
      ]);
      const nextSources = Array.isArray(sourceData) ? sourceData : [];
      const nextRuns = Array.isArray(runData) ? runData : [];
      setSources(nextSources);
      setRuns(nextRuns);
      setReports(Array.isArray(reportData) ? reportData : []);
      const firstBatchId = nextRuns[0]?.batchId;
      setComments(firstBatchId
        ? await invoke<CommentItem[]>(IPC_CHANNELS.COMMENT_RESULT_LIST, { batchId: firstBatchId })
        : []);
      setSelectedSourceId((current) => current || nextSources[0]?.id || '');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载评论监控失败');
    } finally {
      setLoading(false);
    }
  }, [invoke, selectedSourceId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const updateDraft = <Field extends keyof CommentSourceDraft>(
    field: Field,
    value: CommentSourceDraft[Field],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateLimit = <Field extends keyof CommentCrawlLimits>(
    field: Field,
    value: CommentCrawlLimits[Field],
  ) => {
    setDraft((current) => ({
      ...current,
      limits: {
        ...DEFAULT_LIMITS,
        ...(current.limits ?? {}),
        [field]: value,
      },
    }));
  };

  const updateFilter = <Field extends keyof CommentFilterConfig>(
    field: Field,
    value: CommentFilterConfig[Field],
  ) => {
    setDraft((current) => ({
      ...current,
      filter: compactFilter({
        ...(current.filter ?? {}),
        [field]: value,
      }),
    }));
  };

  const openCreateModal = () => {
    setDraft(DEFAULT_DRAFT);
    setSourceModalOpen(true);
  };

  const handleCreateSource = async () => {
    try {
      const created = await invoke<CommentSource>(IPC_CHANNELS.COMMENT_SOURCE_CREATE, {
        ...draft,
        parserKey: draft.parserKey ?? `${draft.platform}.comment`,
        limits,
      });
      message.success('评论源已创建');
      setSelectedSourceId(created.id);
      setSourceModalOpen(false);
      await loadAll();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建评论源失败');
    }
  };

  const handleStartRun = async (sourceId: string) => {
    await invoke(IPC_CHANNELS.COMMENT_RUN_START, { sourceId });
    message.success('评论采集已启动，运行完成后可在列表中生成报告');
    await loadAll();
  };

  const handleGenerateReport = async (run: CommentRunSummary) => {
    await invoke(IPC_CHANNELS.COMMENT_REPORT_GENERATE, {
      sourceId: run.sourceId,
      batchId: run.batchId,
      format: 'html',
    });
    message.success('评论报告已生成');
    await loadAll();
  };

  const handleGenerateAiReply = async (comment: CommentItem, tone: CommentReplyTone = 'friendly') => {
    try {
      const reply = await invoke<CommentAiReplyDraft>(IPC_CHANNELS.COMMENT_AI_REPLY_GENERATE, {
        comment,
        tone,
      });
      setReplyDrafts((current) => ({
        ...current,
        [comment.commentId]: reply,
      }));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '生成 AI 回复草稿失败');
    }
  };

  const openMediaCrawlerDrawer = async () => {
    setMediaCrawlerOpen(true);
    try {
      const config = await invoke<MediaCrawlerConfig>(IPC_CHANNELS.COMMENT_MEDIACRAWLER_CONFIG_GET);
      setMediaCrawlerConfig({ ...DEFAULT_MEDIACRAWLER_CONFIG, ...(config ?? {}) });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载 MediaCrawler 配置失败');
    }
  };

  const updateMediaCrawlerConfig = <Field extends keyof MediaCrawlerConfig>(
    field: Field,
    value: MediaCrawlerConfig[Field],
  ) => {
    setMediaCrawlerConfig((current) => ({ ...current, [field]: value }));
  };

  const saveMediaCrawlerConfig = async () => {
    try {
      const saved = await invoke<MediaCrawlerConfig>(
        IPC_CHANNELS.COMMENT_MEDIACRAWLER_CONFIG_SAVE,
        mediaCrawlerConfig,
      );
      setMediaCrawlerConfig({ ...DEFAULT_MEDIACRAWLER_CONFIG, ...(saved ?? mediaCrawlerConfig) });
      message.success('MediaCrawler 配置已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存 MediaCrawler 配置失败');
    }
  };

  const testMediaCrawlerConfig = async () => {
    try {
      await invoke(IPC_CHANNELS.COMMENT_MEDIACRAWLER_TEST, mediaCrawlerConfig);
      message.success('MediaCrawler 连接正常');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'MediaCrawler 连接测试失败');
    }
  };

  const runMediaCrawler = async () => {
    if (!selectedSource) {
      message.error('请先选择评论源');
      return;
    }
    const run = sortedRuns.find((item) => item.sourceId === selectedSource.id) ?? sortedRuns[0];
    if (!run?.batchId) {
      message.error('请先启动一次评论采集以创建批次');
      return;
    }
    try {
      const result = await invoke<MediaCrawlerRunResult>(IPC_CHANNELS.COMMENT_MEDIACRAWLER_RUN, {
        sourceId: selectedSource.id,
        taskId: selectedSource.taskId,
        batchId: run.batchId,
        platform: toMediaCrawlerPlatform(selectedSource.platform),
        entryKind: selectedSource.entryKind,
        entryValue: selectedSource.entryValue,
        limits: selectedSource.limits,
      });
      message.success(`MediaCrawler 已导入 ${result.importedCount} 条评论`);
      await loadAll();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'MediaCrawler 外部采集失败');
    }
  };

  const loadSourceDetail = async (sourceId: string) => {
    try {
      const source = await invoke<CommentSource>(IPC_CHANNELS.COMMENT_SOURCE_DETAIL, { sourceId });
      setDraft({
        name: source.name,
        platform: source.platform,
        entryKind: source.entryKind,
        entryValue: source.entryValue,
        parserKey: source.parserKey,
        sessionId: source.sessionId,
        schedule: source.schedule,
        limits: source.limits,
        filter: source.filter,
        enabled: source.enabled,
        tags: source.tags,
      });
      setSelectedSourceId(source.id);
      setSourceModalOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载评论源详情失败');
    }
  };

  const limits = normalizeLimits(draft.limits);
  const includeKeywordsText = (draft.filter?.includeKeywords ?? []).join(', ');
  const excludeKeywordsText = (draft.filter?.excludeKeywords ?? []).join(', ');
  const minLikeCountText = draft.filter?.minLikeCount ?? '';

  return (
    <PageShell
      title="评论监控"
      subTitle="小红书评论源、采集运行和洞察报告"
      content="当前页面使用评论采集 IPC 生成本地 HTML 报告。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="processing">
            <MessageOutlined /> Comment Monitor
          </Tag>
        </Space>
      }
      loading={loading && sources.length === 0 && runs.length === 0}
    >
      <div className="comment-monitor-app hot-monitor-app">
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Card className="yclaw-panel-card">
            <div className="hot-monitor-toolbar-title">任务列表</div>
            <div className="hot-monitor-overview">
              <section className="hot-monitor-latest-source" aria-label="最近评论源">
                <div className="browser-workspace-section-title">最近评论源</div>
                {latestSource ? (
                  <div className="hot-monitor-source-summary">
                    <div>
                      <div className="browser-workspace-action-title">{latestSource.name}</div>
                      <div className="browser-workspace-action-meta">
                        {latestSource.platform} · {latestSource.entryKind} · {formatBeijingTime(latestSource.updatedAt)}
                      </div>
                      <div className="browser-workspace-action-meta">
                        {formatCommentSourceConfigSummary(latestSource)}
                      </div>
                    </div>
                    <Space wrap>
                      <Button onClick={() => void loadSourceDetail(latestSource.id)}>
                        加载详情
                      </Button>
                      <Button onClick={() => setSelectedSourceId(latestSource.id)}>
                        查看运行
                      </Button>
                      <Button type="primary" onClick={() => void handleStartRun(latestSource.id)}>
                        启动采集
                      </Button>
                    </Space>
                  </div>
                ) : (
                  <div className="browser-workspace-empty">暂无评论源</div>
                )}
              </section>

              <section aria-label="评论任务列表">
                <ProTable<CommentRunSummary>
                  rowKey="batchId"
                  search={false}
                  options={{ reload: () => void loadAll() }}
                  pagination={{ pageSize: 5, showSizeChanger: false }}
                  dataSource={sortedRuns}
                  locale={{
                    emptyText: <div className="browser-workspace-empty">暂无运行记录</div>,
                  }}
                  className="hot-monitor-task-table-wrap"
                  tableClassName="hot-monitor-task-table"
                  toolBarRender={() => [
                    <Button key="new-source" onClick={openCreateModal}>
                      新增评论源
                    </Button>,
                    <Button key="sources" onClick={() => setOverflowDrawer('sources')}>
                      全部评论源
                    </Button>,
                    <Button key="reports" onClick={() => setOverflowDrawer('reports')}>
                      历史报告
                    </Button>,
                    <Button key="comments" onClick={() => setOverflowDrawer('comments')}>
                      评论结果
                    </Button>,
                    <Button key="media-crawler" onClick={() => void openMediaCrawlerDrawer()}>
                      外部执行器
                    </Button>,
                    selectedSource ? (
                      <Button
                        key="start"
                        type="primary"
                        onClick={() => void handleStartRun(selectedSource.id)}
                      >
                        启动采集
                      </Button>
                    ) : null,
                  ].filter(Boolean)}
                  columns={[
                    {
                      title: '任务',
                      dataIndex: 'sourceName',
                      render: (_, run) => (
                        <div className="browser-workspace-action-title">{run.sourceName}</div>
                      ),
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                    },
                    {
                      title: '结果',
                      dataIndex: 'resultCount',
                      render: (_, run) => `${run.resultCount} 条评论`,
                    },
                    {
                      title: '结束时间',
                      dataIndex: 'finishedAt',
                      render: (_, run) => formatBeijingTime(run.finishedAt),
                    },
                    {
                      title: '报告',
                      dataIndex: 'reportStatus',
                      render: (_, run) => (run.reportStatus === 'generated' ? '已生成' : '未生成'),
                    },
                    {
                      title: '操作',
                      key: 'actions',
                      render: (_, run) => (
                        <Space wrap className="hot-monitor-table-actions">
                          <Button onClick={() => void loadSourceDetail(run.sourceId)}>
                            加载详情
                          </Button>
                          <Button onClick={() => void handleStartRun(run.sourceId)}>
                            重新运行
                          </Button>
                          {run.status === 'success' && run.resultCount > 0 ? (
                            <Button onClick={() => void handleGenerateReport(run)}>
                              生成报告
                            </Button>
                          ) : null}
                        </Space>
                      ),
                    },
                  ]}
                />
              </section>

              <section className="browser-workspace-section hot-monitor-recent-reports">
                <div className="hot-monitor-section-head">
                  <div className="browser-workspace-section-title">最近报告</div>
                  {sortedReports.length > 3 ? (
                    <Button onClick={() => setOverflowDrawer('reports')}>
                      查看更多
                    </Button>
                  ) : null}
                </div>
                <CommentReportList reports={recentReports} />
              </section>

              <section className="browser-workspace-section hot-monitor-recent-reports">
                <div className="hot-monitor-section-head">
                  <div className="browser-workspace-section-title">评论结果</div>
                  {comments.length > 5 ? (
                    <Button onClick={() => setOverflowDrawer('comments')}>
                      查看更多
                    </Button>
                  ) : null}
                </div>
                <CommentResultList
                  comments={comments.slice(0, 5)}
                  replyDrafts={replyDrafts}
                  onGenerateAiReply={handleGenerateAiReply}
                />
              </section>
            </div>
          </Card>
        </Space>
      </div>

      <Modal
        title="新增评论源"
        open={sourceModalOpen}
        onCancel={() => setSourceModalOpen(false)}
        footer={null}
        width={720}
      >
        <div className="comment-monitor-app hot-monitor-task-modal-content">
          <CommentSourceForm
            draft={draft}
            limits={limits}
            includeKeywordsText={includeKeywordsText}
            excludeKeywordsText={excludeKeywordsText}
            minLikeCountText={minLikeCountText}
            onDraftChange={updateDraft}
            onLimitChange={updateLimit}
            onFilterChange={updateFilter}
            onCreate={handleCreateSource}
          />
        </div>
      </Modal>

      <Drawer
        title="MediaCrawler外部执行器"
        open={mediaCrawlerOpen}
        onClose={() => setMediaCrawlerOpen(false)}
        width={520}
      >
        <div className="comment-monitor-app hot-monitor-drawer-content">
          <MediaCrawlerConfigForm
            config={mediaCrawlerConfig}
            onChange={updateMediaCrawlerConfig}
            onSave={saveMediaCrawlerConfig}
            onTest={testMediaCrawlerConfig}
            onRun={runMediaCrawler}
          />
        </div>
      </Drawer>

      <Drawer
        title={
          overflowDrawer === 'sources'
            ? '全部评论源'
            : overflowDrawer === 'reports'
              ? '全部报告'
              : '评论结果'
        }
        open={overflowDrawer !== null}
        onClose={() => setOverflowDrawer(null)}
        width={760}
      >
        <div className="comment-monitor-app hot-monitor-drawer-content">
          {overflowDrawer === 'sources' ? (
            <CommentSourceList
              sources={sortedSources}
              selectedSourceId={selectedSource?.id}
              onSelect={setSelectedSourceId}
              onLoadDetail={(sourceId) => void loadSourceDetail(sourceId)}
              onStartRun={(sourceId) => void handleStartRun(sourceId)}
            />
          ) : null}
          {overflowDrawer === 'reports' ? <CommentReportList reports={sortedReports} /> : null}
          {overflowDrawer === 'comments' ? (
            <CommentResultList
              comments={comments}
              replyDrafts={replyDrafts}
              onGenerateAiReply={handleGenerateAiReply}
            />
          ) : null}
        </div>
      </Drawer>
    </PageShell>
  );
}

function MediaCrawlerConfigForm({
  config,
  onChange,
  onSave,
  onTest,
  onRun,
}: {
  config: MediaCrawlerConfig;
  onChange: <Field extends keyof MediaCrawlerConfig>(
    field: Field,
    value: MediaCrawlerConfig[Field],
  ) => void;
  onSave: () => Promise<void>;
  onTest: () => Promise<void>;
  onRun: () => Promise<void>;
}) {
  return (
    <Space direction="vertical" className="comment-monitor-form">
      <Checkbox
        aria-label="启用MediaCrawler"
        checked={config.enabled}
        onChange={(event) => onChange('enabled', event.target.checked)}
      >
        启用MediaCrawler
      </Checkbox>
      <Input
        aria-label="MediaCrawler仓库路径"
        value={config.repoPath}
        onChange={(event) => onChange('repoPath', event.target.value)}
      />
      <Input
        aria-label="Python路径"
        value={config.pythonPath}
        onChange={(event) => onChange('pythonPath', event.target.value)}
      />
      <Input
        aria-label="输出目录"
        value={config.outputDir ?? ''}
        onChange={(event) => onChange('outputDir', event.target.value)}
      />
      <Select
        aria-label="登录方式"
        value={config.loginType}
        onChange={(value) => onChange('loginType', value as MediaCrawlerLoginType)}
        options={[
          { label: '扫码登录', value: 'qrcode' },
          { label: '手机号登录', value: 'phone' },
          { label: 'Cookie登录', value: 'cookie' },
          { label: '浏览器登录', value: 'browser' },
        ]}
      />
      <Space wrap>
        <Button onClick={() => void onSave()}>
          保存配置
        </Button>
        <Button onClick={() => void onTest()}>
          测试连接
        </Button>
        <Button type="primary" onClick={() => void onRun()}>
          外部采集
        </Button>
      </Space>
    </Space>
  );
}

function CommentSourceForm({
  draft,
  limits,
  includeKeywordsText,
  excludeKeywordsText,
  minLikeCountText,
  onDraftChange,
  onLimitChange,
  onFilterChange,
  onCreate,
}: {
  draft: CommentSourceDraft;
  limits: CommentCrawlLimits;
  includeKeywordsText: string;
  excludeKeywordsText: string;
  minLikeCountText: string | number;
  onDraftChange: <Field extends keyof CommentSourceDraft>(
    field: Field,
    value: CommentSourceDraft[Field],
  ) => void;
  onLimitChange: <Field extends keyof CommentCrawlLimits>(
    field: Field,
    value: CommentCrawlLimits[Field],
  ) => void;
  onFilterChange: <Field extends keyof CommentFilterConfig>(
    field: Field,
    value: CommentFilterConfig[Field],
  ) => void;
  onCreate: () => Promise<void>;
}) {
  return (
    <Space direction="vertical" className="comment-monitor-form">
      <Input
        aria-label="评论源名称"
        value={draft.name}
        onChange={(event) => onDraftChange('name', event.target.value)}
      />
      <Select
        aria-label="平台"
        value={draft.platform}
        onChange={(value) => {
          const platform = value as CommentPlatform;
          onDraftChange('platform', platform);
          onDraftChange('parserKey', `${platform}.comment`);
          onDraftChange('tags', platform === 'douyin' ? ['评论监控', '抖音'] : ['评论监控', '小红书']);
        }}
        options={[
          { label: '小红书', value: 'xhs' },
          { label: '抖音', value: 'douyin' },
        ]}
      />
      <Select
        aria-label="入口类型"
        value={draft.entryKind}
        onChange={(value) => onDraftChange('entryKind', value as CommentEntryKind)}
        options={[
          { label: '关键词', value: 'keyword' },
          { label: '笔记链接', value: 'note' },
          { label: '创作者主页', value: 'creator' },
        ]}
      />
      <Input
        aria-label="入口内容"
        value={draft.entryValue}
        onChange={(event) => onDraftChange('entryValue', event.target.value)}
      />
      <div className="comment-monitor-config-grid">
        <label>
          <span>最大内容数</span>
          <Input
            aria-label="最大内容数"
            type="number"
            min={1}
            value={limits.maxContents}
            onChange={(event) => onLimitChange('maxContents', parsePositiveInteger(event.target.value, 1))}
          />
        </label>
        <label>
          <span>单内容最大评论数</span>
          <Input
            aria-label="单内容最大评论数"
            type="number"
            min={1}
            value={limits.maxCommentsPerContent}
            onChange={(event) =>
              onLimitChange('maxCommentsPerContent', parsePositiveInteger(event.target.value, 1))}
          />
        </label>
        <label>
          <span>采集间隔秒数</span>
          <Input
            aria-label="采集间隔秒数"
            type="number"
            min={0}
            value={limits.crawlIntervalSeconds}
            onChange={(event) =>
              onLimitChange('crawlIntervalSeconds', parseNonNegativeInteger(event.target.value))}
          />
        </label>
        <label>
          <span>最低点赞数</span>
          <Input
            aria-label="最低点赞数"
            type="number"
            min={0}
            value={minLikeCountText}
            onChange={(event) => onFilterChange('minLikeCount', parseOptionalNonNegativeInteger(event.target.value))}
          />
        </label>
      </div>
      <Checkbox
        aria-label="采集二级评论"
        checked={limits.includeSubComments}
        onChange={(event) => onLimitChange('includeSubComments', event.target.checked)}
      >
        采集二级评论
      </Checkbox>
      <Input
        aria-label="包含关键词"
        placeholder="包含关键词，用逗号分隔"
        value={includeKeywordsText}
        onChange={(event) => onFilterChange('includeKeywords', parseKeywordList(event.target.value))}
      />
      <Input
        aria-label="排除关键词"
        placeholder="排除关键词，用逗号分隔"
        value={excludeKeywordsText}
        onChange={(event) => onFilterChange('excludeKeywords', parseKeywordList(event.target.value))}
      />
      <Input
        aria-label="会话ID"
        placeholder="会话ID（可选）"
        value={draft.sessionId ?? ''}
        onChange={(event) => onDraftChange('sessionId', event.target.value.trim() || null)}
      />
      <Space wrap>
        <Button type="primary" onClick={() => void onCreate()}>
          创建评论源
        </Button>
      </Space>
    </Space>
  );
}

function CommentSourceList({
  sources,
  selectedSourceId,
  onSelect,
  onLoadDetail,
  onStartRun,
}: {
  sources: CommentSource[];
  selectedSourceId?: string;
  onSelect: (sourceId: string) => void;
  onLoadDetail: (sourceId: string) => void;
  onStartRun: (sourceId: string) => void;
}) {
  if (sources.length === 0) return <div className="browser-workspace-empty">暂无评论源</div>;
  return (
    <div className="browser-workspace-list">
      {sources.map((source) => (
        <div
          key={source.id}
          className="browser-workspace-list-item"
          data-selected={source.id === selectedSourceId}
        >
          <div className="browser-workspace-action-title">{source.name}</div>
          <div className="browser-workspace-action-meta">
            {source.entryKind} · {source.entryValue}
          </div>
          <div className="browser-workspace-action-description">{formatCommentSourceConfigSummary(source)}</div>
          <Space wrap>
            <Button onClick={() => onSelect(source.id)}>
              选择
            </Button>
            <Button onClick={() => onLoadDetail(source.id)}>
              加载详情
            </Button>
            <Button onClick={() => onStartRun(source.id)}>
              启动采集
            </Button>
          </Space>
        </div>
      ))}
    </div>
  );
}

function CommentReportList({ reports }: { reports: CommentReportSummary[] }) {
  if (reports.length === 0) return <div className="browser-workspace-empty">暂无评论报告</div>;
  return (
    <div className="browser-workspace-list">
      {reports.map((report) => (
        <div key={report.id} className="browser-workspace-list-item">
          <div className="browser-workspace-action-title">{report.title}</div>
          <div className="browser-workspace-action-meta">
            {report.format} · {formatBeijingTime(report.createdAt)}
          </div>
          <div className="browser-workspace-action-description">{report.batchId}</div>
        </div>
      ))}
    </div>
  );
}

function CommentResultList({
  comments,
  replyDrafts = {},
  onGenerateAiReply,
}: {
  comments: CommentItem[];
  replyDrafts?: Record<string, CommentAiReplyDraft>;
  onGenerateAiReply?: (comment: CommentItem) => void;
}) {
  if (comments.length === 0) return <div className="browser-workspace-empty">暂无评论结果</div>;
  return (
    <div className="browser-workspace-list">
      {comments.map((comment) => {
        const reply = replyDrafts[comment.commentId];
        return (
          <div key={comment.commentId} className="browser-workspace-list-item">
            <div className="browser-workspace-action-title">{comment.authorName ?? '匿名用户'}</div>
            <div className="browser-workspace-action-description">{comment.content}</div>
            <div className="browser-workspace-action-meta">
              {comment.platform} · {comment.likeCount ?? 0} 赞
            </div>
            <Space wrap>
              <Button onClick={() => onGenerateAiReply?.(comment)}>
                AI回复
              </Button>
            </Space>
            {reply ? (
              <div className="browser-workspace-list">
                <div className="browser-workspace-action-meta">人工确认后发布</div>
                {reply.drafts.map((item) => (
                  <div key={item} className="browser-workspace-action-description">
                    {item}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function formatCommentSourceConfigSummary(source: Pick<CommentSource, 'limits' | 'filter' | 'sessionId'>): string {
  const includeKeywords = source.filter?.includeKeywords?.join('、') || '不限关键词';
  const excludeKeywords = source.filter?.excludeKeywords?.join('、') || '无排除词';
  return [
    `内容 ${source.limits.maxContents}`,
    `评论 ${source.limits.maxCommentsPerContent}`,
    source.limits.includeSubComments ? '含二级评论' : '仅一级评论',
    `间隔 ${source.limits.crawlIntervalSeconds}s`,
    `包含 ${includeKeywords}`,
    `排除 ${excludeKeywords}`,
    source.sessionId ? `会话 ${source.sessionId}` : '默认会话',
  ].join(' · ');
}

function toMediaCrawlerPlatform(platform: CommentPlatform): MediaCrawlerPlatform {
  return platform === 'douyin' ? 'dy' : 'xhs';
}

function formatBeijingTime(value?: string | null): string {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function parseKeywordList(value: string): string[] {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLimits(limits?: Partial<CommentCrawlLimits> | null): CommentCrawlLimits {
  return {
    maxContents: limits?.maxContents ?? DEFAULT_LIMITS.maxContents,
    maxCommentsPerContent: limits?.maxCommentsPerContent ?? DEFAULT_LIMITS.maxCommentsPerContent,
    includeSubComments: limits?.includeSubComments ?? DEFAULT_LIMITS.includeSubComments,
    crawlIntervalSeconds: limits?.crawlIntervalSeconds ?? DEFAULT_LIMITS.crawlIntervalSeconds,
  };
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseNonNegativeInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function parseOptionalNonNegativeInteger(value: string): number | undefined {
  if (!value.trim()) return undefined;
  return parseNonNegativeInteger(value);
}

function compactFilter(filter: CommentFilterConfig): CommentFilterConfig | null {
  const next: CommentFilterConfig = {};
  if (filter.includeKeywords && filter.includeKeywords.length > 0) {
    next.includeKeywords = filter.includeKeywords;
  }
  if (filter.excludeKeywords && filter.excludeKeywords.length > 0) {
    next.excludeKeywords = filter.excludeKeywords;
  }
  if (typeof filter.minLikeCount === 'number') {
    next.minLikeCount = filter.minLikeCount;
  }
  return Object.keys(next).length > 0 ? next : null;
}
