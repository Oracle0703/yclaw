import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { shell } from 'electron';
import type {
  CommentItem,
  CommentReportFormat,
  CommentReportSummary,
  ExtractionResult,
} from '@shared/types';
import type { BatchService } from '../BatchService';
import type { ResultService } from '../ResultService';
import type { CommentReportRepository } from '../repositories/CommentReportRepository';
import type { CommentSourceRepository } from '../repositories/CommentSourceRepository';

interface CommentReportServiceOptions {
  sourceRepository?: Pick<CommentSourceRepository, 'getSource'>;
  batchService?: Pick<BatchService, 'getBatch'>;
  resultService?: Pick<ResultService, 'listResults'>;
  reportRepository?: Pick<
    CommentReportRepository,
    'saveReport' | 'listReports' | 'getReport' | 'deleteReport'
  >;
  outputDir?: string;
  now?: () => Date;
  createId?: () => string;
  writeFile?: (filePath: string, content: string) => void;
  readFile?: (filePath: string) => string;
  unlinkFile?: (filePath: string) => void;
  revealFile?: (filePath: string) => void;
}

export class CommentReportService {
  private readonly sourceRepository: Pick<CommentSourceRepository, 'getSource'>;
  private readonly batchService: Pick<BatchService, 'getBatch'>;
  private readonly resultService: Pick<ResultService, 'listResults'>;
  private readonly reportRepository: Pick<
    CommentReportRepository,
    'saveReport' | 'listReports' | 'getReport' | 'deleteReport'
  >;
  private readonly outputDir: string;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly writeFile: (filePath: string, content: string) => void;
  private readonly readFile: (filePath: string) => string;
  private readonly unlinkFile: (filePath: string) => void;
  private readonly revealFile: (filePath: string) => void;

  constructor(options: CommentReportServiceOptions = {}) {
    if (!options.sourceRepository) throw new Error('sourceRepository is required');
    if (!options.batchService) throw new Error('batchService is required');
    if (!options.resultService) throw new Error('resultService is required');
    if (!options.reportRepository) throw new Error('reportRepository is required');

    this.sourceRepository = options.sourceRepository;
    this.batchService = options.batchService;
    this.resultService = options.resultService;
    this.reportRepository = options.reportRepository;
    this.outputDir = options.outputDir ?? path.join(os.tmpdir(), 'yclaw-comment-reports');
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => randomUUID());
    this.writeFile =
      options.writeFile ??
      ((filePath, content) => {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, 'utf8');
      });
    this.readFile = options.readFile ?? ((filePath) => fs.readFileSync(filePath, 'utf8'));
    this.unlinkFile =
      options.unlinkFile ??
      ((filePath) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    this.revealFile = options.revealFile ?? ((filePath) => shell.showItemInFolder(filePath));
  }

  listReports(query: { sourceId?: string; batchId?: string } = {}): CommentReportSummary[] {
    return this.reportRepository.listReports(query);
  }

  getReportDetail(reportId: string): CommentReportSummary | null {
    const report = this.reportRepository.getReport(reportId);
    if (!report) return null;
    return {
      ...report,
      content: this.readFile(report.filePath),
    };
  }

  generateReport(payload: {
    sourceId: string;
    batchId: string;
    format: CommentReportFormat;
  }): CommentReportSummary {
    const source = this.sourceRepository.getSource(payload.sourceId);
    if (!source) throw new Error(`Comment source "${payload.sourceId}" not found`);

    const batch = this.batchService.getBatch(payload.batchId);
    if (!batch || batch.taskId !== source.taskId) {
      throw new Error(`Comment batch "${payload.batchId}" not found`);
    }

    const reportId = this.createId();
    const createdAt = this.now().toISOString();
    const title = `${source.name} 评论洞察`;
    const results = this.resultService.listResults({ batchId: payload.batchId });
    const comments = results.map(toCommentItem).filter(Boolean) as CommentItem[];
    const content =
      payload.format === 'html'
        ? renderHtmlReport(title, source.name, comments, createdAt)
        : renderMarkdownReport(title, source.name, comments, createdAt);
    const filePath = path.join(this.outputDir, `${reportId}.${payload.format}`);
    this.writeFile(filePath, content);

    const report: CommentReportSummary = {
      id: reportId,
      sourceId: payload.sourceId,
      batchId: payload.batchId,
      title,
      format: payload.format,
      filePath,
      createdAt,
    };
    this.reportRepository.saveReport(report);
    return report;
  }

  deleteReport(reportId: string): { deleted: boolean } {
    const report = this.reportRepository.getReport(reportId);
    if (report) this.unlinkFile(report.filePath);
    return { deleted: this.reportRepository.deleteReport(reportId) };
  }

  revealReport(reportId: string): { revealed: boolean } {
    const report = this.reportRepository.getReport(reportId);
    if (!report) throw new Error(`Comment report "${reportId}" not found`);
    this.revealFile(report.filePath);
    return { revealed: true };
  }
}

