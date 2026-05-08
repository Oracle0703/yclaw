import type { ExtractionResult, HotReportSummary } from '@shared/types';

type DeliveryResult = { status: 'succeeded' | 'failed'; error?: string };

interface HotNotificationTarget {
  type: 'webhook';
  url: string;
  headers?: Record<string, string>;
  maxRetries?: number;
  timeoutMs?: number;
}

interface HotNotificationDeliveryInput {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  payload: Record<string, unknown>;
}

export class HotNotificationService {
  constructor(private readonly options: {
    deliver: (input: HotNotificationDeliveryInput) => Promise<DeliveryResult>;
  }) {}

  async sendReport(input: {
    target: HotNotificationTarget;
    report: HotReportSummary;
    results: ExtractionResult[];
  }): Promise<{ status: 'succeeded' | 'failed'; attempts: number; error?: string }> {
    const maxAttempts = Math.max(1, input.target.maxRetries ?? 1);
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.options.deliver({
        url: input.target.url,
        headers: input.target.headers,
        timeoutMs: input.target.timeoutMs,
        payload: {
          event: 'hot.report.generated',
          report: input.report,
          resultCount: input.results.length,
          results: input.results,
        },
      });
      if (result.status === 'succeeded') {
        return { status: 'succeeded', attempts: attempt };
      }
      lastError = result.error;
    }

    return { status: 'failed', attempts: maxAttempts, error: lastError ?? 'Hot notification failed' };
  }
}
