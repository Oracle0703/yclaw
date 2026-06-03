export interface BrowserInterventionRouteContext {
  source: 'hot-monitor';
  taskId: string;
  batchId: string;
  sourceId: string;
  sourceName?: string;
  breakpoint: {
    stepIndex: number;
    error: string;
    screenshot?: string;
    domSnapshot?: string;
  } | null;
}

export function parseBrowserInterventionRouteContext(
  state: unknown,
): BrowserInterventionRouteContext | null {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const value = state as Record<string, unknown>;
  if (value.source !== 'hot-monitor') {
    return null;
  }

  if (
    typeof value.taskId !== 'string' ||
    value.taskId.length === 0 ||
    typeof value.batchId !== 'string' ||
    value.batchId.length === 0 ||
    typeof value.sourceId !== 'string' ||
    value.sourceId.length === 0
  ) {
    return null;
  }

  const context: BrowserInterventionRouteContext = {
    source: 'hot-monitor',
    taskId: value.taskId,
    batchId: value.batchId,
    sourceId: value.sourceId,
    breakpoint: parseBreakpoint(value.breakpoint),
  };

  if (typeof value.sourceName === 'string' && value.sourceName.length > 0) {
    context.sourceName = value.sourceName;
  }

  return context;
}

function parseBreakpoint(value: unknown): BrowserInterventionRouteContext['breakpoint'] {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const breakpoint = value as Record<string, unknown>;
  if (
    typeof breakpoint.stepIndex !== 'number' ||
    !Number.isInteger(breakpoint.stepIndex) ||
    breakpoint.stepIndex < 0 ||
    typeof breakpoint.error !== 'string' ||
    breakpoint.error.length === 0
  ) {
    return null;
  }

  return {
    stepIndex: breakpoint.stepIndex,
    error: breakpoint.error,
    screenshot: typeof breakpoint.screenshot === 'string' ? breakpoint.screenshot : undefined,
    domSnapshot: typeof breakpoint.domSnapshot === 'string' ? breakpoint.domSnapshot : undefined,
  };
}
