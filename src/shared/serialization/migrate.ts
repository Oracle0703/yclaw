/**
 * Task-as-Code v1 — Schema 迁移框架（TAC-06）
 *
 * 目的：当 schemaVersion 演进时，把旧版本文件升级到当前版本。
 *
 * 设计：
 * - 注册的迁移函数链 `Migration { from, to, kind?, migrate(input) }`，构造时按 from 排序。
 * - `migrateFile(input)` 接受任意 unknown，返回迁移后的对象（仍未 schema 校验，由调用方 validate）。
 * - 迁移函数应 **纯**：输入不修改，返回新对象。
 * - 当前版本未来上调时只需在 `BUILTIN_MIGRATIONS` 追加一条记录。
 *
 * 当前内置：示例 v0→v1（演示用，因为没有 v0 用户文件，仅供测试与文档参考）。
 */

import { SCHEMA_VERSION } from './types';
import type { FileKind } from './types';

export interface MigrationContext {
  /** 自定义日志/统计回调；不会抛错 */
  onMigrate?: (info: { from: number; to: number; kind?: FileKind }) => void;
}

export interface Migration {
  /** 输入文件的 schemaVersion */
  from: number;
  /** 输出文件的 schemaVersion；必须 === from + 1 */
  to: number;
  /** 仅对指定 kind 生效；省略表示对所有 kind 生效 */
  kind?: FileKind;
  /**
   * 把一个对象从 from 迁移到 to。
   * 输入不应被修改；返回新对象。
   * 实现应尽可能宽松（容忍未知字段）但保证关键字段正确。
   */
  migrate: (input: Record<string, unknown>) => Record<string, unknown>;
}

/** 演示迁移：v0 → v1（v0 假定 metadata.title 而非 metadata.name） */
const v0ToV1: Migration = {
  from: 0,
  to: 1,
  migrate: (input) => {
    const next: Record<string, unknown> = { ...input, schemaVersion: 1 };
    const meta = input.metadata;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      const m = meta as Record<string, unknown>;
      if (typeof m.name === 'string') {
        next.metadata = m;
      } else if (typeof m.title === 'string') {
        const { title, ...rest } = m;
        next.metadata = { ...rest, name: title };
      } else {
        next.metadata = m;
      }
    }
    return next;
  },
};

export const BUILTIN_MIGRATIONS: readonly Migration[] = Object.freeze([v0ToV1]);

/**
 * Hard upper bound on consecutive migration steps applied to a single file.
 * Defense-in-depth against pathological registries or untrusted input that could
 * otherwise loop near `SCHEMA_VERSION` iterations.
 */
export const MAX_MIGRATION_STEPS = 32;

export interface MigrationResult {
  /** 迁移后的对象；若无需迁移则返回原对象的浅拷贝 */
  output: Record<string, unknown>;
  /** 起始 schemaVersion */
  fromVersion: number;
  /** 最终 schemaVersion（应等于 SCHEMA_VERSION） */
  toVersion: number;
  /** 实际执行的迁移数 */
  appliedCount: number;
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * 把任意解析后的对象迁移到当前 SCHEMA_VERSION。
 * - 输入不是 plain object → 抛 MigrationError
 * - schemaVersion 缺失或非整数 → 抛 MigrationError
 * - 找不到接续的迁移函数 → 抛 MigrationError
 * - 已经是当前版本 → 直接返回浅拷贝（appliedCount=0）
 */
export function migrateFile(
  input: unknown,
  options: { migrations?: readonly Migration[]; context?: MigrationContext; maxSteps?: number } = {},
): MigrationResult {
  const obj = assertPlainObject(input, 'migrate input must be a plain object');
  const maxSteps = options.maxSteps ?? MAX_MIGRATION_STEPS;
  const fromRaw = obj.schemaVersion;
  if (typeof fromRaw !== 'number' || !Number.isInteger(fromRaw) || fromRaw < 0) {
    throw new MigrationError(`invalid schemaVersion: ${JSON.stringify(fromRaw)}`);
  }
  const fromVersion = fromRaw;
  if (fromVersion > SCHEMA_VERSION) {
    throw new MigrationError(
      `schemaVersion ${fromVersion} is newer than supported ${SCHEMA_VERSION}; please upgrade yclaw`,
    );
  }
  const migrations = options.migrations ?? BUILTIN_MIGRATIONS;
  const kindRaw = typeof obj.kind === 'string' ? (obj.kind as FileKind) : undefined;

  // No migrations needed → return shallow copy so callers may mutate freely.
  if (fromVersion === SCHEMA_VERSION) {
    return { output: { ...obj }, fromVersion, toVersion: fromVersion, appliedCount: 0 };
  }

  // Defensive shallow clone — a buggy migration that mutates instead of
  // returning a new object must not corrupt the caller's input.
  let current: Record<string, unknown> = { ...obj };
  let version = fromVersion;
  let applied = 0;

  while (version < SCHEMA_VERSION) {
    if (applied >= maxSteps) {
      throw new MigrationError(
        `migration chain exceeded maxSteps=${maxSteps} (stuck at schemaVersion ${version})`,
      );
    }
    const next = pickMigration(migrations, version, kindRaw);
    if (!next) {
      throw new MigrationError(
        `no migration registered from schemaVersion ${version} to ${version + 1}` +
          (kindRaw ? ` (kind=${kindRaw})` : ''),
      );
    }
    if (next.to !== version + 1) {
      throw new MigrationError(
        `migration step from=${next.from} must produce to=${version + 1}, got ${next.to}`,
      );
    }
    const produced = next.migrate(current);
    current = assertPlainObject(produced, `migration ${version}→${version + 1} returned non-object`);
    if (current.schemaVersion !== next.to) {
      // Tolerate migrations that forget to bump schemaVersion themselves.
      current = { ...current, schemaVersion: next.to };
    }
    options.context?.onMigrate?.({ from: next.from, to: next.to, kind: kindRaw });
    version = next.to;
    applied += 1;
  }

  return { output: current, fromVersion, toVersion: version, appliedCount: applied };
}

function assertPlainObject(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MigrationError(message);
  }
  return value as Record<string, unknown>;
}

function pickMigration(
  migrations: readonly Migration[],
  fromVersion: number,
  kind?: FileKind,
): Migration | undefined {
  // 优先匹配 kind 一致的；否则回退到通配
  let generic: Migration | undefined;
  for (const m of migrations) {
    if (m.from !== fromVersion) continue;
    if (m.kind === kind) return m;
    if (m.kind === undefined) generic = m;
  }
  return generic;
}
