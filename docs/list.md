# Review 修复清单

> 基于 `42e5d41..ca53a0e` 代码审查结果，按严重级别排列。
> 修复分支: `fix/code-review-remediation`（基于 `ca53a0e`）

---

## Critical

### C-1 · AIChatPanel XSS 漏洞
- **文件**: `src/renderer/shared/components/AIChatPanel/AIChatPanel.tsx`
- **问题**: `renderMarkdown()` 使用 `dangerouslySetInnerHTML` 注入 AI 回复内容，LLM 返回恶意 HTML 时触发 XSS
- **修复**: 移除 `dangerouslySetInnerHTML`，改用 React 元素拆分渲染 bold 文本
- **状态**: [x]

### C-2 · 6 个已声明 IPC Channel 未注册 handler
- **文件**: `src/shared/constants/channels.ts`、`src/main/app.ts`
- **问题**: `TASK_SAVE`、`TASK_DELETE`、`TASK_STATUS`、`DB_QUERY`、`DB_RUN`、`STOCK_SUBSCRIBE`、`STOCK_UNSUBSCRIBE` 在常量中声明但主进程无对应 handler，渲染进程 invoke 会永远挂起
- **修复**: 从 `IPC_CHANNELS` 移除未就绪的常量（注释保留为预留）
- **状态**: [x]

### C-3 · AI 会话仅内存存储，进程退出丢失
- **文件**: `src/main/ai/AIService.ts`、`src/main/services/DatabaseService.ts`
- **问题**: `AIService.conversations` 是内存 Map；`DatabaseService` 已有 `ai_conversations` / `ai_messages` 表但未接入
- **修复**: 在 `AIService.chat()` 中写入 DB，构造函数中从 DB 恢复
- **状态**: [x] （已在 ca53a0e 提交中部分实现—写入 DB 已接入，启动恢复待后续版本）

### C-4 · TaskService.startTask() 未捕获 .then() 内部异常
- **文件**: `src/main/services/TaskService.ts`
- **问题**: `.then()` 回调中 `updateStatus()` / `eventBus.emit()` 若抛异常不会被 `.catch()` 捕获，产生 UnhandledPromiseRejection
- **修复**: 改为 async IIFE + 统一 try-catch
- **状态**: [x]

### C-5 · PluginLoader.uninstall() 路径遍历删除风险
- **文件**: `src/main/plugin-loader/PluginLoader.ts`
- **问题**: `fs.rmSync(entry.path, { recursive: true, force: true })` 未验证路径是否在 `pluginsDir` 内
- **修复**: `rmSync` 前校验 `path.resolve(entry.path).startsWith(path.resolve(this.pluginsDir))`
- **状态**: [x]

---

## Important

### I-1 · ToolRegistry 工具已注册但 AIService.chat() 从不调用
- **文件**: `src/main/ai/AIService.ts`
- **问题**: 注册了 `task_list`、`system_status`、`navigate` 工具，但 chat 流程无 function-calling 逻辑
- **修复**: V2 版本添加意图检测 + tool dispatch 循环
- **状态**: [ ] （标记为 V2，暂缓）

### I-2 · navigateTool 只发事件未实际打开窗口
- **文件**: `src/main/ai/tools/navigateTools.ts`
- **问题**: `emit(EVENTS.MODULE_OPENED)` 是通知事件不是命令，无 listener 响应
- **修复**: 改为 `createNavigateTool(openWindow)` 工厂函数，注入 WindowManager.openWindow 回调
- **状态**: [x]

### I-3 · ContextManager 硬编码依赖 DatabaseService 单例
- **文件**: `src/main/ai/ContextManager.ts`
- **问题**: 构造时 `DatabaseService.getInstance()`，DB 未 open 时崩溃；难以测试
- **修复**: 通过构造函数注入，保持与 TaskService 一致
- **状态**: [x]

