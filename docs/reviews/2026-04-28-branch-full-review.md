# 分支 `feature/hy/全局loading状态` 全量 Review 与修复记录

日期：2026-04-28
范围：当前分支相对 `origin/main` 的全部代码与文档（不含 `release/`、`release-core/`、`release-sizecheck*/` 构建产物）。

## 1. 基线快照

- 与 `origin/main` 的累计差异：**472 文件 +80,427 / −9,309**。
- 受影响范围（高频）：
  - `src/main/services/`、`src/main/services/repositories/`、`src/main/services/data-center/`、`src/main/services/runner-scheduler/`：服务/仓储/调度全面重构。
  - `src/renderer/entries/{workbench,browser,stock,plugin-center,data-center,automation}/`：多入口完整化。
  - `src/shared/serialization/`、`src/shared/types/`：Task-as-Code、远端 Runner 类型。
  - `docs/{architecture,specs,plans,design,reviews,superpowers}/`：文档结构归档完成。

## 2. 工程基线问题（已修）

| #   | 文件                                                      | 现象                                                                   | 修复                                                                                                      |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | `tsconfig.renderer.json`                                  | `include` 缺 `src/vite-env.d.ts`，导致 3 处 `ImportMeta.env` 报 TS2339 | 把 `src/vite-env.d.ts` 加入 `include`。                                                                   |
| 2   | `tests/unit/scripts/ensure-dev-runtime-utils.test.ts`     | 顶层 `require()` 触发 `@typescript-eslint/no-require-imports`（错误）  | 改为 `createRequire(import.meta.url)`。                                                                   |
| 3   | `src/renderer/shared/components/AppProviders.tsx`         | 用户手动注释了 FloatButton 主题切换块，遗留 5 个未用 import            | 删除 `FloatButton`、`Tooltip`、`BulbOutlined`、`MoonOutlined`、`SunOutlined` 引入。                       |
| 4   | `tests/unit/scripts/dev.test.ts`                          | 4 个 spy 变量声明但未引用                                              | 改为不绑定变量，仅做副作用。                                                                              |
| 5   | `tests/unit/services/repositories/TaskRepository.test.ts` | 仓储新增 `enabled` / `tags_json` 列后断言未同步                        | 期望 INSERT 参数追加 `1` / `'[]'`；`getTasks` / `getTaskFlow` 期望对象补齐 `enabled: true` / `tags: []`。 |

## 3. 跨平台 Bug（已修）

`src/shared/serialization/loader.ts` 的 `normalizeInjectedPaths` 使用硬编码 POSIX 分隔符 `/`：

```ts
// 修复前
const rootWithSep = absRoot.endsWith('/') ? absRoot : `${absRoot}/`;
```

在 Windows 上 `path.resolve` 返回 `\` 路径，导致：

- `endsWith('/')` 永假；
- 拼接出的 `rootWithSep = C:\path/` 与真实 `abs = C:\path\sub\file.yaml` 不匹配；
- **`listFiles` 注入的合法相对路径会被全部误判为 escape rootDir**，最终 `Registry.tasks` 为空。

修复：改用 `node:path` 的 `sep` 常量。这是一个会影响 Windows 下 Task-as-Code 加载器的真实回归。

## 4. 测试稳健性（已修）

`symlinkSync` 在 Windows 默认权限下抛 `EPERM`。受影响的测试文件已按项目既有约定（参考 `service-security.spec.ts`）增加 `try/catch` 跳过：

- `tests/unit/cli/io-security.spec.ts`（2 处）
- `tests/unit/cli/lint-security.spec.ts`（2 处）
- `tests/unit/serialization/loader-security.spec.ts`（1 处）
- `tests/unit/serialization/loader.spec.ts`（2 处）

行为保持不变：在支持 symlink 的平台仍然完整断言安全语义；在受限平台优雅跳过避免噪音失败。

## 5. 验证

```
npx tsc -p tsconfig.main.json     --noEmit  # ✅
npx tsc -p tsconfig.preload.json  --noEmit  # ✅
npx tsc -p tsconfig.renderer.json --noEmit  # ✅
npm  run lint                                # ✅ 0 problems
npx  vitest run                              # ✅ 194 files / 1256 tests, 0 fail
```

> 备注：`better-sqlite3` 在装机/重装时被 `electron-builder install-app-deps` 编译为 Electron ABI（145）；首次跑 `vitest`（Node ABI 115）会失败。`scripts/ensure-node-native-deps.cjs` 已会自动 `npm rebuild`，但若本机缺 VS Build Tools 则无法编译。建议在 CI/本地环境单独安装 prebuild：`(cd node_modules/better-sqlite3 && npx prebuild-install --runtime node --target <node 版本>)`。

## 6. 仍待持续观察的非阻塞项

- `src/main/services/SchedulerService.ts:27` 仍有 TODO（`once`/`cron` 调度器待替换）。当前仅服务于自测；应在 `task-operations-center-v1` 落地时统一升级。
- `src/main/utils/paths.ts` 的 `eval('typeof require === ...')` 是 ESM/CJS 桥接技巧（非安全风险），但建议在 `tsconfig.main.json` 切到纯 ESM 后移除以减少静态分析告警面。
- `vitest.workspace.ts` 与 `vitest.config.ts` 同时存在，会触发 Vite CJS 弃用警告（仅 stderr 噪音，不影响功能）。后续可统一为单一 ESM 配置文件。

## 7. 结论

- 分支基线：**typecheck / lint / unit tests 全绿**。
- 修复了 1 个跨平台真实回归（loader 的 Windows 路径分隔符）+ 6 个工程/测试一致性缺陷。
- 文档结构（`docs/{overview,architecture,product,design,specs,plans,reviews,superpowers}`) 已完成由扁平到分层的迁移，README.md 与 architecture.md 串联完整。
- 未发现 `dangerouslySetInnerHTML` / `eval` / 注入类高危用法。
