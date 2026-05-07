import type { HotRunDetail, HotRunSummary } from '@shared/types';

interface HotRunPanelProps {
  runs: HotRunSummary[];
  selectedBatchId: string | null;
  detail: HotRunDetail | null;
  onViewDetail: (run: HotRunSummary) => void;
  onRerun: (run: HotRunSummary) => void;
  onGenerateReport: (run: HotRunSummary) => void;
}

export function HotRunPanel(props: HotRunPanelProps) {
  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">最近运行</div>
      <div className="browser-workspace-list">
        {props.runs.length === 0 ? (
          <div className="browser-workspace-action-description">暂无运行记录</div>
        ) : null}
        {props.runs.map((run) => (
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
              批次：{run.batchId}
            </div>
            <div className="browser-review-queue-actions">
              <button type="button" onClick={() => props.onViewDetail(run)}>
                查看详情
              </button>
              <button type="button" onClick={() => props.onRerun(run)}>
                重新运行
              </button>
              <button type="button" onClick={() => props.onGenerateReport(run)}>
                生成报告
              </button>
            </div>
          </div>
        ))}
      </div>
      {props.detail ? (
        <div className="browser-review-queue-card">
          <div className="browser-workspace-section-title">运行详情</div>
          <div className="browser-workspace-action-meta">
            状态：{props.detail.status} · 任务：{props.detail.taskId}
          </div>
          <div className="browser-workspace-action-description">
            开始：{props.detail.startedAt ?? '未知'}
          </div>
          <div className="browser-workspace-action-description">
            结束：{props.detail.finishedAt ?? '未知'}
          </div>
          <div className="browser-workspace-action-description">
            步骤结果 {props.detail.stepResults.length} 条
          </div>
          <div className="browser-workspace-action-description">
            关联结果 {props.detail.linkedResultIds.length} 条
          </div>
          <div className="browser-workspace-action-description">
            失败定位：{formatBreakpoint(props.detail.breakpoint)}
          </div>
          <div className="browser-workspace-action-description">
            断点错误：{props.detail.breakpoint?.error ?? '无'}
          </div>
          <div className="browser-workspace-action-description">
            错误：{props.detail.error ?? '无'}
          </div>
          <div className="browser-workspace-list">
            {props.detail.stepResults.map((step) => (
              <div key={step.stepId} className="browser-workspace-action-card">
                <div className="browser-workspace-action-title">
                  {step.stepId} · {step.success ? '成功' : '失败'} · {step.duration}ms
                </div>
                <div className="browser-workspace-action-description">
                  {step.error ?? '无错误'}
                </div>
                <div className="browser-workspace-action-description">
                  开始：{step.startedAt ?? '未知'}
                </div>
                <div className="browser-workspace-action-description">
                  结束：{step.finishedAt ?? '未知'}
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
      ) : null}
    </section>
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
