import { EventBus } from '@main/ipc/EventBus';
import { BatchService } from '@main/services/BatchService';
import { DatabaseService } from '@main/services/DatabaseService';
import { ExecutionLogService } from '@main/services/ExecutionLogService';
import { ResultService } from '@main/services/ResultService';
import { TaskService } from '@main/services/TaskService';
import {
  BatchRepository,
  ExecutionLogRepository,
  ResultRepository,
  TaskRepository,
} from '@main/services/repositories';
import { createMcpServer } from './createMcpServer';

export interface CliMcpRuntime {
  databaseService: DatabaseService;
  taskService: TaskService;
  resultService: ResultService;
  executionLogService: ExecutionLogService;
  createServer: () => ReturnType<typeof createMcpServer>;
  close: () => void;
}

export function createCliMcpRuntime(): CliMcpRuntime {
  const databaseService = new DatabaseService();
  databaseService.open();

  const taskRepository = new TaskRepository(databaseService);
  const batchRepository = new BatchRepository(databaseService);
  const resultRepository = new ResultRepository(databaseService);
  const executionLogRepository = new ExecutionLogRepository(databaseService);
  const batchService = new BatchService({ batchRepository });
  const eventBus = EventBus.getInstance();

  const taskService = new TaskService({
    taskRepository,
    batchService,
    eventBus,
    createRunner: () => {
      throw new Error('Task runner is unavailable in MCP read-only bootstrap');
    },
  });

  const resultService = new ResultService({ resultRepository });
  const executionLogService = new ExecutionLogService({ executionLogRepository });

  return {
    databaseService,
    taskService,
    resultService,
    executionLogService,
    createServer: () =>
      createMcpServer({
        taskService,
        resultService,
        executionLogService,
      }),
    close: () => {
      databaseService.close();
    },
  };
}
