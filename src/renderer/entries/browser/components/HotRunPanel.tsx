import { Button, Space } from 'antd';
import type { HotRunDetail, HotRunSummary } from '@shared/types';

interface HotRunPanelProps {
  runs: HotRunSummary[];
  selectedBatchId: string | null;
  maxItems?: number;
  showMoreLabel?: string;
  onViewDetail: (run: HotRunSummary) => void;
  onRerun: (run: HotRunSummary) => void;
  onGenerateReport: (run: HotRunSummary) => void;
  onShowMore?: () => void;
  formatTime?: (value?: string | null) => string;
}

export function HotRunPanel(props: HotRunPanelProps) {
  const visibleRuns = typeof props.maxItems === 'number'
    ? props.runs.slice(0, props.maxItems)
    : props.runs;
  const hiddenCount = props.runs.length - visibleRuns.length;

  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">任务</div>
      <div className="browser-workspace-list">
        {props.runs.length === 0 ? (
          <div className="browser-workspace-action-description">暂无运行记录</div>
        ) : null}
        {visibleRuns.map((run) => (
          <div
            key={run.batchId}
            className="browser-review-queue-card"
            data-selected={props.selectedBatchId === run.batchId}
          >
            <div className="browser-workspace-action-title">{run.sourceName}</div>
            <div className="browser-workspace-action-meta">
              {run.status} · 结果 {run.resultCount} 条
            </div>
            <div className="browser-workspace-action-description">
              结束：{props.formatTime?.(run.finishedAt) ?? run.finishedAt ?? '未知'}
            </div>
            <Space wrap>
              {run.status === 'failed' ? (
                <Button onClick={() => props.onViewDetail(run)}>
                  查看详情
                </Button>
              ) : null}
              {run.status === 'failed' || run.status === 'success' ? (
                <Button onClick={() => props.onRerun(run)}>
                  重新运行
                </Button>
              ) : null}
              {run.status === 'success' ? (
                <Button onClick={() => props.onGenerateReport(run)}>
                  生成报告
                </Button>
              ) : null}
            </Space>
          </div>
        ))}
      </div>
      {hiddenCount > 0 && props.onShowMore ? (
        <Space wrap>
          <Button onClick={props.onShowMore}>
            {props.showMoreLabel ?? '查看更多任务'}
          </Button>
        </Space>
      ) : null}
    </section>
  );
}

export function HotRunDetailView({
  detail,
  formatTime,
}: {
  detail: HotRunDetail;
  formatTime?: (value?: string | null) => string;
}) {
  return (
    <div className="hot-run-detail-modal">
      <div className="browser-review-queue-card">
        <div className="browser-workspace-action-meta">
          状态：{detail.status} · 任务：{detail.taskId}
        </div>
        <div className="browser-workspace-action-description">
          开始：{formatTime?.(detail.startedAt) ?? detail.startedAt ?? '未知'}
        </div>
        <div className="browser-workspace-action-description">
          结束：{formatTime?.(detail.finishedAt) ?? detail.finishedAt ?? '未知'}
        </div>
        <div className="browser-workspace-action-description">
          步骤结果 {detail.stepResults.length} 条
        </div>
        <div className="browser-workspace-action-description">
          关联结果 {detail.linkedResultIds.length} 条
        </div>
        <div className="browser-workspace-action-description">
          失败定位：{formatBreakpoint(detail.breakpoint)}
        </div>
        <div className="browser-workspace-action-description">
          断点错误：{detail.breakpoint?.error ?? '无'}
        </div>
        <div className="browser-workspace-action-description">
          错误：{detail.error ?? '无'}
        </div>
      </div>
      <div className="browser-workspace-list">
        {detail.stepResults.map((step) => (
          <div key={step.stepId} className="browser-workspace-action-card">
            <div className="browser-workspace-action-title">
              {step.stepId} · {step.success ? '成功' : '失败'} · {step.duration}ms
            </div>
            <div className="browser-workspace-action-description">
              {step.error ?? '无错误'}
            </div>
            <div className="browser-workspace-action-description">
              开始：{formatTime?.(step.startedAt) ?? step.startedAt ?? '未知'}
            </div>
            <div className="browser-workspace-action-description">
              结束：{formatTime?.(step.finishedAt) ?? step.finishedAt ?? '未知'}
            </div>
            <div className="browser-workspace-action-description">
              截图：{step.screenshot ?? '无'}
            </div>
            <div className="browser-workspace-action-description">
              DOM快照：{step.domSnapshot ?? '无'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBreakpoint(
  breakpoint: HotRunDetail['breakpoint'],
): string {
  if (!breakpoint) {
    return '无';
  }

  return `第 ${breakpoint.stepIndex + 1} 步`;
}
