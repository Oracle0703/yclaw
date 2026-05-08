/**
 * Task-as-Code v1 — 公共 API 门面
 *
 * 对应 spec：docs/specs/task-as-code-v1.md
 *
 * 提供给 main 进程 / CLI / 测试的统一入口。
 * 仅暴露稳定的导入/导出/校验函数；内部实现可演进。
 */

export { SCHEMA_VERSION } from './types';
export type {
  AnyFile,
  FileKind,
  FileMetadata,
  ScheduleFile,
  SchemaVersion,
  TaskActionFile,
  TaskFile,
  TaskFileSpec,
  TaskStepFile,
  TemplateFieldFile,
  TemplateFile,
  TemplateFileSpec,
} from './types';
export {
  validateFile,
  assertValidFile,
  ValidationError,
  LIMITS,
  type IssueSeverity,
  type ValidationIssue,
  type ValidationResult,
} from './validate';
export { parseFile, parseFileMigrating, lintFile, serializeFile, type ParseOptions, type ParseFileMigratingResult } from './yaml';
export {
  isSecretRef,
  extractEnvName,
  makeEnvRef,
  resolveSecrets,
  toFileSecrets,
  type ResolveSecretsOptions,
} from './secrets';
export {
  taskFromFile,
  taskToFile,
  templateFromFile,
  templateToFile,
  type FromFileTimestamps,
} from './mapping';
export {
  loadFile,
  loadDirectory,
  resolveReferences,
  LOADER_SAFETY,
  type LoadOptions,
  type LoadedEntry,
  type Registry,
} from './loader';
export {
  migrateFile,
  MigrationError,
  BUILTIN_MIGRATIONS,
  MAX_MIGRATION_STEPS,
  type Migration,
  type MigrationContext,
  type MigrationResult,
} from './migrate';
export {
  createWatcher,
  WATCHER_DEFAULTS,
  type Watcher,
  type WatcherOptions,
  type WatcherDeps,
  type WatchEvent,
  type WatchChange,
  type WatchChangeKind,
  type FileSignature,
} from './watcher';
export {
  TaskAsCodeService,
  type Persistence,
  type ServiceDeps,
  type ImportPathResult,
  type ExportFileResult,
  type WatchHandle,
  type AffectedEvent,
} from './service';
