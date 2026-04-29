import type {
  SigninDebugSnapshot,
  SigninFailureReason,
  SigninRunStatus,
  SigninTaskConfig,
} from '@shared/types';

export interface SigninExecutionContext {
  taskId: string;
  sessionPartition: string;
  entryUrl: string;
  refreshToken?: string | null;
  browserFallbackEnabled?: boolean;
  maxRetryPerDay: number;
}

export interface SigninProviderResult {
  status: SigninRunStatus;
  strategyUsed?: 'browser' | 'api-fallback' | 'manual-retry';
  failureReason?: SigninFailureReason;
  detail?: string;
  debug?: SigninDebugSnapshot;
}

export interface BrowserSigninGateway {
  openSessionPage(input: {
    sessionPartition: string;
    url: string;
  }): Promise<{ tabId: number; webContentsId: number }>;
  executeJavaScript(script: string, tabId: number): Promise<unknown>;
  captureDebugContext?(tabId: number): Promise<SigninDebugSnapshot | undefined>;
}

export interface SigninFallbackGateway {
  run(input: { refreshToken: string }): Promise<SigninProviderResult>;
}

export interface SigninTaskDraft {
  name: string;
  entryUrl: string;
  sessionId?: string | null;
  enabled?: boolean;
  signin: SigninTaskConfig;
}
