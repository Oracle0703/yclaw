import type { TaskFlow, TaskBatch, ExtractionResult } from '@shared/types';
import type { TaskSummary } from '@main/services/TaskService';
import type { ExecutionLogQuery, ExecutionLogRecord } from '@main/services/ExecutionLogService';
import type { ResultQuery } from '@main/services/ResultService';

export interface McpTaskService {
  listTasks(): TaskSummary[];
  getTaskDetail(taskId: string): TaskFlow | null;
  getBatch(batchId: string): TaskBatch | null;
}

export interface McpResultService {
  listResults(query?: ResultQuery): ExtractionResult[];
}

export interface McpExecutionLogService {
  query(query?: ExecutionLogQuery): ExecutionLogRecord[];
}

export interface CreateMcpServerOptions {
  taskService: McpTaskService;
  resultService: McpResultService;
  executionLogService: McpExecutionLogService;
  dangerousActions?: {
    runTask?: (taskId: string) => Promise<unknown> | unknown;
    refreshSession?: (sessionId: string) => Promise<unknown> | unknown;
  };
  auditLogger?: (record: {
    toolName: string;
    arguments: Record<string, unknown>;
    timestamp: string;
  }) => void;
  serverInfo?: {
    name: string;
    version: string;
  };
}

export interface McpServeArgs {
  transport: 'stdio' | 'http';
  port?: number;
}
