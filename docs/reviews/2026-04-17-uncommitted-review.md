# YClaw 未提交改动 · 代码审查报告（2026-04-17）

> 审查范围：当前工作树全部未提交改动（110 个文件），包括：
>
> 1. `DatabaseService` → Repository 拆分（TaskRepository / AIRepository 等）
> 2. 全链路显式依赖注入（EventBus / PermissionChecker / Repository 等）
> 3. 包体积优化 —— 核心在线包 + 功能包（stock/automation/plugin-center）拆分
> 4. 正式核心打包稳定性（`release-core/<runId>` 分离输出 + 稳定同步到 `release/nsis-web`）
> 5. 渲染层 Pro 组件解耦与新 `FeatureModulePage`
>
> 审查基线：`npx vitest run` → **77 files / 578 tests 全部通过**。所有缺陷均未被现有测试覆盖。
>
> 审查方式：三轮深度 loop（架构与 DI → Repository/Service 逻辑 → FeaturePackage/打包/渲染层），对照 `docs/specs/v1.0-baseline.md`、`docs/architecture/architecture.md`、`docs/architecture/structure.md`、`docs/design/package-size-optimization.md`、`docs/superpowers/plans/2026-04-17-database-service-repository-split.md`。

---

## 1. 问题总览

| #   | 严重程度 | 领域           | 结论                                                                                                       |
| --- | -------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | **P0**   | Repository/DB  | `AIRepository` 用对象命名参数，经 `DatabaseService.run(...params)` spread 崩溃                             |
| 2   | **P0**   | FeaturePackage | 功能包入口路径拼错：实际产物是 `entries/{module}/…`，代码仍找 `renderer/entries/…`                         |
| 3   | **P1**   | FeaturePackage | `DEFAULT_MANIFEST_PATH` 用 `process.cwd()`，生产安装包里拿不到 manifest                                    |
| 4   | **P1**   | FeaturePackage | `listPackages()` spread 顺序错误，已安装历史版本会覆盖 manifest 当前版本                                   |
| 5   | P2       | Core 打包      | `dist-win-core.ts` 同步到 `release/nsis-web` 时没清理旧产物，残留 blockmap/7z 可能导致更新校验失败         |
| 6   | P2       | FeaturePackage | `downloadFile` 无超时 / 无签名校验 / 无重定向上限，未来启用远程 source 时是供应链风险                      |
| 7   | P3       | 代码清洁度     | `DatabaseService.getInstance()` 已不再使用但未删除，容易被新代码误复用                                     |
| 8   | P3       | TaskService    | `updateTaskFlow` 中 `payload.schedule === null` 被序列化成字符串 `"null"`（可被 parseJson 吃掉，影响可控） |

---

## 2. Loop 1 · 架构与 DI 一致性

| 观察                                                                                                                                | 评价         |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `App` 中显式注入 `EventBus`/`TaskRepository`/`ConfigService`/`permissionChecker` 等，并与 `AppComposition.test.ts` 双向校验         | ✅           |
| 所有服务均在构造时抛 `xxx is required`，把隐式单例耦合切断，符合 `plans/2026-04-17-database-service-repository-split.md` 的迁移目标 | ✅           |
| Repository 层只暴露领域 API，主 `DatabaseService` 保留为通用连接层                                                                  | ✅           |
| `DatabaseService.getInstance()` 仍残留，但 `App` 走 `new DatabaseService()`。两套入口并存会在后续被误用                             | ⚠️ 见问题 #7 |
| `WindowManager.resolveRendererUrl` 通过可选回调注入，`App` 侧桥接 `FeaturePackageService.resolveRendererUrl`                        | ✅           |

---

## 3. Loop 2 · Repository / Service 逻辑漏洞

### 3.1 [P0] `AIRepository` 与 `DatabaseService.run` 的参数协议不兼容

**现象**

```ts
// src/main/services/repositories/AIRepository.ts
this.executor.run(
  `INSERT INTO ai_conversations (...) VALUES (@id, @title, @createdAt, @updatedAt) ...`,
  { id, title, createdAt, updatedAt }, // ← 传的是普通对象
);
```

`DatabaseService.run` 的实现：

