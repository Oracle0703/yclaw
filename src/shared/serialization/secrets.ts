/**
 * Task-as-Code v1 — 敏感字段引用与脱敏
 *
 * 引用语法：`${env:VAR_NAME}`
 *
 * - 导出（toFileSecrets）：把运行时值替换成引用占位，避免明文落盘。
 * - 导入/运行时（resolveSecrets）：把引用展开为环境变量值。
 * - 校验（isSecretRef / extractEnvName）：lint 与文件解析共用。
 *
 * 设计取舍：
 * - 不在文件中保留运行时值；导出后必须依赖外部 env 注入。
 * - 仅支持 `env:` 前缀；`vault:` 等其他后端属于 v2。
 * - 变量名必须匹配 [A-Z_][A-Z0-9_]*，避免引号转义攻击。
 */

const SECRET_REF_PATTERN = /^\$\{env:([A-Z_][A-Z0-9_]*)\}$/;
const ENV_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

/** 是否是合法的 secret 引用 */
export function isSecretRef(value: unknown): value is string {
  return typeof value === 'string' && SECRET_REF_PATTERN.test(value);
}

/** 从引用中提取 env 变量名；非引用返回 null */
export function extractEnvName(value: string): string | null {
  const match = SECRET_REF_PATTERN.exec(value);
  return match ? match[1]! : null;
}

/** 构造一个 env 引用 */
export function makeEnvRef(envName: string): string {
  if (!ENV_NAME_PATTERN.test(envName)) {
    throw new Error(
      `Invalid env name "${envName}"; must match ${ENV_NAME_PATTERN.source}`,
    );
  }
  return `\${env:${envName}}`;
}

export interface ResolveSecretsOptions {
  /** env 提供者；默认 process.env。注入便于测试 */
  env?: Record<string, string | undefined>;
  /**
   * 当变量缺失时的策略：
   * - 'throw'：抛错（默认，用于运行时）
   * - 'keep'：保留原引用字符串（用于 lint 时不破坏文件结构）
   */
  onMissing?: 'throw' | 'keep';
}

/**
 * 把 secrets 对象中的引用展开为真实值。
 * 输入对象不会被修改；返回新对象。
 */
export function resolveSecrets(
  secrets: Record<string, string> | undefined,
  options: ResolveSecretsOptions = {},
): Record<string, string> {
  if (!secrets) {
    return {};
  }
  const env = options.env ?? process.env;
  const onMissing = options.onMissing ?? 'throw';
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(secrets)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error(`Forbidden secret key "${key}"`);
    }
    if (!isSecretRef(value)) {
      throw new Error(
        `Secret "${key}" must be in the form \${env:VAR_NAME}, got ${JSON.stringify(value)}`,
      );
    }
    const name = extractEnvName(value)!;
    const envValue = env[name];
    if (envValue === undefined) {
      if (onMissing === 'keep') {
        result[key] = value;
        continue;
      }
      throw new Error(
        `Environment variable "${name}" required by secret "${key}" is not defined`,
      );
    }
    result[key] = envValue;
  }

  return result;
}

/**
 * 把运行时 secret 明文转换为 env 引用占位，用于导出。
 * - envNameMapping[key] 可显式指定 env 变量名；否则按 `<KEY>_SECRET` 自动推导。
 * - 自动推导：把 key 转大写并替换非法字符；如仍非法则抛错。
 */
export function toFileSecrets(
  runtime: Record<string, string> | undefined,
  envNameMapping: Record<string, string> = {},
): Record<string, string> {
  if (!runtime) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const key of Object.keys(runtime)) {
    const explicit = envNameMapping[key];
    const envName = explicit ?? deriveEnvName(key);
    result[key] = makeEnvRef(envName);
  }
  return result;
}

function deriveEnvName(key: string): string {
  const upper = key.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const candidate = ENV_NAME_PATTERN.test(upper) ? upper : `_${upper}`;
  if (!ENV_NAME_PATTERN.test(candidate)) {
    throw new Error(`Cannot derive a valid env name from secret key "${key}"`);
  }
  return candidate;
}
