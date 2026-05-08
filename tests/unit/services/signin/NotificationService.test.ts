import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@main/services/signin/NotificationService';

describe('NotificationService', () => {
  const pushAlert = vi.fn();
  const send = vi.fn();
  const getGeneral = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    pushAlert.mockImplementation((payload) => payload);
    getGeneral.mockReturnValue({
      notificationEmail: {
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'bot@example.com',
        password: 'secret',
        from: 'bot@example.com',
        to: ['owner@example.com'],
      },
    });
  });

  it('emits in-app alert when a task needs intervention', async () => {
    const service = new NotificationService({
      alertService: { pushAlert },
      emailNotifier: { send },
      configService: { getGeneral },
    });

    await service.notify({
      taskId: 'task-1',
      taskName: '京东签到',
      status: 'needs_intervention',
      failureReason: 'session_expired',
    });

    expect(pushAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        level: 'critical',
      }),
    );
  });

  it('sends email when email notifications are enabled for intervention/failure events', async () => {
    const service = new NotificationService({
      alertService: { pushAlert },
      emailNotifier: { send },
      configService: { getGeneral },
    });

    await service.notify({
      taskId: 'task-1',
      taskName: '京东签到',
      status: 'failed',
      failureReason: 'api_request_failed',
      detail: '接口异常',
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('京东签到最终失败'),
        config: expect.objectContaining({
          host: 'smtp.example.com',
        }),
      }),
    );
  });
});
