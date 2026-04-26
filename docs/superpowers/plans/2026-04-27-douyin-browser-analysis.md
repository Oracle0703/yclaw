# Douyin Browser Analysis Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Douyin area inside the browser module into a three-column analysis workspace that supports seeded search results, current-video comment analysis, manual-review handoff, and an authorization-gated download flow.

**Architecture:** Keep the first implementation renderer-only. The browser page owns Douyin workspace state, seeded search results, selected-target analysis state, and download-request state; it continues to reuse existing `AI_CHAT`, `TASK_CREATE`, and `WINDOW_OPEN` IPC calls instead of inventing a new search or download backend. Extract Douyin-specific models, pure state helpers, and focused panels so `src/renderer/entries/browser/App.tsx` stops growing as one monolith.

**Tech Stack:** Electron IPC, React 18, TypeScript 5.7, Ant Design 5, Vitest, Testing Library

---

## Reference

| Item | Path |
|---|---|
| Approved design spec | `docs/superpowers/specs/2026-04-27-douyin-browser-analysis-design.md` |
| Current browser page | `src/renderer/entries/browser/App.tsx` |
| Current browser session panel | `src/renderer/entries/browser/components/WebViewContainer.tsx` |
| Browser shared types | `src/shared/types/browser.ts` |
| Current browser tests | `tests/unit/components/BrowserApp.test.tsx` |

## File Structure

| File | Responsibility |
|---|---|
| `src/renderer/entries/browser/douyin/types.ts` | Local Douyin workspace models for search, analysis, insight, download, and review state |
| `src/renderer/entries/browser/douyin/workspace.ts` | Pure helpers for seeded search results, target selection, insight generation, queue-note composition, and download state transitions |
| `src/renderer/entries/browser/components/DouyinSearchPanel.tsx` | Left column: keyword input, search trigger, result list, selected state |
| `src/renderer/entries/browser/components/DouyinTargetPanel.tsx` | Middle column: current target details, comment samples, capture state, authorization-gated download UI |
| `src/renderer/entries/browser/components/DouyinInsightPanel.tsx` | Right column: comment insight, draft helpers, review actions, queue list |
| `src/renderer/entries/browser/App.tsx` | Own browser tabs plus Douyin workspace orchestration and IPC bridge |
| `src/renderer/shared/styles/globals.css` | Three-column layout and new Douyin panel styles |
| `tests/unit/renderer/browser/douyin-workspace.spec.ts` | Pure helper tests for seeded data, insight, queue, and download state |
| `tests/unit/components/BrowserApp.test.tsx` | User-facing workspace flow tests |

## Task 1: Extract Douyin Workspace Models and Pure Helpers

**Files:**
- Create: `src/renderer/entries/browser/douyin/types.ts`
- Create: `src/renderer/entries/browser/douyin/workspace.ts`
- Test: `tests/unit/renderer/browser/douyin-workspace.spec.ts`

- [ ] **Step 1: Write failing helper tests**

Create `tests/unit/renderer/browser/douyin-workspace.spec.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildDouyinSearchResults,
  buildDouyinInsight,
  buildDouyinReviewQueueNote,
  createInitialDownloadRequest,
  confirmDownloadAuthorization,
  markDownloadStarted,
  markDownloadCompleted,
} from '@renderer/entries/browser/douyin/workspace';

describe('douyin workspace helpers', () => {
  it('builds deterministic search results from the keyword', () => {
    const results = buildDouyinSearchResults('夏季穿搭');

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      id: 'douyin-search-1',
      title: expect.stringContaining('夏季穿搭'),
      authorName: expect.any(String),
      url: expect.stringContaining('douyin.com/video/'),
    });
  });

  it('builds insight fields from current title and comment samples', () => {
    const insight = buildDouyinInsight({
      title: '夏季穿搭避坑视频',
      commentSamples: ['这条总结很实用', '想看平替推荐', '价格太高了'],
    });

    expect(insight.summary).toContain('夏季穿搭避坑视频');
    expect(insight.keywords.length).toBeGreaterThan(0);
    expect(insight.sentiment).toBe('mixed');
    expect(insight.riskFlags.length).toBeGreaterThan(0);
  });

  it('adds the current target title and url into review queue notes', () => {
    const note = buildDouyinReviewQueueNote({
      actionTitle: '评论草稿生成后人工确认再发送',
      targetTitle: '夏季穿搭避坑视频',
      targetUrl: 'https://www.douyin.com/video/1001',
      workspaceNote: '先保留品牌名，不要直接下结论',
    });

    expect(note).toContain('夏季穿搭避坑视频');
    expect(note).toContain('https://www.douyin.com/video/1001');
    expect(note).toContain('先保留品牌名');
  });

  it('advances the download state machine through confirmation and completion', () => {
    const initial = createInitialDownloadRequest('douyin-search-1');
    const authorized = confirmDownloadAuthorization(initial, true, '2026-04-27 10:00');
    const started = markDownloadStarted(authorized);
    const completed = markDownloadCompleted(started, '/downloads/douyin-1001.mp4');

    expect(initial.status).toBe('idle');
    expect(authorized).toMatchObject({
      targetId: 'douyin-search-1',
      authorized: true,
      status: 'ready',
      confirmedAt: '2026-04-27 10:00',
    });
    expect(started.status).toBe('downloading');
    expect(completed).toMatchObject({
      status: 'done',
      savedPath: '/downloads/douyin-1001.mp4',
    });
  });
});
```

