import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutomationEngine } from '@engines/automation/AutomationEngine';
import type { ActionDefinition } from '@engines/automation/types';

function createMockWebContents() {
  return {
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    capturePage: vi.fn().mockResolvedValue({
      toDataURL: () => 'data:image/png;base64,mockImageData',
    }),
  } as any;
}

describe('AutomationEngine', () => {
  let engine: AutomationEngine;
  let wc: ReturnType<typeof createMockWebContents>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AutomationEngine();
    wc = createMockWebContents();
  });

  describe('click action', () => {
    it('should execute click on selector', async () => {
      const action: ActionDefinition = { type: 'click', selector: '#btn' };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      expect(result.actionType).toBe('click');
      expect(wc.executeJavaScript).toHaveBeenCalled();
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('#btn');
      expect(script).toContain('.click()');
    });

    it('should return failure when element not found', async () => {
      wc.executeJavaScript.mockRejectedValueOnce(new Error('Element not found: #missing'));
      const action: ActionDefinition = { type: 'click', selector: '#missing' };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
    });
  });

  describe('input action', () => {
    it('should input value into element', async () => {
      const action: ActionDefinition = {
        type: 'input',
        selector: '#name',
        params: { value: 'Hello World', clear: true },
      };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      expect(result.actionType).toBe('input');
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('#name');
      expect(script).toContain('Hello World');
    });

    it('should default clear to true', async () => {
      const action: ActionDefinition = {
        type: 'input',
        selector: '#field',
        params: { value: 'test' },
      };
      await engine.execute(wc, action);
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('true');
    });
  });

  describe('scroll action', () => {
    it('should scroll with default values', async () => {
      const action: ActionDefinition = { type: 'scroll', selector: 'body' };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('scrollBy');
    });

    it('should scroll with custom x/y', async () => {
      const action: ActionDefinition = {
        type: 'scroll',
        selector: '.container',
        params: { x: 100, y: 500 },
      };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('100');
      expect(script).toContain('500');
    });
  });

  describe('extract action', () => {
    it('should extract text content by default', async () => {
      wc.executeJavaScript.mockResolvedValueOnce(['text1', 'text2']);
      const action: ActionDefinition = { type: 'extract', selector: '.item' };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(['text1', 'text2']);
    });

    it('should extract specified attribute', async () => {
      wc.executeJavaScript.mockResolvedValueOnce(['href1']);
      const action: ActionDefinition = {
        type: 'extract',
        selector: 'a',
        params: { attribute: 'href' },
      };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('href');
    });
  });

  describe('screenshot action', () => {
    it('should capture page as data URL', async () => {
      const action: ActionDefinition = { type: 'screenshot', selector: '' };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(true);
      expect(result.data).toBe('data:image/png;base64,mockImageData');
      expect(wc.capturePage).toHaveBeenCalled();
    });
  });

  describe('timeout', () => {
    it('should timeout after specified duration', async () => {
      wc.executeJavaScript.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );
      const action: ActionDefinition = {
        type: 'click',
        selector: '#slow',
        timeout: 50,
      };
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });
  });

  describe('unknown action type', () => {
    it('should return error for unknown type', async () => {
      const action = { type: 'unknown' as any, selector: '#x' } as ActionDefinition;
      const result = await engine.execute(wc, action);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action type');
    });
  });

  describe('result shape', () => {
    it('should include duration in result', async () => {
      const action: ActionDefinition = { type: 'click', selector: '#btn' };
      const result = await engine.execute(wc, action);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.stepId).toBe('');
    });
  });
});
