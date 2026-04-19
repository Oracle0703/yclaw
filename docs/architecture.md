# 🏗️ YClaw 技术架构文档

> 模块架构 / 进程模型 / 调用链路 / 技术选型

---

## 文档定位

| 文档 | 说明 |
| --- | --- |
| `docs/architecture.md` | 描述当前系统架构与核心链路 |
| `docs/current-status.md` | 描述当前实现完成度与限制 |
| `docs/structure.md` | 描述实际目录结构与模块职责 |

> 本文档以“当前仓库已存在的实现”为主，同时保留长期演进方向说明。
> 如遇“规划目标”和“当前落地状态”不完全一致，请以 `docs/current-status.md` 为现状基线。

## 当前实现快照

| 维度 | 当前情况 |
| --- | --- |
| 进程结构 | 1 个主进程 + 多业务渲染入口 + 1 个 `plugin-host` 宿主入口 |
| 渲染入口 | `workbench`、`stock`、`automation`、`browser`、`plugin-center`，外加 `plugin-host` |
| 主进程服务 | 配置、数据库、日志、托盘、更新、特性包、调度、批次、模板、结果、告警等 |
| 核心边界 | Electron IPC + `contextBridge` + 共享类型与常量 |
| 当前重点 | 自动化 Browser Ops、AI 助手、插件权限、构建/打包链路 |

---

## 1. 模块架构总览

```mermaid
graph TB
    subgraph ElectronShell["Electron App Shell"]
        WM[WindowManager]
        PL[PluginLoader]
        IPC[IPC Controller<br/>限流 100/s]
        EB[EventBus 事件总线]
        TM[TabManager<br/>WebContentsView]
    end

    subgraph Services["系统服务层"]
        DB[(SQLite<br/>better-sqlite3 WAL)]
        CFG[ConfigService<br/>JSON 持久化]
        LOG[LogService<br/>按日轮转 7天]
        UPD[UpdateService<br/>自动更新]
        TRAY[TrayService<br/>系统托盘]
    end

    subgraph AILayer["AI 服务层"]
        AIS[AIService<br/>LLM 调度]
        CTX[ContextManager<br/>上下文收集]
        TR[ToolRegistry<br/>工具注册]
        LLM[LLMProvider<br/>OpenAI / Ollama]
    end

    subgraph RendererEntries["渲染进程 — 6 入口 (Vite MPA)"]
        WB[主工作台<br/>Workbench]
        STK[股票分析<br/>Stock]
        AUTO_UI[自动化采集<br/>Automation]
        BRW[内嵌浏览器<br/>Browser]
        PC[插件中心<br/>Plugin Center]
        PH_UI[插件宿主<br/>Plugin Host]
    end

    subgraph SharedUI["渲染进程共享组件"]
        CMD[CommandPalette<br/>Ctrl+K]
        CHAT[AIChatPanel<br/>Ctrl+J + Zustand]
        PS[PageShell / TitleBar]
        VIS[Sparkline / RingGauge<br/>TaskTimeline]
    end

    subgraph Engines["核心引擎层"]
        AE[AutomationEngine<br/>5 种操作]
        FR[FlowRunner<br/>断点续跑]
        DSM[DataSourceManager<br/>REST/WebSocket]
        IL[IndicatorLibrary<br/>MA/MACD/RSI/BOLL]
    end

    subgraph PluginSystem["插件系统"]
        PA[PluginBridge<br/>API 桥接]
        PM[PermissionChecker<br/>三级权限]
    end

    subgraph External["外部系统"]
        DS[行情数据源]
        WCV[WebContentsView<br/>受控页面]
        LLMAPI[LLM API<br/>OpenAI / Ollama]
    end

    %% 主进程内部连接
    ElectronShell --> Services
    ElectronShell --> Engines
    ElectronShell --> PluginSystem
    ElectronShell --> AILayer

    %% 渲染进程通过 IPC 连接主进程
    RendererEntries <-->|"contextBridge IPC"| IPC
    IPC -->|"EventBus fan-out"| RendererEntries
    SharedUI --> RendererEntries

    %% AI 连接
    AIS --> CTX
    AIS --> TR
    AIS --> LLM
    LLM --> LLMAPI
    CHAT <-->|"ai:chat IPC"| AIS

    %% 引擎连接外部
    AE --> WCV
    FR --> AE
    DSM --> DS
    IL --> DSM
    TM --> WCV

    %% 插件系统
    PH_UI <-->|"受限 IPC"| PA
    PA --> PM
    PM --> IPC

    %% 服务连接
    AE --> LOG
    AE --> DB
    DSM --> DB
    PL --> PM
```

