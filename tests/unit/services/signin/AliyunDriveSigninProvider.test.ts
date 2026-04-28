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

  it('uses browser flow first and short-circuits on success', async () => {
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

  it('falls back to api when browser cannot find reward button', async () => {
    executeJavaScript.mockResolvedValueOnce({
      success: false,
      failureReason: 'reward_button_not_found',
      detail: '未找到领取按钮',
    });
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
      failureReason: 'reward_button_not_found',
    });
    expect(fallbackRun).toHaveBeenCalledWith({ refreshToken: 'rt-demo' });
  });

  it('requests intervention when browser and api both fail', async () => {
    executeJavaScript.mockResolvedValueOnce({
      success: false,
      failureReason: 'reward_button_not_found',
      detail: '未找到领取按钮',
    });
    fallbackRun.mockResolvedValueOnce({
      status: 'failed',
      strategyUsed: 'api-fallback',
      failureReason: 'api_request_failed',
      detail: '接口异常',
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
      failureReason: 'api_request_failed',
      detail: expect.stringContaining('接口异常'),
    });
  });

  it('captures debug context when browser flow fails before api fallback succeeds', async () => {
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
    fallbackRun.mockResolvedValueOnce({
      status: 'success',
      strategyUsed: 'api-fallback',
      detail: '本月累计签到 12 天',
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

    expect(captureDebugContext).toHaveBeenCalledWith(7);
    expect(result).toMatchObject({
      status: 'success',
      strategyUsed: 'api-fallback',
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
    fallbackRun.mockResolvedValueOnce({
      status: 'failed',
      strategyUsed: 'api-fallback',
      failureReason: 'api_request_failed',
      detail: '接口异常',
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
      failureReason: 'api_request_failed',
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
