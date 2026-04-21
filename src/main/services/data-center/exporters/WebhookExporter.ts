import type { ExtractionResult } from '@shared/types';
import type { DataExporter } from '../DataExportService';
import type { WebhookDeliveryService } from '../WebhookDeliveryService';

interface WebhookExporterOptions {
  deliveryService: WebhookDeliveryService;
}

export class WebhookExporter implements DataExporter {
  private readonly deliveryService: WebhookDeliveryService;

  constructor(options: WebhookExporterOptions) {
    this.deliveryService = options.deliveryService;
  }

  async export(input: {
    records: ExtractionResult[];
    targetConfig: Record<string, unknown>;
    fileName: string;
  }): Promise<{ outputPath: string; resultCount: number }> {
    const url = readString(input.targetConfig.url, 'url');
    const delivery = await this.deliveryService.deliver({
      exportJobId: input.fileName,
      url,
      headers: readHeaders(input.targetConfig.headers),
      secret: typeof input.targetConfig.secret === 'string' ? input.targetConfig.secret : undefined,
      maxRetries: readPositiveInt(input.targetConfig.maxRetries, 3),
      timeoutMs: readPositiveInt(input.targetConfig.timeoutMs, 10000),
      payload: {
        event: 'export.succeeded',
        exportJobId: input.fileName,
        resultCount: input.records.length,
        records: input.records,
      },
    });

    if (delivery.status !== 'succeeded') {
      throw new Error(delivery.error ?? 'Webhook delivery failed');
    }

    return {
      outputPath: `webhook:${url}`,
      resultCount: input.records.length,
    };
  }
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} is required`);
  }

  return value;
}

function readHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => {
      return typeof entry[1] === 'string';
    }),
  );
}

function readPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
