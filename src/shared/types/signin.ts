export type SigninSite = 'jd';

export type SigninTaskKind = 'jd-signin';

export type SigninFailureReason =
  | 'session_expired'
  | 'activity_not_found'
  | 'api_request_failed'
  | 'unknown';

export type SigninRunStatus =
  | 'pending'
  | 'running_browser'
  | 'running_api_fallback'
  | 'retry_scheduled'
  | 'needs_intervention'
  | 'success'
  | 'failed';

export interface SigninCaptureDiagnostics {
  pageUrl?: string | null;
  pageTitle?: string | null;
  localStorageKeys?: string[];
  sessionStorageKeys?: string[];
  cookieDomains?: string[];
  networkResponseCount?: number;
  tokenHintResponseUrls?: string[];
}

export interface SigninLoginSnapshot {
  userName?: string | null;
  userId?: string | null;
  localStorageSnapshot?: Record<string, string> | null;
  captureDiagnostics?: SigninCaptureDiagnostics | null;
}

export interface SigninTaskConfig extends SigninLoginSnapshot {
  site: SigninSite;
  mode: 'api-first-browser-fallback' | 'browser-first-api-fallback';
  fallbackApiEnabled: boolean;
  maxRetryPerDay: number;
  manualInterventionEnabled: true;
}

export interface SigninDebugSnapshot {
  pageUrl?: string;
  pageTitle?: string;
  domSummary?: string;
  readyState?: string;
  visibilityState?: string;
  viewport?: string;
  screenshotDataUrl?: string;
}

export interface SigninRunSummary {
  taskId: string;
  status: SigninRunStatus;
  strategyUsed?: 'browser' | 'api-fallback' | 'manual-retry';
  failureReason?: SigninFailureReason;
  detail?: string;
  debug?: SigninDebugSnapshot;
  reward?: SigninRewardSummary;
  runAt: string;
  retryCount: number;
}

export interface SigninRewardSummary {
  earnedBeans?: number;
  balance?: number;
  balanceStr?: string;
  detailText?: string;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  to: string[];
}