---

## 2. 进程模型

```mermaid
graph LR
    subgraph MainProcess["主进程 (Node.js)"]
        direction TB
        M1[WindowManager]
        M2[IPC Controller]
        M3[PluginLoader]
        M4[EventBus]
        M5[Services<br/>DB/Config/Log/Update/Tray]
        M6[AutomationEngine + FlowRunner]
        M7[DataSourceManager + IndicatorLibrary]
        M8[AIService + ToolRegistry]
        M9[TabManager]
    end

    subgraph RendererProcess1["渲染进程 #1 — 主工作台"]
        R1[React App<br/>Workbench]
    end

    subgraph RendererProcess2["渲染进程 #2 — 股票分析"]
        R2[React App<br/>Stock Module]
    end

    subgraph RendererProcess3["渲染进程 #3 — 自动化采集"]
        R3[React App<br/>Automation Module]
    end

    subgraph RendererProcess4["渲染进程 #4 — 内嵌浏览器"]
        R4[React App + WebContentsView]
    end

    subgraph PluginProcess["渲染进程 #5 — Plugin Host（V1.0）"]
        P1[共享 Plugin Host<br/>受限 preload]
    end

    %% IPC 通道
    MainProcess <-->|"ipcMain/ipcRenderer<br/>contextBridge"| RendererProcess1
    MainProcess <-->|"ipcMain/ipcRenderer"| RendererProcess2
    MainProcess <-->|"ipcMain/ipcRenderer"| RendererProcess3
    MainProcess <-->|"ipcMain/ipcRenderer"| RendererProcess4
    MainProcess <-->|"受限 IPC 通道"| PluginProcess

    %% 渲染进程间统一经主进程转发
    MainProcess -->|"EventBus fan-out"| RendererProcess1
    MainProcess -->|"EventBus fan-out"| RendererProcess2
    MainProcess -->|"EventBus fan-out"| RendererProcess3
```

### 进程隔离策略

| 进程类型                | 数量        | 权限                  | 说明                                            |
| ----------------------- | ----------- | --------------------- | ----------------------------------------------- |
| 主进程                  | 1           | 完整 Node.js API      | 系统服务、引擎、插件管理                        |
| 渲染进程（模块）        | N（按模块） | 受限（contextBridge） | 每个业务模块独立渲染进程                        |
| 渲染进程（Plugin Host） | 1（V1.0）   | 高度受限 preload      | 受信插件 UI 的共享宿主；V1.5 再升级为按插件隔离 |

---

## 3. 核心调用链路

### 3.1 插件加载链路

```mermaid
sequenceDiagram
    participant App as 应用启动
    participant PL as PluginLoader
    participant FS as 文件系统
    participant PC as PermissionChecker
    participant IPC as IPC Controller
    participant UI as 插件中心 UI

    App->>PL: 初始化插件加载
    PL->>FS: 扫描 plugins/ 目录
    FS-->>PL: 返回插件目录列表

    loop 每个插件目录
        PL->>FS: 读取 plugin.json
        FS-->>PL: 返回插件元信息

        PL->>PC: 校验来源策略 / manifest / 权限声明
        alt 校验通过
            PC-->>PL: ✅ 通过
            PL->>PL: 加载插件入口文件
            PL->>IPC: 注册插件 IPC 通道
            PL->>UI: 通知 UI 更新插件列表
        else 校验失败
            PC-->>PL: ❌ 拒绝
            PL->>PL: 记录错误日志，跳过此插件
        end
    end
```

