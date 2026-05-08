# SPEC · Stock Analysis V1

> 关联文档：`docs/overview/current-status.md`、`docs/architecture/architecture.md`、`docs/architecture/feature-pack-plugin-governance.md`  
> 关联代码：`src/renderer/entries/stock/`、`src/engines/analytics/`、`src/shared/types/stock.ts`

---

## 1. 文档目标

| 项目 | 说明 |
| --- | --- |
| 目标 | 为股票分析模块提供稳定专项文档，说明当前已做、未做和实现边界 |
| 当前入口形态 | `stock` 为独立 renderer entry，同时属于受管功能包模块 |
| 文档定位 | 回答“股票模块现在到底能做什么，不能做什么” |

---

## 2. 当前实现结论

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| K 线工作台 UI | `✅ 已做基础版` | 已有模块页、行情工作区、KPI 卡片、时间粒度切换、指标开关 |
| 图表渲染 | `✅ 已做基础版` | 当前使用自定义 Canvas `KLineChart`，支持全屏、滚轮平移、十字光标、自适应宽度 |
| 技术指标 | `✅ 已做基础版` | 已支持 `MA`、`MACD`、`RSI`、`BOLL` |
| 演示数据回退 | `✅ 已做` | 默认可展示 demo K 线数据，并在 UI 标示 `Demo Data` |
| 实时数据事件链路 | `🟡 已打通基础链路` | 主进程事件总线已转发 `stock:data:update` / `stock:realtime:tick`；当前页面主消费 `stock:data:update` |
| 真实行情源配置面板 | `⬜ 未做` | 当前没有完整数据源管理 UI |
| 策略回测 / 下单 / 预警 | `⬜ 未做` | 当前还不是完整投研终端 |

---

## 3. 模块边界

| 层级 | 代表文件 | 职责 |
| --- | --- | --- |
| Renderer 主视图 | `src/renderer/entries/stock/App.tsx` | 持有 symbol、timeframe、指标选择、loading/error 状态 |
| 图表组件 | `src/renderer/entries/stock/components/KLineChart.tsx` | Canvas K 线绘制、指标叠加、十字光标、全屏 |
| 数据引擎 | `src/engines/analytics/DataSourceManager.ts` | REST 历史数据拉取、WebSocket 实时订阅、标准化 OHLCV |
| 指标引擎 | `src/engines/analytics/IndicatorLibrary.ts` | 统一指标计算入口与具体算法实现 |
| Shared 类型 | `src/shared/types/stock.ts` | `OHLCVData`、`DataSourceConfig`、`IndicatorType`、`IndicatorResult` |
| IPC 边界 | `stock:data`、`stock:indicator:calc` | 历史数据读取与指标计算 |

---

## 4. 当前用户链路

| 步骤 | 当前实现 |
| --- | --- |
| 1 | 用户进入 `stock` 模块 |
| 2 | 默认加载 `AAPL`、`1D` 数据 |
| 3 | UI 调用 `stock:data` 获取历史 K 线 |
| 4 | UI 按当前指标勾选列表继续调用 `stock:indicator:calc` |
| 5 | `KLineChart` 绘制 K 线与指标线 |
| 6 | 若无真实数据源，UI 以 `Demo Data` 和提示条说明当前为演示数据 |

---

## 5. 数据模型

### 5.1 K 线数据

| 字段 | 说明 |
| --- | --- |
| `time` | 时间戳 |
| `open` | 开盘价 |
| `high` | 最高价 |
| `low` | 最低价 |
| `close` | 收盘价 |
| `volume` | 成交量 |

### 5.2 数据源配置

| 字段 | 说明 |
| --- | --- |
| `id` | 数据源标识 |
| `name` | 数据源名称 |
| `type` | `rest` 或 `websocket` |
| `url` | 目标地址 |
| `auth` | 可选，支持 `apikey` / `bearer` |
| `requestFormat` | 可选额外请求格式 |

### 5.3 指标结果

| 字段 | 说明 |
| --- | --- |
| `type` | 指标类型 |
| `values` | 主线值数组 |
| `extra` | 扩展数组，例如 `MACD.dea/histogram`、`BOLL.upper/lower` |

---

## 6. 图表能力

