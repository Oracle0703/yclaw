import type {
  DataCenterResultQuery,
  DataQualityBatchInsight,
  DataQualityBatchScore,
  DataQualityFinding,
  DataQualityIssue,
  DataQualityRuleConfig,
  DataQualityRuleSaveInput,
  DataQualityRuleSummary,
  DataQualityScanInput,
  DataQualityScanResult,
  ExtractionResult,
} from '@shared/types';
import type { ResultService } from '../ResultService';
import type { DataQualityBatchInsightRepository } from '../repositories/DataQualityBatchInsightRepository';
import type { DataQualityFindingRepository } from '../repositories/DataQualityFindingRepository';
import type { DataQualityRuleRepository } from '../repositories/DataQualityRuleRepository';
import { BatchInsightService } from './quality/BatchInsightService';
import { FingerprintBuilder } from './quality/FingerprintBuilder';
import { ResultRuleEngine } from './quality/ResultRuleEngine';
import { RuleCompiler } from './quality/RuleCompiler';
import { ScoreCalculator } from './quality/ScoreCalculator';

interface DataQualityServiceOptions {
  resultService: Pick<ResultService, 'listResults'>;
  ruleRepository?: Pick<DataQualityRuleRepository, 'listRules' | 'saveRule'>;
  findingRepository?: Pick<DataQualityFindingRepository, 'saveFindings' | 'listFindingsByBatch' | 'clearFindingsByBatch'>;
  batchInsightRepository?: Pick<
    DataQualityBatchInsightRepository,
    'saveInsight' | 'getInsight' | 'listInsightsByTask'
  >;
}

const DEFAULT_RULES: DataQualityRuleConfig[] = [
  {
    ruleId: 'empty-data',
    name: '空数据',
    description: '识别 data 为空对象的采集结果',
    severity: 'warning',
    enabled: true,
    params: {},
    ruleType: 'field-empty',
    scope: 'result',
    fieldPath: 'data',
    operator: 'isEmpty',
    weight: 1,
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
  },
  {
    ruleId: 'failed-result',
    name: '失败结果',
    description: '识别状态为 failed 的采集结果',
    severity: 'error',
    enabled: true,
    params: {},
    ruleType: 'status',
    scope: 'result',
    fieldPath: 'status',
    operator: 'eq',
    expectedValue: 'failed',
    weight: 1,
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
  },
  {
    ruleId: 'suspicious-status',
    name: '可疑状态',
    description: '识别已被标记为 suspicious 的结果',
    severity: 'warning',
    enabled: true,
    params: {},
    ruleType: 'status',
    scope: 'result',
    fieldPath: 'status',
    operator: 'eq',
    expectedValue: 'suspicious',
    weight: 1,
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
  },
  {
    ruleId: 'duplicate-payload',
    name: '重复数据',
    description: '识别内容完全一致的数据载荷',
    severity: 'warning',
    enabled: true,
    params: {},
    ruleType: 'duplicate',
    scope: 'batch',
    weight: 1,
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
  },
];

export class DataQualityService {
  private readonly resultService: Pick<ResultService, 'listResults'>;
  private readonly ruleRepository?: Pick<DataQualityRuleRepository, 'listRules' | 'saveRule'>;
  private readonly findingRepository?: Pick<
    DataQualityFindingRepository,
    'saveFindings' | 'listFindingsByBatch' | 'clearFindingsByBatch'
  >;
  private readonly batchInsightRepository?: Pick<
    DataQualityBatchInsightRepository,
    'saveInsight' | 'getInsight' | 'listInsightsByTask'
  >;
  private readonly ruleCompiler = new RuleCompiler();
  private readonly resultRuleEngine = new ResultRuleEngine();
  private readonly scoreCalculator = new ScoreCalculator();
  private readonly fingerprintBuilder = new FingerprintBuilder();
  private readonly batchInsightService = new BatchInsightService();

  constructor(options: DataQualityServiceOptions) {
    this.resultService = options.resultService;
    this.ruleRepository = options.ruleRepository;
    this.findingRepository = options.findingRepository;
    this.batchInsightRepository = options.batchInsightRepository;
  }

  listRuleConfigs(): DataQualityRuleConfig[] {
    return this.getRuleConfigs();
  }

  saveRuleConfig(input: DataQualityRuleSaveInput): DataQualityRuleConfig {
    const current = this.getRuleConfigs().find((rule) => rule.ruleId === input.ruleId);
    if (!current) {
      throw new Error(`Unknown quality rule: ${input.ruleId}`);
    }

    const next: DataQualityRuleConfig = {
      ...current,
      enabled: input.enabled ?? current.enabled,
      severity: input.severity ?? current.severity,
      params: input.params ?? current.params,
      updatedAt: new Date().toISOString(),
    };
    this.ruleRepository?.saveRule(next);
    return next;
  }

