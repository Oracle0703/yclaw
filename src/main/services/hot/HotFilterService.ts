import type { HotFilterConfig } from '@shared/types';

type HotRecord = Record<string, unknown>;

export class HotFilterService {
  apply<T extends HotRecord>(items: T[], config: HotFilterConfig | null | undefined): Array<T & {
    keywordGroups: string[];
    isNew: boolean;
  }> {
    if (!config) {
      return items.map((item) => ({
        ...item,
        keywordGroups: [],
        isNew: !this.isSeen(item, []),
      }));
    }

    const seenUrls = config.seenUrls ?? [];
    return items
      .map((item) => {
        const keywordGroups = this.matchGroups(item, config);
        return {
          ...item,
          keywordGroups,
          isNew: !this.isSeen(item, seenUrls),
        };
      })
      .filter((item) => {
        if (this.matchesAny(item, config.excludeKeywords ?? [])) {
          return false;
        }

        const hasExplicitInclude = (config.includeKeywords?.length ?? 0) > 0;
        const hasGroups = (config.keywordGroups?.length ?? 0) > 0;
        if (!hasExplicitInclude && !hasGroups) {
          return true;
        }

        return this.matchesAny(item, config.includeKeywords ?? []) || item.keywordGroups.length > 0;
      });
  }

  private matchGroups(item: HotRecord, config: HotFilterConfig): string[] {
    return (config.keywordGroups ?? [])
      .filter((group) => {
        const includeMatched = group.include.some((keyword) => this.matchesAny(item, [keyword]));
        const requiredMatched = (group.required ?? []).every((keyword) => this.matchesAny(item, [keyword]));
        const excludeMatched = (group.exclude ?? []).some((keyword) => this.matchesAny(item, [keyword]));
        return includeMatched && requiredMatched && !excludeMatched;
      })
      .map((group) => group.name);
  }

  private matchesAny(item: HotRecord, keywords: string[]): boolean {
    if (keywords.length === 0) {
      return false;
    }
    const text = `${item.title ?? ''} ${item.summary ?? ''} ${item.url ?? ''}`;
    const textLower = text.toLowerCase();
    return keywords.some((keyword) => matchesKeyword(text, textLower, keyword));
  }

  private isSeen(item: HotRecord, seenUrls: string[]): boolean {
    const url = typeof item.url === 'string' ? item.url : '';
    return url.length > 0 && seenUrls.includes(url);
  }
}

function matchesKeyword(text: string, textLower: string, keyword: string): boolean {
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) {
    return false;
  }

  const regexMatch = trimmedKeyword.match(/^\/(.+)\/([a-z]*)$/i);
  if (regexMatch) {
    try {
      const pattern = regexMatch[1] ?? '';
      const rawFlags = regexMatch[2] ?? '';
      const flags = rawFlags.includes('i') ? rawFlags : `${rawFlags}i`;
      return new RegExp(pattern, flags).test(text);
    } catch {
      return false;
    }
  }

  return textLower.includes(trimmedKeyword.toLowerCase());
}
