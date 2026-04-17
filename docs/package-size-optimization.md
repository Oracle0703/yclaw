# YClaw 包体积优化落地说明

## 发布形态

| 形态 | 脚本 | 内容 | 目标 |
| --- | --- | --- | --- |
| 核心在线包 | `npm run dist:win:core` | `workbench`、`browser`、`plugin-host`、主进程、必要资源 | 首次下载尽量小 |
| 完整离线包 | `npm run dist:win:full` | 核心包 + `stock`、`automation`、`plugin-center` 功能包 | 离线安装即全功能 |
| 功能包构建 | `npm run build:features` | 独立构建三个重模块并同步到 `resources/feature-packs/` | 支持完整包和按需安装 |

## 核心包边界

| 保留在核心包 | 拆成按需功能包 |
| --- | --- |
| 主工作台 `workbench` | 股票分析 `stock` |
| 内嵌浏览器控制台 `browser` | 自动化采集 `automation` |
| 插件宿主 `plugin-host` | 插件中心 `plugin-center` |

## 功能包清单

`resources/feature-manifest.json` 是功能包入口清单。默认使用本地 `sourceDirectory`，完整包构建后由 `scripts/sync-feature-packs.ts` 同步资源。

| 字段 | 说明 |
| --- | --- |
| `id` | 功能包唯一 ID |
| `module` | 对应窗口模块名 |
| `version` | 功能包版本 |
| `sourceDirectory` | 本地功能包目录，支持完整离线包 |
| `files` | 可选文件列表，支持远程 URL 或本地文件逐项下载 |

## 运行时行为

| 场景 | 行为 |
| --- | --- |
| 用户进入 `stock/automation/plugin-center` 路由 | 工作台显示功能包安装/启动页 |
| 功能包未安装 | 点击“安装功能包”后从清单复制或下载资源到用户数据目录 |
| 功能包已安装 | 点击“打开模块窗口”后通过 `window:open` 加载安装目录内的入口 HTML |
| 开发模式 | 允许直接打开源码入口，便于本地调试 |
| `npm run dist:win:core` | 使用独立临时目录 `release-core/<runId>/` 打包，再把稳定安装产物同步回 `release/nsis-web/`，避免旧 `release/win-unpacked` 文件锁导致打包失败 |
| 最新核心包元数据 | 写入 `release/core-latest.json`，记录本次实际输出目录、`win-unpacked` 路径和 `nsis-web` 路径 |

## 打包裁剪

| 配置 | 作用 |
| --- | --- |
| `electron-builder.yml` | 默认核心在线包，使用 `nsis-web` 目标与 `nsisWeb` 配置段，排除 `dist/features`、`resources/feature-packs`、源码图、测试和文档 |
| `electron-builder.full.yml` | 完整离线包，保留 `resources/feature-packs` 并使用普通 `nsis` |
| `vite.config.ts` | `core` 模式只构建核心入口，`feature` 模式逐个构建重模块 |

## 核心依赖瘦身

| 优化项 | 处理方式 | 影响 |
| --- | --- | --- |
| 移除核心包 `@ant-design/pro-components` 链路 | `workbench`、`browser`、`PageShell`、`AdminPageLayout` 改用 `antd` 原生 `Layout/Card/Table/Form/Descriptions` | 核心渲染入口不再直接或间接打入 Pro 组件库 |
| 保留功能包 Pro 组件能力 | `stock`、`automation`、`plugin-center` 仍可在功能包内继续使用 Pro 组件 | 不影响重模块离线包体验 |
| 回归测试 | `tests/unit/config/BuildConfig.test.ts` 检查核心路径不导入 `@ant-design/pro-components` | 防止后续核心包体积回退 |
| 前端库移出生产依赖 | `react/react-dom/react-router-dom/antd/@ant-design/icons/@ant-design/pro-components/zustand` 移到 `devDependencies` | `electron-builder` 不再把这些渲染层库整包塞进 `app.asar` |
| 生产依赖剪枝 | 在 `electron-builder.yml` 里排除 `node_modules` 内的 `*.d.ts/*.d.cts/*.d.mts`、`src/**/*.ts(x)`、`tests`、`docs`、`examples` | 进一步压缩 `app.asar`，避免把运行时无用文件打包进安装包 |
