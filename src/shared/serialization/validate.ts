/**
 * Task-as-Code v1 — Schema 校验
 *
 * 设计取舍：
 * - 用手写 narrowing 而非 zod，因为字段数量小、错误位置需要精准定位。
 * - 校验返回 issues 列表（path + message），而非抛错；适合 lint 输出。
 * - 校验**只看结构合法性**；引用解析（templateRef → templateId）由调用方处理。
 */

import {
  AnyFile,
  FileKind,
  ScheduleFile,
  SCHEMA_VERSION,
  TaskActionFile,
  TaskFile,
  TaskFileSpec,
  TaskStepFile,
  TemplateFieldFile,
  TemplateFile,
  TemplateFileSpec,
} from './types';
import { isSecretRef } from './secrets';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: IssueSeverity;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const VALID_KINDS: ReadonlySet<FileKind> = new Set(['Task', 'Template']);
const VALID_ACTION_TYPES: ReadonlySet<TaskActionFile['type']> = new Set([
  'click',
  'input',
  'scroll',
  'extract',
  'screenshot',
]);
const VALID_SCHEDULE_TYPES: ReadonlySet<ScheduleFile['type']> = new Set([
  'manual',
  'once',
  'cron',
]);

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/;

/** 防 DoS / 资源滥用的硬上限 */
export const LIMITS = {
  /** metadata.name / step.name 等显示字符串 */
  maxNameLength: 200,
  /** metadata.description / 其它自由文本 */
  maxDescriptionLength: 2000,
  /** action.selector / field.selector */
  maxSelectorLength: 1000,
  /** 单文件最多 step 数 */
  maxSteps: 500,
  /** 单文件最多 template 字段 */
  maxFields: 500,
  /** secrets 条目数 */
  maxSecrets: 100,
  /** tags 数 */
  maxTags: 50,
} as const;

/** 禁止出现在任意对象中的危险 key（防原型污染） */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'prototype', 'constructor']);

function hasForbiddenKey(obj: Record<string, unknown>): string | null {
  for (const k of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(k)) return k;
  }
  return null;
}

class IssueCollector {
  readonly issues: ValidationIssue[] = [];
  error(path: string, message: string): void {
    this.issues.push({ path, message, severity: 'error' });
  }
  warning(path: string, message: string): void {
    this.issues.push({ path, message, severity: 'warning' });
  }
  hasErrors(): boolean {
    return this.issues.some((i) => i.severity === 'error');
  }
}

/**
 * 校验任意 YAML 解析后的对象是否是合法 Task / Template 文件。
 *
 * 调用方应保证 input 是已解析的 JS 值（不是 YAML 文本）。
 */
export function validateFile(input: unknown): ValidationResult {
  const c = new IssueCollector();
  validateRoot(input, c);
  return { ok: !c.hasErrors(), issues: c.issues };
}

function validateRoot(input: unknown, c: IssueCollector): void {
  if (!isPlainObject(input)) {
    c.error('$', 'File root must be an object');
    return;
  }
  const forbidden = hasForbiddenKey(input);
  if (forbidden) {
    c.error('$', `forbidden key "${forbidden}" at root (potential prototype pollution)`);
    return;
  }
  if (input.schemaVersion !== SCHEMA_VERSION) {
    c.error(
      '$.schemaVersion',
      `Unsupported schemaVersion ${JSON.stringify(input.schemaVersion)}; expected ${SCHEMA_VERSION}`,
    );
  }
  if (typeof input.kind !== 'string' || !VALID_KINDS.has(input.kind as FileKind)) {
    c.error(
      '$.kind',
      `kind must be one of ${[...VALID_KINDS].join(', ')}, got ${JSON.stringify(input.kind)}`,
    );
    return;
  }
  validateMetadata(input.metadata, c);
  if (input.kind === 'Task') {
    validateTaskSpec(input.spec, c);
  } else if (input.kind === 'Template') {
    validateTemplateSpec(input.spec, c);
  }
}

function validateMetadata(value: unknown, c: IssueCollector): void {
  if (!isPlainObject(value)) {
    c.error('$.metadata', 'metadata must be an object');
    return;
  }
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) {
    c.error(
      '$.metadata.id',
      `id must match ${ID_PATTERN.source}`,
    );
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    c.error('$.metadata.name', 'name must be a non-empty string');
  } else if (value.name.length > LIMITS.maxNameLength) {
    c.error('$.metadata.name', `name length exceeds ${LIMITS.maxNameLength}`);
  } else if (containsControlChars(value.name)) {
    c.error('$.metadata.name', 'name must not contain control characters');
  }
  if (value.tags !== undefined) {
    if (!Array.isArray(value.tags) || !value.tags.every((t) => typeof t === 'string')) {
      c.error('$.metadata.tags', 'tags must be an array of strings');
    } else if (value.tags.length > LIMITS.maxTags) {
      c.error('$.metadata.tags', `tags length exceeds ${LIMITS.maxTags}`);
    }
  }
  if (value.description !== undefined) {
    if (typeof value.description !== 'string') {
      c.error('$.metadata.description', 'description must be a string');
    } else if (value.description.length > LIMITS.maxDescriptionLength) {
      c.error('$.metadata.description', `description length exceeds ${LIMITS.maxDescriptionLength}`);
    }
  }
}

