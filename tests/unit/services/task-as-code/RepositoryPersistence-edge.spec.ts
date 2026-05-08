import { describe, expect, it } from 'vitest';
import {
  createRepositoryPersistence,
  type TaskRepositoryLike,
  type TemplateRepositoryLike,
} from '@main/services/task-as-code/RepositoryPersistence';

const noopTask: TaskRepositoryLike = {
  saveTaskFlow: () => undefined,
  getTaskCreatedAt: () => null,
};
const noopTpl: TemplateRepositoryLike = {
  saveTemplate: (t) => t,
  getTemplateCreatedAt: () => null,
};

describe('main · services · task-as-code · adapter edge cases', () => {
  it('hooks forward null for unknown ids without throwing', () => {
    const p = createRepositoryPersistence({ taskRepository: noopTask, templateRepository: noopTpl });
    expect(p.findExistingTaskCreatedAt!('nope')).toBe(null);
    expect(p.findExistingTemplateCreatedAt!('nope')).toBe(null);
  });

  it('returned object exposes all four members shape-stably', () => {
    const p = createRepositoryPersistence({ taskRepository: noopTask, templateRepository: noopTpl });
    expect(typeof p.upsertTask).toBe('function');
    expect(typeof p.upsertTemplate).toBe('function');
    expect(typeof p.findExistingTaskCreatedAt).toBe('function');
    expect(typeof p.findExistingTemplateCreatedAt).toBe('function');
  });

  it('repo throwing inside getTaskCreatedAt propagates (service-side will swallow)', () => {
    const p = createRepositoryPersistence({
      taskRepository: { ...noopTask, getTaskCreatedAt: () => { throw new Error('boom'); } },
      templateRepository: noopTpl,
    });
    expect(() => p.findExistingTaskCreatedAt!('x')).toThrow(/boom/);
  });

  it('returned persistence is frozen against accidental override', () => {
    const p = createRepositoryPersistence({ taskRepository: noopTask, templateRepository: noopTpl });
    expect(Object.isFrozen(p)).toBe(true);
    expect(() => {
      // @ts-expect-error 故意覆盖只为测试 freeze 行为
      p.upsertTask = () => undefined;
    }).toThrow(TypeError);
  });

  it('does not call any repo method on construction (lazy)', () => {
    let calls = 0;
    const p = createRepositoryPersistence({
      taskRepository: {
        saveTaskFlow: () => { calls++; },
        getTaskCreatedAt: () => { calls++; return null; },
      },
      templateRepository: {
        saveTemplate: (t) => { calls++; return t; },
        getTemplateCreatedAt: () => { calls++; return null; },
      },
    });
    expect(calls).toBe(0);
    expect(p).toBeDefined();
  });
});
