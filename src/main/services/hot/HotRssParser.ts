type HotRssRecord = {
  itemId: string | null;
  title: string;
  url: string | null;
  mobileUrl: string | null;
  rank: number;
  sourceId: string;
  sourceName: string | null;
  updatedTime: string | null;
  heat: string | null;
  summary: string | null;
};

export class HotRssParser {
  parse(xml: string, feedUrl: string): HotRssRecord[] {
    const channel = readBlocks(xml, 'channel')[0] ?? xml;
    const sourceName = readFirstTag(channel, 'title');
    const entries = readBlocks(xml, 'item');
    const atomEntries = entries.length > 0 ? entries : readBlocks(xml, 'entry');

    return atomEntries.map((block, index) => {
      const url = readFirstTag(block, 'link') ?? readAtomLink(block);
      return {
        itemId: readFirstTag(block, 'guid') ?? readFirstTag(block, 'id') ?? url,
        title: readFirstTag(block, 'title') ?? '',
        url,
        mobileUrl: null,
        rank: index + 1,
        sourceId: resolveSourceId(feedUrl),
        sourceName,
        updatedTime: formatDate(readFirstTag(block, 'pubDate') ?? readFirstTag(block, 'updated')),
        heat: null,
        summary:
          readFirstTag(block, 'description') ??
          readFirstTag(block, 'summary') ??
          readFirstTag(block, 'content'),
      };
    });
  }
}

function readBlocks(xml: string, tag: string): string[] {
  return Array.from(xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))).map(
    (match) => match[1] ?? '',
  );
}

function readFirstTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  return match?.[1] ? cleanXmlText(match[1]) : null;
}

function readAtomLink(xml: string): string | null {
  const match = /<link\b[^>]*href=["']([^"']+)["'][^>]*>/i.exec(xml);
  return match?.[1] ? decodeXml(match[1]) : null;
}

function cleanXmlText(value: string): string {
  return decodeXml(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .trim(),
  );
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function resolveSourceId(feedUrl: string): string {
  try {
    const url = new URL(feedUrl);
    const host = url.host || 'feed';
    return `rss:${host}`;
  } catch {
    return 'rss';
  }
}

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
