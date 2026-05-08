import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Checkbox, Drawer, Input, Modal, Radio, Space, Tag, message } from 'antd';
import { FireOutlined, SyncOutlined } from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
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
import { HotRunDetailView, HotRunPanel } from '../browser/components/HotRunPanel';
import { HotSourcePanel, formatHotSourceConfigSummary } from '../browser/components/HotSourcePanel';
import {
  NEWSNOW_PRESETS,
  TRENDRADAR_PLATFORM_IDS,
  createNewsNowDraft,
  createTrendRadarBatchDraft,
} from './newsnowPresets';
import './styles.css';

type TrendRadarConfigFile = 'config' | 'frequency' | 'timeline';
type TrendRadarReportMode = 'current' | 'daily' | 'incremental';
type TrendRadarDisplayMode = 'keyword' | 'platform';

interface KeywordGroupDraft {
  name: string;
  include: string;
  required: string;
  exclude: string;
  maxItems: string;
}

interface RssFeedConfig {
  id: string;
  name: string;
  url: string;
  maxAgeDays?: number;
  enabled: boolean;
}

const CONFIG_FILE_TABS: Array<{ key: TrendRadarConfigFile; label: string }> = [
  { key: 'config', label: 'config.yaml' },
  { key: 'frequency', label: 'frequency_words.txt' },
  { key: 'timeline', label: 'timeline.yaml' },
];

