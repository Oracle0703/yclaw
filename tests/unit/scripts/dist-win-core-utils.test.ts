import { describe, expect, it } from 'vitest';
import { join } from 'path';
import { buildCoreDistPaths, createCoreDistRunId } from '../../../scripts/dist-win-core-utils';

describe('dist-win-core-utils', () => {
  it('为每次核心打包生成稳定且可读的运行 ID', () => {
    const runId = createCoreDistRunId(new Date('2026-04-17T06:08:09.000Z'));

    expect(runId).toBe('20260417-060809');
  });

  it('为临时输出和稳定产物生成分离路径', () => {
    const projectRoot = join('E:\\', 'allsite', 'yclaw');
    const paths = buildCoreDistPaths(projectRoot, '20260417-060809');

    expect(paths.tempOutputDir).toBe(join(projectRoot, 'release-core', '20260417-060809'));
    expect(paths.stableReleaseDir).toBe(join(projectRoot, 'release'));
    expect(paths.stableNsisWebDir).toBe(join(projectRoot, 'release', 'nsis-web'));
    expect(paths.latestMetadataFile).toBe(join(projectRoot, 'release', 'core-latest.json'));
  });
});
