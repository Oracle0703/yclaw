import { join } from 'path';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function createCoreDistRunId(now = new Date()): string {
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
  ].join('') + `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

export function buildCoreDistPaths(projectRoot: string, runId: string) {
  const stableReleaseDir = join(projectRoot, 'release');

  return {
    tempOutputDir: join(projectRoot, 'release-core', runId),
    stableReleaseDir,
    stableNsisWebDir: join(stableReleaseDir, 'nsis-web'),
    latestMetadataFile: join(stableReleaseDir, 'core-latest.json'),
    stableBuilderDebugFile: join(stableReleaseDir, 'builder-debug.yml'),
  };
}
