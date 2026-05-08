import { describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_MIGRATIONS,
  MigrationError,
  migrateFile,
  parseFileMigrating,
  SCHEMA_VERSION,
  type Migration,
} from '@shared/serialization';

const V0_TASK = {
  schemaVersion: 0,
  kind: 'Task' as const,
  metadata: { id: 't1', title: '旧版任务' },
  spec: {
    steps: [{ id: 's1', name: 'c', action: { type: 'click', selector: '#a' } }],
  },
};

describe('serialization · migrate · migrateFile', () => {
  it('returns shallow copy when already at current version', () => {
    const input = {
      schemaVersion: SCHEMA_VERSION,
      kind: 'Task',
      metadata: { id: 't', name: 'T' },
      spec: { steps: [] },
    };
    const r = migrateFile(input);
    expect(r.fromVersion).toBe(SCHEMA_VERSION);
    expect(r.toVersion).toBe(SCHEMA_VERSION);
    expect(r.appliedCount).toBe(0);
    expect(r.output).not.toBe(input); // 浅拷贝
    expect(r.output).toEqual(input);
  });

  it('applies built-in v0→v1 migration: title → name', () => {
    const r = migrateFile(V0_TASK);
    expect(r.fromVersion).toBe(0);
    expect(r.toVersion).toBe(1);
    expect(r.appliedCount).toBe(1);
    const out = r.output as typeof V0_TASK & { metadata: { name: string; title?: string } };
    expect(out.schemaVersion).toBe(1);
    expect(out.metadata.name).toBe('旧版任务');
    expect(out.metadata.title).toBeUndefined();
  });

  it('does not mutate input', () => {
    const input = JSON.parse(JSON.stringify(V0_TASK));
    const snapshot = JSON.parse(JSON.stringify(input));
    migrateFile(input);
    expect(input).toEqual(snapshot);
  });

  it('throws on non-object input', () => {
    expect(() => migrateFile(null)).toThrow(MigrationError);
    expect(() => migrateFile('x' as unknown)).toThrow(MigrationError);
    expect(() => migrateFile([1, 2] as unknown)).toThrow(/plain object/);
  });

  it('throws on invalid schemaVersion', () => {
    expect(() => migrateFile({ schemaVersion: '1' })).toThrow(/invalid schemaVersion/);
    expect(() => migrateFile({ schemaVersion: -1 })).toThrow(/invalid schemaVersion/);
    expect(() => migrateFile({ schemaVersion: 1.5 })).toThrow(/invalid schemaVersion/);
    expect(() => migrateFile({})).toThrow(/invalid schemaVersion/);
  });

  it('throws when version is newer than supported', () => {
    expect(() => migrateFile({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/newer than supported/);
  });

  it('throws when no migration is registered for a step', () => {
    // 假设没有 v0→v1：清空 migrations
    expect(() => migrateFile(V0_TASK, { migrations: [] })).toThrow(/no migration registered from schemaVersion 0/);
  });

  it('invokes context.onMigrate callback', () => {
    const onMigrate = vi.fn();
    migrateFile(V0_TASK, { context: { onMigrate } });
    expect(onMigrate).toHaveBeenCalledTimes(1);
    expect(onMigrate).toHaveBeenCalledWith({ from: 0, to: 1, kind: 'Task' });
  });

  it('prefers kind-specific migration over generic', () => {
    const generic: Migration = {
      from: 0,
      to: 1,
      migrate: (i) => ({ ...i, schemaVersion: 1, _generic: true }),
    };
    const taskOnly: Migration = {
      from: 0,
      to: 1,
      kind: 'Task',
      migrate: (i) => ({ ...i, schemaVersion: 1, _task: true }),
    };
    const r = migrateFile(V0_TASK, { migrations: [generic, taskOnly] });
    expect((r.output as { _task?: boolean })._task).toBe(true);
    expect((r.output as { _generic?: boolean })._generic).toBeUndefined();
  });

  it('falls back to generic when kind-specific is missing', () => {
    const generic: Migration = {
      from: 0,
      to: 1,
      migrate: (i) => ({ ...i, schemaVersion: 1, _generic: true }),
    };
    const r = migrateFile(V0_TASK, { migrations: [generic] });
    expect((r.output as { _generic?: boolean })._generic).toBe(true);
  });

  it('detects malformed migration that returns wrong schemaVersion', () => {
    const bad: Migration = {
      from: 0,
      to: 2,
      migrate: (i) => ({ ...i, schemaVersion: 2 }),
    };
    expect(() => migrateFile(V0_TASK, { migrations: [bad] })).toThrow(/must produce to=1/);
  });

  it('auto-fixes migrations that forget to set schemaVersion', () => {
    const lazy: Migration = {
      from: 0,
      to: 1,
      migrate: (i) => ({ ...i, metadata: { id: 't', name: 'lazy' } }),
    };
    const r = migrateFile(V0_TASK, { migrations: [lazy] });
    expect((r.output as { schemaVersion: number }).schemaVersion).toBe(1);
  });

  it('detects non-object output from a migration', () => {
    const bad: Migration = {
      from: 0,
      to: 1,
      migrate: () => null as unknown as Record<string, unknown>,
    };
    expect(() => migrateFile(V0_TASK, { migrations: [bad] })).toThrow(/non-object/);
  });

  it('chains multiple migrations (synthetic v0→v1→v2)', () => {
    // 用 fake current version 模拟链：from 0 → 1 → 2
    // 这里通过 BUILTIN_MIGRATIONS 不能改变 SCHEMA_VERSION，所以用空 migrations 测链时 SCHEMA_VERSION=1，
    // 只能验证一步；多步链路在 SCHEMA_VERSION 升到 2 后才有效。
    // 至少验证当前一步链的正确性：
    const r = migrateFile(V0_TASK, { migrations: BUILTIN_MIGRATIONS });
    expect(r.appliedCount).toBe(1);
  });
});

describe('serialization · migrate · parseFileMigrating', () => {
  const V0_YAML = `
schemaVersion: 0
kind: Task
metadata:
  id: t1
  title: 旧版本
spec:
  steps:
    - id: s1
      name: c
      action: { type: click, selector: '#a' }
`;

  it('migrates and validates', () => {
    const r = parseFileMigrating(V0_YAML);
    expect(r.migration.appliedCount).toBe(1);
    expect(r.file.metadata.name).toBe('旧版本');
  });

  it('plain parseFile rejects v0', async () => {
    const { parseFile } = await import('@shared/serialization');
    expect(() => parseFile(V0_YAML)).toThrow(/Unsupported schemaVersion/);
  });

  it('migration result then validation failure surfaces ValidationError', async () => {
    const { ValidationError } = await import('@shared/serialization');
    const broken = `
schemaVersion: 0
kind: Task
metadata:
  id: '!!!'
  title: ''
spec:
  steps: []
`;
    expect(() => parseFileMigrating(broken)).toThrow(ValidationError);
  });
});
