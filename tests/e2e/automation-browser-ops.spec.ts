import { test, expect, type Page } from '@playwright/test';

async function installMockElectron(page: Page) {
  await page.addInitScript(() => {
    const listeners = new Map<string, Array<(payload: unknown) => void>>();
    const calls: Array<{ channel: string; payload: unknown }> = [];
    const state = {
      tasks: [
        {
          id: 'task-1',
          name: '价格监控',
          status: 'idle',
          stepsCount: 2,
          updatedAt: '2026-04-15 10:00:00',
          latestBatch: { id: 'batch-1', status: 'failed' },
        },
      ],
      batches: [
        {
          id: 'batch-1',
          taskId: 'task-1',
          status: 'failed',
          createdAt: '2026-04-15T10:00:00.000Z',
          stepResults: [],
          breakpoint: null,
        },
      ],
      results: [
        {
          id: 'result-1',
          taskId: 'task-1',
          batchId: 'batch-1',
          status: 'normal',
          data: { price: '199.00' },
          createdAt: '2026-04-15T10:00:00.000Z',
        },
      ],
      tabs: [
        {
          id: 101,
          title: '商品页',
          url: 'https://example.com/item/1',
          loading: false,
          canGoBack: false,
          canGoForward: false,
          sessionPartition: 'persist:session_a',
        },
      ],
    };

    const emit = (channel: string, payload: unknown) => {
      const handlers = listeners.get(channel) ?? [];
      handlers.forEach((handler) => handler(payload));
    };

    Object.defineProperty(window, '__yclawTest', {
      value: {
        calls,
        emit,
      },
      configurable: true,
    });

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        invoke: async (channel: string, payload?: unknown) => {
          calls.push({ channel, payload });

          switch (channel) {
            case 'task:list':
              return { success: true, data: state.tasks };
            case 'task:start':
              emit('task:started', { flowId: 'task-1' });
              return { success: true, data: { status: 'running' } };
            case 'batch:list':
              return { success: true, data: state.batches };
            case 'result:list':
              return { success: true, data: state.results };
            case 'result:export':
              return { success: true, data: { path: 'C:/tmp/yclaw-results.csv' } };
            case 'alert:list':
              return { success: true, data: [] };
            case 'browser:listTabs':
              return { success: true, data: state.tabs };
            case 'intervention:resume':
              return { success: true, data: null };
            default:
              return { success: true, data: null };
          }
        },
        on: (channel: string, callback: (payload: unknown) => void) => {
          const handlers = listeners.get(channel) ?? [];
          handlers.push(callback);
          listeners.set(channel, handlers);
          return () => {
            const nextHandlers = (listeners.get(channel) ?? []).filter((item) => item !== callback);
            listeners.set(channel, nextHandlers);
          };
        },
        off: (channel: string, callback: (payload: unknown) => void) => {
          const nextHandlers = (listeners.get(channel) ?? []).filter((item) => item !== callback);
          listeners.set(channel, nextHandlers);
        },
      },
    });
  });
}

test.describe('automation-browser-ops', () => {
  test('starts a task manually from the automation page', async ({ page }) => {
    await installMockElectron(page);
    await page.goto('/entries/automation/index.html');

    await expect(page.getByText('价格监控')).toBeVisible();
    const startButton = page
      .locator('tr', { hasText: '价格监控' })
      .getByRole('button', { name: '启动' });
    await startButton.click();

    const calls = await page.evaluate(() => (window as never).__yclawTest.calls);
    expect(calls.some((item: { channel: string }) => item.channel === 'task:start')).toBeTruthy();
  });

  test('shows results and exports csv from the automation page', async ({ page }) => {
    await installMockElectron(page);
    await page.goto('/entries/automation/index.html');

    const taskRow = page.locator('tr', { hasText: '价格监控' });
    await taskRow.evaluate((element: HTMLTableRowElement) => element.click());
    await expect(page.getByText(/199.00/)).toBeVisible();
    await page.getByRole('button', { name: '导出 CSV' }).click();

    const calls = await page.evaluate(() => (window as never).__yclawTest.calls);
    expect(
      calls.some((item: { channel: string }) => item.channel === 'result:export'),
    ).toBeTruthy();
  });

  test('enters intervention mode and resumes automation on the browser page', async ({ page }) => {
    await installMockElectron(page);
    await page.goto('/entries/browser/index.html');

    await page.evaluate(() => {
      (window as never).__yclawTest.emit('intervention:stepInfo', {
        taskId: 'task-1',
        batchId: 'batch-1',
        flowRunnerStatus: 'intervention',
        webContentsId: 101,
        sessionPartition: 'persist:session_a',
        breakpoint: {
          stepIndex: 1,
          error: 'login expired',
        },
      });
    });

    await expect(page.getByText('login expired').first()).toBeVisible();
    await page.getByRole('button', { name: '恢复自动执行' }).click();

    const calls = await page.evaluate(() => (window as never).__yclawTest.calls);
    expect(
      calls.some((item: { channel: string }) => item.channel === 'intervention:resume'),
    ).toBeTruthy();
  });
});
