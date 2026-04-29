import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AliyunDriveSigninProvider } from '@main/services/signin/AliyunDriveSigninProvider';
import type { SigninProviderResult } from '@main/services/signin/types';

describe('AliyunDriveSigninProvider', () => {
  const openSessionPage = vi.fn();
  const executeJavaScript = vi.fn();
  const captureDebugContext = vi.fn();
  const fallbackRun = vi.fn<({ refreshToken: string }) => Promise<SigninProviderResult>>();

  beforeEach(() => {
    vi.clearAllMocks();
    openSessionPage.mockResolvedValue({ tabId: 7, webContentsId: 77 });
  });

  it('uses browser flow when no refresh token is configured and short-circuits on success', async () => {
    executeJavaScript.mockResolvedValueOnce({
      success: true,
      status: 'success',
      detail: '今日奖励已领取',
    });

    const provider = new AliyunDriveSigninProvider({
      browser: {
        openSessionPage,
        executeJavaScript,
      } as never,
      fallback: {
        run: fallbackRun,
      },
    });

    const result = await provider.run({
      taskId: 'task-1',
      sessionPartition: 'persist:session_1',
      entryUrl: 'https://www.aliyundrive.com/',
      maxRetryPerDay: 2,
    });

    expect(result).toMatchObject({
      status: 'success',
      strategyUsed: 'browser',
      detail: '今日奖励已领取',
    });
    expect(fallbackRun).not.toHaveBeenCalled();
  });

  it('uses api first when refresh token exists and skips browser on api success', async () => {
    fallbackRun.mockResolvedValueOnce({
      status: 'success',
      strategyUsed: 'api-fallback',
      detail: '本月累计签到 12 天',
    });

    const provider = new AliyunDriveSigninProvider({
      browser: {
        openSessionPage,
        executeJavaScript,
      } as never,
      fallback: {
        run: fallbackRun,
      },
    });

    const result = await provider.run({
      taskId: 'task-1',
      sessionPartition: 'persist:session_1',
      entryUrl: 'https://www.aliyundrive.com/',
      refreshToken: 'rt-demo',
      maxRetryPerDay: 2,
    });

    expect(result).toMatchObject({
      status: 'success',
      strategyUsed: 'api-fallback',
    });
    expect(fallbackRun).toHaveBeenCalledWith({ refreshToken: 'rt-demo' });
    expect(openSessionPage).not.toHaveBeenCalled();
    expect(executeJavaScript).not.toHaveBeenCalled();
  });

  it('falls back to browser when api-first execution fails', async () => {
    fallbackRun.mockResolvedValueOnce({
      status: 'failed',
      strategyUsed: 'api-fallback',
      failureReason: 'api_request_failed',
      detail: '接口异常',
    });
    executeJavaScript.mockResolvedValueOnce({
      success: true,
      status: 'success',
      detail: '今日奖励已领取',
    });

    const provider = new AliyunDriveSigninProvider({
      browser: {
        openSessionPage,
        executeJavaScript,
      } as never,
      fallback: {
        run: fallbackRun,
      },
    });

    const result = await provider.run({
      taskId: 'task-1',
      sessionPartition: 'persist:session_1',
      entryUrl: 'https://www.aliyundrive.com/',
      refreshToken: 'rt-demo',
      maxRetryPerDay: 2,
    });

    expect(result).toMatchObject({
      status: 'success',
      strategyUsed: 'browser',
      detail: '今日奖励已领取',
    });
  });

  it('requests intervention when api and browser both fail', async () => {
    fallbackRun.mockResolvedValueOnce({
      status: 'failed',
      strategyUsed: 'api-fallback',
      failureReason: 'api_request_failed',
      detail: '接口异常',
    });
    executeJavaScript.mockResolvedValueOnce({
      success: false,
      failureReason: 'reward_button_not_found',
      detail: '未找到领取按钮',
    });

    const provider = new AliyunDriveSigninProvider({
      browser: {
        openSessionPage,
        executeJavaScript,
      } as never,
      fallback: {
        run: fallbackRun,
      },
    });

    const result = await provider.run({
      taskId: 'task-1',
      sessionPartition: 'persist:session_1',
      entryUrl: 'https://www.aliyundrive.com/',
      refreshToken: 'rt-demo',
      maxRetryPerDay: 2,
    });

    expect(result).toMatchObject({
      status: 'needs_intervention',
      strategyUsed: 'browser',
      failureReason: 'reward_button_not_found',
      detail: '未找到领取按钮',
    });
  });

  it('captures debug context when browser fallback also fails after api-first failure', async () => {
    fallbackRun.mockResolvedValueOnce({
      status: 'failed',
      strategyUsed: 'api-fallback',
      failureReason: 'api_request_failed',
      detail: '接口异常',
    });
    executeJavaScript.mockResolvedValueOnce({
      success: false,
      failureReason: 'reward_button_not_found',
      detail: '未找到领取按钮',
    });
    captureDebugContext.mockResolvedValueOnce({
      pageUrl: 'https://www.aliyundrive.com/drive',
      pageTitle: '阿里云盘',
      domSummary: '精选活动 4月28日 立即领取',
      screenshotDataUrl: 'data:image/png;base64,provider-debug',
    });

    const provider = new AliyunDriveSigninProvider({
      browser: {
        openSessionPage,
        executeJavaScript,
        captureDebugContext,
      } as never,
      fallback: {
        run: fallbackRun,
      },
    });

    const result = await provider.run({
      taskId: 'task-1',
      sessionPartition: 'persist:session_1',
      entryUrl: 'https://www.aliyundrive.com/',
      refreshToken: 'rt-demo',
      maxRetryPerDay: 2,
    });

    expect(result).toMatchObject({
      status: 'needs_intervention',
      strategyUsed: 'browser',
      failureReason: 'reward_button_not_found',
      debug: {
        pageUrl: 'https://www.aliyundrive.com/drive',
        pageTitle: '阿里云盘',
        domSummary: '精选活动 4月28日 立即领取',
        screenshotDataUrl: 'data:image/png;base64,provider-debug',
      },
    });
  });

  it('merges browser execution diagnostics into the final debug snapshot on failure', async () => {
    fallbackRun.mockResolvedValueOnce({
      status: 'failed',
      strategyUsed: 'api-fallback',
      failureReason: 'api_request_failed',
      detail: '接口异常',
    });
    executeJavaScript.mockResolvedValueOnce({
      success: false,
      failureReason: 'activity_not_found',
      detail: '未找到精选活动区域',
      debug: {
        readyState: 'complete',
        visibilityState: 'hidden',
        viewport: '0x0',
        activityAnchorFound: false,
        signBarCount: 0,
        dateCardCandidateCount: 0,
      },
    });
    captureDebugContext.mockResolvedValueOnce({
      pageUrl: 'https://www.aliyundrive.com/drive/home',
      pageTitle: '阿里云盘',
      domSummary: '文件 最近 活动',
      screenshotDataUrl: 'data:image/png;base64,provider-debug-hidden',
    });

    const provider = new AliyunDriveSigninProvider({
      browser: {
        openSessionPage,
        executeJavaScript,
        captureDebugContext,
      } as never,
      fallback: {
        run: fallbackRun,
      },
    });

    const result = await provider.run({
      taskId: 'task-1',
      sessionPartition: 'persist:session_1',
      entryUrl: 'https://www.aliyundrive.com/',
      refreshToken: 'rt-demo',
      maxRetryPerDay: 2,
    });

    expect(result).toMatchObject({
      status: 'needs_intervention',
      strategyUsed: 'browser',
      failureReason: 'activity_not_found',
      debug: {
        pageUrl: 'https://www.aliyundrive.com/drive/home',
        pageTitle: '阿里云盘',
        domSummary: '文件 最近 活动',
        screenshotDataUrl: 'data:image/png;base64,provider-debug-hidden',
        readyState: 'complete',
        visibilityState: 'hidden',
        viewport: '0x0',
        activityAnchorFound: false,
        signBarCount: 0,
        dateCardCandidateCount: 0,
      },
    });
  });
});
