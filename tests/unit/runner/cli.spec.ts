import { mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { runRunnerList } from '@runner/cli/list';
import { DatabaseService } from '@main/services/DatabaseService';

describe('runner cli list', () => {
  it('lists tasks as json from injected repository', async () => {
    const result = await runRunnerList(
      { target: 'tasks', output: 'json' },
      {
        taskRepository: {
          getTasks: () => [
            {
              id: 'task-1',
              name: '采集首页',
              status: 'idle',
              updatedAt: '2026-04-20T00:00:00.000Z',
              latestBatch: null,
            },
          ],
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.output ?? '[]')).toEqual([
      {
        id: 'task-1',
        name: '采集首页',
        status: 'idle',
        updatedAt: '2026-04-20T00:00:00.000Z',
        latestBatch: null,
      },
    ]);
  });

  it('lists batches as text and respects limit', async () => {
    const result = await runRunnerList(
      { target: 'batches', output: 'text', taskId: 'task-1', limit: 1 },
      {
        batchRepository: {
          listBatchesByTask: () => [
            {
              id: 'batch-1',
              taskId: 'task-1',
              status: 'success',
              createdAt: '2026-04-20T00:00:00.000Z',
              stepResults: [],
            },
            {
              id: 'batch-2',
              taskId: 'task-1',
              status: 'failed',
              createdAt: '2026-04-19T00:00:00.000Z',
              stepResults: [],
            },
          ],
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('batch-1');
    expect(result.output).not.toContain('batch-2');
  });

  it('returns usage error when batches are requested without taskId', async () => {
    const result = await runRunnerList({ target: 'batches', output: 'json' });

    expect(result.exitCode).toBe(2);
    expect(result.error).toMatch(/task/i);
  });

  it('reads tasks from sqlite when no repository is injected', async () => {
    const dataDir = join(tmpdir(), `yclaw-runner-${Date.now()}`);
    mkdirSync(dataDir, { recursive: true });
    process.env.YCLAW_DATA_DIR = dataDir;

    try {
      const database = new DatabaseService();
      database.open();
      database.run(
        `INSERT INTO tasks (id, name, description, flow_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'task-real-1',
          '真实任务',
          null,
          JSON.stringify({ steps: [] }),
          'idle',
          '2026-04-20T00:00:00.000Z',
          '2026-04-20T00:00:00.000Z',
        ],
      );
      database.close();

      const result = await runRunnerList({ target: 'tasks', output: 'json' });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('task-real-1');
    } finally {
      delete process.env.YCLAW_DATA_DIR;
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
