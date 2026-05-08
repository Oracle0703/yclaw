import { describe, expect, it } from 'vitest';
import {
  MAX_MIGRATION_STEPS,
  MigrationError,
  migrateFile,
  type Migration,
} from '@shared/serialization';

describe('serialization · migrate · security/edge-case', () => {
  it('does not mutate caller input even if migration mutates `current`', () => {
    const mutating: Migration = {
      from: 0,
      to: 1,
      // Bad-citizen migration: mutate input directly
      migrate: (i) => {
        (i as Record<string, unknown>).hijacked = true;
        return { ...i, schemaVersion: 1 };
      },
    };
    const input = { schemaVersion: 0, kind: 'Task', metadata: { id: 't', name: 'x' } };
    const snapshot = JSON.parse(JSON.stringify(input));
    migrateFile(input, { migrations: [mutating] });
    expect(input).toEqual(snapshot);
    expect((input as { hijacked?: boolean }).hijacked).toBeUndefined();
  });

  it('rejects when migration chain would exceed maxSteps', () => {
    // Create a registry that pretends to advance schemaVersion but keeps reporting
    // the same `from` after each step → would loop forever; the chain bound
    // and the `to !== version+1` check together must protect us.
    // Here we use a low maxSteps with a chain that's actually correct (only one step
    // exists from 0→1) and check the cap is enforced when steps == cap.
    const stepZero: Migration = { from: 0, to: 1, migrate: (i) => ({ ...i, schemaVersion: 1 }) };
    expect(() =>
      migrateFile({ schemaVersion: 0, kind: 'Task' }, { migrations: [stepZero], maxSteps: 0 }),
    ).toThrow(/exceeded maxSteps=0/);
  });

  it('exposes a sane default MAX_MIGRATION_STEPS', () => {
    expect(MAX_MIGRATION_STEPS).toBeGreaterThan(0);
    expect(MAX_MIGRATION_STEPS).toBeLessThanOrEqual(1024);
  });

  it('treats array as non-object', () => {
    expect(() => migrateFile([{ schemaVersion: 1 }] as unknown)).toThrow(MigrationError);
  });

  it('rejects when migration returns array', () => {
    const bad: Migration = {
      from: 0,
      to: 1,
      migrate: () => [] as unknown as Record<string, unknown>,
    };
    expect(() => migrateFile({ schemaVersion: 0 }, { migrations: [bad] })).toThrow(/non-object/);
  });

  it('does not crash on prototype-pollution-style keys in input', () => {
    // YAML cannot produce __proto__ as a real prototype mutator under our parser
    // settings, but defend by checking that __proto__ key just shows up as a normal
    // own property and is not silently merged into Object.prototype.
    const tricky = JSON.parse('{"schemaVersion":0,"__proto__":{"polluted":true}}');
    migrateFile(tricky, {
      migrations: [{ from: 0, to: 1, migrate: (i) => ({ ...i, schemaVersion: 1 }) }],
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
