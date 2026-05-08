import type {
  SigninDebugSnapshot,
  SigninFailureReason,
  SigninRewardSummary,
  SigninRunStatus,
  SigninSite,
  SigninTaskConfig,
} from '@shared/types';

export interface SigninExecutionContext {
  taskId: string;
  site: SigninSite;
  sessionPartition: string;
  entryUrl: string;
  browserFallbackEnabled?: boolean;
  maxRetryPerDay: number;
}

export interface SigninProviderResult {
  status: SigninRunStatus;
  strategyUsed?: 'browser' | 'api-fallback' | 'manual-retry';
  failureReason?: SigninFailureReason;
  detail?: string;
  debug?: SigninDebugSnapshot;
  reward?: SigninRewardSummary;
}

export interface BrowserSigninGateway {
  openSessionPage(input: {
    sessionPartition: string;
    url: string;
  }): Promise<{ tabId: number; webContentsId: number }>;
  executeJavaScript(script: string, tabId: number): Promise<unknown>;
  captureDebugContext?(tabId: number): Promise<SigninDebugSnapshot | undefined>;
  fetchWithSession?(input: {
    sessionPartition: string;
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
  }>;
}

export interface SigninFallbackGateway {
  run(input: Record<string, never>): Promise<SigninProviderResult>;
}

export interface SigninTaskDraft {
  name: string;
  entryUrl: string;
  sessionId?: string | null;
  enabled?: boolean;
  signin: SigninTaskConfig;
}
