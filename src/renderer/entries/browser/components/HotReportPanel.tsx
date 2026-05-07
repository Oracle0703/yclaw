import type { HotReportSummary } from '@shared/types';

interface HotReportPanelProps {
  reports: HotReportSummary[];
  searchText?: string;
  previewReport?: HotReportSummary | null;
  onSearchChange?: (value: string) => void;
  onPreview?: (report: HotReportSummary) => void;
  onOpen?: (report: HotReportSummary) => void;
}

export function HotReportPanel(props: HotReportPanelProps) {
  const searchText = props.searchText ?? '';
  const reports = props.reports.filter((report) => {
    if (!searchText.trim()) {
      return true;
    }
    const keyword = searchText.trim().toLowerCase();
    return `${report.title} ${report.filePath}`.toLowerCase().includes(keyword);
  });

  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">HOT报告</div>
      <input
        className="browser-workspace-input"
        value={searchText}
        onChange={(event) => props.onSearchChange?.(event.target.value)}
        placeholder="搜索报告"
      />
      <div className="browser-workspace-list">
        {reports.map((report) => (
          <div key={report.id} className="browser-review-queue-card">
            <div className="browser-workspace-action-title">{report.title}</div>
            <div className="browser-workspace-action-meta">
              {report.format} · {report.createdAt}
            </div>
            <div className="browser-workspace-action-description">{report.filePath}</div>
            <div className="browser-review-queue-actions">
              <button type="button" onClick={() => props.onPreview?.(report)}>
                预览报告
              </button>
              <button type="button" onClick={() => props.onOpen?.(report)}>
                打开报告
              </button>
            </div>
          </div>
        ))}
      </div>
      {props.previewReport?.content ? (
        <div className="browser-review-queue-card">
          <div className="browser-workspace-section-title">报告预览</div>
          <div className="browser-workspace-action-description">
            {props.previewReport.content.split('\n').map((line, index) => (
              <div key={`${index}-${line}`}>{line || ' '}</div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
