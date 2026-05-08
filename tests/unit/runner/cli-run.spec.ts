import { mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { runRunnerTask } from '@runner/cli/run';
import { DatabaseService } from '@main/services/DatabaseService';
import { BatchRepository, TaskRepository } from '@main/services/repositories';

const flow = {
  id: 'task-1',
  name: '采集任务',
  steps: [],
  createdAt: '2026-04-20T00:00:00.000Z',
  updatedAt: '2026-04-20T00:00:00.000Z',
};

describe('runner cli run', () => {
  it('records batch lifecycle when injected runner succeeds', async () => {
    const batchService = {
      createBatch: vi.fn(() => ({
        id: 'batch-1',
        taskId: 'task-1',
        status: 'pending' as const,
        createdAt: '2026-04-20T00:00:00.000Z',
        stepResults: [],
      })),
      startBatch: vi.fn(),
      finishBatch: vi.fn(),
      failBatch: vi.fn(),
    };
    const taskRepository = {
      getTaskFlow: vi.fn(() => flow),
      updateTaskStatus: vi.fn(),
    };
    const runner = {
      run: vi.fn(async () => ({ success: true, stepResults: [] })),
    };

    const result = await runRunnerTask(
      { taskId: 'task-1', output: 'json' },
      {
        taskRepository,
        batchService,
        createRunner: () => runner,
        page: { executeJavaScript: vi.fn(), capturePage: vi.fn() },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(taskRepository.updateTaskStatus).toHaveBeenCalledWith('task-1', 'running');
    expect(taskRepository.updateTaskStatus).toHaveBeenCalledWith('task-1', 'completed');
    expect(batchService.startBatch).toHaveBeenCalledWith('batch-1');
    expect(batchService.finishBatch).toHaveBeenCalledWith('batch-1', []);
    expect(runner.run).toHaveBeenCalledWith(flow, expect.any(Object), 0, 'batch-1');
    expect(JSON.parse(result.output ?? '{}')).toMatchObject({
      taskId: 'task-1',
      batchId: 'batch-1',
      status: 'completed',
    });
  });

  it('returns exit code 1 and fails batch when runner fails', async () => {
    const batchService = {
      createBatch: vi.fn(() => ({
        id: 'batch-2',
        taskId: 'task-1',
        status: 'pending' as const,
        createdAt: '2026-04-20T00:00:00.000Z',
        stepResults: [],
      })),
      startBatch: vi.fn(),
      finishBatch: vi.fn(),
      failBatch: vi.fn(),
    };

    const result = await runRunnerTask(
      { taskId: 'task-1', output: 'text' },
      {
        taskRepository: {
          getTaskFlow: vi.fn(() => flow),
          updateTaskStatus: vi.fn(),
        },
        batchService,
        createRunner: () => ({
          run: vi.fn(async () => ({ success: false, stepResults: [], error: 'selector missing' })),
        }),
        page: { executeJavaScript: vi.fn(), capturePage: vi.fn() },
      },
    );

    expect(result.exitCode).toBe(1);
    expect(batchService.failBatch).toHaveBeenCalledWith('batch-2', 'selector missing', undefined);
    expect(result.output).toContain('failed');
  });

  it('runs an empty task from sqlite and persists a successful batch', async () => {
    const dataDir = join(tmpdir(), `yclaw-runner-run-${Date.now()}`);
    mkdirSync(dataDir, { recursive: true });
    process.env.YCLAW_DATA_DIR = dataDir;

    try {
      const database = new DatabaseService();
      database.open();
      const taskRepository = new TaskRepository(database);
      taskRepository.saveTaskFlow(flow);
      database.close();

      const result = await runRunnerTask({ taskId: 'task-1', output: 'json' });

      const verifyDatabase = new DatabaseService();
      verifyDatabase.open();
      const [batch] = new BatchRepository(verifyDatabase).listBatchesByTask('task-1');
      verifyDatabase.close();

      expect(result.exitCode).toBe(0);
      expect(batch).toMatchObject({
        taskId: 'task-1',
        status: 'success',
      });
    } finally {
      delete process.env.YCLAW_DATA_DIR;
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('creates and closes a browser session for tasks with page actions', async () => {
    const close = vi.fn(async () => undefined);
    const page = {
      executeJavaScript: vi.fn(),
      capturePage: vi.fn(),
    };
    const createBrowserSession = vi.fn(async () => ({ page, close }));
    const actionFlow = {
      ...flow,
      entryUrl: 'https://example.test',
      steps: [
        {
          id: 'step-1',
          name: '点击',
          action: { type: 'click' as const, selector: '#submit' },
        },
      ],
    };
    const runner = {
      run: vi.fn(async () => ({ success: true, stepResults: [] })),
    };

    const result = await runRunnerTask(
      { taskId: 'task-1', output: 'json', headed: true },
      {
        taskRepository: {
          getTaskFlow: vi.fn(() => actionFlow),
          updateTaskStatus: vi.fn(),
        },
        batchService: {
          createBatch: vi.fn(() => ({
            id: 'batch-browser',
            taskId: 'task-1',
            status: 'pending' as const,
            createdAt: '2026-04-20T00:00:00.000Z',
            stepResults: [],
          })),
          startBatch: vi.fn(),
          finishBatch: vi.fn(),
          failBatch: vi.fn(),
        },
        createRunner: () => runner,
        createBrowserSession,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(createBrowserSession).toHaveBeenCalledWith({
      entryUrl: 'https://example.test',
      headed: true,
    });
    expect(runner.run).toHaveBeenCalledWith(actionFlow, page, 0, 'batch-browser');
    expect(close).toHaveBeenCalled();
  });

  it('passes browser executable from args to browser session', async () => {
    const createBrowserSession = vi.fn(async () => ({
      page: {
        executeJavaScript: vi.fn(),
        capturePage: vi.fn(),
      },
      close: vi.fn(async () => undefined),
    }));

    await runRunnerTask(
      {
        taskId: 'task-1',
        output: 'json',
        browserExecutable: 'C:\\Browser\\chrome.exe',
      },
      {
        taskRepository: {
          getTaskFlow: vi.fn(() => ({
            ...flow,
            steps: [
              {
                id: 'step-1',
                name: '截图',
                action: { type: 'screenshot' as const, selector: 'body' },
              },
            ],
          })),
          updateTaskStatus: vi.fn(),
        },
        batchService: {
          createBatch: vi.fn(() => ({
            id: 'batch-browser-exe',
            taskId: 'task-1',
            status: 'pending' as const,
            createdAt: '2026-04-20T00:00:00.000Z',
            stepResults: [],
          })),
          startBatch: vi.fn(),
          finishBatch: vi.fn(),
          failBatch: vi.fn(),
        },
        createRunner: () => ({
          run: vi.fn(async () => ({ success: true, stepResults: [] })),
        }),
        createBrowserSession,
      },
    );

    expect(createBrowserSession).toHaveBeenCalledWith({
      entryUrl: undefined,
      headed: undefined,
      browserExecutable: 'C:\\Browser\\chrome.exe',
    });
  });
});
