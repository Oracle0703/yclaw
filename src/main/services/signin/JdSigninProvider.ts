import type {
  BrowserSigninGateway,
  SigninExecutionContext,
  SigninProviderResult,
} from './types';

interface JdSigninProviderOptions {
  browser: BrowserSigninGateway;
  logService?: {
    info(source: 'main', message: string, data?: unknown): void;
  };
}

interface JdBrowserExecutionResult {
  success?: boolean;
  alreadySigned?: boolean;
  earnedBeans?: number;
  balance?: number;
  balanceStr?: string;
  detailText?: string;
  failureReason?: SigninProviderResult['failureReason'];
  detail?: string;
}

interface JdApiSnapshot {
  balance: { balance: number; balanceStr?: string } | null;
  latestDetail: { detailText?: string; amount?: number; createDate?: number } | null;
  recentSigninRewardToday: boolean;
}

const DEFAULT_JD_SIGNIN_URL = 'https://interact.jd.com/';
const JD_SIGNIN_EXECUTE_BODY = {
  type: 5,
  eaId: '4KpUNjgQZtanUeeqbhMYjT47b9Fo',
  itemId: '1',
  extraType: 'sign',
};

export class JdSigninProvider {
  private readonly browser: BrowserSigninGateway;
  private readonly logService?: JdSigninProviderOptions['logService'];

  constructor(options: JdSigninProviderOptions) {
    this.browser = options.browser;
    this.logService = options.logService;
  }

  async run(context: SigninExecutionContext): Promise<SigninProviderResult> {
    const apiSnapshot = await this.tryReadApiSnapshot(context);
    if (apiSnapshot?.recentSigninRewardToday) {
      const balance = apiSnapshot.balance?.balance ?? 0;
      return {
        status: 'success',
        strategyUsed: 'api-fallback',
        detail: `京东今日已签到，当前余额 ${balance} 京豆`,
        reward: {
          earnedBeans: 0,
          balance,
          balanceStr: apiSnapshot.balance?.balanceStr,
          detailText: apiSnapshot.latestDetail?.detailText,
        },
      };
    }

    const apiResult = await this.tryExecuteApiSignin(context, apiSnapshot);
    if (apiResult) {
      return apiResult;
    }

    this.logService?.info('main', 'jd signin browser flow started', {
      taskId: context.taskId,
      entryUrl: context.entryUrl,
      sessionPartition: context.sessionPartition,
    });

    const view = await this.browser.openSessionPage({
      sessionPartition: context.sessionPartition,
      url: context.entryUrl || DEFAULT_JD_SIGNIN_URL,
    });

    const result = await this.browser.executeJavaScript(
      buildJdSigninScript(),
      view.tabId,
    ) as JdBrowserExecutionResult;

    if (result?.success) {
      const detail = formatSuccessDetail(result);
      this.logService?.info('main', 'jd signin browser flow succeeded', {
        taskId: context.taskId,
        detail,
        earnedBeans: result.earnedBeans ?? 0,
        balance: result.balance,
      });
      return {
        status: 'success',
        strategyUsed: 'browser',
        detail,
        reward: {
          earnedBeans: normalizeNumber(result.earnedBeans),
          balance: normalizeNumber(result.balance),
          balanceStr: result.balanceStr,
          detailText: result.detailText,
        },
      };
    }

    return {
      status: 'needs_intervention',
      strategyUsed: 'browser',
      failureReason: result?.failureReason ?? 'unknown',
      detail: result?.detail ?? '京东签到未能完成，请重新录制或检查登录态',
    };
  }

  private async tryReadApiSnapshot(context: SigninExecutionContext): Promise<JdApiSnapshot | null> {
    if (!this.browser.fetchWithSession) {
      return null;
    }

    try {
      const [balancePayload, detailsPayload] = await Promise.all([
        this.postJdApi(context, 'BEAN_BALANCE', {}),
        this.postJdApi(context, 'BEAN_DETAILS_NOCNT', {
          pageNo: 1,
          pageSize: 10,
          dataType: 0,
        }),
      ]);
      const balanceValue = balancePayload?.data?.balance;
      const balance = typeof balanceValue === 'number'
        ? {
            balance: balanceValue,
            balanceStr: typeof balancePayload.data.balanceStr === 'string'
              ? balancePayload.data.balanceStr
              : undefined,
          }
        : null;
      const firstDetail = Array.isArray(detailsPayload?.data?.list)
        ? detailsPayload.data.list[0]
        : null;
      const latestDetail = firstDetail && typeof firstDetail === 'object'
        ? {
            detailText: typeof firstDetail.userVisibleInfo === 'string'
              ? firstDetail.userVisibleInfo
              : undefined,
            amount: typeof firstDetail.amount === 'number'
              ? firstDetail.amount
              : typeof firstDetail.amountLong === 'number'
                ? firstDetail.amountLong
                : undefined,
            createDate: typeof firstDetail.createDate === 'number'
              ? firstDetail.createDate
              : undefined,
          }
        : null;
      return {
        balance,
        latestDetail,
        recentSigninRewardToday:
          isToday(latestDetail?.createDate) &&
          latestDetail?.detailText === '活动奖励京豆' &&
          typeof latestDetail.amount === 'number' &&
          latestDetail.amount > 0,
      };
    } catch {
      return null;
    }
  }

