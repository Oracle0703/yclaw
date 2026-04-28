import type { ScheduleConfig, StepResult, TaskBreakpoint } from './task';

export type HotSourceKind = 'api' | 'browser';
export type HotReportFormat = 'md' | 'docx';
export type HotWorkspaceMode = 'browser-session' | 'hot-workspace';

export interface HotSource {
  id: string;
  taskId: string;
  name: string;
  sourceKind: HotSourceKind;
  siteKey: string;
  entryUrl: string;
  parserKey: string;
  sessionId?: string | null;
  schedule?: ScheduleConfig | null;
  enabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface HotSourceDraft {
  name: string;
  sourceKind: HotSourceKind;
  siteKey: string;
  entryUrl: string;
  parserKey: string;
  sessionId?: string | null;
  schedule?: ScheduleConfig | null;
  enabled?: boolean;
  tags?: string[];
}

export interface HotRunSummary {
  batchId: string;
  sourceId: string;
  sourceName: string;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  resultCount: number;
  reportStatus: 'pending' | 'generated';
}

export interface HotRunDetail extends HotRunSummary {
  taskId: string;
  error?: string | null;
  breakpoint?: TaskBreakpoint | null;
  stepResults: StepResult[];
  linkedResultIds: string[];
}

export interface HotReportSummary {
  id: string;
  sourceId: string;
  batchId: string;
  title: string;
  format: HotReportFormat;
  filePath: string;
  createdAt: string;
}
