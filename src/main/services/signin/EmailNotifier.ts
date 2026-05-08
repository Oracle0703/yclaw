import net from 'node:net';
import tls from 'node:tls';
import type { EmailNotificationConfig } from '@shared/types';

export interface EmailNotifierInput {
  subject: string;
  text: string;
  config: EmailNotificationConfig;
}

interface SmtpSocketLike {
  on(event: 'data', listener: (chunk: Buffer | string) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: 'end', listener: () => void): this;
  write(chunk: string): boolean;
  end(chunk?: string | Uint8Array, encoding?: BufferEncoding, callback?: () => void): void;
  destroy(error?: Error): void;
}

interface EmailNotifierOptions {
  connect?: (config: EmailNotificationConfig) => Promise<SmtpSocketLike>;
}

export class EmailNotifier {
  private readonly connect: (config: EmailNotificationConfig) => Promise<SmtpSocketLike>;

  constructor(options: EmailNotifierOptions = {}) {
    this.connect = options.connect ?? defaultConnect;
  }

  async send(input: EmailNotifierInput): Promise<void> {
    const socket = await this.connect(input.config);
    const session = new SmtpSession(socket);

    try {
      await session.readResponse();
      await session.sendCommand(`EHLO yclaw.local`, [250]);
      await session.sendCommand('AUTH LOGIN', [334]);
      await session.sendCommand(Buffer.from(input.config.username).toString('base64'), [334]);
      await session.sendCommand(Buffer.from(input.config.password).toString('base64'), [235]);
      await session.sendCommand(`MAIL FROM:<${input.config.from}>`, [250]);
      for (const recipient of input.config.to) {
        await session.sendCommand(`RCPT TO:<${recipient}>`, [250, 251]);
      }
      await session.sendCommand('DATA', [354]);
      await session.sendData(buildMessage(input));
      socket.write('QUIT\r\n');
    } finally {
      socket.end();
    }
  }
}

class SmtpSession {
  private readonly socket: SmtpSocketLike;
  private buffer = '';
  private pending: Array<{
    resolve: (value: { code: number; message: string }) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(socket: SmtpSocketLike) {
    this.socket = socket;
    this.socket.on('data', (chunk) => {
      this.buffer += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
      this.flush();
    });
    this.socket.on('error', (error) => {
      const pending = this.pending.splice(0);
      pending.forEach((item) => item.reject(error));
    });
    this.socket.on('end', () => {
      const pending = this.pending.splice(0);
      pending.forEach((item) => item.reject(new Error('SMTP connection ended unexpectedly')));
    });
    this.socket.on('close', () => {
      if (this.pending.length === 0) {
        return;
      }
      const pending = this.pending.splice(0);
      pending.forEach((item) => item.reject(new Error('SMTP connection closed unexpectedly')));
    });
  }

  async sendCommand(command: string, expectedCodes: number[], appendCrlf = true): Promise<void> {
    this.socket.write(appendCrlf ? `${command}\r\n` : command);
    const response = await this.readResponse();
    assertResponseCode(response, expectedCodes);
  }

  async sendData(message: string): Promise<void> {
    this.socket.write(`${message}\r\n.\r\n`);
    const response = await this.readResponse();
    assertResponseCode(response, [250]);
  }

  readResponse(): Promise<{ code: number; message: string }> {
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.flush();
    });
  }

  private flush(): void {
    while (this.pending.length > 0) {
      const response = extractResponse(this.buffer);
      if (!response) {
        return;
      }
      this.buffer = response.rest;
      const next = this.pending.shift();
      next?.resolve({
        code: response.code,
        message: response.message,
      });
    }
  }
}

function extractResponse(
  buffer: string,
): { code: number; message: string; rest: string } | null {
  const lines = buffer.split('\r\n');
  if (lines.length < 2) {
    return null;
  }

  const collected: string[] = [];
  let consumed = 0;
  for (const line of lines) {
    if (line.length === 0) {
      consumed += 2;
      continue;
    }
    if (!/^\d{3}[\s-]/.test(line)) {
      return null;
    }
    collected.push(line);
    consumed += Buffer.byteLength(line, 'utf8') + 2;
    if (line[3] === ' ') {
      const code = Number(line.slice(0, 3));
      return {
        code,
        message: collected.map((item) => item.slice(4)).join('\n').trim(),
        rest: buffer.slice(consumed),
      };
    }
  }

  return null;
}

function assertResponseCode(
  response: { code: number; message: string },
  expectedCodes: number[],
): void {
  if (expectedCodes.includes(response.code)) {
    return;
  }
  const detail = response.message ? ` ${response.message}` : '';
  throw new Error(`${response.code}${detail}`);
}

function buildMessage(input: EmailNotifierInput): string {
  const lines = [
    `From: ${input.config.from}`,
    `To: ${input.config.to.join(', ')}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    ...dotStuff(input.text).split('\n'),
  ];

  return lines.join('\r\n');
}

function dotStuff(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\n');
}

async function defaultConnect(config: EmailNotificationConfig): Promise<SmtpSocketLike> {
  return await new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    const socket = config.secure
      ? tls.connect(
          {
            host: config.host,
            port: config.port,
            servername: config.host,
          },
          () => resolve(socket),
        )
      : net.createConnection(
          {
            host: config.host,
            port: config.port,
          },
          () => resolve(socket),
        );

    socket.once('error', onError);
    socket.once('connect', () => {
      socket.removeListener('error', onError);
    });
    if ('once' in socket) {
      socket.once('secureConnect', () => {
        socket.removeListener('error', onError);
      });
    }
  });
}
