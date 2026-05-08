import { createHash } from 'crypto';
import type { DataWebhookTarget } from '@shared/types';
import type { DataWebhookTargetRepository } from '../repositories/DataWebhookTargetRepository';

type WebhookTargetSaveInput = Omit<DataWebhookTarget, 'createdAt' | 'updatedAt' | 'secretHash'> & {
  createdAt?: string;
  updatedAt?: string;
  secret?: string;
  secretHash?: string | null;
};

interface WebhookTargetServiceOptions {
  repository: Pick<DataWebhookTargetRepository, 'listTargets' | 'saveTarget' | 'deleteTarget'>;
  deliveryService?: {
    deliver(payload: {
      exportJobId: string;
      url: string;
      headers?: Record<string, string>;
      payload: unknown;
      secret?: string;
      maxRetries?: number;
      timeoutMs?: number;
    }): Promise<unknown>;
  };
  now?: () => Date;
}

export class WebhookTargetService {
  private readonly repository: Pick<DataWebhookTargetRepository, 'listTargets' | 'saveTarget' | 'deleteTarget'>;
  private readonly deliveryService?: WebhookTargetServiceOptions['deliveryService'];
  private readonly now: () => Date;

  constructor(options: WebhookTargetServiceOptions) {
    this.repository = options.repository;
    this.deliveryService = options.deliveryService;
    this.now = options.now ?? (() => new Date());
  }

  listTargets(): DataWebhookTarget[] {
    return this.repository.listTargets();
  }

  saveTarget(input: WebhookTargetSaveInput): DataWebhookTarget {
    const timestamp = this.now().toISOString();
    const target: DataWebhookTarget = {
      ...input,
      headers: input.headers ?? null,
      secretHash: input.secret
        ? createHash('sha256').update(input.secret).digest('hex')
        : (input.secretHash ?? null),
      createdAt: input.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    this.repository.saveTarget(target);
    return target;
  }

  async testTarget(input: WebhookTargetSaveInput): Promise<unknown> {
    if (!this.deliveryService) {
      throw new Error('deliveryService is required');
    }

    return this.deliveryService.deliver({
      exportJobId: input.id ?? 'webhook-test',
      url: input.url,
      headers: input.headers ?? undefined,
      secret: input.secret,
      maxRetries: input.maxRetries,
      timeoutMs: input.timeoutMs,
      payload: {
        event: 'webhook.test',
        targetName: input.name,
        testedAt: this.now().toISOString(),
      },
    });
  }

  deleteTarget(targetId: string): boolean {
    return this.repository.deleteTarget(targetId);
  }
}
