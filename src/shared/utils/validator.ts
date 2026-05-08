import { z } from 'zod';

/**
 * plugin.json Schema 校验
 */
export const pluginManifestSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  displayName: z.string().min(1).max(128),
  description: z.string().max(512),
  main: z.string().min(1),
  ui: z.string().optional(),
  permissions: z.array(z.string()),
  permissionLevel: z.number().int().min(1).max(3),
  engines: z.object({
    yclaw: z.string(),
  }),
  author: z.string().optional(),
  homepage: z.string().url().optional(),
});

/**
 * 任务流 Schema 校验
 */
export const taskFlowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
  steps: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      action: z.object({
        type: z.enum(['click', 'input', 'scroll', 'extract', 'screenshot']),
        selector: z.string().min(1),
        params: z.record(z.string(), z.unknown()).optional(),
        timeout: z.number().int().min(0).max(120000).optional(),
      }),
      retryCount: z.number().int().min(0).max(10).optional(),
      retryDelay: z.number().int().min(0).max(60000).optional(),
    }),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * IPC 消息 Schema 校验
 */
export const windowOpenParamsSchema = z.object({
  module: z.string().min(1),
  options: z
    .object({
      width: z.number().int().min(200).max(7680).optional(),
      height: z.number().int().min(200).max(4320).optional(),
      x: z.number().int().optional(),
      y: z.number().int().optional(),
    })
    .optional(),
});

export const logWriteParamsSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  source: z.enum(['main', 'renderer', 'plugin', 'engine']),
  message: z.string().max(4096),
  data: z.unknown().optional(),
});
