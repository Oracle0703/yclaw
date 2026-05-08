import { Button, Input, Space } from 'antd';
import type { HotReportSummary } from '@shared/types';

interface HotReportPanelProps {
  reports: HotReportSummary[];
  searchText?: string;
  maxItems?: number;
  showMoreLabel?: string;
  onSearchChange?: (value: string) => void;
  onPreview?: (report: HotReportSummary) => void;
  onReveal?: (report: HotReportSummary) => void;
  onDelete?: (report: HotReportSummary) => void;
  onShowMore?: () => void;
  formatTime?: (value?: string | null) => string;
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
  const visibleReports = typeof props.maxItems === 'number'
    ? reports.slice(0, props.maxItems)
    : reports;
  const hiddenCount = reports.length - visibleReports.length;

  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">报告</div>
      <Input
        className="browser-workspace-input"
        value={searchText}
        onChange={(event) => props.onSearchChange?.(event.target.value)}
        placeholder="搜索报告"
      />
      <div className="browser-workspace-list">
        {visibleReports.length === 0 ? (
          <div className="browser-workspace-action-description">暂无报告</div>
        ) : null}
        {visibleReports.map((report) => (
          <div key={report.id} className="browser-review-queue-card hot-report-row">
            <div className="hot-report-row-main">
              <div className="browser-workspace-action-title">{report.title}</div>
              <div className="browser-workspace-action-meta">
                {report.format} · {props.formatTime?.(report.createdAt) ?? report.createdAt}
              </div>
            </div>
            <Space wrap>
              <Button onClick={() => props.onPreview?.(report)}>
                预览报告
              </Button>
              <Button onClick={() => props.onReveal?.(report)}>
                打开存储位置
              </Button>
              <Button
                danger
                onClick={() => props.onDelete?.(report)}
              >
                删除报告
              </Button>
            </Space>
          </div>
        ))}
      </div>
      {hiddenCount > 0 && props.onShowMore ? (
        <Space wrap>
          <Button onClick={props.onShowMore}>
            {props.showMoreLabel ?? '查看更多报告'}
          </Button>
        </Space>
      ) : null}
    </section>
  );
}
