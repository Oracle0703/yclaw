import { describe, expect, it } from 'vitest';
import { createElectronStderrFilter } from '../../../scripts/dev-log-filter';

describe('createElectronStderrFilter', () => {
  it('过滤已知的 Windows 网络探测噪声', () => {
    const lines: string[] = [];
    const filter = createElectronStderrFilter((line) => {
      lines.push(line);
    });

    filter.push(
      '[electron] [47136:0427/125914.290:ERROR:net\\base\\network_change_notifier_win.cc:195] WSALookupServiceBegin failed with: 10108\n',
    );

    expect(lines).toEqual([]);
  });

  it('保留其他 Electron stderr 日志', () => {
    const lines: string[] = [];
    const filter = createElectronStderrFilter((line) => {
      lines.push(line);
    });

    filter.push('[electron] [FATAL] Unhandled rejection: Error: boom\n');

    expect(lines).toEqual(['[electron] [FATAL] Unhandled rejection: Error: boom\n']);
  });

  it('在同一个 chunk 中混合噪声和真实错误时只过滤目标行', () => {
    const lines: string[] = [];
    const filter = createElectronStderrFilter((line) => {
      lines.push(line);
    });

    filter.push(
      '[electron] [123:0427/120000.000:ERROR:net\\base\\network_change_notifier_win.cc:195] WSALookupServiceBegin failed with: 10108\n' +
        '[electron] [FATAL] Unhandled rejection: Error: boom\n',
    );

    expect(lines).toEqual(['[electron] [FATAL] Unhandled rejection: Error: boom\n']);
  });

  it('支持跨 chunk 拼接后再判断是否过滤', () => {
    const lines: string[] = [];
    const filter = createElectronStderrFilter((line) => {
      lines.push(line);
    });

    filter.push('[electron] [123:0427/120000.000:ERROR:net\\base\\network_change_notifier_win.cc');
    filter.push(':195] WSALookupServiceBegin failed with: 10108\n');
    filter.push('[electron] next error\n');

    expect(lines).toEqual(['[electron] next error\n']);
  });

  it('flush 时输出未完成且非噪声的最后一行', () => {
    const lines: string[] = [];
    const filter = createElectronStderrFilter((line) => {
      lines.push(line);
    });

    filter.push('[electron] partial error without newline');
    filter.flush();

    expect(lines).toEqual(['[electron] partial error without newline']);
  });
});