  async scan(input: DataQualityScanInput = {}): Promise<DataQualityScanResult> {
    const query = input.query ?? {};
    const limit = input.limit ?? 200;
    const results = this.filterResults(
      this.resultService.listResults({
        taskId: query.taskId,
        batchId: query.batchId,
      }),
      query,
    ).slice(0, limit);
    const scanId = `scan:${new Date().toISOString()}`;
    const enabledRules = this.getRuleConfigs().filter((rule) => rule.enabled);
    const findings = this.evaluateFindings(results, enabledRules, scanId);
    const scores = results.map((result) => this.scoreCalculator.calculateResultScore(result.id, findings));
    const singleBatchId = getSingleBatchId(results);
    const batchScore =
      singleBatchId !== null
        ? this.scoreCalculator.calculateBatchScore(singleBatchId, scores)
        : null;
    const batchInsight =
      singleBatchId !== null && batchScore
        ? this.buildBatchInsight(singleBatchId, results, findings, batchScore)
        : null;

    if (singleBatchId && this.findingRepository) {
      this.findingRepository.clearFindingsByBatch(singleBatchId);
      this.findingRepository.saveFindings(scanId, findings);
    }
    if (batchInsight && this.batchInsightRepository) {
      this.batchInsightRepository.saveInsight(batchInsight);
    }

    return {
      scannedAt: new Date().toISOString(),
      totalResults: results.length,
      issueCount: findings.length,
      affectedResults: new Set(findings.map((finding) => finding.resultId)).size,
      rules: this.buildRuleSummaries(findings, enabledRules),
      issues: findings.map((finding) => this.toIssue(finding, results)),
      batchScore,
      scores,
      batchInsight,
    };
  }

  getBatchScore(batchId: string): DataQualityBatchScore | null {
    const persistedInsight = this.batchInsightRepository?.getInsight(batchId);
    if (persistedInsight) {
      return {
        batchId: persistedInsight.batchId,
        score: persistedInsight.score,
        grade: persistedInsight.grade,
      };
    }

    return this.scanBatch(batchId)?.batchScore ?? null;
  }

  getBatchInsight(batchId: string): DataQualityBatchInsight | null {
    return this.batchInsightRepository?.getInsight(batchId) ?? this.scanBatch(batchId)?.batchInsight ?? null;
  }

  private scanBatch(batchId: string): DataQualityScanResult | null {
    const results = this.resultService.listResults({ batchId });
    if (results.length === 0) {
      return null;
    }

    const enabledRules = this.getRuleConfigs().filter((rule) => rule.enabled);
    const scanId = `scan:${new Date().toISOString()}`;
    const findings = this.evaluateFindings(results, enabledRules, scanId);
    const scores = results.map((result) => this.scoreCalculator.calculateResultScore(result.id, findings));
    const batchScore = this.scoreCalculator.calculateBatchScore(batchId, scores);
    const batchInsight = this.buildBatchInsight(batchId, results, findings, batchScore);

    return {
      scannedAt: new Date().toISOString(),
      totalResults: results.length,
      issueCount: findings.length,
      affectedResults: new Set(findings.map((finding) => finding.resultId)).size,
      rules: this.buildRuleSummaries(findings, enabledRules),
      issues: findings.map((finding) => this.toIssue(finding, results)),
      batchScore,
      scores,
      batchInsight,
    };
  }

  private getRuleConfigs(): DataQualityRuleConfig[] {
    const savedRules = new Map(
      (this.ruleRepository?.listRules() ?? []).map((rule) => [rule.ruleId, rule] as const),
    );

    const defaults = DEFAULT_RULES.map((rule) => {
      const saved = savedRules.get(rule.ruleId);
      return saved ? { ...rule, ...saved } : rule;
    });
    const customRules = (this.ruleRepository?.listRules() ?? []).filter(
      (rule) => !DEFAULT_RULES.some((defaultRule) => defaultRule.ruleId === rule.ruleId),
    );

    return [...defaults, ...customRules];
  }

  private evaluateFindings(
    results: ExtractionResult[],
    enabledRules: DataQualityRuleConfig[],
    scanId: string,
  ): DataQualityFinding[] {
    const resultRules = enabledRules.filter((rule) => rule.ruleType !== 'duplicate');
    const compiledRules = this.ruleCompiler.compile(resultRules);
    const findings = this.resultRuleEngine.evaluate(results, compiledRules, scanId);

    return [...findings, ...this.findDuplicateFindings(results, enabledRules, scanId)].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }

