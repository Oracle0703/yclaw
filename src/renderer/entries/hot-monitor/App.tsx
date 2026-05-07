import { useCallback, useEffect, useState } from 'react';
import { Card, Space, Tag, Typography, message } from 'antd';
import { FireOutlined, SyncOutlined } from '@ant-design/icons';
import { IPC_CHANNELS } from '@shared/constants/channels';
import type {
  HotReportSummary,
  HotRunDetail,
  HotRunSummary,
  HotSource,
  HotSourceDraft,
  HotTimelinePresetOption,
} from '@shared/types';
import { PageShell } from '../../shared/components/PageShell';
import { useIpc } from '../../shared/hooks';
import { HotReportPanel } from '../browser/components/HotReportPanel';
import { HotRunPanel } from '../browser/components/HotRunPanel';
import { HotSourcePanel } from '../browser/components/HotSourcePanel';
import { NEWSNOW_PRESETS, createNewsNowDraft, createTrendRadarBatchDraft } from './newsnowPresets';

const DEFAULT_DRAFT: HotSourceDraft = {
  name: '',
  sourceKind: 'api',
  siteKey: 'newsnow',
  entryUrl: '',
  parserKey: 'newsnow.hot',
  platformIds: [],
  enabled: true,
  tags: [],
};

const RSS_DRAFT: HotSourceDraft = {
  name: '',
  sourceKind: 'rss',
  siteKey: 'rss',
  entryUrl: '',
  parserKey: 'rss.feed',
  schedule: { type: 'manual' },
  filter: {
    keywordGroups: [],
    excludeKeywords: [],
  },
  enabled: true,
  tags: ['RSS'],
};

