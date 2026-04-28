# YClaw 开发运行时说明

> 关联文件：`package.json`、`scripts/dev.ts`、`scripts/ensure-dev-runtime.cjs`、`scripts/ensure-dev-runtime-utils.js`、`src/main/utils/paths.ts`

---

## 1. 文档目标

| 项目 | 说明 |
| --- | --- |
| 目标 | 解释 `npm run dev` 实际做了什么，以及为什么会出现浏览器根地址打不开但 Electron 正常打开的情况 |
| 文档类型 | 当前工程运行时说明，不是规划文档 |
| 适用对象 | 本地开发者、排查启动问题的人、需要理解 feature pack / main / preload 联动的人 |

---

## 2. 命令链路

| 命令 | 实际内容 | 作用 |
| --- | --- | --- |
| `npm run dev` | `predev` → `tsx scripts/dev.ts` | 启动开发环境 |
| `npm run predev` | `node scripts/ensure-dev-runtime.cjs` | 启动前检查运行时依赖 |
| `npm run build` | `build:core` + `build:features` + `build:main` | 生产构建 |
| `npm run build:core` | `vite build --mode core` | 构建核心 renderer |
| `npm run build:features` | 各 feature pack 构建 + `sync-feature-packs.ts` | 构建功能包并同步产物 |
| `npm run build:main` | `tsc -p tsconfig.main.json` | 编译主进程 |

---

## 3. `npm run dev` 启动顺序

### 3.1 启动前校验

`predev` 会在真正启动前做以下检查：

| 检查项 | 规则 | 失败时提示 |
| --- | --- | --- |
| Node 版本 | `>=20` 且 `<23` | 提示切回 `.nvmrc` 指定版本 |
| Electron 包目录 | `node_modules/electron` 必须存在 | 提示先执行 `npm install` |
| Electron 二进制 | `node_modules/electron/path.txt` 和 `dist` 内二进制必须存在 | 提示重新安装依赖 |
| `better-sqlite3` 原生绑定 | `node_modules/better-sqlite3/build/Release/better_sqlite3.node` 必须存在 | 提示执行 `npx electron-builder install-app-deps` |

### 3.2 watch 进程

`scripts/dev.ts` 会先并行拉起 3 个 watch 进程：

| 进程 | 命令 | 作用 |
| --- | --- | --- |
| Vite | `vite` | 提供 renderer dev server |
| preload watch | `tsc -p tsconfig.preload.json --watch` | 编译 preload |
| main watch | `tsc -p tsconfig.main.json --watch` | 编译主进程 |

### 3.3 Electron 启动条件

| 条件 | 说明 |
| --- | --- |
| Vite ready | 读取 stdout 中的 `Local:` 地址 |
| preload ready | watch 输出 `Found 0 errors` 或 `Watching for file changes.` |
| main ready | watch 输出 `Found 0 errors` 或 `Watching for file changes.` |

只有三者都 ready，`scripts/dev.ts` 才会真正拉起 Electron。

### 3.4 Electron 启动参数

| 环境变量 | 来源 | 用途 |
| --- | --- | --- |
| `NODE_ENV=development` | `scripts/dev.ts` | 开发模式 |
| `NODE_OPTIONS=--import=tsx` | `scripts/dev.ts` | 直接执行 TS 主入口 |
| `ELECTRON_PRELOAD_PATH` | `dist/dev/main/windows/preload.js` | 指向编译后的 preload |
| `ELECTRON_RENDERER_URL` | Vite `Local:` 输出解析结果 | 告诉主进程该去哪个 dev server 取 renderer 页面 |

---

## 4. 为什么 Electron 正常，但浏览器打开 `http://localhost:5174/` 是 404

这是当前工程结构的正常现象之一。

### 4.1 原因