```ts
run(sql: string, params?: unknown[]): Database.RunResult {
  const stmt = this.db!.prepare(sql);
  return params ? stmt.run(...params) : stmt.run();
  //                       ^^^^^^^^^^
  //                       对普通对象做 spread 会抛
  //                       "Spread syntax requires ...iterable[Symbol.iterator] to be a function"
}
```

node 层验证：

```
ERROR: Spread syntax requires ...iterable[Symbol.iterator] to be a function
```

**触发面**：

- `AIService.chat` 每次保存对话/消息、`AIService.deleteConversation` 都会命中；
- 用户在产品中发第一条 AI 消息即崩溃。

**测试为何没抓到**：`AIRepository.test.ts` 里的 `run` 被 mock 成 `vi.fn()`，不关心参数类型是否可迭代。

**定位方式**：`grep_search` 全仓 `@named` 参数只在 `AIRepository` 出现，其他 Repository 全部是位置参数 `?` + 数组，与 `DatabaseService` 契约一致。

---

### 3.2 [P3] `TaskService.updateTaskFlow` 对 `schedule = null` 的语义

当调用方显式传 `schedule: null` 希望清空调度时：

```ts
scheduleJson: payload.schedule !== undefined ? JSON.stringify(payload.schedule) : undefined,
```

`JSON.stringify(null)` → `'null'` 字符串，写入 DB；读回时 `parseJson` 能还原成 `null`，结果可用但数据列里存的是字面量 `"null"`，对 SQL 查询/导出都是陷阱。建议清空时应写 `null` 本身。

---

### 3.3 其他已验证安全的点

- `BatchRepository.insertBatch` 中 `options?.reason || options?.sourceBatchId ? ... : null` 运算符优先级正确。
- `TemplateRepository.deleteTemplate` 把清空任务 `template_id` 与 `DELETE` 放在同一事务内，避免孤儿约束。
- `DatabaseService` 迁移 3 使用 `BEGIN / COMMIT` 包住多 `ALTER TABLE`，可复现运行。

---

## 4. Loop 3 · FeaturePackage / 打包 / 渲染层

### 4.1 [P0] 功能包入口路径与 Vite 实际产物不一致

**产物实况**（当前工作树 `resources/feature-packs/automation/`）：

```
entries/automation/index.html
assets/...
```

**但代码里的断言**（`FeaturePackageService.installPackage`）：

```ts
const entryPath = path.join(targetDir, 'renderer', 'entries', pkg.module, 'index.html');
if (!fs.existsSync(entryPath)) {
  throw new Error(`Feature package "${id}" is missing entry file: ${entryPath}`);
}
```

`vite.config.ts` 中 `root: src/renderer`，入口 `src/renderer/entries/{module}/index.html`，构建后输出 `entries/{module}/index.html`（没有 `renderer/` 前缀）。`sync-feature-packs.ts` 原样拷贝到 `resources/feature-packs/{module}/`，所以装机后只有 `entries/{module}/index.html`。

**触发面**：用户点击工作台里 "安装功能包" → 必定抛 `missing entry file`，而这是 V1 核心在线包的主卖点路径。

**测试为何没抓到**：`tests/unit/services/FeaturePackageService.test.ts` 自己手工 `mkdirSync` 了 `source/renderer/entries/stock/index.html`，迎合了错误实现，没对照 `vite.config.ts` 真实输出。

**同样受影响的行**：`WindowManager.createWindow` → `resolveRendererUrl` → `pathToFileURL(entryPath)`，错误的 entry path 会引发白屏。

---

### 4.2 [P1] `DEFAULT_MANIFEST_PATH = path.resolve(process.cwd(), 'resources', 'feature-manifest.json')`

生产包里 `process.cwd()` 不是应用安装目录（典型 Windows 场景可能是 `C:\Windows\System32`），也不等于 `app.getAppPath()`、`process.resourcesPath`。`FeaturePackageService` 构造时 `loadManifest()` 会 silently 返回 `{ packages: [] }`（`existsSync` 判假），导致：

- `listPackages()` 返回空；
- `isManagedModule(stock)` 返回 `false`；
- `resolveRendererUrl()` 回退到 `getRendererUrl('stock')`，但核心包里根本没有该入口 → 白屏。