function validateTaskSpec(value: unknown, c: IssueCollector): void {
  if (!isPlainObject(value)) {
    c.error('$.spec', 'Task spec must be an object');
    return;
  }
  if (value.entryUrl !== undefined && typeof value.entryUrl !== 'string') {
    c.error('$.spec.entryUrl', 'entryUrl must be a string');
  }
  if (!Array.isArray(value.steps)) {
    c.error('$.spec.steps', 'steps must be an array');
  } else {
    if (value.steps.length === 0) {
      c.warning('$.spec.steps', 'steps array is empty');
    } else if (value.steps.length > LIMITS.maxSteps) {
      c.error('$.spec.steps', `steps length exceeds ${LIMITS.maxSteps}`);
    }
    const seenIds = new Set<string>();
    value.steps.forEach((step, i) => {
      validateStep(step, `$.spec.steps[${i}]`, c, seenIds);
    });
  }
  if (value.schedule !== undefined) {
    validateSchedule(value.schedule, c);
  }
  if (value.templateRef !== undefined) {
    if (typeof value.templateRef !== 'string' || !ID_PATTERN.test(value.templateRef)) {
      c.error('$.spec.templateRef', `templateRef must match ${ID_PATTERN.source}`);
    }
  }
  if (value.sessionRef !== undefined) {
    if (typeof value.sessionRef !== 'string' || !ID_PATTERN.test(value.sessionRef)) {
      c.error('$.spec.sessionRef', `sessionRef must match ${ID_PATTERN.source}`);
    }
  }
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
    c.error('$.spec.enabled', 'enabled must be a boolean');
  }
  if (value.secrets !== undefined) {
    validateSecrets(value.secrets, c);
  }
}

function validateStep(
  value: unknown,
  path: string,
  c: IssueCollector,
  seenIds: Set<string>,
): void {
  if (!isPlainObject(value)) {
    c.error(path, 'step must be an object');
    return;
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    c.error(`${path}.id`, 'step.id must be a non-empty string');
  } else if (seenIds.has(value.id)) {
    c.error(`${path}.id`, `duplicate step id "${value.id}"`);
  } else {
    seenIds.add(value.id);
  }
  if (typeof value.name !== 'string' || value.name.length === 0) {
    c.error(`${path}.name`, 'step.name must be a non-empty string');
  }
  validateAction(value.action, `${path}.action`, c);
  if (value.retryCount !== undefined && !isNonNegativeInteger(value.retryCount)) {
    c.error(`${path}.retryCount`, 'retryCount must be a non-negative integer');
  }
  if (value.retryDelay !== undefined && !isNonNegativeInteger(value.retryDelay)) {
    c.error(`${path}.retryDelay`, 'retryDelay must be a non-negative integer (ms)');
  }
}

function validateAction(value: unknown, path: string, c: IssueCollector): void {
  if (!isPlainObject(value)) {
    c.error(path, 'action must be an object');
    return;
  }
  if (typeof value.type !== 'string' || !VALID_ACTION_TYPES.has(value.type as TaskActionFile['type'])) {
    c.error(
      `${path}.type`,
      `action.type must be one of ${[...VALID_ACTION_TYPES].join(', ')}`,
    );
  }
  if (typeof value.selector !== 'string') {
    c.error(`${path}.selector`, 'action.selector must be a string');
  } else if (value.selector.length > LIMITS.maxSelectorLength) {
    c.error(`${path}.selector`, `selector length exceeds ${LIMITS.maxSelectorLength}`);
  }
  if (value.timeout !== undefined && !isNonNegativeInteger(value.timeout)) {
    c.error(`${path}.timeout`, 'action.timeout must be a non-negative integer (ms)');
  }
  if (value.params !== undefined && !isPlainObject(value.params)) {
    c.error(`${path}.params`, 'action.params must be an object');
  }
}

