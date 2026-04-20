import { DatabaseService } from '@main/services/DatabaseService';
import { BatchRepository, TaskRepository } from '@main/services/repositories';
import type { TaskBatch } from '@shared/types';

export interface RunnerListArgs {
  target: 'tasks' | 'batches';
  output: 'text' | 'json';
  taskId?: string;
  limit?: number;
}

export interface RunnerListResult {
  exitCode: number;
  output?: string;
  error?: string;
}

interface RunnerListDependencies {
  taskRepository?: Pick<TaskRepository, 'getTasks'>;
  batchRepository?: Pick<BatchRepository, 'listBatchesByTask'>;
}

export async function runRunnerList(
  args: RunnerListArgs,
  deps: RunnerListDependencies = {},
): Promise<RunnerListResult> {
  if (args.target === 'batches' && !args.taskId) {
    return {
      exitCode: 2,
      error: 'yclaw list batches: --task is required',
    };
  }

  try {
    if (args.target === 'tasks') {
      const tasks = deps.taskRepository
        ? deps.taskRepository.getTasks()
        : withDatabase((database) => new TaskRepository(database).getTasks());
      return {
        exitCode: 0,
        output: args.output === 'json'
          ? JSON.stringify(tasks, null, 2)
          : formatTasksAsText(tasks),
      };
    }

    const batches = deps.batchRepository
      ? deps.batchRepository.listBatchesByTask(args.taskId!)
      : withDatabase((database) => new BatchRepository(database).listBatchesByTask(args.taskId!));
    const limitedBatches = args.limit ? batches.slice(0, args.limit) : batches;

    return {
      exitCode: 0,
      output: args.output === 'json'
        ? JSON.stringify(limitedBatches, null, 2)
        : formatBatchesAsText(limitedBatches),
    };
  } catch (error) {
    return {
      exitCode: 3,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function withDatabase<T>(
  create: (database: DatabaseService) => T,
): T {
  const database = new DatabaseService();
  database.open();
  try {
    return create(database);
  } finally {
    database.close();
  }
}

function formatTasksAsText(
  tasks: ReturnType<TaskRepository['getTasks']>,
): string {
  if (tasks.length === 0) {
    return 'No tasks found.';
  }

  return tasks
    .map((task) => [task.id, task.status, task.name, task.updatedAt].join('\t'))
    .join('\n');
}

function formatBatchesAsText(batches: TaskBatch[]): string {
  if (batches.length === 0) {
    return 'No batches found.';
  }

  return batches
    .map((batch) => [batch.id, batch.status, batch.createdAt].join('\t'))
    .join('\n');
}
