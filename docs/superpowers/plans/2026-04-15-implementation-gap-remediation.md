# YClaw 实现缺口整改计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前“工程骨架较完整但业务闭环不足”的状态，收敛为“主链路可用、文档与实现一致、核心模块可验证”的可交付版本。

**Architecture:** 优先修复主进程装配与 IPC 缺口，复用已有 `AIService`、`PluginLoader`、`DataSourceManager`、`FlowRunner` 等实现，避免继续堆叠前端壳层。所有整改按 P0/P1/P2 分层推进，先保证可用，再补体验、性能和文档一致性。

**Tech Stack:** Electron 33、React 18、Vite 6、TypeScript 5.7、Ant Design 5、better-sqlite3、Vitest

---

## 优先级总览

| 优先级 | 目标 | 完成标准 |
| --- | --- | --- |
| P0 | 打通主进程缺失 IPC 与核心服务装配 | AI、任务、股票、插件中心不再只显示 UI 壳，至少可完成基础交互 |
| P1 | 修复结构偏差与半成品模块 | 浏览器模块不再是占位说明；插件宿主、托盘、窗口管理与文档对齐 |
| P2 | 收尾与质量提升 | 性能验证、e2e、文档状态回写、warning 清理 |

## 影响文件映射

| 区域 | 文件 |
| --- | --- |
| 主进程装配 | `src/main/app.ts` |
| IPC 与服务 | `src/main/services/DatabaseService.ts`, `src/main/services/ConfigService.ts`, `src/main/services/TrayService.ts` |
| AI | `src/main/ai/AIService.ts`, `src/main/ai/ContextManager.ts`, `src/main/ai/LLMProvider.ts` |
| 插件 | `src/main/plugin-loader/PluginLoader.ts`, `src/main/plugin-loader/PermissionChecker.ts`, `src/renderer/plugin-host/PluginBridge.ts` |
| 浏览器 | `src/main/browser/TabManager.ts`, `src/renderer/entries/browser/App.tsx`, `src/renderer/entries/browser/components/WebViewContainer.tsx` |
| 渲染端业务页 | `src/renderer/entries/stock/App.tsx`, `src/renderer/entries/automation/App.tsx`, `src/renderer/entries/plugin-center/App.tsx`, `src/renderer/shared/components/AIChatPanel/AIChatPanel.tsx` |
| 文档 | `docs/specs.md`, `docs/specs-enhancements.md`, `docs/structure.md`, `README.md` |
| 测试 | `tests/unit/services/*`, `tests/unit/components/*`, 必要时新增 `tests/unit/services/AppIpcIntegration.test.ts` |

### Task 1: 主进程装配与缺失 IPC 注册

**Files:**
- Modify: `src/main/app.ts`
- Modify: `src/shared/constants/channels.ts`
- Test: `tests/unit/services/IpcController.test.ts`
- Create: `tests/unit/services/AppIpcIntegration.test.ts`

- [ ] **Step 1: 写失败测试，锁定缺失通道**

覆盖以下最小断言：
- `ai:chat`、`plugin:list`、`task:list`、`stock:data` 在 `App.start()` 后已注册
- 缺失服务时返回统一错误格式，而不是 renderer 永久等待

- [ ] **Step 2: 运行定向测试，确认当前失败**

Run: `npx vitest run tests/unit/services/AppIpcIntegration.test.ts`

Expected:
- FAIL，提示目标通道未注册或 `App` 未挂载对应服务

- [ ] **Step 3: 在 `src/main/app.ts` 注入并装配现有服务**

接入现有实现：
- `AIService`
- `PluginLoader`
- `PermissionChecker`
- `DataSourceManager`
- 任务执行协调层（可先在 `app.ts` 内最小实现，再决定是否下沉到独立 service）

约束：
- 先复用已有类，不新增抽象层
- 不把业务逻辑继续堆进 renderer

- [ ] **Step 4: 注册 P0 通道**

至少补齐：
- `ai:chat`
- `ai:config:get`
- `ai:config:set`
- `ai:tools:list`
- `plugin:list`
- `plugin:enable`
- `plugin:disable`
- `plugin:uninstall`
- `task:list`
- `task:start`
- `task:pause`
- `task:resume`
- `task:stop`
- `stock:data`
- `stock:indicator:calc`

