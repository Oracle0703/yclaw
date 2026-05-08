import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { HotReportFormat, HotReportSummary } from '@shared/types';
import type { BatchService } from '../BatchService';
import type { ExecutionLogService } from '../ExecutionLogService';
import type { ResultService } from '../ResultService';
import type { HotReportRepository } from '../repositories/HotReportRepository';
import type { HotSourceRepository } from '../repositories/HotSourceRepository';
import { HotFilterService } from './HotFilterService';
import type { TrendRadarProfile } from './TrendRadarConfigService';
import { formatSnapshotParts, renderTrendRadarHtml } from './HotTrendRadarHtmlRenderer';

interface HotReportServiceOptions {
  sourceRepository?: Pick<HotSourceRepository, 'getSource'>;
  batchService?: Pick<BatchService, 'getBatch'>;
  resultService?: Pick<ResultService, 'listResults'>;
  executionLogService?: Pick<ExecutionLogService, 'query'>;
  reportRepository?: Pick<HotReportRepository, 'saveReport' | 'listReports' | 'getReport' | 'getReportByBatchId' | 'deleteReport'>;
  outputDir?: string;
  writeFile?: (filePath: string, content: string) => void;
  readFile?: (filePath: string) => string;
  unlinkFile?: (filePath: string) => void;
  revealFile?: (filePath: string) => void;
  now?: () => Date;
  createId?: () => string;
  trendRadarConfigService?: {
    loadProfile(): TrendRadarProfile | null;
  };
}

export class HotReportService {
  private readonly sourceRepository: Pick<HotSourceRepository, 'getSource'>;
  private readonly batchService: Pick<BatchService, 'getBatch'>;
  private readonly resultService: Pick<ResultService, 'listResults'>;
  private readonly executionLogService: Pick<ExecutionLogService, 'query'>;
  private readonly reportRepository: Pick<HotReportRepository, 'saveReport' | 'listReports' | 'getReport' | 'getReportByBatchId' | 'deleteReport'>;
  private readonly outputDir: string;
  private readonly writeFile: (filePath: string, content: string) => void;
  private readonly readFile: (filePath: string) => string;
  private readonly unlinkFile: (filePath: string) => void;
  private readonly revealFile: (filePath: string) => void;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly trendRadarConfigService?: {
    loadProfile(): TrendRadarProfile | null;
  };

  constructor(options: HotReportServiceOptions = {}) {
    if (!options.sourceRepository) {
      throw new Error('sourceRepository is required');
    }
    if (!options.batchService) {
      throw new Error('batchService is required');
    }
    if (!options.resultService) {
      throw new Error('resultService is required');
    }
    if (!options.executionLogService) {
      throw new Error('executionLogService is required');
    }
    if (!options.reportRepository) {
      throw new Error('reportRepository is required');
    }

    this.sourceRepository = options.sourceRepository;
    this.batchService = options.batchService;
    this.resultService = options.resultService;
    this.executionLogService = options.executionLogService;
    this.reportRepository = options.reportRepository;
    this.outputDir = options.outputDir ?? path.join(process.cwd(), 'outputs', 'hot-reports');
    this.writeFile = options.writeFile ?? ((filePath, content) => fs.writeFileSync(filePath, content, 'utf8'));
    this.readFile = options.readFile ?? ((filePath) => fs.readFileSync(filePath, 'utf8'));
    this.unlinkFile = options.unlinkFile ?? ((filePath) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    this.revealFile = options.revealFile ?? (() => {
      throw new Error('revealFile is required');
    });
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => randomUUID());
    this.trendRadarConfigService = options.trendRadarConfigService;
  }

  listReports(query: { sourceId?: string; batchId?: string } = {}): HotReportSummary[] {
    return this.reportRepository.listReports(query);
  }

  getReportDetail(reportId: string): HotReportSummary | null {
    const report = this.reportRepository.getReport(reportId);
    if (!report) {
      return null;
    }

    try {
      return {
        ...report,
        content: this.readFile(report.filePath),
      };
    } catch {
      return report;
    }
  }

