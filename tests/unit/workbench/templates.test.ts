import { describe, expect, it } from 'vitest';
import {
  getTaskTemplateById,
  listTaskTemplates,
} from '@renderer/entries/workbench/task-toolbench/templates';

describe('task toolbench templates', () => {
  it('exposes the three built-in Phase 0 templates', () => {
    const templates = listTaskTemplates();

    expect(templates.map((template) => template.id)).toEqual([
      'jd-signin',
      'hot-monitor',
      'comment-monitor',
    ]);
    expect(templates.find((template) => template.id === 'jd-signin')).toMatchObject({
      name: '京东签到任务',
      adapter: 'signin',
      status: 'ready',
      defaultEntryUrl: 'https://interact.jd.com/',
    });
  });

  it('exposes hot monitor as a ready template with concrete source fields', () => {
    const template = getTaskTemplateById('hot-monitor');

    expect(template?.status).toBe('ready');
    expect(template?.adapter).toBe('hot');
    expect(template?.runDisabledReason).toBeUndefined();
    expect(template?.parameterFields.map((field) => field.name)).toEqual([
      'name',
      'sourceKind',
      'siteKey',
      'entryUrl',
      'parserKey',
      'platformIds',
    ]);
  });

  it('keeps future templates visible but not runnable', () => {
    expect(getTaskTemplateById('comment-monitor')).toMatchObject({
      adapter: 'comment',
      status: 'preview',
      runDisabledReason: '后续接入运行',
    });
  });
});
