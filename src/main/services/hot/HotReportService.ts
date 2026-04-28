import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { HotReportFormat, HotReportSummary } from '@shared/types';
import type { BatchService } from '../BatchService';
import type { ExecutionLogService } from '../ExecutionLogService';
import type { ResultService } from '../ResultService';
import type { HotReportRepository } from '../repositories/HotReportRepository';
import type { HotSourceRepository } from '../repositories/HotSourceRepository';

interface HotReportServiceOptions {
  sourceRepository?: Pick<HotSourceRepository, 'getSource'>;
  batchService?: Pick<BatchService, 'getBatch'>;
  resultService?: Pick<ResultService, 'listResults'>;
  executionLogService?: Pick<ExecutionLogService, 'query'>;
  reportRepository?: Pick<HotReportRepository, 'saveReport' | 'listReports' | 'getReport' | 'getReportByBatchId'>;
  outputDir?: string;
  writeFile?: (filePath: string, content: string) => void;
  now?: () => Date;
  createId?: () => string;
}

export class HotReportService {
  private readonly sourceRepository: Pick<HotSourceRepository, 'getSource'>;
  private readonly batchService: Pick<BatchService, 'getBatch'>;
  private readonly resultService: Pick<ResultService, 'listResults'>;
  private readonly executionLogService: Pick<ExecutionLogService, 'query'>;
  private readonly reportRepository: Pick<HotReportRepository, 'saveReport' | 'listReports' | 'getReport' | 'getReportByBatchId'>;
  private readonly outputDir: string;
  private readonly writeFile: (filePath: string, content: string) => void;
  private readonly now: () => Date;
  private readonly createId: () => string;

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
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => randomUUID());
  }

  listReports(query: { sourceId?: string; batchId?: string } = {}): HotReportSummary[] {
    return this.reportRepository.listReports(query);
  }

  getReportDetail(reportId: string): HotReportSummary | null {
    return this.reportRepository.getReport(reportId);
  }

  generateReport(input: { sourceId: string; batchId: string; format: HotReportFormat }): HotReportSummary {
    if (input.format !== 'md') {
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
    const createdAt = this.now().toISOString();
    const normalizedOutputDir = this.outputDir.replace(/\\/g, '/').replace(/\/$/, '');
    const filePath = `${normalizedOutputDir}/${reportId}.md`;

    fs.mkdirSync(this.outputDir, { recursive: true });
    this.writeFile(filePath, this.buildMarkdown({
      sourceName: source.name,
      sourceUrl: source.entryUrl,
      batchId: input.batchId,
      results,
      logs,
    }));

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
      ...input.results.map((result) => `- ${result.id}: ${JSON.stringify(result.data)}`),
      '',
      '## 执行日志',
      ...input.logs.map((log) => `- [${log.level}] ${log.message}${log.createdAt ? ` (${log.createdAt})` : ''}`),
    ];

    return lines.join('\n');
  }
}
