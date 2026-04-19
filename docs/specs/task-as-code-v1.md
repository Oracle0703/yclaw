# SPEC · Task-as-Code V1（草案）

> 状态：**草案 / 实施中（核心序列化层已落地）**  
> 关联：[design/next-phase-ideas.md §2.2](../design/next-phase-ideas.md#22-方向-b--task-as-code任务即代码)  
> 与主线关系：**副线增量**，不替代任务中心 UI，只新增「序列化 + 导入导出 + 校验」。

## 实施进度（当前）

- ✅ 核心序列化层：[src/shared/serialization/](../../src/shared/serialization/README.md)（types / validate / yaml / secrets / mapping / loader）
- ✅ CLI （`yclaw lint` / `yclaw import` / `yclaw export`）：[src/cli/](../../src/cli/) · `npm run yclaw -- <cmd> <path>`
- ✅ 跨文件引用解析器（TAC-05 部分）：`loadDirectory` + `resolveReferences`
- ✅ schemaVersion 迁移框架（TAC-06）：`migrateFile` / `parseFileMigrating`，内置 v0→v1 示例
- ✅ import/export 子命令（文件层，不依赖 IPC）：YAML ⇄ JSON 双向转换
- ✅ 目录文件监听器（TAC-07）：`createWatcher(rootDir, opts)` 防抖 1s 默认，产出 added/changed/removed 事件
- ✅ 高层服务 facade `TaskAsCodeService`（importPath / exportTask / exportTemplate / watchDirectory），DI Persistence 适配器
- ✅ IPC handlers（`task:importYaml` / `task:exportYaml` / `task:watch:start` / `task:watch:stop` + `task:watch:event` 推送），纯 Node 可单测
- ✅ 单元测试：[tests/unit/serialization/](../../tests/unit/serialization) + [tests/unit/cli/](../../tests/unit/cli) + [tests/unit/ipc/](../../tests/unit/ipc)（近 230 用例）
- ✅ 示例：[examples/tasks/](../../examples/tasks/)

### ⏳ 待实施 / 待补强（截至 2026-04-20 review）

| 优先级 | 项 | 关联 | 备注 |
| --- | --- | --- | --- |
| P0 | 任务中心 Repository 对接 `Persistence` 适配器 | TAC-02 | 把 `TaskAsCodeService` 的 `Persistence` 接到现有 SQLite/Repository；当前业务侧无任何调用方 |
| P0 | 主进程在启动时注册 `task-as-code-handlers` 到 `IpcController` | — | handler 已写好但未在 `src/main/app.ts` / `src/main/ipc/index.ts` 装配 |
| P0 | 渲染端 preload 暴露 `window.api.taskAsCode.*` + 渲染端 hook | — | 当前渲染端无任何调用入口 |
| P1 | UI 导入/导出按钮（任务中心 + 模板中心） | TAC-01 / TAC-02 | 走新 IPC 通道；监听开关复用 `task:watch:start` |
| P1 | 根 README 增加「Task-as-Code 用法」章节（quick-start） | TAC-08 | spec 要求；目前只在 docs/specs 里有，对外用户入口缺失 |
| P1 | 导入幂等性端到端测试 | TAC-02 | 同一文件 importPath 两次，断言 Repository 仅产生一次 upsert（含 createdAt 不变） |
| P1 | IPC payload 结构校验（exportYaml 的 TaskFlow / Template 字段） | 安全 | 当前仅 `kind` / `path` 做了字符串校验；`payload` 直接 cast |
| P2 | `loadDirectory` 重复 id 跨文件冲突时给出 warning issue | 用户体验 | 当前后者静默覆盖前者，无任何提示 |
| P2 | `yclaw lint` 增加 SARIF 输出 | TAC-03 | spec 写「SARIF / 简洁文本两种格式」，目前只有文本 + JSON |
| P2 | Watcher 大目录 / 高频变更压力测试；Windows 路径分隔符测试 | 健壮性 | 当前仅 POSIX 路径与少量事件覆盖 |
| P3 | 类型双轨同步检查（File schema vs 运行时 TaskFlow） | 维护性 | 加一个 round-trip 用例锁定字段 |
| P3 | 模板包打包发布（独立 spec） | 非目标→后续 | 见本文 §2 非目标 |

---

## 1. 目标

让 YClaw 的任务、模板、规则、调度配置可以以 **人类可读的文本格式（YAML）** 在文件系统里管理，从而具备：

- 可纳入 Git 版本管理：PR review、diff、回滚、blame。
- 可在团队/多机器之间复制：clone 仓库即可拿到全套任务。
- 可在 CI 中静态校验：`yclaw lint <file>` 验证 schema。
- 是后续「采集脚本市场 / 模板分发」的底层格式。

---

## 2. 非目标

- 不做云端同步、不做账号体系。
- 不强制取消 SQLite，文件 ↔ DB 仍是 **双向同步**，UI 编辑保留。
- 不做配置加密（敏感信息走环境变量引用）。
- 不做模板包打包发布（属于后续 spec）。

---

## 3. 验收标准

| ID | 描述 |
| --- | --- |
| TAC-01 | 任务、模板、调度可通过 UI 按钮 / CLI 命令导出为 YAML 文件，结构稳定且自带 `schemaVersion` 字段。 |
| TAC-02 | 同样的 YAML 文件可被导入并完整恢复对应的 DB 记录，导入是 **幂等** 的（重复导入不会产生重复条目，只 upsert）。 |
| TAC-03 | 提供 `yclaw lint <path>` 命令，对单文件或目录批量校验 schema，错误以 SARIF / 简洁文本两种格式输出。 |
| TAC-04 | 敏感字段（账号、token）支持 `${env:VAR_NAME}` 引用，导出时 **永不写入明文**。 |
| TAC-05 | YAML 中允许跨文件引用模板（`extends: ./templates/login.yaml`），引用解析失败时给出清晰错误。 |
| TAC-06 | Schema 升级时提供迁移函数：旧 schemaVersion 文件被识别后自动升级（写回时使用新版）。 |
| TAC-07 | UI 中提供「监听本地目录变更」开关：开启后文件改动会触发 DB 同步（防抖 1s）。默认关闭。 |
| TAC-08 | 文档：本 spec、根 README「Task-as-Code 用法」章节、`examples/tasks/` 示例目录。 |

---

## 4. 文件布局约定

推荐用户在自己的仓库下使用这种布局，YClaw 仅负责读取/写入，不强制目录名：

```
my-yclaw-project/
├── tasks/
│   ├── daily-report.yaml
│   └── stock-watch.yaml
├── templates/
│   ├── login-foo.yaml
│   └── extract-table.yaml
├── schedules/
│   └── nightly.yaml
└── .yclaw/
    └── workspace.yaml      # 工作区元信息（数据目录、runner 选择等）
```

---

## 5. YAML Schema（节选示意，最终以 JSON Schema 文件为准）

```yaml
# tasks/daily-report.yaml
schemaVersion: 1
kind: Task
metadata:
  id: daily-report           # 用户可读 id，全局唯一
  name: 每日运营报表采集
  tags: [daily, report]
spec:
  template: ./templates/login-foo.yaml   # 引用模板
  steps:
    - id: open
      action: navigate
      url: https://example.com/dashboard
    - id: extract
      action: extract
      selector: table.report
      output: rows
  schedule:
    cron: "0 8 * * *"
    timezone: Asia/Shanghai
  retry:
    max: 3
    backoff: exponential
  session:
    ref: foo-account          # 引用 sessions
  secrets:
    user: ${env:FOO_USER}
    pass: ${env:FOO_PASS}
```

每个 `kind` 都有自己的子 schema：`Task` / `Template` / `Schedule` / `Session`。

---

## 6. 序列化映射

| DB 表 | 文件 kind | 备注 |
| --- | --- | --- |
| `tasks` | `Task` | 用 `metadata.id` 作为业务主键，不导出自增 id。 |
| `templates` | `Template` | 同上。 |
| `schedules` | `Schedule` | 可与 Task 同文件，也可独立。 |
| `sessions` | `Session` | 仅导出 **结构** 不导出 cookie / token。 |
| `batches` / `results` / `logs` | **不导出** | 这些是运行时数据，不进 Git。 |

导入策略：以 `metadata.id` 为键 **upsert**；删除采用「显式 `yclaw import --prune`」，避免误删。

---

## 7. 命令行接口

```
yclaw export task   <taskId>       --out tasks/daily-report.yaml
yclaw export all                   --out ./
yclaw import        <path>         [--dry-run] [--prune]
yclaw lint          <path>         [--format text|sarif]
yclaw watch         <dir>          # 持续监听
```

UI 侧在「任务详情」「模板详情」页提供「导出 YAML / 复制 YAML」按钮。

---

## 8. 影响面

| 模块 | 影响 |
| --- | --- |
| `src/main/services/TaskService.ts` 等 | 抽出「序列化 / 反序列化」纯函数到 `src/shared/serialization/`，便于 CLI 与 UI 共用。 |
| `src/shared/types/` | 新增 `TaskFile`、`TemplateFile` 等文件级类型 + JSON Schema 文件。 |
| 主进程 IPC | 新增 `task:exportYaml` / `task:importYaml` / `config:lint` 通道。 |
| 测试 | `tests/unit/serialization/*` 覆盖往返一致性与 schema 迁移；示例文件放 `examples/tasks/`。 |

---

## 9. 里程碑

| 里程碑 | 内容 |
| --- | --- |
| TAC-M0 | 定义 schema v1 + JSON Schema 文件；明确所有字段的可选/必填。 |
| TAC-M1 | 实现 Task / Template / Schedule 三种 kind 的导出 + 导入 + lint。 |
| TAC-M2 | UI 集成：任务/模板详情页加导出按钮；设置页加「批量导出 / 导入工作区」。 |
| TAC-M3 | 文件监听 + 防抖同步（默认关闭，opt-in）。 |
| TAC-M4 | 验收：完整跑通 TAC-01 ~ TAC-08。 |

---

## 10. 风险

| 项 | 描述 |
| --- | --- |
| 双向同步冲突 | 用户在 UI 改 + 文件改可能冲突，v1 用「最后写入胜出 + 警告」策略，复杂冲突暂不处理。 |
| Schema 演进 | 必须从一开始就严格控制字段命名与 deprecation 流程，避免后期破坏性升级。 |
| 敏感信息泄漏 | 必须把「永不写入明文」做成强约束，配合单测验证。 |

---

## 11. 与现有 spec 的关系

| 现有 spec | 关系 |
| --- | --- |
| [specs/v1.0-baseline.md](v1.0-baseline.md) | 兼容，本 spec 是上层增量。 |
| [specs/automation-browser-ops-v1.md](automation-browser-ops-v1.md) | 复用其 Task / Template 数据模型。 |
| [specs/headless-runner-v1.md](headless-runner-v1.md) | 强协同：CLI 模式天然需要 YAML 配置入口。 |
