import { spawn } from 'child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join, resolve } from 'path';
import { buildSpawnSpec } from './spawn-utils';
import { buildCoreDistPaths, createCoreDistRunId } from './dist-win-core-utils';

function copyDirectoryContents(sourceDir: string, targetDir: string) {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir)) {
    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);
    const stat = statSync(sourcePath);

    if (stat.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
      continue;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

function pruneOldCoreRuns(rootDir: string, keep = 2) {
  if (!existsSync(rootDir)) {
    return;
  }

  const directories = readdirSync(rootDir)
    .map((entry) => join(rootDir, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

  for (const staleDir of directories.slice(keep)) {
    rmSync(staleDir, { recursive: true, force: true });
  }
}

async function runElectronBuilder(projectRoot: string, outputDir: string) {
  const builderCommand =
    process.platform === 'win32'
      ? join(projectRoot, 'node_modules', '.bin', 'electron-builder.cmd')
      : join(projectRoot, 'node_modules', '.bin', 'electron-builder');

  const spawnSpec = buildSpawnSpec(builderCommand, [
    '--win',
    '--config',
    'electron-builder.yml',
    `-c.directories.output=${outputDir}`,
  ]);

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: spawnSpec.shell,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`electron-builder exited with code ${code ?? -1}`));
    });

    child.on('error', rejectPromise);
  });
}

async function main() {
  const projectRoot = resolve(__dirname, '..');
  const runId = createCoreDistRunId();
  const paths = buildCoreDistPaths(projectRoot, runId);
  const nsisWebSourceDir = join(paths.tempOutputDir, 'nsis-web');
  const builderDebugSourceFile = join(paths.tempOutputDir, 'builder-debug.yml');

  mkdirSync(dirname(paths.tempOutputDir), { recursive: true });

  await runElectronBuilder(projectRoot, paths.tempOutputDir);

  if (!existsSync(nsisWebSourceDir)) {
    throw new Error(`核心安装包输出缺失: ${nsisWebSourceDir}`);
  }

  // 清理历史稳定产物，避免旧版本的 *.nsis.7z / *.blockmap 残留引发差分更新校验失败
  rmSync(paths.stableNsisWebDir, { recursive: true, force: true });
  copyDirectoryContents(nsisWebSourceDir, paths.stableNsisWebDir);

  if (existsSync(builderDebugSourceFile)) {
    mkdirSync(dirname(paths.stableBuilderDebugFile), { recursive: true });
    copyFileSync(builderDebugSourceFile, paths.stableBuilderDebugFile);
  }

  writeFileSync(
    paths.latestMetadataFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        runId,
        outputDir: paths.tempOutputDir,
        unpackedDir: join(paths.tempOutputDir, 'win-unpacked'),
        nsisWebDir: nsisWebSourceDir,
      },
      null,
      2,
    ),
    'utf-8',
  );

  pruneOldCoreRuns(join(projectRoot, 'release-core'));
}

void main().catch((error) => {
  console.error('[dist-win-core]', error);
  process.exitCode = 1;
});