- [ ] **Step 2: Run the helper test and verify RED**

Run:

```bash
npx vitest run tests/unit/renderer/browser/douyin-workspace.spec.ts
```

Expected:
- FAIL because the Douyin workspace helper module does not exist yet.

- [ ] **Step 3: Implement the local models and helpers**

Create `src/renderer/entries/browser/douyin/types.ts`:

```ts
export interface DouyinSearchItem {
  id: string;
  title: string;
  authorName: string;
  publishLabel: string;
  url: string;
  coverUrl?: string;
  metricsSummary?: string;
  keywords?: string[];
}

export interface DouyinAnalysisTarget {
  item: DouyinSearchItem;
  pageTitle?: string;
  topicTags: string[];
  commentSamples: string[];
  captureStatus: 'idle' | 'loading' | 'ready' | 'error';
}

export interface DouyinCommentInsight {
  summary: string;
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  riskFlags: string[];
}

export interface DouyinDownloadRequest {
  targetId: string;
  authorized: boolean;
  status: 'idle' | 'confirming' | 'ready' | 'downloading' | 'done' | 'error';
  confirmedAt?: string;
  savedPath?: string;
}

export interface DouyinQueueItem {
  id: string;
  title: string;
  note: string;
  status: 'pending' | 'ready' | 'archived';
}
```

Create `src/renderer/entries/browser/douyin/workspace.ts`:

```ts
import type {
  DouyinCommentInsight,
  DouyinDownloadRequest,
  DouyinSearchItem,
} from './types';

const SAMPLE_AUTHORS = ['穿搭实验室', '选品观察站', '品牌拆解员'];

export function buildDouyinSearchResults(keyword: string): DouyinSearchItem[] {
  const normalized = keyword.trim() || '抖音热点';

  return SAMPLE_AUTHORS.map((authorName, index) => ({
    id: `douyin-search-${index + 1}`,
    title: `${normalized} 第 ${index + 1} 条样本`,
    authorName,
    publishLabel: `${index + 1} 小时前`,
    url: `https://www.douyin.com/video/100${index + 1}`,
    metricsSummary: `点赞 ${3 + index}.${index}w · 评论 ${800 + index * 120}`,
    keywords: [normalized, '评论分析', '样本'],
  }));
}

export function buildDouyinInsight(input: {
  title: string;
  commentSamples: string[];
}): DouyinCommentInsight {
  const allText = [input.title, ...input.commentSamples].join(' ');
  const sentiment =
    input.commentSamples.some((item) => item.includes('太高') || item.includes('避坑'))
      ? 'mixed'
      : 'positive';

  return {
    summary: `当前视频「${input.title}」的评论讨论集中在购买判断、信息补充和实际体验。`,
    keywords: Array.from(new Set(allText.split(/[\s，。；、]/).filter(Boolean))).slice(0, 5),
    sentiment,
    riskFlags: sentiment === 'mixed' ? ['价格争议', '评论分歧，需要人工复核'] : ['需确认是否涉及营销承诺'],
  };
}

export function buildDouyinReviewQueueNote(input: {
  actionTitle: string;
  targetTitle: string;
  targetUrl: string;
  workspaceNote: string;
}): string {
  return [
    `目标视频：${input.targetTitle}`,
    `来源链接：${input.targetUrl}`,
    `动作类型：${input.actionTitle}`,
    `当前备注：${input.workspaceNote.trim() || '无'}`,
  ].join('\n');
}

