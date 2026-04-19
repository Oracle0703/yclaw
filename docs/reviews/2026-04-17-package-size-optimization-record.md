# YClaw 包体积优化记录（2026-04-17）

## 记录目的

| 项目 | 内容 |
| --- | --- |
| 目标 | 记录本轮包体积优化的背景、改动、验证命令、体积变化和已知风险 |
| 用途 | 后续排查安装包异常、功能包加载异常、依赖缺失、打包失败时对照定位 |
| 范围 | Windows 核心在线包、完整离线包、功能包拆分、核心渲染依赖、生产依赖裁剪、正式打包稳定性 |
| 主要产物 | `release/nsis-web/YClaw Web Setup 1.0.0.exe`、`release/nsis-web/yclaw-1.0.0-x64.nsis.7z`、`release/core-latest.json` |

## 优化前后总览

| 阶段 | Web 安装器 | 核心 payload `nsis.7z` | `win-unpacked` | `app.asar` | `app.asar.unpacked` | 说明 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 初始核心包 | 0.66 MB | 87.92 MB | 363.26 MB | 未单独记录 | 11.31 MB | 已拆出功能包，但 native 解包目录仍较大 |
| native 剪枝后 | 0.66 MB | 87.92 MB | 363.26 MB | 未单独记录 | 1.64 MB | `better-sqlite3` 解包目录只保留 `.node` |
| 核心移除 Pro 组件链路 | 0.66 MB | 87.69 MB | 355.79 MB | 125.42 MB | 1.64 MB | 核心路径不再直接或间接导入 `@ant-design/pro-components` |
| 前端库移出生产依赖 | 0.66 MB | 72.26 MB | 238.36 MB | 7.99 MB | 1.64 MB | `react/antd` 等渲染层库不再整包进入 `app.asar` |
| 生产依赖剪枝后 | 0.66 MB | 72.01 MB | 236.37 MB | 6.00 MB | 1.64 MB | 排除 `node_modules` 内类型、源码、测试、文档、示例 |
| 当前正式核心包 | 0.66 MB | 72.01 MB | 约 236.37 MB | 约 6.00 MB | 1.64 MB | `dist:win:core` 已改为稳定输出流程 |

## 阶段记录

### 1. 核心在线包 + 功能包拆分

| 项目 | 内容 |
| --- | --- |
| 目标 | 缩小首次下载体积，把重模块从核心包拆出 |
| 核心保留 | `workbench`、`browser`、`plugin-host`、主进程、必要资源 |
| 拆出模块 | `stock`、`automation`、`plugin-center` |
| 关键文件 | `vite.config.ts`、`package.json`、`electron-builder.yml`、`electron-builder.full.yml`、`resources/feature-manifest.json` |
| 运行机制 | 工作台进入拆出模块路由时显示功能包安装/启动页，由主进程安装功能包并加载入口 HTML |
| 验证点 | `npm run dist:win:core` 生成核心在线包，`npm run dist:win:full` 生成完整离线包 |

### 2. native 依赖解包目录剪枝

| 项目 | 内容 |
| --- | --- |
| 目标 | 避免 `better-sqlite3` 解包目录携带源码、构建中间产物和无关文件 |
| 关键文件 | `scripts/after-pack-prune.cjs`、`electron-builder.yml` |
| 实现 | `afterPack` 阶段仅保留 `node_modules/better-sqlite3/build/Release/better_sqlite3.node` |
| 结果 | `app.asar.unpacked` 从约 11.31 MB 降至 1.64 MB |
| 风险 | 不能删除 native `.node` 本体，否则 SQLite 加载失败 |

### 3. 核心路径移除 `@ant-design/pro-components`

