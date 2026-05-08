# YClaw 页面容器布局优化建议

> **背景**：基于对 YClaw 仓库中 `PageShell`、`AdminPageLayout`、`WindowManager`、各模块 `App.tsx` 以及浏览器子组件（`TabBar`、`AddressBar`、`WebViewContainer`）的深度代码分析，针对页面容器层面的布局、交互和架构提出专项优化建议。

---

## 目录

1. [现状诊断](#1-现状诊断)
2. [PageShell 组件优化](#2-pageshell-组件优化)
3. [AdminPageLayout 布局优化](#3-adminpagelayout-布局优化)
4. [浏览器模块容器优化](#4-浏览器模块容器优化)
5. [自动化模块容器优化](#5-自动化模块容器优化)
6. [股票模块容器优化](#6-股票模块容器优化)
7. [多窗口与容器编排](#7-多窗口与容器编排)
8. [优先级排序](#8-优先级排序)

---

## 1. 现状诊断

### 1.1 当前容器架构

```
WindowManager (主进程)
  └── BrowserWindow (单窗口, 1200x800)
      └── workbench 入口 HTML
          └── AdminPageLayout (ProLayout 侧边栏, 232px)
              └── HashRouter
                  ├── /           → Home       (PageShell)
                  ├── /stock      → StockPage   (PageShell, lazy)
                  ├── /automation → AutomationPage (PageShell, lazy)
                  ├── /browser    → BrowserPage (PageShell, lazy)
                  ├── /plugin-center → PluginCenterPage (PageShell, lazy)
                  └── /settings   → Settings    (PageShell)
```

### 1.2 做得好的地方

| 维度 | 现状 |
|------|------|
| **统一页面壳** | 所有页面均使用 `PageShell`，视觉一致性好 |
| **CSS 命名规范** | 全局 `yclaw-` 前缀，避免样式冲突 |
| **KPI 卡片模式** | 多模块复用 `Row > Col > ProCard` 三列 KPI 布局 |
| **窗口状态记忆** | `WindowManager` 保存/恢复窗口位置和尺寸 |
| **安全配置** | `contextIsolation: true`、`nodeIntegration: false` |

### 1.3 核心问题

| # | 问题 | 影响 |
|---|------|------|
| 1 | **所有模块塞入单窗口子路由** | 无法同时查看股票行情和自动化执行面板 |
| 2 | **浏览器模块无真实 WebView 容器** | 当前仅展示标签元信息的 Descriptions 占位 |
| 3 | **PageShell 缺少加载态和错误边界** | 模块切换或异常时无优雅降级 |
| 4 | **AdminPageLayout 侧边栏固定不可折叠** | 内容区有效宽度被压缩，图表类模块空间不足 |
| 5 | **Automation 模块三视图用 Tabs 切换** | 编辑器和执行面板无法同时可见，操作效率低 |
| 6 | **无面板拖拽/缩放能力** | 无法按需调整各区域大小 |

---

## 2. PageShell 组件优化

### 2.1 增加加载态骨架屏

**现状**：`PageShell` 直接渲染 `children`，模块切换时可能出现空白闪烁。

**建议**：

```tsx
interface PageShellProps extends PropsWithChildren {
  title: string;
  subTitle?: string;
  content?: ReactNode;
  extra?: ReactNode;
  loading?: boolean;           // 新增: 是否显示加载态
  error?: Error | null;        // 新增: 错误状态
  onRetry?: () => void;        // 新增: 重试回调
  children: ReactNode;
}

// 实现示例
function PageShell({ loading, error, onRetry, children, ...rest }: PageShellProps) {
  if (error) {
    return (
      <PageContainer title={false}>
        <Result status="error" title="页面加载失败"
          subTitle={error.message}
          extra={<Button onClick={onRetry}>重试</Button>}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={false}>
      <div className="yclaw-page-shell yclaw-panel-card">
        <div className="yclaw-page-shell-header">
          {/* ... 标题区不变 ... */}
        </div>
        <div className="yclaw-page-shell-body">
          <Spin spinning={loading}>
            <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
              {children}
            </Suspense>
          </Spin>
        </div>
      </div>
    </PageContainer>
  );
}
```

### 2.2 增加 Breadcrumb 面包屑导航

**现状**：用户在子页面中无法感知当前位置层级。

**建议**：

```tsx
interface PageShellProps {
  // ... 现有 props
  breadcrumbs?: { title: string; path?: string }[];  // 新增
}

// 渲染位置: 标题区上方
{breadcrumbs && breadcrumbs.length > 0 && (
  <Breadcrumb className="yclaw-page-shell-breadcrumb">
    {breadcrumbs.map((item, i) => (
      <Breadcrumb.Item key={i}>
        {item.path ? <Link to={item.path}>{item.title}</Link> : item.title}
      </Breadcrumb.Item>
    ))}
  </Breadcrumb>
)}
```

### 2.3 增加 PageShell 变体

**现状**：所有页面使用相同的 PageShell 样式，但不同模块对头部区域的需求不同。

**建议**：

```tsx
// 定义 PageShell 变体
type PageShellVariant = 'default' | 'compact' | 'fullscreen' | 'dashboard';

interface PageShellProps {
  variant?: PageShellVariant;
  // ...
}

// 变体说明:
// default   — 标准模式 (当前实现)
// compact   — 紧凑模式 (无副标题, 标题区更小, 适合嵌入子面板)
// fullscreen — 全屏模式 (隐藏头部, 仅保留 minimal toolbar)
// dashboard — 仪表盘模式 (无卡片边框, 无内边距, 适合 Home 首页)
```

---

## 3. AdminPageLayout 布局优化

### 3.1 侧边栏支持折叠

**现状**：`AdminPageLayout` 使用 `ProLayout` 但 `fixSiderbar` 固定，侧边栏不可折叠。

**问题**：侧边栏占 232px，在 1200px 窗口中内容区仅剩 ~968px，股票 K 线图表和自动化编辑器空间不足。

**建议**：

```tsx
<ProLayout
  layout="side"
  navTheme="realDark"
  siderWidth={232}
  collapsed={collapsed}           // 新增: 折叠状态
  onCollapse={setCollapsed}       // 新增: 折叠回调
  collapsible                      // 新增: 允许折叠
  trigger={null}                   // 自定义折叠触发器
  breakpoint="lg"                 // 响应式断点
  // ...
>
```

**补充**：在侧边栏底部增加自定义折叠按钮，折叠后仅显示图标（类似 VS Code Activity Bar）：

```
展开状态:                    折叠状态:
┌──────────┬────────────┐   ┌──┬─────────────────┐
│  📊 总览  │            │   │📊│                 │
│  📈 行情  │  内容区    │   │📈│    内容区        │
│  🤖 自动化│            │   │🤖│                 │
│  🌐 浏览器│            │   │🌐│                 │
│  🧩 插件  │            │   │🧩│                 │
│  ⚙ 设置  │            │   │⚙│                 │
│          │            │   │◀│                 │
└──────────┴────────────┘   └──┴─────────────────┘
 232px                       48px
```

### 3.2 增加多 Tab 工作区

**现状**：侧边栏切换模块时，前一个模块的状态会丢失（React 组件卸载）。

**问题**：用户在股票模块设置了指标参数，切到自动化模块再切回来，参数丢失。

**建议**：

```tsx
// 方案: 使用 CSS display:none 隐藏而非卸载
// 在 AdminPageLayout 中维护活跃 Tab 栈

const [openModules, setOpenModules] = useState<string[]>(['/']);

// 切换模块时不卸载, 仅隐藏
<div style={{ display: activePath === '/stock' ? 'block' : 'none' }}>
  <StockPage />
</div>
<div style={{ display: activePath === '/automation' ? 'block' : 'none' }}>
  <AutomationPage />
</div>

// 同时在侧边栏显示已打开模块的标记
// 类似 VS Code 的编辑器 Tab 栏
```

### 3.3 顶部栏增加全局搜索和快捷操作

**现状**：顶部栏显示 "YClaw Ops" + 安全/协同/通知 Tag，偏装饰性。

**建议**：

```
┌──────────────────────────────────────────────────────────────┐
│ [Y] YClaw Ops     🔍 搜索模块/任务/插件...    🔔  👤  ⚙    │
│    桌面运营台     Ctrl+K 快捷搜索               通知 用户 设置│
└──────────────────────────────────────────────────────────────┘

快捷搜索 (Ctrl+K) 支持:
• 搜索模块: 输入 "行情" → 跳转到 /stock
• 搜索任务: 输入 "价格监控" → 打开自动化模块并定位到该任务
• 搜索插件: 输入 "OCR" → 打开插件中心并高亮该插件
• 快捷操作: 输入 "> 新建任务" → 直接打开任务创建表单
```

---

## 4. 浏览器模块容器优化

### 4.1 这是当前最关键的短板

**现状**：浏览器模块的视图区域仅展示标签元信息的 `Descriptions` 组件，注释明确写道：

> *"后续可以继续把真实的 WebContentsView 容器挂入这个区域"*

这意味着浏览器模块目前是一个**空壳**，无法实际浏览网页。

### 4.2 WebContentsView 容器接入方案

**建议的实现架构**：

```
┌──────────────────────────────────────────────────────────────┐
│ BrowserPage (PageShell)                                      │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ KPI 卡片行 (标签数/活动标签/活动地址)                     │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ ProCard "会话控制台"                                     │ │
│ │  ┌────────────────────────────────────────────────────┐  │ │
│ │  │ TabBar: [标签1] [标签2] [标签3]            [+]     │  │ │
│ │  ├────────────────────────────────────────────────────┤  │ │
│ │  │ AddressBar: [←] [→] [↻] [____URL____] [→ Go]    │  │ │
│ │  └────────────────────────────────────────────────────┘  │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ ProCard "当前视图"                                     │ │
│ │  ┌────────────────────────────────────────────────────┐  │ │
│ │  │                                                    │  │ │
│ │  │            WebContentsView 容器                    │  │ │
│ │  │         (通过 IPC 与主进程通信)                    │  │ │
│ │  │                                                    │  │ │
│ │  │    主进程创建 WebContentsView                      │  │ │
│ │  │    → addBrowserView() 挂载到 BrowserWindow         │  │ │
│ │  │    → 渲染进程通过 IPC 控制导航/执行脚本            │  │ │
│ │  │                                                    │  │ │
│ │  └────────────────────────────────────────────────────┘  │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**关键技术点**：

```typescript
// 主进程侧: WindowManager 中管理 WebContentsView
class BrowserViewManager {
  private views = new Map<string, WebContentsView>(); // tabId -> view

  createView(tabId: string, url: string): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, 'browser-preload.js'),
        contextIsolation: true,
        sandbox: true,  // 浏览器视图启用沙箱
      }
    });
    view.webContents.loadURL(url);
    this.views.set(tabId, view);
    return view;
  }

  // 将 view 挂载到 BrowserWindow
  attachToWindow(window: BrowserWindow, tabId: string) {
    const view = this.views.get(tabId);
    if (view) {
      window.addBrowserView(view);
      // 设置 view 的边界 (对应渲染进程中的容器区域)
      view.setBounds({ x: offsetX, y: offsetY, width: viewWidth, height: viewHeight });
    }
  }
}
```

### 4.3 标签页容器支持拖拽排序

**现状**：`TabBar` 是纯展示组件，不支持拖拽。

**建议**：

```tsx
// 使用 @dnd-kit/core 实现标签拖拽排序
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';

<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={tabs} strategy={horizontalListSortingStrategy}>
    {tabs.map(tab => (
      <SortableTab key={tab.id} tab={tab} active={tab.id === activeId}
        onSwitch={onSwitch} onClose={onClose} />
    ))}
  </SortableContext>
</DndContext>
```

### 4.4 增加标签页分组和会话隔离

**建议**：

```
标签页分组:
┌─────────────────────────────────────────────────┐
│ [电商监控] │ [标签1] [标签2]  │ [+新标签]         │
│ [社交采集] │ [标签3]         │                    │
│ [临时浏览] │ [标签4] [标签5] │                    │
└─────────────────────────────────────────────────┘

会话隔离:
• 每个分组使用独立的 Electron Session
• Cookie / LocalStorage / Cache 互相隔离
• 关闭分组时自动清除该组的所有数据
```

---

## 5. 自动化模块容器优化

### 5.1 从 Tabs 切换改为分栏布局

**现状**：任务列表、步骤编辑器、执行面板通过 `Tabs` 切换，同一时间只能看到一个。

**问题**：用户在编辑步骤时无法同时看到执行结果，效率低下。

**建议**：

```
方案 A: 上下分栏 (推荐)
┌──────────────────────────────────────────────────┐
│ 任务列表 (可折叠)                                  │
│ ┌────────────────────────────────────────────────┐│
│ │ 步骤编辑器 (上)                                 ││
│ │ Step1: 打开页面 → Step2: 点击按钮 → ...        ││
│ ├────────────────────────────────────────────────┤│
│ │ 执行面板 (下)                                   ││
│ │ 当前步骤: 2/5  ████████░░  进度 40%            ││
│ │ 日志: [10:23:01] 点击成功 [10:23:02] 采集完成   ││
│ └────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘

方案 B: 左右分栏
┌────────────────────┬─────────────────────────────┐
│ 任务列表            │ 步骤编辑器                   │
│ + 任务详情          │                              │
│                    ├─────────────────────────────┤
│                    │ 执行面板 (底部可折叠)         │
└────────────────────┴─────────────────────────────┘
```

### 5.2 步骤编辑器增加可视化拖拽

**现状**：`StepEditor` 和 `StepCard` 组件的具体实现未知，但 Spec 提到"可视化编辑任务步骤"。

**建议**：

```
步骤编辑器 (类似 n8n / Node-RED 的简化版):

┌──────────────────────────────────────────────────┐
│  ┌──────┐    ┌──────────┐    ┌──────────┐        │
│  │ 打开 │ →  │ 点击元素 │ →  │ 提取数据 │        │
│  │ 页面 │    │ #price   │    │          │        │
│  └──────┘    └──────────┘    └──────────┘        │
│       ↓                            ↓              │
│  ┌──────┐    ┌──────────┐    ┌──────────┐        │
│  │ 存入 │ ←  │ 截图记录 │ ←  │ 条件判断 │        │
│  │ 数据 │    │          │    │          │        │
│  └──────┘    └──────────┘    └──────────┘        │
│                                                    │
│  [+ 添加步骤]  [▶ 试运行]  [💾 保存]              │
└──────────────────────────────────────────────────┘
```

### 5.3 执行面板增加实时预览

**建议**：在执行面板中嵌入一个小的浏览器预览窗口，实时显示自动化操作的效果：

```
┌──────────────────────────────────────────────────┐
│ 执行面板                                           │
│ ┌──────────────────┬───────────────────────────┐ │
│ │ 实时预览 (小窗)   │ 执行日志                  │ │
│ │ ┌──────────────┐ │ [10:23:01] ✅ Step1 完成  │ │
│ │ │  (缩略       │ │ [10:23:02] ✅ Step2 完成  │ │
│ │ │   WebView)   │ │ [10:23:03] ❌ Step3 失败  │ │
│ │ │              │ │ [10:23:04] 🔄 重试中...    │ │
│ │ └──────────────┘ │                           │ │
│ └──────────────────┴───────────────────────────┘ │
│ 进度: Step 2/5  ████████░░░░░░░░  40%            │
└──────────────────────────────────────────────────┘
```

---

## 6. 股票模块容器优化

### 6.1 图表区域支持全屏模式

**现状**：KLineChart 固定 1100x520，在侧边栏展开时可能显示不全。

**建议**：

```tsx
// 增加 fullscreen toggle
const [isFullscreen, setIsFullscreen] = useState(false);

<div style={{
  width: isFullscreen ? '100vw' : 1100,
  height: isFullscreen ? 'calc(100vh - 48px)' : 520,
  transition: 'all 0.3s ease',
  position: isFullscreen ? 'fixed' : 'relative',
  top: isFullscreen ? 0 : undefined,
  left: isFullscreen ? 0 : undefined,
  zIndex: isFullscreen ? 1000 : undefined,
}}>
  <KLineChart data={data} indicators={indicators} />
  {isFullscreen && (
    <Button className="exit-fullscreen" onClick={() => setIsFullscreen(false)}>
      ✕ 退出全屏
    </Button>
  )}
</div>
```

### 6.2 增加多股票对比布局

**建议**：

```
单股票模式:                    多股票对比模式:
┌──────────────────────┐      ┌──────────────────────┐
│                      │      │ [贵州茅台] vs [五粮液]│
│    K 线图 (全宽)     │      ├──────────┬───────────┤
│                      │      │ K线图(左) │ K线图(右) │
│                      │      │          │           │
├──────────────────────┤      ├──────────┴───────────┤
│ 指标参数控制区        │      │ 共享指标参数控制区   │
└──────────────────────┘      └──────────────────────┘
```

### 6.3 策略编辑器增加分栏预览

**建议**：策略编辑器与回测结果左右分栏显示：

```
┌────────────────────┬─────────────────────────────┐
│ 策略编辑器          │ 回测结果                     │
│                     │                             │
│ function strategy() │ 收益曲线: 📈                 │
│   if (ma5 > ma20)   │ 最大回撤: -12.3%            │
│     return 'buy'    │ 夏普比率: 1.85              │
│   ...               │ 胜率: 58.2%                  │
│                     │                             │
│ [▶ 运行回测]        │ 交易记录表格                 │
└────────────────────┴─────────────────────────────┘
```

---

## 7. 多窗口与容器编排

### 7.1 支持模块弹出为独立窗口

**现状**：`WindowManager` 支持创建多窗口，但 workbench 将所有模块作为子路由嵌入。

**问题**：用户无法将股票模块拖出为独立窗口放到第二显示器上。

**建议**：

```tsx
// 在 AdminPageLayout 侧边栏菜单项上增加右键菜单
const handleContextMenu = (e, path) => {
  menu.show({
    items: [
      { key: 'open', label: '在此窗口打开' },
      { key: 'popout', label: '弹出为独立窗口' },  // 新增
      { type: 'divider' },
      { key: 'close', label: '关闭此模块' },
    ],
    onClick: ({ key }) => {
      if (key === 'popout') {
        // 通过 IPC 请求主进程创建独立窗口
        ipc.invoke('window:openModule', { module: path, standalone: true });
      }
    },
  });
};
```

**主进程侧**：

```typescript
// WindowManager 增加独立模块窗口
openModuleWindow(module: string) {
  return this.openWindow({
    module,
    standalone: true,  // 标记为独立窗口
    // 独立窗口使用简化的 AdminPageLayout (无侧边栏)
    // 或直接加载模块入口 HTML
  });
}
```

### 7.2 窗口间拖拽支持

**建议**：支持将浏览器标签页从一个窗口拖到另一个窗口：

```
窗口 A:                    窗口 B:
┌────────────────────┐     ┌────────────────────┐
│ [标签1] [标签2]    │     │ [标签3]            │
│                    │     │                    │
│                    │     │                    │
└────────────────────┘     └────────────────────┘

拖拽 [标签2] 到窗口 B:

窗口 A:                    窗口 B:
┌────────────────────┐     ┌────────────────────┐
│ [标签1]            │     │ [标签3] [标签2]    │
│                    │     │                    │
│                    │     │                    │
└────────────────────┘     └────────────────────┘
```

### 7.3 面板可拖拽调整大小

**建议**：为分栏布局增加拖拽分割线：

```
使用 react-resizable-panels 或自定义实现:

┌──────────────┬──┬───────────────────┐
│              │⇔│                    │
│  任务列表     │拖│   步骤编辑器       │
│  (30%)       │拽│   (70%)           │
│              │条│                    │
└──────────────┴──┴───────────────────┘
```

---

## 8. 优先级排序

### 🔴 高优先级（核心体验）

| # | 建议 | 预估工作量 | 收益 |
|---|------|-----------|------|
| 1 | **浏览器模块接入真实 WebContentsView** | 5d | 这是当前最大的功能缺口，没有真实浏览器容器，自动化引擎无法实际工作 |
| 2 | **侧边栏支持折叠** | 0.5d | 释放内容区空间，图表和编辑器体验显著提升 |
| 3 | **PageShell 增加加载态和错误边界** | 1d | 消除模块切换白屏，提升整体稳定性 |

### 🟡 中优先级（体验提升）

| # | 建议 | 预估工作量 | 收益 |
|---|------|-----------|------|
| 4 | **自动化模块改为分栏布局** | 2d | 编辑器和执行面板同时可见，操作效率翻倍 |
| 5 | **模块切换不卸载（保持状态）** | 1d | 切换模块不丢失参数和状态 |
| 6 | **模块弹出为独立窗口** | 2d | 支持多显示器工作场景 |
| 7 | **股票图表全屏模式** | 0.5d | 深度分析时获得更大视野 |
| 8 | **标签页拖拽排序** | 1d | 浏览器标签管理更自然 |

### 🟢 低优先级（锦上添花）

| # | 建议 | 预估工作量 | 收益 |
|---|------|-----------|------|
| 9 | **全局搜索 (Ctrl+K)** | 2d | 快速定位模块/任务/插件 |
| 10 | **面板可拖拽调整大小** | 2d | 用户自定义工作区布局 |
| 11 | **多股票对比布局** | 3d | 量化分析专业需求 |
| 12 | **标签页分组与会话隔离** | 3d | 浏览器模块企业级能力 |
| 13 | **窗口间标签拖拽** | 3d | 高级用户的多窗口工作流 |
| 14 | **PageShell 变体系统** | 1d | 不同场景使用不同页面壳风格 |

---

## 总结

YClaw 的页面容器体系已经建立了良好的基础——`PageShell` 统一了页面外观，`AdminPageLayout` 提供了中台级导航框架，`WindowManager` 具备了窗口生命周期管理能力。当前最关键的改进方向可以归纳为三点：

1. **补齐浏览器容器**：这是整个项目的功能瓶颈。WebContentsView 的接入方案需要尽早落地，否则自动化引擎和浏览器模块都只是空壳。

2. **释放内容空间**：侧边栏折叠 + 模块弹出独立窗口 + 图表全屏模式，这三项组合可以显著改善内容区域的可用空间。

3. **提升并行效率**：自动化模块的分栏布局 + 模块切换保持状态 + 多窗口支持，让用户能够同时操作多个模块，这是"工作台"类应用的核心竞争力。

---

> **文档信息**
> - 生成日期：2026年4月
> - 版本：v1.0
> - 基于仓库：[Oracle0703/yclaw](https://github.com/Oracle0703/yclaw) main 分支源码分析
> - 说明：本文基于仓库源码和文档分析，仅供项目改进参考
