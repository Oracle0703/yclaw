/**
 * 共享的文件系统遍历与 YAML 收集逻辑（CLI lint / import / export 公用）。
 */

import { promises as fs } from 'node:fs';
import { extname, join } from 'node:path';

const SUPPORTED_YAML_EXT: ReadonlySet<string> = new Set(['.yaml', '.yml']);

export interface CollectOptions {
  /** 递归目录最大深度，默认 32。 */
  maxDirDepth?: number;
}

export function isYamlFile(name: string): boolean {
  return SUPPORTED_YAML_EXT.has(extname(name).toLowerCase());
}

/**
 * 收集 YAML 文件。
 * - 文件输入：必须是非符号链接、扩展名为 .yaml/.yml。
 * - 目录输入：递归扫描，跳过 dotfile / `node_modules` / 符号链接。
 * - 入口若是符号链接则抛错（防止指向 /dev/* 等）。
 * - 超出深度上限抛错。
 */
export async function collectYamlFiles(
  inputs: string[],
  options: CollectOptions = {},
): Promise<string[]> {
  const maxDepth = options.maxDirDepth ?? 32;
  const out: string[] = [];
  for (const input of inputs) {
    const stat = await fs.lstat(input);
    if (stat.isSymbolicLink()) {
      throw new Error(`refusing to follow symlink input: ${input}`);
    }
    if (stat.isFile()) {
      if (isYamlFile(input)) out.push(input);
      continue;
    }
    if (stat.isDirectory()) {
      await walk(input, out, 0, maxDepth);
    }
  }
  return Array.from(new Set(out)).sort();
}

async function walk(dir: string, out: string[], depth: number, maxDepth: number): Promise<void> {
  if (depth > maxDepth) {
    throw new Error(`directory depth exceeds ${maxDepth}: ${dir}`);
  }
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out, depth + 1, maxDepth);
    else if (entry.isFile() && isYamlFile(entry.name)) out.push(full);
  }
}
