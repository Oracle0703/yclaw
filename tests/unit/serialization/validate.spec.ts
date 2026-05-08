import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  ValidationError,
  assertValidFile,
  validateFile,
  type TaskFile,
  type TemplateFile,
} from '@shared/serialization';

function validTask(): TaskFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'Task',
    metadata: { id: 'daily-report', name: '每日报表' },
    spec: {
      steps: [
        {
          id: 'open',
          name: '打开页面',
          action: { type: 'click', selector: 'body' },
        },
      ],
    },
  };
}

function validTemplate(): TemplateFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'Template',
    metadata: { id: 'tpl-1', name: '模板' },
    spec: {
      fields: [{ name: 'price', selector: '.price', attribute: 'text' }],
    },
  };
}

describe('serialization/validate', () => {
  describe('validateFile (positive)', () => {
    it('accepts a minimal Task', () => {
      const r = validateFile(validTask());
      expect(r.ok).toBe(true);
      expect(r.issues).toEqual([]);
    });

    it('accepts a minimal Template', () => {
      const r = validateFile(validTemplate());
      expect(r.ok).toBe(true);
    });

    it('accepts schedule cron with cron string', () => {
      const t = validTask();
      t.spec.schedule = { type: 'cron', cron: '0 8 * * *' };
      expect(validateFile(t).ok).toBe(true);
    });

    it('accepts schedule once with ISO runAt', () => {
      const t = validTask();
      t.spec.schedule = { type: 'once', runAt: '2026-04-20T08:00:00Z' };
      expect(validateFile(t).ok).toBe(true);
    });

    it('accepts secrets in env-ref form', () => {
      const t = validTask();
      t.spec.secrets = { user: '${env:FOO_USER}' };
      expect(validateFile(t).ok).toBe(true);
    });
  });

  describe('validateFile (negative)', () => {
    it('rejects non-object root', () => {
      expect(validateFile('foo').ok).toBe(false);
      expect(validateFile(null).ok).toBe(false);
      expect(validateFile([]).ok).toBe(false);
    });

    it('rejects unknown kind', () => {
      const r = validateFile({ ...validTask(), kind: 'Bogus' });
      expect(r.ok).toBe(false);
      expect(r.issues.some((i) => i.path === '$.kind')).toBe(true);
    });

    it('rejects wrong schemaVersion', () => {
      const r = validateFile({ ...validTask(), schemaVersion: 999 });
      expect(r.ok).toBe(false);
      expect(r.issues.some((i) => i.path === '$.schemaVersion')).toBe(true);
    });

    it('rejects invalid id pattern', () => {
      const t = validTask();
      t.metadata.id = '!!bad';
      expect(validateFile(t).issues.some((i) => i.path === '$.metadata.id')).toBe(true);
    });

    it('rejects empty name', () => {
      const t = validTask();
      t.metadata.name = '   ';
      expect(validateFile(t).issues.some((i) => i.path === '$.metadata.name')).toBe(true);
    });

    it('rejects duplicate step ids', () => {
      const t = validTask();
      t.spec.steps = [
        { id: 'a', name: '1', action: { type: 'click', selector: 'x' } },
        { id: 'a', name: '2', action: { type: 'click', selector: 'y' } },
      ];
      const r = validateFile(t);
      expect(r.ok).toBe(false);
      expect(r.issues.some((i) => /duplicate step id/.test(i.message))).toBe(true);
    });

    it('rejects unknown action type', () => {
      const t = validTask();
      t.spec.steps[0]!.action.type = 'evil' as TaskFile['spec']['steps'][number]['action']['type'];
      const r = validateFile(t);
      expect(r.ok).toBe(false);
    });

    it('rejects schedule cron without cron', () => {
      const t = validTask();
      t.spec.schedule = { type: 'cron' };
      expect(validateFile(t).ok).toBe(false);
    });

    it('rejects schedule once with bad runAt', () => {
      const t = validTask();
      t.spec.schedule = { type: 'once', runAt: 'not-a-date' };
      expect(validateFile(t).ok).toBe(false);
    });

    it('rejects negative retry', () => {
      const t = validTask();
      t.spec.steps[0]!.retryCount = -1;
      expect(validateFile(t).ok).toBe(false);
    });

    it('rejects plaintext secret value', () => {
      const t = validTask();
      // 故意写入明文，应被拒绝
      t.spec.secrets = { user: 'plain' };
      const r = validateFile(t);
      expect(r.ok).toBe(false);
      expect(r.issues.some((i) => i.path === '$.spec.secrets.user')).toBe(true);
    });

    it('warns on empty steps but still ok', () => {
      const t = validTask();
      t.spec.steps = [];
      const r = validateFile(t);
      expect(r.ok).toBe(true);
      expect(r.issues.some((i) => i.severity === 'warning' && i.path === '$.spec.steps')).toBe(true);
    });

    it('rejects template with empty fields', () => {
      const t = validTemplate();
      t.spec.fields = [];
      expect(validateFile(t).ok).toBe(false);
    });

    it('rejects duplicate field names in template', () => {
      const t = validTemplate();
      t.spec.fields = [
        { name: 'p', selector: 'a', attribute: 't' },
        { name: 'p', selector: 'b', attribute: 't' },
      ];
      expect(validateFile(t).ok).toBe(false);
    });
  });

  describe('assertValidFile', () => {
    it('returns input when valid', () => {
      const t = validTask();
      expect(assertValidFile(t)).toBe(t);
    });

    it('throws ValidationError with issues', () => {
      try {
        assertValidFile({ kind: 'Bogus' });
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        const ve = e as ValidationError;
        expect(ve.issues.length).toBeGreaterThan(0);
        expect(ve.message).toMatch(/Validation failed/);
      }
    });
  });
});
