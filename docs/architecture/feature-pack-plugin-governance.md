# YClaw 功能包与插件分发治理

> 关联文件：`resources/feature-manifest.json`、`scripts/build-feature-pack.ts`、`scripts/sync-feature-packs.ts`、`src/main/services/FeaturePackageService.ts`、`src/main/plugin-loader/PluginLoader.ts`

---

## 1. 文档目标

| 项目 | 说明 |
| --- | --- |
| 目标 | 说明当前仓库中“功能包分发”和“插件接入”两条链路的真实治理方式 |
| 文档定位 | 当前实现说明，不讨论未来插件市场或云端分发理想态 |
| 适用对象 | 需要理解模块安装、资源落点、插件权限和当前支持范围的开发者 |

---

## 2. 两条分发链路的区别

| 维度 | 功能包 Feature Pack | 插件 Plugin |
| --- | --- | --- |
| 目的 | 把重型内置模块拆包分发 | 提供可扩展第三方能力 |
| 当前代表 | `stock`、`automation`、`data-center`、`plugin-center` | `plugins/` 下的插件目录 |
| 装载入口 | `FeaturePackageService` | `PluginLoader` |
| 用户侧入口 | `FeatureModulePage`、工作台模块入口 | `plugin-center` 页面 |
| 安装目标目录 | `{userData}/features/` | `{userData}/plugins/` |
| 运行方式 | 作为 renderer 模块窗口打开 | 作为受限插件资产被扫描、注册、启停 |
| 权限模型 | 无单独权限等级，按受管模块安装 | 有 `L1/L2/L3` 权限等级和安装确认 |

---

## 3. 功能包治理

### 3.1 当前受管模块

`resources/feature-manifest.json` 当前声明了 4 个功能包：

| id | module | 说明 |
| --- | --- | --- |
| `stock` | `stock` | 股票分析 |
| `automation` | `automation` | 自动化采集 |
| `data-center` | `data-center` | 数据中心 |
| `plugin-center` | `plugin-center` | 插件中心 |

这些模块在生产模式下不一定随核心包直接内置，而是通过功能包安装后打开。

### 3.2 构建链路

| 阶段 | 文件 / 命令 | 说明 |
| --- | --- | --- |
| 单模块构建 | `npm run build:feature:<module>` | 调用 `scripts/build-feature-pack.ts`，以 `YCLAW_FEATURE_ENTRY` 驱动 Vite feature 构建 |
| feature 总构建 | `npm run build:features` | 依次构建 `stock` / `automation` / `data-center` / `plugin-center` |
| 构建产物 | `dist/features/<module>/entries/<module>/index.html` | 功能包 renderer 产物 |
| 资源同步 | `scripts/sync-feature-packs.ts` | 将 `dist/features/*` 复制到 `resources/feature-packs/*` |

### 3.3 manifest 来源与查找优先级

`FeaturePackageService` 会按以下顺序寻找 manifest：

| 优先级 | 来源 |
| --- | --- |
| 1 | `YCLAW_FEATURE_MANIFEST_PATH` |
| 2 | `process.resourcesPath/resources/feature-manifest.json` |
| 3 | `process.resourcesPath/feature-manifest.json` |
| 4 | `process.cwd()/resources/feature-manifest.json` |

### 3.4 安装落点

| 路径 | 用途 |
| --- | --- |
| `resources/feature-packs/<pkg>/` | 应用内置可安装功能包资源 |
| `{userData}/features/<pkg>/<version>/` | 用户机器上实际安装结果 |
| `AppConfig.featurePackages` | 持久化安装状态、版本、时间、`entryPath` |

### 3.5 安装规则

| 规则 | 当前实现 |
| --- | --- |
| 支持安装源 | `sourceDirectory` 或 `files[]` |
| `files[].source` 支持 | 本地相对路径、绝对路径、`file://`、`http/https` |
| 当前默认 manifest | 使用 `sourceDirectory` 指向本地 `resources/feature-packs/<pkg>` |
| 入口校验 | 安装后必须能找到 `entries/<module>/index.html`；同时兼容早期 `renderer/entries/<module>/index.html` |

### 3.6 打开策略

| 场景 | 当前行为 |
| --- | --- |
| 开发模式 | `WindowManager` 直接走 dev server entry URL |
| 生产模式 + 功能包已安装 | `App.resolveRendererUrl()` 优先返回功能包 `file://` entryPath |
| 生产模式 + 受管模块未安装 | 抛出 `Feature package "<module>" is not installed` |

前端 `FeatureModulePage` 对应的用户提示是：

| 状态 | 前端行为 |
| --- | --- |
| 开发模式 | 允许直接打开模块 |
| 已安装 | 显示“可启动”，可直接打开独立窗口 |
| 未安装 | 显示“需先安装功能包”，提示当前核心包未内置该模块 |

### 3.7 当前边界

| 项目 | 状态 |
| --- | --- |
| 功能包市场 / 远程 catalog UI | `未做` |
| 签名校验 | `未做` |
| 远程下载默认启用 | `未做`，虽然 service 层支持 URL 下载，但当前 shipping manifest 仍以本地资源为主 |
| 更细粒度版本回滚治理 | `未做` |

