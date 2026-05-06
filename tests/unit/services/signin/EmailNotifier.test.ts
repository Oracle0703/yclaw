import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailNotifier } from '@main/services/signin/EmailNotifier';

class FakeSocket extends EventEmitter {
  public readonly writes: string[] = [];
  private readonly responses: string[];

  constructor(responses: string[]) {
    super();
    this.responses = [...responses];
  }

  write(chunk: string): boolean {
    this.writes.push(chunk);
    const nextResponse = this.responses.shift();
    if (nextResponse) {
      queueMicrotask(() => {
        this.emit('data', Buffer.from(nextResponse, 'utf8'));
      });
    }
    return true;
  }

  end(chunk?: string): void {
    if (chunk) {
      this.write(chunk);
    }
    queueMicrotask(() => {
      this.emit('end');
      this.emit('close');
    });
  }

  destroy(error?: Error): void {
    if (error) {
      queueMicrotask(() => this.emit('error', error));
      return;
    }
    queueMicrotask(() => this.emit('close'));
  }

  start(): void {
    const banner = this.responses.shift();
    if (banner) {
      queueMicrotask(() => {
        this.emit('data', Buffer.from(banner, 'utf8'));
      });
    }
  }
}

describe('EmailNotifier', () => {
  const connect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a mail over smtp with auth login', async () => {
    const socket = new FakeSocket([
      '220 smtp.example.com ESMTP ready\r\n',
      '250-smtp.example.com\r\n250 AUTH LOGIN\r\n',
      '334 VXNlcm5hbWU6\r\n',
      '334 UGFzc3dvcmQ6\r\n',
      '235 Authentication successful\r\n',
      '250 OK\r\n',
      '250 Accepted\r\n',
      '250 Accepted\r\n',
      '354 End data with <CR><LF>.<CR><LF>\r\n',
      '250 Queued\r\n',
    ]);
    connect.mockImplementation(async () => {
      queueMicrotask(() => socket.start());
      return socket;
    });

    const notifier = new EmailNotifier({ connect });

    await notifier.send({
      subject: '京东签到成功',
      text: '今日奖励已领取',
      config: {
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'bot@example.com',
        password: 'secret',
        from: 'bot@example.com',
        to: ['owner@example.com', 'ops@example.com'],
      },
    });

    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 465,
        secure: true,
      }),
    );
    expect(socket.writes[0]).toContain('EHLO');
    expect(socket.writes[1].trim()).toBe('AUTH LOGIN');
    expect(socket.writes[2].trim()).toBe(Buffer.from('bot@example.com').toString('base64'));
    expect(socket.writes[3].trim()).toBe(Buffer.from('secret').toString('base64'));
    expect(socket.writes[4].trim()).toBe('MAIL FROM:<bot@example.com>');
    expect(socket.writes[5].trim()).toBe('RCPT TO:<owner@example.com>');
    expect(socket.writes[6].trim()).toBe('RCPT TO:<ops@example.com>');
    expect(socket.writes[7].trim()).toBe('DATA');
    expect(socket.writes[8]).toContain('Subject: 京东签到成功');
    expect(socket.writes.at(-1)?.trim()).toBe('QUIT');
  });

  it('throws when smtp authentication is rejected', async () => {
    const socket = new FakeSocket([
      '220 smtp.example.com ESMTP ready\r\n',
      '250 AUTH LOGIN\r\n',
      '334 VXNlcm5hbWU6\r\n',
      '334 UGFzc3dvcmQ6\r\n',
      '535 Authentication failed\r\n',
    ]);
    connect.mockImplementation(async () => {
      queueMicrotask(() => socket.start());
      return socket;
    });

    const notifier = new EmailNotifier({ connect });

    await expect(
      notifier.send({
        subject: '测试邮件',
        text: 'hello',
        config: {
          enabled: true,
          host: 'smtp.example.com',
          port: 465,
          secure: true,
          username: 'bot@example.com',
          password: 'wrong-secret',
          from: 'bot@example.com',
          to: ['owner@example.com'],
        },
      }),
    ).rejects.toThrow('535 Authentication failed');
  });
});
