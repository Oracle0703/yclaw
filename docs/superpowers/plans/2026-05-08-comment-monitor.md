# 评论监控 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 YClaw 中新增“评论监控”菜单与小红书评论监控首期闭环。

**Architecture:** 按热点监控模式新增独立 comment 子域：shared 类型与 IPC 通道定义边界，main process 提供评论源、运行投影和报告服务，renderer 提供 `/comment-monitor` 工作台。首期采集策略复用现有 Task/Batch/Result 主线，评论结果按结构化 `ExtractionResult` payload 保存。

**Tech Stack:** Electron main process、React/Vite renderer、TypeScript、Vitest、现有 TaskService/BatchService/ResultService。

---

## File Structure

| 文件 | 操作 | 职责 |
| --- | --- | --- |
| `src/shared/types/comment.ts` | Create | 评论源、运行、评论结果、报告类型 |
| `src/shared/types/index.ts` | Modify | 导出 comment 类型 |
| `src/shared/constants/channels.ts` | Modify | 新增 `comment:*` IPC 常量 |
| `src/main/services/repositories/CommentSourceRepository.ts` | Create | 评论源持久化 |
| `src/main/services/repositories/CommentReportRepository.ts` | Create | 评论报告元数据持久化 |
| `src/main/services/repositories/index.ts` | Modify | 导出新增 repository |
| `src/main/services/comment/CommentTaskCompiler.ts` | Create | 评论源编译为任务流 |
| `src/main/services/comment/CommentSourceService.ts` | Create | 评论源 CRUD 与任务同步 |
| `src/main/services/comment/CommentRunProjectionService.ts` | Create | 评论运行列表、详情、启动 |
| `src/main/services/comment/CommentReportService.ts` | Create | 评论报告生成和预览 |
| `src/main/ipc/comment-handlers.ts` | Create | 评论 IPC handler |
| `src/main/ipc/index.ts` | Modify | 导出 comment handler |
| `src/main/app.ts` | Modify | 组合 repository、service、handler |
| `src/main/windows/WindowManager.ts` | Modify | `comment-monitor` 作为 workbench 内置模块 |
| `src/renderer/entries/comment-monitor/App.tsx` | Create | 评论监控页面 |
| `src/renderer/entries/workbench/App.tsx` | Modify | lazy route 与导航映射 |
| `src/renderer/shared/components/AdminPageLayout.tsx` | Modify | 新增“评论监控”菜单 |
| `src/renderer/shared/styles/globals.css` | Modify | 评论监控页面基础样式 |
| `tests/unit/services/comment/CommentTaskCompiler.test.ts` | Create | 任务编译单测 |
| `tests/unit/services/comment/CommentSourceService.test.ts` | Create | 源服务单测 |
| `tests/unit/services/comment/CommentReportService.test.ts` | Create | 报告服务单测 |
| `tests/unit/ipc/comment-handlers.spec.ts` | Create | IPC handler 单测 |
| `tests/unit/components/CommentMonitorApp.test.tsx` | Create | 页面基础交互测试 |
| `tests/unit/components/AdminPageLayout.test.tsx` | Modify | 菜单路由测试 |
| `tests/unit/services/WindowManager.test.ts` | Modify | workbench 内置模块测试 |

---

### Task 1: Shared Types And IPC Contract

**Files:**
- Create: `src/shared/types/comment.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/constants/channels.ts`
- Test: `tests/unit/ipc/comment-handlers.spec.ts`

- [ ] **Step 1: Write the failing IPC contract test**

Add assertions that `IPC_CHANNELS.COMMENT_SOURCE_LIST`, `COMMENT_SOURCE_CREATE`, `COMMENT_RUN_START`, and `COMMENT_REPORT_GENERATE` exist and that handler registration uses those channels.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ipc/comment-handlers.spec.ts`

Expected: FAIL because `comment-handlers.ts` and comment channels do not exist.

- [ ] **Step 3: Add shared comment types**

Define:

```ts
export type CommentPlatform = 'xhs';
export type CommentEntryKind = 'keyword' | 'note' | 'creator';
export type CommentReportFormat = 'md' | 'html';