  private async tryExecuteApiSignin(
    context: SigninExecutionContext,
    beforeSnapshot: JdApiSnapshot | null,
  ): Promise<SigninProviderResult | null> {
    if (!this.browser.fetchWithSession) {
      return null;
    }

    this.logService?.info('main', 'jd signin api flow started', {
      taskId: context.taskId,
      sessionPartition: context.sessionPartition,
    });

    try {
      const executePayload = await this.postJdApi(
        context,
        'pc_interact_sign_execute',
        JD_SIGNIN_EXECUTE_BODY,
        {
          appid: 'pc_interact_center',
          origin: 'https://interact.jd.com',
          referer: 'https://interact.jd.com/',
        },
      );
      const success = executePayload?.success === true;
      const alreadyCompleted =
        executePayload?.errCode === '302' ||
        (typeof executePayload?.errMessage === 'string' &&
          executePayload.errMessage.includes('已完成'));
      if (!success && !alreadyCompleted) {
        this.logService?.info('main', 'jd signin api flow failed', {
          taskId: context.taskId,
          failureReason: 'api_request_failed',
          detail: extractJdApiErrorMessage(executePayload),
        });
        return null;
      }

      const afterSnapshot = await this.tryReadApiSnapshot(context);
      const beforeBalance = beforeSnapshot?.balance?.balance;
      const afterBalance = afterSnapshot?.balance?.balance;
      const latestDetail = afterSnapshot?.latestDetail ?? null;
      const detailEarned = afterSnapshot?.recentSigninRewardToday
        ? normalizeNumber(latestDetail?.amount)
        : undefined;
      const balanceDelta =
        typeof beforeBalance === 'number' && typeof afterBalance === 'number'
          ? Math.max(0, afterBalance - beforeBalance)
          : undefined;
      const rewardEarned = extractRewardBeans(executePayload);
      const earnedBeans = detailEarned ?? balanceDelta ?? rewardEarned ?? 0;
      const balance = afterBalance ?? beforeBalance ?? 0;
      const detail = alreadyCompleted || earnedBeans <= 0
        ? `京东今日已签到，当前余额 ${balance} 京豆`
        : `京东签到成功，本次获得 ${earnedBeans} 京豆，当前余额 ${balance} 京豆`;

      this.logService?.info('main', 'jd signin api flow succeeded', {
        taskId: context.taskId,
        detail,
        earnedBeans,
        balance,
      });

      return {
        status: 'success',
        strategyUsed: 'api-fallback',
        detail,
        reward: {
          earnedBeans,
          balance,
          balanceStr: afterSnapshot?.balance?.balanceStr ?? beforeSnapshot?.balance?.balanceStr,
          detailText: latestDetail?.detailText,
        },
      };
    } catch (error) {
      this.logService?.info('main', 'jd signin api flow failed', {
        taskId: context.taskId,
        failureReason: 'api_request_failed',
        detail: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async postJdApi(
    context: SigninExecutionContext,
    functionId: string,
    body: Record<string, unknown>,
    options?: {
      appid?: string;
      origin?: string;
      referer?: string;
    },
  ): Promise<Record<string, any>> {
    if (!this.browser.fetchWithSession) {
      throw new Error('fetchWithSession is not available');
    }
    const appid = options?.appid ?? 'asset-h5';
    const form = new URLSearchParams();
    form.set('appid', appid);
    form.set('loginType', '3');
    form.set('functionId', functionId);
    form.set('body', JSON.stringify(body));
    form.set('client', 'pc');
    form.set('_t', String(Date.now()));
    const response = await this.browser.fetchWithSession({
      sessionPartition: context.sessionPartition,
      url: `https://api.m.jd.com/api?functionId=${encodeURIComponent(functionId)}&appid=${encodeURIComponent(appid)}`,
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        origin: options?.origin ?? 'https://bean.jd.com',
        referer: options?.referer ?? 'https://bean.jd.com/myJingBean/list',
      },
      body: form.toString(),
    });
    const text = await response.text();
    return JSON.parse(text) as Record<string, any>;
  }
}

export function buildJdSigninScript(): string {
  return `
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      async function postJdApi(functionId, body) {
        const form = new URLSearchParams();
        form.set('appid', 'asset-h5');
        form.set('loginType', '3');
        form.set('functionId', functionId);
        form.set('body', JSON.stringify(body || {}));
        form.set('client', 'pc');
        form.set('_t', String(Date.now()));
        const response = await fetch('https://api.m.jd.com/api?functionId=' + encodeURIComponent(functionId) + '&appid=asset-h5', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: form.toString(),
        });
        return await response.json();
      }

      async function readBalance() {
        const payload = await postJdApi('BEAN_BALANCE', {});
        const balance = payload && payload.data && typeof payload.data.balance === 'number'
          ? payload.data.balance
          : null;
        if (balance === null) {
          throw new Error('京豆余额查询失败');
        }
        return {
          balance,
          balanceStr: payload.data.balanceStr || String(balance),
        };
      }

      async function readLatestDetail() {
        try {
          const payload = await postJdApi('BEAN_DETAILS_NOCNT', {
            pageNo: 1,
            pageSize: 10,
            dataType: 0,
          });
          const first = payload && payload.data && Array.isArray(payload.data.list)
            ? payload.data.list[0]
            : null;
          if (!first) {
            return null;
          }
          return {
            detailText: first.userVisibleInfo || '',
            amount: typeof first.amount === 'number' ? first.amount : first.amountLong,
          };
        } catch {
          return null;
        }
      }

      function isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      }

      function textOf(element) {
        return (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim();
      }

      function findSigninCard() {
        const candidates = Array.from(document.querySelectorAll('body *')).filter((element) => {
          const text = textOf(element);
          return text.includes('PC签到领京豆') && isVisible(element);
        });
        return candidates.sort((a, b) => textOf(a).length - textOf(b).length)[0] || null;
      }

      function clickSignin(card) {
        const clickables = Array.from(card.querySelectorAll('button,a,[role="button"],div,span,img')).filter(isVisible);
        const preferred = clickables.find((element) => {
          const text = textOf(element);
          return /签到|领取|去完成/.test(text) && !/已签到|规则|抽奖/.test(text);
        });
        const target = preferred || clickables[clickables.length - 1] || card;
        target.click();
      }

      try {
        const before = await readBalance();
        await sleep(800);
        const card = findSigninCard();
        if (!card) {
          return {
            success: false,
            failureReason: 'activity_not_found',
            detail: '未找到 PC签到领京豆 区域',
          };
        }

        const cardText = textOf(card);
        if (/已签到|已领取|明天再来/.test(cardText)) {
          return {
            success: true,
            alreadySigned: true,
            earnedBeans: 0,
            balance: before.balance,
            balanceStr: before.balanceStr,
          };
        }

        clickSignin(card);
        await sleep(2500);

        const after = await readBalance();
        const detail = await readLatestDetail();
        const earnedBeans = Math.max(0, after.balance - before.balance);
        return {
          success: true,
          alreadySigned: earnedBeans === 0,
          earnedBeans,
          balance: after.balance,
          balanceStr: after.balanceStr,
          detailText: detail && detail.detailText ? detail.detailText : undefined,
        };
      } catch (error) {
        return {
          success: false,
          failureReason: 'api_request_failed',
          detail: error && error.message ? error.message : '京东签到执行失败',
        };
      }
    })();
  `;
}

function formatSuccessDetail(result: JdBrowserExecutionResult): string {
  const balance = normalizeNumber(result.balance) ?? 0;
  const earnedBeans = normalizeNumber(result.earnedBeans) ?? 0;
  if (result.alreadySigned || earnedBeans <= 0) {
    return `京东今日已签到，当前余额 ${balance} 京豆`;
  }
  return `京东签到成功，本次获得 ${earnedBeans} 京豆，当前余额 ${balance} 京豆`;
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function extractRewardBeans(payload: Record<string, any>): number | undefined {
  const rewards = payload?.data?.assignmentRewardInfo?.jingDouRewards;
  if (!Array.isArray(rewards)) {
    return undefined;
  }
  const total = rewards.reduce((sum: number, reward: unknown) => {
    if (!reward || typeof reward !== 'object') {
      return sum;
    }
    const quantity = normalizeNumber((reward as { quantity?: unknown }).quantity);
    return typeof quantity === 'number' ? sum + quantity : sum;
  }, 0);
  return total > 0 ? total : undefined;
}

function extractJdApiErrorMessage(payload: Record<string, any>): string {
  const message = payload?.errMessage ?? payload?.message ?? payload?.msg;
  return typeof message === 'string' && message.trim().length > 0
    ? message
    : '京东签到 API 调用失败';
}

function isToday(timestamp: number | undefined): boolean {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return false;
  }
  const value = new Date(timestamp);
  const now = new Date();
  return value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate();
}
