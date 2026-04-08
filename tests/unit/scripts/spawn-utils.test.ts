import { describe, expect, it } from 'vitest';
import { buildSpawnSpec } from '../../../scripts/spawn-utils';

describe('buildSpawnSpec', () => {
  it('在 Windows 下对 .cmd 可执行文件切换到 cmd.exe 包装执行', () => {
    const spec = buildSpawnSpec(
      'E:\\allsite\\yclaw\\node_modules\\.bin\\vite.cmd',
      ['--host', '127.0.0.1'],
      true,
    );

    expect(spec.command).toBe('cmd.exe');
    expect(spec.args).toEqual([
      '/d',
      '/s',
      '/c',
      '"E:\\allsite\\yclaw\\node_modules\\.bin\\vite.cmd" "--host" "127.0.0.1"',
    ]);
  });

  it('在非 Windows 下保持原始命令和参数不变', () => {
    const spec = buildSpawnSpec('/workspace/node_modules/.bin/vite', ['--host', '127.0.0.1'], false);

    expect(spec.command).toBe('/workspace/node_modules/.bin/vite');
    expect(spec.args).toEqual(['--host', '127.0.0.1']);
  });
});
