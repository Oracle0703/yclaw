import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  taskFromFile,
  taskToFile,
  templateFromFile,
  templateToFile,
  type TaskFile,
  type TemplateFile,
} from '@shared/serialization';
import type { ExtractionTemplate, TaskFlow } from '@shared/types';

const NOW = '2026-04-20T00:00:00.000Z';

describe('serialization/mapping', () => {
  describe('taskFromFile / taskToFile', () => {
    it('round-trips a full task', () => {
      const file: TaskFile = {
        schemaVersion: SCHEMA_VERSION,
        kind: 'Task',
        metadata: {
          id: 'daily-report',
          name: '每日报表',
          description: '采集每日运营数据',
          tags: ['daily'],
        },
        spec: {
          entryUrl: 'https://example.com',
          steps: [
            {
              id: 'open',
              name: '打开',
              action: { type: 'click', selector: 'body', timeout: 3000 },
              retryCount: 2,
              retryDelay: 500,
            },
          ],
          schedule: { type: 'cron', cron: '0 8 * * *', timeoutMs: 60000 },
          templateRef: 'tpl-1',
          sessionRef: 'sess-1',
          enabled: false,
        },
      };

      const flow = taskFromFile(file, { now: NOW });
      expect(flow.id).toBe('daily-report');
      expect(flow.steps[0]?.action.timeout).toBe(3000);
      expect(flow.schedule?.cron).toBe('0 8 * * *');
      expect(flow.templateId).toBe('tpl-1');
      expect(flow.sessionId).toBe('sess-1');
      expect(flow.enabled).toBe(false);
      expect(flow.tags).toEqual(['daily']);
      expect(flow.createdAt).toBe(NOW);
      expect(flow.updatedAt).toBe(NOW);

      const back = taskToFile(flow);
      expect(back.metadata.id).toBe('daily-report');
      expect(back.spec.steps[0]?.retryCount).toBe(2);
      expect(back.spec.schedule?.type).toBe('cron');
      expect(back.spec.templateRef).toBe('tpl-1');
      expect(back.spec.enabled).toBe(false);
    });

    it('preserves existingCreatedAt on import', () => {
      const file: TaskFile = {
        schemaVersion: SCHEMA_VERSION,
        kind: 'Task',
        metadata: { id: 't', name: 't' },
        spec: { steps: [] },
      };
      const flow = taskFromFile(file, {
        now: NOW,
        existingCreatedAt: '2020-01-01T00:00:00.000Z',
      });
      expect(flow.createdAt).toBe('2020-01-01T00:00:00.000Z');
      expect(flow.updatedAt).toBe(NOW);
    });

    it('does not export createdAt/updatedAt to file', () => {
      const flow: TaskFlow = {
        id: 't',
        name: 't',
        steps: [],
        createdAt: NOW,
        updatedAt: NOW,
      };
      const file = taskToFile(flow);
      expect(file).not.toHaveProperty('createdAt');
      expect(file).not.toHaveProperty('updatedAt');
      expect(file.metadata).not.toHaveProperty('createdAt');
    });

    it('omits empty optional fields when exporting', () => {
      const flow: TaskFlow = {
        id: 't',
        name: 't',
        steps: [],
        tags: [],
        createdAt: NOW,
        updatedAt: NOW,
      };
      const file = taskToFile(flow);
      expect(file.metadata.tags).toBeUndefined();
      expect(file.spec.schedule).toBeUndefined();
      expect(file.spec.templateRef).toBeUndefined();
      expect(file.spec.sessionRef).toBeUndefined();
      expect(file.spec.secrets).toBeUndefined();
    });

    it('includes secrets only when provided', () => {
      const flow: TaskFlow = { id: 't', name: 't', steps: [], createdAt: NOW, updatedAt: NOW };
      expect(taskToFile(flow).spec.secrets).toBeUndefined();
      const withSecrets = taskToFile(flow, { secrets: { user: '${env:FOO}' } });
      expect(withSecrets.spec.secrets).toEqual({ user: '${env:FOO}' });
    });
  });

  describe('templateFromFile / templateToFile', () => {
    it('round-trips a template', () => {
      const file: TemplateFile = {
        schemaVersion: SCHEMA_VERSION,
        kind: 'Template',
        metadata: { id: 'tpl-1', name: '模板' },
        spec: {
          fields: [
            { name: 'price', selector: '.price', attribute: 'text', transform: 'trim' },
          ],
        },
      };
      const tpl = templateFromFile(file, { now: NOW });
      const back = templateToFile(tpl);
      expect(back).toEqual(file);
    });

    it('does not export createdAt/updatedAt', () => {
      const tpl: ExtractionTemplate = {
        id: 't',
        name: 't',
        fields: [{ name: 'a', selector: '.a', attribute: 'text' }],
        createdAt: NOW,
        updatedAt: NOW,
      };
      const file = templateToFile(tpl);
      expect(file).not.toHaveProperty('createdAt');
    });
  });
});
