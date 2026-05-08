import { Button, Tag } from 'antd';
import type {
  DouyinAnalysisTarget,
  DouyinDownloadRecord,
  DouyinDownloadRequest,
} from '../douyin/types';

interface DouyinTargetPanelProps {
  target: DouyinAnalysisTarget | null;
  downloadRequest: DouyinDownloadRequest | null;
  downloadRecord: DouyinDownloadRecord | null;
  downloadAuthorizationChecked: boolean;
  onToggleAuthorization: (checked: boolean) => void;
  onApplyDownload: () => void;
  onStartDownload: () => void;
  onMarkDownloadDone: () => void;
}

export function DouyinTargetPanel(props: DouyinTargetPanelProps) {
  if (!props.target) {
    return (
      <section className="browser-workspace-section">
        <div className="browser-workspace-empty">先从左侧选择一个抖音样本。</div>
      </section>
    );
  }

  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">当前分析对象</div>
      <div className="browser-workspace-action-title">{props.target.item.title}</div>
      <div className="browser-workspace-action-meta">{props.target.item.authorName}</div>
      <div className="browser-workspace-action-description">{props.target.item.url}</div>
      <div className="browser-platform-tile-tags">
        {props.target.topicTags.map((tag) => (
          <span key={tag} className="browser-platform-pill">
            {tag}
          </span>
        ))}
      </div>
      <Tag color={props.target.captureStatus === 'ready' ? 'success' : 'processing'}>
        {props.target.captureStatus === 'ready' ? '已采集评论样本' : '待进入页面'}
      </Tag>
      <div className="browser-workspace-list">
        {props.target.commentSamples.map((sample) => (
          <div key={sample} className="browser-workspace-guardrail">
            {sample}
          </div>
        ))}
      </div>
      <Button onClick={props.onApplyDownload}>申请授权下载</Button>
      {(props.downloadRequest?.status === 'confirming' ||
        props.downloadRequest?.status === 'ready') && (
        <label className="browser-download-confirm">
          <input
            aria-label="我确认这是自有内容或已授权内容"
            type="checkbox"
            checked={props.downloadAuthorizationChecked}
            onChange={(event) => props.onToggleAuthorization(event.target.checked)}
          />
          我确认这是自有内容或已授权内容
        </label>
      )}
      {props.downloadRequest?.status === 'ready' && (
        <Button type="primary" onClick={props.onStartDownload}>
          开始下载
        </Button>
      )}
      {props.downloadRequest?.status === 'downloading' && (
        <Button onClick={props.onMarkDownloadDone}>标记已完成下载归档</Button>
      )}
      {props.downloadRecord && (
        <div className="browser-download-record">
          <div className="browser-workspace-action-title">
            下载状态：{props.downloadRecord.status === 'done' ? '已完成' : '下载中'}
          </div>
          <div className="browser-workspace-action-meta">
            来源链接：{props.downloadRecord.sourceUrl}
          </div>
          <div className="browser-workspace-action-meta">
            确认时间：{props.downloadRecord.confirmedAt}
          </div>
        </div>
      )}
    </section>
  );
}
