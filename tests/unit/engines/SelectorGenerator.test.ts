import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectorGenerator } from '@engines/automation/SelectorGenerator';

function createMockWebContents() {
  return {
    executeJavaScript: vi.fn(),
  } as any;
}

describe('SelectorGenerator', () => {
  let generator: SelectorGenerator;
  let wc: ReturnType<typeof createMockWebContents>;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new SelectorGenerator();
    wc = createMockWebContents();
  });

  describe('generateFromPoint', () => {
    it('should generate selector from coordinates', async () => {
      wc.executeJavaScript.mockResolvedValueOnce('#main-btn');
      const selector = await generator.generateFromPoint(wc, 100, 200);
      expect(selector).toBe('#main-btn');
      expect(wc.executeJavaScript).toHaveBeenCalled();
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('100');
      expect(script).toContain('200');
      expect(script).toContain('elementFromPoint');
    });

    it('should return empty string when no element at point', async () => {
      wc.executeJavaScript.mockResolvedValueOnce('');
      const selector = await generator.generateFromPoint(wc, 0, 0);
      expect(selector).toBe('');
    });

    it('should generate compound selector for nested elements', async () => {
      wc.executeJavaScript.mockResolvedValueOnce('div.container > ul > li:nth-of-type(2)');
      const selector = await generator.generateFromPoint(wc, 50, 75);
      expect(selector).toContain('li');
    });
  });

  describe('validate', () => {
    it('should return valid when selector matches exactly one element', async () => {
      wc.executeJavaScript.mockResolvedValueOnce(1);
      const result = await generator.validate(wc, '#unique-el');
      expect(result).toEqual({ count: 1, valid: true });
    });

    it('should return invalid when selector matches zero elements', async () => {
      wc.executeJavaScript.mockResolvedValueOnce(0);
      const result = await generator.validate(wc, '#missing');
      expect(result).toEqual({ count: 0, valid: false });
    });

    it('should return invalid when selector matches multiple elements', async () => {
      wc.executeJavaScript.mockResolvedValueOnce(5);
      const result = await generator.validate(wc, '.item');
      expect(result).toEqual({ count: 5, valid: false });
    });

    it('should pass quoted selector to executeJavaScript', async () => {
      wc.executeJavaScript.mockResolvedValueOnce(1);
      await generator.validate(wc, 'div[data-id="test"]');
      const script = wc.executeJavaScript.mock.calls[0][0] as string;
      expect(script).toContain('querySelectorAll');
    });
  });
});
