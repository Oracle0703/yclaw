export type SigninTaskKind = 'aliyundrive-signin';

export type SigninFailureReason =
  | 'session_expired'
  | 'activity_not_found'
  | 'date_card_not_found'
  | 'reward_button_not_found'
  | 'already_claimed'
  | 'api_token_invalid'
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

export interface SigninLoginSnapshot {
  refreshToken?: string | null;
  accessToken?: string | null;
  userName?: string | null;
  userId?: string | null;
  defaultDriveId?: string | null;
  expiresAt?: string | null;
  tokenType?: string | null;
  tokenPayload?: Record<string, unknown> | null;
  localStorageSnapshot?: Record<string, string> | null;
}

export interface SigninTaskConfig extends SigninLoginSnapshot {
  site: 'aliyundrive';
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
  activityAnchorFound?: boolean;
  signBarCount?: number;
  dateCardCandidateCount?: number;
  screenshotDataUrl?: string;
}

export interface SigninRunSummary {
  taskId: string;
  status: SigninRunStatus;
  strategyUsed?: 'browser' | 'api-fallback' | 'manual-retry';
  failureReason?: SigninFailureReason;
  detail?: string;
  debug?: SigninDebugSnapshot;
  runAt: string;
  retryCount: number;
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
