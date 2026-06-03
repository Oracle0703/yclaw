import { Alert, Button, Space, Statistic, Tag } from 'antd';
import type { HotRunSummary, TaskReviewRecord } from '@shared/types';
import type { VerificationQualitySummary } from '../verification';

export type ReviewVerificationStatus =
  | 'idle'
  | 'running'
  | 'scanning'
  | 'succeeded'
  | 'failed';

export interface ReviewVerificationState {
  status: ReviewVerificationStatus;
  message?: string;
  run?: HotRunSummary | null;
  quality?: VerificationQualitySummary | null;
}

export function ReviewVerificationPanel({
  review,
  state,
  canVerify,
  onVerify,
  onOpenBatchResults,
}: {
  review: TaskReviewRecord;
  state: ReviewVerificationState;
  canVerify: boolean;
  onVerify: (review: TaskReviewRecord) => void;
  onOpenBatchResults: (batchId: string) => void;
}) {
  const busy = state.status === 'running' || state.status === 'scanning';
  const run = state.run ?? null;
  const quality = state.quality ?? null;

  return (
    <div className="hot-monitor-review-verification">
      <div className="browser-workspace-section-title">回流验证</div>
      <Space wrap>
        <Tag>{statusLabelOf(state.status)}</Tag>
        <Button
          type="primary"
          disabled={!canVerify || busy}
          loading={busy}
          onClick={() => onVerify(review)}
        >
          验证重跑并扫描新批次
        </Button>
      </Space>
      {state.message && state.status !== 'failed' ? (
        <div className="browser-workspace-action-description">{state.message}</div>
      ) : null}
      {state.status === 'failed' && state.message ? (
        <Alert type="error" showIcon message={state.message} />
      ) : null}
      {run ? (
        <div className="browser-workspace-action-card">
          <div className="browser-workspace-action-title">新批次：{run.batchId}</div>
          <Space size="large" wrap>
            <Statistic title="运行状态" value={formatRunStatus(run.status)} />
            <Statistic title="结果数量" value={run.resultCount} />
            <Statistic title="报告状态" value={formatReportStatus(run.reportStatus)} />
          </Space>
          <Button onClick={() => onOpenBatchResults(run.batchId)}>
            查看新批次结果中心
          </Button>
        </div>
      ) : null}
      {quality ? (
        <div className="browser-workspace-action-card">
          <div className="browser-workspace-action-title">质量扫描摘要</div>
          <Space size="large" wrap>
            <Statistic title="质量分" value={quality.scoreLabel} />
            <Statistic title="等级" value={quality.gradeLabel} />
            <Statistic title="质量问题" value={quality.issueCount} />
            <Statistic title="影响结果" value={quality.affectedResults} />
          </Space>
          <div className="browser-workspace-action-description">{quality.summary}</div>
          {quality.topRules.map((rule) => (
            <Tag key={rule.ruleId}>
              {rule.ruleId}：{rule.count}
            </Tag>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function statusLabelOf(status: ReviewVerificationStatus): string {
  if (status === 'running') {
    return '等待新批次完成';
  }
  if (status === 'scanning') {
    return '扫描新批次质量';
  }
  if (status === 'succeeded') {
    return '验证完成';
  }
  if (status === 'failed') {
    return '验证失败';
  }
  return '尚未验证';
}

function formatRunStatus(status: string): string {
  if (status === 'success') {
    return '成功';
  }
  if (status === 'failed') {
    return '失败';
  }
  if (status === 'running') {
    return '运行中';
  }
  return status || '-';
}

function formatReportStatus(status: HotRunSummary['reportStatus']): string {
  if (status === 'generated') {
    return '已生成';
  }
  if (status === 'pending') {
    return '待生成';
  }
  return status || '-';
}
