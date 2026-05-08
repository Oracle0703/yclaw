import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import type { HotFilterConfig, HotKeywordGroup } from '@shared/types';

export interface TrendRadarProfile {
  platformIds: string[];
  platformNames: Record<string, string>;
  displayMode: 'keyword' | 'platform';
  filterMethod: 'keyword' | 'ai';
  filter: HotFilterConfig | null;
  standalone: {
    platformIds: string[];
    maxItems: number;
  };
}

interface TrendRadarConfigServiceOptions {
  configDir?: string;
  exists?: (filePath: string) => boolean;
  readFile?: (filePath: string) => string;
  mkdir?: (dirPath: string) => void;
  writeFile?: (filePath: string, content: string) => void;
}

export interface TrendRadarConfigFiles {
  config: string;
  frequency: string;
  timeline: string;
}

export interface TrendRadarConfigSaveResult {
  configDir: string;
  files: string[];
}

export class TrendRadarConfigService {
  private readonly configDir: string;
  private readonly exists: (filePath: string) => boolean;
  private readonly readFile: (filePath: string) => string;
  private readonly mkdir: (dirPath: string) => void;
  private readonly writeFile: (filePath: string, content: string) => void;

  constructor(options: TrendRadarConfigServiceOptions = {}) {
    this.configDir = options.configDir
      ?? process.env.TRENDRADAR_CONFIG_DIR
      ?? path.resolve(process.cwd(), '..', 'TrendRadar', 'config');
    this.exists = options.exists ?? ((filePath) => fs.existsSync(filePath));
    this.readFile = options.readFile ?? ((filePath) => fs.readFileSync(filePath, 'utf8'));
    this.mkdir = options.mkdir ?? ((dirPath) => fs.mkdirSync(dirPath, { recursive: true }));
    this.writeFile = options.writeFile ?? ((filePath, content) =>
      fs.writeFileSync(filePath, content, 'utf8'));
  }

  loadProfile(): TrendRadarProfile | null {
    const configPath = path.join(this.configDir, 'config.yaml');
    const frequencyWordsPath = path.join(this.configDir, 'frequency_words.txt');
    if (!this.exists(configPath) || !this.exists(frequencyWordsPath)) {
      return null;
    }

    const config = YAML.parse(this.readFile(configPath)) as Record<string, unknown> | null;
    if (!config || typeof config !== 'object') {
      return null;
    }

    return {
      platformIds: readPlatformIds(config),
      platformNames: readPlatformNames(config),
      displayMode: readDisplayMode(config),
      filterMethod: readFilterMethod(config),
      filter: readFilterMethod(config) === 'keyword'
        ? parseFrequencyWords(this.readFile(frequencyWordsPath))
        : null,
      standalone: readStandaloneConfig(config),
    };
  }

  saveFiles(files: TrendRadarConfigFiles): TrendRadarConfigSaveResult {
    this.mkdir(this.configDir);

    const targets = [
      [path.join(this.configDir, 'config.yaml'), files.config],
      [path.join(this.configDir, 'frequency_words.txt'), files.frequency],
      [path.join(this.configDir, 'timeline.yaml'), files.timeline],
    ] as const;

    for (const [filePath, content] of targets) {
      this.writeFile(filePath, content);
    }

    return {
      configDir: this.configDir,
      files: targets.map(([filePath]) => filePath),
    };
  }
}

