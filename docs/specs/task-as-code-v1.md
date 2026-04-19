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
- ✅ 单元测试：[tests/unit/serialization/](../../tests/unit/serialization) + [tests/unit/cli/](../../tests/unit/cli) + [tests/unit/ipc/](../../tests/unit/ipc) + [tests/unit/services/task-as-code/](../../tests/unit/services/task-as-code) + [tests/unit/renderer/api/](../../tests/unit/renderer/api)（**875 用例 · 111 文件**，截至 2026-04-20）
- ✅ 示例：[examples/tasks/](../../examples/tasks/)

### ⏳ 待实施 / 待补强（截至 2026-04-20 review）

| 优先级 | 项 | 关联 | 备注 |
| --- | --- | --- | --- |
| ~~P0~~ | ~~任务中心 Repository 对接 `Persistence` 适配器~~ | TAC-02 | ✅ 已完成：[`createRepositoryPersistence`](../../src/main/services/task-as-code/RepositoryPersistence.ts) 适配 `TaskRepository.saveTaskFlow` + 新增 `getTaskCreatedAt` 与 `TemplateRepository.saveTemplate` + `getTemplateCreatedAt`，9 个适配器测试（[RepositoryPersistence.spec.ts](../../tests/unit/services/task-as-code/RepositoryPersistence.spec.ts) + [RepositoryPersistence-edge.spec.ts](../../tests/unit/services/task-as-code/RepositoryPersistence-edge.spec.ts)）。剩余主进程 IPC 装配单独跟踪 |
| ~~P0~~ | ~~主进程在启动时注册 `task-as-code-handlers` 到 `IpcController`~~ | — | ✅ 已完成：[`bootstrapTaskAsCode`](../../src/main/services/task-as-code/bootstrap.ts) 在 `App` 构造期装配 service+handlers 并注册 4 个 channel；shutdown 时 dispose；11 个测试（[bootstrap.spec.ts](../../tests/unit/services/task-as-code/bootstrap.spec.ts) + [bootstrap-edge.spec.ts](../../tests/unit/services/task-as-code/bootstrap-edge.spec.ts)） |
| ~~P0~~ | ~~渲染端 preload 暴露 `window.api.taskAsCode.*` + 渲染端 hook~~ | — | ✅ 已完成：[`createTaskAsCodeApi`](../../src/renderer/shared/api/taskAsCode.ts) 工厂 + preload 通过 `contextBridge` 注入 `window.api.taskAsCode`；channel 常量与 envelope 类型迁至 [`@shared/constants/task-as-code`](../../src/shared/constants/task-as-code.ts)；10 个测试（[taskAsCode.spec.ts](../../tests/unit/renderer/api/taskAsCode.spec.ts) + [taskAsCode-edge.spec.ts](../../tests/unit/renderer/api/taskAsCode-edge.spec.ts)）。React hook 留给 UI 接入阶段实现 |
| P1 | UI 导入/导出按钮（任务中心 + 模板中心） | TAC-01 / TAC-02 | 走新 IPC 通道；监听开关复用 `task:watch:start` |
| P1 | 根 README 增加「Task-as-Code 用法」章节（quick-start） | TAC-08 | spec 要求；目前只在 docs/specs 里有，对外用户入口缺失 |
| P1 | 导入幂等性端到端测试 | TAC-02 | ✅ 已完成：`Persistence.findExistingTaskCreatedAt` / `findExistingTemplateCreatedAt` 可选钩子 + 9 个幂等性单测（[service-idempotency.spec.ts](../../tests/unit/serialization/service-idempotency.spec.ts)） |
| P1 | IPC payload 结构校验（exportYaml 的 TaskFlow / Template 字段） | 安全 | ✅ 已完成：`assertTaskFlow` / `assertExtractionTemplate` + 17 个单测 |
| ~~P2~~ | ~~`loadDirectory` 重复 id 跨文件冲突给 warning issue~~ | — | ✅ 已存在：`insertEntry` 以 error issue 上报且不覆盖 |
| ~~P2~~ | ~~`yclaw lint` 增加 SARIF 输出~~ | TAC-03 | ✅ 已完成：`--format sarif` 输出 SARIF 2.1.0；`tests/unit/cli/lint.spec.ts` 加 2 用例覆盖 results / 空 results |
| ~~P2~~ | ~~Watcher 大目录 / 高频变更压力测试；Windows 路径分隔符测试~~ | 健壮性 | ✅ 已补充：`tests/unit/serialization/watcher.spec.ts` 新增反斜杠路径用例（透传、不产生伪 add/remove） |
| ~~P3~~ | ~~类型双轨同步检查（File schema vs 运行时 TaskFlow）~~ | 维护性 | ✅ 已完成：[schema-lock.spec.ts](../../tests/unit/serialization/schema-lock.spec.ts) 锁定 TaskFlow / TaskFile.spec / TaskStep / ExtractionTemplate / TemplateFile.spec 字段集，附 round-trip + 运行时字段不泄漏断言；任一侧字段漂移时测试给出 missing/extra 列表 |
| P3 | 模板包打包发布（独立 spec） | 非目标→后续 | 见本文 §2 非目标 |

