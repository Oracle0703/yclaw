# 📦 YClaw V1.1 增强功能 Spec 文档

> 基于《总控页面创意建议》和《AI 运营助手设计方案》两份文档，筛选出当前可落地的增强功能

---

## 文档定位

| 项目 | 说明 |
| --- | --- |
| 文档属性 | 本文档描述 V1.1 及后续增强项的规格目标 |
| 与现状关系 | 部分增强项已在代码中出现实现或雏形，但本文仍以规格目标为主 |
| 现状参考 | 当前实际完成度请查看 `docs/current-status.md` |
| 基线规格 | V1.0 基线请查看 `docs/specs.md` |

> 如果某项增强已经部分落地，请同时结合代码和 `docs/current-status.md` 判断其真实完成度。

## 可行性修改建议清单

### 采纳清单（当前基础设施已就绪，可立即实施）

| #   | 来源文档 | 功能                  | 理由                                         | 对应 SPEC |
| --- | -------- | --------------------- | -------------------------------------------- | --------- |
| 1   | 总控页面 | **命令面板 (Ctrl+K)** | 纯前端组件，无后端依赖，极大提升操作效率     | SPEC-023  |
| 2   | 总控页面 | **KPI 趋势迷你图**    | 增强现有 Home.tsx KPI 卡片，工作量小         | SPEC-024  |
| 3   | 总控页面 | **任务执行时间线**    | 增强 Home.tsx 任务展示，直观展示状态         | SPEC-025  |
| 4   | AI 助手  | **AI 服务层基础架构** | LLM Provider + ContextManager + ToolRegistry | SPEC-026  |
| 5   | AI 助手  | **AI 聊天面板 UI**    | 悬浮面板 + 侧边对话栏                        | SPEC-027  |
| 6   | 总控页面 | **系统资源仪表盘**    | 环形进度替代文字展示                         | SPEC-028  |

### 暂缓清单（依赖未就绪或工作量过大）

| #   | 功能                  | 暂缓理由                                    |
| --- | --------------------- | ------------------------------------------- |
| 1   | 可视化工作流画布      | 需要 ReactFlow 等库，工作量 5d+，非核心路径 |
| 2   | 拖拽布局              | 需要 react-grid-layout，改动首页结构大      |
| 3   | 社区模板市场          | 需要后端服务支撑                            |
| 4   | 团队协作看板          | 多用户功能，需后端基础设施                  |
| 5   | 语音输入              | 浏览器 SpeechRecognition API 兼容性不稳定   |
| 6   | 实时数据流粒子动画    | 纯视觉效果，优先级低                        |
| 7   | AI 主动智能 (Phase 3) | 依赖 Phase 1/2 完成                         |

---

## Spec 总览

> 状态说明：`✅` 已闭环、`🟡` 部分实现/部分验证、`⬜` 待实现。

| ID       | 标题                       | 模块    | 优先级 | 状态 | 复杂度 | 依赖               |
| -------- | -------------------------- | ------- | :----: | :--: | :----: | ------------------ |
| SPEC-023 | 命令面板 (Command Palette) | 工作台  |   P0   |  🟡  |   M    | SPEC-009           |
| SPEC-024 | KPI 趋势迷你图             | 工作台  |   P1   |  ✅  |   S    | SPEC-009           |
| SPEC-025 | 任务执行时间线             | 工作台  |   P1   |  ✅  |   S    | SPEC-009           |
| SPEC-026 | AI 服务层基础架构          | AI 助手 |   P1   |  🟡  |   L    | SPEC-005, SPEC-006 |
| SPEC-027 | AI 聊天面板 UI             | AI 助手 |   P1   |  🟡  |   M    | SPEC-026           |
| SPEC-028 | 系统资源环形仪表盘         | 工作台  |   P2   |  ✅  |   S    | SPEC-009           |

### 依赖关系

```
SPEC-009 (主工作台首页) ──→ SPEC-023 (命令面板)
                         ──→ SPEC-024 (KPI 迷你图)
                         ──→ SPEC-025 (任务时间线)
                         ──→ SPEC-028 (资源仪表盘)

SPEC-005 (IPC 框架)     ──→ SPEC-026 (AI 服务层)
SPEC-006 (SQLite)        ──→ SPEC-026
SPEC-026                 ──→ SPEC-027 (AI 聊天面板)
```

