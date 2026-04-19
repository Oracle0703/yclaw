import { describe, expect, it } from 'vitest';
import {
  extractEnvName,
  isSecretRef,
  makeEnvRef,
  resolveSecrets,
  toFileSecrets,
} from '@shared/serialization';

describe('serialization/secrets', () => {
  describe('isSecretRef', () => {
    it.each([
      ['${env:FOO}', true],
      ['${env:_FOO_BAR}', true],
      ['${env:F00}', true],
      ['${env:foo}', false], // 必须大写
      ['${env:1FOO}', false], // 不能数字开头
      ['plain', false],
      ['${other:FOO}', false],
      ['', false],
    ])('returns %s for %s', (input, expected) => {
      expect(isSecretRef(input)).toBe(expected);
    });

    it('returns false for non-string', () => {
      expect(isSecretRef(undefined)).toBe(false);
      expect(isSecretRef(null)).toBe(false);
      expect(isSecretRef(123)).toBe(false);
    });
  });

  describe('extractEnvName', () => {
    it('extracts var name', () => {
      expect(extractEnvName('${env:FOO_BAR}')).toBe('FOO_BAR');
    });
    it('returns null for non-ref', () => {
      expect(extractEnvName('plain')).toBeNull();
    });
  });

  describe('makeEnvRef', () => {
    it('builds reference', () => {
      expect(makeEnvRef('FOO')).toBe('${env:FOO}');
    });
    it('throws on invalid name', () => {
      expect(() => makeEnvRef('foo')).toThrow(/Invalid env name/);
      expect(() => makeEnvRef('1A')).toThrow(/Invalid env name/);
    });
  });

  describe('resolveSecrets', () => {
    it('resolves env values', () => {
      const result = resolveSecrets(
        { user: '${env:FOO_USER}', pass: '${env:FOO_PASS}' },
        { env: { FOO_USER: 'alice', FOO_PASS: 'p@ss' } },
      );
      expect(result).toEqual({ user: 'alice', pass: 'p@ss' });
    });

    it('throws when env missing by default', () => {
      expect(() =>
        resolveSecrets({ user: '${env:MISSING}' }, { env: {} }),
      ).toThrow(/MISSING.*not defined/);
    });

    it('keeps placeholder when onMissing=keep', () => {
      const result = resolveSecrets(
        { user: '${env:MISSING}' },
        { env: {}, onMissing: 'keep' },
      );
      expect(result).toEqual({ user: '${env:MISSING}' });
    });

    it('throws when secret value is not a ref', () => {
      expect(() =>
        resolveSecrets({ user: 'plain' } as Record<string, string>, { env: {} }),
      ).toThrow(/must be in the form/);
    });

    it('returns empty for undefined', () => {
      expect(resolveSecrets(undefined)).toEqual({});
    });

    it('does not mutate input', () => {
      const input = { user: '${env:FOO}' };
      resolveSecrets(input, { env: { FOO: 'bar' } });
      expect(input).toEqual({ user: '${env:FOO}' });
    });
  });

  describe('toFileSecrets', () => {
    it('derives env names from keys', () => {
      expect(toFileSecrets({ user: 'alice', authToken: 'xxx' })).toEqual({
        user: '${env:USER}',
        authToken: '${env:AUTHTOKEN}',
      });
    });

    it('uses explicit mapping when provided', () => {
      expect(
        toFileSecrets({ user: 'alice' }, { user: 'FOO_USER' }),
      ).toEqual({ user: '${env:FOO_USER}' });
    });

    it('replaces illegal chars and prefixes underscore if starts with digit', () => {
      expect(toFileSecrets({ '1odd-key': 'v' })).toEqual({
        '1odd-key': '${env:_1ODD_KEY}',
      });
    });

    it('returns empty when input empty/undefined', () => {
      expect(toFileSecrets(undefined)).toEqual({});
      expect(toFileSecrets({})).toEqual({});
    });
  });
});