### I-4 · TitleBar 缺少最大化按钮
- **文件**: `src/renderer/shared/components/TitleBar.tsx`
- **问题**: `frame: false` 无边框窗口只有 minimize/close/settings，无最大化操作
- **修复**: 添加最大化/还原切换按钮，调用 `WINDOW_MAXIMIZE`
- **状态**: [x]

### I-5 · ConfigService.importConfig() 无 schema 验证
- **文件**: `src/main/services/ConfigService.ts`
- **问题**: 直接 `JSON.parse` + 展开赋值，非法结构导致运行时 TypeError
- **修复**: 增加手写结构校验，拒绝不合法 JSON
- **状态**: [x]

### I-6 · 浏览器模块 tab state 与主进程不同步
- **文件**: `src/renderer/entries/browser/App.tsx`
- **问题**: 渲染进程本地 state，reload 后丢失；无初始化同步
- **修复**: 新增 `BROWSER_LIST_TABS` IPC channel，组件挂载时拉取主进程 tab 列表
- **状态**: [x]

### I-7 · AIChatPanel store 与主进程会话不同步
- **文件**: `src/renderer/shared/components/AIChatPanel/store.ts`
- **问题**: Zustand 内存 store，切换模块/刷新后消息丢失
- **修复**: Panel 打开时从主进程拉取会话历史（依赖 C-3 完成）
- **状态**: [ ] （待 C-3 启动恢复完成后进行）

---

## Minor

### M-1 · CONFIG_GET handler 类型断言不安全
- **文件**: `src/main/app.ts`
- **修复**: 验证 key 属于 `['general', 'modules', 'plugins', 'ai']`
- **状态**: [x]

### M-2 · OpenAIProvider 无请求 timeout
- **文件**: `src/main/ai/LLMProvider.ts`
- **修复**: 使用 `AbortController` + `setTimeout` 设置 30s timeout
- **状态**: [x]

### M-3 · AIService.generateId() 使用 Math.random()
- **文件**: `src/main/ai/AIService.ts`
- **修复**: 改用 `crypto.randomUUID()`
- **状态**: [x]

### M-4 · TabManager.closeAll() 边迭代边删除 Map
- **文件**: `src/main/browser/TabManager.ts`
- **修复**: 先收集 key 数组再迭代 `[...this.tabs.keys()]`
- **状态**: [x]

### M-5 · plugin-host preload log 用 send 而非 invoke
- **文件**: `src/renderer/plugin-host/preload.ts`
- **修复**: 改为 `ipcRenderer.invoke`
- **状态**: [x]

### M-6 · Workbench 内嵌子模块路由可能重复实例化
- **文件**: `src/renderer/entries/workbench/App.tsx`
- **修复**: 将业务逻辑提取到 hooks/store；知悉风险即可，暂不改

### M-7 · CommandRegistry 全局单例 HMR 不稳定
- **文件**: `src/renderer/shared/components/CommandPalette/CommandRegistry.ts`
- **修复**: 开发体验问题，暂不改

### M-8 · ContextManager CPU 计算不准
- **文件**: `src/main/ai/ContextManager.ts`
- **修复**: 标注为近似值
- **状态**: [x]

---

## 修复顺序

1. **C-1** → XSS 安全漏洞，最高优先
2. **C-5** → 路径遍历安全漏洞
3. **C-2** → Dead IPC channels 防挂起
4. **C-4** → Unhandled promise rejection
5. **C-3** → AI 会话持久化
6. **M-5** → Plugin preload log 通道修复
7. **M-1** → CONFIG_GET 校验
8. **M-2** → LLM 请求 timeout
9. **M-3** → ID 生成改进
10. **M-4** → Map 迭代安全
11. **I-3** → ContextManager DI
12. **I-4** → TitleBar 最大化按钮
13. **I-5** → ConfigService import 校验
14. **I-1** → Tool registry 闭环（标记 V2）
15. **I-2** → navigateTool 实际打开窗口
16. **I-6** → 浏览器 tab 同步
17. **I-7** → AIChatPanel 会话同步（依赖 C-3）
18. **M-6 / M-7 / M-8** → 知悉、暂缓
