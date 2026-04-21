import type { QueueType, TaskIdempotency } from './runner-scheduler';

/**
 * 自动化任务类型定义
 */

export type ActionType = 'click' | 'input' | 'scroll' | 'extract' | 'screenshot';

export interface TaskAction {
  type: ActionType;
  selector: string;
  params?: Record<string, unknown>;
  timeout?: number;
}

export interface TaskStep {
  id: string;
  name: string;
  action: TaskAction;
  retryCount?: number;
  retryDelay?: number;
}

export interface TaskFlow {
  id: string;
  name: string;
  description?: string;
  steps: TaskStep[];
  entryUrl?: string;
  schedule?: ScheduleConfig | null;
  scheduling?: TaskSchedulingMetadata;
  sessionId?: string | null;
  templateId?: string | null;
  currentRevisionId?: string | null;
  enabled?: boolean;
  tags?: string[];
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export enum TaskStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface TaskExecutionResult {
  success: boolean;
  stepResults: StepResult[];
  error?: string;
  breakpointStepId?: string;
  breakpoint?: TaskBreakpoint;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  startedAt?: string;
  finishedAt?: string;
  screenshot?: string;
  domSnapshot?: string;
}

export interface ScheduleConfig {
  type: 'manual' | 'once' | 'cron';
  cron?: string;
  runAt?: string;
  timeoutMs?: number;
  maxConcurrency?: number;
}

export interface TaskSchedulingMetadata {
  taskType?: QueueType;
  idempotency?: TaskIdempotency;
  preferredRunnerKind?: 'local' | 'remote';
  requiredCapabilities?: string[];
}

export interface TaskBreakpoint {
  stepIndex: number;
  error: string;
  screenshot?: string;
  domSnapshot?: string;
}

export type TaskBatchStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'paused'
  | 'intervention';

export interface TaskBatch {
  id: string;
  taskId: string;
  status: TaskBatchStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  stepResults: StepResult[];
  error?: string | null;
  breakpoint?: TaskBreakpoint | null;
  createdAt: string;
}

export interface ExtractionField {
  name: string;
  selector: string;
  attribute: string;
  transform?: string;
}

export interface ExtractionTemplate {
  id: string;
  name: string;
  fields: ExtractionField[];
  version?: string;
  description?: string | null;
  deprecated?: boolean;
  pluginDependencies?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateGovernanceUpdate {
  version?: string;
  description?: string | null;
  deprecated?: boolean;
  pluginDependencies?: string[];
}

export type ExtractionResultStatus = 'normal' | 'suspicious' | 'failed';

export type ResultQualityStatus = 'passed' | 'warning' | 'failed';

export interface ResultEvidenceRef {
  kind: string;
  refId: string;
  label?: string;
}

export interface ExtractionResult {
  id: string;
  taskId: string;
  batchId: string;
  templateId?: string | null;
  data: Record<string, unknown>;
  status: ExtractionResultStatus;
  qualityStatus?: ResultQualityStatus;
  evidenceRefs?: ResultEvidenceRef[];
  revisionId?: string;
  sourceUrl?: string;
  screenshot?: string;
  createdAt: string;
}

export interface ResultQualityRule {
  requiredFields?: string[];
  minBatchResultCount?: number;
}

export interface BatchQualitySummary {
  batchId: string;
  totalResults: number;
  failedResults: number;
  missingRequiredFieldResults: number;
  qualityStatus: ResultQualityStatus;
}

export interface CrossBatchQualityAnalysis {
  taskId: string;
  totalResults: number;
  failedResults: number;
  missingRequiredFieldResults: number;
  tracedResults: number;
  batchSummaries: BatchQualitySummary[];
}