- [ ] **Step 5: 跑定向测试与静态检查**

Run:
- `npx vitest run tests/unit/services/AppIpcIntegration.test.ts`
- `npm run typecheck`

Expected:
- 新增集成测试通过
- 无新增类型错误

- [ ] **Step 6: 提交**

```bash
git add src/main/app.ts src/shared/constants/channels.ts tests/unit/services/IpcController.test.ts tests/unit/services/AppIpcIntegration.test.ts
git commit -m "feat: wire missing main-process ipc handlers"
```

### Task 2: AI 助手闭环

**Files:**
- Modify: `src/main/ai/AIService.ts`
- Modify: `src/main/ai/ContextManager.ts`
- Modify: `src/main/ai/LLMProvider.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/main/services/ConfigService.ts`
- Modify: `src/renderer/shared/components/AIChatPanel/AIChatPanel.tsx`
- Test: `tests/unit/services/AIService.test.ts`

- [ ] **Step 1: 写失败测试，覆盖 AI 最小闭环**

覆盖以下断言：
- `ai:chat` 能返回 assistant message
- 配置可读写
- 对话记录可列出/删除
- 会话能持久化到数据库表

- [ ] **Step 2: 扩展数据库迁移**

在 `DatabaseService` 新增：
- `ai_conversations`
- `ai_messages`

同时补最小读写方法，避免 AIService 直接拼 SQL 到处散落。

- [ ] **Step 3: 让 AI 配置进入 ConfigService**

把 provider、model、baseUrl、apiKey 等纳入配置结构。

要求：
- 默认值与当前 `AIService` 保持一致
- 不在 renderer 中保存敏感配置副本

- [ ] **Step 4: 让 ContextManager 收集真实上下文**

至少接入：
- 最近任务
- 已安装插件
- 当前模块

禁止继续返回空数组占位。

- [ ] **Step 5: 让 AIChatPanel 走常量通道并处理失败态**

替换硬编码 `'ai:chat'` 为 `IPC_CHANNELS.AI_CHAT`，并对未配置 API Key、provider 失败、网络失败做明确文案分流。

- [ ] **Step 6: 跑测试**

Run:
- `npx vitest run tests/unit/services/AIService.test.ts`
- `npm run typecheck`

- [ ] **Step 7: 提交**

```bash
git add src/main/ai src/main/services/DatabaseService.ts src/main/services/ConfigService.ts src/renderer/shared/components/AIChatPanel/AIChatPanel.tsx tests/unit/services/AIService.test.ts
git commit -m "feat: complete ai assistant service loop"
```

### Task 3: 任务与股票主链路闭环

**Files:**
- Modify: `src/main/app.ts`
- Modify: `src/main/services/DatabaseService.ts`
- Modify: `src/engines/automation/FlowRunner.ts`
- Modify: `src/engines/analytics/DataSourceManager.ts`
- Modify: `src/renderer/entries/automation/App.tsx`
- Modify: `src/renderer/entries/automation/components/TaskList.tsx`
- Modify: `src/renderer/entries/automation/components/ExecutionPanel.tsx`
- Modify: `src/renderer/entries/stock/App.tsx`
- Test: `tests/unit/engines/FlowRunner.test.ts`
- Test: `tests/unit/engines/DataSourceManager.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖以下断言：
- `task:list` 能从数据库读取任务摘要
- `task:start/pause/resume/stop` 能驱动 `FlowRunner`
- `stock:data` 至少返回规范化 OHLCV
- `stock:indicator:calc` 能返回指标数组

- [ ] **Step 2: 收敛任务服务边界**

实现一个最小任务协调层，负责：
- 从数据库读任务
- 持有运行中的 `FlowRunner`
- 向 EventBus 推送状态变化

说明：
- 可新建 `src/main/services/TaskService.ts`
- 如果新建该文件，必须配套测试

- [ ] **Step 3: 打通股票数据通道**

要求：
- `stock:data` 返回历史数据
- `stock:indicator:calc` 调用 `IndicatorLibrary`
- 明确“演示数据”与“真实接口”边界，不允许静默吞错后页面看起来正常

- [ ] **Step 4: 清理 renderer 壳层逻辑**

修正点：
- `stock/App.tsx` 中 `ignore ... for the demo dashboard` 的吞错逻辑
- `automation/App.tsx` 的状态应由 IPC/事件驱动，而不是只靠本地 state

- [ ] **Step 5: 跑测试**

Run:
- `npx vitest run tests/unit/engines/FlowRunner.test.ts tests/unit/engines/DataSourceManager.test.ts`
- `npm run typecheck`

- [ ] **Step 6: 提交**

```bash
git add src/main/app.ts src/main/services src/engines/automation/FlowRunner.ts src/engines/analytics/DataSourceManager.ts src/renderer/entries/automation src/renderer/entries/stock tests/unit/engines/FlowRunner.test.ts tests/unit/engines/DataSourceManager.test.ts
git commit -m "feat: wire task and stock module runtime flows"
```

### Task 4: 插件系统闭环

**Files:**
- Modify: `src/main/plugin-loader/PluginLoader.ts`
- Modify: `src/main/plugin-loader/PermissionChecker.ts`
- Modify: `src/main/app.ts`
- Modify: `src/renderer/entries/plugin-center/App.tsx`
- Modify: `src/renderer/entries/plugin-center/components/PluginCard.tsx`
- Create: `src/renderer/plugin-host/preload.ts`
- Test: `tests/unit/services/PermissionChecker.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖以下断言：
- 应用启动时扫描并加载插件目录
- `plugin:list` 返回注册表
- 高权限插件需要确认
- 插件卸载有确认步骤

