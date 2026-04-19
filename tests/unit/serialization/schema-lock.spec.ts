/**
 * Schema 双轨锁定测试 — TAC（P3「类型双轨同步检查」）
 *
 * 目的：确保运行时 `TaskFlow` / `ExtractionTemplate` 与文件 `TaskFile` / `TemplateFile`
 * 之间的字段集合不悄无声息地漂移。
 *
 * 当任一侧新增/重命名持久字段时，本测试会失败，提醒开发者：
 *   1. 同步更新 mapping.ts 双向函数；
 *   2. 在 EXPECTED_* 常量里登记新字段；
 *   3. 评估是否需要文件 schema 演进（schemaVersion / migration）。
 */

import { describe, expect, it } from 'vitest';
import {
  taskFromFile,
  taskToFile,
  templateFromFile,
  templateToFile,
} from '@shared/serialization/mapping';
import type { TaskFile, TemplateFile } from '@shared/serialization/types';
import type { TaskFlow, ExtractionTemplate } from '@shared/types/task';

/** 持久化字段（DB 列回填到 TaskFlow 的全集，运行时附加字段如 lastRunAt 不参与文件回写）。 */
const EXPECTED_TASKFLOW_FIELDS = [
  'id', 'name', 'description', 'steps', 'entryUrl',
  'schedule', 'sessionId', 'templateId', 'enabled', 'tags',
  'createdAt', 'updatedAt',
  // 运行时 only —— 不应出现在文件里：
  'lastRunAt', 'nextRunAt',
] as const;

const EXPECTED_TASKFILE_SPEC_FIELDS = [
  'entryUrl', 'steps', 'schedule', 'templateRef', 'sessionRef', 'enabled', 'secrets',
] as const;

const EXPECTED_TEMPLATE_FIELDS = [
  'id', 'name', 'fields', 'createdAt', 'updatedAt',
] as const;

const EXPECTED_TEMPLATE_FILE_SPEC_FIELDS = ['fields'] as const;

/** 比较对象的 own keys 与期望集合；失败信息会显示「漂移」的字段。 */
function expectKeysToMatch(obj: object, expected: readonly string[], label: string): void {
  const actual = Object.keys(obj).sort();
  const want = [...expected].sort();
  if (actual.join(',') !== want.join(',')) {
    const missing = want.filter((k) => !actual.includes(k));
    const extra = actual.filter((k) => !want.includes(k));
    throw new Error(
      `[schema-lock:${label}] field set drifted.\n` +
      `  expected: ${want.join(', ')}\n` +
      `  actual:   ${actual.join(', ')}\n` +
      (missing.length ? `  missing:  ${missing.join(', ')}\n` : '') +
      (extra.length ? `  extra:    ${extra.join(', ')}\n` : ''),
    );
  }
}

