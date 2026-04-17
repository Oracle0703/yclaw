import { describe, expect, it } from 'vitest';
import { buildCoreDistPaths, createCoreDistRunId } from '../../../scripts/dist-win-core-utils';

describe('dist-win-core-utils', () => {
  it('为每次核心打包生成稳定且可读的运行 ID', () => {
    const runId = createCoreDistRunId(new Date('2026-04-17T06:08:09.000Z'));

    expect(runId).toBe('20260417-060809');
  });

  it('为临时输出和稳定产物生成分离路径', () => {
    const paths = buildCoreDistPaths('E:\\allsite\\yclaw', '20260417-060809');

    expect(paths.tempOutputDir).toBe('E:\\allsite\\yclaw\\release-core\\20260417-060809');
    expect(paths.stableReleaseDir).toBe('E:\\allsite\\yclaw\\release');
    expect(paths.stableNsisWebDir).toBe('E:\\allsite\\yclaw\\release\\nsis-web');
    expect(paths.latestMetadataFile).toBe('E:\\allsite\\yclaw\\release\\core-latest.json');
  });
});
