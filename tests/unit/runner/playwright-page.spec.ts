import { describe, expect, it, vi } from 'vitest';
import {
  PlaywrightAutomationPage,
  createPlaywrightBrowserSession,
} from '@runner/browser/PlaywrightAutomationPage';

describe('PlaywrightAutomationPage', () => {
  it('executes JavaScript through Playwright page.evaluate', async () => {
    const page = {
      evaluate: vi.fn(async () => 'ok'),
      screenshot: vi.fn(),
    };

    const adapter = new PlaywrightAutomationPage(page);
    const result = await adapter.executeJavaScript<string>('document.title');

    expect(result).toBe('ok');
    expect(page.evaluate).toHaveBeenCalledWith('document.title');
  });

  it('captures screenshots as data URLs', async () => {
    const page = {
      evaluate: vi.fn(),
      screenshot: vi.fn(async () => Buffer.from('png-bytes')),
    };

    const adapter = new PlaywrightAutomationPage(page);
    const image = await adapter.capturePage();

    expect(page.screenshot).toHaveBeenCalledWith({ fullPage: true, type: 'png' });
    expect(image.toDataURL()).toBe(`data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`);
  });
});

describe('createPlaywrightBrowserSession', () => {
  it('launches Chromium headless by default and navigates entryUrl', async () => {
    const close = vi.fn(async () => undefined);
    const goto = vi.fn(async () => undefined);
    const page = {
      evaluate: vi.fn(),
      screenshot: vi.fn(),
      goto,
    };
    const browser = {
      newPage: vi.fn(async () => page),
      close,
    };
    const launcher = {
      launch: vi.fn(async () => browser),
    };

    const session = await createPlaywrightBrowserSession({
      entryUrl: 'https://example.test',
      launcher,
    });
    await session.close();

    expect(launcher.launch).toHaveBeenCalledWith({ headless: true });
    expect(browser.newPage).toHaveBeenCalled();
    expect(goto).toHaveBeenCalledWith('https://example.test', { waitUntil: 'domcontentloaded' });
    expect(close).toHaveBeenCalled();
  });

  it('supports headed browser launch', async () => {
    const launcher = {
      launch: vi.fn(async () => ({
        newPage: vi.fn(async () => ({
          evaluate: vi.fn(),
          screenshot: vi.fn(),
        })),
        close: vi.fn(),
      })),
    };

    await createPlaywrightBrowserSession({ headed: true, launcher });

    expect(launcher.launch).toHaveBeenCalledWith({ headless: false });
  });

  it('passes explicit browser executable path to Chromium launcher', async () => {
    const launcher = {
      launch: vi.fn(async () => ({
        newPage: vi.fn(async () => ({
          evaluate: vi.fn(),
          screenshot: vi.fn(),
        })),
        close: vi.fn(),
      })),
    };

    await createPlaywrightBrowserSession({
      browserExecutable: 'C:\\Browser\\chrome.exe',
      launcher,
    });

    expect(launcher.launch).toHaveBeenCalledWith({
      headless: true,
      executablePath: 'C:\\Browser\\chrome.exe',
    });
  });

  it('uses YCLAW_BROWSER_EXECUTABLE when browser executable is not explicit', async () => {
    process.env.YCLAW_BROWSER_EXECUTABLE = 'C:\\Browser\\edge.exe';
    const launcher = {
      launch: vi.fn(async () => ({
        newPage: vi.fn(async () => ({
          evaluate: vi.fn(),
          screenshot: vi.fn(),
        })),
        close: vi.fn(),
      })),
    };

    try {
      await createPlaywrightBrowserSession({ launcher });

      expect(launcher.launch).toHaveBeenCalledWith({
        headless: true,
        executablePath: 'C:\\Browser\\edge.exe',
      });
    } finally {
      delete process.env.YCLAW_BROWSER_EXECUTABLE;
    }
  });
});