function validateSchedule(value: unknown, c: IssueCollector): void {
  if (!isPlainObject(value)) {
    c.error('$.spec.schedule', 'schedule must be an object');
    return;
  }
  if (typeof value.type !== 'string' || !VALID_SCHEDULE_TYPES.has(value.type as ScheduleFile['type'])) {
    c.error(
      '$.spec.schedule.type',
      `schedule.type must be one of ${[...VALID_SCHEDULE_TYPES].join(', ')}`,
    );
    return;
  }
  if (value.type === 'cron' && (typeof value.cron !== 'string' || value.cron.trim().length === 0)) {
    c.error('$.spec.schedule.cron', 'schedule.cron is required when type is "cron"');
  }
  if (value.type === 'once' && (typeof value.runAt !== 'string' || !isIsoDateTime(value.runAt))) {
    c.error('$.spec.schedule.runAt', 'schedule.runAt must be ISO-8601 when type is "once"');
  }
  if (value.timeoutMs !== undefined && !isPositiveInteger(value.timeoutMs)) {
    c.error('$.spec.schedule.timeoutMs', 'timeoutMs must be a positive integer');
  }
  if (value.maxConcurrency !== undefined && !isPositiveInteger(value.maxConcurrency)) {
    c.error('$.spec.schedule.maxConcurrency', 'maxConcurrency must be a positive integer');
  }
}

function validateSecrets(value: unknown, c: IssueCollector): void {
  if (!isPlainObject(value)) {
    c.error('$.spec.secrets', 'secrets must be an object');
    return;
  }
  const forbidden = hasForbiddenKey(value);
  if (forbidden) {
    c.error('$.spec.secrets', `forbidden key "${forbidden}" in secrets`);
    return;
  }
  const entries = Object.entries(value);
  if (entries.length > LIMITS.maxSecrets) {
    c.error('$.spec.secrets', `secrets count exceeds ${LIMITS.maxSecrets}`);
  }
  for (const [k, v] of entries) {
    if (!isSecretRef(v)) {
      c.error(
        `$.spec.secrets.${k}`,
        `secret value must be of the form \${env:VAR_NAME}; got ${JSON.stringify(v)}`,
      );
    }
  }
}

function validateTemplateSpec(value: unknown, c: IssueCollector): void {
  if (!isPlainObject(value)) {
    c.error('$.spec', 'Template spec must be an object');
    return;
  }
  if (!Array.isArray(value.fields) || value.fields.length === 0) {
    c.error('$.spec.fields', 'fields must be a non-empty array');
    return;
  }
  if (value.fields.length > LIMITS.maxFields) {
    c.error('$.spec.fields', `fields length exceeds ${LIMITS.maxFields}`);
  }
  const seenNames = new Set<string>();
  value.fields.forEach((field, i) => {
    validateField(field, `$.spec.fields[${i}]`, c, seenNames);
  });
}

function validateField(
  value: unknown,
  path: string,
  c: IssueCollector,
  seenNames: Set<string>,
): void {
  if (!isPlainObject(value)) {
    c.error(path, 'field must be an object');
    return;
  }
  if (typeof value.name !== 'string' || value.name.length === 0) {
    c.error(`${path}.name`, 'field.name must be a non-empty string');
  } else if (seenNames.has(value.name)) {
    c.error(`${path}.name`, `duplicate field name "${value.name}"`);
  } else {
    seenNames.add(value.name);
  }
  if (typeof value.selector !== 'string') {
    c.error(`${path}.selector`, 'field.selector must be a string');
  } else if (value.selector.length > LIMITS.maxSelectorLength) {
    c.error(`${path}.selector`, `selector length exceeds ${LIMITS.maxSelectorLength}`);
  }
  if (typeof value.attribute !== 'string') {
    c.error(`${path}.attribute`, 'field.attribute must be a string');
  }
  if (value.transform !== undefined && typeof value.transform !== 'string') {
    c.error(`${path}.transform`, 'field.transform must be a string when present');
  }
}

/** 解析后断言为 AnyFile；调用方应先 validateFile 通过 */
export function assertValidFile(input: unknown): AnyFile {
  const result = validateFile(input);
  if (!result.ok) {
    throw new ValidationError(result.issues);
  }
  return input as AnyFile;
}

export class ValidationError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    const summary = issues
      .filter((i) => i.severity === 'error')
      .map((i) => `${i.path}: ${i.message}`)
      .join('; ');
    super(`Validation failed: ${summary}`);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

// ───────────────────────── helpers ─────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonNegativeInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function isIsoDateTime(v: string): boolean {
  // 宽松校验：允许 YYYY-MM-DD 与完整 ISO 时间戳
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(v)) {
    return false;
  }
  const t = Date.parse(v);
  return Number.isFinite(t);
}

/** 检测 ASCII 控制字符（0x00–0x1F 除 \t/\n/\r，0x7F）与零宽字符 */
function containsControlChars(v: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029]/.test(v);
}

// 未使用的类型保留，便于后续 spec 增量校验 templateRef → TemplateFileSpec 等
export type {
  TaskFile,
  TaskFileSpec,
  TaskStepFile,
  TemplateFile,
  TemplateFileSpec,
  TemplateFieldFile,
};