| 项目 | 说明 |
| --- | --- |
| dev server 根地址 | Vite 可能打印 `http://localhost:5173/`，也可能因为端口占用切到 `5174` 等新端口 |
| 主进程实际加载地址 | 不是根路径，而是 `/entries/<entry>/index.html` |
| 地址拼接逻辑 | `src/main/utils/paths.ts#getRendererUrl()` 会把 `ELECTRON_RENDERER_URL` 拼成 `http://localhost:<port>/entries/<entry>/index.html` |

也就是说：

| 访问地址 | 结果 |
| --- | --- |
| `http://localhost:5174/` | 可能 404 |
| `http://localhost:5174/entries/workbench/index.html` | 才是 `workbench` 入口 |
| `http://localhost:5174/entries/browser/index.html` | 才是 `browser` 入口 |

### 4.2 为什么 Electron 还能正常打开

因为 Electron 不访问根 `/`，而是直接访问具体 entry HTML。

---

## 5. 页面入口规则

| 模块 | 开发时加载路径 |
| --- | --- |
| `workbench` | `/entries/workbench/index.html` |
| `stock` | `/entries/stock/index.html` |
| `automation` | `/entries/automation/index.html` |
| `browser` | `/entries/browser/index.html` |
| `data-center` | `/entries/data-center/index.html` |
| `plugin-center` | `/entries/plugin-center/index.html` |

---

## 6. 重编译与自动重启

| 场景 | 当前行为 |
| --- | --- |
| main watch 首次 ready | 启动 Electron |
| main 再次编译成功 | 先 `SIGTERM` 旧 Electron，再拉起新进程 |
| preload 编译成功 | 满足 ready 条件时允许启动 / 重启 |
| Vite 地址变化 | `scripts/dev.ts` 会从 `Local:` 输出重新解析端口 |

测试 `tests/unit/scripts/dev.test.ts` 已覆盖一个关键事实：当 Vite 输出 `http://localhost:5174/` 时，Electron 会使用这个新地址，而不是写死 `5173`。

---

## 7. 与生产构建的区别

| 维度 | 开发模式 | 生产模式 |
| --- | --- | --- |
| renderer 来源 | Vite dev server | 本地构建产物 |
| `getRendererUrl()` | 返回 `http://localhost:<port>/entries/...` | 返回 `file://.../renderer/entries/...` |
| 启动方式 | `scripts/dev.ts` 驱动 | 直接运行构建后的 Electron 应用 |
| 原生依赖问题暴露 | 启动前即通过 `predev` / `pretest` 发现 | 打包或运行期暴露 |

---

## 8. 常见问题

| 问题 | 原因 | 处理方式 |
| --- | --- | --- |
| `localhost:5174` 打不开根页面 | 当前工程不是 SPA 根页模式 | 直接访问 `/entries/<entry>/index.html`，或用 Electron 打开 |
| Electron 启动前直接退出 | `predev` 校验失败 | 按错误提示补 Node / Electron / `better-sqlite3` |
| `electron is not installed` | 依赖未安装完整 | 执行 `npm install` |
| `Electron binary is incomplete` | 安装过程不完整或脚本被跳过 | 执行 `npm install --no-audit --no-fund` |
| `better-sqlite3 native binding is missing` | Electron 原生依赖未重建 | 执行 `npx electron-builder install-app-deps` |
| 端口不是 `5173` | 已被占用，Vite 自动切端口 | 以终端里 `Local:` 输出为准 |

---

## 9. 当前边界

| 项目 | 当前状态 |
| --- | --- |
| 自动打开浏览器调试页 | `未做` |
| root `/` 统一落地页 | `未做` |
| dev server 端口固定策略 | `未做`，当前依赖 Vite 自动分配 |
| 更完整的 dev diagnostics 面板 | `未做` |

---

## 10. 建议阅读顺序

| 目标 | 建议顺序 |
| --- | --- |
| 想理解 `npm run dev` | `package.json` → `scripts/ensure-dev-runtime.cjs` → `scripts/dev.ts` |
| 想理解 Electron 为什么能打开页面 | `scripts/dev.ts` → `src/main/utils/paths.ts` |
| 想排查运行时依赖错误 | `scripts/ensure-dev-runtime-utils.js` |
