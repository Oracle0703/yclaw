# `@shared/serialization` — Task-as-Code v1

任务/模板的「文件层」表示与运行时模型之间的桥梁。详见
[docs/specs/task-as-code-v1.md](../../../docs/specs/task-as-code-v1.md)。

## 模块结构

| 文件          | 职责                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| `types.ts`    | 文件层 TypeScript 类型与 `SCHEMA_VERSION` 常量。**与运行时类型解耦**。       |
| `validate.ts` | 不依赖 zod 的 schema 校验，提供 `validateFile` / `assertValidFile`。         |
| `secrets.ts`  | 敏感字段的 `${env:VAR}` 引用解析与反向派生。                                 |
| `yaml.ts`     | 安全的 YAML 编解码（关闭 merge keys、开启 uniqueKeys）。                     |
| `mapping.ts`  | `TaskFile ↔ TaskFlow`、`TemplateFile ↔ ExtractionTemplate` 的纯函数转换。 |
| `loader.ts`   | 目录扫描、文件加载与跨文件 `templateRef` 引用检查（TAC-05）。             |
| `migrate.ts`  | schemaVersion 迁移框架（TAC-06）：`migrateFile`、`MAX_MIGRATION_STEPS`。 |
| `watcher.ts`  | 目录文件监听器（TAC-07）：`createWatcher` 防抖聚合 added/changed/removed。 |
| `service.ts`  | 高层 facade `TaskAsCodeService`：importPath / exportTask / watchDirectory。 |
| `index.ts`    | 公共 API facade。                                                            |

## 典型流程

```
YAML 文本 ──parseFile──▶ AnyFile ──taskFromFile──▶ TaskFlow ──TaskService──▶ DB
                                  └─templateFromFile──▶ ExtractionTemplate

DB ──TaskService──▶ TaskFlow ──taskToFile──▶ TaskFile ──serializeFile──▶ YAML 文本
```

## 安全约束

- 任何 `secrets[*]` 必须形如 `${env:VAR_NAME}`；明文密钥会被 `validate` 拒绝。
- YAML 解析强制 `merge: false` + `uniqueKeys: true`，避免 schema 注入。
- 所有外部输入必须经 `parseFile` 或 `lintFile`，不要绕过 `validate`。

## CLI

代码在 [`src/cli/`](../../cli/)。最常用的是：

```bash
npm run yclaw -- lint examples/tasks --format json
npm run yclaw -- lint examples/tasks --check-refs
npm run yclaw -- lint legacy-task.yaml --migrate
npm run yclaw -- import examples/tasks --out build/imported   # YAML → JSON
npm run yclaw -- export build/imported/t1.task.json --out build/exported  # JSON → YAML
npm run lint:tasks   # 快捷方式，默认 lint examples/tasks
```

退出码：`0` 全部通过；`1` 有错误（或 `--strict` 下有警告）；`2` 参数/IO 错误。
