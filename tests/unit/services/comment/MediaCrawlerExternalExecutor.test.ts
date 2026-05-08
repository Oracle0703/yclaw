import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaCrawlerExternalExecutor } from '@main/services/comment/MediaCrawlerExternalExecutor';
import type { MediaCrawlerConfig } from '@shared/types';

function createChild(exitCode = 0) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  queueMicrotask(() => {
    child.stdout.emit('data', Buffer.from('started'));
    child.stderr.emit('data', Buffer.from('warning'));
    child.emit('close', exitCode);
  });
  return child;
}

describe('MediaCrawlerExternalExecutor', () => {
  let repoPath: string;
  let outputDir: string;
  const append = vi.fn();
  const importResults = vi.fn(() => ({ importedCount: 2, files: ['comments.json'] }));
  const spawn = vi.fn(() => createChild(0));
  const config: MediaCrawlerConfig = {
    enabled: true,
    repoPath: '',
    pythonPath: 'python',
    outputDir: '',
    loginType: 'qrcode',
  };

  beforeEach(() => {
    repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mediacrawler-repo-'));
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediacrawler-out-'));
    fs.writeFileSync(path.join(repoPath, 'main.py'), 'print("ok")', 'utf8');
    config.repoPath = repoPath;
    config.outputDir = outputDir;
    append.mockClear();
    importResults.mockClear();
    spawn.mockClear();
  });

  afterEach(() => {
    fs.rmSync(repoPath, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('spawns MediaCrawler, records logs and imports results', async () => {
    const executor = new MediaCrawlerExternalExecutor({
      configProvider: () => config,
      executionLogService: { append },
      importer: { importResults },
      spawn,
    });

    const result = await executor.run({
      sourceId: 'source-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      platform: 'xhs',
      entryKind: 'keyword',
      entryValue: 'AI工具',
      limits: {
        maxContents: 5,
        maxCommentsPerContent: 20,
        includeSubComments: false,
        crawlIntervalSeconds: 2,
      },
    });

    expect(spawn).toHaveBeenCalledWith(
      'python',
      expect.arrayContaining(['main.py', '--platform', 'xhs', '--type', 'search']),
      expect.objectContaining({ cwd: repoPath }),
    );
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ level: 'info', message: 'started' }));
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ level: 'warn', message: 'warning' }));
    expect(importResults).toHaveBeenCalledWith(expect.objectContaining({
      outputDir,
      taskId: 'task-1',
      batchId: 'batch-1',
      sourceId: 'source-1',
      platform: 'xhs',
    }));
    expect(result).toEqual({
      batchId: 'batch-1',
      platform: 'xhs',
      exitCode: 0,
      importedCount: 2,
      outputDir,
    });
  });

  it('rejects missing MediaCrawler main.py before spawning', async () => {
    fs.rmSync(path.join(repoPath, 'main.py'));
    const executor = new MediaCrawlerExternalExecutor({
      configProvider: () => config,
      executionLogService: { append },
      importer: { importResults },
      spawn,
    });

    await expect(executor.run({
      sourceId: 'source-1',
      taskId: 'task-1',
      batchId: 'batch-1',
      platform: 'xhs',
      entryKind: 'keyword',
      entryValue: 'AI工具',
      limits: {
        maxContents: 5,
        maxCommentsPerContent: 20,
        includeSubComments: false,
        crawlIntervalSeconds: 2,
      },
    })).rejects.toThrow('MediaCrawler main.py not found');
    expect(spawn).not.toHaveBeenCalled();
  });
});
