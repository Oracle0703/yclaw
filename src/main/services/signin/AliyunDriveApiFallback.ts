import type { SigninProviderResult } from './types';

const AUTH_URL = 'https://auth.aliyundrive.com/v2/account/token';
const SIGNIN_URL = 'https://member.aliyundrive.com/v1/activity/sign_in_list';
const REWARD_URL = 'https://member.aliyundrive.com/v1/activity/sign_in_reward?_rx-s=mobile';

interface AliyunDriveApiFallbackOptions {
  fetch?: typeof fetch;
}

export class AliyunDriveApiFallback {
  private readonly fetchImpl: typeof fetch;

  constructor(options: AliyunDriveApiFallbackOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async run(input: { refreshToken: string }): Promise<SigninProviderResult> {
    try {
      const tokenData = await this.postJson(AUTH_URL, {
        grant_type: 'refresh_token',
        refresh_token: input.refreshToken,
      });

      const accessToken = typeof tokenData?.access_token === 'string'
        ? tokenData.access_token
        : null;
      if (!accessToken) {
        return {
          status: 'failed',
          strategyUsed: 'api-fallback',
          failureReason: 'api_token_invalid',
          detail: 'refresh_token 无效或已失效',
        };
      }

      const signInData = await this.postJson(
        SIGNIN_URL,
        { '_rx-s': 'mobile' },
        { Authorization: `Bearer ${accessToken}` },
      );
      const signInCount = Number(signInData?.result?.signInCount ?? 0);

      const rewardData = await this.postJson(
        REWARD_URL,
        { signInDay: signInCount },
        { Authorization: `Bearer ${accessToken}` },
      );

      const rewardName = typeof rewardData?.result?.name === 'string' ? rewardData.result.name : '';
      const rewardDescription = typeof rewardData?.result?.description === 'string'
        ? rewardData.result.description
        : '';

      return {
        status: 'success',
        strategyUsed: 'api-fallback',
        detail: `本月累计签到 ${signInCount} 天${rewardName || rewardDescription ? ` - ${[rewardName, rewardDescription].filter(Boolean).join(' ')}` : ''}`,
      };
    } catch (error) {
      return {
        status: 'failed',
        strategyUsed: 'api-fallback',
        failureReason: 'api_request_failed',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async postJson(
    url: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
  ): Promise<Record<string, any>> {
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as Record<string, any>;
    if (!response.ok) {
      const message = typeof data?.message === 'string'
        ? data.message
        : `${response.status} ${response.statusText}`;
      throw new Error(message);
    }
    return data;
  }
}
