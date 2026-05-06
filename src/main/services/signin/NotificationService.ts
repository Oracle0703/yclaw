import type { AlertRecord, EmailNotificationConfig, SigninFailureReason, SigninRunStatus } from '@shared/types';
import type { EmailNotifier } from './EmailNotifier';

interface NotificationServiceOptions {
  alertService: {
    pushAlert: (
      alert: Omit<AlertRecord, 'id' | 'createdAt' | 'read'> & Partial<AlertRecord>,
    ) => AlertRecord;
  };
  emailNotifier: Pick<EmailNotifier, 'send'>;
  configService: {
    getGeneral: () => {
      notificationEmail?: EmailNotificationConfig;
    };
  };
}

interface SigninNotificationInput {
  taskId: string;
  taskName: string;
  status: SigninRunStatus;
  failureReason?: SigninFailureReason;
  detail?: string;
  strategyUsed?: 'browser' | 'api-fallback' | 'manual-retry';
}

export class NotificationService {
  private readonly alertService: NotificationServiceOptions['alertService'];
  private readonly emailNotifier: NotificationServiceOptions['emailNotifier'];
  private readonly configService: NotificationServiceOptions['configService'];

  constructor(options: NotificationServiceOptions) {
    this.alertService = options.alertService;
    this.emailNotifier = options.emailNotifier;
    this.configService = options.configService;
  }

  async notify(input: SigninNotificationInput): Promise<void> {
    if (this.shouldPushAlert(input.status, input.strategyUsed)) {
      this.alertService.pushAlert({
        taskId: input.taskId,
        message: this.buildMessage(input),
        level: this.resolveLevel(input.status),
      });
    }

    const emailConfig = this.configService.getGeneral().notificationEmail;
    if (!this.shouldSendEmail(input.status, input.strategyUsed, emailConfig)) {
      return;
    }

    await this.emailNotifier.send({
      subject: this.buildSubject(input),
      text: this.buildMessage(input),
      config: emailConfig!,
    });
  }

  async sendTestEmail(): Promise<{ delivered: true }> {
    const emailConfig = this.configService.getGeneral().notificationEmail;
    if (!emailConfig) {
      throw new Error('未配置通知邮箱');
    }
    if (!Array.isArray(emailConfig.to) || emailConfig.to.length === 0) {
      throw new Error('通知收件人不能为空');
    }

    await this.emailNotifier.send({
      subject: 'YClaw 测试邮件 - 京东签到通知',
      text: '这是一封来自 YClaw 的测试邮件，用于验证京东签到通知链路。',
      config: emailConfig,
    });

    return { delivered: true };
  }

  private shouldPushAlert(
    status: SigninRunStatus,
    strategyUsed?: SigninNotificationInput['strategyUsed'],
  ): boolean {
    return status === 'needs_intervention'
      || status === 'failed'
      || (status === 'success' && strategyUsed === 'api-fallback');
  }

  private shouldSendEmail(
    status: SigninRunStatus,
    strategyUsed: SigninNotificationInput['strategyUsed'],
    emailConfig?: EmailNotificationConfig,
  ): boolean {
    if (!emailConfig?.enabled || emailConfig.to.length === 0) {
      return false;
    }

    return status === 'needs_intervention'
      || status === 'failed'
      || (status === 'success' && strategyUsed === 'api-fallback');
  }

  private resolveLevel(status: SigninRunStatus): 'warning' | 'critical' {
    return status === 'failed' || status === 'needs_intervention' ? 'critical' : 'warning';
  }

  private buildSubject(input: SigninNotificationInput): string {
    if (input.status === 'success' && input.strategyUsed === 'api-fallback') {
      return `YClaw 预警 - ${input.taskName}页面签到失败，已改用 API 成功`;
    }
    if (input.status === 'needs_intervention') {
      return `YClaw 待处理 - ${input.taskName}需要人工介入`;
    }
    if (input.status === 'failed') {
      return `YClaw 失败 - ${input.taskName}最终失败`;
    }
    return `YClaw 通知 - ${input.taskName}`;
  }

  private buildMessage(input: SigninNotificationInput): string {
    const parts = [
      `任务：${input.taskName}`,
      `状态：${input.status}`,
    ];

    if (input.failureReason) {
      parts.push(`原因：${input.failureReason}`);
    }
    if (input.detail) {
      parts.push(`详情：${input.detail}`);
    }

    return parts.join('\n');
  }
}