### 3.2 自动化任务执行链路

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as 自动化模块 UI
    participant IPC as IPC Controller
    participant FR as FlowRunner
    participant AE as AutomationEngine
    participant WCV as WebContentsView
    participant DB as SQLite
    participant LOG as LogService

    User->>UI: 创建/启动任务
    UI->>IPC: task:start {flowId}
    IPC->>FR: 解析任务流定义

    FR->>DB: 加载任务流配置
    DB-->>FR: Flow → [Step1, Step2, ...]

    loop 每个 Step
        FR->>AE: 执行 Action（类型 + 参数）

        alt 页面操作类
            AE->>WCV: webContents.executeJavaScript()
            WCV-->>AE: 执行结果
        else 数据采集类
            AE->>WCV: webContents.executeJavaScript()
            WCV-->>AE: 采集数据
            AE->>DB: 存储采集结果
        else 截图类
            AE->>WCV: webContents.capturePage()
            WCV-->>AE: 图片 Buffer
            AE->>DB: 存储截图路径
        end

        AE->>LOG: 记录步骤日志

        alt 执行失败
            AE->>FR: 报告错误
            FR->>FR: 执行重试策略
            alt 重试成功
                FR->>FR: 继续下一步
            else 重试耗尽
                FR->>FR: 保存断点
                FR->>IPC: task:paused {断点信息}
                IPC->>UI: 通知用户任务暂停
            end
        end
    end

    FR->>LOG: 记录任务完成日志
    FR->>IPC: task:completed {结果摘要}
    IPC->>UI: 更新任务状态
```

### 3.3 数据分析链路

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as 股票分析 UI
    participant IPC as IPC Controller
    participant DSM as DataSourceManager
    participant API as 外部行情 API
    participant IL as IndicatorLibrary
    participant DB as SQLite

    User->>UI: 选择股票 / 打开图表
    UI->>IPC: stock:subscribe {symbol}
    IPC->>DSM: 创建数据订阅

    alt REST 数据源
        DSM->>API: HTTP GET 历史数据
        API-->>DSM: K 线数据
    else WebSocket 数据源
        DSM->>API: WS 连接 & 订阅
        API-->>DSM: 实时推送行情
    end

    DSM->>DB: 缓存历史数据
    DSM->>IPC: stock:data {K线数据}
    IPC->>UI: 渲染 K 线图

    User->>UI: 叠加技术指标（MA/MACD）
    UI->>IPC: stock:indicator {type, params}
    IPC->>IL: 计算指标
    IL-->>IPC: 计算结果
    IPC->>UI: 叠加指标到图表
```

### 3.4 AI 对话链路

```mermaid
sequenceDiagram
    participant User as 用户
    participant Chat as AIChatPanel (Ctrl+J)
    participant IPC as IPC Controller
    participant AIS as AIService
    participant CTX as ContextManager
    participant TR as ToolRegistry
    participant LLM as LLMProvider

    User->>Chat: 输入消息
    Chat->>IPC: ai:chat {message, conversationId}
    IPC->>AIS: 处理对话请求
    AIS->>CTX: 收集上下文（系统指标 + 模块状态）
    CTX-->>AIS: 上下文数据

    AIS->>LLM: 发送 prompt + context + tools
    LLM-->>AIS: LLM 响应

    alt 需要工具调用
        AIS->>TR: 执行工具（task_list / system_status / navigate）
        TR-->>AIS: 工具执行结果
        AIS->>LLM: 发送工具结果
        LLM-->>AIS: 最终响应
    end

    AIS->>IPC: ai:chat:response {reply}
    IPC->>Chat: 更新对话 UI
```

---

## 4. IPC 通信架构

