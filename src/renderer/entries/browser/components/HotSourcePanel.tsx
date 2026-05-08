import { Button, Input, Space } from 'antd';
import type { HotSource, HotSourceDraft } from '@shared/types';

interface HotSourcePanelProps {
  draft: HotSourceDraft;
  sources: HotSource[];
  selectedSourceId: string | null;
  editingSourceId: string | null;
  maxItems?: number;
  showEditor?: boolean;
  showMoreLabel?: string;
  sectionTitle?: string;
  createLabel?: string;
  onDraftChange: <Field extends keyof HotSourceDraft>(
    field: Field,
    value: HotSourceDraft[Field],
  ) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onSaveAsNew?: () => void;
  onCancelEdit: () => void;
  onSelect: (sourceId: string) => void;
  onLoadDetail: (sourceId: string) => void;
  onStartRun: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
  onShowMore?: () => void;
  formatTime?: (value?: string | null) => string;
}

export function HotSourcePanel(props: HotSourcePanelProps) {
  const isEditing = props.editingSourceId !== null;
  const keywords = props.draft.filter?.keywordGroups?.[0]?.include?.join(',') ?? '';
  const excludes = props.draft.filter?.excludeKeywords?.join(',') ?? '';
  const visibleSources = typeof props.maxItems === 'number'
    ? props.sources.slice(0, props.maxItems)
    : props.sources;
  const hiddenCount = props.sources.length - visibleSources.length;

  const updateKeywordFilter = (nextKeywords: string, nextExcludes: string) => {
    const include = splitCsv(nextKeywords);
    const exclude = splitCsv(nextExcludes);
    props.onDraftChange('filter', {
      keywordGroups: include.length > 0
        ? [{ name: '默认关键词', include, exclude }]
        : [],
      excludeKeywords: exclude,
    });
  };

  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">{props.sectionTitle ?? '采集源'}</div>
      {props.showEditor !== false ? (
        <>
          <Input
            className="browser-workspace-input"
            value={props.draft.name}
            onChange={(event) => props.onDraftChange('name', event.target.value)}
            placeholder="采集源名称"
          />
          <Input
            className="browser-workspace-input"
            value={props.draft.siteKey}
            onChange={(event) => props.onDraftChange('siteKey', event.target.value)}
            placeholder="站点标识，如 douyin / weibo"
          />
          <Input
            className="browser-workspace-input"
            value={props.draft.entryUrl}
            onChange={(event) => props.onDraftChange('entryUrl', event.target.value)}
            placeholder="入口 URL"
          />
          <Input
            className="browser-workspace-input"
            value={props.draft.parserKey}
            onChange={(event) => props.onDraftChange('parserKey', event.target.value)}
            placeholder="解析器标识，如 douyin.hot"
          />
          <Input
            className="browser-workspace-input"
            value={keywords}
            onChange={(event) => updateKeywordFilter(event.target.value, excludes)}
            placeholder="关键词，逗号分隔"
          />
          <Input
            className="browser-workspace-input"
            value={excludes}
            onChange={(event) => updateKeywordFilter(keywords, event.target.value)}
            placeholder="过滤词，逗号分隔"
          />
          <Space wrap>
            <Button type="primary" onClick={isEditing ? props.onUpdate : props.onCreate}>
              {isEditing ? '保存修改' : props.createLabel ?? '创建HOT采集源'}
            </Button>
            {isEditing ? (
              props.onSaveAsNew ? (
                <Button onClick={props.onSaveAsNew}>
                  另存为新任务
                </Button>
              ) : null
            ) : null}
            {isEditing ? (
              <Button onClick={props.onCancelEdit}>
                取消编辑
              </Button>
            ) : null}
          </Space>
        </>
      ) : null}
      {props.showEditor === false && props.sources.length === 0 ? (
        <div className="browser-workspace-action-description">暂无采集源</div>
      ) : null}
      <div className="browser-workspace-list">
        {visibleSources.map((source) => (
          <div
            key={source.id}
            className="browser-review-queue-card"
            data-selected={props.selectedSourceId === source.id}
          >
            <div className="browser-workspace-action-title">{source.name}</div>
            <div className="browser-workspace-action-meta">
              {source.sourceKind} · {source.siteKey} · {props.formatTime?.(source.updatedAt) ?? source.updatedAt}
            </div>
            <div className="browser-workspace-action-meta">
              {formatHotSourceConfigSummary(source)}
            </div>
            <div className="browser-workspace-action-description">{source.entryUrl}</div>
            <Space wrap>
              <Button onClick={() => props.onLoadDetail(source.id)}>
                加载详情
              </Button>
              <Button onClick={() => props.onSelect(source.id)}>
                查看运行
              </Button>
              <Button onClick={() => props.onStartRun(source.id)}>
                立即运行
              </Button>
              <Button
                danger
                onClick={() => props.onDelete(source.id)}
              >
                删除采集源
              </Button>
            </Space>
          </div>
        ))}
      </div>
      {hiddenCount > 0 && props.onShowMore ? (
        <Space wrap>
          <Button onClick={props.onShowMore}>
            {props.showMoreLabel ?? '查看更多采集源'}
          </Button>
        </Space>
      ) : null}
    </section>
  );
}

export function formatHotSourceConfigSummary(source: HotSource): string {
  const sourceScope = getSourceScope(source);
  const schedule = formatSourceSchedule(source);
  const status = source.enabled ? '已启用' : '已停用';
  return `${sourceScope} · ${schedule} · ${status}`;
}

function getSourceScope(source: HotSource): string {
  if (source.sourceKind === 'rss' || source.parserKey === 'rss.feed') {
    return 'RSS订阅';
  }

  if (source.parserKey === 'newsnow.batch') {
    const platformCount = source.platformIds?.length ?? 0;
    return platformCount > 0 ? `${platformCount}个平台` : '多平台热榜';
  }

  return source.siteKey || source.sourceKind;
}

function formatSourceSchedule(source: HotSource): string {
  if (source.schedule?.type === 'cron' && 'cron' in source.schedule && source.schedule.cron) {
    return `定时 ${source.schedule.cron}`;
  }

  return '手动运行';
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
