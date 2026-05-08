/**
 * Task-as-Code v1 — YAML 编解码
 *
 * 仅做「文本 ↔ JS 对象」转换；schema 校验交给 validate.ts。
 *
 * 设计取舍：
 * - 使用 yaml@2 的 `parse` / `stringify`，输出稳定的 key 顺序便于 git diff。
 * - 解析时关闭合并键（`<<`）、开启重复键报错（uniqueKeys=true），
 *   以防范「重复 key 走私」与合并语义带来的意外 schema 注入。
 * - stringify 强制 lineWidth=120、indent=2、字符串使用单引号，符合主流约定。
 */

import { parse, stringify, type DocumentOptions, type ParseOptions as YamlParseOptions, type SchemaOptions, type ToJSOptions, type ToStringOptions } from 'yaml';
import { assertValidFile, validateFile, type ValidationResult } from './validate';
import { migrateFile, type Migration, type MigrationResult } from './migrate';
import type { AnyFile } from './types';

const PARSE_OPTIONS: YamlParseOptions & DocumentOptions & SchemaOptions & ToJSOptions = {
  // 关闭合并键，避免 `<<: *anchor` 语义意外注入字段
  merge: false,
  // 重复键报错，防止「id: a\nid: b」之类的 schema smuggling
  uniqueKeys: true,
  // strict 模式下 YAML 1.2 语法偶遇不合法赋值会报错而非警告
  strict: true,
};

const STRINGIFY_OPTIONS: ToStringOptions = {
  indent: 2,
  lineWidth: 120,
  singleQuote: true,
};

export interface ParseOptions {
  /**
   * 文件路径，仅用于错误信息。可选。
   */
  filePath?: string;
}

/**
 * 从 YAML 文本反序列化并校验。
 * 校验失败抛出 `ValidationError`；YAML 语法错误抛出原始错误。
 */
export function parseFile(text: string, options: ParseOptions = {}): AnyFile {
  let raw: unknown;
  try {
    raw = parse(text, PARSE_OPTIONS);
  } catch (error) {
    const prefix = options.filePath ? `${options.filePath}: ` : '';
    throw new Error(
      `${prefix}YAML parse error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return assertValidFile(raw);
}

/**
 * 校验文本但不抛错；返回 lint 用的 issue 列表。
 * 若 YAML 语法错误，会作为单条 error 入 issues。
 */
export function lintFile(
  text: string,
  options: ParseOptions & { migrate?: boolean } = {},
): ValidationResult {
  try {
    const raw = parse(text, PARSE_OPTIONS);
    if (options.migrate) {
      try {
        const migrated = migrateFile(raw);
        return validateFile(migrated.output);
      } catch (err) {
        return {
          ok: false,
          issues: [
            {
              path: options.filePath ?? '$',
              message: `migration error: ${err instanceof Error ? err.message : String(err)}`,
              severity: 'error',
            },
          ],
        };
      }
    }
    return validateFile(raw);
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          path: options.filePath ?? '$',
          message: `YAML parse error: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'error',
        },
      ],
    };
  }
}

/**
 * 与 `parseFile` 相同，但会先尝试将旧 schemaVersion 升级到当前版本，
 * 然后再校验。返回校验通过的文件 + 迁移信息。
 */
export interface ParseFileMigratingResult {
  file: AnyFile;
  migration: MigrationResult;
}
export function parseFileMigrating(
  text: string,
  options: ParseOptions & { migrations?: readonly Migration[] } = {},
): ParseFileMigratingResult {
  let raw: unknown;
  try {
    raw = parse(text, PARSE_OPTIONS);
  } catch (error) {
    const prefix = options.filePath ? `${options.filePath}: ` : '';
    throw new Error(
      `${prefix}YAML parse error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const migration = migrateFile(raw, options.migrations ? { migrations: options.migrations } : undefined);
  const file = assertValidFile(migration.output);
  return { file, migration };
}

/**
 * 把已校验的文件对象序列化为 YAML 文本。
 * 不进行 schema 校验；调用方应保证 file 合法。
 */
export function serializeFile(file: AnyFile): string {
  return stringify(file, STRINGIFY_OPTIONS);
}
