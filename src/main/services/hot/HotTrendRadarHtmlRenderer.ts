const SOURCE_NAME_MAP: Record<string, string> = {
  toutiao: '今日头条',
  baidu: '百度热搜',
  'wallstreetcn-hot': '华尔街见闻',
  thepaper: '澎湃新闻',
  'bilibili-hot-search': 'bilibili 热搜',
  'cls-hot': '财联社热门',
  ifeng: '凤凰网',
  tieba: '贴吧',
  weibo: '微博',
  douyin: '抖音',
  zhihu: '知乎',
};

export interface TrendRadarHtmlResult {
  id: string;
  data: Record<string, unknown>;
}

export interface TrendRadarHtmlInput {
  sourceName: string;
  sourceUrl: string;
  batchId: string;
  createdAt: Date;
  results: TrendRadarHtmlResult[];
  mode?: string;
  totalCount?: number;
  standaloneGroups?: HtmlGroup[];
}

interface HtmlGroup {
  name: string;
  items: TrendRadarHtmlResult[];
}

export function renderTrendRadarHtml(input: TrendRadarHtmlInput): string {
  const groups = groupResults(input.results);
  const reportMode = input.mode ?? 'current';
  const generatedAt = formatDisplayTime(input.createdAt);
  const totalCount = input.totalCount ?? input.results.length;
  const standaloneGroups = input.standaloneGroups ?? [];

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(input.sourceName)} 报告</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f3f4f6; color: #111827; }
    body.dark-mode { background: #111827; color: #f9fafb; }
    .reading-progress { position: fixed; inset: 0 0 auto 0; height: 3px; background: #4f46e5; z-index: 2; }
    .container { max-width: 980px; margin: 0 auto; padding: 24px 16px 48px; }
    body.wide-mode .container { max-width: 1320px; }
    .header { position: relative; overflow: hidden; background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 8px 28px rgba(15,23,42,.08); }
    body.dark-mode .header, body.dark-mode .word-group, body.dark-mode .search-bar, body.dark-mode .standalone-section, body.dark-mode .standalone-group { background: #1f2937; }
    .header-watermark { position: absolute; right: 24px; top: 18px; font-size: 32px; font-weight: 800; color: #e5e7eb; }
    body.dark-mode .header-watermark { color: #374151; }
    .save-buttons { position: absolute; top: 16px; right: 16px; display: flex; gap: 8px; z-index: 1; }
    .save-buttons button { border: 1px solid #d1d5db; background: #fff; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
    .header-title { font-size: 28px; font-weight: 800; margin-bottom: 18px; }
    .header-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
    .info-item { border-left: 3px solid #4f46e5; padding-left: 10px; }
    .info-label { display: block; color: #6b7280; font-size: 12px; }
    .info-value { display: block; margin-top: 4px; font-weight: 700; }
    .content { margin-top: 18px; }
    .search-bar { background: #fff; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
    .search-input { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; font-size: 14px; }
    .tab-bar { display: flex; gap: 8px; overflow-x: auto; margin: 0 0 14px; padding-bottom: 4px; }
    .tab-bar.tab-hidden { display: none; }
    .tab-btn { border: 0; background: #e5e7eb; color: #374151; border-radius: 6px; padding: 8px 12px; cursor: pointer; white-space: nowrap; }
    .tab-btn.active { background: #4f46e5; color: #fff; }
    .tab-count { margin-left: 6px; font-size: 12px; opacity: .8; }
    .word-group { background: #fff; border-radius: 8px; margin-bottom: 14px; box-shadow: 0 6px 20px rgba(15,23,42,.06); overflow: hidden; }
    .word-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e5e7eb; }
    .word-name { font-weight: 800; font-size: 18px; }
    .word-count { color: #f97316; font-size: 13px; margin-top: 4px; }
    .word-index { color: #6b7280; font-size: 12px; }
    .news-item { display: grid; grid-template-columns: 38px 1fr; gap: 10px; padding: 13px 16px; border-bottom: 1px solid #f3f4f6; }
    .news-item:last-child { border-bottom: 0; }
    .news-number { width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; background: #eef2ff; color: #4f46e5; font-weight: 800; }
    .news-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: #6b7280; margin-bottom: 5px; }
    .source-name { color: #2563eb; font-weight: 700; }
    .rank-num { border-radius: 4px; background: #f3f4f6; color: #374151; padding: 1px 6px; }
    .rank-num.high { background: #fee2e2; color: #dc2626; }
    .badge-new { border-radius: 999px; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #fff; padding: 1px 6px; font-size: 11px; }
    .news-title { line-height: 1.5; font-size: 15px; }
    .news-link { color: inherit; text-decoration: none; }
    .news-link:hover { color: #4f46e5; text-decoration: underline; }
    .empty-state { background: #fff; border-radius: 8px; padding: 24px; text-align: center; color: #6b7280; }
    .standalone-section { background: #fff; border-radius: 8px; padding: 16px; box-shadow: 0 6px 20px rgba(15,23,42,.06); margin-top: 14px; }
    .standalone-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .standalone-section-title { font-size: 18px; font-weight: 800; }
    .standalone-section-count { color: #f97316; font-size: 13px; font-weight: 700; }
    .standalone-groups-grid { display: grid; gap: 14px; }
    .standalone-group { background: #f9fafb; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .standalone-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid #e5e7eb; }
    .standalone-name { font-weight: 800; }
    .standalone-count { font-size: 12px; color: #6b7280; }
    .standalone-item { padding: 12px 14px; border-bottom: 1px solid #eef2f7; }
    .standalone-item:last-child { border-bottom: 0; }
    .standalone-meta { display: flex; flex-wrap: wrap; gap: 8px; color: #6b7280; font-size: 12px; margin-bottom: 4px; }
    .standalone-title { line-height: 1.5; }
  </style>
</head>
<body class="wide-mode">
  <div class="reading-progress"></div>
  <div class="container">
    <div class="header">
      <div class="header-watermark">TrendRadar</div>
      <div class="save-buttons">
        <button class="toggle-wide-btn" onclick="toggleWideMode()" title="切换宽屏/窄屏">⛶</button>
        <button class="toggle-dark-btn" onclick="toggleDarkMode()" title="切换暗色/亮色">☽</button>
      </div>
      <div class="header-title">热点新闻分析</div>
      <div class="header-info">
        <div class="info-item"><span class="info-label">报告类型</span><span class="info-value">${escapeHtml(reportMode)}</span></div>
        <div class="info-item"><span class="info-label">新闻总数</span><span class="info-value">${totalCount} 条</span></div>
        <div class="info-item"><span class="info-label">热点分组</span><span class="info-value">${groups.length} 组</span></div>
        <div class="info-item"><span class="info-label">生成时间</span><span class="info-value">${escapeHtml(generatedAt)}</span></div>
      </div>
    </div>
    <div class="content">
      <div class="search-bar">
        <input type="text" class="search-input" placeholder="搜索新闻标题..." oninput="handleSearch(this.value)">
      </div>
      ${groups.length > 0 ? renderGroups(groups) : '<div class="empty-state">暂无热点新闻</div>'}
      ${standaloneGroups.length > 0 ? renderStandaloneSection(standaloneGroups) : ''}
    </div>
  </div>
  <script>
    function toggleWideMode() {
      document.body.classList.toggle('wide-mode');
      initTabs();
      initStandaloneTabs();
    }
    function toggleDarkMode() {
      document.body.classList.toggle('dark-mode');
    }
    function initTabs() {
      var tabBar = document.querySelector('.tab-bar');
      if (!tabBar) return;
      var tabs = tabBar.querySelectorAll('.tab-btn');
      var groups = document.querySelectorAll('.word-group[data-tab-index]');
      function activateTab(index) {
        tabs.forEach(function(t) { t.classList.remove('active'); });
        if (index === 'all') {
          var allBtn = tabBar.querySelector('[data-tab-index="all"]');
          if (allBtn) allBtn.classList.add('active');
          groups.forEach(function(g) { g.style.display = ''; });
          try { history.replaceState(null, '', '#all'); } catch(e) {}
          return;
        }
        var idx = parseInt(index);
        tabs.forEach(function(t) {
          if (parseInt(t.dataset.tabIndex) === idx) t.classList.add('active');
        });
        groups.forEach(function(g) {
          g.style.display = (parseInt(g.dataset.tabIndex) === idx) ? '' : 'none';
        });
        try { history.replaceState(null, '', '#tab-' + idx); } catch(e) {}
      }
      tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          var idx = tab.dataset.tabIndex;
          activateTab(idx === 'all' ? 'all' : parseInt(idx));
        });
      });
      var hash = window.location.hash;
      if (hash === '#all') activateTab('all');
      else if (hash.indexOf('#tab-') === 0) activateTab(parseInt(hash.replace('#tab-', '')));
      else activateTab('all');
    }
    function handleSearch(query) {
      query = String(query || '').toLowerCase();
      document.querySelectorAll('.news-item').forEach(function(item) {
        var title = (item.querySelector('.news-title') || {}).textContent || '';
        item.style.display = (!query || title.toLowerCase().indexOf(query) !== -1) ? '' : 'none';
      });
      document.querySelectorAll('.standalone-item').forEach(function(item) {
        var title = (item.querySelector('.standalone-title') || {}).textContent || '';
        item.style.display = (!query || title.toLowerCase().indexOf(query) !== -1) ? '' : 'none';
      });
    }
    function initStandaloneTabs() {
      var tabBar = document.querySelector('.standalone-tab-bar');
      if (!tabBar) return;
      var tabs = tabBar.querySelectorAll('.tab-btn');
      var groups = document.querySelectorAll('.standalone-group[data-standalone-tab]');
      function activateStandaloneTab(index) {
        tabs.forEach(function(t) { t.classList.remove('active'); });
        if (index === 'all') {
          var allBtn = tabBar.querySelector('[data-standalone-tab="all"]');
          if (allBtn) allBtn.classList.add('active');
          groups.forEach(function(g) { g.style.display = ''; });
          return;
        }
        var idx = parseInt(index);
        tabs.forEach(function(t) {
          if (parseInt(t.dataset.standaloneTab) === idx) t.classList.add('active');
        });
        groups.forEach(function(g) {
          g.style.display = (parseInt(g.dataset.standaloneTab) === idx) ? '' : 'none';
        });
      }
      tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          var idx = tab.dataset.standaloneTab;
          activateStandaloneTab(idx === 'all' ? 'all' : parseInt(idx));
        });
      });
      activateStandaloneTab('all');
    }
    document.addEventListener('DOMContentLoaded', function() { initTabs(); initStandaloneTabs(); });
  </script>
</body>
</html>`;
}

function groupResults(results: TrendRadarHtmlResult[]): HtmlGroup[] {
  const groups = new Map<string, TrendRadarHtmlResult[]>();
  for (const result of results) {
    const groupNames = getGroupNames(result.data);
    for (const groupName of groupNames) {
      const items = groups.get(groupName) ?? [];
      items.push(result);
      groups.set(groupName, items);
    }
  }
  return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
}

function getGroupNames(data: Record<string, unknown>): string[] {
  if (Array.isArray(data.keywordGroups)) {
    const names = data.keywordGroups.map((item) => String(item).trim()).filter(Boolean);
    if (names.length > 0) {
      return names;
    }
  }
  const sourceId = typeof data.sourceId === 'string' ? data.sourceId : 'unknown';
  return [toSourceName(sourceId)];
}

function renderGroups(groups: HtmlGroup[]): string {
  const tabs = groups
    .map((group, index) =>
      `<button class="tab-btn" data-tab-index="${index}">${escapeHtml(group.name)}<span class="tab-count">${group.items.length}</span></button>`)
    .join('');
  const bodies = groups
    .map((group, index) => renderGroup(group, index, groups.length))
    .join('\n');
  return `<div class="hotlist-section"><div class="tab-bar">${tabs}<button class="tab-btn" data-tab-index="all">全部</button></div>${bodies}</div>`;
}

function renderStandaloneSection(groups: HtmlGroup[]): string {
  const totalCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  const tabs = groups
    .map((group, index) =>
      `<button class="tab-btn${index === 0 ? ' active' : ''}" data-standalone-tab="${index}">${escapeHtml(group.name)}<span class="tab-count">${group.items.length}</span></button>`)
    .join('');
  const bodies = groups
    .map((group, index) => renderStandaloneGroup(group, index))
    .join('\n');
  return `<div class="standalone-section">
    <div class="standalone-section-header">
      <div class="standalone-section-title">独立展示区</div>
      <div class="standalone-section-count">${totalCount} 条</div>
    </div>
    <div class="tab-bar standalone-tab-bar">${tabs}<button class="tab-btn" data-standalone-tab="all">全部<span class="tab-count">${totalCount}</span></button></div>
    <div class="standalone-groups-grid">${bodies}</div>
  </div>`;
}

function renderStandaloneGroup(group: HtmlGroup, index: number): string {
  const items = group.items.map(renderStandaloneItem).join('\n');
  return `<div class="standalone-group" data-standalone-tab="${index}">
    <div class="standalone-header">
      <div class="standalone-name">${escapeHtml(group.name)}</div>
      <div class="standalone-count">${group.items.length} 条</div>
    </div>
    ${items}
  </div>`;
}

function renderStandaloneItem(result: TrendRadarHtmlResult): string {
  const data = result.data;
  const title = toText(data.title) || result.id;
  const url = toText(data.url);
  const rank = toRank(data.rank, 0);
  const sourceId = toText(data.sourceId);
  const sourceName = toText(data.sourceName) || toSourceName(sourceId);
  const time = formatMaybeTime(data.updatedTime ?? data.pubDate ?? data.createdAt);
  const titleHtml = url
    ? `<a href="${escapeAttribute(url)}" target="_blank" class="news-link">${escapeHtml(title)}</a>`
    : escapeHtml(title);
  return `<div class="standalone-item">
    <div class="standalone-meta"><span>${escapeHtml(sourceName)}</span><span>${rank}</span><span>${escapeHtml(time)}</span></div>
    <div class="standalone-title">${titleHtml}</div>
  </div>`;
}

function renderGroup(group: HtmlGroup, index: number, total: number): string {
  const items = group.items.map((item, itemIndex) => renderItem(item, itemIndex)).join('\n');
  return `<div class="word-group" data-tab-index="${index}">
  <div class="word-header">
    <div class="word-info"><div class="word-name">${escapeHtml(group.name)}</div><div class="word-count warm">${group.items.length} 条</div></div>
    <div class="word-index">${index + 1}/${total}</div>
  </div>
  ${items}
</div>`;
}

function renderItem(result: TrendRadarHtmlResult, index: number): string {
  const data = result.data;
  const title = toText(data.title) || result.id;
  const url = toText(data.url);
  const rank = toRank(data.rank, index + 1);
  const sourceId = toText(data.sourceId);
  const sourceName = toText(data.sourceName) || toSourceName(sourceId);
  const time = formatMaybeTime(data.updatedTime ?? data.pubDate ?? data.createdAt);
  const highRankClass = rank <= 5 ? ' high' : '';
  const newBadge = data.isNew === true ? '<span class="badge-new">NEW</span>' : '';
  const titleHtml = url
    ? `<a href="${escapeAttribute(url)}" target="_blank" class="news-link">${escapeHtml(title)}</a>`
    : escapeHtml(title);
  return `<div class="news-item${data.isNew === true ? ' new' : ''}">
  <div class="news-number">${index + 1}</div>
  <div class="news-content">
    <div class="news-header"><span class="source-name">${escapeHtml(sourceName)}</span><span class="rank-num${highRankClass}">${rank}</span><span class="time-info">${escapeHtml(time)}</span>${newBadge}</div>
    <div class="news-title">${titleHtml}</div>
  </div>
</div>`;
}

function toText(value: unknown): string {
  return value == null ? '' : String(value);
}

function toRank(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toSourceName(sourceId: string): string {
  return SOURCE_NAME_MAP[sourceId] ?? sourceId ?? '未知来源';
}

function formatDisplayTime(date: Date): string {
  const parts = getShanghaiParts(date);
  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatSnapshotParts(date: Date): { dateFolder: string; timeFilename: string } {
  const parts = getShanghaiParts(date);
  return {
    dateFolder: `${parts.year}-${parts.month}-${parts.day}`,
    timeFilename: `${parts.hour}-${parts.minute}`,
  };
}

function formatMaybeTime(value: unknown): string {
  if (!value) {
    return '';
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return formatDisplayTime(date);
}

function getShanghaiParts(date: Date): Record<'year' | 'month' | 'day' | 'hour' | 'minute', string> {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const entries = formatter.formatToParts(date).map((part) => [part.type, part.value]);
  const parts = Object.fromEntries(entries);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