const REPORT_MODE_OPTIONS: TrendRadarReportMode[] = ['current', 'daily', 'incremental'];
const DISPLAY_MODE_OPTIONS: TrendRadarDisplayMode[] = ['keyword', 'platform'];

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
  const [sourceRuns, setSourceRuns] = useState<HotRunSummary[]>([]);
  const [reports, setReports] = useState<HotReportSummary[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourceRunsDrawer, setSourceRunsDrawer] = useState<{
    sourceId: string;
    sourceName: string;
  } | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<HotRunDetail | null>(null);
  const [reportSearchText, setReportSearchText] = useState('');
  const [previewReport, setPreviewReport] = useState<HotReportSummary | null>(null);
  const [timelinePresets, setTimelinePresets] = useState<HotTimelinePresetOption[]>([]);
  const [globalExcludeWords, setGlobalExcludeWords] = useState('震惊');
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroupDraft[]>([
    {
      name: 'AI 相关',
      include: 'AI,OpenAI',
      required: '',
      exclude: '',
      maxItems: '',
    },
  ]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [newPlatformId, setNewPlatformId] = useState('');
  const [draggingPlatformId, setDraggingPlatformId] = useState<string | null>(null);
  const [rssEnabled, setRssEnabled] = useState(true);
  const [rssFreshnessEnabled, setRssFreshnessEnabled] = useState(true);
  const [rssDefaultMaxAgeDays, setRssDefaultMaxAgeDays] = useState(3);
  const [rssFeeds, setRssFeeds] = useState<RssFeedConfig[]>([]);
  const [rssDraft, setRssDraft] = useState({
    id: '',
    name: '',
    url: '',
    maxAgeDays: '',
  });
  const [reportMode, setReportMode] = useState<TrendRadarReportMode>('current');
  const [displayMode, setDisplayMode] = useState<TrendRadarDisplayMode>('keyword');
  const [sortByPositionFirst, setSortByPositionFirst] = useState(true);
  const [rankThreshold, setRankThreshold] = useState(10);
  const [maxNewsPerKeyword, setMaxNewsPerKeyword] = useState(8);
  const [activeConfigFile, setActiveConfigFile] = useState<TrendRadarConfigFile>('config');
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [overflowDrawer, setOverflowDrawer] = useState<'sources' | 'runs' | 'reports' | null>(null);

  const reportError = (error: unknown, fallback: string) => {
    message.error(error instanceof Error ? error.message : fallback);
  };

  const loadSources = useCallback(async () => {
    const data = await invoke<HotSource[]>(IPC_CHANNELS.HOT_SOURCE_LIST);
    setSources(Array.isArray(data) ? data : []);
  }, [invoke]);

  const loadRuns = useCallback(
    async (sourceId?: string) => {
      const payload = sourceId ? { sourceId } : {};
      const data = await invoke<HotRunSummary[]>(IPC_CHANNELS.HOT_RUN_LIST, payload);
      setRuns(Array.isArray(data) ? data : []);
    },
    [invoke],
  );

  const loadSourceRuns = useCallback(
    async (sourceId: string) => {
      const data = await invoke<HotRunSummary[]>(IPC_CHANNELS.HOT_RUN_LIST, { sourceId });
      setSourceRuns(Array.isArray(data) ? data : []);
    },
    [invoke],
  );

  const loadReports = useCallback(async () => {
    const data = await invoke<HotReportSummary[]>(IPC_CHANNELS.HOT_REPORT_LIST, {});
    setReports(Array.isArray(data) ? data : []);
  }, [invoke]);

  const sortedSources = [...sources].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
  const sortedRuns = [...runs].sort(
    (left, right) =>
      Date.parse(right.startedAt ?? right.finishedAt ?? '') -
      Date.parse(left.startedAt ?? left.finishedAt ?? ''),
  );
  const sortedSourceRuns = [...sourceRuns].sort(
    (left, right) =>
      Date.parse(right.startedAt ?? right.finishedAt ?? '') -
      Date.parse(left.startedAt ?? left.finishedAt ?? ''),
  );
  const sortedReports = [...reports].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
  const latestSource = sortedSources[0] ?? null;
  const recentReports = sortedReports.slice(0, 3);

  const loadTimelinePresets = useCallback(async () => {
    const data = await invoke<HotTimelinePresetOption[]>(IPC_CHANNELS.HOT_TIMELINE_PRESETS);
    setTimelinePresets(Array.isArray(data) ? data : []);
  }, [invoke]);

  const refreshWorkspace = useCallback(
    async (sourceId?: string) => {
      await Promise.all([loadSources(), loadRuns(sourceId), loadReports(), loadTimelinePresets()]);
    },
    [loadReports, loadRuns, loadSources, loadTimelinePresets],
  );

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

  const openTaskModal = (nextDraft?: HotSourceDraft) => {
    setDraft(nextDraft ?? draft);
    setEditingSourceId(null);
    setTaskModalOpen(true);
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

  const addKeywordGroup = () => {
    setKeywordGroups((current) => [
      ...current,
      {
        name: '',
        include: '',
        required: '',
        exclude: '',
        maxItems: '',
      },
    ]);
  };

  const updateKeywordGroup = <Field extends keyof KeywordGroupDraft>(
    index: number,
    field: Field,
    value: KeywordGroupDraft[Field],
  ) => {
    setKeywordGroups((current) =>
      current.map((group, groupIndex) =>
        groupIndex === index ? { ...group, [field]: value } : group,
      ),
    );
  };

  const moveKeywordGroup = (index: number, direction: -1 | 1) => {
    setKeywordGroups((current) => {
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };

  const removeKeywordGroup = (index: number) => {
    setKeywordGroups((current) => current.filter((_, groupIndex) => groupIndex !== index));
  };

  const getConfigPlatformIds = () => {
    const platformIds = draft.platformIds?.length ? draft.platformIds : TRENDRADAR_PLATFORM_IDS;
    return [...platformIds];
  };

  const updateConfigPlatformIds = (platformIds: string[]) => {
    setDraft((current) => ({
      ...current,
      name: current.platformIds?.length ? current.name : '多平台热榜',
      sourceKind: 'api',
      siteKey: 'trendradar',
      entryUrl: 'https://newsnow.busiyi.world/api/s',
      parserKey: 'newsnow.batch',
      platformIds,
      tags: current.platformIds?.length ? current.tags : ['多平台', '热榜'],
    }));
  };

  const updateHotCrawlEnabled = (enabled: boolean) => {
    const platformIds = getConfigPlatformIds();
    setDraft((current) => ({
      ...current,
      name: current.platformIds?.length ? current.name : '多平台热榜',
      sourceKind: 'api',
      siteKey: 'trendradar',
      entryUrl: 'https://newsnow.busiyi.world/api/s',
      parserKey: 'newsnow.batch',
      platformIds,
      enabled,
      tags: current.platformIds?.length ? current.tags : ['多平台', '热榜'],
    }));
  };

  const moveConfigPlatform = (platformId: string, direction: -1 | 1) => {
    const platformIds = getConfigPlatformIds();
    const currentIndex = platformIds.indexOf(platformId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= platformIds.length) {
      return;
    }
    const nextPlatformIds = [...platformIds];
    const [movedPlatformId] = nextPlatformIds.splice(currentIndex, 1);
    nextPlatformIds.splice(nextIndex, 0, movedPlatformId);
    updateConfigPlatformIds(nextPlatformIds);
  };

  const dropConfigPlatform = (targetPlatformId: string) => {
    if (!draggingPlatformId || draggingPlatformId === targetPlatformId) {
      setDraggingPlatformId(null);
      return;
    }
    const platformIds = getConfigPlatformIds();
    const fromIndex = platformIds.indexOf(draggingPlatformId);
    const toIndex = platformIds.indexOf(targetPlatformId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggingPlatformId(null);
      return;
    }
    const nextPlatformIds = [...platformIds];
    const [movedPlatformId] = nextPlatformIds.splice(fromIndex, 1);
    nextPlatformIds.splice(toIndex, 0, movedPlatformId);
    updateConfigPlatformIds(nextPlatformIds);
    setDraggingPlatformId(null);
  };

  const addConfigPlatform = () => {
    const platformId = newPlatformId.trim();
    if (!platformId) {
      return;
    }
    const platformIds = getConfigPlatformIds();
    if (platformIds.includes(platformId)) {
      message.error('平台已存在');
      return;
    }
    updateConfigPlatformIds([...platformIds, platformId]);
    setNewPlatformId('');
  };

  const addRssFeed = () => {
    const id = rssDraft.id.trim();
    const name = rssDraft.name.trim();
    const url = rssDraft.url.trim();
    if (!id || !name || !url) {
      message.error('请填写完整 RSS 源信息');
      return;
    }
    if (rssFeeds.some((feed) => feed.id === id)) {
      message.error('RSS 源 ID 已存在');
      return;
    }
    const maxAgeDays = Number.parseInt(rssDraft.maxAgeDays, 10);
    setRssFeeds((current) => [
      ...current,
      {
        id,
        name,
        url,
        enabled: true,
        ...(Number.isFinite(maxAgeDays) && maxAgeDays > 0 ? { maxAgeDays } : {}),
      },
    ]);
    setRssDraft({ id: '', name: '', url: '', maxAgeDays: '' });
  };

  const toggleRssFeed = (feedId: string) => {
    setRssFeeds((current) =>
      current.map((feed) => (feed.id === feedId ? { ...feed, enabled: !feed.enabled } : feed)),
    );
  };

  const removeRssFeed = (feedId: string) => {
    setRssFeeds((current) => current.filter((feed) => feed.id !== feedId));
  };

  const createSource = async () => {
    try {
      await invoke(IPC_CHANNELS.HOT_SOURCE_CREATE, draft);
      message.success('热点源已创建');
      resetDraft();
      setTaskModalOpen(false);
      await refreshWorkspace();
    } catch (error) {
      reportError(error, '创建热点源失败');
    }
  };

  const saveSourceAsNew = async () => {
    try {
      await invoke(IPC_CHANNELS.HOT_SOURCE_CREATE, draft);
      message.success('热点源已另存为新任务');
      resetDraft();
      setTaskModalOpen(false);
      await refreshWorkspace();
    } catch (error) {
      reportError(error, '另存热点源失败');
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
      setTaskModalOpen(false);
      await refreshWorkspace();
      if (sourceRunsDrawer) {
        await loadSourceRuns(sourceRunsDrawer.sourceId);
      }
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
      setTaskModalOpen(true);
    } catch (error) {
      reportError(error, '加载热点源详情失败');
    }
  };

  const selectSource = (sourceId: string) => {
    const sourceName = sources.find((source) => source.id === sourceId)?.name ?? '采集源';
    setSelectedSourceId(sourceId);
    setRunDetail(null);
    setSelectedBatchId(null);
    setSourceRunsDrawer({ sourceId, sourceName });
    void loadSourceRuns(sourceId).catch((error) => {
      reportError(error, '加载热点运行失败');
    });
  };

  const startRun = async (sourceId: string) => {
    try {
      await invoke(IPC_CHANNELS.HOT_RUN_START, { sourceId });
      message.success('热点采集已启动');
      await loadRuns();
      const completedRun = await waitForRunCompletion(sourceId);
      await loadRuns();
      if (sourceRunsDrawer?.sourceId === sourceId) {
        await loadSourceRuns(sourceId);
      }
      if (completedRun?.status === 'success') {
        await generateReportForRun(completedRun);
        message.success('热点采集完成，报告已生成');
      } else if (completedRun?.status === 'failed') {
        message.error('热点采集失败，请查看运行详情');
      }
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

  const generateReportForRun = async (run: HotRunSummary) => {
    await invoke(IPC_CHANNELS.HOT_REPORT_GENERATE, {
      sourceId: run.sourceId,
      batchId: run.batchId,
      format: 'html',
    });
    setSelectedBatchId(run.batchId);
    await loadReports();
  };

  const startTrendRadarAggregateRun = async () => {
    try {
      const selectedSource = selectedSourceId
        ? sources.find((source) => source.id === selectedSourceId)
        : null;
      const source = isTrendRadarBatchSource(selectedSource)
        ? selectedSource
        : await invoke<HotSource>(IPC_CHANNELS.HOT_SOURCE_CREATE, createTrendRadarBatchDraft());
      await invoke(IPC_CHANNELS.HOT_RUN_START, { sourceId: source.id });
      setSelectedSourceId(source.id);
      setSelectedBatchId(null);
      setRunDetail(null);
      message.success('多平台聚合采集已启动');
      await loadSources();
      const completedRun = await waitForRunCompletion(source.id);
      if (completedRun?.status === 'success') {
        await generateReportForRun(completedRun);
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
        setSourceRunsDrawer(null);
        setSourceRuns([]);
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
      await generateReportForRun(run);
      message.success('热点报告已生成');
    } catch (error) {
      reportError(error, '生成热点报告失败');
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

  const loadDefaultTrendRadarConfig = () => {
    setDraft(createTrendRadarBatchDraft());
    setEditingSourceId(null);
    message.success('默认热点配置已加载');
  };

  const saveTrendRadarConfig = async () => {
    try {
      const result = await invoke<{ configDir?: string }>(IPC_CHANNELS.HOT_CONFIG_SAVE, {
        config: buildTrendRadarConfigYaml({
          platformIds: getConfigPlatformIds(),
          hotCrawlEnabled: draft.enabled !== false,
          rssEnabled,
          rssFreshnessEnabled,
          rssDefaultMaxAgeDays,
          rssFeeds,
          reportMode,
          displayMode,
          sortByPositionFirst,
          rankThreshold,
          maxNewsPerKeyword,
        }),
        frequency: buildTrendRadarFrequencyText(globalExcludeWords, keywordGroups),
        timeline: buildTrendRadarTimelineYaml(timelinePresets),
      });
      message.success(`配置已保存到 ${result?.configDir ?? '热点配置目录'}`);
    } catch (error) {
      reportError(error, '保存热点配置失败');
    }
  };

  const copyTrendRadarConfig = async () => {
    const configText = [
      'config.yaml',
      `platforms: ${TRENDRADAR_PLATFORM_IDS.join(', ')}`,
      `rss: ${draft.sourceKind === 'rss' ? draft.entryUrl : '未配置'}`,
      `schedule: ${draft.schedule?.type ?? 'manual'}`,
      `keywords: ${keywordGroups[0]?.include ?? '未配置'}`,
    ].join('\n');
    try {
      await navigator.clipboard?.writeText(configText);
      message.success('配置内容已复制');
    } catch {
      message.success('配置内容已生成，可在编辑器中查看');
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

  const deleteReport = async (report: HotReportSummary) => {
    try {
      await invoke(IPC_CHANNELS.HOT_REPORT_DELETE, {
        reportId: report.id,
      });
      if (previewReport?.id === report.id) {
        setPreviewReport(null);
      }
      message.success('热点报告已删除');
      await loadReports();
    } catch (error) {
      reportError(error, '删除热点报告失败');
    }
  };

  const revealReport = async (report: HotReportSummary) => {
    try {
      await invoke(IPC_CHANNELS.HOT_REPORT_REVEAL, {
        reportId: report.id,
      });
      message.success('已打开报告存储位置');
    } catch (error) {
      reportError(error, '打开报告存储位置失败');
    }
  };

  return (
    <PageShell
      title="热点监控"
      subTitle="聚合热点源、采集运行和报告产出"
      content="当前页面复用 YClaw HOT 后端与 IPC，生成本地 HTML 报告。"
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
      <div className="hot-monitor-app">
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Card className="yclaw-panel-card">
            <div className="hot-monitor-toolbar-title">任务列表</div>
            <div className="hot-monitor-overview">
              <section className="hot-monitor-latest-source" aria-label="最近采集源">
                <div className="browser-workspace-section-title">最近采集源</div>
                {latestSource ? (
                  <div className="hot-monitor-source-summary">
                    <div>
                      <div className="browser-workspace-action-title">{latestSource.name}</div>
                      <div className="browser-workspace-action-meta">
                        {latestSource.sourceKind} · {latestSource.siteKey} ·{' '}
                        {formatBeijingTime(latestSource.updatedAt)}
                      </div>
                      <div className="browser-workspace-action-meta">
                        {formatHotSourceConfigSummary(latestSource)}
                      </div>
                    </div>
                    <Space wrap>
                      <Button onClick={() => void loadSourceDetail(latestSource.id)}>加载详情</Button>
                      <Button onClick={() => selectSource(latestSource.id)}>查看运行</Button>
                      <Button type="primary" onClick={() => void startRun(latestSource.id)}>
                        立即运行
                      </Button>
                    </Space>
                  </div>
                ) : (
                  <div className="browser-workspace-empty">暂无采集源</div>
                )}
              </section>
              <section aria-label="热点任务列表">
                <ProTable<HotRunSummary>
                  rowKey="batchId"
                  search={false}
                  options={{ reload: () => void refreshWorkspace() }}
                  pagination={{ pageSize: 5, showSizeChanger: false }}
                  dataSource={sortedRuns}
                  locale={{
                    emptyText: <div className="browser-workspace-empty">暂无运行记录</div>,
                  }}
                  className="hot-monitor-task-table-wrap"
                  tableClassName="hot-monitor-task-table"
                  toolBarRender={() => [
                    <Button key="new-task" onClick={() => openTaskModal()}>
                      新增任务
                    </Button>,
                    <Button key="config" onClick={() => setConfigDrawerOpen(true)}>
                      配置
                    </Button>,
                    <Button
                      key="sources"
                      onClick={() => setOverflowDrawer('sources')}
                    >
                      全部采集源
                    </Button>,
                    <Button
                      key="reports"
                      onClick={() => setOverflowDrawer('reports')}
                    >
                      历史报告
                    </Button>,
                    <Button key="runs" onClick={() => setOverflowDrawer('runs')}>
                      全部任务
                    </Button>,
                    <Button
                      key="aggregate"
                      type="primary"
                      onClick={startTrendRadarAggregateRun}
                    >
                      一键聚合采集
                    </Button>,
                  ]}
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
                      render: (_, run) => `${run.resultCount} 条`,
                    },
                    {
                      title: '结束时间',
                      dataIndex: 'finishedAt',
                      render: (_, run) => formatBeijingTime(run.finishedAt),
                    },
                    {
                      title: '报告',
                      dataIndex: 'reportStatus',
                      render: (_, run) => run.reportStatus ?? '未生成',
                    },
                    {
                      title: '操作',
                      key: 'actions',
                      render: (_, run) => (
                        <Space wrap className="hot-monitor-table-actions">
                          <Button onClick={() => void loadSourceDetail(run.sourceId)}>
                            加载详情
                          </Button>
                          <Button onClick={() => selectSource(run.sourceId)}>
                            查看运行
                          </Button>
                          {run.status === 'failed' ? (
                            <Button onClick={() => void viewRunDetail(run)}>
                              查看详情
                            </Button>
                          ) : null}
                          {run.status === 'failed' || run.status === 'success' ? (
                            <Button onClick={() => void startRun(run.sourceId)}>
                              重新运行
                            </Button>
                          ) : null}
                          {run.status === 'success' ? (
                            <Button onClick={() => void generateReport(run)}>
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
                <HotReportPanel
                  reports={recentReports}
                  searchText={reportSearchText}
                  onSearchChange={setReportSearchText}
                  onPreview={previewReportDetail}
                  onReveal={revealReport}
                  onDelete={deleteReport}
                  formatTime={formatBeijingTime}
                />
              </section>
            </div>
          </Card>
        </Space>
      </div>
      <Drawer
        title="热点配置"
        open={configDrawerOpen}
        onClose={() => setConfigDrawerOpen(false)}
        width={900}
      >
        <div className="hot-monitor-app hot-monitor-drawer-content">
          <Space wrap>
            <Button onClick={loadDefaultTrendRadarConfig}>
              加载默认配置
            </Button>
            <Button onClick={saveTrendRadarConfig}>
              保存配置
            </Button>
            <Button onClick={copyTrendRadarConfig}>
              复制配置
            </Button>
            <Button type="primary" onClick={startTrendRadarAggregateRun}>
              一键聚合采集
            </Button>
          </Space>
          <section className="browser-workspace-section hot-monitor-config-source">
            <div className="browser-workspace-section-title">NewsNow预设源</div>
            <Space wrap>
              {NEWSNOW_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  onClick={() => {
                    openTaskModal(createNewsNowDraft(preset));
                  }}
                >
                  {preset.name}
                </Button>
              ))}
              <Button
                onClick={() => {
                  openTaskModal(createTrendRadarBatchDraft());
                }}
              >
                多平台热榜
              </Button>
              <Button
                onClick={() => {
                  openTaskModal(RSS_DRAFT);
                }}
              >
                RSS订阅
              </Button>
            </Space>
          </section>
          <Radio.Group
            className="hot-monitor-config-tabs"
            optionType="button"
            buttonStyle="solid"
            aria-label="热点配置文件"
            value={activeConfigFile}
            onChange={(event) => setActiveConfigFile(event.target.value)}
            options={CONFIG_FILE_TABS.map((tab) => ({ label: tab.label, value: tab.key }))}
          />
          <div className="hot-monitor-config-grid hot-monitor-config-grid-wide">
            <section className="browser-workspace-section">
              <div className="browser-workspace-section-title">配置模块</div>
              {activeConfigFile === 'config' ? (
                <>
                  <div className="browser-workspace-summary">
                    监控平台、RSS、报告模式、通知和 AI 分析集中在这里维护。
                  </div>
                  <Space wrap>
                    <Button
                      onClick={() => {
                        openTaskModal({
                          ...createTrendRadarBatchDraft(),
                          platformIds: getConfigPlatformIds(),
                          enabled: draft.enabled !== false,
                        });
                      }}
                    >
                      添加热榜平台
                    </Button>
                    <Button onClick={openBrowserTab}>
                      打开活动标签页
                    </Button>
                  </Space>
                  <section className="hot-monitor-platform-config">
                    <div className="browser-workspace-section-title">数据源 - 热榜平台</div>
                    <Checkbox
                      checked={draft.enabled !== false}
                      onChange={(event) => updateHotCrawlEnabled(event.target.checked)}
                      aria-label="启动热榜抓取"
                    >
                      启动热榜抓取
                    </Checkbox>
                    <div className="browser-workspace-list">
                      {getConfigPlatformIds().map((platformId, index, platformIds) => (
                        <div
                          key={platformId}
                          className="browser-workspace-list-item hot-monitor-platform-row"
                          draggable
                          onDragStart={() => setDraggingPlatformId(platformId)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => dropConfigPlatform(platformId)}
                        >
                          <div className="hot-monitor-platform-grip" aria-hidden="true">
                            ::
                          </div>
                          <div className="hot-monitor-platform-main">
                            <div className="browser-workspace-action-title">{platformId}</div>
                            <div className="browser-workspace-action-meta">
                              拖拽排序 · 第 {index + 1} 位 · 已纳入聚合采集
                            </div>
                          </div>
                          <Space wrap>
                            <Button
                              disabled={index === 0}
                              onClick={() => moveConfigPlatform(platformId, -1)}
                            >
                              上移
                            </Button>
                            <Button
                              disabled={index === platformIds.length - 1}
                              onClick={() => moveConfigPlatform(platformId, 1)}
                            >
                              下移
                            </Button>
                          </Space>
                        </div>
                      ))}
                    </div>
                    <div className="hot-monitor-platform-add">
                      <Input
                        className="browser-workspace-input"
                        value={newPlatformId}
                        onChange={(event) => setNewPlatformId(event.target.value)}
                        placeholder="新增平台ID"
                      />
                      <Button onClick={addConfigPlatform}>
                        添加平台
                      </Button>
                    </div>
                  </section>
                  <section className="hot-monitor-platform-config">
                    <div className="browser-workspace-section-title">数据源 - RSS 订阅配置</div>
                    <Checkbox
                      checked={rssEnabled}
                      onChange={(event) => setRssEnabled(event.target.checked)}
                      aria-label="启用 RSS 抓取"
                    >
                      启用 RSS 抓取
                    </Checkbox>
                    <div className="hot-monitor-config-form-grid">
                      <label className="hot-monitor-config-field">
                        <span>启用新鲜度过滤</span>
                        <Checkbox
                          checked={rssFreshnessEnabled}
                          onChange={(event) => setRssFreshnessEnabled(event.target.checked)}
                          aria-label="启用新鲜度过滤"
                        />
                      </label>
                      <label className="hot-monitor-config-field">
                        <span>默认最大文章年龄（天）</span>
                        <Input
                          className="browser-workspace-input"
                          type="number"
                          min={1}
                          value={rssDefaultMaxAgeDays}
                          onChange={(event) =>
                            setRssDefaultMaxAgeDays(normalizePositiveInteger(event.target.value, 3))
                          }
                        />
                      </label>
                    </div>
                    <div className="hot-monitor-config-form-grid">
                      <label className="hot-monitor-config-field">
                        <span>源 ID（唯一标识，英文）</span>
                        <Input
                          className="browser-workspace-input"
                          value={rssDraft.id}
                          onChange={(event) =>
                            setRssDraft((current) => ({ ...current, id: event.target.value }))
                          }
                          aria-label="源 ID（唯一标识，英文）"
                          placeholder="hackernews"
                        />
                      </label>
                      <label className="hot-monitor-config-field">
                        <span>显示名称</span>
                        <Input
                          className="browser-workspace-input"
                          value={rssDraft.name}
                          onChange={(event) =>
                            setRssDraft((current) => ({ ...current, name: event.target.value }))
                          }
                          aria-label="显示名称"
                          placeholder="Hacker News"
                        />
                      </label>
                      <label className="hot-monitor-config-field">
                        <span>RSS URL</span>
                        <Input
                          className="browser-workspace-input"
                          value={rssDraft.url}
                          onChange={(event) =>
                            setRssDraft((current) => ({ ...current, url: event.target.value }))
                          }
                          aria-label="RSS URL"
                          placeholder="https://news.ycombinator.com/rss"
                        />
                      </label>
                      <label className="hot-monitor-config-field">
                        <span>最大文章年龄（天，可选）</span>
                        <Input
                          className="browser-workspace-input"
                          type="number"
                          min={1}
                          value={rssDraft.maxAgeDays}
                          onChange={(event) =>
                            setRssDraft((current) => ({
                              ...current,
                              maxAgeDays: event.target.value,
                            }))
                          }
                          aria-label="最大文章年龄（天，可选）"
                          placeholder="3"
                        />
                      </label>
                    </div>
                    <Space wrap>
                      <Button onClick={addRssFeed}>
                        添加 RSS 源
                      </Button>
                      <Button
                        onClick={() =>
                          setRssDraft({
                            id: 'bing-news-ai',
                            name: 'Bing 新闻 AI',
                            url: 'https://www.bing.com/news/search?q=AI&format=rss',
                            maxAgeDays: '3',
                          })
                        }
                      >
                        Bing 新闻示例
                      </Button>
                    </Space>
                    <div className="browser-workspace-list">
                      {rssFeeds.length === 0 ? (
                        <div className="browser-workspace-empty">暂无 RSS 源，请添加</div>
                      ) : (
                        rssFeeds.map((feed) => (
                          <div key={feed.id} className="browser-workspace-list-item">
                            <div className="browser-workspace-action-title">{feed.name}</div>
                            <div className="browser-workspace-action-meta">{feed.id}</div>
                            <div className="browser-workspace-action-description">{feed.url}</div>
                            <Space wrap>
                              <Button onClick={() => toggleRssFeed(feed.id)}>
                                {feed.enabled ? '禁用' : '启用'}
                              </Button>
                              <Button
                                danger
                                onClick={() => removeRssFeed(feed.id)}
                              >
                                删除
                              </Button>
                            </Space>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                  <section className="hot-monitor-platform-config">
                    <div className="browser-workspace-section-title">报告模式</div>
                    <div className="hot-monitor-config-form-grid">
                      <fieldset className="hot-monitor-config-field">
                        <legend>模式选项</legend>
                        <Space wrap>
                          {REPORT_MODE_OPTIONS.map((mode) => (
                            <Radio
                              key={mode}
                              checked={reportMode === mode}
                              onChange={() => setReportMode(mode)}
                              aria-label={`报告模式 ${mode}`}
                            >
                              {mode}
                            </Radio>
                          ))}
                        </Space>
                      </fieldset>
                      <fieldset className="hot-monitor-config-field">
                        <legend>分组维度</legend>
                        <Space wrap>
                          {DISPLAY_MODE_OPTIONS.map((mode) => (
                            <Radio
                              key={mode}
                              checked={displayMode === mode}
                              onChange={() => setDisplayMode(mode)}
                              aria-label={`分组维度 ${mode}`}
                            >
                              {mode}
                            </Radio>
                          ))}
                        </Space>
                      </fieldset>
                      <label className="hot-monitor-config-field">
                        <span>按定义顺序排序</span>
                        <Checkbox
                          checked={sortByPositionFirst}
                          onChange={(event) => setSortByPositionFirst(event.target.checked)}
                        />
                      </label>
                      <label className="hot-monitor-config-field">
                        <span>排名高亮阈值</span>
                        <Input
                          className="browser-workspace-input"
                          type="number"
                          min={1}
                          value={rankThreshold}
                          onChange={(event) =>
                            setRankThreshold(normalizePositiveInteger(event.target.value, 10))
                          }
                        />
                      </label>
                      <label className="hot-monitor-config-field">
                        <span>每个关键词最大显示数量</span>
                        <Input
                          className="browser-workspace-input"
                          type="number"
                          min={1}
                          value={maxNewsPerKeyword}
                          onChange={(event) =>
                            setMaxNewsPerKeyword(normalizePositiveInteger(event.target.value, 8))
                          }
                        />
                      </label>
                    </div>
                  </section>
                  <Input
                    className="browser-workspace-input"
                    value={webhookUrl}
                    onChange={(event) => setWebhookUrl(event.target.value)}
                    placeholder="通知Webhook URL"
                  />
                  <Space wrap>
                    <Button onClick={sendNotification}>
                      发送热点通知
                    </Button>
                  </Space>
                </>
              ) : null}
              {activeConfigFile === 'frequency' ? (
                <>
                  <div className="browser-workspace-summary">
                    维护全局排除词和关键词组，采集报告会按这些词组进行热点归类。
                  </div>
                  <Space wrap>
                    <Button onClick={addKeywordGroup}>
                      新增关键词组
                    </Button>
                  </Space>
                  <label className="hot-monitor-config-field">
                    <span>全局排除词</span>
                    <Input.TextArea
                      className="browser-workspace-input hot-monitor-keyword-textarea"
                      value={globalExcludeWords}
                      onChange={(event) => setGlobalExcludeWords(event.target.value)}
                      placeholder="震惊,广告"
                    />
                  </label>
                  <div className="hot-monitor-keyword-groups">
                    {keywordGroups.map((group, index) => (
                      <section key={`${index}-${group.name}`} className="hot-monitor-keyword-group">
                        <div className="hot-monitor-keyword-group-head">
                          <div className="browser-workspace-action-title">关键词组 {index + 1}</div>
                          <Space wrap>
                            <Button
                              onClick={() => moveKeywordGroup(index, -1)}
                              disabled={index === 0}
                            >
                              上移
                            </Button>
                            <Button
                              onClick={() => moveKeywordGroup(index, 1)}
                              disabled={index === keywordGroups.length - 1}
                            >
                              下移
                            </Button>
                            <Button danger onClick={() => removeKeywordGroup(index)}>
                              删除
                            </Button>
                          </Space>
                        </div>
                        <div className="hot-monitor-config-form-grid">
                          <label className="hot-monitor-config-field">
                            <span>关键词组名称 {index + 1}</span>
                            <Input
                              className="browser-workspace-input"
                              value={group.name}
                              onChange={(event) => updateKeywordGroup(index, 'name', event.target.value)}
                              placeholder="AI 相关"
                            />
                          </label>
                          <label className="hot-monitor-config-field">
                            <span>包含词 {index + 1}</span>
                            <Input
                              className="browser-workspace-input"
                              value={group.include}
                              onChange={(event) => updateKeywordGroup(index, 'include', event.target.value)}
                              placeholder="AI,OpenAI,/芯片|半导体/"
                            />
                          </label>
                          <label className="hot-monitor-config-field">
                            <span>必须词 {index + 1}</span>
                            <Input
                              className="browser-workspace-input"
                              value={group.required}
                              onChange={(event) => updateKeywordGroup(index, 'required', event.target.value)}
                              placeholder="算力"
                            />
                          </label>
                          <label className="hot-monitor-config-field">
                            <span>组内排除词 {index + 1}</span>
                            <Input
                              className="browser-workspace-input"
                              value={group.exclude}
                              onChange={(event) => updateKeywordGroup(index, 'exclude', event.target.value)}
                              placeholder="广告"
                            />
                          </label>
                          <label className="hot-monitor-config-field">
                            <span>组内最大显示数量 {index + 1}</span>
                            <Input
                              className="browser-workspace-input"
                              type="number"
                              min={0}
                              value={group.maxItems}
                              onChange={(event) => updateKeywordGroup(index, 'maxItems', event.target.value)}
                              placeholder="5"
                            />
                          </label>
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              ) : null}
              {activeConfigFile === 'timeline' ? (
                <>
                  <div className="browser-workspace-summary">
                    维护调度模式和时间段，支持官方 timeline.yaml 的工作日、周末、自定义窗口。
                  </div>
                  <Space wrap>
                    <Button>新建调度模式</Button>
                    <Button>新增时间段</Button>
                    {timelinePresets.map((preset) => (
                      <Button
                        key={preset.preset}
                        onClick={() => applyTimelinePreset(preset)}
                      >
                        {preset.label}时间线
                      </Button>
                    ))}
                  </Space>
                </>
              ) : null}
            </section>
          </div>
        </div>
      </Drawer>
      <Modal
        title={editingSourceId ? '编辑采集任务' : '新增采集任务'}
        open={taskModalOpen}
        onCancel={() => {
          setTaskModalOpen(false);
          resetDraft();
        }}
        footer={null}
        width={720}
      >
        <div className="hot-monitor-app hot-monitor-task-modal-content">
          <HotSourcePanel
            draft={draft}
            sources={[]}
            selectedSourceId={selectedSourceId}
            editingSourceId={editingSourceId}
            sectionTitle="任务配置"
            createLabel="创建任务"
            onDraftChange={updateDraft}
            onCreate={createSource}
            onUpdate={updateSource}
            onSaveAsNew={saveSourceAsNew}
            onCancelEdit={resetDraft}
            onSelect={selectSource}
            onLoadDetail={loadSourceDetail}
            onStartRun={startRun}
            onDelete={deleteSource}
            formatTime={formatBeijingTime}
          />
        </div>
      </Modal>
      <Drawer
        title={
          overflowDrawer === 'sources'
            ? '全部采集源'
            : overflowDrawer === 'runs'
              ? '全部任务'
              : '全部报告'
        }
        open={overflowDrawer !== null}
        onClose={() => setOverflowDrawer(null)}
        width={760}
      >
        <div className="hot-monitor-app hot-monitor-drawer-content">
          {overflowDrawer === 'sources' ? (
            <HotSourcePanel
              draft={draft}
              sources={sortedSources}
              selectedSourceId={selectedSourceId}
              editingSourceId={editingSourceId}
              showEditor={false}
              onDraftChange={updateDraft}
              onCreate={createSource}
              onUpdate={updateSource}
              onSaveAsNew={saveSourceAsNew}
              onCancelEdit={resetDraft}
              onSelect={selectSource}
              onLoadDetail={(sourceId) => {
                setConfigDrawerOpen(true);
                void loadSourceDetail(sourceId);
              }}
              onStartRun={startRun}
              onDelete={deleteSource}
              formatTime={formatBeijingTime}
            />
          ) : null}
          {overflowDrawer === 'runs' ? (
            <HotRunPanel
              runs={sortedRuns}
              selectedBatchId={selectedBatchId}
              onViewDetail={viewRunDetail}
              onRerun={(run) => {
                void startRun(run.sourceId);
              }}
              onGenerateReport={generateReport}
              formatTime={formatBeijingTime}
            />
          ) : null}
          {overflowDrawer === 'reports' ? (
            <HotReportPanel
              reports={sortedReports}
              searchText={reportSearchText}
              onSearchChange={setReportSearchText}
              onPreview={previewReportDetail}
              onReveal={revealReport}
              onDelete={deleteReport}
              formatTime={formatBeijingTime}
            />
          ) : null}
        </div>
      </Drawer>
      <Drawer
        title={sourceRunsDrawer ? `${sourceRunsDrawer.sourceName}任务` : '采集源任务'}
        open={sourceRunsDrawer !== null}
        onClose={() => {
          setSourceRunsDrawer(null);
          setSourceRuns([]);
        }}
        width={760}
      >
        <div className="hot-monitor-app hot-monitor-drawer-content">
          <HotRunPanel
            runs={sortedSourceRuns}
            selectedBatchId={selectedBatchId}
            onViewDetail={viewRunDetail}
            onRerun={(run) => {
              void startRun(run.sourceId);
            }}
            onGenerateReport={generateReport}
            formatTime={formatBeijingTime}
          />
        </div>
      </Drawer>
      <Drawer
        title="报告预览"
        open={previewReport?.content !== undefined}
        onClose={() => setPreviewReport(null)}
        width={1000}
      >
        {previewReport?.content ? (
          <div className="hot-report-preview">
            <div className="hot-report-preview-head">
              <div className="browser-workspace-section-title">{previewReport.title}</div>
              <Button onClick={() => setPreviewReport(null)}>
                关闭预览
              </Button>
            </div>
            <iframe
              className="hot-report-preview-frame"
              sandbox=""
              srcDoc={previewReport.content}
              title={previewReport.title}
            />
          </div>
        ) : null}
      </Drawer>
      <Modal
        title="运行详情"
        open={runDetail !== null}
        onCancel={() => setRunDetail(null)}
        footer={null}
        width={720}
      >
        {runDetail ? <HotRunDetailView detail={runDetail} formatTime={formatBeijingTime} /> : null}
      </Modal>
    </PageShell>
  );
}

function formatBeijingTime(value?: string | null): string {
  if (!value) {
    return '未知';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
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

function normalizePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isTrendRadarBatchSource(source: HotSource | null | undefined): source is HotSource {
  return source?.siteKey === 'trendradar' && source.parserKey === 'newsnow.batch';
}

function buildTrendRadarConfigYaml(input: {
  platformIds: string[];
  hotCrawlEnabled: boolean;
  rssEnabled: boolean;
  rssFreshnessEnabled: boolean;
  rssDefaultMaxAgeDays: number;
  rssFeeds: RssFeedConfig[];
  reportMode: TrendRadarReportMode;
  displayMode: TrendRadarDisplayMode;
  sortByPositionFirst: boolean;
  rankThreshold: number;
  maxNewsPerKeyword: number;
}): string {
  return [
    '# Hot monitor config.yaml generated by YClaw',
    'platforms:',
    `  enabled: ${input.hotCrawlEnabled}`,
    '  sources:',
    ...input.platformIds.map((platformId) =>
      [
        `    - id: "${escapeYamlString(platformId)}"`,
        `      name: "${escapeYamlString(platformId)}"`,
        '      enabled: true',
      ].join('\n'),
    ),
    '',
    'rss:',
    `  enabled: ${input.rssEnabled}`,
    '  freshness_filter:',
    `    enabled: ${input.rssFreshnessEnabled}`,
    `    max_age_days: ${input.rssDefaultMaxAgeDays}`,
    '  feeds:',
    ...(input.rssFeeds.length > 0
      ? input.rssFeeds.map((feed) =>
          [
            `    - id: "${escapeYamlString(feed.id)}"`,
            `      name: "${escapeYamlString(feed.name)}"`,
            `      url: "${escapeYamlString(feed.url)}"`,
            ...(feed.enabled ? [] : ['      enabled: false']),
            ...(feed.maxAgeDays ? [`      max_age_days: ${feed.maxAgeDays}`] : []),
          ].join('\n'),
        )
      : ['    []']),
    '',
    'report:',
    `  mode: "${input.reportMode}"`,
    `  display_mode: "${input.displayMode}"`,
    `  sort_by_position_first: ${input.sortByPositionFirst}`,
    `  rank_threshold: ${input.rankThreshold}`,
    `  max_news_per_keyword: ${input.maxNewsPerKeyword}`,
    '',
    'filter:',
    '  method: "keyword"',
    '',
    'display:',
    '  standalone:',
    '    platforms: []',
    '    rss_feeds: []',
    '    max_items: 20',
  ].join('\n');
}

function buildTrendRadarFrequencyText(
  globalExcludeWords: string,
  groups: KeywordGroupDraft[],
): string {
  const excludeLines = parseCsvList(globalExcludeWords);
  const groupLines = groups.flatMap((group) => {
    const include = parseCsvList(group.include);
    const required = parseCsvList(group.required);
    const exclude = parseCsvList(group.exclude);
    const lines: string[] = [];
    if (group.name.trim()) {
      lines.push(`[${group.name.trim()}]`);
    }
    lines.push(...include);
    lines.push(...required.map((item) => `+${item}`));
    lines.push(...exclude.map((item) => `!${item}`));
    const maxItems = Number.parseInt(group.maxItems, 10);
    if (Number.isFinite(maxItems) && maxItems > 0) {
      lines.push(`@${maxItems}`);
    }
    return [...lines, ''];
  });

  return [
    '# Hot monitor frequency_words.txt generated by YClaw',
    '[GLOBAL_FILTER]',
    ...(excludeLines.length > 0 ? excludeLines : ['']),
    '',
    '[WORD_GROUPS]',
    ...(groupLines.length > 0 ? groupLines : ['[默认关注]', 'AI', '']),
  ].join('\n');
}

function parseCsvList(value: string): string[] {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTrendRadarTimelineYaml(presets: HotTimelinePresetOption[]): string {
  const presetLines =
    presets.length > 0
      ? presets.flatMap((preset) => [
          `  ${preset.preset}:`,
          `    name: "${escapeYamlString(preset.label)}"`,
          '    periods:',
          ...preset.windows.map((windowItem, index) =>
            [
              `      period_${index + 1}:`,
              `        start: "${windowItem.start}"`,
              `        end: "${windowItem.end}"`,
              '        collect: true',
              '        report_mode: current',
            ].join('\n'),
          ),
        ])
      : [
          '  workday:',
          '    name: "工作日"',
          '    periods:',
          '      default:',
          '        start: "09:00"',
          '        end: "18:30"',
          '        collect: true',
          '        report_mode: current',
        ];

  return ['# Hot monitor timeline.yaml generated by YClaw', 'presets:', ...presetLines].join('\n');
}

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