---

## SPEC-023: 命令面板 (Command Palette)

| 属性       | 值       |
| ---------- | -------- |
| **模块**   | 工作台   |
| **优先级** | P0       |
| **复杂度** | M        |
| **依赖**   | SPEC-009 |

**描述**：实现类 VS Code 的命令面板，`Ctrl+K` 唤起，支持模糊搜索、命令执行、最近使用记录。

**验收标准**：

- [ ] `CommandPalette.tsx` 组件，`Ctrl+K` 全局快捷键唤起，`Esc` 关闭
- [ ] 输入框支持模糊搜索命令列表
- [ ] 内置命令：导航到各模块、新建任务、刷新数据、打开设置
- [ ] 命令项显示图标、名称、快捷键提示
- [ ] `↑↓` 键盘导航，`Enter` 执行选中命令
- [ ] 最近使用命令排在列表顶部（localStorage 持久化）
- [ ] 命令注册表 `CommandRegistry` 支持动态注册/注销命令
- [ ] 遮罩层点击关闭面板

**技术方案**：

- 纯前端 React 组件，挂载在 workbench App 级别
- `CommandRegistry` 维护命令列表，支持 `register` / `unregister`
- 搜索使用简单字符串 `includes` 匹配（后续可升级 fuse.js）
- 最近使用记录存储在 `localStorage`，最多保留 10 条

---

## SPEC-024: KPI 趋势迷你图

| 属性       | 值       |
| ---------- | -------- |
| **模块**   | 工作台   |
| **优先级** | P1       |
| **复杂度** | S        |
| **依赖**   | SPEC-009 |

**描述**：在 Home.tsx 的 KPI 卡片中增加 Sparkline 迷你趋势图，展示近 7 天数据变化。

**验收标准**：

- [ ] `Sparkline.tsx` 组件，基于 SVG 绘制迷你折线图
- [ ] 接收 `data: number[]` 数组，自动计算坐标并渲染
- [ ] 支持颜色配置（上升绿、下降红）
- [ ] 图表宽度自适应容器，高度固定 32px
- [ ] 每个 KPI 卡片底部展示 Sparkline
- [ ] 无外部图表库依赖（纯 SVG 实现）

**技术方案**：

- 纯 SVG `<polyline>` 实现，数据 → 坐标映射
- 7 个数据点，线宽 1.5px，带渐变填充

---

## SPEC-025: 任务执行时间线

| 属性       | 值       |
| ---------- | -------- |
| **模块**   | 工作台   |
| **优先级** | P1       |
| **复杂度** | S        |
| **依赖**   | SPEC-009 |

**描述**：在 Home.tsx 中增加时间线组件，按时间顺序展示今日任务执行状态。

**验收标准**：

- [ ] `TaskTimeline.tsx` 组件，使用 Antd `Timeline` 渲染
- [ ] 显示任务名称、执行时间、状态（成功/失败/进行中/待执行）
- [ ] 状态使用不同颜色的圆点区分
- [ ] 当前时间标记线
- [ ] 支持点击任务名称跳转到对应模块

**技术方案**：

- 基于 Antd `Timeline` 组件
- 静态 mock 数据（后续通过 IPC 获取真实数据）

---

## SPEC-026: AI 服务层基础架构

| 属性       | 值                 |
| ---------- | ------------------ |
| **模块**   | AI 助手            |
| **优先级** | P1                 |
| **复杂度** | L                  |
| **依赖**   | SPEC-005, SPEC-006 |

**描述**：实现 AI 运营助手的主进程服务层，包含 LLM Provider 抽象、上下文管理、工具注册表和 AI 服务调度核心。

**验收标准**：

