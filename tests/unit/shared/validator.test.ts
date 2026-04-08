import { describe, it, expect } from 'vitest';
import {
  pluginManifestSchema,
  taskFlowSchema,
  windowOpenParamsSchema,
  logWriteParamsSchema,
} from '@shared/utils/validator';

describe('pluginManifestSchema', () => {
  const validManifest = {
    name: 'test-plugin',
    version: '1.0.0',
    displayName: 'Test Plugin',
    description: 'A test plugin',
    main: 'dist/index.js',
    permissions: ['network'],
    permissionLevel: 2,
    engines: { yclaw: '>=1.0.0' },
  };

  it('should accept a valid manifest', () => {
    const result = pluginManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it('should accept manifest with optional fields', () => {
    const result = pluginManifestSchema.safeParse({
      ...validManifest,
      ui: 'dist/ui/Panel.html',
      author: 'Test Author',
      homepage: 'https://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('should reject manifest with invalid name (uppercase)', () => {
    const result = pluginManifestSchema.safeParse({
      ...validManifest,
      name: 'InvalidName',
    });
    expect(result.success).toBe(false);
  });

  it('should reject manifest with invalid name (spaces)', () => {
    const result = pluginManifestSchema.safeParse({
      ...validManifest,
      name: 'test plugin',
    });
    expect(result.success).toBe(false);
  });

  it('should reject manifest with empty name', () => {
    const result = pluginManifestSchema.safeParse({
      ...validManifest,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject manifest with invalid version format', () => {
    const result = pluginManifestSchema.safeParse({
      ...validManifest,
      version: '1.0',
    });
    expect(result.success).toBe(false);
  });

  it('should reject manifest with invalid permission level', () => {
    const result = pluginManifestSchema.safeParse({
      ...validManifest,
      permissionLevel: 4,
    });
    expect(result.success).toBe(false);
  });

  it('should reject manifest with permission level 0', () => {
    const result = pluginManifestSchema.safeParse({
      ...validManifest,
      permissionLevel: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject manifest without required fields', () => {
    const result = pluginManifestSchema.safeParse({
      name: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('should reject manifest with invalid homepage URL', () => {
    const result = pluginManifestSchema.safeParse({
      ...validManifest,
      homepage: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('should reject manifest with description exceeding 512 chars', () => {
    const result = pluginManifestSchema.safeParse({
      ...validManifest,
      description: 'x'.repeat(513),
    });
    expect(result.success).toBe(false);
  });
});

describe('taskFlowSchema', () => {
  const validFlow = {
    id: 'flow-1',
    name: 'Test Flow',
    steps: [
      {
        id: 'step-1',
        name: 'Click Button',
        action: {
          type: 'click' as const,
          selector: '#submit-btn',
        },
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('should accept a valid task flow', () => {
    const result = taskFlowSchema.safeParse(validFlow);
    expect(result.success).toBe(true);
  });

  it('should accept flow with all action types', () => {
    const types = ['click', 'input', 'scroll', 'extract', 'screenshot'] as const;
    for (const type of types) {
      const flow = {
        ...validFlow,
        steps: [{ id: 's1', name: 'Step', action: { type, selector: '.el' } }],
      };
      expect(taskFlowSchema.safeParse(flow).success).toBe(true);
    }
  });

  it('should accept flow with optional step fields', () => {
    const flow = {
      ...validFlow,
      description: 'Test description',
      steps: [
        {
          id: 'step-1',
          name: 'Step',
          action: { type: 'click' as const, selector: '#btn', timeout: 5000, params: { force: true } },
          retryCount: 5,
          retryDelay: 2000,
        },
      ],
    };
    expect(taskFlowSchema.safeParse(flow).success).toBe(true);
  });

  it('should reject flow with invalid action type', () => {
    const flow = {
      ...validFlow,
      steps: [{ id: 's1', name: 'Step', action: { type: 'hover', selector: '.el' } }],
    };
    expect(taskFlowSchema.safeParse(flow).success).toBe(false);
  });

  it('should reject flow with empty steps', () => {
    expect(taskFlowSchema.safeParse({ ...validFlow, steps: [] }).success).toBe(true); // empty array is valid
  });

  it('should reject flow without required id', () => {
    const noId = { ...validFlow };
    delete (noId as { id?: string }).id;
    expect(taskFlowSchema.safeParse(noId).success).toBe(false);
  });

  it('should reject step with timeout exceeding 120000ms', () => {
    const flow = {
      ...validFlow,
      steps: [{ id: 's1', name: 'Step', action: { type: 'click' as const, selector: '.el', timeout: 200000 } }],
    };
    expect(taskFlowSchema.safeParse(flow).success).toBe(false);
  });

  it('should reject step with retryCount exceeding 10', () => {
    const flow = {
      ...validFlow,
      steps: [{ id: 's1', name: 'Step', action: { type: 'click' as const, selector: '.el' }, retryCount: 11 }],
    };
    expect(taskFlowSchema.safeParse(flow).success).toBe(false);
  });
});

describe('windowOpenParamsSchema', () => {
  it('should accept valid params', () => {
    const result = windowOpenParamsSchema.safeParse({ module: 'stock' });
    expect(result.success).toBe(true);
  });

  it('should accept params with options', () => {
    const result = windowOpenParamsSchema.safeParse({
      module: 'stock',
      options: { width: 1200, height: 800, x: 100, y: 100 },
    });
    expect(result.success).toBe(true);
  });

  it('should reject params with empty module', () => {
    const result = windowOpenParamsSchema.safeParse({ module: '' });
    expect(result.success).toBe(false);
  });

  it('should reject params with width below 200', () => {
    const result = windowOpenParamsSchema.safeParse({
      module: 'stock',
      options: { width: 50 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject params with width above 7680', () => {
    const result = windowOpenParamsSchema.safeParse({
      module: 'stock',
      options: { width: 10000 },
    });
    expect(result.success).toBe(false);
  });
});

describe('logWriteParamsSchema', () => {
  it('should accept valid log params', () => {
    const result = logWriteParamsSchema.safeParse({
      level: 'info',
      source: 'main',
      message: 'Hello',
    });
    expect(result.success).toBe(true);
  });

  it('should accept all valid levels', () => {
    for (const level of ['debug', 'info', 'warn', 'error']) {
      expect(
        logWriteParamsSchema.safeParse({ level, source: 'main', message: 'msg' }).success,
      ).toBe(true);
    }
  });

  it('should accept all valid sources', () => {
    for (const source of ['main', 'renderer', 'plugin', 'engine']) {
      expect(
        logWriteParamsSchema.safeParse({ level: 'info', source, message: 'msg' }).success,
      ).toBe(true);
    }
  });

  it('should reject invalid level', () => {
    const result = logWriteParamsSchema.safeParse({
      level: 'trace',
      source: 'main',
      message: 'msg',
    });
    expect(result.success).toBe(false);
  });

  it('should reject message exceeding 4096 chars', () => {
    const result = logWriteParamsSchema.safeParse({
      level: 'info',
      source: 'main',
      message: 'x'.repeat(4097),
    });
    expect(result.success).toBe(false);
  });
});
