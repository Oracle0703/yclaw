import { describe, expect, it, vi } from 'vitest';
import { JdSigninProvider } from '@main/services/signin/JdSigninProvider';
import type { BrowserSigninGateway } from '@main/services/signin/types';

describe('JdSigninProvider', () => {
  it('returns earned beans and current balance after a successful browser execution', async () => {
    const browser = createBrowserGateway({
      success: true,
      alreadySigned: false,
      earnedBeans: 2,
      balance: 2,
      balanceStr: '0.02',
      detailText: '活动奖励京豆',
    });
    const provider = new JdSigninProvider({ browser });

    const result = await provider.run({
      taskId: 'task-jd',
      site: 'jd',
      sessionPartition: 'persist:jd',
      entryUrl: 'https://interact.jd.com/',
      maxRetryPerDay: 1,
    });

    expect(browser.openSessionPage).toHaveBeenCalledWith({
      sessionPartition: 'persist:jd',
      url: 'https://interact.jd.com/',
    });
    expect(result).toMatchObject({
      status: 'success',
      strategyUsed: 'browser',
      detail: '京东签到成功，本次获得 2 京豆，当前余额 2 京豆',
      reward: {
        earnedBeans: 2,
        balance: 2,
        balanceStr: '0.02',
        detailText: '活动奖励京豆',
      },
    });
  });

  it('reports already signed and keeps the current balance', async () => {
    const browser = createBrowserGateway({
      success: true,
      alreadySigned: true,
      earnedBeans: 0,
      balance: 2,
      balanceStr: '0.02',
    });
    const provider = new JdSigninProvider({ browser });

    const result = await provider.run({
      taskId: 'task-jd',
      site: 'jd',
      sessionPartition: 'default',
      entryUrl: 'https://interact.jd.com/',
      maxRetryPerDay: 1,
    });

    expect(result).toMatchObject({
      status: 'success',
      detail: '京东今日已签到，当前余额 2 京豆',
      reward: {
        earnedBeans: 0,
        balance: 2,
      },
    });
  });

  it('uses session API first and does not open a page when recent bean detail already proves today signed', async () => {
    const browser = createBrowserGateway({
      success: true,
      alreadySigned: true,
      earnedBeans: 0,
      balance: 2,
      balanceStr: '0.02',
    });
    browser.fetchWithSession = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: {
          balance: 2,
          balanceStr: '0.02',
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: {
          list: [
            {
              userVisibleInfo: '活动奖励京豆',
              amount: 2,
              createDate: Date.now(),
            },
          ],
        },
      }));
    const provider = new JdSigninProvider({ browser });

    const result = await provider.run({
      taskId: 'task-jd',
      site: 'jd',
      sessionPartition: 'default',
      entryUrl: 'https://interact.jd.com/',
      maxRetryPerDay: 1,
    });

    expect(browser.fetchWithSession).toHaveBeenCalledTimes(2);
    expect(browser.openSessionPage).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'success',
      detail: '京东今日已签到，当前余额 2 京豆',
      reward: {
        earnedBeans: 0,
        balance: 2,
        balanceStr: '0.02',
        detailText: '活动奖励京豆',
      },
    });
  });

  it('executes JD sign-in through session API before opening a page', async () => {
    const browser = createBrowserGateway({
      success: true,
      alreadySigned: false,
      earnedBeans: 2,
      balance: 2,
      balanceStr: '0.02',
      detailText: '活动奖励京豆',
    });
    browser.fetchWithSession = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: {
          balance: 0,
          balanceStr: '0',
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: {
          list: [],
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        success: true,
        data: {
          assignmentRewardInfo: {
            jingDouRewards: [
              {
                rewardName: '2京豆',
                quantity: 2,
              },
            ],
          },
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: {
          balance: 2,
          balanceStr: '0.02',
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: {
          list: [
            {
              userVisibleInfo: '活动奖励京豆',
              amount: 2,
              createDate: Date.now(),
            },
          ],
        },
      }));
    const provider = new JdSigninProvider({ browser });

    const result = await provider.run({
      taskId: 'task-jd',
      site: 'jd',
      sessionPartition: 'default',
      entryUrl: 'https://interact.jd.com/',
      maxRetryPerDay: 1,
    });

    expect(browser.fetchWithSession).toHaveBeenCalledTimes(5);
    expect(browser.fetchWithSession).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        url: expect.stringContaining('functionId=pc_interact_sign_execute'),
        body: expect.stringContaining('pc_interact_sign_execute'),
      }),
    );
    expect(browser.openSessionPage).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'success',
      strategyUsed: 'api-fallback',
      detail: '京东签到成功，本次获得 2 京豆，当前余额 2 京豆',
      reward: {
        earnedBeans: 2,
        balance: 2,
        balanceStr: '0.02',
        detailText: '活动奖励京豆',
      },
    });
  });

  it('requires intervention when the browser execution cannot read the balance', async () => {
    const browser = createBrowserGateway({
      success: false,
      failureReason: 'api_request_failed',
      detail: '京豆余额查询失败',
    });
    const provider = new JdSigninProvider({ browser });

    const result = await provider.run({
      taskId: 'task-jd',
      site: 'jd',
      sessionPartition: 'default',
      entryUrl: 'https://interact.jd.com/',
      maxRetryPerDay: 1,
    });

    expect(result).toMatchObject({
      status: 'needs_intervention',
      strategyUsed: 'browser',
      failureReason: 'api_request_failed',
      detail: '京豆余额查询失败',
    });
  });
});

function createBrowserGateway(result: unknown): BrowserSigninGateway {
  return {
    openSessionPage: vi.fn().mockResolvedValue({ tabId: 101, webContentsId: 101 }),
    executeJavaScript: vi.fn().mockResolvedValue(result),
  };
}

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
  };
}