| 能力 | 当前状态 | 说明 |
| --- | --- | --- |
| K 线实体 / 影线绘制 | `✅ 已做` | Canvas 自绘 |
| 多指标叠加 | `✅ 已做` | 支持多条线一起绘制 |
| 十字光标 | `✅ 已做` | 鼠标移动显示十字线与价格标签 |
| 全屏切换 | `✅ 已做` | 图表支持全屏 / 退出全屏 |
| 自适应宽度 | `✅ 已做` | `ResizeObserver` 监听容器宽度 |
| 滚轮平移 | `✅ 已做` | 滚轮改变 offset 查看不同区间 |
| 缩放级别控制 | `⬜ 未做` | 当前更偏平移，不是完整缩放系统 |
| 成交量副图 | `⬜ 未做` | 当前未绘制 volume panel |
| 多面板指标布局 | `⬜ 未做` | MACD / RSI 仍未拆出独立副图面板 |

---

## 7. 指标能力

| 指标 | 当前状态 | 说明 |
| --- | --- | --- |
| `MA` | `✅ 已做` | 默认 `20` 周期 |
| `MACD` | `✅ 已做` | 默认 `12/26/9` |
| `RSI` | `✅ 已做` | 默认 `14` 周期 |
| `BOLL` | `✅ 已做` | 默认 `20` 周期、`2` 倍标准差 |

当前 UI 状态：

| 项目 | 当前实现 |
| --- | --- |
| 指标开关 | Checkbox 切换 |
| 指标参数编辑 | `未做`，当前使用固定默认参数 |
| 指标失败回退 | 会展示 warning，不会阻塞整个页面 |

---

## 8. 数据源链路

### 8.1 历史数据

| 能力 | 当前实现 |
| --- | --- |
| REST 拉取 | `DataSourceManager.fetchHistory()` 已支持 |
| 认证 | `apikey` / `bearer` 已支持 |
| 标准化 | 会统一归一为 `OHLCVData[]` |

### 8.2 实时数据

| 能力 | 当前实现 |
| --- | --- |
| WebSocket 连接 | `DataSourceManager.connectRealtime()` 已支持 |
| 自动重连 | 已支持，指数退避，最多 5 次 |
| 事件转发 | 通过事件总线发出实时 tick |

### 8.3 当前边界

| 项目 | 状态 |
| --- | --- |
| 数据源管理 UI | `未做` |
| 多供应商切换策略 | `未做` |
| 持久化订阅管理 | `未做` |
| 历史缓存 / 本地数据库回放 | `未系统打通`，虽然存在 `stock_data` 表，但当前主线仍以运行时演示 / 拉取为主 |

---

## 9. IPC / 事件清单

| 通道 | 说明 |
| --- | --- |
| `stock:data` | 读取历史数据 |
| `stock:indicator:calc` | 计算指标 |
| `stock:data:update` | 主进程广播的数据更新事件；当前页面直接监听 |
| `stock:realtime:tick` | 实时 tick 事件；当前已打通主进程转发链路，但页面未直接消费 |

---

## 10. 当前未完成项

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 真实行情源配置中心 | `未做` | 当前用户不能在 UI 中管理 REST / WS provider |
| 策略脚本 / 回测 | `未做` | PRD 有长期设想，但代码未落地 |
| 提醒 / 订阅 / 告警 | `未做` | `stock_set_alert` 等仍停留在设计层 |
| 多图层分析面板 | `未做` | 当前仍是一块主图 + 指标叠加 |
| 导出分析结果 | `未做` | 当前没有专门导出链路 |

---

## 11. 验收口径

| 验收项 | 当前口径 |
| --- | --- |
| 打开模块 | 能进入 `stock` 页面并展示 KPI 与图表区域 |
| 读取数据 | `stock:data` 返回后可渲染 K 线 |
| 切换 symbol | 输入代码并回车后可刷新数据 |
| 切换 timeframe | 点击时间粒度按钮后重新请求 |
| 切换指标 | 勾选指标后可重新计算并绘制 |
| 演示模式 | 无真实数据源时显示 `Demo Data` 与提示 |

---

## 12. 与当前文档的关系

| 文档 | 作用 |
| --- | --- |
| `docs/product/prd.md` | 给出长期投研 / 策略场景目标 |
| `docs/architecture/architecture.md` | 描述引擎与进程级结构 |
| 本文档 | 回答当前股票模块的真实实现范围与限制 |