- [ ] **Step 2: 补齐插件启动装配**

在 `App.start()` 中调用插件扫描逻辑，避免 `PluginLoader` 只存在但永远不被使用。

- [ ] **Step 3: 落实本地安装与二次确认**

最低标准：
- 插件中心要么真正调用文件选择器安装本地包
- 要么在本版本中降级文档，不再宣称支持 `.ycplugin` 选择安装

优先建议：真实实现，不要继续扩大文档偏差。

- [ ] **Step 4: 新增 `src/renderer/plugin-host/preload.ts`**

补齐 `structure.md` 已声明但仓库缺失的文件，并把受限 API 暴露逻辑从文档状态变成真实文件。

- [ ] **Step 5: 跑测试**

Run:
- `npx vitest run tests/unit/services/PermissionChecker.test.ts`
- `npm run typecheck`

- [ ] **Step 6: 提交**

```bash
git add src/main/plugin-loader src/main/app.ts src/renderer/entries/plugin-center src/renderer/plugin-host/preload.ts tests/unit/services/PermissionChecker.test.ts
git commit -m "feat: complete plugin lifecycle and host bridge"
```

### Task 5: 浏览器模块从占位壳升级为真实能力

**Files:**
- Modify: `src/main/browser/TabManager.ts`
- Modify: `src/main/app.ts`
- Modify: `src/renderer/entries/browser/App.tsx`
- Modify: `src/renderer/entries/browser/components/WebViewContainer.tsx`
- Test: `tests/unit/services/TabManager.test.ts`
- Test: `tests/unit/components/WebViewContainer.test.tsx`

- [ ] **Step 1: 写失败测试**

覆盖以下断言：
- renderer 页面不再展示“后续接入”的占位文案
- 标签页状态包含可回退/可前进
- 会话隔离策略可配置

- [ ] **Step 2: 决定实现路线并只选一种**

只能二选一：
- 方案 A：真正把 `WebContentsView` 容器接入浏览器窗口
- 方案 B：明确把当前模块降级为“浏览器会话控制台”，同步修正文档与文案

如果本轮目标是尽快可交付，优先 B；如果目标是兑现原始 SPEC，执行 A。

- [ ] **Step 3: 实现会话隔离最小闭环**

最低要求：
- 允许按配置创建 partition
- 页面能显示当前 session 信息

- [ ] **Step 4: 去掉误导性占位描述**

`browser/App.tsx` 与 `WebViewContainer.tsx` 不应再把“后续实现”直接暴露为主文案。

- [ ] **Step 5: 跑测试**

Run:
- `npx vitest run tests/unit/services/TabManager.test.ts tests/unit/components/WebViewContainer.test.tsx`
- `npm run typecheck`

- [ ] **Step 6: 提交**

```bash
git add src/main/browser src/main/app.ts src/renderer/entries/browser tests/unit/services/TabManager.test.ts tests/unit/components/WebViewContainer.test.tsx
git commit -m "feat: align browser module with runtime capabilities"
```

