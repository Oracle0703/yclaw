import type { HotSource, HotSourceDraft } from '@shared/types';

interface HotSourcePanelProps {
  draft: HotSourceDraft;
  sources: HotSource[];
  selectedSourceId: string | null;
  editingSourceId: string | null;
  onDraftChange: <Field extends keyof HotSourceDraft>(
    field: Field,
    value: HotSourceDraft[Field],
  ) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onCancelEdit: () => void;
  onSelect: (sourceId: string) => void;
  onLoadDetail: (sourceId: string) => void;
  onStartRun: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
}

export function HotSourcePanel(props: HotSourcePanelProps) {
  const isEditing = props.editingSourceId !== null;

  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">HOT采集源</div>
      <input
        className="browser-workspace-input"
        value={props.draft.name}
        onChange={(event) => props.onDraftChange('name', event.target.value)}
        placeholder="采集源名称"
      />
      <input
        className="browser-workspace-input"
        value={props.draft.siteKey}
        onChange={(event) => props.onDraftChange('siteKey', event.target.value)}
        placeholder="站点标识，如 douyin / weibo"
      />
      <input
        className="browser-workspace-input"
        value={props.draft.entryUrl}
        onChange={(event) => props.onDraftChange('entryUrl', event.target.value)}
        placeholder="入口 URL"
      />
      <input
        className="browser-workspace-input"
        value={props.draft.parserKey}
        onChange={(event) => props.onDraftChange('parserKey', event.target.value)}
        placeholder="解析器标识，如 douyin.hot"
      />
      <div className="browser-review-queue-actions">
        <button
          type="button"
          className="browser-hot-primary"
          onClick={isEditing ? props.onUpdate : props.onCreate}
        >
          {isEditing ? '保存修改' : '创建HOT采集源'}
        </button>
        {isEditing ? (
          <button type="button" onClick={props.onCancelEdit}>
            取消编辑
          </button>
        ) : null}
      </div>

      <div className="browser-workspace-list">
        {props.sources.map((source) => (
          <div
            key={source.id}
            className="browser-review-queue-card"
            data-selected={props.selectedSourceId === source.id}
          >
            <div className="browser-workspace-action-title">{source.name}</div>
            <div className="browser-workspace-action-meta">
              {source.sourceKind} · {source.siteKey}
            </div>
            <div className="browser-workspace-action-description">{source.entryUrl}</div>
            <div className="browser-review-queue-actions">
              <button type="button" onClick={() => props.onLoadDetail(source.id)}>
                加载详情
              </button>
              <button type="button" onClick={() => props.onSelect(source.id)}>
                查看运行
              </button>
              <button type="button" onClick={() => props.onStartRun(source.id)}>
                立即运行
              </button>
              <button type="button" onClick={() => props.onDelete(source.id)}>
                删除采集源
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