describe('serialization · schema lock (TAC double-track check)', () => {
  it('TaskFlow runtime field set is locked', () => {
    const sample: Required<Omit<TaskFlow, 'description' | 'entryUrl' | 'schedule' | 'sessionId' | 'templateId' | 'enabled' | 'tags' | 'lastRunAt' | 'nextRunAt'>> & TaskFlow = {
      id: 't1', name: 'n', description: 'd', steps: [],
      entryUrl: 'https://e', schedule: { type: 'manual' },
      sessionId: 's', templateId: 'tpl', enabled: true, tags: ['x'],
      lastRunAt: null, nextRunAt: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expectKeysToMatch(sample, EXPECTED_TASKFLOW_FIELDS, 'TaskFlow');
  });

  it('TaskFile.spec field set is locked', () => {
    const sample: Required<TaskFile['spec']> = {
      entryUrl: 'https://e',
      steps: [],
      schedule: { type: 'manual' },
      templateRef: 'tpl',
      sessionRef: 's',
      enabled: true,
      secrets: {},
    };
    expectKeysToMatch(sample, EXPECTED_TASKFILE_SPEC_FIELDS, 'TaskFile.spec');
  });

  it('ExtractionTemplate runtime field set is locked', () => {
    const sample: ExtractionTemplate = {
      id: 't', name: 'n', fields: [],
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expectKeysToMatch(sample, EXPECTED_TEMPLATE_FIELDS, 'ExtractionTemplate');
  });

  it('TemplateFile.spec field set is locked', () => {
    const sample: Required<TemplateFile['spec']> = { fields: [] };
    expectKeysToMatch(sample, EXPECTED_TEMPLATE_FILE_SPEC_FIELDS, 'TemplateFile.spec');
  });

  it('Task round-trip preserves all persistable fields (file → flow → file)', () => {
    const file: TaskFile = {
      schemaVersion: 1,
      kind: 'Task',
      metadata: { id: 't1', name: 'n', description: 'd', tags: ['x', 'y'] },
      spec: {
        entryUrl: 'https://example.com',
        steps: [
          { id: 's1', name: 'click', action: { type: 'click', selector: '#a' }, retryCount: 5, retryDelay: 200 },
        ],
        schedule: { type: 'cron', cron: '0 * * * *', timeoutMs: 30000, maxConcurrency: 1 },
        templateRef: 'tpl1',
        sessionRef: 'sess1',
        enabled: false,
      },
    };
    const flow = taskFromFile(file, { now: '2026-01-01T00:00:00.000Z' });
    const round = taskToFile(flow);

    expect(round.metadata).toEqual(file.metadata);
    expect(round.spec.entryUrl).toBe(file.spec.entryUrl);
    expect(round.spec.steps).toEqual(file.spec.steps);
    expect(round.spec.schedule).toEqual(file.spec.schedule);
    expect(round.spec.templateRef).toBe(file.spec.templateRef);
    expect(round.spec.sessionRef).toBe(file.spec.sessionRef);
    expect(round.spec.enabled).toBe(false);
  });

  it('Task round-trip omits enabled when default true (clean YAML output contract)', () => {
    const file: TaskFile = {
      schemaVersion: 1, kind: 'Task',
      metadata: { id: 't1', name: 'n' },
      spec: {
        steps: [{ id: 's1', name: 'c', action: { type: 'click', selector: '#a' } }],
      },
    };
    const flow = taskFromFile(file, { now: '2026-01-01T00:00:00.000Z' });
    const round = taskToFile(flow);
    expect(round.spec.enabled).toBeUndefined();
  });

  it('Template round-trip preserves all fields', () => {
    const file: TemplateFile = {
      schemaVersion: 1, kind: 'Template',
      metadata: { id: 'tpl1', name: 'n' },
      spec: {
        fields: [
          { name: 'title', selector: 'h1', attribute: 'text' },
          { name: 'price', selector: '.p', attribute: 'data-v', transform: 'parseFloat' },
        ],
      },
    };
    const tpl = templateFromFile(file, { now: '2026-01-01T00:00:00.000Z' });
    const round = templateToFile(tpl);
    expect(round).toMatchObject({ schemaVersion: 1, kind: 'Template' });
    expect(round.metadata).toEqual(file.metadata);
    expect(round.spec.fields).toEqual(file.spec.fields);
  });

  it('runtime-only fields (lastRunAt/nextRunAt) never leak into TaskFile', () => {
    const flow: TaskFlow = {
      id: 't', name: 'n', steps: [],
      lastRunAt: '2026-01-01T01:00:00.000Z',
      nextRunAt: '2026-01-01T02:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const file = taskToFile(flow);
    const json = JSON.stringify(file);
    expect(json).not.toMatch(/lastRunAt|nextRunAt|createdAt|updatedAt/);
  });

  it('TaskStep field set is locked (id, name, action, retryCount?, retryDelay?)', () => {
    const sample = {
      id: 's', name: 'n',
      action: { type: 'click', selector: '#a' },
      retryCount: 1, retryDelay: 1,
    };
    expectKeysToMatch(sample, ['id', 'name', 'action', 'retryCount', 'retryDelay'], 'TaskStep');
  });

  it('taskFromFile always emits the full required set even with minimal input', () => {
    const minimal: TaskFile = {
      schemaVersion: 1, kind: 'Task',
      metadata: { id: 't', name: 'n' },
      spec: { steps: [] },
    };
    const flow = taskFromFile(minimal, { now: '2026-01-01T00:00:00.000Z' });
    // 文件没填的可选字段保持 undefined / null，但 key 不应缺失（除 lastRunAt/nextRunAt 这两个纯运行时字段）
    const required = ['id', 'name', 'steps', 'enabled', 'createdAt', 'updatedAt'];
    for (const k of required) {
      expect(flow).toHaveProperty(k);
    }
  });
});
