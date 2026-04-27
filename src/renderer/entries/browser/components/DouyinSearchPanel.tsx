import { Button } from 'antd';
import type { DouyinSearchItem } from '../douyin/types';

interface WorkspaceAction {
  key: string;
  title: string;
  description: string;
  reviewMode: string;
}

interface DouyinSearchPanelProps {
  summary: string;
  modes: string[];
  actions: WorkspaceAction[];
  keyword: string;
  results: DouyinSearchItem[];
  selectedId: string | null;
  onKeywordChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (item: DouyinSearchItem) => void;
  onOpenAction: (actionKey: string) => void;
}

export function DouyinSearchPanel(props: DouyinSearchPanelProps) {
  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-summary">{props.summary}</div>
      <div className="browser-platform-tile-tags">
        {props.modes.map((mode) => (
          <span key={mode} className="browser-platform-pill">
            {mode}
          </span>
        ))}
      </div>
      <div className="browser-workspace-actions">
        {props.actions.map((action) => (
          <div key={action.key} className="browser-workspace-action-card">
            <div className="browser-workspace-action-title">{action.title}</div>
            <div className="browser-workspace-action-description">{action.description}</div>
            <div className="browser-workspace-action-meta">{action.reviewMode}</div>
            <Button type="primary" onClick={() => props.onOpenAction(action.key)}>
              {action.title}
            </Button>
          </div>
        ))}
      </div>
      <div className="browser-workspace-section-title">搜索与样本池</div>
      <input
        className="browser-workspace-input"
        value={props.keyword}
        onChange={(event) => props.onKeywordChange(event.target.value)}
        placeholder="输入关键词或话题，先筛出要分析的视频"
      />
      <Button type="primary" onClick={props.onSearch}>
        搜索抖音内容
      </Button>
      <div className="browser-workspace-list">
        {props.results.length > 0 ? (
          props.results.map((item) => (
            <button
              key={item.id}
              type="button"
              className="browser-workspace-list-item"
              data-selected={props.selectedId === item.id}
              onClick={() => props.onSelect(item)}
            >
              <div className="browser-workspace-action-title">{item.title}</div>
              <div className="browser-workspace-action-meta">
                {item.authorName} · {item.publishLabel}
              </div>
              <div className="browser-workspace-action-description">{item.metricsSummary}</div>
            </button>
          ))
        ) : (
          <div className="browser-workspace-empty">先输入关键词，再从结果里选一个视频进入分析。</div>
        )}
      </div>
    </section>
  );
}
