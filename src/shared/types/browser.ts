export interface Tab {
  id: number;
  title: string;
  url: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  sessionPartition: string;
}

export interface BrowserSession {
  id: string;
  name: string;
  domain: string;
  partition: string;
  createdAt: string;
  updatedAt: string;
}

export type FlowRunnerStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'failed'
  | 'completed'
  | 'intervention';

export interface InterventionState {
  taskId: string;
  batchId: string;
  flowRunnerStatus: FlowRunnerStatus;
  webContentsId: number;
  sessionPartition: string;
  breakpoint?: {
    stepIndex: number;
    error: string;
    screenshot?: string;
    domSnapshot?: string;
  } | null;
}

export type RecorderSitePreset = 'jd' | 'taobao' | 'pinduoduo' | 'custom' | 'all';

export interface RecorderStartOptions {
  mode?: 'steps' | 'investigation';
  sitePreset?: RecorderSitePreset;
  domainAllowlist?: string[];
  includeNetwork?: boolean;
  filterStaticResources?: boolean;
  captureStorageSnapshot?: boolean;
}

export interface InvestigationNetworkRecord {
  requestId: string;
  method: string;
  url: string;
  requestHeaders: Record<string, unknown>;
  requestBody?: string;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, unknown>;
  responseBody?: string;
  responseBodyBase64Encoded?: boolean;
  mimeType?: string;
  resourceType?: string;
  requestTimestamp?: number;
  responseTimestamp?: number;
  finishedTimestamp?: number;
}

export interface InvestigationStorageSnapshot {
  pageUrl?: string;
  pageTitle?: string;
  cookieDomains: string[];
  cookies: InvestigationCookie[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export interface InvestigationCookie {
  name: string;
  value: string;
  domain?: string;
  hostOnly?: boolean;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  session?: boolean;
  expirationDate?: number;
  sameSite?: string;
}

export interface ApiReplayDraft {
  method: string;
  url: string;
  headers: Record<string, unknown>;
  body?: string;
  reason: string;
}

export interface InvestigationRecordingResult {
  kind: 'investigation-recording';
  tabId: number;
  startedAt: string;
  stoppedAt: string;
  sitePreset: RecorderSitePreset;
  domainAllowlist: string[];
  steps: import('./task').TaskStep[];
  network: InvestigationNetworkRecord[];
  storageSnapshot?: InvestigationStorageSnapshot;
  replayDrafts: ApiReplayDraft[];
}
