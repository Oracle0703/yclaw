import type { HotReportSummary } from '@shared/types';

interface HotReportPanelProps {
  reports: HotReportSummary[];
}

export function HotReportPanel(props: HotReportPanelProps) {
  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">HOT报告</div>
      <div className="browser-workspace-list">
        {props.reports.map((report) => (
          <div key={report.id} className="browser-review-queue-card">
            <div className="browser-workspace-action-title">{report.title}</div>
            <div className="browser-workspace-action-meta">
              {report.format} · {report.createdAt}
            </div>
            <div className="browser-workspace-action-description">{report.filePath}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
