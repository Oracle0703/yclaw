/**
 * IPC 消息类型定义
 */
import type {
  ExtractionResult,
  ExtractionTemplate,
  ScheduleConfig,
  TaskBatch,
  TaskBreakpoint,
} from './task';
import type {
  DataApiToken,
  DataQualityBatchInsight,
  DataQualityBatchScore,
  DataCenterOverview,
  DataCenterResultDetail,
  DataCenterResultQuery,
  DataDataset,
  DataExportJob,
  DataWebhookTarget,
  DataQualityScanResult,
  DataQualityRuleConfig,
  DataQualityRuleSaveInput,
} from './data-center';
import type { InterventionState, BrowserSession } from './browser';

/** IPC 请求/响应的基础格式 */
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    data?: unknown;
  };
}

/** 窗口打开参数 */
export interface WindowOpenParams {
  module: string;
  options?: {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  };
}

/** 日志写入参数 */
export interface LogWriteParams {
  level: 'debug' | 'info' | 'warn' | 'error';
  source: 'main' | 'renderer' | 'plugin' | 'engine';
  message: string;
  data?: unknown;
}

export interface TaskUpsertPayload {
  id?: string;
  name: string;
  description?: string;
  entryUrl?: string;
  schedule?: ScheduleConfig | null;
  templateId?: string | null;
  sessionId?: string | null;
}

export interface BatchQueryPayload {
  taskId: string;
}

export interface BatchDetailPayload {
  batchId: string;
}

export interface ResultExportPayload {
  taskId?: string;
  batchId?: string;
  format: 'csv' | 'json' | 'jsonl';
}

export interface DataCenterExportsCreatePayload {
  name: string;
  datasetId?: string;
  query: DataCenterResultQuery;
  targetType: 'file' | 'webhook' | 'local-api';
  targetConfig: Record<string, unknown>;
  format: 'csv' | 'json' | 'jsonl';
}

export interface DataCenterExportsListPayload {
  page?: number;
  pageSize?: number;
  status?: DataExportJob['status'];
}

export type DataCenterResultsListPayload = DataCenterResultQuery;

export interface DataCenterResultsDetailPayload {
  resultId: string;
}

export interface DataCenterDatasetsSavePayload {
  dataset: Omit<DataDataset, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface DataCenterExportsRetryPayload {
  exportJobId: string;
}

export interface DataCenterExportsCancelPayload {
  exportJobId: string;
}

export interface DataCenterWebhookTestPayload {
  webhook: Pick<DataWebhookTarget, 'url' | 'headers' | 'timeoutMs' | 'maxRetries'> & {
    secret?: string;
  };
}

export interface DataCenterWebhookSavePayload {
  target: Omit<DataWebhookTarget, 'createdAt' | 'updatedAt' | 'secretHash'> & {
    createdAt?: string;
    updatedAt?: string;
    secret?: string;
    secretHash?: string | null;
  };
}

export interface DataCenterWebhookDeletePayload {
  targetId: string;
}

export interface DataCenterApiTokenPayload {
  token: DataApiToken;
}

export interface DataCenterApiTokenCreatePayload {
  name: string;
  scopes: string[];
}

export interface DataCenterApiTokenRevokePayload {
  tokenId: string;
}

export interface DataCenterApiTokenIssueResponse {
  token: DataApiToken;
  plainTextToken: string;
}

export interface DataCenterApiStatusResponse {
  running: boolean;
  port?: number;
  host?: string;
}

export interface DataCenterQualityScanPayload {
  query?: Partial<DataCenterResultQuery>;
  limit?: number;
}

export interface DataCenterQualityBatchPayload {
  batchId: string;
}

export interface DataCenterQualityRuleSavePayload {
  rule: DataQualityRuleSaveInput;
}

export interface DataCenterPayloadMap {
  overview: DataCenterOverview;
  resultDetail: DataCenterResultDetail;
  exportJob: DataExportJob;
  dataset: DataDataset;
  qualityScan: DataQualityScanResult;
  qualityRule: DataQualityRuleConfig;
  qualityBatchScore: DataQualityBatchScore;
  qualityBatchInsight: DataQualityBatchInsight;
}

export interface SessionBindPayload {
  taskId: string;
  sessionId: string;
}

export interface TemplateSavePayload {
  id?: string;
  name: string;
  fields: ExtractionTemplate['fields'];
}

export interface TaskDetailResponse {
  taskId: string;
  latestBatch?: TaskBatch | null;
  breakpoint?: TaskBreakpoint | null;
}

export interface SchedulerStatusResponse {
  runningCount: number;
  queuedCount: number;
}

export interface ResultExportResponse {
  path: string;
}

export type AlertLevel = 'info' | 'warning' | 'critical';

export type AlertStatus =
  | 'new'
  | 'claimed'
  | 'processing'
  | 'escalated'
  | 'recovered'
  | 'closed'
  | 'ignored';

export interface AlertRecord {
  id: string;
  workspaceId?: string;
  taskId: string;
  batchId?: string;
  message: string;
  createdAt: string;
  read: boolean;
  status?: AlertStatus;
  assignee?: string | null;
  level?: AlertLevel;
  resolution?: string | null;
}

export interface AutomationBrowserOpsPayloadMap {
  task: TaskUpsertPayload;
  batch: TaskBatch;
  result: ExtractionResult;
  session: BrowserSession;
  intervention: InterventionState;
}

/** electronAPI 暴露到渲染进程的接口 */
export interface ElectronAPI {
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<IpcResponse<T>>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
