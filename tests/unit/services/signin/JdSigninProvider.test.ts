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

  it('uses sign_query signList as authoritative today-signed signal and skips execute', async () => {
    const browser = createBrowserGateway({
      success: true,
      alreadySigned: true,
      earnedBeans: 0,
      balance: 2,
      balanceStr: '0.02',
    });
    const todayPrefix = (() => {
      const d = new Date();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    })();
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
      }))
      .mockResolvedValueOnce(createJsonResponse({
        success: true,
        data: {
          assignmentInfoList: [
            {
              id: 'dynamic-eaid-xyz',
              name: 'PC签到领京豆',
              type: 5,
              extraType: 'sign',
              signType: 1,
              completionFlag: true,
              signDetail: {
                itemId: '1',
                continueSignDay: 2,
                signList: [`${todayPrefix}_1.0`],
              },
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

    expect(browser.fetchWithSession).toHaveBeenCalledTimes(3);
    expect(browser.openSessionPage).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'success',
      detail: '京东今日已签到，当前余额 2 京豆，已连续签到 2 天',
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
          assignmentInfoList: [
            {
              id: 'dynamic-eaid-xyz',
              name: 'PC签到领京豆',
              type: 5,
              extraType: 'sign',
              signType: 1,
              completionFlag: false,
              signDetail: { itemId: '1' },
            },
          ],
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

    expect(browser.fetchWithSession).toHaveBeenCalledTimes(6);
    expect(browser.fetchWithSession).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        url: expect.stringContaining('functionId=pc_interact_sign_query'),
      }),
    );
    expect(browser.fetchWithSession).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        url: expect.stringContaining('functionId=pc_interact_sign_execute'),
        body: expect.stringContaining('dynamic-eaid-xyz'),
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

  it('short-circuits when sign query reports completionFlag=true and skips execute', async () => {
    const browser = createBrowserGateway({
      success: false,
      failureReason: 'api_request_failed',
      detail: 'should-not-fall-back',
    });
    browser.fetchWithSession = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: { balance: 5, balanceStr: '0.05' },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: { list: [] },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        success: true,
        data: {
          assignmentInfoList: [
            {
              id: 'dynamic-eaid-xyz',
              name: 'PC签到领京豆',
              type: 5,
              extraType: 'sign',
              signType: 1,
              completionFlag: true,
              signDetail: { itemId: '1' },
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

    expect(browser.fetchWithSession).toHaveBeenCalledTimes(3);
    expect(browser.openSessionPage).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'success',
      strategyUsed: 'api-fallback',
      detail: '京东今日已签到，当前余额 5 京豆',
    });
  });

  it('falls back to browser when execute returns errCode 302 without verifiable proof', async () => {
    const browser = createBrowserGateway({
      success: true,
      alreadySigned: true,
      earnedBeans: 0,
      balance: 0,
      balanceStr: '0',
    });
    browser.fetchWithSession = vi
      .fn()
      // before snapshot
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: { balance: 0, balanceStr: '0' },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: { list: [] },
      }))
      // sign query: task exists, completionFlag false (drives execute)
      .mockResolvedValueOnce(createJsonResponse({
        success: true,
        data: {
          assignmentInfoList: [
            {
              id: 'dynamic-eaid-xyz',
              name: 'PC签到领京豆',
              type: 5,
              extraType: 'sign',
              signType: 1,
              completionFlag: false,
              signDetail: { itemId: '1' },
            },
          ],
        },
      }))
      // execute: misjudge errCode 302
      .mockResolvedValueOnce(createJsonResponse({
        success: false,
        errCode: '302',
        errMessage: '任务已完成',
      }))
      // after snapshot: balance unchanged, no signin detail today
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: { balance: 0, balanceStr: '0' },
      }))
      .mockResolvedValueOnce(createJsonResponse({
        code: '0000',
        data: { list: [] },
      }))
      // recheck sign query: still completionFlag false → no proof, fall back
      .mockResolvedValueOnce(createJsonResponse({
        success: true,
        data: {
          assignmentInfoList: [
            {
              id: 'dynamic-eaid-xyz',
              name: 'PC签到领京豆',
              type: 5,
              extraType: 'sign',
              signType: 1,
              completionFlag: false,
              signDetail: { itemId: '1' },
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

    // API misjudge → fall back to browser execution
    expect(browser.openSessionPage).toHaveBeenCalled();
    expect(result.strategyUsed).toBe('browser');
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