export function createInitialDownloadRequest(targetId: string): DouyinDownloadRequest {
  return { targetId, authorized: false, status: 'idle' };
}

export function confirmDownloadAuthorization(
  request: DouyinDownloadRequest,
  authorized: boolean,
  confirmedAt: string,
): DouyinDownloadRequest {
  return {
    ...request,
    authorized,
    status: authorized ? 'ready' : 'confirming',
    confirmedAt: authorized ? confirmedAt : undefined,
  };
}

export function markDownloadStarted(
  request: DouyinDownloadRequest,
): DouyinDownloadRequest {
  return { ...request, status: 'downloading' };
}

export function markDownloadCompleted(
  request: DouyinDownloadRequest,
  savedPath: string,
): DouyinDownloadRequest {
  return { ...request, status: 'done', savedPath };
}
```

- [ ] **Step 4: Run the helper test and verify GREEN**

Run:

```bash
npx vitest run tests/unit/renderer/browser/douyin-workspace.spec.ts
```

Expected:
- PASS for all helper tests.

- [ ] **Step 5: Commit the helper layer**

Run:

```bash
git add src/renderer/entries/browser/douyin/types.ts src/renderer/entries/browser/douyin/workspace.ts tests/unit/renderer/browser/douyin-workspace.spec.ts
git commit -m "feat: add douyin workspace helpers"
```

## Task 2: Build the Three-Column Douyin Workspace UI

**Files:**
- Create: `src/renderer/entries/browser/components/DouyinSearchPanel.tsx`
- Create: `src/renderer/entries/browser/components/DouyinTargetPanel.tsx`
- Create: `src/renderer/entries/browser/components/DouyinInsightPanel.tsx`
- Modify: `src/renderer/entries/browser/App.tsx`
- Modify: `src/renderer/shared/styles/globals.css`
- Test: `tests/unit/components/BrowserApp.test.tsx`

- [ ] **Step 1: Add a failing browser app test for search selection**

Add to `tests/unit/components/BrowserApp.test.tsx`:

```ts
it('searches seeded Douyin results and switches the current analysis target', async () => {
  render(<BrowserApp />);

  await waitFor(() => {
    expect(screen.getByText('example.com')).toBeDefined();
  });

  fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
  fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
    target: { value: '夏季穿搭' },
  });
  fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));

  await waitFor(() => {
    expect(screen.getByText('夏季穿搭 第 1 条样本')).toBeDefined();
  });

  fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 2 条样本/ }));

  expect(screen.getByText('当前分析对象')).toBeDefined();
  expect(screen.getByText('夏季穿搭 第 2 条样本')).toBeDefined();
  expect(screen.getByText(/评论讨论集中在购买判断/)).toBeDefined();
});
```

- [ ] **Step 2: Run the browser app test and verify RED**

Run:

```bash
npx vitest run tests/unit/components/BrowserApp.test.tsx
```

Expected:
- FAIL because the Douyin search input, result list, and selected-target panel do not exist yet.

- [ ] **Step 3: Implement the three-column panels and app wiring**

Create `src/renderer/entries/browser/components/DouyinSearchPanel.tsx`:

```tsx
import { Button } from 'antd';
import type { DouyinSearchItem } from '../douyin/types';

interface DouyinSearchPanelProps {
  keyword: string;
  results: DouyinSearchItem[];
  selectedId: string | null;
  onKeywordChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (item: DouyinSearchItem) => void;
}