export interface CommentCrawlLimits {
  maxContents: number;
  maxCommentsPerContent: number;
  includeSubComments: boolean;
  crawlIntervalSeconds: number;
}

export interface CommentFilterConfig {
  includeKeywords?: string[];
  excludeKeywords?: string[];
  minLikeCount?: number;
}
```

Then add `CommentSource`, `CommentSourceDraft`, `CommentItem`, `CommentRunSummary`, `CommentRunDetail`, and `CommentReportSummary`.

- [ ] **Step 4: Add IPC constants**

Add:

```ts
COMMENT_SOURCE_LIST: 'comment:source:list',
COMMENT_SOURCE_DETAIL: 'comment:source:detail',
COMMENT_SOURCE_CREATE: 'comment:source:create',
COMMENT_SOURCE_UPDATE: 'comment:source:update',
COMMENT_SOURCE_DELETE: 'comment:source:delete',
COMMENT_RUN_LIST: 'comment:run:list',
COMMENT_RUN_START: 'comment:run:start',
COMMENT_RUN_DETAIL: 'comment:run:detail',
COMMENT_REPORT_LIST: 'comment:report:list',
COMMENT_REPORT_DETAIL: 'comment:report:detail',
COMMENT_REPORT_GENERATE: 'comment:report:generate',
COMMENT_REPORT_DELETE: 'comment:report:delete',
COMMENT_REPORT_REVEAL: 'comment:report:reveal',
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/ipc/comment-handlers.spec.ts`

Expected: still FAIL until handler exists in Task 4.

---

### Task 2: Comment Task Compiler

**Files:**
- Create: `src/main/services/comment/CommentTaskCompiler.ts`
- Test: `tests/unit/services/comment/CommentTaskCompiler.test.ts`

- [ ] **Step 1: Write failing compiler tests**

Cover three source entry kinds:

| Entry | Expected first step |
| --- | --- |
| `keyword` | 打开小红书搜索页 |
| `note` | 打开指定笔记 |
| `creator` | 打开创作者主页 |

Each compiled task must include an `extract` step with `parserKey: 'xhs.comment'`, `sourceId`, `entryKind`, `limits`, and `filter`.

- [ ] **Step 2: Run compiler test**

Run: `npx vitest run tests/unit/services/comment/CommentTaskCompiler.test.ts`

Expected: FAIL because compiler does not exist.

- [ ] **Step 3: Implement compiler**

Create `CommentTaskCompiler.compile(source)` returning task payload compatible with `TaskService.createTask`.

Use conservative defaults:

```ts
const DEFAULT_LIMITS = {
  maxContents: 5,
  maxCommentsPerContent: 20,
  includeSubComments: false,
  crawlIntervalSeconds: 2,
};
```

- [ ] **Step 4: Run compiler test**

Run: `npx vitest run tests/unit/services/comment/CommentTaskCompiler.test.ts`

Expected: PASS.

---

### Task 3: Source Repository And Service

**Files:**
- Create: `src/main/services/repositories/CommentSourceRepository.ts`
- Create: `src/main/services/comment/CommentSourceService.ts`
- Modify: `src/main/services/repositories/index.ts`
- Test: `tests/unit/services/comment/CommentSourceService.test.ts`

- [ ] **Step 1: Write failing source service tests**

Cover:

| Behavior | Expected |
| --- | --- |
| create source | validates `platform: 'xhs'`, creates task, saves source |
| update source | updates underlying task flow and source metadata |
| delete source | deletes underlying task and source record |
| invalid platform | throws `Unsupported comment platform` |

- [ ] **Step 2: Run source service test**

Run: `npx vitest run tests/unit/services/comment/CommentSourceService.test.ts`

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement repository**

Mirror `HotSourceRepository` shape, backed by `comment_sources`. If the project database migration layer does not yet have a table, add table creation in the same place where `hot_sources` is created.

- [ ] **Step 4: Implement service**

Follow `HotSourceService` patterns:

```ts
createSource(draft: CommentSourceDraft): CommentSource
updateSource(sourceId: string, updates: CommentSourceDraft): CommentSource
deleteSource(sourceId: string): void
listSources(): CommentSource[]
getSource(sourceId: string): CommentSource | null
```

- [ ] **Step 5: Run source service test**

Run: `npx vitest run tests/unit/services/comment/CommentSourceService.test.ts`

Expected: PASS.

---

### Task 4: IPC Handlers

**Files:**
- Create: `src/main/ipc/comment-handlers.ts`
- Modify: `src/main/ipc/index.ts`
- Test: `tests/unit/ipc/comment-handlers.spec.ts`

- [ ] **Step 1: Complete failing IPC tests**

Cover source CRUD, run list/start/detail, report list/detail/generate/delete/reveal. Verify payload validation rejects missing `sourceId`, `batchId`, and invalid report format.

- [ ] **Step 2: Run IPC test**

Run: `npx vitest run tests/unit/ipc/comment-handlers.spec.ts`

Expected: FAIL because handler is missing or incomplete.

- [ ] **Step 3: Implement `registerCommentHandlers`**

Use the same defensive helpers as `hot-handlers.ts`: `assertObject`, `assertStringField`, and format assertion.

- [ ] **Step 4: Run IPC test**

Run: `npx vitest run tests/unit/ipc/comment-handlers.spec.ts`

Expected: PASS.

---

### Task 5: Run Projection And Report Service

**Files:**
- Create: `src/main/services/comment/CommentRunProjectionService.ts`
- Create: `src/main/services/repositories/CommentReportRepository.ts`
- Create: `src/main/services/comment/CommentReportService.ts`
- Test: `tests/unit/services/comment/CommentReportService.test.ts`

- [ ] **Step 1: Write failing report tests**

Cover Markdown generation from two comment results and HTML generation with the same data. Include the empty-result case.

- [ ] **Step 2: Run report tests**

Run: `npx vitest run tests/unit/services/comment/CommentReportService.test.ts`

Expected: FAIL because report service does not exist.

- [ ] **Step 3: Implement run projection**

Mirror `HotRunProjectionService`:

```ts
listRuns(sourceId?: string): CommentRunSummary[]
getRunDetail(sourceId: string, batchId: string): CommentRunDetail
startRun(sourceId: string): unknown
```

- [ ] **Step 4: Implement report repository and service**

Write reports under a comment-specific output directory such as `comment-reports/`. Save report metadata only after file write succeeds.

- [ ] **Step 5: Run report tests**

Run: `npx vitest run tests/unit/services/comment/CommentReportService.test.ts`

Expected: PASS.

---

### Task 6: App Composition

**Files:**
- Modify: `src/main/app.ts`
- Test: `tests/unit/services/AppComposition.test.ts`

- [ ] **Step 1: Write failing composition test**

Assert that app composition registers comment handlers and wires comment services with repositories, task service, batch service, result service, and output path.

- [ ] **Step 2: Run composition test**

Run: `npx vitest run tests/unit/services/AppComposition.test.ts`

Expected: FAIL until app wiring exists.

- [ ] **Step 3: Wire services in `App`**

Instantiate:

```ts
CommentSourceRepository
CommentReportRepository
CommentTaskCompiler
CommentSourceService
CommentRunProjectionService
CommentReportService
```

Register `registerCommentHandlers`.

- [ ] **Step 4: Run composition test**

Run: `npx vitest run tests/unit/services/AppComposition.test.ts`

Expected: PASS.

---

### Task 7: Renderer Page And API Wrapper

**Files:**
- Create: `src/renderer/entries/comment-monitor/App.tsx`
- Create or modify: renderer IPC API wrapper if the project has a central API file for feature channels
- Modify: `src/renderer/shared/styles/globals.css`
- Test: `tests/unit/components/CommentMonitorApp.test.tsx`

- [ ] **Step 1: Write failing component tests**

Mock the Electron API and cover:

| Behavior | Expected |
| --- | --- |
| initial load | calls source/run/report list channels |
| create source | sends `COMMENT_SOURCE_CREATE` with xhs defaults |
| start run | sends `COMMENT_RUN_START` |
| generate report | sends `COMMENT_REPORT_GENERATE` |

- [ ] **Step 2: Run component test**

Run: `npx vitest run tests/unit/components/CommentMonitorApp.test.tsx`

Expected: FAIL because page does not exist.

- [ ] **Step 3: Implement page**

Use a dense operational layout:

| Region | Content |
| --- | --- |
| Top toolbar | 标题、刷新、创建源 |
| Left panel | 评论源列表与创建表单 |
| Center panel | 运行列表和运行详情 |
| Right panel | 评论结果预览和报告列表 |

Do not add marketing copy or large hero UI.

- [ ] **Step 4: Add styles**

Add scoped classes under `.comment-monitor-app` and avoid broad global selectors.

- [ ] **Step 5: Run component test**

Run: `npx vitest run tests/unit/components/CommentMonitorApp.test.tsx`

Expected: PASS.

---

### Task 8: Menu, Route, And Window Navigation

**Files:**
- Modify: `src/renderer/shared/components/AdminPageLayout.tsx`
- Modify: `src/renderer/entries/workbench/App.tsx`
- Modify: `src/main/windows/WindowManager.ts`
- Test: `tests/unit/components/AdminPageLayout.test.tsx`
- Test: `tests/unit/services/WindowManager.test.ts`

- [ ] **Step 1: Write failing route tests**

Assert:

| Test | Expected |
| --- | --- |
| Admin menu | clicking “评论监控” navigates to `/comment-monitor` |
| Workbench route | module map includes `comment-monitor` |
| WindowManager | `comment-monitor` opens inside workbench |

- [ ] **Step 2: Run route tests**

Run: `npx vitest run tests/unit/components/AdminPageLayout.test.tsx tests/unit/services/WindowManager.test.ts`

Expected: FAIL until route/menu/window changes exist.

- [ ] **Step 3: Implement menu and route**

Add a menu item with a comments-related Ant Design icon. Add lazy import and route:

```tsx
const CommentMonitorPage = lazy(() => import('../comment-monitor/App'));
<Route path="/comment-monitor" element={<CommentMonitorPage />} />
```

- [ ] **Step 4: Implement WindowManager hosted module**

Add `'comment-monitor'` to `WORKBENCH_HOSTED_MODULES`.

- [ ] **Step 5: Run route tests**

Run: `npx vitest run tests/unit/components/AdminPageLayout.test.tsx tests/unit/services/WindowManager.test.ts`

Expected: PASS.

---

### Task 9: Parser Stub And Result Normalization

**Files:**
- Modify: `src/engines/automation/AutomationEngine.ts`
- Test: relevant automation engine test file, likely `tests/unit/engines/AutomationEngine.test.ts`

- [ ] **Step 1: Write failing parser test**

Provide a small HTML or structured payload representing visible comments and assert `parserKey: 'xhs.comment'` returns normalized comment records with `commentId`, `content`, `authorName`, `likeCount`, and `contentUrl`.

- [ ] **Step 2: Run parser test**

Run: `npx vitest run tests/unit/engines/AutomationEngine.test.ts`

Expected: FAIL until parser is implemented.

- [ ] **Step 3: Implement conservative parser stub**

Implement a lightweight parser that can normalize structured browser extraction payloads and simple DOM text blocks. Keep platform-specific selectors small and isolated.

- [ ] **Step 4: Run parser test**

Run: `npx vitest run tests/unit/engines/AutomationEngine.test.ts`

Expected: PASS.

---

### Task 10: Full Verification

**Files:**
- No new files unless fixing failures.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
npx vitest run tests/unit/components/CommentMonitorApp.test.tsx tests/unit/components/AdminPageLayout.test.tsx tests/unit/ipc/comment-handlers.spec.ts tests/unit/services/comment
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run existing HOT smoke tests**

Run:

```bash
npx vitest run tests/unit/ipc/hot-handlers.spec.ts tests/unit/services/hot
```

Expected: PASS or only known unrelated failures from existing dirty worktree are documented.

- [ ] **Step 4: Completion audit**

Verify:

| Requirement | Evidence |
| --- | --- |
| 新菜单“评论监控” | component test and file diff |
| `/comment-monitor` 路由 | workbench route test and file diff |
| 小红书评论源 | source service tests |
| 启动运行 | run projection tests |
| 评论结果预览 | component test |
| 评论报告 | report service tests |
| 不直接复制 MediaCrawler 源码 | diff only contains YClaw-native files |
| 类型完整 | `npm run typecheck` |