---

## 4. 插件治理

### 4.1 插件资产位置

| 路径 | 用途 |
| --- | --- |
| `plugins/_template/` | 仓库内模板 |
| `{userData}/plugins/` | 运行时插件扫描目录 |

`PluginLoader.loadAll()` 会扫描 `{userData}/plugins/` 下所有非 `_` 前缀目录。

### 4.2 当前支持的安装来源

| 来源 | 当前状态 | 说明 |
| --- | --- | --- |
| 本地目录 | `✅ 已支持` | UI 通过目录选择器安装 |
| `plugin.json` 文件路径 | `✅ 底层支持` | `PluginLoader.resolvePluginSourceDir()` 支持传入 `plugin.json` 路径 |
| `.ycplugin` 包 | `⬜ 未落地` | 文档里有长期目标，但当前 UI/主进程链路未支持解包安装 |
| 远程插件市场 | `⬜ 未落地` | “同步市场”按钮目前未接实际逻辑 |

注意：当前 `pickLocalPluginPath()` 使用的是 `openDirectory`，所以桌面 UI 实际只支持选择插件目录。

### 4.3 插件 manifest 约束

插件以 `plugin.json` 为核心描述，当前关键字段包括：

| 字段 | 说明 |
| --- | --- |
| `name` | 插件名 |
| `version` | 版本 |
| `displayName` | 展示名 |
| `description` | 描述 |
| `main` | 主入口 |
| `ui` | 可选 UI 入口 |
| `permissions` | 权限列表 |
| `permissionLevel` | 权限等级 |
| `engines.yclaw` | 宿主版本约束 |

### 4.4 权限等级

| 等级 | 常量 | 允许能力 | 安装时行为 |
| --- | --- | --- | --- |
| L1 | `UI_READONLY` | `ui`、`state:read` | 无需用户确认 |
| L2 | `NETWORK_STORAGE` | L1 + `network` + `storage` | 需要用户确认 |
| L3 | `AUTOMATION_FILESYSTEM` | L2 + `filesystem` + `automation` + `webcontents` | 需要用户确认 |

`PermissionChecker.validateManifest()` 会校验声明权限是否超出该等级允许范围。

### 4.5 安装 / 启停 / 卸载链路

| 动作 | 当前实现 |
| --- | --- |
| 安装 | `PLUGIN_INSTALL` → 选择本地目录 → 校验 manifest 与权限 → 低权限直接复制，高权限进入 pending |
| 高权限确认 | `PLUGIN_PERMISSION_CHECK` → `confirmPendingInstall(name, confirmed)` |
| 启用 | `PLUGIN_ENABLE` → `PluginLoader.activate()` |
| 停用 | `PLUGIN_DISABLE` → `PluginLoader.deactivate()` |
| 卸载 | `PLUGIN_UNINSTALL` → 必须显式确认 → 删除本地插件目录 |

### 4.6 安全边界

| 项目 | 当前实现 |
| --- | --- |
| schema 校验 | `pluginManifestSchema` 校验 `plugin.json` |
| 权限等级校验 | `PermissionChecker.validateManifest()` |
| 高权限安装确认 | L2/L3 安装进入 pending，需用户确认 |
| 卸载确认 | 当前所有卸载都要求确认 |
| 路径遍历防护 | 卸载前校验目标路径必须位于 `{userData}/plugins/` 内 |

### 4.7 当前边界

| 项目 | 状态 |
| --- | --- |
| `.ycplugin` 安装流 | `未做` |
| 插件签名 / 校验和 | `未做` |
| 插件市场同步 | `未做` |
| 按插件独立进程隔离 | `未做`，当前仍是共享 plugin-host V1 模式 |

---

## 5. 当前用户可见策略

| 场景 | 当前产品行为 |
| --- | --- |
| 打开受管模块但未安装功能包 | 在 `FeatureModulePage` 提示先安装功能包 |
| 安装功能包成功 | 可从工作台以独立窗口打开模块 |
| 本地安装高权限插件 | 弹出权限确认 |
| 卸载插件 | 弹确认框，说明会删除本地文件 |
| 点击“同步市场” | 当前无真实后端链路 |

---

## 6. 与历史文档的关系

| 文档 | 当前关系 |
| --- | --- |
| `docs/design/package-size-optimization.md` | 提供“为什么要拆功能包”的设计背景 |
| `docs/specs/v1.0-baseline.md` | 说明插件系统基础目标 |
| 本文档 | 回答当前代码里实际怎么构建、安装、加载和校验 |

---

## 7. 建议阅读顺序

| 目标 | 建议顺序 |
| --- | --- |
| 想理解功能包 | `resources/feature-manifest.json` → `scripts/build-feature-pack.ts` → `scripts/sync-feature-packs.ts` → `FeaturePackageService.ts` |
| 想理解插件权限和安装 | `PermissionChecker.ts` → `PluginLoader.ts` → `plugin-center/App.tsx` |
| 想理解当前用户体验 | `FeatureModulePage.tsx` → `plugin-center/App.tsx` |
