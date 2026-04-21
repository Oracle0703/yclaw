export class FingerprintBuilder {
  build(value: unknown, fieldPaths?: string[]): string {
    if (!fieldPaths?.length) {
      return stableStringify(value);
    }

    const subset = fieldPaths.reduce<Record<string, unknown>>((accumulator, fieldPath) => {
      accumulator[fieldPath] = getByPath(value, fieldPath);
      return accumulator;
    }, {});

    return stableStringify(subset);
  }
}

function getByPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
