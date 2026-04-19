# YClaw

> 基于 Electron、React、Vite 构建的可扩展桌面运营工作台。

[![License: MIT](https://img.shields.io/badge/license-MIT-0f172a.svg)](./LICENSE)
![Electron](https://img.shields.io/badge/electron-33-1f2937.svg)
![React](https://img.shields.io/badge/react-18-2563eb.svg)
![TypeScript](https://img.shields.io/badge/typescript-5-0f766e.svg)
![Vite](https://img.shields.io/badge/vite-6-7c3aed.svg)

## 项目简介

YClaw 是一个面向复杂运营工作流的桌面工作台，目标是把浏览、自动化、分析、AI 助手、插件治理和系统服务统一到一个 Electron 容器中。

当前仓库已经不是“纯规划项目”，而是一个**可运行、可构建、可测试**的工程仓库。

| 方向 | 当前状态 |
| --- | --- |
| 桌面壳 | Electron 主进程、窗口管理、托盘、自动更新已落地 |
| 渲染层 | React + Vite 多入口页面已建立 |
| IPC 边界 | 已有类型化通道、事件总线与限流控制 |
| 核心引擎 | 自动化引擎、分析引擎已具备基础能力 |
| AI 助手 | 服务层、工具调用、聊天面板已接入 |
| 插件系统 | 插件加载、权限校验、插件中心、宿主页已具备基础版本 |
| 工程能力 | 已有 lint、typecheck、单测、e2e、构建与打包脚本 |

## 当前重点能力

| 模块 | 已实现能力 |
| --- | --- |
| `workbench` | 工作台首页、设置页、命令面板、AI 助手入口 |
| `stock` | K 线图与技术指标展示基础能力 |
| `automation` | 任务列表、步骤编辑、执行面板、批次/结果/模板管理 |
| `browser` | 多标签会话控制台、地址栏、干预面板、录制面板 |
| `plugin-center` | 插件安装、启停、卸载、权限确认 |
| `plugin-host` | 受限插件宿主与桥接层 |
| 主进程服务 | 配置、数据库、日志、托盘、更新、标签与窗口管理 |

## 自动化 Browser Ops V1

当前分支已补齐一轮“自动化 + 浏览器运维闭环”基础能力：

| 能力 | 当前内容 |
| --- | --- |
| 任务执行 | 任务列表、批次列表、结果表格、失败重试入口 |
| 浏览器干预 | 断点/会话上下文展示、人工恢复 |
| 执行支撑 | 会话注册、模板服务、模板管理、录制面板 |
| 可观测性 | 基于执行日志的告警与状态视图 |
| 验证方式 | Playwright 覆盖手动启动、导出、干预恢复主流程 |

## 已知限制

| 类别 | 当前限制 |
| --- | --- |
| 自动化真实场景 | 复杂页面自动化与全量任务 CRUD 仍在继续增强 |
| 调度与录制 | 已具备生产骨架，但还不是最终强化版本 |
| 验证边界 | e2e 目前主要针对渲染层与预加载模拟环境 |
| 插件隔离 | 仍为基础宿主模式，按插件独立进程隔离属于后续版本 |
| 发布验证 | 多平台打包脚本已存在，但发行质量仍需持续验证 |

## 快速开始

### 环境要求

| 项目 | 要求 |
| --- | --- |
| Node.js | `>=20.19.0 <23` |
| 包管理器 | `npm` |
| 平台 | Windows / macOS / Linux |

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
npm run test:e2e
npm run typecheck
```

### 打包

```bash
npm run dist
```

平台打包：

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动本地开发环境 |
| `npm run build` | 构建核心渲染层、特性包与主进程 |
| `npm run build:core` | 构建核心渲染层 |
| `npm run build:features` | 构建特性包并同步产物 |
| `npm run build:main` | 编译主进程 |
| `npm run lint` | 执行 ESLint |
| `npm run format` | 执行 Prettier |
| `npm test` | 运行 Vitest |
| `npm run test:coverage` | 运行覆盖率测试 |
| `npm run test:e2e` | 运行 Playwright |
| `npm run typecheck` | 执行 TypeScript 类型检查 |
| `npm run pack` | 生成未封装 Electron 构建产物 |
| `npm run dist` | 生成发行包 |
| `npm run dist:win:core` | 生成 Windows 精简核心包 |

## Task-as-Code 快速上手

YClaw 把任务流（`Task`）与抽取模板（`Template`）以 YAML 形式承载，方便审阅、改 diff、做版本管理：

```bash
# 静态校验目录下所有 *.task.yaml / *.template.yaml
npm run yclaw -- lint ./examples/tasks

# 把目录中的任务/模板写入数据库（同一文件反复 import 不刷新 createdAt）
npm run yclaw -- import ./examples/tasks

# 把当前数据库中的指定 id 导出为 YAML
npm run yclaw -- export task t-001 -o ./examples/tasks/t-001.task.yaml

# CI 側可生成 SARIF，供 GitHub code-scanning / 其他平台消费
npm run yclaw -- lint ./examples/tasks --format sarif > yclaw-lint.sarif
```

YAML 最小骨架（`examples/tasks/` 下有完整示例）：

```yaml
schemaVersion: 1
kind: Task
metadata:
  id: t-001
  name: 抓取首页
spec:
  steps:
    - id: s1
      name: 点击搜索
      action: { type: click, selector: '#search' }
```

主进程会向渲染层暴露 `window.api.taskAsCode`（`importYaml / exportYaml / watchStart / watchStop`），UI 侧的「导入 / 导出 / 监听变更」面板按钮基于此 API 接入。完整字段、并发幂等约束与目录监听语义详见
[`docs/specs/task-as-code-v1.md`](./docs/specs/task-as-code-v1.md) 与
[`src/shared/serialization/README.md`](./src/shared/serialization/README.md)。

## 文档导航

| 文档 | 说明 |
| --- | --- |
| `docs/overview/current-status.md` | 当前实现现状、已知限制、阅读建议 |
| `docs/README.md` | `docs/` 文档总索引 |
| `docs/architecture/architecture.md` | 技术架构、进程模型、核心调用链路 |
| `docs/architecture/structure.md` | 实际目录结构与模块职责 |
| `docs/product/prd.md` | 产品愿景与核心场景 |
| `docs/product/plan.md` | 可行性分析与阶段计划 |
| `docs/specs/v1.0-baseline.md` | 基线规格与验收目标 |
| `docs/specs/v1.1-enhancements.md` | 增强项规格 |
| `docs/specs/automation-browser-ops-v1.md` | 自动化 Browser Ops 专项规格 |
| `docs/overview/roadmap.md` | 近期演进路线 |

## 目录概览

```text
src/
  main/                 Electron 主进程、系统服务、AI、插件、浏览器管理
  renderer/
    entries/            业务模块入口（workbench/stock/automation/browser/plugin-center）
    plugin-host/        插件宿主页与桥接层
    shared/             共享组件、Hook、样式、工具
  shared/               主/渲染进程共享类型、常量、工具
  engines/              自动化与分析引擎
plugins/
  _template/            插件模板
scripts/                开发、构建、打包辅助脚本
tests/
  unit/                 单元与回归测试
  e2e/                  Playwright 端到端测试
docs/                   产品、架构、规格、现状与专项文档
```

更详细的目录说明见 `docs/architecture/structure.md`。

## 工程质量基线

建议在提交前至少执行以下命令：

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

CI 与发布相关配置位于：

| 文件 | 说明 |
| --- | --- |
| `.github/workflows/ci.yml` | CI 校验流程 |
| `.github/workflows/release.yml` | 发版流程 |
| `.github/scripts/extract-release-notes.mjs` | 发布说明提取脚本 |

## 贡献与协作

提交改动时建议遵循：

- 保持改动聚焦、便于评审
- 优先保持 TypeScript 类型完整
- 行为变更时同步更新测试与文档
- 保持目录结构与命名风格一致

详细协作方式见 `CONTRIBUTING.md`，社区行为规范见 `CODE_OF_CONDUCT.md`，安全相关说明见 `SECURITY.md`。

## License

MIT
