import { Button } from 'antd';
import type { DouyinCommentInsight } from '../douyin/types';

interface QueueListItem {
  id: string;
  title: string;
  status: 'pending' | 'ready' | 'archived';
  createdAtLabel: string;
  note: string;
  linkedTaskId?: string | null;
  linkedTaskName?: string | null;
}

interface DouyinInsightPanelProps {
  insight: DouyinCommentInsight | null;
  draftModeLabel: string;
  draftPending: boolean;
  draftTone: '专业' | '友好' | '转化';
  workspaceNote: string;
  commentStarters: string[];
  generatedDrafts: string[];
  manualActions: string[];
  guardrails: string[];
  queueItems: QueueListItem[];
  onToneChange: (value: '专业' | '友好' | '转化') => void;
  onNoteChange: (value: string) => void;
  onGenerateDraft: () => void;
  onApplyStarter: (value: string) => void;
  onApplyDraft: (value: string) => void;
  onQueueAction: (title: string) => void;
  onWriteQueueNote: (value: string) => void;
  onUpdateQueueStatus: (id: string, status: QueueListItem['status']) => void;
  onLinkQueueItemTask: (id: string) => void;
  onOpenAutomationWorkspace: () => void;
}

export function DouyinInsightPanel(props: DouyinInsightPanelProps) {
  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">评论草稿助手</div>
      <div className="browser-workspace-summary">
        {props.insight?.summary ?? '先选择视频，再生成评论分析。'}
      </div>
      <div className="browser-workspace-action-meta">
        当前来源：{props.draftModeLabel} {props.draftPending ? '· 生成中' : ''}
      </div>
      <div className="browser-workspace-list">
        {(props.insight?.keywords ?? []).map((item) => (
          <div key={item} className="browser-workspace-list-item">
            {item}
          </div>
        ))}
      </div>
      <select
        className="browser-workspace-select"
        value={props.draftTone}
        onChange={(event) => {
          props.onToneChange(event.target.value as '专业' | '友好' | '转化');
        }}
        aria-label="评论草稿语气"
      >
        <option value="专业">专业</option>
        <option value="友好">友好</option>
        <option value="转化">转化</option>
      </select>
      <Button type="primary" onClick={props.onGenerateDraft}>
        {props.draftPending ? '生成中...' : '生成评论草稿'}
      </Button>
      <div className="browser-workspace-draft-list">
        {props.commentStarters.map((starter) => (
          <button
            key={starter}
            type="button"
            className="browser-draft-button"
            onClick={() => props.onApplyStarter(starter)}
          >
            {starter}
          </button>
        ))}
      </div>
      {props.generatedDrafts.length > 0 && (
        <div className="browser-workspace-list">
          {props.generatedDrafts.map((draft) => (
            <button
              key={draft}
              type="button"
              className="browser-workspace-list-item"
              onClick={() => props.onApplyDraft(draft)}
            >
              {draft}
            </button>
          ))}
        </div>
      )}
      <textarea
        className="browser-workspace-notes"
        value={props.workspaceNote}
        onChange={(event) => props.onNoteChange(event.target.value)}
        placeholder="这里记录当前视频的评论草稿、判断依据和人工复核备注。"
      />
      <div className="browser-workspace-section-title">人工确认动作</div>
      <div className="browser-workspace-list">
        {props.manualActions.map((item) => (
          <button
            key={item}
            type="button"
            className="browser-workspace-list-item"
            onClick={() => props.onQueueAction(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="browser-workspace-section-title">待复核队列</div>
      <div className="browser-workspace-list">
        {props.queueItems.length > 0 ? (
          props.queueItems.map((item) => (
            <div key={item.id} className="browser-review-queue-card">
              <div className="browser-review-queue-title">
                <span>{item.title}</span>
                <span className={`browser-review-status is-${item.status}`}>
                  {item.status === 'pending'
                    ? '待复核'
                    : item.status === 'ready'
                      ? '可执行'
                      : '已归档'}
                </span>
              </div>
              <div className="browser-workspace-action-meta">{item.createdAtLabel}</div>
              <div className="browser-workspace-action-description">{item.note}</div>
              {item.linkedTaskId ? (
                <div className="browser-workspace-action-meta">
                  已建任务：{item.linkedTaskName ?? item.linkedTaskId}
                </div>
              ) : null}
              <div className="browser-review-queue-actions">
                <Button onClick={() => props.onWriteQueueNote(item.note)}>写入备注</Button>
                <Button onClick={() => props.onUpdateQueueStatus(item.id, 'ready')}>
                  标记可执行
                </Button>
                {item.status === 'ready' && !item.linkedTaskId ? (
                  <Button onClick={() => props.onLinkQueueItemTask(item.id)}>生成执行任务</Button>
                ) : null}
                {item.linkedTaskId ? (
                  <Button onClick={props.onOpenAutomationWorkspace}>打开自动化页</Button>
                ) : null}
                <Button onClick={() => props.onUpdateQueueStatus(item.id, 'archived')}>
                  归档
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="browser-workspace-empty">
            还没有待复核动作，点击上面的动作项即可加入队列。
          </div>
        )}
      </div>
      <div className="browser-workspace-section-title">边界说明</div>
      <div className="browser-workspace-list">
        {props.guardrails.map((item) => (
          <div key={item} className="browser-workspace-guardrail">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