function readPlatformIds(config: Record<string, unknown>): string[] {
  const platforms = toRecord(config.platforms);
  if (platforms?.enabled === false) {
    return [];
  }
  const sources = Array.isArray(platforms?.sources) ? platforms.sources : [];
  return sources
    .map((item) => toRecord(item)?.id)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function readPlatformNames(config: Record<string, unknown>): Record<string, string> {
  const sources = Array.isArray(toRecord(config.platforms)?.sources)
    ? (toRecord(config.platforms)?.sources as unknown[])
    : [];
  return Object.fromEntries(
    sources
      .map((item) => {
        const record = toRecord(item);
        const id = typeof record?.id === 'string' ? record.id : '';
        const name = typeof record?.name === 'string' ? record.name : '';
        return id && name ? [id, name] : null;
      })
      .filter((entry): entry is [string, string] => Array.isArray(entry)),
  );
}

function readDisplayMode(config: Record<string, unknown>): 'keyword' | 'platform' {
  return toRecord(config.report)?.display_mode === 'platform' ? 'platform' : 'keyword';
}

function readFilterMethod(config: Record<string, unknown>): 'keyword' | 'ai' {
  return toRecord(config.filter)?.method === 'ai' ? 'ai' : 'keyword';
}

function readStandaloneConfig(config: Record<string, unknown>): TrendRadarProfile['standalone'] {
  const standalone = toRecord(toRecord(config.display)?.standalone);
  const platformIds = Array.isArray(standalone?.platforms)
    ? standalone.platforms
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const rawMaxItems = standalone?.max_items;
  return {
    platformIds,
    maxItems: typeof rawMaxItems === 'number' && Number.isFinite(rawMaxItems) && rawMaxItems >= 0
      ? rawMaxItems
      : 0,
  };
}

function parseFrequencyWords(content: string): HotFilterConfig {
  const excludeKeywords: string[] = [];
  const keywordGroups: HotKeywordGroup[] = [];
  let section: 'global' | 'groups' | null = null;
  let groupLines: string[] = [];

  const flushGroup = () => {
    const group = parseWordGroup(groupLines);
    if (group) {
      keywordGroups.push(group);
    }
    groupLines = [];
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '[GLOBAL_FILTER]') {
      flushGroup();
      section = 'global';
      continue;
    }
    if (line === '[WORD_GROUPS]') {
      flushGroup();
      section = 'groups';
      continue;
    }
    if (line.length === 0) {
      if (section === 'groups') {
        flushGroup();
      }
      continue;
    }
    if (line.startsWith('#')) {
      continue;
    }
    if (section === 'global') {
      excludeKeywords.push(line);
      continue;
    }
    if (section === 'groups') {
      groupLines.push(line);
    }
  }

  flushGroup();

  return {
    ...(excludeKeywords.length > 0 ? { excludeKeywords } : {}),
    ...(keywordGroups.length > 0 ? { keywordGroups } : {}),
  };
}

function parseWordGroup(lines: string[]): HotKeywordGroup | null {
  if (lines.length === 0) {
    return null;
  }

  let name = '';
  const include: string[] = [];
  const exclude: string[] = [];
  const required: string[] = [];
  let maxItems = 0;
  const displayParts: string[] = [];

  for (const line of lines) {
    const aliasMatch = line.match(/^\[(.+)]$/);
    if (aliasMatch) {
      name = aliasMatch[1]?.trim() ?? '';
      continue;
    }

    if (line.startsWith('@')) {
      const value = Number.parseInt(line.slice(1).trim(), 10);
      if (Number.isFinite(value) && value > 0) {
        maxItems = value;
      }
      continue;
    }

    if (line.startsWith('!')) {
      const value = line.slice(1).trim();
      if (value) {
        exclude.push(value);
      }
      continue;
    }

    if (line.startsWith('+')) {
      const value = line.slice(1).trim();
      if (value) {
        required.push(value);
        displayParts.push(`+${value}`);
      }
      continue;
    }

    const { matcher, label } = splitMatcherAlias(line);
    if (!matcher) {
      continue;
    }
    include.push(matcher);
    displayParts.push(label || matcher);
  }

  if (include.length === 0) {
    return null;
  }

  return {
    name: name || displayParts.join(' / '),
    include,
    ...(required.length > 0 ? { required } : {}),
    ...(exclude.length > 0 ? { exclude } : {}),
    ...(maxItems > 0 ? { maxItems } : {}),
  };
}

function splitMatcherAlias(line: string): { matcher: string; label: string } {
  const [matcherPart, labelPart] = line.split(/\s*=>\s*/, 2);
  return {
    matcher: matcherPart?.trim() ?? '',
    label: labelPart?.trim() ?? '',
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