  deleteReport(reportId: string): { deleted: boolean } {
    const report = this.reportRepository.getReport(reportId);
    if (!report) {
      return { deleted: false };
    }

    try {
      this.unlinkFile(report.filePath);
    } catch {
      // 文件删除失败不阻断元数据清理，避免失效路径导致报告列表无法整理。
    }

    return { deleted: this.reportRepository.deleteReport(reportId) };
  }

  revealReport(reportId: string): { revealed: boolean } {
    const report = this.reportRepository.getReport(reportId);
    if (!report) {
      return { revealed: false };
    }

    this.revealFile(report.filePath);
    return { revealed: true };
  }

  generateReport(input: { sourceId: string; batchId: string; format: HotReportFormat }): HotReportSummary {
    if (input.format !== 'md' && input.format !== 'html') {
      throw new Error(`Unsupported hot report format: ${input.format}`);
    }

    const source = this.sourceRepository.getSource(input.sourceId);
    if (!source) {
      throw new Error(`Hot source "${input.sourceId}" not found`);
    }

    const batch = this.batchService.getBatch(input.batchId);
    if (!batch || batch.taskId !== source.taskId) {
      throw new Error(`Hot batch "${input.batchId}" not found`);
    }

    const results = this.resultService.listResults({ batchId: input.batchId });
    const logs = this.executionLogService.query({ batchId: input.batchId });
    const reportId = this.createId();
    const now = this.now();
    const createdAt = now.toISOString();
    const normalizedOutputDir = this.outputDir.replace(/\\/g, '/').replace(/\/$/, '');
    const { filePath, content, latestFilePath } = input.format === 'html'
      ? this.buildHtmlOutput({
        outputDir: normalizedOutputDir,
        sourceId: source.id,
        sourceName: source.name,
        siteKey: source.siteKey,
        parserKey: source.parserKey,
        sourceUrl: source.entryUrl,
        batchId: input.batchId,
        createdAt: now,
        results,
      })
      : {
        filePath: `${normalizedOutputDir}/${reportId}.md`,
        content: this.buildMarkdown({
          sourceName: source.name,
          sourceUrl: source.entryUrl,
          batchId: input.batchId,
          results,
          logs,
        }),
        latestFilePath: null,
      };

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.writeFile(filePath, content);
    if (latestFilePath) {
      fs.mkdirSync(path.dirname(latestFilePath), { recursive: true });
      this.writeFile(latestFilePath, content);
    }

    const report: HotReportSummary = {
      id: reportId,
      sourceId: source.id,
      batchId: input.batchId,
      title: `${source.name} 报告`,
      format: input.format,
      filePath,
      createdAt,
    };
    this.reportRepository.saveReport(report);
    return report;
  }

  private buildHtmlOutput(input: {
    outputDir: string;
    sourceId: string;
    sourceName: string;
    siteKey: string;
    parserKey: string;
    sourceUrl: string;
    batchId: string;
    createdAt: Date;
    results: Array<{ id: string; data: Record<string, unknown> }>;
  }): { filePath: string; content: string; latestFilePath: string } {
    const { dateFolder, timeFilename } = formatSnapshotParts(input.createdAt);
    const filePath = `${input.outputDir}/html/${dateFolder}/${timeFilename}.html`;
    const latestFilePath = input.siteKey === 'trendradar' && input.parserKey === 'newsnow.batch'
      ? `${input.outputDir}/html/latest/current.html`
      : '';
    return {
      filePath,
      latestFilePath,
      content: renderTrendRadarHtml({
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
        batchId: input.batchId,
        createdAt: input.createdAt,
        ...this.buildTrendRadarProjection(input),
        mode: 'current',
      }),
    };
  }

  private buildTrendRadarProjection(input: {
    sourceId: string;
    sourceName: string;
    siteKey: string;
    parserKey: string;
    sourceUrl: string;
    batchId: string;
    createdAt: Date;
    results: Array<{ id: string; data: Record<string, unknown> }>;
  }): {
    results: Array<{ id: string; data: Record<string, unknown> }>;
    totalCount: number;
    standaloneGroups?: Array<{ name: string; items: Array<{ id: string; data: Record<string, unknown> }> }>;
  } {
    const totalCount = input.results.length;
    const source = this.sourceRepository.getSource(input.sourceId);
    const isTrendRadarBatch = input.siteKey === 'trendradar' && input.parserKey === 'newsnow.batch';
    if (!isTrendRadarBatch || !this.trendRadarConfigService) {
      const results = source?.filter
        ? this.applyTrendRadarKeywordProjection(input.results, source.filter)
        : input.results;
      return { results, totalCount };
    }

    const profile = this.trendRadarConfigService.loadProfile();
    if (!profile) {
      return { results: input.results, totalCount };
    }

    const results = profile.displayMode === 'keyword' && profile.filterMethod === 'keyword' && profile.filter
      ? this.applyTrendRadarKeywordProjection(input.results, profile.filter)
      : input.results;

    return {
      results,
      totalCount,
      standaloneGroups: buildStandaloneGroups(input.results, profile),
    };
  }