- [ ] `LLMProvider` 接口定义 `chat` 和 `streamChat` 方法
- [ ] `OpenAIProvider` 实现，支持通过 API Key 调用 OpenAI/兼容 API
- [ ] `ContextManager` 收集当前模块、系统状态、任务数据等上下文
- [ ] `ContextManager.contextToPrompt()` 将上下文转换为结构化 Prompt
- [ ] `ToolRegistry` 支持工具注册/查询，内置 3 个工具：`task_list`、`system_status`、`navigate`
- [ ] `AIService` 作为核心调度，串联 Context → Intent → Tool → LLM → Response
- [ ] IPC 通道注册：`ai:chat`、`ai:config`、`ai:tools`
- [ ] 对话历史持久化到 SQLite（`ai_conversations` 表）
- [ ] LLM Provider 配置存储在 ConfigService 中

**类型定义**：

```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface AIToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  confirmationLevel: 0 | 1 | 2 | 3;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface AIConfig {
  provider: 'openai' | 'ollama' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
}
```

**文件布局**：

```
src/
  main/
    ai/
      AIService.ts          # 核心调度服务
      ContextManager.ts     # 上下文收集
      LLMProvider.ts        # Provider 接口 + OpenAI 实现
      ToolRegistry.ts       # 工具注册表
      tools/
        taskTools.ts        # 任务相关工具
        systemTools.ts      # 系统相关工具
        navigateTools.ts    # 导航工具
      types.ts              # AI 模块类型定义
      index.ts              # 统一导出
  shared/
    types/
      ai.ts                 # AI 共享类型
    constants/
      channels.ts           # 新增 AI 相关通道
```

---

## SPEC-027: AI 聊天面板 UI

| 属性       | 值       |
| ---------- | -------- |
| **模块**   | AI 助手  |
| **优先级** | P1       |
| **复杂度** | M        |
| **依赖**   | SPEC-026 |

**描述**：实现 AI 助手的前端聊天面板，包含悬浮气泡入口和可展开的对话面板。

**验收标准**：

- [ ] `AIChatBubble.tsx` 悬浮气泡组件，固定右下角，点击展开/收起
- [ ] `AIChatPanel.tsx` 对话面板，宽度 360px，高度自适应（最大 480px）
- [ ] 消息列表展示用户消息和 AI 回复（气泡样式）
- [ ] 输入框支持 `Enter` 发送、`Shift+Enter` 换行
- [ ] 支持快捷键 `Ctrl+J` 快速唤起/关闭面板
- [ ] 消息支持 Markdown 渲染（代码块、表格、列表）
- [ ] AI 回复中的操作按钮可点击执行（如 [查看详情]、[立即执行]）
- [ ] 加载状态：AI 思考中显示打字动画
- [ ] 面板头部显示"AI 运营助手"标题和关闭按钮
- [ ] 通过 IPC 调用 `ai:chat` 通道发送消息

**技术方案**：

- 挂载在 workbench App 级别（与 CommandPalette 并列）
- 使用 Zustand store 管理聊天状态
- Markdown 渲染使用简单的正则替换（代码块、加粗、列表）
- 无重型 Markdown 库依赖

---

## SPEC-028: 系统资源环形仪表盘

| 属性       | 值       |
| ---------- | -------- |
| **模块**   | 工作台   |
| **优先级** | P2       |
| **复杂度** | S        |
| **依赖**   | SPEC-009 |

**描述**：将 Home.tsx 中的资源占用 Progress 条替换为环形仪表盘展示。

**验收标准**：

- [ ] `RingGauge.tsx` 组件，SVG 环形进度展示
- [ ] 中心显示百分比数值
- [ ] 支持颜色阈值（< 60% 绿色，60-80% 橙色，> 80% 红色）
- [ ] 支持标签文字
- [ ] 动画过渡效果（数值变化时平滑过渡）

---

## 执行顺序

| 批次 | Spec     | 说明                            |
| :--: | -------- | ------------------------------- |
|  1   | SPEC-023 | 命令面板（独立组件，无依赖）    |
|  1   | SPEC-024 | KPI 迷你图（独立组件）          |
|  1   | SPEC-025 | 任务时间线（独立组件）          |
|  1   | SPEC-028 | 资源仪表盘（独立组件）          |
|  2   | SPEC-026 | AI 服务层（需要新增文件较多）   |
|  3   | SPEC-027 | AI 聊天面板 UI（依赖 SPEC-026） |