### Task 6: 窗口管理、托盘行为与结构对齐

**Files:**
- Modify: `src/main/windows/WindowManager.ts`
- Modify: `src/main/services/TrayService.ts`
- Modify: `src/main/services/ConfigService.ts`
- Test: `tests/unit/services/WindowManager.test.ts`
- Test: `tests/unit/services/TrayService.test.ts`

- [ ] **Step 1: 写失败测试**

覆盖以下断言：
- 同模块可创建多实例，或文档明确降级为单实例
- `closeToTray` 配置真实生效
- 关闭主窗口时不会直接违背配置行为

- [ ] **Step 2: 决定窗口模型**

只能二选一：
- 方案 A：实现 `module + instanceId` 的多窗口注册表
- 方案 B：保留单实例，并同步修改文档与 README

如果要保住 `SPEC-010` 现有验收项，必须执行 A。

- [ ] **Step 3: 把托盘行为接到配置**

当前 `ConfigService` 已有 `closeToTray` 默认值，但 `TrayService` 和窗口关闭逻辑未真正消费它。

- [ ] **Step 4: 跑测试**

Run:
- `npx vitest run tests/unit/services/WindowManager.test.ts tests/unit/services/TrayService.test.ts`
- `npm run typecheck`

- [ ] **Step 5: 提交**

```bash
git add src/main/windows/WindowManager.ts src/main/services/TrayService.ts src/main/services/ConfigService.ts tests/unit/services/WindowManager.test.ts tests/unit/services/TrayService.test.ts
git commit -m "feat: align window and tray runtime behavior"
```

### Task 7: 文档回写与质量收尾

**Files:**
- Modify: `docs/specs.md`
- Modify: `docs/specs-enhancements.md`
- Modify: `docs/structure.md`
- Modify: `README.md`
- Modify: `src/renderer/entries/stock/components/KLineChart.tsx`
- Modify: `tests/unit/components/BrowserApp.regression.test.tsx`
- Modify: `tests/unit/components/LoadingRegression.test.tsx`

- [ ] **Step 1: 回写真实状态**

把以下文档项改为真实状态：
- 已闭环
- 部分实现
- 待后续实现

不要再保留与代码不符的 `✅`。

- [ ] **Step 2: 清理 lint warning**

最低清理项：
- `KLineChart.tsx` 未使用参数
- 两个 regression test 中未使用 import

- [ ] **Step 3: 运行全量质量门禁**

Run:
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

Expected:
- lint 无 error，最好无 warning
- typecheck 通过
- test 完整返回
- build 通过

- [ ] **Step 4: 提交**

```bash
git add docs/specs.md docs/specs-enhancements.md docs/structure.md README.md src/renderer/entries/stock/components/KLineChart.tsx tests/unit/components/BrowserApp.regression.test.tsx tests/unit/components/LoadingRegression.test.tsx
git commit -m "docs: align specs with verified implementation status"
```

## 交付顺序建议

| 顺序 | 任务 | 原因 |
| --- | --- | --- |
| 1 | Task 1 | 先补主进程注册，不然后续所有 renderer 闭环都站不住 |
| 2 | Task 2 | AI 已有 UI 和服务骨架，收益高，缺口集中 |
| 3 | Task 3 | 自动化与股票模块都被 IPC 阻塞，修完能立刻提升“可用性” |
| 4 | Task 4 | 插件中心当前是运营壳，需避免继续误导 |
| 5 | Task 6 | 决定是兑现多实例还是修正文档 |
| 6 | Task 5 | 浏览器模块改动面最大，放在前面会拖慢主线 |
| 7 | Task 7 | 最后回写文档和清理 warning，避免重复返工 |

## 风险提示

| 风险 | 处理建议 |
| --- | --- |
| `npm test` 当前全量运行耗时长且未拿到完整结果 | 先按任务粒度跑定向测试，再在 Task 7 跑全量 |
| 浏览器模块真实接入 `WebContentsView` 可能牵动架构 | 若本轮目标是交付可用版本，先降级文档，再单开专项计划 |
| 插件本地安装若涉及文件对话框和打包格式 | 优先定义最小支持格式，不要一开始追求完整市场能力 |

