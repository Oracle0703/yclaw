import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AliyunDriveApiFallback } from '@main/services/signin/AliyunDriveApiFallback';

describe('AliyunDriveApiFallback', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success when sign-in and reward both succeed', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          access_token: 'access-token',
          user_name: '138****0000',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          result: {
            signInCount: 12,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          result: {
            name: '奖励',
            description: '签到成功',
          },
        }),
      });

    const fallback = new AliyunDriveApiFallback({
      fetch: fetchMock as typeof fetch,
    });

    const result = await fallback.run({
      refreshToken: 'rt-demo',
    });

    expect(result).toMatchObject({
      status: 'success',
      strategyUsed: 'api-fallback',
      detail: expect.stringContaining('本月累计签到 12 天'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('classifies invalid refresh token as api_token_invalid', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        message: 'bad token',
      }),
    });

    const fallback = new AliyunDriveApiFallback({
      fetch: fetchMock as typeof fetch,
    });

    await expect(fallback.run({ refreshToken: 'bad-token' })).resolves.toMatchObject({
      status: 'failed',
      strategyUsed: 'api-fallback',
      failureReason: 'api_token_invalid',
    });
  });

  it('uses captured access token directly before trying refresh token', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          success: true,
          result: {
            signInCount: 7,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          success: true,
          result: {
            name: '7天奖励',
            description: '领取成功',
          },
        }),
      });

    const fallback = new AliyunDriveApiFallback({
      fetch: fetchMock as typeof fetch,
    });

    const result = await fallback.run({
      accessToken: 'captured-access-token',
      refreshToken: 'rt-demo',
    });

    expect(result).toMatchObject({
      status: 'success',
      strategyUsed: 'api-fallback',
      detail: expect.stringContaining('本月累计签到 7 天'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://member.aliyundrive.com/v1/activity/sign_in_list',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'captured-access-token',
        }),
      }),
    );
  });
});
