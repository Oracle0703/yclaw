import type { ScheduleConfig, StepResult, TaskBreakpoint } from './task';

export type CommentPlatform = 'xhs' | 'douyin';
export type CommentEntryKind = 'keyword' | 'note' | 'creator';
export type CommentReportFormat = 'md' | 'html';
export type CommentReplyTone = 'friendly' | 'professional' | 'concise';
export type MediaCrawlerPlatform = 'xhs' | 'dy' | 'ks' | 'bili' | 'wb' | 'tieba' | 'zhihu';
export type MediaCrawlerLoginType = 'qrcode' | 'phone' | 'cookie' | 'browser';

export interface CommentCrawlLimits {
  maxContents: number;
  maxCommentsPerContent: number;
  includeSubComments: boolean;
  crawlIntervalSeconds: number;
}

export interface CommentFilterConfig {
  includeKeywords?: string[];
  excludeKeywords?: string[];
  minLikeCount?: number;
}

export interface CommentSource {
  id: string;
  taskId: string;
  name: string;
  platform: CommentPlatform;
  entryKind: CommentEntryKind;
  entryValue: string;
  parserKey: string;
  sessionId?: string | null;
  schedule?: ScheduleConfig | null;
  limits: CommentCrawlLimits;
  filter?: CommentFilterConfig | null;
  enabled: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CommentSourceDraft {
  name: string;
  platform: CommentPlatform;
  entryKind: CommentEntryKind;
  entryValue: string;
  parserKey?: string;
  sessionId?: string | null;
  schedule?: ScheduleConfig | null;
  limits?: Partial<CommentCrawlLimits> | null;
  filter?: CommentFilterConfig | null;
  enabled?: boolean;
  tags?: string[];
}

export interface CommentItem {
  platform: CommentPlatform;
  sourceId?: string;
  contentId?: string;
  contentUrl?: string;
  contentTitle?: string;
  commentId: string;
  parentCommentId?: string | null;
  content: string;
  authorId?: string;
  authorName?: string;
  avatar?: string;
  createdAt?: string;
  likeCount?: number;
  ipLocation?: string;
  subCommentCount?: number;
}

export interface CommentRunSummary {
  batchId: string;
  sourceId: string;
  sourceName: string;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  resultCount: number;
  reportStatus: 'pending' | 'generated';
}

export interface CommentRunDetail extends CommentRunSummary {
  taskId: string;
  error?: string | null;
  breakpoint?: TaskBreakpoint | null;
  stepResults: StepResult[];
  linkedResultIds: string[];
}

export interface CommentReportSummary {
  id: string;
  sourceId: string;
  batchId: string;
  title: string;
  format: CommentReportFormat;
  filePath: string;
  content?: string;
  createdAt: string;
}

export interface CommentAiReplyDraft {
  commentId: string;
  platform: CommentPlatform;
  tone: CommentReplyTone;
  drafts: string[];
  publishMode: 'manual';
}

export interface MediaCrawlerConfig {
  enabled: boolean;
  repoPath: string;
  pythonPath: string;
  outputDir?: string;
  loginType: MediaCrawlerLoginType;
}

export interface MediaCrawlerRunRequest {
  sourceId: string;
  taskId: string;
  batchId: string;
  platform: MediaCrawlerPlatform;
  entryKind: CommentEntryKind;
  entryValue: string;
  limits: CommentCrawlLimits;
}

export interface MediaCrawlerRunResult {
  batchId: string;
  platform: MediaCrawlerPlatform;
  exitCode: number;
  importedCount: number;
  outputDir: string;
}
