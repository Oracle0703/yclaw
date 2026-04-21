# Task-as-Code 工作流 · 代码审查记录（2026-04-20）

> 范围：`src/shared/serialization/`、`src/cli/`、`src/main/ipc/task-as-code-handlers.ts`、对应 `tests/unit/`、[docs/specs/task-as-code-v1.md](../specs/task-as-code-v1.md)。
> 当前状态：TS 0 / Vitest **246 用例 (25 文件) 全绿** / `lint:tasks` 0。
> 更新记录：2026-04-20 首于本文检查后发现 § 1 / § 2 / § 4 中部分条目与实际代码不符，已在原位标记。

## 1. 模块级问题（按文件）

| 文件 | 问题 | 严重度 | 状态 |
| --- | --- | --- | --- |
| `src/shared/serialization/validate.ts:90-120` | id 长度上限 64，但 name 200 / description 2000，量级不一致；建议在文档中说明 | 低 | 未处理 |
| ~~`loader.ts`（同 id 静默覆盖）~~ | **误报**：`insertEntry` 已以 error issue 记录重复 id 且保留首次出现；有专门单测 [loader.spec.ts L124](../../tests/unit/serialization/loader.spec.ts) | — | 已冲销 |
| `src/shared/serialization/service.ts:112,116` | `Persistence.upsert*` 失败仅靠抛错传递，未在文档强调 contract | 低 | 未处理 |
| ~~`task-as-code-handlers.ts:exportYaml` payload 未校验~~ | 已加 `assertTaskFlow` / `assertExtractionTemplate` 运行时守卫 + 17 个单测 | — | 已修复 |
| `src/cli/io.ts`（`checkRefs` 路径） | 仅当 inputs.length===1 且为目录时启用，CLI help 未说明 | 低 | 未处理 |

## 2. 跨模块问题

- **错误处理不统一**：loader 抛错 / validate 返回 issues / service 混合两者；建议用户面 API 统一为「issues 累积 + 仅程序错误抛出」。
- **类型双轨**：`*File`（schema 形态）与运行时形态（`TaskFlow` / `ExtractionTemplate`）独立维护，缺一条 round-trip 锁定测试。
- ~~**IPC 边界校验薄弱**~~：已加 `exportYaml.payload` 运行时结构守卫（`assertTaskFlow` / `assertExtractionTemplate`）。Ⓟ
- **幂等性 (TAC-02) 未端到端测试**：单测层面只能 stub Persistence；缺一组「同一文件两次 importPath，断言 createdAt 不变」。

## 3. 验收标准对照表（TAC-01..08）

| 编号 | 状态 | 缺口 |
| --- | --- | --- |
| TAC-01 导出为 YAML | ✅ | — |
| TAC-02 幂等导入 | ⚠️ 局部 | Repository 未对接、缺端到端幂等测试 |
| TAC-03 lint 命令 | ⚠️ 局部 | SARIF 输出未实现（目前仅 text/json） |
| TAC-04 敏感字段 env 引用 | ✅ | — |
| TAC-05 跨文件引用 | ✅ | — |
| TAC-06 schema 迁移 | ✅ | — |
| TAC-07 监听目录 | ✅ | UI 开关未接入（属 UI 层缺口） |
| TAC-08 文档/示例 | ⚠️ 局部 | 根 README 「Task-as-Code 用法」章节缺失 |

## 4. 测试覆盖缺口

1. importPath 幂等性（同文件两次）。
2. ~~IPC 异常 payload（`exportYaml` 字段缺失/类型错）~~ — 已补齐（[task-as-code-payload.spec.ts](../../tests/unit/ipc/task-as-code-payload.spec.ts)）。
3. ~~`loadDirectory` 重复 id 行为~~ — 已存在（[loader.spec.ts L124](../../tests/unit/serialization/loader.spec.ts)）。
4. 大目录（接近 `LOADER_SAFETY.maxFiles`）压力。
5. Watcher 高频变更（90+ 改动）防抖语义。
6. Windows 路径分隔符兼容（当前仅 POSIX）。
7. 用户手动加明文 secret 后 `validate` 是否拒绝（端到端）。

## 5. 未完成任务总览（按优先级）

详见 [specs/task-as-code-v1.md §「待实施 / 待补强」](../specs/task-as-code-v1.md#实施进度当前)。摘要：

- **P0** 主进程装配 IPC handler；preload 暴露 `window.api.taskAsCode.*`；任务中心 Repository 适配 `Persistence`。
- **P1** UI 导入/导出按钮；根 README 用法章节；幂等性 e2e；IPC payload 结构校验。
- **P2** 重复 id warning；SARIF 输出；watcher 压测 + Windows 路径。
- **P3** 类型双轨 round-trip；模板包打包（后续 spec）。

## 6. 立即可做的小改进建议

1. `loadDirectory` 检测重复 id，返回 `severity: 'warning'` 的 ValidationIssue。
2. `task-as-code-handlers.exportYaml` 调用前用 `validateTaskFile` / `validateTemplateFile` 经 `taskToFile` 后再校验一次，把异常包成 IPC 友好错误。
3. 根 README 增加 5 行 quick-start：`npm run yclaw -- export task <id>` / `npm run yclaw -- lint <dir>` / `npm run yclaw -- import <file>`。
