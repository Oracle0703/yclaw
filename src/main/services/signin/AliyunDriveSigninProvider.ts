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

  constructor(options: AliyunDriveSigninProviderOptions) {
    this.browser = options.browser;
    this.fallback = options.fallback;
  }

  async run(context: SigninExecutionContext): Promise<SigninProviderResult> {
    const view = await this.browser.openSessionPage({
      sessionPartition: context.sessionPartition,
      url: context.entryUrl,
    });

    const browserResult = await this.browser.executeJavaScript(
      buildAliyunDriveSigninScript(),
      view.tabId,
    ) as BrowserExecutionResult;

    if (browserResult?.success) {
      return {
        status: 'success',
        strategyUsed: 'browser',
        detail: browserResult.detail,
      };
    }

    const debug = await this.captureDebugContext(view.tabId);
    const mergedDebug = mergeDebugSnapshot(browserResult?.debug, debug);

    if (context.refreshToken) {
      const fallbackResult = await this.fallback.run({ refreshToken: context.refreshToken });
      if (fallbackResult.status === 'success') {
        return {
          ...fallbackResult,
          failureReason: browserResult?.failureReason,
          debug: mergedDebug,
        };
      }

      return {
        status: 'needs_intervention',
        strategyUsed: fallbackResult.strategyUsed,
        failureReason: fallbackResult.failureReason ?? browserResult?.failureReason ?? 'unknown',
        detail: fallbackResult.detail ?? browserResult?.detail ?? '页面与 API 均未成功',
        debug: mergedDebug,
      };
    }

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
