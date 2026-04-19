import { describe, expect, it, vi } from 'vitest';
import {
  assertTaskFlow,
  assertExtractionTemplate,
  createTaskAsCodeHandlers,
} from '@main/ipc/task-as-code-handlers';
import type { TaskAsCodeService } from '@shared/serialization/service';

const VALID_FLOW = {
  id: 'x', name: 'n',
  steps: [{ id: 's', name: 'c', action: { type: 'click', selector: '#a' } }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const VALID_TEMPLATE = {
  id: 't', name: 'tn',
  fields: [{ name: 'price', selector: '.p', attribute: 'text' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('main · ipc · task-as-code-handlers · payload validators', () => {
  describe('assertTaskFlow', () => {
    it('accepts a valid TaskFlow', () => {
      expect(assertTaskFlow(VALID_FLOW)).toBe(VALID_FLOW);
    });

    it.each([
      ['null', null],
      ['array', [VALID_FLOW]],
      ['string', 'task'],
      ['number', 1],
    ])('rejects non-object payload (%s)', (_label, val) => {
      expect(() => assertTaskFlow(val)).toThrow(/must be an object/);
    });

    it('rejects empty/missing id', () => {
      expect(() => assertTaskFlow({ ...VALID_FLOW, id: '' })).toThrow(/id must be a non-empty/);
      expect(() => assertTaskFlow({ ...VALID_FLOW, id: undefined })).toThrow(/id must be a non-empty/);
    });

    it('rejects non-string name', () => {
      expect(() => assertTaskFlow({ ...VALID_FLOW, name: 42 })).toThrow(/name must be a string/);
    });

    it('rejects non-array steps', () => {
      expect(() => assertTaskFlow({ ...VALID_FLOW, steps: 'bad' })).toThrow(/steps must be an array/);
      expect(() => assertTaskFlow({ ...VALID_FLOW, steps: null })).toThrow(/steps must be an array/);
    });

    it('rejects malformed step entry with index in error', () => {
      expect(() => assertTaskFlow({
        ...VALID_FLOW,
        steps: [VALID_FLOW.steps[0], { id: 'x', name: 'y', action: 'not-object' }],
      })).toThrow(/steps\[1\]/);
    });
  });

  describe('assertExtractionTemplate', () => {
    it('accepts a valid template', () => {
      expect(assertExtractionTemplate(VALID_TEMPLATE)).toBe(VALID_TEMPLATE);
    });

    it('rejects non-object', () => {
      expect(() => assertExtractionTemplate(null)).toThrow(/must be an object/);
    });

    it('rejects empty id', () => {
      expect(() => assertExtractionTemplate({ ...VALID_TEMPLATE, id: '' })).toThrow(/id must be a non-empty/);
    });

    it('rejects non-array fields', () => {
      expect(() => assertExtractionTemplate({ ...VALID_TEMPLATE, fields: {} })).toThrow(/fields must be an array/);
    });

    it('rejects malformed field entry with index', () => {
      expect(() => assertExtractionTemplate({
        ...VALID_TEMPLATE,
        fields: [{ name: 'a', selector: '.s' /* missing attribute */ }],
      })).toThrow(/fields\[0\]/);
    });
  });

  describe('exportYaml integration', () => {
    function fakeSvc() {
      return {
        exportTask: vi.fn(() => ({ yaml: 'task-yaml' })),
        exportTemplate: vi.fn(() => ({ yaml: 'tpl-yaml' })),
      } as unknown as TaskAsCodeService;
    }

    it('calls service.exportTask only after validation passes', async () => {
      const svc = fakeSvc();
      const h = createTaskAsCodeHandlers({ service: svc, emit: vi.fn() });
      await h.exportYaml({ kind: 'task', payload: VALID_FLOW });
      expect(svc.exportTask).toHaveBeenCalledWith(VALID_FLOW);
    });

    it('rejects malformed task payload before reaching service', async () => {
      const svc = fakeSvc();
      const h = createTaskAsCodeHandlers({ service: svc, emit: vi.fn() });
      await expect(h.exportYaml({ kind: 'task', payload: { id: 'x' } })).rejects.toThrow(/Invalid payload/);
      expect(svc.exportTask).not.toHaveBeenCalled();
    });

    it('rejects malformed template payload before reaching service', async () => {
      const svc = fakeSvc();
      const h = createTaskAsCodeHandlers({ service: svc, emit: vi.fn() });
      await expect(h.exportYaml({ kind: 'template', payload: { id: 't', name: 'n' } })).rejects.toThrow(/fields must be an array/);
      expect(svc.exportTemplate).not.toHaveBeenCalled();
    });
  });
});
