import type { ScheduleConfig, StepResult, TaskBreakpoint } from './task';

export type HotSourceKind = 'api' | 'browser' | 'rss';
export type HotReportFormat = 'md' | 'html' | 'docx';
export type HotWorkspaceMode = 'browser-session' | 'hot-workspace';
export type HotTimelinePreset = 'all-day' | 'morning-evening' | 'workday' | 'custom';

export interface HotKeywordGroup {
  name: string;
  include: string[];
  exclude?: string[];
  required?: string[];
  maxItems?: number;
}

export interface HotFilterConfig {
  keywordGroups?: HotKeywordGroup[];
  includeKeywords?: string[];
  excludeKeywords?: string[];
  seenUrls?: string[];
}

export interface HotTimelineWindow {
  start: string;
  end: string;
  daysOfWeek?: number[];
}

export interface HotTimelineConfig {
  preset: HotTimelinePreset;
  windows: HotTimelineWindow[];
}

export interface HotTimelinePresetOption extends HotTimelineConfig {
  label: string;
  schedule: ScheduleConfig;
}

export interface HotSource {
  id: string;
  taskId: string;
  name: string;
  sourceKind: HotSourceKind;
  siteKey: string;
  entryUrl: string;
  parserKey: string;
  platformIds?: string[];
  sessionId?: string | null;
  schedule?: ScheduleConfig | null;
  filter?: HotFilterConfig | null;
  timeline?: HotTimelineConfig | null;
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
  platformIds?: string[];
  sessionId?: string | null;
  schedule?: ScheduleConfig | null;
  filter?: HotFilterConfig | null;
  timeline?: HotTimelineConfig | null;
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
  content?: string;
  createdAt: string;
}
