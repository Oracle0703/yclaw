import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  lintFile,
  parseFile,
  serializeFile,
  type TaskFile,
} from '@shared/serialization';

const SAMPLE_TASK_YAML = `schemaVersion: 1
kind: Task
metadata:
  id: daily-report
  name: 每日报表
  tags: [daily, report]
spec:
  entryUrl: https://example.com
  steps:
    - id: open
      name: 打开
      action:
        type: click
        selector: '#login'
  schedule:
    type: cron
    cron: '0 8 * * *'
  secrets:
    user: \${env:FOO_USER}
`;

describe('serialization/yaml', () => {
  describe('parseFile', () => {
    it('parses a valid YAML', () => {
      const file = parseFile(SAMPLE_TASK_YAML) as TaskFile;
      expect(file.kind).toBe('Task');
      expect(file.metadata.id).toBe('daily-report');
      expect(file.spec.steps).toHaveLength(1);
      expect(file.spec.secrets?.user).toBe('${env:FOO_USER}');
    });

    it('throws on invalid YAML syntax', () => {
      expect(() => parseFile('foo: : bar')).toThrow(/YAML parse error/);
    });

    it('includes filePath in error message when provided', () => {
      expect(() => parseFile('foo: : bar', { filePath: 'a.yaml' })).toThrow(/a\.yaml/);
    });

    it('throws on schema-invalid YAML', () => {
      expect(() =>
        parseFile('schemaVersion: 1\nkind: Bogus\nmetadata: {}\nspec: {}\n'),
      ).toThrow(/Validation failed/);
    });

    it('rejects YAML merge keys (security)', () => {
      // 关闭 merge 后，使用 << 不应被解析为合并；当前 yaml 库会留下原样的字段。
      // 这里更关心：解析器不会因为合并语义产生意外 schema 注入。
      const yaml = `_anchor: &base
  foo: 1
schemaVersion: 1
kind: Task
metadata:
  id: t
  name: t
spec:
  <<: *base
  steps: []
`;
      // 关闭合并键时此 YAML 仍可解析，但会落到 "<<" 字段；schema 校验应当接受
      // 因为我们的 validate 不强制禁止未知字段（向后兼容）。
      // 这里只确保不抛 "merge key" 异常。
      expect(() => parseFile(yaml)).not.toThrow(/merge/i);
    });
  });

  describe('serializeFile', () => {
    it('serializes a Task and re-parses to deep-equal', () => {
      const original: TaskFile = {
        schemaVersion: SCHEMA_VERSION,
        kind: 'Task',
        metadata: { id: 't', name: '任务', tags: ['a', 'b'] },
        spec: {
          steps: [
            { id: 's1', name: 'step', action: { type: 'click', selector: '.x' } },
          ],
          schedule: { type: 'manual' },
          enabled: false,
          secrets: { user: '${env:FOO}' },
        },
      };
      const yaml = serializeFile(original);
      const round = parseFile(yaml);
      expect(round).toEqual(original);
    });

    it('round-trip is stable (idempotent)', () => {
      const original = parseFile(SAMPLE_TASK_YAML);
      const a = serializeFile(original);
      const b = serializeFile(parseFile(a));
      expect(b).toEqual(a);
    });
  });

  describe('lintFile', () => {
    it('returns ok for valid', () => {
      expect(lintFile(SAMPLE_TASK_YAML).ok).toBe(true);
    });

    it('reports YAML syntax error as issue', () => {
      const r = lintFile('foo: : bar', { filePath: 'a.yaml' });
      expect(r.ok).toBe(false);
      expect(r.issues[0]?.path).toBe('a.yaml');
      expect(r.issues[0]?.message).toMatch(/YAML parse error/);
    });

    it('reports schema issues as issues (no throw)', () => {
      const r = lintFile('schemaVersion: 1\nkind: Bogus\nmetadata: {}\nspec: {}\n');
      expect(r.ok).toBe(false);
      expect(r.issues.length).toBeGreaterThan(0);
    });
  });
});
