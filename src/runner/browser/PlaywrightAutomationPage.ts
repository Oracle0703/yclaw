import type { AutomationPage, AutomationPageImage } from '@engines/automation/types';

export interface PlaywrightPageLike {
  evaluate<T = unknown>(code: string): Promise<T>;
  screenshot(options: { fullPage: boolean; type: 'png' }): Promise<Buffer | Uint8Array>;
  goto?(url: string, options: { waitUntil: 'domcontentloaded' }): Promise<unknown>;
}

export interface PlaywrightBrowserLike {
  newPage(): Promise<PlaywrightPageLike>;
  close(): Promise<void>;
}

export interface PlaywrightLauncherLike {
  launch(options: { headless: boolean; executablePath?: string }): Promise<PlaywrightBrowserLike>;
}

export interface BrowserSession {
  page: AutomationPage;
  close(): Promise<void>;
}

export interface PlaywrightBrowserSessionOptions {
  entryUrl?: string;
  headed?: boolean;
  browserExecutable?: string;
  launcher?: PlaywrightLauncherLike;
}

export class PlaywrightAutomationPage implements AutomationPage {
  constructor(private readonly page: PlaywrightPageLike) {}

  executeJavaScript<T = unknown>(code: string): Promise<T> {
    return this.page.evaluate<T>(code);
  }

  async capturePage(): Promise<AutomationPageImage> {
    const bytes = await this.page.screenshot({ fullPage: true, type: 'png' });
    return {
      toDataURL: () => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`,
    };
  }
}

export async function createPlaywrightBrowserSession(
  options: PlaywrightBrowserSessionOptions = {},
): Promise<BrowserSession> {
  const launcher = options.launcher ?? await loadChromiumLauncher();
  const browserExecutable = options.browserExecutable ?? process.env.YCLAW_BROWSER_EXECUTABLE;
  const browser = await launcher.launch({
    headless: !options.headed,
    ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  });
  const playwrightPage = await browser.newPage();

  if (options.entryUrl && playwrightPage.goto) {
    await playwrightPage.goto(options.entryUrl, { waitUntil: 'domcontentloaded' });
  }

  return {
    page: new PlaywrightAutomationPage(playwrightPage),
    close: () => browser.close(),
  };
}

async function loadChromiumLauncher(): Promise<PlaywrightLauncherLike> {
  try {
    const playwright = await import('@playwright/test');
    return playwright.chromium;
  } catch (error) {
    throw new Error(
      `Playwright Chromium is not available: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
