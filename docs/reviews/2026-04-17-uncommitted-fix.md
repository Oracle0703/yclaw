# YClaw 未提交改动 · 修复报告（2026-04-17）

> 对应的审查文档：[YClaw*未提交改动*代码审查报告\_2026-04-17.md](YClaw_未提交改动_代码审查报告_2026-04-17.md)
>
> 本次修复针对三轮深度审查中发现的 **2 个 P0 + 2 个 P1 + 1 个 P2 + 1 个 P2（安全）** 问题，均已落盘并通过回归。

---

## 1. 验证结果

| 动作                | 结果                                      |
| ------------------- | ----------------------------------------- |
| `npm run typecheck` | ✅ 0 error                                |
| `npx vitest run`    | ✅ **77 files / 579 tests 全通过**        |
| 回归前基线          | 77 files / 578 tests（新增 1 条版本回归） |

---

## 2. 修复明细

### 2.1 [P0] AIRepository 参数协议与 DatabaseService.run 不兼容

**文件**：[src/main/services/repositories/AIRepository.ts](../src/main/services/repositories/AIRepository.ts)

**改动**：

- `AIRepositoryExecutor.run` 的 `params` 从 `unknown` 改回 `unknown[]`，明确契约。
- `saveAIConversation` / `saveAIMessage` 的 SQL 占位符从 `@命名参数` 改为 `?` 位置参数，并以数组传递，与其余 8 个 Repository 完全一致。
- 同步调整 [tests/unit/services/repositories/AIRepository.test.ts](../tests/unit/services/repositories/AIRepository.test.ts) 的断言为数组形式。

**根因**：`DatabaseService.run` 实现使用 `stmt.run(...params)`，对普通对象做 spread 会立即抛 `TypeError: Spread syntax requires ...iterable[Symbol.iterator] to be a function`。经 Node 直接复现确认。

**影响**：任何 AI 对话入库路径（新建对话、保存消息、删除对话）都会在生产崩溃，测试未覆盖。

---

### 2.2 [P0] 功能包入口路径与 Vite 实际产物不一致

**文件**：[src/main/services/FeaturePackageService.ts](../src/main/services/FeaturePackageService.ts)

**改动**：

- 新增私有方法 `resolveEntryFile(targetDir, moduleName)`：
  - 首选 `entries/<module>/index.html`（与当前 Vite `feature` 模式产物匹配，`resources/feature-packs/automation/entries/automation/index.html` 已验证）。
  - 回退兼容历史 `renderer/entries/<module>/index.html`，避免老包升级白屏。
- `installPackage` 改用 `resolveEntryFile` 做断言与持久化 `entryPath`。
- 同步更新 [tests/unit/services/FeaturePackageService.test.ts](../tests/unit/services/FeaturePackageService.test.ts) 的测试目录为真实产物结构。

**根因**：Vite 以 `src/renderer` 为 root，入口 `src/renderer/entries/<module>/index.html` 构建后输出至 `entries/<module>/index.html`，但旧实现期望 `renderer/` 前缀，导致"安装功能包"必定失败。老测试用手工目录迎合了错误实现。

---

### 2.3 [P1] Manifest 默认路径在打包后无效

**文件**：[src/main/services/FeaturePackageService.ts](../src/main/services/FeaturePackageService.ts)

**改动**：

- 替换 `DEFAULT_MANIFEST_PATH = path.resolve(process.cwd(), …)` 为 `resolveDefaultManifestPath()`，按优先级查找：
  1. `YCLAW_FEATURE_MANIFEST_PATH` 环境变量
  2. `process.resourcesPath/resources/feature-manifest.json`
  3. `process.resourcesPath/feature-manifest.json`
  4. `process.cwd()/resources/feature-manifest.json`（开发/源码运行）
- 若均不存在，返回优先级最高的候选，便于下游看到更具诊断性的错误提示。

**根因**：Electron 打包后 `process.cwd()` 通常不是应用目录（可能是 `System32`），导致 `FeaturePackageService` silently 退化为空 manifest，连锁引发 `resolveRendererUrl()` 白屏。

---

### 2.4 [P1] listPackages spread 顺序导致版本号被旧安装状态覆盖

**文件**：[src/main/services/FeaturePackageService.ts](../src/main/services/FeaturePackageService.ts)

**改动**：

```diff
- return { ...pkg, ...state, installed };
+ return { ...state, ...pkg, installed };
```

使 manifest 元数据（`version`、`displayName`、`description` 等）拥有最终话语权；同时补充内联注释说明意图。

**新增回归测试**：`tests/unit/services/FeaturePackageService.test.ts` → `"lets manifest version override stale persisted install state"`，断言历史安装状态 `version: '0.9.0-legacy'` 不会覆盖 manifest 当前 `1.0.0`。

---

### 2.5 [P2] dist-win-core 同步前未清理稳定 nsis-web 目录

**文件**：[scripts/dist-win-core.ts](../scripts/dist-win-core.ts)

**改动**：在 `copyDirectoryContents` 之前先 `rmSync(paths.stableNsisWebDir, { recursive: true, force: true })`，消除跨版本残留（`*.nsis.7z`、`*.blockmap`）污染 `electron-updater` 差分校验的风险。

---

### 2.6 [P2] FeaturePackageService.downloadFile 无防护

**文件**：[src/main/services/FeaturePackageService.ts](../src/main/services/FeaturePackageService.ts)

**改动**：

- 新增 `DOWNLOAD_TIMEOUT_MS = 30_000`，通过 `request.setTimeout` 主动断流。
- 新增 `MAX_DOWNLOAD_REDIRECTS = 5`，拒绝恶意构造的无限 302 重定向。

---

## 3. 遗留观察（本轮不修，已在 review 文档 §5 标注）

| 级别 | 项目                                                                                   | 建议处理时机                     |
| ---- | -------------------------------------------------------------------------------------- | -------------------------------- |
| P3   | `DatabaseService.getInstance()` 单例残留                                               | 下一次 Repository 清理迭代时删除 |
| P3   | `TaskService.updateTaskFlow` 对 `schedule: null` 写入字符串 `"null"`                   | 与调度功能正式上线时统一修       |
| --   | `FeatureModulePage` 在用户点击"打开独立窗口"时若包未安装，会直接抛错；建议改为引导安装 | UX 优化迭代                      |

---

## 4. 文件变更清单

- 修改：`src/main/services/repositories/AIRepository.ts`
- 修改：`src/main/services/FeaturePackageService.ts`
- 修改：`scripts/dist-win-core.ts`
- 修改：`tests/unit/services/repositories/AIRepository.test.ts`
- 修改：`tests/unit/services/FeaturePackageService.test.ts`（新增 1 条版本回归 test）
- 新增：`docs/reviews/2026-04-17-uncommitted-review.md`
- 新增：`docs/reviews/2026-04-17-uncommitted-fix.md`（本文件）

---

## 5. 后续建议

1. 在 CI 中加一条 "install feature package in packaged app smoke test"，直接跑打包后产物去安装一次 `stock`，可防止此类 vite-产物/运行期路径脱节问题再次复现。
2. 将 `AIRepository` 的命名参数习惯（以及其他 Repository）在一条 lint 规则或单元测试中固化（例如：`grep_search` 禁止 `@\w+` 形式出现在 `repositories/`），配合一个"非数组 params 视为非法"的 DatabaseService 防御性断言。
3. 为 `FeaturePackageService` 的 manifest 路径查找补一份集成测试，分别模拟 dev / 打包后（覆盖 `process.resourcesPath`）两套环境。
