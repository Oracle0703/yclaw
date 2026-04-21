import type { ExtractionResult, ExtractionResultStatus, TaskBatch } from './task';

export type DataExportFormat = 'csv' | 'json' | 'jsonl';
export type DataExportTargetType = 'file' | 'webhook' | 'local-api';
export type DataExportJobStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'retrying'
  | 'cancelled';

export interface DataPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DataCenterResultQuery {
  taskId?: string;
  batchId?: string;
  status?: Array<ExtractionResultStatus | 'ignored'>;
  createdFrom?: string;
  createdTo?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}

export interface DataDatasetFieldMapping {
  key: string;
  alias?: string;
  masked?: boolean;
}

export interface DataDataset {
  id: string;
  name: string;
  description?: string | null;
  query: DataCenterResultQuery;
  fieldMapping?: DataDatasetFieldMapping[] | null;
  defaultFormat: DataExportFormat;
  apiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DataExportJob {
  id: string;
  name: string;
  datasetId?: string | null;
  query: DataCenterResultQuery;
  targetType: DataExportTargetType;
  targetConfig: Record<string, unknown>;
  format: DataExportFormat;
  status: DataExportJobStatus;
  resultCount: number;
  outputPath?: string | null;
  error?: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface DataExportAudit {
  id: string;
  exportJobId: string;
  attempt: number;
  status: DataExportJobStatus;
  targetType: DataExportTargetType;
  requestSummary?: string | null;
  responseSummary?: string | null;
  error?: string | null;
  createdAt: string;
}

export interface DataWebhookTarget {
  id: string;
  name: string;
  url: string;
  headers?: Record<string, string> | null;
  secretHash?: string | null;
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export interface DataApiToken {
  id: string;
  name: string;
  tokenHash: string;
  scopes: string[];
  enabled: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
  revokedAt?: string | null;
}

export interface DataCenterExecutionLog {
  id?: number;
  taskId: string;
  batchId: string;
  stepIndex?: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface DataCenterResultDetail {
  result: ExtractionResult;
  batch: TaskBatch | null;
  logs: DataCenterExecutionLog[];
  exports: DataExportJob[];
}

export interface DataCenterOverview {
  totalResults: number;
  suspiciousResults: number;
  failedExports: number;
  recentExports: DataExportJob[];
}

export type BuiltInDataQualityRuleId =
  | 'empty-data'
  | 'failed-result'
  | 'suspicious-status'
  | 'duplicate-payload';

export type DataQualityRuleId = BuiltInDataQualityRuleId | (string & {});

export type DataQualitySeverity = 'warning' | 'error';
export type DataQualityRuleType =
  | 'status'
  | 'field-exists'
  | 'field-empty'
  | 'number-range'
  | 'string-match'
  | 'duplicate'
  | 'group';
export type DataQualityRuleScope = 'result' | 'batch';
export type DataQualityOperator =
  | 'exists'
  | 'isEmpty'
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'contains'
  | 'regex';
export type DataQualityGrade = 'excellent' | 'good' | 'watch' | 'poor';
export type DataQualityScoreTrendHint = 'up' | 'down' | 'flat' | 'unknown';

export interface DataQualityRuleCondition {
  fieldPath?: string;
  operator: DataQualityOperator;
  expectedValue?: unknown;
}

export interface DataQualityRuleGroup {
  mode: 'all' | 'any';
  conditions: DataQualityRuleCondition[];
}

export interface DataQualityRuleSummary {
  ruleId: DataQualityRuleId;
  name: string;
  severity: DataQualitySeverity;
  hitCount: number;
  sampleResultIds: string[];
}

export interface DataQualityRuleConfig {
  ruleId: DataQualityRuleId;
  name: string;
  description: string;
  severity: DataQualitySeverity;
  enabled: boolean;
  params: Record<string, unknown>;
  ruleType?: DataQualityRuleType;
  scope?: DataQualityRuleScope;
  fieldPath?: string | null;
  operator?: DataQualityOperator | null;
  expectedValue?: unknown;
  weight?: number;
  group?: DataQualityRuleGroup | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataQualityRuleSaveInput {
  ruleId: DataQualityRuleId;
  enabled?: boolean;
  severity?: DataQualitySeverity;
  params?: Record<string, unknown>;
}

export interface DataQualityIssue {
  id: string;
  ruleId: DataQualityRuleId;
  severity: DataQualitySeverity;
  resultId: string;
  taskId: string;
  batchId: string;
  message: string;
  createdAt: string;
  sample?: Record<string, unknown>;
}

export interface DataQualityFinding {
  id: string;
  scanId: string;
  ruleId: DataQualityRuleId;
  severity: DataQualitySeverity;
  resultId: string;
  taskId: string;
  batchId: string;
  message: string;
  fieldPath?: string | null;
  actualValue?: unknown;
  expectedValue?: unknown;
  scoreImpact: number;
  fingerprint?: string | null;
  createdAt: string;
}

export interface DataQualityResultScore {
  resultId: string;
  score: number;
  grade: DataQualityGrade;
  deductions: Array<{
    ruleId: DataQualityRuleId;
    points: number;
  }>;
}

export interface DataQualityBatchScore {
  batchId: string;
  score: number;
  grade: DataQualityGrade;
}

export interface DataQualityBatchInsight {
  id: string;
  batchId: string;
  taskId: string;
  score: number;
  grade: DataQualityGrade;
  totalResults: number;
  issueCount: number;
  affectedResults: number;
  failedRate: number;
  suspiciousRate: number;
  duplicateRate: number;
  topRules: Array<{
    ruleId: DataQualityRuleId;
    count: number;
  }>;
  topFields: Array<{
    fieldPath: string;
    count: number;
  }>;
  severityBreakdown: Record<DataQualitySeverity, number>;
  statusBreakdown: Record<string, number>;
  scoreTrendHint: DataQualityScoreTrendHint;
  summary: string;
  createdAt: string;
}

export interface DataQualityScanInput {
  query?: Partial<DataCenterResultQuery>;
  limit?: number;
}

export interface DataQualityScanResult {
  scannedAt: string;
  totalResults: number;
  issueCount: number;
  affectedResults: number;
  rules: DataQualityRuleSummary[];
  issues: DataQualityIssue[];
  batchScore?: DataQualityBatchScore | null;
  scores?: DataQualityResultScore[];
  batchInsight?: DataQualityBatchInsight | null;
}
