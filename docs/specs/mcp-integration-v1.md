# SPEC · MCP 集成 V1

> 状态：**基础版已落地 / M5 验收收尾中**  
> 关联：[design/next-phase-ideas.md §2.3](../design/next-phase-ideas.md#23-方向-c--mcpmodel-context-protocol集成)  
> 与主线关系：**副线增量**，复用现有 `ToolRegistry` / `AIService`，不改变桌面 AI 助手交互。

> MCP（Model Context Protocol）是 Anthropic 主导的开放协议，让 LLM 客户端（Claude Desktop、Cursor、Continue 等）能以标准方式调用外部工具与资源。  
> 协议规范：<https://modelcontextprotocol.io>。

## 当前实施进度（截至 2026-04-21）

- ✅ `src/mcp/shared/`、`src/mcp/server/`、`src/mcp/client/` 基础目录与协议适配层已落地。
- ✅ MCP Server 已支持 `stdio` 与本机 `Streamable HTTP`，并具备 token / Bearer 鉴权。
- ✅ 只读 tools/resources 已可通过真实集成测试验证，危险写工具 `task.run` / `session.refresh` 已具备 dangerous 标记与桌面宿主接线。
- ✅ 桌面端设置页已支持 `Embedded MCP HTTP` 生命周期管理、外部 `MCP Servers` JSON 配置、外部 server 状态展示。
- ✅ AI 助手已可自动注册外部 MCP tools 到 `ToolRegistry`，支持手动执行、自动工具调用、危险确认、执行前摘要展示。
- ✅ 设置页已新增 `MCP 审计` 区块；外部 MCP tool 执行、危险写工具调用都会写入审计日志。
- ✅ Claude Desktop / Cursor 示例配置已放入 [`examples/mcp/`](../../examples/mcp/)。

### 待继续收口

| 优先级 | 项目 | 说明 |
| --- | --- | --- |
| P1 | 最终验收清单核对 | 对照 MCP-S01~07、MCP-C01~04、MCP-G01~03 逐条标记完成度 |
| P1 | 文档持续对齐 | 后续若补资源、审计筛选或远程访问边界，需同步 README / spec / current-status |
| P2 | 数据量与资源分页 | 结果、日志等资源仍需持续控制分页和截断策略，避免一次性加载过大上下文 |

---

## 1. 目标

让 YClaw **同时具备 MCP server 与 MCP client 两种角色**：

| 角色 | 含义 | 价值 |
| --- | --- | --- |
| MCP **Server** | 把 YClaw 的任务、批次、结果、日志、会话作为「工具 + 资源」暴露 | 外部 LLM 客户端可直接驱动 YClaw |
| MCP **Client** | YClaw 内置 AI 助手可以连接外部 MCP server，复用社区工具 | 让 AI 助手能力沿生态自然扩展 |

---

## 2. 非目标

- 不做远程托管：MCP server 仅在本机/同局域网监听。
- 不做 OAuth / 多租户认证（v1 用 token + 本机回环）。
- 不替代现有 `AIService` 的内部 `ToolRegistry`，只在其上做协议适配。
- 不做 streaming function call 之外的实时通道（v2 再考虑 SSE 资源订阅）。

---

## 3. 验收标准

### Server 角色

| ID | 描述 |
| --- | --- |
| MCP-S01 | 启动 `yclaw mcp serve` 后输出标准 MCP server，实现 `initialize` / `tools/list` / `tools/call` / `resources/list` / `resources/read`。 |
| MCP-S02 | 暴露至少以下工具（首批）：`task.list`、`task.run`、`batch.get`、`batch.logs`、`results.query`、`session.refresh`。 |
| MCP-S03 | 暴露以下资源 URI：`yclaw://tasks/<id>`、`yclaw://batches/<id>`、`yclaw://batches/<id>/logs`、`yclaw://results/<taskId>?limit=`。 |
| MCP-S04 | Claude Desktop / Cursor 配置文件示例，可一键接入并通过 `tools/list` 看到工具。 |
| MCP-S05 | 所有「写操作」（`task.run`、`session.refresh`）必须在工具描述中标注 `dangerous: true`，由客户端强制确认。 |
| MCP-S06 | 鉴权：`YCLAW_MCP_TOKEN` 环境变量配置，握手阶段校验；缺失或不匹配返回 `unauthorized`。 |
| MCP-S07 | 默认监听 `stdio`（兼容 Claude Desktop），同时支持 `--transport http --port` 切换。 |

### Client 角色

| ID | 描述 |
| --- | --- |
| MCP-C01 | 桌面端「设置 → AI → MCP Servers」可配置 N 个外部 MCP server（command / env / args）。 |
| MCP-C02 | 启动后 AI 助手的 `ToolRegistry` 自动注册外部 MCP 工具，前缀为 `mcp.<server>.<tool>`。 |
| MCP-C03 | 工具调用对用户可见：调用前展示工具名 + 参数，dangerous 工具需要用户在面板确认。 |
| MCP-C04 | 任一外部 MCP server 崩溃不影响主进程稳定，自动降级并在 UI 中标记「不可用」。 |

### 通用

| ID | 描述 |
| --- | --- |
| MCP-G01 | 工具 schema 严格 typed（zod / json-schema）；`tools/list` 返回完整描述。 |
| MCP-G02 | 文档：本 spec、根 README「MCP 集成」章节、`docs/design/next-phase-ideas.md §2.3` 互相链接。 |
| MCP-G03 | 测试：`tests/integration/mcp/server.spec.ts`、`tests/integration/mcp/client.spec.ts` 覆盖握手、tool/list、tool/call、错误路径。 |

---

## 4. 架构

```
┌────────────────────────┐
│   外部 LLM 客户端       │  (Claude Desktop / Cursor / Continue)
└──────────┬─────────────┘
           │  MCP (stdio / http)
           ▼
┌────────────────────────┐        ┌─────────────────────┐
│ YClaw  MCP Server       │ ──→   │ Core Services        │
│  (src/mcp/server/)      │       │  TaskService etc.    │
└────────────────────────┘        └─────────────────────┘
           ▲
           │
┌────────────────────────┐
│ YClaw  MCP Client       │ ──→   外部 MCP Servers
│  (src/mcp/client/)      │       (filesystem / git / browser …)
└────────────────────────┘
           ▲
           │
┌────────────────────────┐
│ AIService.ToolRegistry  │  ← 注册外部工具（前缀 mcp.<server>.<tool>）
└────────────────────────┘
```

- 新增目录：`src/mcp/server/`、`src/mcp/client/`、`src/mcp/shared/`。
- 复用 SDK：`@modelcontextprotocol/sdk`（官方 TypeScript SDK）。
- Server 入口可独立启动（CLI），与 [specs/headless-runner-v1.md](headless-runner-v1.md) 共用 Core Services。

---

## 5. 工具与资源清单（v1）

### 工具（Tools）

| 名称 | 描述 | 写操作 |
| --- | --- | --- |
| `task.list` | 列出任务（可按 tag / 状态过滤） | 否 |
| `task.get` | 读取任务详情 | 否 |
| `task.run` | 触发任务执行，返回 batchId | **是** |
| `batch.get` | 读取批次状态 | 否 |
| `batch.logs` | 读取批次结构化日志（分页） | 否 |
| `results.query` | 查询结果（按 task / 时间范围 / 关键字） | 否 |
| `session.refresh` | 重新建立指定 session 登录态 | **是** |

### 资源（Resources，URI scheme `yclaw://`）

| URI | 内容 |
| --- | --- |
| `yclaw://tasks/<id>` | 任务定义（YAML 序列化） |
| `yclaw://batches/<id>` | 批次状态 JSON |
| `yclaw://batches/<id>/logs` | 批次日志（NDJSON） |
| `yclaw://results/<taskId>?limit=&since=` | 结果集（NDJSON，分页） |
| `yclaw://screenshots/<batchId>/<step>` | 截图 PNG |

---

## 6. 安全与权限

- **默认 deny-by-default**：不在白名单内的服务/工具一律不暴露。
- **写操作二次确认**：`task.run` / `session.refresh` 等 dangerous 工具，客户端必须实现确认 UI；YClaw 自身的 MCP Client 也强制弹窗。
- **沙箱外部工具**：作为 client 调用外部 server 时，所有响应仅写入 AI 上下文，不直接影响 YClaw 数据库。
- **审计日志**：所有 MCP 调用写入 `LogService`，可在「设置 → AI → MCP 审计」查看。
- **Token 鉴权**：`YCLAW_MCP_TOKEN` 必须设置；未设置时 `mcp serve` 拒绝启动并提示。

---

## 7. 里程碑

| 里程碑 | 内容 |
| --- | --- |
| MCP-M0 | 引入 SDK，搭建 `src/mcp/shared/` 类型与协议适配骨架。 |
| MCP-M1 | Server：实现 `task.list` / `task.get` / `batch.get` / `batch.logs` / `results.query` 五个只读工具，stdio transport。 |
| MCP-M2 | Server：实现 `task.run` / `session.refresh` 两个写工具 + dangerous 标注 + 审计日志。 |
| MCP-M3 | Server：HTTP transport + token 鉴权；提供 Claude Desktop / Cursor 配置示例。 |
| MCP-M4 | Client：桌面端「MCP Servers」配置 UI + 自动注册到 `ToolRegistry`。 |
| MCP-M5 | 验收：完整跑通 MCP-S01~07、MCP-C01~04、MCP-G01~03。 |

---

## 8. 影响面

| 模块 | 影响 |
| --- | --- |
| `src/main/ai/AIService.ts` | 工具注入扩展：除内置 tools 外，能合并外部 MCP client 提供的 tools。 |
| `src/main/ai/ToolRegistry.ts` | 增加「来源」字段（`builtin` / `mcp:<server>`），用于 UI 展示与权限判断。 |
| `src/runner/cli/` | 新增 `yclaw mcp serve` 子命令（依赖 [headless-runner-v1](headless-runner-v1.md) 已落地）。 |
| `src/renderer/entries/workbench/` | 设置页新增 MCP 配置面板。 |
| 文档 | 增加根 README MCP 段落、Claude/Cursor 配置示例文件 `examples/mcp/`. |

---

## 9. 风险与开放问题

| 项 | 描述 |
| --- | --- |
| Headless Runner 依赖 | Server 角色最佳形态依赖 [headless-runner-v1](headless-runner-v1.md) 完成度；若未就绪可临时让 Server 在桌面进程内启动子线程。 |
| 工具滥用 | 外部 LLM 客户端可能滥用 `task.run`，必须靠「dangerous + 审计 + 速率限制」三道线防护。v1 加 60s 内 N 次的速率上限。 |
| 协议演进 | MCP 规范仍在快速迭代，需明确「最低支持版本」并在 `initialize` 阶段协商。 |
| 资源数据量 | `yclaw://results/<taskId>` 数据可能很大，必须分页 + 流式，避免一次性加载。 |

---

## 10. 与现有 spec 的关系

| 现有 spec | 关系 |
| --- | --- |
| [specs/v1.1-enhancements.md](v1.1-enhancements.md) | 协同：本 spec 是 AI 助手能力的横向扩张。 |
| [specs/headless-runner-v1.md](headless-runner-v1.md) | **依赖**：Server 角色 v1 强烈推荐基于其 Core Services 装配。 |
| [specs/task-as-code-v1.md](task-as-code-v1.md) | 协同：资源 `yclaw://tasks/<id>` 输出建议复用 Task-as-Code 的 YAML 序列化结果。 |
