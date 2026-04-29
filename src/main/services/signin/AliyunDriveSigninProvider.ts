import { buildAliyunDriveSigninScript } from './AliyunDriveLocators';
import type {
  BrowserSigninGateway,
  SigninExecutionContext,
  SigninProviderResult,
  SigninFallbackGateway,
} from './types';
import type { SigninDebugSnapshot } from '@shared/types';

interface AliyunDriveSigninProviderOptions {
  browser: BrowserSigninGateway;
  fallback: SigninFallbackGateway;
  logService?: {
    info(source: 'main', message: string, data?: unknown): void;
  };
}

interface BrowserExecutionResult {
  success?: boolean;
  status?: string;
  failureReason?: SigninProviderResult['failureReason'];
  detail?: string;
  debug?: SigninDebugSnapshot;
}

export class AliyunDriveSigninProvider {
  private readonly browser: BrowserSigninGateway;
  private readonly fallback: SigninFallbackGateway;
  private readonly logService?: AliyunDriveSigninProviderOptions['logService'];

  constructor(options: AliyunDriveSigninProviderOptions) {
    this.browser = options.browser;
    this.fallback = options.fallback;
    this.logService = options.logService;
  }

  async run(context: SigninExecutionContext): Promise<SigninProviderResult> {
    if (context.refreshToken) {
      this.logService?.info('main', 'signin api fallback started', {
        taskId: context.taskId,
        entryUrl: context.entryUrl,
        sessionPartition: context.sessionPartition,
        browserFallbackEnabled: context.browserFallbackEnabled !== false,
      });
      const fallbackResult = await this.fallback.run({ refreshToken: context.refreshToken });
      if (fallbackResult.status === 'success') {
        this.logService?.info('main', 'signin api fallback succeeded', {
          taskId: context.taskId,
          detail: fallbackResult.detail,
        });
        return fallbackResult;
      }

      this.logService?.info('main', 'signin api fallback failed', {
        taskId: context.taskId,
        failureReason: fallbackResult.failureReason ?? 'unknown',
        detail: fallbackResult.detail,
      });

      if (context.browserFallbackEnabled === false) {
        return {
          status: 'needs_intervention',
          strategyUsed: fallbackResult.strategyUsed,
          failureReason: fallbackResult.failureReason ?? 'unknown',
          detail: fallbackResult.detail ?? 'API 未成功，且未启用页面补充',
        };
      }

      const browserFailure = await this.runBrowserFlow(context, 'api_failed');
      if (browserFailure.status === 'success') {
        return browserFailure;
      }

      return {
        ...browserFailure,
        detail: browserFailure.detail ?? fallbackResult.detail ?? 'API 与页面均未成功',
      };
    }

    return this.runBrowserFlow(context, 'no_refresh_token');
  }

  private async runBrowserFlow(
    context: SigninExecutionContext,
    reason: 'api_failed' | 'no_refresh_token',
  ): Promise<SigninProviderResult> {
    this.logService?.info('main', 'signin browser flow started', {
      taskId: context.taskId,
      entryUrl: context.entryUrl,
      sessionPartition: context.sessionPartition,
      reason,
    });
    const view = await this.browser.openSessionPage({
      sessionPartition: context.sessionPartition,
      url: context.entryUrl,
    });

    const browserResult = await this.browser.executeJavaScript(
      buildAliyunDriveSigninScript(),
      view.tabId,
    ) as BrowserExecutionResult;

    if (browserResult?.success) {
      this.logService?.info('main', 'signin browser flow succeeded', {
        taskId: context.taskId,
        detail: browserResult.detail,
      });
      return {
        status: 'success',
        strategyUsed: 'browser',
        detail: browserResult.detail,
      };
    }

    const debug = await this.captureDebugContext(view.tabId);
    const mergedDebug = mergeDebugSnapshot(browserResult?.debug, debug);

    this.logService?.info('main', 'signin browser flow failed', {
      taskId: context.taskId,
      failureReason: browserResult?.failureReason ?? 'unknown',
      detail: browserResult?.detail ?? '页面签到失败，且未配置 API 兜底',
      debug: mergedDebug,
    });

    return {
      status: 'needs_intervention',
      strategyUsed: 'browser',
      failureReason: browserResult?.failureReason ?? 'unknown',
      detail: browserResult?.detail ?? '页面签到失败，且未配置 API 兜底',
      debug: mergedDebug,
    };
  }

  private async captureDebugContext(tabId: number) {
    if (!this.browser.captureDebugContext) {
      return undefined;
    }

    try {
      return await this.browser.captureDebugContext(tabId);
    } catch {
      return undefined;
    }
  }
}

function mergeDebugSnapshot(
  browserDebug?: SigninDebugSnapshot,
  capturedDebug?: SigninDebugSnapshot,
): SigninDebugSnapshot | undefined {
  const merged = {
    ...browserDebug,
    ...capturedDebug,
  };
  return Object.values(merged).some((value) => value !== undefined) ? merged : undefined;
}
