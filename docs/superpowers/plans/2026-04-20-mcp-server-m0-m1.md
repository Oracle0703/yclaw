# MCP Server M0/M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 YClaw 落地 MCP Server 的首个可运行增量，支持 `stdio` 启动、基础握手、只读 tools/resources 与 CLI 入口。

**Architecture:** 在 `src/mcp/` 下新增独立的协议适配层，复用现有 `TaskService`、`BatchService`、`ResultService`、`ExecutionLogService` 的只读查询能力。CLI 通过 `yclaw mcp serve` 暴露 MCP server，首轮默认 `stdio`，并用统一 schema/资源解析层保证协议边界收敛。

**Tech Stack:** TypeScript、Vitest、Zod、`@modelcontextprotocol/sdk`

---

## File Map

- Create: `src/mcp/shared/schemas.ts`
- Create: `src/mcp/shared/resources.ts`
- Create: `src/mcp/shared/types.ts`
- Create: `src/mcp/server/createMcpServer.ts`
- Create: `src/mcp/server/registerReadOnlyCapabilities.ts`
- Create: `src/mcp/server/serveStdio.ts`
- Create: `tests/integration/mcp/server.spec.ts`
- Modify: `src/cli/yclaw.ts`
- Modify: `tests/unit/cli/yclaw.spec.ts`
- Modify: `package.json`
- Modify: `README.md`

### Task 1: CLI 入口与依赖装配

**Files:**
- Modify: `package.json`
- Modify: `src/cli/yclaw.ts`
- Test: `tests/unit/cli/yclaw.spec.ts`

- [ ] **Step 1: 写 CLI 失败测试**

补充 `tests/unit/cli/yclaw.spec.ts`，覆盖：
- `yclaw mcp serve --help` 返回帮助
- `yclaw mcp serve --transport stdio` 能进入 MCP 分发
- 不支持的 transport 返回退出码 `2`

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --run tests/unit/cli/yclaw.spec.ts`
Expected: FAIL，提示 `mcp` 命令未知或选项不存在

- [ ] **Step 3: 实现最小 CLI 分发**

在 `src/cli/yclaw.ts` 中新增：
- `mcp serve` 子命令解析
- `--transport stdio|http`
- `--port`
- `--help`

首轮仅真正实现 `stdio`；`http` 先返回明确未实现错误。

- [ ] **Step 4: 重新运行测试**

Run: `npm test -- --run tests/unit/cli/yclaw.spec.ts`
Expected: PASS

### Task 2: MCP 共享契约与资源解析

**Files:**
- Create: `src/mcp/shared/types.ts`
- Create: `src/mcp/shared/schemas.ts`
- Create: `src/mcp/shared/resources.ts`
- Test: `tests/integration/mcp/server.spec.ts`

- [ ] **Step 1: 写资源/工具失败测试**

在 `tests/integration/mcp/server.spec.ts` 先覆盖：
- `tools/list` 返回首批工具名
- `resources/list` 返回 `yclaw://...` 模板
- 非法资源 URI 被拒绝

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --run tests/integration/mcp/server.spec.ts`
Expected: FAIL，提示模块缺失或能力未注册

- [ ] **Step 3: 实现最小共享层**

在 `src/mcp/shared/` 中实现：
- 工具输入 schema
- 资源 URI 解析与构造
- 只读能力描述常量

- [ ] **Step 4: 重新运行测试**

Run: `npm test -- --run tests/integration/mcp/server.spec.ts`
Expected: 仍有部分 FAIL，但资源解析相关断言开始通过

### Task 3: 只读 MCP Server 能力

**Files:**
- Create: `src/mcp/server/createMcpServer.ts`
- Create: `src/mcp/server/registerReadOnlyCapabilities.ts`
- Create: `src/mcp/server/serveStdio.ts`
- Test: `tests/integration/mcp/server.spec.ts`

- [ ] **Step 1: 写握手/调用失败测试**

扩展 `tests/integration/mcp/server.spec.ts`，覆盖：
- `initialize`
- `tools/call` 对 `task.list`、`task.get`、`batch.get`、`batch.logs`、`results.query`
- 资源读取 `yclaw://tasks/<id>`、`yclaw://batches/<id>`、`yclaw://batches/<id>/logs`、`yclaw://results/<taskId>?limit=`
- 错误路径：未知工具、未知资源、缺失 token

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- --run tests/integration/mcp/server.spec.ts`
Expected: FAIL，提示 server 尚未处理协议请求

- [ ] **Step 3: 实现最小 server**

实现：
- `createMcpServer`：接收服务依赖与 token 配置
- `registerReadOnlyCapabilities`：注册只读 tools/resources
- `serveStdio`：标准输入输出 transport

工具输出保持简单稳定：
- `task.list` 返回结构化 JSON
- `task.get` 返回任务详情
- `batch.get` 返回批次状态
- `batch.logs` 返回日志数组/文本
- `results.query` 返回分页结果

- [ ] **Step 4: 重新运行测试**

Run: `npm test -- --run tests/integration/mcp/server.spec.ts`
Expected: PASS

### Task 4: 文档与收尾验证

**Files:**
- Modify: `README.md`
- Test: `tests/unit/cli/yclaw.spec.ts`
- Test: `tests/integration/mcp/server.spec.ts`

- [ ] **Step 1: 更新 README**

增加 MCP 集成小节：
- `yclaw mcp serve`
- `stdio` 用途
- token 环境变量
- 后续 `http` 计划说明

- [ ] **Step 2: 运行聚焦验证**

Run: `npm test -- --run tests/unit/cli/yclaw.spec.ts tests/integration/mcp/server.spec.ts`
Expected: PASS

- [ ] **Step 3: 运行类型校验**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: 记录剩余范围**

明确尚未覆盖：
- `task.run`
- `session.refresh`
- `dangerous` 标注
- `http transport`
- MCP Client / 设置页 UI
