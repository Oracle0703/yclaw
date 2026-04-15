import type { WebContents } from 'electron';
import type { ActionDefinition, ActionResult } from './types';
import type { ResultService } from '@main/services/ResultService';

export interface ActionExecutionContext {
  taskId: string;
  batchId: string;
  templateId?: string | null;
  sourceUrl?: string;
}

export interface AutomationEngineOptions {
  resultService?: Pick<ResultService, 'saveResult'>;
}

/**
 * 自动化引擎核心 — 通过 webContents 操控页面
 * 支持 5 种基础操作: click / input / scroll / extract / screenshot
 */
export class AutomationEngine {
  private readonly defaultTimeout = 30000;
  private readonly resultService?: Pick<ResultService, 'saveResult'>;

  constructor(options: AutomationEngineOptions = {}) {
    this.resultService = options.resultService;
  }

  /**
   * 执行单个操作
   */
  async execute(
    webContents: WebContents,
    action: ActionDefinition,
    context?: ActionExecutionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const timeout = action.timeout ?? this.defaultTimeout;

    try {
      const data = await this.runAction(webContents, action, timeout);
      const result: ActionResult = {
        stepId: '',
        actionType: action.type,
        success: true,
        data,
        duration: Date.now() - startTime,
      };
      this.persistExtractionResult(action, result, context);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        stepId: '',
        actionType: action.type,
        success: false,
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  private persistExtractionResult(
    action: ActionDefinition,
    result: ActionResult,
    context?: ActionExecutionContext,
  ): void {
    if (action.type !== 'extract' || !result.success || !this.resultService || !context) {
      return;
    }

    this.resultService.saveResult({
      taskId: context.taskId,
      batchId: context.batchId,
      templateId: context.templateId ?? null,
      data: {
        selector: action.selector,
        value: result.data,
      },
      status: 'normal',
      sourceUrl: context.sourceUrl,
      createdAt: new Date().toISOString(),
    });
  }

  private async runAction(
    wc: WebContents,
    action: ActionDefinition,
    timeout: number,
  ): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Action "${action.type}" timed out after ${timeout}ms`)),
        timeout,
      );
    });

    const actionPromise = this.dispatchAction(wc, action);
    return Promise.race([actionPromise, timeoutPromise]).finally(() => clearTimeout(timer));
  }

  private async dispatchAction(wc: WebContents, action: ActionDefinition): Promise<unknown> {
    switch (action.type) {
      case 'click':
        return this.clickAction(wc, action);
      case 'input':
        return this.inputAction(wc, action);
      case 'scroll':
        return this.scrollAction(wc, action);
      case 'extract':
        return this.extractAction(wc, action);
      case 'screenshot':
        return this.screenshotAction(wc);
      default:
        throw new Error(`Unknown action type: ${(action as ActionDefinition).type}`);
    }
  }

  private async clickAction(wc: WebContents, action: ActionDefinition): Promise<void> {
    await wc.executeJavaScript(`
      (() => {
        const el = document.querySelector('${escapeCssSelector(action.selector)}');
        if (!el) throw new Error('Element not found: ${escapeCssSelector(action.selector)}');
        el.click();
      })()
    `);
  }

  private async inputAction(wc: WebContents, action: ActionDefinition): Promise<void> {
    const value = (action.params?.value as string) ?? '';
    const clear = (action.params?.clear as boolean) ?? true;
    await wc.executeJavaScript(`
      (() => {
        const el = document.querySelector('${escapeCssSelector(action.selector)}');
        if (!el) throw new Error('Element not found: ${escapeCssSelector(action.selector)}');
        if (${clear}) el.value = '';
        el.value += ${JSON.stringify(value)};
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `);
  }

  private async scrollAction(wc: WebContents, action: ActionDefinition): Promise<void> {
    const x = (action.params?.x as number) ?? 0;
    const y = (action.params?.y as number) ?? 300;
    await wc.executeJavaScript(`
      (() => {
        const el = document.querySelector('${escapeCssSelector(action.selector)}');
        const target = el || window;
        target.scrollBy(${x}, ${y});
      })()
    `);
  }

  private async extractAction(wc: WebContents, action: ActionDefinition): Promise<unknown> {
    const attr = (action.params?.attribute as string) ?? 'textContent';
    return wc.executeJavaScript(`
      (() => {
        const els = document.querySelectorAll('${escapeCssSelector(action.selector)}');
        return Array.from(els).map(el => el.${attr} ?? el.getAttribute('${attr}') ?? '');
      })()
    `);
  }

  private async screenshotAction(wc: WebContents): Promise<string> {
    const image = await wc.capturePage();
    return image.toDataURL();
  }
}

/**
 * 简单 CSS 选择器转义（防注入）
 */
function escapeCssSelector(selector: string): string {
  return selector.replace(/'/g, "\\'").replace(/\\/g, '\\\\');
}