```mermaid
graph TB
    subgraph Renderer["渲染进程"]
        API["window.electronAPI<br/>(contextBridge 暴露)"]
    end

    subgraph Preload["preload.ts"]
        CB["contextBridge.exposeInMainWorld()"]
        IR["ipcRenderer.invoke() / send()"]
    end

    subgraph Main["主进程"]
        IC["IPC Controller<br/>通道路由注册"]
        EB["EventBus<br/>全局事件总线"]
        SVC["Services / Engines"]
    end

    API --> CB
    CB --> IR
    IR <-->|"安全 IPC 通道"| IC
    IC --> EB
    IC --> SVC
    EB -->|"事件广播"| IC
```

### IPC 通道命名规范

```
{module}:{action}:{detail?}

示例：
  task:start              # 启动任务
  task:pause              # 暂停任务
  stock:subscribe         # 订阅行情
  stock:indicator:calc    # 计算指标
  plugin:install          # 安装插件
  plugin:permission:check # 权限检查
  config:get              # 读取配置
  config:set              # 写入配置
  log:export              # 导出日志
```

---

## 5. 数据流架构

```mermaid
graph TB
    subgraph Input["数据输入"]
        WS[WebSocket 行情]
        REST[REST API]
        DOM[DOM 采集]
        CSV[CSV 导入]
        USER[用户输入]
    end

    subgraph Processing["数据处理层"]
        DSM[DataSourceManager]
        AE[AutomationEngine]
        IL[IndicatorLibrary]
        AIS2[AIService]
    end

    subgraph Storage["数据存储层"]
        SQLite[(SQLite<br/>结构化数据)]
        FileStore[文件系统<br/>大文件/截图]
        IDB[(IndexedDB<br/>渲染进程缓存)]
        ConfigFile[JSON/YAML<br/>配置文件]
    end

    subgraph Output["数据输出"]
        Chart[图表渲染]
        Table[数据表格]
        Export[文件导出]
        LogView[日志查看]
    end

    WS --> DSM
    REST --> DSM
    DOM --> AE
    CSV --> AE
    USER --> Processing

    DSM --> SQLite
    DSM --> IDB
    AE --> SQLite
    AE --> FileStore
    IL --> IDB
    AIS2 --> IPC

    SQLite --> Chart
    SQLite --> Table
    SQLite --> Export
    FileStore --> Export
    IDB --> Chart
    ConfigFile --> Processing
    SQLite --> LogView
```

---

## 6. 技术选型表

### 核心框架

| 模块       | 技术选型   | 版本要求 | 选型理由                                        |
| ---------- | ---------- | -------- | ----------------------------------------------- |
| 桌面框架   | Electron   | 33       | WebContentsView 支持、Chromium 内核复用、跨平台 |
| UI 框架    | React      | 18       | 生态丰富、组件化、Concurrent Mode               |
| 构建工具   | Vite       | 6        | 原生 MPA 支持、HMR 极速、Rollup 生态            |
| TypeScript | TypeScript | 5.7      | 类型安全、IPC 消息类型校验                      |

### 状态管理 & UI

| 模块      | 技术选型                         | 选型理由                           |
| --------- | -------------------------------- | ---------------------------------- |
| 状态管理  | Zustand 5                        | 轻量、无样板代码、支持持久化中间件 |
| 路由      | React Router v6                  | 每个入口独立路由实例               |
| UI 组件库 | Ant Design 5 + Pro Components    | 企业级组件库、可定制主题           |
| 图表库    | Lightweight Charts (TradingView) | 专业金融图表、K 线原生支持、高性能 |
| CSS 方案  | CSS Modules                      | 模块化样式隔离                     |

### 数据 & 存储

| 模块         | 技术选型                          | 选型理由                       |
| ------------ | --------------------------------- | ------------------------------ |
| 结构化数据库 | better-sqlite3                    | 同步 API、零网络开销、嵌入式   |
| 文件存储     | Node.js fs + electron app.getPath | 平台无关的应用数据路径         |
| 渲染端缓存   | IndexedDB（原生/轻封装）          | 渲染进程本地缓存、大数据量支持 |
| 配置管理     | ConfigService (JSON 持久化)       | 经 EventBus 广播配置变更       |

