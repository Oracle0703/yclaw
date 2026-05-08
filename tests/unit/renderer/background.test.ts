/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyBackground,
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND,
  DEFAULT_PRESET_ID,
  normalizeBackground,
  resolveBackground,
} from '@renderer/shared/utils/background';

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('normalizeBackground', () => {
  it('returns default when input is missing or invalid', () => {
    expect(normalizeBackground(null)).toEqual(DEFAULT_BACKGROUND);
    expect(normalizeBackground(undefined)).toEqual(DEFAULT_BACKGROUND);
    expect(normalizeBackground('foo' as unknown)).toEqual(DEFAULT_BACKGROUND);
  });

  it('falls back to a known preset id when value is unknown', () => {
    const result = normalizeBackground({ type: 'preset', value: 'unknown-id' });
    expect(result.type).toBe('preset');
    expect(result.value).toBe(DEFAULT_PRESET_ID);
  });

  it('keeps a valid preset id', () => {
    const id = BACKGROUND_PRESETS[1].id;
    expect(normalizeBackground({ type: 'preset', value: id })).toEqual({
      type: 'preset',
      value: id,
    });
  });

  it('validates solid color hex format', () => {
    expect(normalizeBackground({ type: 'solid', value: '#abcdef' })).toEqual({
      type: 'solid',
      value: '#abcdef',
    });
    expect(normalizeBackground({ type: 'solid', value: 'red' })).toEqual({
      type: 'solid',
      value: '#eef4fb',
    });
  });

  it('rejects unsafe image urls (e.g. javascript:)', () => {
    const malicious = normalizeBackground({
      type: 'image',
      value: 'javascript:alert(1)' as string,
    });
    expect(malicious).toEqual(DEFAULT_BACKGROUND);
  });

  it('accepts http(s) and data:image urls and clamps overlay opacity', () => {
    const ok = normalizeBackground({
      type: 'image',
      value: 'https://example.com/bg.png',
      overlayOpacity: 2,
      fit: 'tile',
    });
    expect(ok.type).toBe('image');
    expect(ok.value).toBe('https://example.com/bg.png');
    expect(ok.overlayOpacity).toBe(1);
    expect(ok.fit).toBe('tile');

    const negative = normalizeBackground({
      type: 'image',
      value: 'data:image/png;base64,xxx',
      overlayOpacity: -1,
    });
    expect(negative.overlayOpacity).toBe(0);
    expect(negative.fit).toBe('cover');
  });
});

describe('resolveBackground', () => {
  it('produces a CSS background for a preset', () => {
    const preset = BACKGROUND_PRESETS[0];
    const applied = resolveBackground({ type: 'preset', value: preset.id });
    expect(applied.cssBackground).toBe(preset.background);
    expect(applied.pageColor).toBe(preset.pageColor);
  });

  it('produces a solid color', () => {
    expect(resolveBackground({ type: 'solid', value: '#112233' })).toEqual({
      cssBackground: '#112233',
      pageColor: '#112233',
    });
  });

  it('produces an image background with overlay and fit', () => {
    const applied = resolveBackground({
      type: 'image',
      value: 'https://example.com/a.png',
      overlayOpacity: 0.5,
      fit: 'contain',
    });
    expect(applied.cssBackground).toContain('rgba(255,255,255,0.5)');
    expect(applied.cssBackground).toContain('url("https://example.com/a.png")');
    expect(applied.cssBackground).toContain('center/contain');
  });

  it('uses repeat for tile fit', () => {
    const applied = resolveBackground({
      type: 'image',
      value: 'https://example.com/a.png',
      overlayOpacity: 0.2,
      fit: 'tile',
    });
    expect(applied.cssBackground).toContain('repeat');
    expect(applied.cssBackground).not.toContain('center/');
  });

  it('strips embedded quotes from image url to prevent CSS escape', () => {
    const applied = resolveBackground({
      type: 'image',
      value: 'https://example.com/a".png',
      overlayOpacity: 0,
      fit: 'cover',
    });
    expect(applied.cssBackground).not.toContain('a".png');
    expect(applied.cssBackground).toContain('a.png');
  });
});

describe('applyBackground', () => {
  it('writes CSS variables on document root', () => {
    const applied = applyBackground({ type: 'solid', value: '#abcdef' });
    expect(document.documentElement.style.getPropertyValue('--yclaw-page-bg')).toBe('#abcdef');
    expect(document.documentElement.style.getPropertyValue('--yclaw-body-gradient')).toBe(
      '#abcdef',
    );
    expect(applied.cssBackground).toBe('#abcdef');
  });
});
