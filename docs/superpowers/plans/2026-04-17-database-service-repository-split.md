# Database Service Repository Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `DatabaseService` 的领域读写逻辑拆到独立 repository，同时保留兼容 façade，降低主服务体积与职责耦合。

**Architecture:** 保持 `DatabaseService` 只负责连接、基础 query API、事务与迁移；新增 `TaskRepository`、`PluginRepository`、`AIRepository` 承载领域 SQL；旧的 `DatabaseService` 领域方法继续保留，但内部委托到 repository，避免一次性改动所有消费者。

**Tech Stack:** TypeScript、Vitest、better-sqlite3、Electron main process

---

### Task 1: 增加 Repository 红灯测试

**Files:**
- Create: `tests/unit/services/repositories/TaskRepository.test.ts`
- Create: `tests/unit/services/repositories/PluginRepository.test.ts`
- Create: `tests/unit/services/repositories/AIRepository.test.ts`

- [ ] **Step 1: 写失败测试**
- [ ] **Step 2: 运行单测确认失败**
- [ ] **Step 3: 只覆盖任务/插件/AI 三类最小行为**
- [ ] **Step 4: 保证断言覆盖 JSON 解析、空值与删除返回值**

### Task 2: 实现 Repository

**Files:**
- Create: `src/main/services/repositories/TaskRepository.ts`
- Create: `src/main/services/repositories/PluginRepository.ts`
- Create: `src/main/services/repositories/AIRepository.ts`
- Create: `src/main/services/repositories/index.ts`

- [ ] **Step 1: 抽出共享 query 接口**
- [ ] **Step 2: 实现任务相关 SQL**
- [ ] **Step 3: 实现插件列表 SQL**
- [ ] **Step 4: 实现 AI 会话与消息 SQL**
- [ ] **Step 5: 运行 repository 单测转绿**

### Task 3: 让 DatabaseService 转发到 Repository

**Files:**
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/main/services/index.ts`

- [ ] **Step 1: 在 `DatabaseService` 内持有 repository 实例**
- [ ] **Step 2: 保留旧方法签名并转发**
- [ ] **Step 3: 不改连接/事务/迁移逻辑**
- [ ] **Step 4: 运行受影响服务测试**

### Task 4: 回归验证

**Files:**
- Modify: `tests/unit/services/TaskService.test.ts`
- Modify: `tests/unit/services/AIService.test.ts`
- Modify: `tests/unit/services/ContextManager.test.ts`

- [ ] **Step 1: 必要时补兼容断言**
- [ ] **Step 2: 运行 targeted tests**
- [ ] **Step 3: 运行 `npm run lint`**
- [ ] **Step 4: 运行 `npm run typecheck`**
- [ ] **Step 5: 运行 `npm test`**
