# 自动签到页面布局改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将自动签到页改成“列表主导 + Drawer 表单 + 固定结果卡”的结构，支持删除并展示上一次结果。

**Architecture:** 保留现有签到业务链路与运行状态组件，只重构签到页渲染层。列表改为 ProTable 主视图，表单通过 Drawer 打开，结果详情在列表下方固定展示，由当前选中任务驱动刷新。

**Tech Stack:** React 18、TypeScript、Ant Design、Ant Design Pro Components、Vitest、Electron IPC

---

## 文件结构

| 文件 | 责任 |
| --- | --- |
| `src/renderer/entries/signin/App.tsx` | 新签到页总布局、状态编排、Drawer/表格/结果卡联动 |
| `src/renderer/entries/automation/components/SigninTaskPanel.tsx` | 作为 Drawer 内容复用的签到表单 |
| `src/renderer/entries/automation/components/SigninRunStatusCard.tsx` | 固定结果卡，继续复用 |
| `src/renderer/shared/utils/format.ts` | 北京时间格式化 |
| `tests/unit/components/SigninApp.test.tsx` | 签到页布局与交互回归测试 |
| `tests/unit/components/SigninRunStatusCard.test.tsx` | 结果卡回归测试 |

### Task 1: 重构签到页布局

**Files:**
- Modify: `src/renderer/entries/signin/App.tsx`
- Test: `tests/unit/components/SigninApp.test.tsx`

- [ ] **Step 1: Write the failing test**

覆盖以下行为：
- 列表独占首屏，不再出现左右分栏空态
- 点击 `新建签到任务` 打开 Drawer
- 点击表格行后刷新下方固定结果卡

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/SigninApp.test.tsx`
Expected: FAIL，当前页面仍然是常驻表单/状态卡结构

- [ ] **Step 3: Write minimal implementation**

在 `App.tsx` 中：
- 引入 `Drawer`
- 用 ProTable 替代 `TaskList` 主视图
- 新建 `selectedTask` / `drawerOpen` / `selectedSummary` 状态
- 将 `SigninRunStatusCard` 固定移动到表格下方

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/SigninApp.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/entries/signin/App.tsx tests/unit/components/SigninApp.test.tsx
git commit -m "feat: redesign signin page layout"
```

### Task 2: 接入 Drawer 表单编辑流

**Files:**
- Modify: `src/renderer/entries/signin/App.tsx`
- Modify: `src/renderer/entries/automation/components/SigninTaskPanel.tsx`
- Test: `tests/unit/components/SigninApp.test.tsx`

- [ ] **Step 1: Write the failing test**

覆盖以下行为：
- 新建时打开空白/默认 Drawer 草稿
- 编辑时回填已有签到任务
- 保存后关闭 Drawer 或保持选中并刷新结果

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/SigninApp.test.tsx`
Expected: FAIL，当前无 Drawer 编辑流

- [ ] **Step 3: Write minimal implementation**

实现：
- `openCreateDrawer`
- `openEditDrawer`
- 保存后刷新列表与详情区
- 根据需要给 `SigninTaskPanel` 增加更稳定的受控初始化逻辑

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/SigninApp.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/entries/signin/App.tsx src/renderer/entries/automation/components/SigninTaskPanel.tsx tests/unit/components/SigninApp.test.tsx
git commit -m "feat: add drawer-based signin editor"
```

### Task 3: 增加删除能力与列表结果 Tag

**Files:**
- Modify: `src/renderer/entries/signin/App.tsx`
- Test: `tests/unit/components/SigninApp.test.tsx`
- Reference: `src/shared/constants/channels.ts`

- [ ] **Step 1: Write the failing test**

覆盖以下行为：
- 列表中显示 `成功` / `失败` Tag
- 点击删除后执行删除逻辑
- 删除当前选中任务后，结果卡回到空态

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/SigninApp.test.tsx`
Expected: FAIL，当前无删除入口/无结果 Tag

- [ ] **Step 3: Write minimal implementation**

实现：
- 将 `summary.status` 映射为列表内 Tag
- 接入删除按钮与二次确认
- 删除完成后重置选中态并刷新数据

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/SigninApp.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/entries/signin/App.tsx tests/unit/components/SigninApp.test.tsx
git commit -m "feat: add signin list actions and result tags"
```

### Task 4: 固定结果卡与北京时间展示回归

**Files:**
- Modify: `src/renderer/entries/automation/components/SigninRunStatusCard.tsx`
- Modify: `src/renderer/shared/utils/format.ts`
- Test: `tests/unit/components/SigninRunStatusCard.test.tsx`
- Test: `tests/unit/shared/format.test.ts`

- [ ] **Step 1: Write the failing test**

覆盖以下行为：
- 结果卡展示最近执行时间的北京时间
- 历史记录也显示北京时间
- 未选中任务时显示空态提示

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/SigninRunStatusCard.test.tsx tests/unit/shared/format.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

实现：
- 继续复用 `formatBeijingDateTime`
- 在签到页中为未选中任务提供固定空态卡

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/SigninRunStatusCard.test.tsx tests/unit/shared/format.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/entries/automation/components/SigninRunStatusCard.tsx src/renderer/shared/utils/format.ts tests/unit/components/SigninRunStatusCard.test.tsx tests/unit/shared/format.test.ts
git commit -m "fix: normalize signin result timestamps"
```

### Task 5: 全量验证

**Files:**
- Test: `tests/unit/components/SigninApp.test.tsx`
- Test: `tests/unit/components/AutomationApp.test.tsx`
- Test: `tests/unit/components/SigninRunStatusCard.test.tsx`
- Test: `tests/unit/shared/format.test.ts`

- [ ] **Step 1: Run targeted regression suite**

Run: `npx vitest run tests/unit/components/SigninApp.test.tsx tests/unit/components/AutomationApp.test.tsx tests/unit/components/SigninRunStatusCard.test.tsx tests/unit/shared/format.test.ts`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "test: verify signin layout redesign"
```