### 🔍 2026-04-20 二轮 review 新增项

> 三个 P0（Persistence 适配 / 主进程装配 / preload 暴露）落地后的代码 review 发现，按严重程度补充。

| 优先级 | 项 | 关联 | 备注 |
| --- | --- | --- | --- |
| ~~P1~~ | ~~`App.shutdown` 未 await `taskAsCode.dispose()`~~ | bootstrap | ✅ 已完成：`shutdown()` 改为 `.catch(logService.error)` 兜底，watcher 关闭异常落入日志 |
| ~~P2~~ | ~~异步 `findExisting*CreatedAt` 钩子并发导入未覆盖~~ | TAC-02 | ✅ 已完成：[service-idempotency-concurrent.spec.ts](../../tests/unit/serialization/service-idempotency-concurrent.spec.ts) 注入带 5ms 延迟的异步钩子并 `Promise.all([importPath, importPath])`，断言 createdAt 不漂移；附钩子 reject 不泄漏用例 |
| ~~P2~~ | ~~`timestampsFor` 用 falsy 判断 `existingCreatedAt`~~ | TAC-02 | ✅ 已完成：改为 `existingCreatedAt == null \|\| === ''`；`Persistence` 接口 JSDoc 写明「null/undefined/空串 = 不存在；抛异常会被吞并视为不存在」 |
| ~~P2~~ | ~~Watch handle 无 TTL / 最大数限制~~ | TAC-07 | ✅ 已完成：`createTaskAsCodeHandlers` 接受 `maxWatches`（默认 32）+ `watchTtlMs`（默认 24h，0 = 永不过期）+ 注入 `setTimer/clearTimer`；3 个新测：超额 reject、TTL auto-stop、watchStop 清 TTL |
| ~~P2~~ | ~~`unwrap` 错误信息回退过于通用~~ | 渲染端 | ✅ 已完成：缺 `error.message` 时回退为 `IPC call failed (<code>)`，code/message 都缺时退化为旧 `IPC call failed`；2 个边界用例覆盖 |
| ~~P3~~ | ~~`TaskRepository.saveTaskFlow` 双写文档化~~ | TAC-02 | ✅ 已完成：方法上方加 JSDoc 说明 `flow_json` 仅存 `{ steps }`，与归一化 `task_steps` 表的关系 |

### 📌 仍未完成（汇总，按优先级排序）

落地后剩余工作：

1. **P1** UI 导入/导出按钮（任务中心 + 模板中心）— 调用 `window.api.taskAsCode.*`
2. **P3** 模板包打包发布（独立 spec）

> 注：原 11 项中其余 9 项已于 2026-04-20 第三轮 implement-loop 全部清空（README quick-start、SARIF、Windows 路径、并发钩子、timestamps 显式判定、TTL/maxWatches、unwrap 提示、saveTaskFlow 注释、App.shutdown await dispose）。