  private applyTrendRadarKeywordProjection(
    results: Array<{ id: string; data: Record<string, unknown> }>,
    filter: {
      keywordGroups?: Array<{ name: string; include: string[]; exclude?: string[] }>;
      excludeKeywords?: string[];
      seenUrls?: string[];
    },
  ): Array<{ id: string; data: Record<string, unknown> }> {
    const filtered = new HotFilterService().apply(
      results.map((result) => ({
        __resultId: result.id,
        ...result.data,
      })),
      filter,
    );

    return filtered.map((item) => {
      const { __resultId, ...data } = item;
      return {
        id: String(__resultId),
        data,
      };
    });
  }

  private buildMarkdown(input: {
    sourceName: string;
    sourceUrl: string;
    batchId: string;
    results: Array<{ id: string; data: Record<string, unknown> }>;
    logs: Array<{ level: string; message: string; createdAt?: string }>;
  }): string {
    const lines = [
      `# ${input.sourceName} 报告`,
      '',
      `- 批次：${input.batchId}`,
      `- 来源：${input.sourceUrl}`,
      `- 结果数：${input.results.length}`,
      '',
      '## 结果摘要',
      ...input.results.flatMap((result, index) => formatHotResult(result, index)),
      '',
      '## 执行日志',
      ...input.logs.map((log) => `- [${log.level}] ${log.message}${log.createdAt ? ` (${log.createdAt})` : ''}`),
    ];

    return lines.join('\n');
  }
}

function buildStandaloneGroups(
  results: Array<{ id: string; data: Record<string, unknown> }>,
  profile: TrendRadarProfile,
): Array<{ name: string; items: Array<{ id: string; data: Record<string, unknown> }> }> {
  if (profile.standalone.platformIds.length === 0) {
    return [];
  }

  return profile.standalone.platformIds
    .map((platformId) => {
      const items = results.filter((result) => result.data.sourceId === platformId);
      const limitedItems = profile.standalone.maxItems > 0
        ? items.slice(0, profile.standalone.maxItems)
        : items;
      return {
        name: resolveStandaloneGroupName(platformId, limitedItems, profile.platformNames),
        items: limitedItems,
      };
    })
    .filter((group) => group.items.length > 0);
}

function resolveStandaloneGroupName(
  platformId: string,
  items: Array<{ id: string; data: Record<string, unknown> }>,
  platformNames: Record<string, string>,
): string {
  const sourceName = items.find((item) => typeof item.data.sourceName === 'string')?.data.sourceName;
  if (typeof sourceName === 'string' && sourceName.trim().length > 0) {
    return sourceName;
  }
  return platformNames[platformId] ?? platformId;
}

function formatHotResult(
  result: { id: string; data: Record<string, unknown> },
  index: number,
): string[] {
  const title = String(result.data.title ?? result.id);
  const url = typeof result.data.url === 'string' ? result.data.url : '';
  const rank = typeof result.data.rank === 'number' ? result.data.rank : index + 1;
  const keywordGroups = Array.isArray(result.data.keywordGroups)
    ? result.data.keywordGroups.join('、')
    : '';
  const isNew = result.data.isNew === true ? '是' : '否';
  const summary = typeof result.data.summary === 'string' && result.data.summary.length > 0
    ? result.data.summary
    : '';

  return [
    `${rank}. ${url ? `[${title}](${url})` : title}`,
    `   - 结果ID：${result.id}`,
    `   - 关键词组：${keywordGroups || '无'}`,
    `   - 新增：${isNew}`,
    ...(summary ? [`   - 摘要：${summary}`] : []),
  ];
}