| 项目 | 内容 |
| --- | --- |
| 目标 | 避免核心包引入 Pro 组件库，减少核心渲染 bundle |
| 替换范围 | `AdminPageLayout`、`PageShell`、`browser/App`、`Home`、`Settings`、浏览器下游面板 |
| 替换方式 | `ProLayout` → `Layout/Menu`，`PageContainer` → 普通容器，`ProCard` → `Card`，`ProTable` → `Table`，`ProForm` → `Form/Select/Switch` |
| 关键文件 | `src/renderer/shared/components/AdminPageLayout.tsx`、`src/renderer/shared/components/PageShell.tsx`、`src/renderer/entries/workbench/pages/Home.tsx`、`src/renderer/entries/workbench/pages/Settings.tsx`、`src/renderer/entries/browser/App.tsx` |
| 回归测试 | `tests/unit/config/BuildConfig.test.ts` 检查核心路径不得导入 `@ant-design/pro-components` |
| 结果 | 核心 `dist/renderer` 不再包含 `pro-components` vendor，`nsis.7z` 从 87.92 MB 降到 87.69 MB |

### 4. 前端库移出生产依赖

| 项目 | 内容 |
| --- | --- |
| 根因 | `electron-builder` 会把 `dependencies` 中的生产依赖复制进 `app.asar`，导致 `react/antd` 等已被 Vite 打包过的渲染层库又整包进入安装包 |
| 处理 | 将 `react`、`react-dom`、`react-router-dom`、`antd`、`@ant-design/icons`、`@ant-design/pro-components`、`zustand` 移到 `devDependencies` |
| 保留生产依赖 | `better-sqlite3`、`electron-log`、`electron-store`、`electron-updater`、`zod` |
| 关键文件 | `package.json`、`package-lock.json`、`tests/unit/config/BuildConfig.test.ts` |
| 回归测试 | 检查渲染层库只能出现在 `devDependencies`，不能回到 `dependencies` |
| 结果 | `app.asar` 从 125.42 MB 降至 7.99 MB，`nsis.7z` 从 87.69 MB 降至 72.26 MB |
| 注意 | 后续如果主进程真的运行时 `require/import` 某个库，必须留在 `dependencies` |

### 5. 生产依赖内容剪枝

| 项目 | 内容 |
| --- | --- |
| 目标 | 继续清理 `node_modules` 内运行时无价值文件 |
| 关键文件 | `electron-builder.yml`、`tests/unit/config/BuildConfig.test.ts` |
| 排除内容 | `*.d.ts`、`*.d.cts`、`*.d.mts`、`src/**/*.ts`、`src/**/*.tsx`、`tests`、`__tests__`、`docs`、`examples` |
| 结果 | `app.asar` 从 7.99 MB 降至 6.00 MB，`nsis.7z` 从 72.26 MB 降至 72.01 MB |
| 风险 | 不能盲目排除包的运行时 `.js/.cjs/.mjs` 文件，否则会造成生产运行时缺模块 |

### 6. 正式核心打包稳定性修复

| 项目 | 内容 |
| --- | --- |
| 问题 | Windows 下旧 `release/win-unpacked/resources/app.asar` 可能被进程锁住，导致 `electron-builder` 覆盖输出失败 |
| 处理 | `npm run dist:win:core` 改为每次输出到 `release-core/<runId>/`，再将 `nsis-web` 稳定产物同步回 `release/nsis-web/` |
| 关键文件 | `scripts/dist-win-core.ts`、`scripts/dist-win-core-utils.ts`、`package.json` |
| 元数据 | `release/core-latest.json` 记录最新真实输出目录、`win-unpacked` 路径和 `nsis-web` 路径 |
| 结果 | 正式 `npm run dist:win:core` 已能在旧 `release/win-unpacked` 被锁时继续成功产出核心安装包 |
| 注意 | `release-core/<runId>/win-unpacked` 是真实 unpacked 输出，`release/nsis-web` 是稳定分发目录 |

## 当前正式构建流程