### 🔍 2026-04-20 三轮 review 新增项

> 二轮 9 项落地后再做的全量代码 review，按严重度排序。所有 ✅ 项已在本轮一并修掉。

| 优先级 | 项 | 文件 | 状态 |
| --- | --- | --- | --- |
| ~~P1~~ | ~~SARIF `ruleId` 由 `tac.${issue.path}` 拼接，含中文 / `:` / `/` 时违反 SARIF 2.1.0 命名规范~~ | [src/cli/lint.ts](../../src/cli/lint.ts) | ✅ 已修：unsafe 字符 → `_`；新增「ruleId 仅含 `[A-Za-z0-9._-]`」断言 |
| ~~P1~~ | ~~SARIF `driver.informationUri` 是 `your-org` placeholder~~ | [src/cli/lint.ts](../../src/cli/lint.ts) | ✅ 已修：替换为仓库主页 |
| ~~P1~~ | ~~README 用 `npx yclaw …` 但 package.json 无 `bin` 字段，会报 not found~~ | [README.md](../../README.md) | ✅ 已修：改为 `npm run yclaw -- …`；同时补 SARIF 用法 |
| ~~P2~~ | ~~`unwrap` 中 `code` 为空字符串时会渲染成 `IPC call failed ()`~~ | [src/renderer/shared/api/taskAsCode.ts](../../src/renderer/shared/api/taskAsCode.ts) | ✅ 已修：`hasCode = typeof===string && length>0`；补「空 code = no parens」边界用例 |
| ~~P2~~ | ~~`disposeAll` 测试只验证 `stop()` 调用，未验证 `clearTimer` 被调用~~ | [tests/unit/ipc/task-as-code-handlers.spec.ts](../../tests/unit/ipc/task-as-code-handlers.spec.ts) | ✅ 已修：新增「disposeAll clears every live TTL timer」用例 |
| P2 | `App.shutdown` 仍是同步签名 + `.catch()`，`app.on('before-quit')` 在 dispose Promise 解决前可能已退出（macOS 通常不会触发，但 Linux/CI headless 退出可能截断 watcher 日志） | [src/main/app.ts](../../src/main/app.ts) · [src/main/index.ts](../../src/main/index.ts) | ⏳ 仍未做：拟改为 `async shutdown()` + `before-quit` 用 `event.preventDefault() → await … → app.exit()`，需配合现有 trayService/tabManager 的同步关闭语义同步演进 |
| P3 | `watchStart` 在 `await service.watchDirectory` 之间未二次校验 `maxWatches`（JS 单线程实际无 race，但偏防御性） | [src/main/ipc/task-as-code-handlers.ts](../../src/main/ipc/task-as-code-handlers.ts) | ⏳ 仍未做：可在 `await` 后再判 size，超额则 `await handle.stop()` 兜底 |
| P3 | 同步 `findExisting*CreatedAt` 钩子的并发场景未单独覆盖 | [tests/unit/serialization/](../../tests/unit/serialization/) | ⏳ 仍未做：现有测试已覆盖异步路径；同步路径在 SQLite 真实场景才有意义 |

### 📌 仍未完成（汇总，按优先级排序，2026-04-20 三轮 review 后）

落地后剩余工作：

1. **P1** UI 导入/导出按钮（任务中心 + 模板中心）— 调用 `window.api.taskAsCode.*`
2. **P2** `App.shutdown` 改 async + `before-quit` 真正等待 dispose 完成（review 三轮新增）
3. **P3** `watchStart` 二次 maxWatches 防御性校验（review 三轮新增）
4. **P3** 同步 `findExisting*CreatedAt` 钩子并发用例（review 三轮新增，可选）
5. **P3** 模板包打包发布（独立 spec）


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
| TAC-02 | 导入 YAML 后能完整恢复 DB 记录，幂等（重复导入仅 upsert，且保留原 `createdAt`）。 |
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