function toCommentItem(result: ExtractionResult): CommentItem | null {
  const data = result.data;
  if (typeof data.commentId !== 'string' || typeof data.content !== 'string') return null;
  return {
    platform: data.platform === 'douyin' ? 'douyin' : 'xhs',
    sourceId: typeof data.sourceId === 'string' ? data.sourceId : undefined,
    contentId: typeof data.contentId === 'string' ? data.contentId : undefined,
    contentUrl: typeof data.contentUrl === 'string' ? data.contentUrl : result.sourceUrl,
    contentTitle: typeof data.contentTitle === 'string' ? data.contentTitle : undefined,
    commentId: data.commentId,
    parentCommentId: typeof data.parentCommentId === 'string' ? data.parentCommentId : null,
    content: data.content,
    authorId: typeof data.authorId === 'string' ? data.authorId : undefined,
    authorName: typeof data.authorName === 'string' ? data.authorName : undefined,
    avatar: typeof data.avatar === 'string' ? data.avatar : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : result.createdAt,
    likeCount: typeof data.likeCount === 'number' ? data.likeCount : undefined,
    ipLocation: typeof data.ipLocation === 'string' ? data.ipLocation : undefined,
    subCommentCount: typeof data.subCommentCount === 'number' ? data.subCommentCount : undefined,
  };
}

function renderMarkdownReport(
  title: string,
  sourceName: string,
  comments: CommentItem[],
  createdAt: string,
): string {
  const topComments = [...comments]
    .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
    .slice(0, 10);
  const keywords = extractKeywords(comments);
  return [
    `# ${title}`,
    '',
    `- 评论源：${sourceName}`,
    `- 生成时间：${createdAt}`,
    `- 评论总数：${comments.length}`,
    `- 高频词：${keywords.length > 0 ? keywords.join('、') : '暂无'}`,
    `- 风险提示：${buildRiskHint(comments)}`,
    '',
    '## 代表评论',
    '',
    ...(topComments.length > 0
      ? topComments.map(
          (comment, index) =>
            `${index + 1}. ${comment.authorName ?? '匿名'}：${comment.content}（赞 ${comment.likeCount ?? 0}）`,
        )
      : ['未采集到评论。']),
  ].join('\n');
}

function renderHtmlReport(
  title: string,
  sourceName: string,
  comments: CommentItem[],
  createdAt: string,
): string {
  const body = renderMarkdownReport(title, sourceName, comments, createdAt)
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>body{font-family:system-ui,sans-serif;max-width:960px;margin:32px auto;line-height:1.7;color:#172033}p{margin:8px 0}</style>
</head>
<body>${body}</body>
</html>`;
}

function extractKeywords(comments: CommentItem[]): string[] {
  const counts = new Map<string, number>();
  for (const comment of comments) {
    for (const word of comment.content.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/g) ?? []) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

function buildRiskHint(comments: CommentItem[]): string {
  if (comments.length === 0) return '未采集到评论，建议检查登录态或页面结构。';
  const riskWords = ['投诉', '骗人', '虚假', '维权', '退款'];
  const riskCount = comments.filter((comment) =>
    riskWords.some((word) => comment.content.includes(word)),
  ).length;
  return riskCount > 0
    ? `发现 ${riskCount} 条潜在风险评论，需要人工复核。`
    : '未发现明显风险词，仍建议人工抽检高赞评论。';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
