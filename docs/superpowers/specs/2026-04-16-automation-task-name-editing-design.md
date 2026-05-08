# 自动化任务名称编辑设计

> 日期：2026-04-16
> 范围：自动化采集模块基础版“任务名称编辑/保存”

---

## 1. 目标

| 项 | 说明 |
|---|---|
| 目标 | 在自动化采集页面支持编辑任务名称，并与步骤通过同一个“保存任务”按钮统一保存 |
| 适用场景 | 新建任务命名、已有任务改名、名称与步骤一起保存 |
| 版本策略 | 仅做基础版闭环，不做自动保存、列表内联改名、名称校验规则扩展 |

## 2. 交互范围

| 场景 | 设计 |
|---|---|
| 新建任务 | 点击“新建任务”后清空 `selectedTaskId`、`taskName`、`steps` |
| 选中已有任务 | 调用 `task:get`，回填任务名称和步骤列表 |
| 编辑任务名称 | 顶部常驻输入框编辑，仅更新前端本地状态 |
| 保存任务 | 点击现有“保存任务”按钮，统一提交 `taskId + name + steps` |
| 空名称保存 | 后端将空白名称标准化为 `未命名任务` |
| 保存成功 | 前端使用返回的 `TaskFlow` 更新 `selectedTaskId`、`taskName`、`steps` 与任务摘要 |

## 3. 非目标

| 不包含项 | 原因 |
|---|---|
| 输入框失焦自动保存 | 避免引入隐式保存与额外失败态 |
| 单独“重命名”按钮 | 与统一保存入口冲突 |
| 任务列表内联改名 | 超出本轮基础版范围 |
| 名称长度/字符限制 | 当前未提出明确业务约束 |
| 提示消息体系增强 | 本轮沿用现有错误处理方式 |

## 4. 数据流

| 阶段 | 前端行为 | 主进程行为 | 结果 |
|---|---|---|---|
| 打开已有任务 | `task:get({ taskId })` | 返回完整 `TaskFlow` | 回填名称和步骤 |
| 新建任务 | 本地清空状态 | 无 | 进入空白编辑态 |
| 编辑中 | 修改 `taskName` / `steps` | 无 | 仅本地草稿 |
| 点击保存 | `task:save({ taskId, name, steps })` | 统一处理新建/更新 | 返回已保存 `TaskFlow` |
| 保存完成 | 更新本地状态 | 落库成功 | 名称、步骤、步骤数同步 |

## 5. 接口设计

### 5.1 IPC

| 通道 | 请求 | 返回 |
|---|---|---|
| `task:get` | `{ taskId: string }` | `TaskFlow` |
| `task:save` | `{ taskId?: string \| null; name?: string; steps: TaskFlow['steps'] }` | `TaskFlow` |

### 5.2 服务层

| 项 | 设计 |
|---|---|
| 方法名 | 将 `saveTaskSteps(...)` 升级为 `saveTaskFlow(...)` |
| 签名 | `saveTaskFlow(taskId, payload)`，其中 `payload` 包含 `name` 与 `steps` |
| 名称标准化 | `const normalizedName = name?.trim() || '未命名任务'` |
| 已有任务 | 保留原 `id`、`createdAt`，更新 `name`、`steps`、`updatedAt` |
| 新建任务 | 生成新 `id`，名称使用标准化结果，再统一落库 |

### 5.3 持久化

| 表/字段 | 处理 |
|---|---|
| `tasks.name` | 保存任务名称 |
| `tasks.flow_json` | 继续保存 `{ steps }` |
| `tasks.updated_at` | 每次保存刷新 |
| `task_steps` | 继续按现有策略删除后重建 |

## 6. UI 设计

| 区域 | 内容 |
|---|---|
| 页面顶部操作区 | `任务名称` 输入框、`新建任务`、`保存任务`、`打开执行面板` |
| 输入框占位 | `请输入任务名称` |
| 保存按钮禁用 | 保持 `steps.length === 0` 时禁用 |
| 新建任务默认显示 | 名称输入框为空 |
| 已有任务显示 | 名称输入框展示服务端返回的名称 |

## 7. 文件改动边界

| 文件 | 职责 |
|---|---|
| `src/renderer/entries/automation/App.tsx` | 增加 `taskName` 状态、输入框、保存时携带 `name` |
| `src/main/app.ts` | 扩展 `TASK_SAVE` IPC 参数类型 |
| `src/main/services/TaskService.ts` | 统一处理名称标准化和新建/更新任务保存 |
| `src/main/services/DatabaseService.ts` | 复用 `saveTaskFlow(flow)`，确保 `name` 更新落库 |
| `tests/unit/components/AutomationApp.test.tsx` | 覆盖名称回填、编辑、保存请求 |
| `tests/unit/services/AppIpcIntegration.test.ts` | 覆盖 `task:save` 带名称参数的集成行为 |
| `tests/unit/services/TaskService.test.ts` | 覆盖名称标准化与已有任务改名保存 |

## 8. 测试策略

| 层级 | 关键用例 |
|---|---|
| `TaskService` | 已有任务改名后保存；空名称新建时回退 `未命名任务` |
| IPC 集成 | `task:save` 接收并透传 `name` 参数 |
| 前端组件 | 选中已有任务后名称回填；改名后保存时带 `name`；新建任务保存时带 `taskId: null` 与名称 |

## 9. 风险与控制

| 风险 | 控制方式 |
|---|---|
| 名称与步骤保存状态不一致 | 统一复用同一个 `task:save` 保存入口 |
| 新建任务未输入名称 | 服务层统一标准化兜底 |
| 选中任务后名称不同步 | 继续以 `task:get` 返回结果为唯一真源 |

## 10. 验收标准

| 编号 | 标准 |
|---|---|
| AC-1 | 选中已有任务时，任务名称可正确回填到顶部输入框 |
| AC-2 | 修改已有任务名称并保存后，名称可持久化且重新加载后保持一致 |
| AC-3 | 新建任务填写名称并保存后，可创建带名称的新任务 |
| AC-4 | 新建任务未填写名称时，保存结果名称为 `未命名任务` |
| AC-5 | 保存任务时继续复用现有“保存任务”按钮，不新增第二条命名专用保存链路 |