export default function HotMonitorApp() {
  const { invoke } = useIpc();
  const [draft, setDraft] = useState<HotSourceDraft>(DEFAULT_DRAFT);
  const [sources, setSources] = useState<HotSource[]>([]);
  const [runs, setRuns] = useState<HotRunSummary[]>([]);
  const [reports, setReports] = useState<HotReportSummary[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<HotRunDetail | null>(null);
  const [reportSearchText, setReportSearchText] = useState('');
  const [previewReport, setPreviewReport] = useState<HotReportSummary | null>(null);
  const [timelinePresets, setTimelinePresets] = useState<HotTimelinePresetOption[]>([]);
  const [interest, setInterest] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const reportError = (error: unknown, fallback: string) => {
    message.error(error instanceof Error ? error.message : fallback);
  };

  const loadSources = useCallback(async () => {
    const data = await invoke<HotSource[]>(IPC_CHANNELS.HOT_SOURCE_LIST);
    setSources(Array.isArray(data) ? data : []);
  }, [invoke]);

  const loadRuns = useCallback(async (sourceId?: string) => {
    const payload = sourceId ? { sourceId } : {};
    const data = await invoke<HotRunSummary[]>(IPC_CHANNELS.HOT_RUN_LIST, payload);
    setRuns(Array.isArray(data) ? data : []);
  }, [invoke]);

  const loadReports = useCallback(async () => {
    const data = await invoke<HotReportSummary[]>(IPC_CHANNELS.HOT_REPORT_LIST, {});
    setReports(Array.isArray(data) ? data : []);
  }, [invoke]);

  const loadTimelinePresets = useCallback(async () => {
    const data = await invoke<HotTimelinePresetOption[]>(IPC_CHANNELS.HOT_TIMELINE_PRESETS);
    setTimelinePresets(Array.isArray(data) ? data : []);
  }, [invoke]);

  const refreshWorkspace = useCallback(async (sourceId?: string) => {
    await Promise.all([loadSources(), loadRuns(sourceId), loadReports(), loadTimelinePresets()]);
  }, [loadReports, loadRuns, loadSources, loadTimelinePresets]);

  useEffect(() => {
    void refreshWorkspace().catch((error) => {
      reportError(error, '加载热点监控数据失败');
    });
  }, [refreshWorkspace]);

  const updateDraft = <Field extends keyof HotSourceDraft>(
    field: Field,
    value: HotSourceDraft[Field],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const resetDraft = () => {
    setDraft(DEFAULT_DRAFT);
    setEditingSourceId(null);
  };

  const applyTimelinePreset = (preset: HotTimelinePresetOption) => {
    setDraft((current) => ({
      ...current,
      schedule: preset.schedule,
      timeline: {
        preset: preset.preset,
        windows: preset.windows,
      },
    }));
  };

  const createSource = async () => {
    try {
      await invoke(IPC_CHANNELS.HOT_SOURCE_CREATE, draft);
      message.success('热点源已创建');
      resetDraft();
      await refreshWorkspace(selectedSourceId ?? undefined);
    } catch (error) {
      reportError(error, '创建热点源失败');
    }
  };

  const updateSource = async () => {
    if (!editingSourceId) return;
    try {
      await invoke(IPC_CHANNELS.HOT_SOURCE_UPDATE, {
        sourceId: editingSourceId,
        updates: draft,
      });
      message.success('热点源已更新');
      resetDraft();
      await refreshWorkspace(selectedSourceId ?? undefined);
    } catch (error) {
      reportError(error, '更新热点源失败');
    }
  };

  const loadSourceDetail = async (sourceId: string) => {
    try {
      const source = await invoke<HotSource>(IPC_CHANNELS.HOT_SOURCE_DETAIL, { sourceId });
      setDraft({
        name: source.name,
        sourceKind: source.sourceKind,
        siteKey: source.siteKey,
        entryUrl: source.entryUrl,
        parserKey: source.parserKey,
        platformIds: source.platformIds ?? [],
        sessionId: source.sessionId,
        schedule: source.schedule,
        filter: source.filter,
        timeline: source.timeline,
        enabled: source.enabled,
        tags: source.tags,
      });
      setEditingSourceId(source.id);
      setSelectedSourceId(source.id);
    } catch (error) {
      reportError(error, '加载热点源详情失败');
    }
  };

  const selectSource = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    setRunDetail(null);
    setSelectedBatchId(null);
    void loadRuns(sourceId).catch((error) => {
      reportError(error, '加载热点运行失败');
    });
  };

  const startRun = async (sourceId: string) => {
    try {
      await invoke(IPC_CHANNELS.HOT_RUN_START, { sourceId });
      message.success('热点采集已启动');
      await loadRuns(sourceId);
    } catch (error) {
      reportError(error, '启动热点采集失败');
    }
  };

  const waitForRunCompletion = async (sourceId: string): Promise<HotRunSummary | null> => {
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const data = await invoke<HotRunSummary[]>(IPC_CHANNELS.HOT_RUN_LIST, { sourceId });
      const nextRuns = Array.isArray(data) ? data : [];
      setRuns(nextRuns);
      const latestRun = nextRuns[0] ?? null;
      if (latestRun && (latestRun.status === 'success' || latestRun.status === 'failed')) {
        return latestRun;
      }
      if (attempt < maxAttempts - 1) {
        await delay(1000);
      }
    }
    return null;
  };

  const startTrendRadarAggregateRun = async () => {
    try {
      const existingSource = sources.find((source) =>
        source.parserKey === 'newsnow.batch' && source.siteKey === 'trendradar',
      );
      const source = existingSource ?? await invoke<HotSource>(
        IPC_CHANNELS.HOT_SOURCE_CREATE,
        createTrendRadarBatchDraft(),
      );
      await invoke(IPC_CHANNELS.HOT_RUN_START, { sourceId: source.id });
      setSelectedSourceId(source.id);
      setSelectedBatchId(null);
      setRunDetail(null);
      message.success('多平台聚合采集已启动');
      await loadSources();
      const completedRun = await waitForRunCompletion(source.id);
      if (completedRun?.status === 'success') {
        await invoke(IPC_CHANNELS.HOT_REPORT_GENERATE, {
          sourceId: completedRun.sourceId,
          batchId: completedRun.batchId,
          format: 'html',
        });
        setSelectedBatchId(completedRun.batchId);
        await loadReports();
        message.success('多平台聚合采集完成，HTML报告已生成');
        return;
      }
      if (completedRun?.status === 'failed') {
        message.error('多平台聚合采集失败，请查看运行详情');
        return;
      }
      message.success('多平台聚合采集仍在运行，可稍后生成报告');
    } catch (error) {
      reportError(error, '启动多平台聚合采集失败');
    }
  };

  const deleteSource = async (sourceId: string) => {
    try {
      await invoke(IPC_CHANNELS.HOT_SOURCE_DELETE, { sourceId });
      message.success('热点源已删除');
      if (selectedSourceId === sourceId) {
        setSelectedSourceId(null);
        setSelectedBatchId(null);
        setRunDetail(null);
      }
      await refreshWorkspace();
    } catch (error) {
      reportError(error, '删除热点源失败');
    }
  };

  const viewRunDetail = async (run: HotRunSummary) => {
    try {
      const detail = await invoke<HotRunDetail>(IPC_CHANNELS.HOT_RUN_DETAIL, {
        sourceId: run.sourceId,
        batchId: run.batchId,
      });
      setSelectedSourceId(run.sourceId);
      setSelectedBatchId(run.batchId);
      setRunDetail(detail);
    } catch (error) {
      reportError(error, '加载运行详情失败');
    }
  };

  const generateReport = async (run: HotRunSummary) => {
    try {
      await invoke(IPC_CHANNELS.HOT_REPORT_GENERATE, {
        sourceId: run.sourceId,
        batchId: run.batchId,
        format: 'html',
      });
      message.success('热点报告已生成');
      await loadReports();
    } catch (error) {
      reportError(error, '生成热点报告失败');
    }
  };

  const generateAiSummary = async () => {
    const batchId = selectedBatchId ?? runs[0]?.batchId;
    if (!batchId) {
      message.error('请先选择热点运行批次');
      return;
    }
    try {
      const insight = await invoke<{ summary: string }>(IPC_CHANNELS.HOT_AI_SUMMARIZE, {
        interest,
        batchId,
      });
      setAiSummary(insight.summary);
      message.success('热点AI摘要已生成');
    } catch (error) {
      reportError(error, '生成热点AI摘要失败');
    }
  };

  const sendNotification = async () => {
    const report = previewReport ?? reports[0];
    if (!report) {
      message.error('请先生成热点报告');
      return;
    }
    try {
      await invoke(IPC_CHANNELS.HOT_NOTIFICATION_SEND, {
        reportId: report.id,
        target: { type: 'webhook', url: webhookUrl },
      });
      message.success('热点通知已发送');
    } catch (error) {
      reportError(error, '发送热点通知失败');
    }
  };

  const openBrowserTab = async () => {
    try {
      await invoke(IPC_CHANNELS.BROWSER_CREATE_TAB, {
        url: draft.entryUrl.trim() || 'about:blank',
      });
      message.success('浏览器活动标签页已打开');
    } catch (error) {
      reportError(error, '打开浏览器活动标签页失败');
    }
  };

  const previewReportDetail = async (report: HotReportSummary) => {
    try {
      const detail = await invoke<HotReportSummary>(IPC_CHANNELS.HOT_REPORT_DETAIL, {
        reportId: report.id,
      });
      setPreviewReport(detail);
    } catch (error) {
      reportError(error, '加载热点报告预览失败');
    }
  };

  const openReport = async (report: HotReportSummary) => {
    try {
      await invoke(IPC_CHANNELS.BROWSER_CREATE_TAB, {
        url: `${toFileUrl(report.filePath)}#all`,
      });
      message.success('热点报告已打开');
    } catch (error) {
      reportError(error, '打开热点报告失败');
    }
  };

  return (
    <PageShell
      title="热点监控"
      subTitle="聚合热点源、采集运行和报告产出，承接 TrendRadar 等价迁移的桌面入口"
      content="当前页面复用 YClaw HOT 后端与 IPC，生成本地 HTML 报告并支持 TrendRadar 风格标签页。"
      extra={
        <Space wrap className="yclaw-page-actions">
          <Tag color="volcano">
            <FireOutlined /> Hot Monitor
          </Tag>
          <Tag color="processing">
            <SyncOutlined /> HOT IPC
          </Tag>
        </Space>
      }
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Card className="yclaw-panel-card" title="监控工作台">
          <Typography.Paragraph type="secondary">
            可直接运行 11 平台聚合采集，也可管理单独热点源。
          </Typography.Paragraph>
          <section className="browser-workspace-section">
            <div className="browser-workspace-section-title">NewsNow预设源</div>
            <div className="browser-review-queue-actions">
              <button
                type="button"
                className="browser-hot-primary"
                onClick={startTrendRadarAggregateRun}
              >
                一键聚合采集
              </button>
              {NEWSNOW_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setDraft(createNewsNowDraft(preset));
                    setEditingSourceId(null);
                  }}
                >
                  {preset.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setDraft(createTrendRadarBatchDraft());
                  setEditingSourceId(null);
                }}
              >
                TrendRadar 11平台
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(RSS_DRAFT);
                  setEditingSourceId(null);
                }}
              >
                RSS订阅
              </button>
            </div>
          </section>
          <section className="browser-workspace-section">
            <div className="browser-workspace-section-title">Timeline调度</div>
            <div className="browser-review-queue-actions">
              {timelinePresets.map((preset) => (
                <button
                  key={preset.preset}
                  type="button"
                  onClick={() => applyTimelinePreset(preset)}
                >
                  {preset.label}时间线
                </button>
              ))}
            </div>
          </section>
          <section className="browser-workspace-section">
            <div className="browser-workspace-section-title">AI摘要与通知</div>
            <div className="browser-review-queue-actions">
              <button type="button" onClick={openBrowserTab}>
                打开活动标签页
              </button>
            </div>
            <input
              className="browser-workspace-input"
              value={interest}
              onChange={(event) => setInterest(event.target.value)}
              placeholder="兴趣描述"
            />
            <div className="browser-review-queue-actions">
              <button type="button" onClick={generateAiSummary}>
                生成AI摘要
              </button>
            </div>
            {aiSummary ? (
              <div className="browser-workspace-action-description">{aiSummary}</div>
            ) : null}
            <input
              className="browser-workspace-input"
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              placeholder="通知Webhook URL"
            />
            <div className="browser-review-queue-actions">
              <button type="button" onClick={sendNotification}>
                发送热点通知
              </button>
            </div>
          </section>
          <div className="browser-hot-layout">
            <HotSourcePanel
              draft={draft}
              sources={sources}
              selectedSourceId={selectedSourceId}
              editingSourceId={editingSourceId}
              onDraftChange={updateDraft}
              onCreate={createSource}
              onUpdate={updateSource}
              onCancelEdit={resetDraft}
              onSelect={selectSource}
              onLoadDetail={loadSourceDetail}
              onStartRun={startRun}
              onDelete={deleteSource}
            />
            <HotRunPanel
              runs={runs}
              selectedBatchId={selectedBatchId}
              detail={runDetail}
              onViewDetail={viewRunDetail}
              onRerun={(run) => {
                void startRun(run.sourceId);
              }}
              onGenerateReport={generateReport}
            />
            <HotReportPanel
              reports={reports}
              searchText={reportSearchText}
              previewReport={previewReport}
              onSearchChange={setReportSearchText}
              onPreview={previewReportDetail}
              onOpen={openReport}
            />
          </div>
        </Card>
      </Space>
    </PageShell>
  );
}

function toFileUrl(filePath: string): string {
  if (/^[a-z]+:\/\//i.test(filePath)) {
    return filePath;
  }
  const normalized = filePath.replace(/\\/g, '/');
  return `file:///${normalized.replace(/^\/+/, '')}`;
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
