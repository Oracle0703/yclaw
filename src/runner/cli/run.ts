import type { AutomationPage } from '@engines/automation/types';
import { AutomationEngine } from '@engines/automation/AutomationEngine';
import { FlowRunner } from '@engines/automation/FlowRunner';
import {
  createPlaywrightBrowserSession,
  type BrowserSession,
} from '@runner/browser/PlaywrightAutomationPage';
import { BatchService } from '@main/services/BatchService';
import { DatabaseService } from '@main/services/DatabaseService';
import { ExecutionLogService } from '@main/services/ExecutionLogService';
import { ResultService } from '@main/services/ResultService';
import {
  BatchRepository,
  ExecutionLogRepository,
  ResultRepository,
  TaskRepository,
} from '@main/services/repositories';
import type { TaskExecutionResult, TaskFlow } from '@shared/types';

export interface RunnerRunArgs {
  taskId: string;
  output: 'text' | 'json';
  headed?: boolean;
  browserExecutable?: string;
}

export interface RunnerRunResult {
  exitCode: number;
  output?: string;
  error?: string;
}

interface RunnerRunDependencies {
  taskRepository?: Pick<TaskRepository, 'getTaskFlow' | 'updateTaskStatus'>;
  batchService?: Pick<BatchService, 'createBatch' | 'startBatch' | 'finishBatch' | 'failBatch'>;
  createRunner?: () => Pick<FlowRunner, 'run'>;
  page?: AutomationPage;
  createBrowserSession?: (options: {
    entryUrl?: string;
    headed?: boolean;
    browserExecutable?: string;
  }) => Promise<BrowserSession>;
}

export async function runRunnerTask(
  args: RunnerRunArgs,
  deps: RunnerRunDependencies = {},
): Promise<RunnerRunResult> {
  if (deps.taskRepository && deps.batchService && deps.createRunner) {
    return executeRun(args, {
      taskRepository: deps.taskRepository,
      batchService: deps.batchService,
      createRunner: deps.createRunner,
      page: deps.page,
      createBrowserSession: deps.createBrowserSession,
    });
  }

  return withDatabase((database) => {
    const taskRepository = deps.taskRepository ?? new TaskRepository(database);
    const batchRepository = new BatchRepository(database);
    const resultRepository = new ResultRepository(database);
    const executionLogRepository = new ExecutionLogRepository(database);
    const resultService = new ResultService({ resultRepository });
    const executionLogService = new ExecutionLogService({ executionLogRepository });
    const batchService = deps.batchService ?? new BatchService({ batchRepository });
    const eventBus = { emit: () => undefined };
    const createRunner =
      deps.createRunner ??
      (() =>
        new FlowRunner({
          eventBus,
          engine: new AutomationEngine({ resultService }),
          executionLogService,
        }));

    return executeRun(args, {
      taskRepository,
      batchService,
      createRunner,
      page: deps.page,
      createBrowserSession: deps.createBrowserSession,
    });
  });
}

async function executeRun(
  args: RunnerRunArgs,
  deps: Required<Omit<RunnerRunDependencies, 'page' | 'createBrowserSession'>> &
    Pick<RunnerRunDependencies, 'page' | 'createBrowserSession'>,
): Promise<RunnerRunResult> {
  const flow = deps.taskRepository.getTaskFlow(args.taskId);
  if (!flow) {
    return {
      exitCode: 2,
      error: `Task "${args.taskId}" not found`,
    };
  }

  const batch = deps.batchService.createBatch(args.taskId, { reason: 'manual' });
  deps.batchService.startBatch(batch.id);
  deps.taskRepository.updateTaskStatus(args.taskId, 'running');
  const browserSession = await createRunBrowserSession(flow, args, deps);
  const page = deps.page ?? browserSession?.page ?? createUnsupportedAutomationPage();

  try {
    const result = await deps.createRunner().run(flow, page, 0, batch.id);
    if (result.success) {
      deps.batchService.finishBatch(batch.id, result.stepResults);
      deps.taskRepository.updateTaskStatus(args.taskId, 'completed');
      return formatRunResult(args, flow, batch.id, 'completed', result, 0);
    }

    deps.batchService.failBatch(batch.id, result.error ?? 'Task failed', result.breakpoint);
    deps.taskRepository.updateTaskStatus(args.taskId, 'failed');
    return formatRunResult(args, flow, batch.id, 'failed', result, 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.batchService.failBatch(batch.id, message);
    deps.taskRepository.updateTaskStatus(args.taskId, 'failed');
    return {
      exitCode: 3,
      error: message,
      output: formatRunText(flow, batch.id, 'failed', message),
    };
  } finally {
    await browserSession?.close();
  }
}

async function createRunBrowserSession(
  flow: TaskFlow,
  args: RunnerRunArgs,
  deps: Pick<RunnerRunDependencies, 'page' | 'createBrowserSession'>,
): Promise<BrowserSession | null> {
  if (deps.page || flow.steps.length === 0) {
    return null;
  }

  const createBrowserSession = deps.createBrowserSession ?? createPlaywrightBrowserSession;
  return createBrowserSession({
    entryUrl: flow.entryUrl,
    headed: args.headed,
    browserExecutable: args.browserExecutable ?? process.env.YCLAW_BROWSER_EXECUTABLE,
  });
}

function formatRunResult(
  args: RunnerRunArgs,
  flow: TaskFlow,
  batchId: string,
  status: 'completed' | 'failed',
  result: TaskExecutionResult,
  exitCode: number,
): RunnerRunResult {
  if (args.output === 'json') {
    return {
      exitCode,
      output: JSON.stringify(
        {
          taskId: flow.id,
          batchId,
          status,
          success: result.success,
          stepResults: result.stepResults,
          error: result.error,
        },
        null,
        2,
      ),
    };
  }

  return {
    exitCode,
    output: formatRunText(flow, batchId, status, result.error),
  };
}

function formatRunText(
  flow: TaskFlow,
  batchId: string,
  status: 'completed' | 'failed',
  error?: string,
): string {
  const base = `${flow.id}\t${batchId}\t${status}`;
  return error ? `${base}\t${error}` : base;
}

function createUnsupportedAutomationPage(): AutomationPage {
  return {
    async executeJavaScript() {
      throw new Error('Headless browser adapter is not configured');
    },
    async capturePage() {
      return {
        toDataURL: () => '',
      };
    },
  };
}

async function withDatabase<T>(run: (database: DatabaseService) => Promise<T>): Promise<T> {
  const database = new DatabaseService();
  database.open();
  try {
    return await run(database);
  } finally {
    database.close();
  }
}