| 命令 | 用途 | 输出 |
| --- | --- | --- |
| `npm run build:core` | 构建核心渲染入口 | `dist/renderer` |
| `npm run build:features` | 构建拆出的功能包 | `dist/features`、`resources/feature-packs` |
| `npm run build:main` | 构建 Electron 主进程 | `dist/main` |
| `npm run dist:win:core` | 构建核心在线包 | `release-core/<runId>/` + `release/nsis-web/` |
| `npm run dist:win:full` | 构建完整离线包 | `release/` |

## 关键验证命令

| 命令 | 用途 | 最近结果 |
| --- | --- | --- |
| `npx vitest run tests/unit/config/BuildConfig.test.ts` | 打包配置、依赖边界、核心路径回归测试 | 通过 |
| `npx vitest run tests/unit/config/BuildConfig.test.ts tests/unit/scripts/dist-win-core-utils.test.ts` | 核心打包稳定脚本回归测试 | 19 passed |
| `npm run typecheck` | TypeScript 全量类型检查 | 通过 |
| `npm run lint` | ESLint 检查 | 通过 |
| `npm test` | 全量测试 | 通过，最近记录 72 files / 523 tests |
| `npm run build` | 完整生产构建 | 通过 |
| `npm run dist:win:core` | 正式核心在线包 | 通过 |

## 当前已知边界

| 项目 | 说明 |
| --- | --- |
| 剩余大头 | 主要是 Electron Runtime：`YClaw.exe`、`icudtl.dat`、`LICENSES.chromium.html`、`libGLESv2.dll`、`resources.pak`、`vk_swiftshader.dll` |
| 不建议删除 | `icudtl.dat`、`resources.pak`、`LICENSES.chromium.html`、主 EXE、native `.node` |
| 可继续评估 | 核心路径去 `antd`、Browser 功能包化、包级白名单、单语言发行 |
| 高风险方向 | 裁剪 SwiftShader/Vulkan、自定义编译 Electron、压缩/加壳 EXE |
| 文件锁处理 | 不再依赖删除旧 `release/win-unpacked`，而是用 `release-core/<runId>` 规避 |

## 后续排查对照

| 现象 | 优先检查 |
| --- | --- |
| 核心包体积突然回升 | `package.json` 是否把渲染层库放回 `dependencies`；`tests/unit/config/BuildConfig.test.ts` 是否失败 |
| 核心包又出现 Pro vendor | 核心路径是否重新导入 `@ant-design/pro-components` |
| 生产运行时报缺模块 | `electron-builder.yml` 的 `node_modules` 排除规则是否误删运行时 JS；对应包是否应留在 `dependencies` |
| SQLite 启动失败 | `app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node` 是否存在 |
| 功能包打不开 | `resources/feature-manifest.json`、`resources/feature-packs/`、`FeaturePackageService` 入口解析 |
| `dist:win:core` 找不到 unpacked | 查看 `release/core-latest.json` 中的 `unpackedDir` |
| 稳定分发目录没有最新包 | 查看 `release/core-latest.json` 的 `nsisWebDir`，确认同步到 `release/nsis-web/` 是否完成 |

## 相关文件索引

| 文件 | 作用 |
| --- | --- |
| `docs/design/package-size-optimization.md` | 当前减包方案说明 |
| `docs/reviews/2026-04-17-package-size-optimization-record.md` | 本轮优化历史记录 |
| `electron-builder.yml` | 核心在线包配置和过滤规则 |
| `electron-builder.full.yml` | 完整离线包配置 |
| `scripts/after-pack-prune.cjs` | native 解包目录剪枝 |
| `scripts/dist-win-core.ts` | 稳定核心包打包脚本 |
| `scripts/dist-win-core-utils.ts` | 核心包打包路径工具 |
| `scripts/build-feature-pack.ts` | 单功能包构建脚本 |
| `scripts/sync-feature-packs.ts` | 功能包同步脚本 |
| `resources/feature-manifest.json` | 功能包清单 |
| `tests/unit/config/BuildConfig.test.ts` | 包体积相关回归测试 |
| `tests/unit/scripts/dist-win-core-utils.test.ts` | 核心打包路径工具测试 |