**修复策略**：让 App 层在构造时显式注入 manifest 路径，并以 `app.getAppPath()` / `process.resourcesPath` 为优先查找源。

---

### 4.3 [P1] `listPackages()` spread 把持久化版本号覆盖 manifest

```ts
return this.manifest.packages.map((pkg) => {
  const state = installedPackages[pkg.id];
  return {
    ...pkg, // pkg.version = 新 manifest 版本
    ...state, // state.version = 旧安装版本，会覆盖掉新版本
    installed,
  };
});
```

对应 `FeaturePackageCatalogItem` 类型虽然通过 `Omit<…,'version'>` 提示了意图，但运行时 spread 不受 Omit 约束。结果：

- 运维把 manifest 升级到 2.0.0，用户 UI 仍显示 1.0.0；
- 用户也不会被提示需要升级功能包。

---

### 4.4 [P2] `dist-win-core.ts` 未清理稳定 `release/nsis-web`

```ts
copyDirectoryContents(nsisWebSourceDir, paths.stableNsisWebDir);
```

仅合并覆盖，不删除历史版本遗留的 `*.nsis.7z` / `*.blockmap`。两次构建跨版本切换时，`latest.yml` 指向新 7z，但旧 7z / blockmap 残留，可能被 `electron-updater` 的差分下载误匹配，引起 "file corrupted"。建议拷贝前先 `rm -rf` 或白名单 sync。

---

### 4.5 [P2] `FeaturePackageService.downloadFile` 缺乏基本防护

- 未设置 `request.setTimeout`；
- 未限制重定向链深度（递归调用自身，攻击者可构造死循环）；
- 没有对下载内容做哈希/签名校验。

当前 manifest 未启用 URL 源，风险可控，但一旦开放需先补齐。

---

### 4.6 渲染层观察

| 点                                                                               | 结论                                                |
| -------------------------------------------------------------------------------- | --------------------------------------------------- |
| `FeatureModulePage` 使用 `requestSeqRef` 做 race-condition 防抖                  | ✅ 有对应 `FeatureModulePage.test.tsx` 回归         |
| `AdminPageLayout` / `PageShell` 移除 `@ant-design/pro-components`                | ✅ 对应 `BuildConfig.test.ts` 正向约束              |
| `openModuleWindow` 在功能包未装时会抛 `Feature package "stock" is not installed` | ⚠️ 需要在 UI 提示"请先安装功能包"，当前仅能捕获文案 |

---

## 5. 修复方案清单（按优先级）

| #   | 文件                                                             | 修复策略                                                          |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `src/main/services/repositories/AIRepository.ts`                 | 改用位置 `?` + 数组参数，与其余 Repository 保持一致               |
| 2   | `src/main/services/FeaturePackageService.ts`                     | entry path 校验 & 持久化改为 `entries/{module}/index.html`        |
| 2b  | `tests/unit/services/FeaturePackageService.test.ts`              | 同步修正预置目录结构                                              |
| 3   | `src/main/services/FeaturePackageService.ts` + `src/main/app.ts` | manifest 查找优先级：显式注入 > env > `resourcesPath` > `appPath` |
| 4   | `src/main/services/FeaturePackageService.ts`                     | `listPackages` 调整 spread 顺序，确保 manifest `version` 生效     |
| 5   | `scripts/dist-win-core.ts`                                       | 同步前清空 `release/nsis-web`（只清理 nsis-web，不动元数据目录）  |
| 6   | `src/main/services/FeaturePackageService.ts`                     | `downloadFile` 加 `request.setTimeout(30_000)` + 重定向计数上限   |

P3 级别（7、8）暂不修复，但在后续记入 `YClaw_修复报告_2026-04-17.md` 的"遗留项"。

---

## 6. 回归验证计划

- `npx vitest run tests/unit/services/repositories/AIRepository.test.ts`（新增：位置参数断言）
- `npx vitest run tests/unit/services/FeaturePackageService.test.ts`（同步新入口路径 & 新 manifest 路径）
- `npx vitest run`（全量，确保 578 tests 不退步）
- `npm run typecheck`
- `npm run lint`（覆盖 src/ + tests/）