  private findDuplicateFindings(
    results: ExtractionResult[],
    rules: DataQualityRuleConfig[],
    scanId: string,
  ): DataQualityFinding[] {
    const duplicateRules = rules.filter((rule) => rule.ruleType === 'duplicate');
    if (duplicateRules.length === 0) {
      return [];
    }

    return duplicateRules.flatMap((rule) => {
      const fieldPaths = readFieldPaths(rule);
      const groups = results.reduce<Map<string, ExtractionResult[]>>((accumulator, result) => {
        if (Object.keys(result.data).length === 0) {
          return accumulator;
        }
        const fingerprint = this.fingerprintBuilder.build(result.data, fieldPaths);
        accumulator.set(fingerprint, [...(accumulator.get(fingerprint) ?? []), result]);
        return accumulator;
      }, new Map<string, ExtractionResult[]>());

      return Array.from(groups.entries())
        .filter(([, group]) => group.length > 1)
        .flatMap(([fingerprint, group]) =>
          group.map((result) => ({
            id: `${scanId}:${rule.ruleId}:${result.id}`,
            scanId,
            ruleId: rule.ruleId,
            severity: rule.severity,
            resultId: result.id,
            taskId: result.taskId,
            batchId: result.batchId,
            message: `数据内容与 ${group.length - 1} 条结果重复`,
            fieldPath: fieldPaths[0] ?? null,
            actualValue: result.data,
            expectedValue: fieldPaths.length > 0 ? fieldPaths : 'unique payload',
            scoreImpact: scoreImpactOf(rule),
            fingerprint,
            createdAt: result.createdAt,
          })),
        );
    });
  }

  private buildBatchInsight(
    batchId: string,
    results: ExtractionResult[],
    findings: DataQualityFinding[],
    batchScore: DataQualityBatchScore,
  ): DataQualityBatchInsight {
    const taskId = results[0]?.taskId ?? 'unknown-task';
    const previousBatchScore =
      this.batchInsightRepository
        ?.listInsightsByTask(taskId)
        .find((insight) => insight.batchId !== batchId) ?? null;

    return this.batchInsightService.buildInsight({
      batchId,
      taskId,
      results,
      findings,
      batchScore,
      previousBatchScore: previousBatchScore
        ? {
            batchId: previousBatchScore.batchId,
            score: previousBatchScore.score,
            grade: previousBatchScore.grade,
          }
        : null,
    });
  }

  private filterResults(
    results: ExtractionResult[],
    query: Partial<DataCenterResultQuery>,
  ): ExtractionResult[] {
    return results.filter((result) => {
      if (query.status?.length && !query.status.includes(result.status)) {
        return false;
      }
      if (query.createdFrom && result.createdAt < query.createdFrom) {
        return false;
      }
      if (query.createdTo && result.createdAt > query.createdTo) {
        return false;
      }
      if (query.keyword && !JSON.stringify(result.data).includes(query.keyword)) {
        return false;
      }
      return true;
    });
  }

  private toIssue(finding: DataQualityFinding, results: ExtractionResult[]): DataQualityIssue {
    const result = results.find((item) => item.id === finding.resultId);

    return {
      id: finding.id,
      ruleId: finding.ruleId,
      severity: finding.severity,
      resultId: finding.resultId,
      taskId: finding.taskId,
      batchId: finding.batchId,
      message: finding.message,
      createdAt: finding.createdAt,
      sample: result?.data,
    };
  }

  private buildRuleSummaries(
    findings: DataQualityFinding[],
    enabledRules: DataQualityRuleConfig[],
  ): DataQualityRuleSummary[] {
    return enabledRules.map((rule) => {
      const ruleFindings = findings.filter((finding) => finding.ruleId === rule.ruleId);

      return {
        ruleId: rule.ruleId,
        name: rule.name,
        severity: rule.severity,
        hitCount: ruleFindings.length,
        sampleResultIds: ruleFindings.slice(0, 5).map((finding) => finding.resultId),
      };
    });
  }
}

function getSingleBatchId(results: ExtractionResult[]): string | null {
  const batchIds = Array.from(new Set(results.map((result) => result.batchId)));
  return batchIds.length === 1 ? batchIds[0] : null;
}

function scoreImpactOf(rule: DataQualityRuleConfig): number {
  const base = rule.severity === 'error' ? 20 : 8;
  return Math.round(base * (rule.weight ?? 1));
}

function readFieldPaths(rule: DataQualityRuleConfig): string[] {
  const value = rule.params?.fieldPaths;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }
  if (typeof rule.fieldPath === 'string' && rule.fieldPath.length > 0) {
    return [rule.fieldPath];
  }
  return [];
}