### 引擎 & 运行时

| 模块         | 技术选型                 | 选型理由                              |
| ------------ | ------------------------ | ------------------------------------- |
| 自动化引擎   | Electron webContents API | 复用内置 Chromium，无需额外浏览器依赖 |
| 技术指标计算 | IndicatorLibrary (内置)  | MA/MACD/RSI/BOLL 等指标计算           |
| 日志         | LogService (内置)        | 文件按日轮转、7 天保留                |

### 构建 & 打包

| 模块          | 技术选型                                      | 选型理由                         |
| ------------- | --------------------------------------------- | -------------------------------- |
| Electron 打包 | electron-builder                              | dmg/nsis/AppImage 全平台支持     |
| 自动更新      | electron-updater                              | 配合 electron-builder 的增量更新 |
| 测试框架      | Vitest 2 + @testing-library/react + happy-dom | Vite 原生测试 + 组件测试         |

### 插件系统

| 模块             | 技术选型                        | 选型理由                             |
| ---------------- | ------------------------------- | ------------------------------------ |
| 插件宿主（V1.0） | 共享 plugin-host + 受限 preload | 先收敛到单一宿主模型，降低实现复杂度 |
| 插件通信         | IPC                             | 统一权限检查与错误处理链路           |
| 插件包格式       | .ycplugin (zip + plugin.json)   | 自定义包格式，V1.0 不引入签名体系    |

---

## 7. 安全架构

```mermaid
graph TB
    subgraph SecurityLayers["安全分层"]
        L1["Layer 1: 进程隔离<br/>主进程 / 业务渲染进程 / Plugin Host"]
        L2["Layer 2: contextBridge<br/>仅暴露白名单 API"]
        L3["Layer 3: IPC 校验<br/>消息 schema 校验 + 频率限制"]
        L4["Layer 4: 权限模型<br/>三级权限 (L1/L2/L3)"]
        L5["Layer 5: 导航/注入策略<br/>受控脚本模板 + 最小暴露面"]
        L6["Layer 6: 文件系统白名单<br/>沙箱目录隔离 + 受信来源策略"]
    end

    L1 --> L2 --> L3 --> L4 --> L5 --> L6
```

### 插件权限矩阵

| 能力                 | Level 1 (UI 只读) | Level 2 (网络+存储) | Level 3 (自动化+文件) |
| -------------------- | :---------------: | :-----------------: | :-------------------: |
| 渲染 UI              |        ✅         |         ✅          |          ✅           |
| 读取公开应用状态     |        ✅         |         ✅          |          ✅           |
| 网络请求             |        ❌         |         ✅          |          ✅           |
| 插件专属存储读写     |        ❌         |         ✅          |          ✅           |
| 用户文件系统访问     |        ❌         |         ❌          |   ✅（需逐次授权）    |
| 调用自动化引擎       |        ❌         |         ❌          |   ✅（需逐次授权）    |
| 操作 WebContentsView |        ❌         |         ❌          |   ✅（需逐次授权）    |
| 安装时需用户确认     |        ❌         |         ✅          |          ✅           |

---

## 8. 当前落地与后续演进边界

| 方向 | 当前已落地 | 后续演进 |
| --- | --- | --- |
| 插件系统 | 插件加载、基础权限校验、宿主页 | 按插件独立进程、资源隔离、进一步收敛 API 面 |
| 自动化 | 基础执行、断点重试、结果/批次/模板/干预链路 | 真实复杂页面适配、调度恢复、录制能力增强 |
| AI 助手 | Provider 抽象、工具注册、聊天面板 | 流式响应、更多工具、历史持久化增强 |
| 打包发布 | 构建与多平台打包命令已存在 | 发行质量、包体、签名、平台验证持续完善 |
