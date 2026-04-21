import { createHmac, randomUUID } from 'crypto';
import type { DataExportAudit } from '@shared/types';

type FetchLike = typeof fetch;

interface AuditRepositoryLike {
  appendAudit(audit: DataExportAudit): void;
}

interface WebhookDeliveryServiceOptions {
  fetchImpl?: FetchLike;
  auditRepository?: AuditRepositoryLike;
  now?: () => Date;
  createId?: () => string;
}

interface WebhookDeliverInput {
  exportJobId: string;
  url: string;
  headers?: Record<string, string>;
  payload: unknown;
  secret?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

interface WebhookDeliverResult {
  status: 'succeeded' | 'failed';
  attempts: number;
  responseSummary?: string;
  error?: string;
}

export class WebhookDeliveryService {
  private readonly fetchImpl: FetchLike;
  private readonly auditRepository?: AuditRepositoryLike;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: WebhookDeliveryServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.auditRepository = options.auditRepository;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => randomUUID());
  }

  async deliver(input: WebhookDeliverInput): Promise<WebhookDeliverResult> {
    const maxAttempts = Math.max(1, input.maxRetries ?? 1);
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const body = JSON.stringify(input.payload);
        const headers = this.buildHeaders(input.headers, input.secret, body);
        const response = await this.fetchImpl(input.url, {
          method: 'POST',
          headers,
          body,
          signal: this.createTimeoutSignal(input.timeoutMs),
        });
        const responseSummary = `HTTP ${response.status}`;

        if (!response.ok) {
          throw new Error(responseSummary);
        }

        this.appendAudit(input, attempt, 'succeeded', responseSummary);
        return { status: 'succeeded', attempts: attempt, responseSummary };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.appendAudit(input, attempt, 'failed', undefined, lastError);
      }
    }

    return { status: 'failed', attempts: maxAttempts, error: lastError };
  }

  private buildHeaders(
    headers: Record<string, string> | undefined,
    secret: string | undefined,
    body: string,
  ): Record<string, string> {
    const nextHeaders: Record<string, string> = {
      'content-type': 'application/json',
      ...(headers ?? {}),
    };

    if (secret) {
      const signature = createHmac('sha256', secret).update(body).digest('hex');
      nextHeaders['x-yclaw-signature'] = `sha256=${signature}`;
    }

    return nextHeaders;
  }

  private createTimeoutSignal(timeoutMs?: number): AbortSignal | undefined {
    if (!timeoutMs || timeoutMs <= 0) {
      return undefined;
    }

    return AbortSignal.timeout(timeoutMs);
  }

  private appendAudit(
    input: WebhookDeliverInput,
    attempt: number,
    status: 'succeeded' | 'failed',
    responseSummary?: string,
    error?: string,
  ): void {
    this.auditRepository?.appendAudit({
      id: this.createId(),
      exportJobId: input.exportJobId,
      attempt,
      status,
      targetType: 'webhook',
      requestSummary: `POST ${input.url}`,
      responseSummary,
      error,
      createdAt: this.now().toISOString(),
    });
  }
}