export function DouyinSearchPanel(props: DouyinSearchPanelProps) {
  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">搜索与样本池</div>
      <input
        className="browser-workspace-input"
        value={props.keyword}
        onChange={(event) => props.onKeywordChange(event.target.value)}
        placeholder="输入关键词或话题，先筛出要分析的视频"
      />
      <Button type="primary" onClick={props.onSearch}>搜索抖音内容</Button>
      <div className="browser-workspace-list">
        {props.results.map((item) => (
          <button
            key={item.id}
            type="button"
            className="browser-workspace-list-item"
            data-selected={props.selectedId === item.id}
            onClick={() => props.onSelect(item)}
          >
            <div className="browser-workspace-action-title">{item.title}</div>
            <div className="browser-workspace-action-meta">{item.authorName} · {item.publishLabel}</div>
            <div className="browser-workspace-action-description">{item.metricsSummary}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
```

Create `src/renderer/entries/browser/components/DouyinTargetPanel.tsx`:

```tsx
import { Button, Tag } from 'antd';
import type { DouyinAnalysisTarget, DouyinDownloadRequest } from '../douyin/types';

interface DouyinTargetPanelProps {
  target: DouyinAnalysisTarget | null;
  downloadRequest: DouyinDownloadRequest | null;
  downloadAuthorizationChecked: boolean;
  onToggleAuthorization: (checked: boolean) => void;
  onApplyDownload: () => void;
  onStartDownload: () => void;
  onMarkDownloadDone: () => void;
}

export function DouyinTargetPanel(props: DouyinTargetPanelProps) {
  if (!props.target) {
    return <section className="browser-workspace-section"><div className="browser-workspace-empty">先从左侧选择一个抖音样本。</div></section>;
  }

  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">当前分析对象</div>
      <div className="browser-workspace-action-title">{props.target.item.title}</div>
      <div className="browser-workspace-action-meta">{props.target.item.authorName}</div>
      <div className="browser-workspace-action-description">{props.target.item.url}</div>
      <Tag color={props.target.captureStatus === 'ready' ? 'success' : 'processing'}>
        {props.target.captureStatus === 'ready' ? '已采集评论样本' : '待进入页面'}
      </Tag>
      <div className="browser-workspace-list">
        {props.target.commentSamples.map((sample) => (
          <div key={sample} className="browser-workspace-guardrail">{sample}</div>
        ))}
      </div>
      <Button onClick={props.onApplyDownload}>申请授权下载</Button>
      {props.downloadRequest?.status === 'confirming' || props.downloadRequest?.status === 'ready' ? (
        <label className="browser-download-confirm">
          <input
            type="checkbox"
            checked={props.downloadAuthorizationChecked}
            onChange={(event) => props.onToggleAuthorization(event.target.checked)}
          />
          我确认这是自有内容或已授权内容
        </label>
      ) : null}
      {props.downloadRequest?.status === 'ready' ? (
        <Button type="primary" onClick={props.onStartDownload}>开始下载</Button>
      ) : null}
      {props.downloadRequest?.status === 'downloading' ? (
        <Button onClick={props.onMarkDownloadDone}>标记已完成下载归档</Button>
      ) : null}
    </section>
  );
}
```

Create `src/renderer/entries/browser/components/DouyinInsightPanel.tsx`:

```tsx
import { Button } from 'antd';
import type { DouyinCommentInsight, DouyinQueueItem } from '../douyin/types';

interface DouyinInsightPanelProps {
  insight: DouyinCommentInsight | null;
  workspaceNote: string;
  queueItems: DouyinQueueItem[];
  onNoteChange: (value: string) => void;
  onGenerateDraft: () => void;
  onQueueAction: (title: string) => void;
}

export function DouyinInsightPanel(props: DouyinInsightPanelProps) {
  return (
    <section className="browser-workspace-section">
      <div className="browser-workspace-section-title">分析与动作台</div>
      <div className="browser-workspace-summary">{props.insight?.summary ?? '先选择视频，再生成评论分析。'}</div>
      <div className="browser-workspace-list">
        {(props.insight?.keywords ?? []).map((item) => (
          <div key={item} className="browser-workspace-list-item">{item}</div>
        ))}
      </div>
      <textarea
        className="browser-workspace-notes"
        value={props.workspaceNote}
        onChange={(event) => props.onNoteChange(event.target.value)}
        placeholder="这里记录当前视频的评论草稿、判断依据和人工复核备注。"
      />
      <Button type="primary" onClick={props.onGenerateDraft}>生成评论草稿</Button>
      <Button onClick={() => props.onQueueAction('评论草稿生成后人工确认再发送')}>加入评论复核</Button>
      <Button onClick={() => props.onQueueAction('授权素材下载归档后再关闭')}>加入下载复核</Button>
      <div className="browser-workspace-list">
        {props.queueItems.map((item) => (
          <div key={item.id} className="browser-review-queue-card">
            <div className="browser-workspace-action-title">{item.title}</div>
            <div className="browser-workspace-action-meta">{item.status}</div>
            <div className="browser-workspace-action-description">{item.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

Modify `src/renderer/entries/browser/App.tsx` to add state and render the three panels:

```tsx
const [douyinKeyword, setDouyinKeyword] = useState('');
const [douyinResults, setDouyinResults] = useState<DouyinSearchItem[]>([]);
const [douyinTarget, setDouyinTarget] = useState<DouyinAnalysisTarget | null>(null);
const [douyinInsight, setDouyinInsight] = useState<DouyinCommentInsight | null>(null);
const [downloadRequest, setDownloadRequest] = useState<DouyinDownloadRequest | null>(null);
const [downloadAuthorizationChecked, setDownloadAuthorizationChecked] = useState(false);

const runDouyinSearch = () => {
  const results = buildDouyinSearchResults(douyinKeyword);
  setDouyinResults(results);
};

const selectDouyinResult = (item: DouyinSearchItem) => {
  const target: DouyinAnalysisTarget = {
    item,
    pageTitle: activeTab?.title ?? item.title,
    topicTags: item.keywords ?? [],
    commentSamples: [
      '这条总结很实用，想看更具体的搭配建议。',
      '价格看起来偏高，想知道有没有平替。',
      '适合先看评论区的真实反馈再决定。',
    ],
    captureStatus: activeTab?.url.includes('douyin.com/video/') ? 'ready' : 'loading',
  };
  setDouyinTarget(target);
  setDouyinInsight(buildDouyinInsight({ title: item.title, commentSamples: target.commentSamples }));
  setDownloadRequest(createInitialDownloadRequest(item.id));
  setDownloadAuthorizationChecked(false);
};
```

Modify `src/renderer/shared/styles/globals.css`:

```css
.browser-workspace-grid.is-douyin-analysis {
  grid-template-columns: minmax(240px, 0.95fr) minmax(280px, 1.1fr) minmax(260px, 0.95fr);
  align-items: start;
}

.browser-workspace-list-item[data-selected='true'] {
  border-color: rgba(37, 99, 235, 0.38);
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.12);
}

.browser-download-confirm {
  display: flex;
  gap: 10px;
  align-items: center;
  color: var(--yclaw-text-secondary);
  font-size: 13px;
}
```

- [ ] **Step 4: Run the browser app test and verify GREEN**

Run:

```bash
npx vitest run tests/unit/components/BrowserApp.test.tsx
```

Expected:
- PASS for the new search-selection flow and existing browser workspace regressions.

- [ ] **Step 5: Commit the three-column UI split**

Run:

```bash
git add src/renderer/entries/browser/components/DouyinSearchPanel.tsx src/renderer/entries/browser/components/DouyinTargetPanel.tsx src/renderer/entries/browser/components/DouyinInsightPanel.tsx src/renderer/entries/browser/App.tsx src/renderer/shared/styles/globals.css tests/unit/components/BrowserApp.test.tsx
git commit -m "feat: add douyin analysis workspace panels"
```

## Task 3: Bind Comment Drafts and Review Queue to the Current Video

**Files:**
- Modify: `src/renderer/entries/browser/App.tsx`
- Modify: `src/renderer/entries/browser/douyin/workspace.ts`
- Test: `tests/unit/components/BrowserApp.test.tsx`

- [ ] **Step 1: Add failing tests for video-bound drafts and review queue notes**

Add to `tests/unit/components/BrowserApp.test.tsx`:

```ts
it('generates comment drafts from the selected Douyin video context', async () => {
  invokeMock.mockImplementation(async (channel: string, payload?: unknown) => {
    if (channel === IPC_CHANNELS.BROWSER_LIST_TABS) {
      return tabs;
    }
    if (channel === IPC_CHANNELS.AI_CONFIG_GET) {
      return { provider: 'openai', apiKey: 'test-key' };
    }
    if (channel === IPC_CHANNELS.AI_CHAT) {
      expect(payload).toMatchObject({
        message: expect.stringContaining('夏季穿搭 第 1 条样本'),
        conversationId: null,
      });
      return {
        conversationId: 'douyin-analysis-conv',
        message: {
          id: 'assistant-draft',
          role: 'assistant',
          content: '第一条评论建议\n第二条评论建议\n第三条评论建议',
          timestamp: 1,
        },
      };
    }
    return null;
  });

  render(<BrowserApp />);

  await waitFor(() => expect(screen.getByText('example.com')).toBeDefined());

  fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
  fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
    target: { value: '夏季穿搭' },
  });
  fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));
  fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 1 条样本/ }));
  fireEvent.click(screen.getByRole('button', { name: '生成评论草稿' }));

  await waitFor(() => {
    expect(screen.getByDisplayValue('第一条评论建议')).toBeDefined();
  });
});

it('stores target title and url when queuing a review action', async () => {
  render(<BrowserApp />);

  await waitFor(() => expect(screen.getByText('example.com')).toBeDefined());

  fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
  fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
    target: { value: '夏季穿搭' },
  });
  fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));
  fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 1 条样本/ }));
  fireEvent.click(screen.getByRole('button', { name: '加入评论复核' }));

  expect(screen.getByText(/目标视频：夏季穿搭 第 1 条样本/)).toBeDefined();
  expect(screen.getByText(/来源链接：https:\/\/www\.douyin\.com\/video\/1001/)).toBeDefined();
});
```

- [ ] **Step 2: Run the browser app test and verify RED**

Run:

```bash
npx vitest run tests/unit/components/BrowserApp.test.tsx
```

Expected:
- FAIL because draft generation still uses generic platform note input and queue items do not carry target context.

- [ ] **Step 3: Update draft prompts and review queue composition**

Modify `src/renderer/entries/browser/douyin/workspace.ts` to add prompt composition:

```ts
export function buildDouyinDraftPrompt(input: {
  targetTitle: string;
  commentSamples: string[];
  workspaceNote: string;
  tone: '专业' | '友好' | '转化';
}): string {
  return [
    `请基于抖音视频「${input.targetTitle}」生成 3 条评论草稿。`,
    `语气：${input.tone}`,
    `评论样本：${input.commentSamples.join(' | ')}`,
    `补充备注：${input.workspaceNote.trim() || '无'}`,
    '要求：自然、克制、适合人工审核后发送。',
  ].join('\n');
}
```

Modify `src/renderer/entries/browser/App.tsx`:

```tsx
const generateDraftSuggestions = async () => {
  if (!selectedPlatform || selectedPlatform.name !== '抖音' || !douyinTarget) {
    return;
  }

  const fallbackDrafts = buildCommentDrafts(
    selectedPlatform.name,
    douyinTarget.item.title,
    draftTone,
    workspaceConfig.commentStarters,
  );

  setDraftPending(true);
  try {
    const config = await invoke<AIConfig>(IPC_CHANNELS.AI_CONFIG_GET);
    if (!hasUsableAiConfig(config)) {
      setGeneratedDrafts(fallbackDrafts);
      setWorkspaceNote(fallbackDrafts[0] ?? '');
      setDraftModeLabel('固定模板');
      return;
    }

    const response = await invoke<AIChatResponse>(IPC_CHANNELS.AI_CHAT, {
      conversationId: draftConversationId,
      message: buildDouyinDraftPrompt({
        targetTitle: douyinTarget.item.title,
        commentSamples: douyinTarget.commentSamples,
        workspaceNote,
        tone: draftTone,
      }),
    });

    const nextDrafts = extractDraftsFromAiMessage(response.message.content);
    setGeneratedDrafts(nextDrafts);
    setWorkspaceNote(nextDrafts[0] ?? '');
    setDraftModeLabel('模型回复');
    setDraftConversationId(response.conversationId);
  } finally {
    setDraftPending(false);
  }
};

const queueManualAction = (platformName: string, title: string) => {
  if (platformName === '抖音' && douyinTarget) {
    const note = buildDouyinReviewQueueNote({
      actionTitle: title,
      targetTitle: douyinTarget.item.title,
      targetUrl: douyinTarget.item.url,
      workspaceNote,
    });

    setReviewQueue((current) => [
      {
        id: `review-${Date.now()}`,
        platformName,
        title,
        status: 'pending',
        createdAtLabel: '刚刚',
        note,
      },
      ...current,
    ]);
    return;
  }

  setReviewQueue((current) => [
    {
      id: `review-${Date.now()}`,
      platformName,
      title,
      status: 'pending',
      createdAtLabel: '刚刚',
      note: workspaceNote.trim() || title,
    },
    ...current,
  ]);
};
```

- [ ] **Step 4: Run the browser app test and verify GREEN**

Run:

```bash
npx vitest run tests/unit/components/BrowserApp.test.tsx
```

Expected:
- PASS for draft generation and target-aware queue note assertions.

- [ ] **Step 5: Commit the target-bound analysis behavior**

Run:

```bash
git add src/renderer/entries/browser/App.tsx src/renderer/entries/browser/douyin/workspace.ts tests/unit/components/BrowserApp.test.tsx
git commit -m "feat: bind douyin drafts and review queue to target"
```

## Task 4: Add the Authorization-Gated Download Flow

**Files:**
- Modify: `src/renderer/entries/browser/components/DouyinTargetPanel.tsx`
- Modify: `src/renderer/entries/browser/App.tsx`
- Modify: `src/renderer/entries/browser/douyin/types.ts`
- Modify: `src/renderer/entries/browser/douyin/workspace.ts`
- Modify: `src/renderer/shared/styles/globals.css`
- Test: `tests/unit/components/BrowserApp.test.tsx`
- Test: `tests/unit/renderer/browser/douyin-workspace.spec.ts`

- [ ] **Step 1: Add failing tests for authorization gating and download record display**

Add to `tests/unit/components/BrowserApp.test.tsx`:

```ts
it('requires authorization confirmation before starting a Douyin download', async () => {
  render(<BrowserApp />);

  await waitFor(() => expect(screen.getByText('example.com')).toBeDefined());

  fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
  fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
    target: { value: '夏季穿搭' },
  });
  fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));
  fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 1 条样本/ }));
  fireEvent.click(screen.getByRole('button', { name: '申请授权下载' }));

  expect(screen.queryByRole('button', { name: '开始下载' })).toBeNull();

  fireEvent.click(screen.getByLabelText('我确认这是自有内容或已授权内容'));

  expect(screen.getByRole('button', { name: '开始下载' })).toBeDefined();
});

it('records the completed Douyin download after manual confirmation', async () => {
  render(<BrowserApp />);

  await waitFor(() => expect(screen.getByText('example.com')).toBeDefined());

  fireEvent.click(screen.getByRole('button', { name: /抖音/ }));
  fireEvent.change(screen.getByPlaceholderText('输入关键词或话题，先筛出要分析的视频'), {
    target: { value: '夏季穿搭' },
  });
  fireEvent.click(screen.getByRole('button', { name: '搜索抖音内容' }));
  fireEvent.click(screen.getByRole('button', { name: /夏季穿搭 第 1 条样本/ }));
  fireEvent.click(screen.getByRole('button', { name: '申请授权下载' }));
  fireEvent.click(screen.getByLabelText('我确认这是自有内容或已授权内容'));
  fireEvent.click(screen.getByRole('button', { name: '开始下载' }));
  fireEvent.click(screen.getByRole('button', { name: '标记已完成下载归档' }));

  expect(screen.getByText(/下载状态：已完成/)).toBeDefined();
  expect(screen.getByText(/来源链接：https:\/\/www\.douyin\.com\/video\/1001/)).toBeDefined();
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run tests/unit/renderer/browser/douyin-workspace.spec.ts tests/unit/components/BrowserApp.test.tsx
```

Expected:
- FAIL because the current target panel does not gate the download action and does not render a download record.

- [ ] **Step 3: Implement the explicit authorization and completion flow**

Modify `src/renderer/entries/browser/douyin/types.ts` to add a renderer-visible record:

```ts
export interface DouyinDownloadRecord {
  targetId: string;
  title: string;
  sourceUrl: string;
  status: 'downloading' | 'done';
  confirmedAt: string;
  savedPath?: string;
}
```

Modify `src/renderer/entries/browser/App.tsx`:

```tsx
const [downloadRecords, setDownloadRecords] = useState<DouyinDownloadRecord[]>([]);

const requestDownloadAuthorization = () => {
  if (!douyinTarget) {
    return;
  }
  setDownloadRequest({ targetId: douyinTarget.item.id, authorized: false, status: 'confirming' });
};

const handleDownloadAuthorizationToggle = (checked: boolean) => {
  setDownloadAuthorizationChecked(checked);
  setDownloadRequest((current) => {
    if (!current) {
      return current;
    }
    return confirmDownloadAuthorization(
      current,
      checked,
      new Date().toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  });
};

const startAuthorizedDownload = () => {
  if (!douyinTarget || !downloadRequest?.authorized) {
    return;
  }
  setDownloadRequest((current) => (current ? markDownloadStarted(current) : current));
  setDownloadRecords((current) => [
    {
      targetId: douyinTarget.item.id,
      title: douyinTarget.item.title,
      sourceUrl: douyinTarget.item.url,
      status: 'downloading',
      confirmedAt: downloadRequest.confirmedAt ?? '刚刚',
    },
    ...current.filter((item) => item.targetId !== douyinTarget.item.id),
  ]);
};

const completeAuthorizedDownload = () => {
  if (!douyinTarget) {
    return;
  }
  const nextPath = `/downloads/${douyinTarget.item.id}.mp4`;
  setDownloadRequest((current) => (current ? markDownloadCompleted(current, nextPath) : current));
  setDownloadRecords((current) =>
    current.map((item) =>
      item.targetId === douyinTarget.item.id
        ? { ...item, status: 'done', savedPath: nextPath }
        : item,
    ),
  );
};
```

Modify `src/renderer/entries/browser/components/DouyinTargetPanel.tsx` to render the label and record:

```tsx
{(props.downloadRequest?.status === 'confirming' || props.downloadRequest?.status === 'ready') ? (
  <label className="browser-download-confirm">
    <input
      aria-label="我确认这是自有内容或已授权内容"
      type="checkbox"
      checked={props.downloadAuthorizationChecked}
      onChange={(event) => props.onToggleAuthorization(event.target.checked)}
    />
    我确认这是自有内容或已授权内容
  </label>
) : null}

{props.downloadRecord ? (
  <div className="browser-download-record">
    <div className="browser-workspace-action-title">下载状态：{props.downloadRecord.status === 'done' ? '已完成' : '下载中'}</div>
    <div className="browser-workspace-action-meta">来源链接：{props.downloadRecord.sourceUrl}</div>
    <div className="browser-workspace-action-meta">确认时间：{props.downloadRecord.confirmedAt}</div>
  </div>
) : null}
```

Modify `src/renderer/shared/styles/globals.css`:

```css
.browser-download-record {
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.92);
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/unit/renderer/browser/douyin-workspace.spec.ts tests/unit/components/BrowserApp.test.tsx
```

Expected:
- PASS for helper state transitions, authorization gating, and download record rendering.

- [ ] **Step 5: Commit the download flow**

Run:

```bash
git add src/renderer/entries/browser/components/DouyinTargetPanel.tsx src/renderer/entries/browser/App.tsx src/renderer/entries/browser/douyin/types.ts src/renderer/entries/browser/douyin/workspace.ts src/renderer/shared/styles/globals.css tests/unit/components/BrowserApp.test.tsx tests/unit/renderer/browser/douyin-workspace.spec.ts
git commit -m "feat: add douyin authorized download flow"
```

## Task 5: Final Browser Regression Sweep

**Files:**
- Modify: `tests/unit/components/BrowserApp.test.tsx` (only if cleanup is needed)

- [ ] **Step 1: Run the full browser-related unit suite**

Run:

```bash
npx vitest run tests/unit/components/BrowserApp.test.tsx tests/unit/components/WebViewContainer.test.tsx tests/unit/components/TabBar.test.tsx tests/unit/components/AddressBar.test.tsx tests/unit/components/RecorderPanel.test.tsx
```

Expected:
- PASS for the browser app and adjacent browser component tests.

- [ ] **Step 2: Run the helper suite again for isolation**

Run:

```bash
npx vitest run tests/unit/renderer/browser/douyin-workspace.spec.ts
```

Expected:
- PASS and no flaky state assumptions.

- [ ] **Step 3: Verify that the inline Douyin monolith is gone and the split entry points are the only active path**

Run:

```bash
rg -n "DouyinSearchPanel|DouyinTargetPanel|DouyinInsightPanel|buildDouyinSearchResults|buildDouyinDraftPrompt" src/renderer/entries/browser/App.tsx src/renderer/entries/browser/components src/renderer/entries/browser/douyin
```

Expected:
- The split panels and helper functions are referenced from `App.tsx`.
- No duplicate inline Douyin-specific JSX block remains in `App.tsx` after extraction.

- [ ] **Step 4: Re-run the browser unit suite after cleanup**

Run:

```bash
npx vitest run tests/unit/components/BrowserApp.test.tsx tests/unit/components/WebViewContainer.test.tsx tests/unit/components/TabBar.test.tsx tests/unit/components/AddressBar.test.tsx tests/unit/components/RecorderPanel.test.tsx tests/unit/renderer/browser/douyin-workspace.spec.ts
```

Expected:
- PASS after cleanup with no regressions.

- [ ] **Step 5: Commit the verified browser-analysis increment**

Run:

```bash
git add src/renderer/entries/browser/App.tsx src/renderer/entries/browser/components/DouyinSearchPanel.tsx src/renderer/entries/browser/components/DouyinTargetPanel.tsx src/renderer/entries/browser/components/DouyinInsightPanel.tsx src/renderer/entries/browser/douyin/types.ts src/renderer/entries/browser/douyin/workspace.ts src/renderer/shared/styles/globals.css tests/unit/components/BrowserApp.test.tsx tests/unit/renderer/browser/douyin-workspace.spec.ts
git commit -m "feat: complete douyin browser analysis workspace"
```
