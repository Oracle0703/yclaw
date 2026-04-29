# Browser Recorder Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/browser` into a focused API investigation recorder that opens a real user-operable browser window and removes unused platform workspace features.

**Architecture:** Keep the existing Electron `TabManager` and recorder IPC. Add a main-process helper that attaches the active `WebContentsView` to a visible recorder window, then simplify the renderer to URL controls plus the recorder panel.

**Tech Stack:** Electron `BrowserWindow`/`WebContentsView`, React, TypeScript, Vitest.

---

### Task 1: Visible Recorder Window

**Files:**
- Modify: `src/main/app.ts`
- Test: `tests/unit/services/AppIpcIntegration.test.ts`

- [ ] Write a failing IPC integration test proving `BROWSER_CREATE_TAB` attaches the created tab view to a visible recorder window.
- [ ] Implement a `attachToBrowserRecorderWindow(view)` helper parallel to the existing signin preview helper.
- [ ] Call the helper after `BROWSER_CREATE_TAB` and when navigating an existing active tab if needed.
- [ ] Run the targeted IPC test.

### Task 2: Focused Browser Page

**Files:**
- Modify: `src/renderer/entries/browser/App.tsx`
- Test: use existing component tests where practical; rely on typecheck for removed local-only UI sections.

- [ ] Remove unused platform workspace, KPI, queue, intervention, hot/douyin UI from the rendered `/browser` page.
- [ ] Keep only URL input/navigation controls, current tab controls, and `RecorderPanel`.
- [ ] Ensure `createTab()` returns the new `Tab` and passes tab id to `RecorderPanel`.
- [ ] Keep existing browser tab events so URL/title/loading state stays updated.

### Task 3: Recorder Behavior

**Files:**
- Modify: `src/renderer/entries/browser/components/RecorderPanel.tsx`
- Test: `tests/unit/components/RecorderPanel.test.tsx`

- [ ] Ensure "开始录制" and "开始调查录制" can create a tab when none exists.
- [ ] Ensure the no-tab helper text says the page will open in an operation window.
- [ ] Run `RecorderPanel` tests.

### Task 4: Verification

**Files:**
- No production edits.

- [ ] Run `npx vitest run tests/unit/components/RecorderPanel.test.tsx tests/unit/services/AppIpcIntegration.test.ts tests/unit/services/TabManager.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Run `git diff --check`.
