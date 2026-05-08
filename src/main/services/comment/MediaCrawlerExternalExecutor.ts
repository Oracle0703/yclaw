import fs from 'fs';
import path from 'path';
import { spawn as nodeSpawn } from 'child_process';
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'child_process';
import type { MediaCrawlerConfig, MediaCrawlerRunRequest, MediaCrawlerRunResult } from '@shared/types';
import type { ExecutionLogService } from '../ExecutionLogService';
import type { MediaCrawlerResultImporter } from './MediaCrawlerResultImporter';
import { buildMediaCrawlerCommand } from './MediaCrawlerCommandBuilder';

type SpawnLike = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

export class MediaCrawlerExternalExecutor {
  private readonly configProvider: () => MediaCrawlerConfig;
  private readonly executionLogService: Pick<ExecutionLogService, 'append'>;
  private readonly importer: Pick<MediaCrawlerResultImporter, 'importResults'>;
  private readonly spawn: SpawnLike;

  constructor(options: {
    configProvider?: () => MediaCrawlerConfig;
    executionLogService?: Pick<ExecutionLogService, 'append'>;
    importer?: Pick<MediaCrawlerResultImporter, 'importResults'>;
    spawn?: SpawnLike;
  } = {}) {
    if (!options.configProvider) throw new Error('configProvider is required');
    if (!options.executionLogService) throw new Error('executionLogService is required');
    if (!options.importer) throw new Error('importer is required');
    this.configProvider = options.configProvider;
    this.executionLogService = options.executionLogService;
    this.importer = options.importer;
    this.spawn = options.spawn ?? nodeSpawn;
  }

  async run(request: MediaCrawlerRunRequest): Promise<MediaCrawlerRunResult> {
    const config = this.configProvider();
    if (!config.enabled) {
      throw new Error('MediaCrawler external executor is disabled');
    }
    const mainPath = path.join(config.repoPath, 'main.py');
    if (!fs.existsSync(mainPath)) {
      throw new Error(`MediaCrawler main.py not found: ${mainPath}`);
    }

    const command = buildMediaCrawlerCommand(config, request);
    const child = this.spawn(command.command, command.args, {
      cwd: command.cwd,
      env: {
        ...process.env,
        ...command.env,
      },
      windowsHide: true,
    });

    child.stdout.on('data', (chunk) => {
      this.appendLog(request, 'info', chunk);
    });
    child.stderr.on('data', (chunk) => {
      this.appendLog(request, 'warn', chunk);
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code) => resolve(code ?? 0));
    });

    if (exitCode !== 0) {
      this.executionLogService.append({
        taskId: request.taskId,
        batchId: request.batchId,
        level: 'error',
        message: `MediaCrawler exited with code ${exitCode}`,
        metadata: { platform: request.platform },
      });
      throw new Error(`MediaCrawler exited with code ${exitCode}`);
    }

    const imported = this.importer.importResults({
      outputDir: command.outputDir,
      taskId: request.taskId,
      batchId: request.batchId,
      sourceId: request.sourceId,
      platform: request.platform,
    });

    return {
      batchId: request.batchId,
      platform: request.platform,
      exitCode,
      importedCount: imported.importedCount,
      outputDir: command.outputDir,
    };
  }

  private appendLog(
    request: MediaCrawlerRunRequest,
    level: 'info' | 'warn',
    chunk: unknown,
  ): void {
    const message = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    this.executionLogService.append({
      taskId: request.taskId,
      batchId: request.batchId,
      level,
      message: message.trim(),
      metadata: { platform: request.platform },
    });
  }
}
