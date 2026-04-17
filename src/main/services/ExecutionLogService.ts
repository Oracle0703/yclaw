import { ExecutionLogRepository } from './repositories';

export interface ExecutionLogRecord {
  id?: number;
  taskId: string;
  batchId: string;
  stepIndex?: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface ExecutionLogQuery {
  taskId?: string;
  batchId?: string;
  stepIndex?: number;
  level?: 'info' | 'warn' | 'error';
  since?: string;
}

export interface ExecutionLogServiceOptions {
  executionLogRepository?: Pick<ExecutionLogRepository, 'append' | 'query'>;
}

export class ExecutionLogService {
  private readonly executionLogRepository: Pick<ExecutionLogRepository, 'append' | 'query'>;

  constructor(options: ExecutionLogServiceOptions = {}) {
    if (!options.executionLogRepository) {
      throw new Error('executionLogRepository is required');
    }

    this.executionLogRepository = options.executionLogRepository;
  }

  append(record: ExecutionLogRecord): void {
    this.executionLogRepository.append(record);
  }

  query(query: ExecutionLogQuery = {}): ExecutionLogRecord[] {
    return this.executionLogRepository.query(query);
  }
}
