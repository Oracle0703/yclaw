# SPEC · Capacity-Aware Runner Scheduler V1

> 状态：**基础版已落地 / 待稳定化与配置化**  
> 关联：[specs/remote-runner-control-plane-v1.md](remote-runner-control-plane-v1.md)、[specs/headless-runner-v1.md](headless-runner-v1.md)、[specs/automation-browser-ops-v1.md](automation-browser-ops-v1.md)、[overview/roadmap.md](../overview/roadmap.md)  
> 与主线关系：**近期 P0/P1 增量**，服务于“任务稳定跑起来”，把本地 Runner 与远程 Runner 纳入统一调度池，并为后续多 Runner、自动恢复、容量治理建立调度底座。

## 当前实施状态（截至 2026-04-21）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 共享类型与常量 | ✅ 已落地 | 已有 Runner、队列、lease、metrics 与 IPC channel 定义 |
| Repository 与表结构 | ✅ 已落地 | 已有 `RunnerSchedulerRepository` 承接节点、队列、lease 与事件持久化 |
| Runner Registry | ✅ 已落地 | 已支持本地/远程节点注册、心跳、状态更新与健康样本 |
| Capacity Scorer | ✅ 已落地 | 已按容量、资源、延迟、失败率与状态惩罚返回可解释评分 |
| Dispatch Queue | ✅ 已落地 | 已支持 `inspect/collect/replay` 分队列与加权轮询 |
| Dispatch + Lease | ✅ 已落地 | 已支持选择 Runner、创建 lease、远程/本地适配下发 |
| Lease Reconciler | ✅ 已落地 | 已支持 orphan 标记、幂等任务重入队、非幂等告警终止 |
| 自动化页调度面板 | ✅ 已落地 | 已有 `RunnerSchedulerPanel` 与基础运维操作 |
| daemon metrics 接入 | ✅ 已落地 | 远程 daemon `health` 已返回 typed metrics，控制面可接入 |
| 后台自动 tick / 配置化策略 | 🟡 待补齐 | 当前以显式 `dispatch tick` / `reconcile` 触发为主，参数配置化仍未完成 |

---

## 1. 目标

在 YClaw 中新增一个 **容量感知 Runner 调度器**，让本地 Runner 和远程 Runner 都以统一节点形态进入调度池。系统在创建执行时不再简单指定单个 Runner，而是先进入中心队列，再由调度器根据节点健康、容量、资源负载、心跳延迟和最近失败率选择最合适的 Runner。

近期目标不是完整 Kubernetes 式集群调度，而是建立一条可运行、可解释、可恢复的自动化执行链路：

```text
Task / Trigger
  → Dispatch Queue（按任务类型分队列）
  → Weighted Round Robin（跨队列公平出队）
  → Runner Registry（本地 + 远程统一池）
  → Capacity Scorer（综合评分，最低分优先）
  → Runner Adapter（Local / Remote 下发）
  → Execution Lease（执行归属与续约）
  → Lease Reconciler（orphan 识别、幂等任务迁移）
```

---

## 2. 非目标（明确不做）

- 不做跨机器分布式一致性协议；第一版以桌面控制面 SQLite 为事实源。
- 不做多租户组织隔离和团队 RBAC；保留 `workspaceId` 字段但不展开组织管理。
- 不做抢占式调度；已分配任务不会因更高优先级任务到来而被强制中断。
- 不做复杂资源模型，如 GPU、网络带宽、磁盘 IO、站点级限流；第一版只看并发槽位、CPU、内存、心跳延迟、失败率。
- 不做自动判断任务幂等性；第一版由任务配置手动标记。
- 不做强一致远程执行状态同步；Runner 失联后以 lease 过期和后续查询补偿为准。
- 不替代 Remote Runner 控制面；本 spec 关注“选谁跑、怎么排队、失联怎么托管”。

---

## 3. 核心决策

| 决策点 | 结论 |
| --- | --- |
| 调度池范围 | 本地 Runner + 远程 Runner 统一调度池 |
| 默认分发偏好 | 综合评分最低优先 |
| 负载评分输入 | 并发槽位、CPU、内存、心跳延迟、最近失败率 |
| 无可用容量 | 新任务进入中心队列等待容量释放 |
| 队列形态 | 按任务类型分队列：`collect`、`inspect`、`replay` |
| 跨队列策略 | 加权轮询，默认 `inspect:collect:replay = 4:3:1` |
| 失联执行处理 | 进入 `orphaned` 观察期，按任务幂等性决定是否自动迁移 |
| 幂等性来源 | 任务配置手动标记：`idempotent`、`non-idempotent`、`unknown` |
| `unknown` 策略 | 默认按非幂等处理，只告警不自动重跑 |

---

## 4. 最小用户路径

1. 用户在自动化模块中打开 `Runner 调度池` 面板。
2. 系统展示本地 Runner 与已配置远程 Runner 的在线状态、容量、负载、失败率和最近心跳。
3. 用户创建或触发一个任务，任务配置包含 `taskType` 和 `idempotency`。
4. 新执行先进入对应任务类型队列，而不是直接绑定某个 Runner。
5. 调度器按加权轮询选择队列，再从可用 Runner 中选择综合评分最低的节点。
6. 下发成功后创建 `ExecutionLease`，执行进入 `leased` 状态。
7. Runner 持续心跳并续约 lease，控制面更新 running count 与健康样本。
8. 如果 Runner 满载，新任务继续留在队列等待。
9. 如果 Runner 失联，lease 过期后执行进入 `orphaned`。
10. 如果任务为 `idempotent`，观察期后自动重入队并迁移到其它 Runner；如果非幂等或未知，只生成告警并等待人工处理。

---

## 5. 状态模型

### 5.1 RunnerStatus

| 状态 | 说明 | 是否接新任务 |
| --- | --- | --- |
| `online` | 心跳正常、资源正常、可接新任务 | 是 |
| `degraded` | 可运行但健康降级，如资源偏高、失败率升高、心跳抖动 | 是，但评分加惩罚 |
| `offline` | 心跳超时、连接失败或主动标记不可用 | 否 |
| `draining` | 手动或自动排空，只跑存量任务 | 否 |

### 5.2 ExecutionPlacementStatus

| 状态 | 说明 |
| --- | --- |
| `queued` | 已进入中心队列，等待调度 |
| `dispatching` | 已被调度 tick 取出，正在选择 Runner 或下发 |
| `leased` | 已分配 Runner，lease 有效 |
| `orphaned` | Runner 失联或 lease 过期，执行归属悬空 |
| `reassigning` | 幂等任务进入迁移 / 重跑流程 |
| `terminal` | 成功、失败、取消、告警终止等终态 |
| `cancelled` | 用户取消队列项或执行 |

### 5.3 TaskIdempotency

| 值 | 说明 | orphan 后动作 |
| --- | --- | --- |
| `idempotent` | 可安全重跑，不会造成重复提交或不可接受副作用 | 观察期后自动重入队 |
| `non-idempotent` | 不可自动重跑，需要人工判断 | 只告警 |
| `unknown` | 未标记，第一版保守处理 | 只告警 |

### 5.4 QueueType

| 类型 | 默认权重 | 说明 |
| --- | --- | --- |
| `inspect` | 4 | 健康巡检、短任务、反馈敏感任务 |
| `collect` | 3 | 自动化采集主业务任务 |
| `replay` | 1 | 离线回放、调试、回归类任务 |

---

## 6. 综合评分

第一版采用“分数越低越优先”的可解释模型。

```text
score = capacityScore * 0.40
      + resourceScore * 0.25
      + latencyScore  * 0.15
      + failureScore  * 0.20
      + statusPenalty
```

### 6.1 子分数

| 分数 | 公式 | 说明 |
| --- | --- | --- |
| `capacityScore` | `runningCount / maxConcurrency` | 并发槽位占用率，范围 0..1 |
| `resourceScore` | `max(cpuUsage, memoryUsage)` | 资源压力，CPU/内存使用率以 0..1 存储 |
| `latencyScore` | `min(heartbeatLatencyMs / 5000, 1)` | 心跳延迟归一化，5 秒以上视为满惩罚 |
| `failureScore` | `recentFailedExecutions / recentTotalExecutions` | 最近执行失败率；无样本时为 0 |
| `statusPenalty` | `online=0`, `degraded=0.5`, `offline=999`, `draining=999` | 状态惩罚 |

### 6.2 调度前过滤

以下 Runner 不参与新任务分配：

- `status` 为 `offline` 或 `draining`。
- `runningCount >= maxConcurrency`。
- `workspaceId` 与任务不匹配。
- 任务要求本地或远程时，Runner 类型不匹配。
- Runner 缺少任务所需能力，例如 `browser-automation`、`sessions`、`log-stream`。

### 6.3 评分解释

每次调度应记录 `scoreBreakdown`，用于 UI 和排障：

```json
{
  "runnerId": "runner-local",
  "score": 0.31,
  "capacityScore": 0.25,
  "resourceScore": 0.42,
  "latencyScore": 0.03,
  "failureScore": 0.1,
  "statusPenalty": 0,
  "filtered": false,
  "reasons": ["lowest_score"]
}
```

---

## 7. 队列与调度规则

### 7.1 入队

新任务执行请求进入 `runner_queue_items`：

- `taskType` 决定所属队列。
- `idempotency` 来自任务配置。
- `workspaceId` 决定可用 Runner 范围。
- `priority` 第一版保留字段，跨队列不使用；队列内部先 FIFO。

### 7.2 加权轮询

默认权重：

```text
inspect = 4
collect = 3
replay  = 1
```

调度序列：

```text
inspect, inspect, inspect, inspect, collect, collect, collect, replay
```

每个 dispatch tick：

1. 从轮询序列当前位置选择一个队列。
2. 如果队列为空，跳过并推进游标。
3. 如果队列非空，取队头任务尝试调度。
4. 如果没有可用 Runner，任务保留在队头，游标推进到下一队列。
5. 如果下发失败，按错误类型决定回队、重试或进入终态。

### 7.3 无容量策略

- 所有 Runner 满载时，任务保持 `queued`。
- 不因暂时无容量而直接失败。
- UI 显示队列长度、队头等待时间和最近一次无法调度原因。

---

## 8. Lease 与失联托管

### 8.1 默认参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `heartbeatIntervalMs` | `10_000` | Runner 心跳周期 |
| `heartbeatTimeoutMs` | `30_000` | Runner 离线判定阈值 |
| `leaseTtlMs` | `45_000` | 执行 lease 有效期 |
| `orphanGraceMs` | `60_000` | orphan 观察期 |
| `maxReassignAttempts` | `2` | 自动迁移最大次数 |

### 8.2 状态流转

```text
queued → dispatching → leased → terminal
leased → orphaned → reassigning → queued
leased → orphaned → terminal(alert-only)
```

### 8.3 orphan 处理

- `ExecutionLease` 超过 `expiresAt` 未续约：lease 标记为 `orphaned`。
- 对应队列项或执行归属标记为 `orphaned`。
- 等待 `orphanGraceMs` 后：
  - `idempotent` 且 `reassignAttempts < maxReassignAttempts`：转 `reassigning`，`reassignAttempts + 1`，重新入队。
  - `non-idempotent` 或 `unknown`：转 `terminal`，生成告警，等待人工处理。
  - 超过最大迁移次数：转 `terminal`，生成告警。

---

## 9. 核心对象模型

### 9.1 RunnerNode

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | Runner 节点 ID |
| `kind` | `'local' \| 'remote'` | 本地或远程 |
| `name` | `string` | 用户可读名称 |
| `workspaceId` | `string` | 所属工作区 |
| `status` | `RunnerStatus` | 健康状态 |
| `capabilities` | `string[]` | 能力集 |
| `maxConcurrency` | `number` | 最大并发槽位 |
| `runningCount` | `number` | 当前运行数量 |
| `cpuUsage` | `number` | 0..1 |
| `memoryUsage` | `number` | 0..1 |
| `heartbeatLatencyMs` | `number` | 最近心跳延迟 |
| `recentFailureRate` | `number` | 最近失败率，0..1 |
| `lastHeartbeatAt` | `string \| null` | 最近心跳时间 |
| `lastSeenAt` | `string \| null` | 最近可见时间 |
| `createdAt / updatedAt` | `string` | 时间戳 |

### 9.2 RunnerQueueItem

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 队列项 ID |
| `taskId` | `string` | 任务 ID |
| `taskType` | `QueueType` | 队列类型 |
| `idempotency` | `TaskIdempotency` | 幂等性 |
| `workspaceId` | `string` | 工作区 |
| `status` | `ExecutionPlacementStatus` | 调度位置状态 |
| `priority` | `number` | 队列内优先级预留，第一版 FIFO |
| `reassignAttempts` | `number` | 已迁移次数 |
| `lastError` | `string \| null` | 最近错误 |
| `createdAt / updatedAt` | `string` | 时间戳 |

### 9.3 ExecutionLease

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | lease ID |
| `executionId` | `string` | 执行 ID |
| `queueItemId` | `string` | 队列项 ID |
| `runnerId` | `string` | Runner ID |
| `taskId` | `string` | 任务 ID |
| `leaseToken` | `string` | 续约 token |
| `status` | `'active' \| 'expired' \| 'released' \| 'orphaned'` | lease 状态 |
| `expiresAt` | `string` | 过期时间 |
| `lastRenewedAt` | `string` | 最近续约时间 |
| `createdAt / updatedAt` | `string` | 时间戳 |

---

## 10. 数据库表

### 10.1 `runner_nodes`

```sql
CREATE TABLE runner_nodes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  max_concurrency INTEGER NOT NULL,
  running_count INTEGER NOT NULL,
  cpu_usage REAL NOT NULL,
  memory_usage REAL NOT NULL,
  heartbeat_latency_ms INTEGER NOT NULL,
  recent_failure_rate REAL NOT NULL,
  last_heartbeat_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 10.2 `runner_queue_items`

```sql
CREATE TABLE runner_queue_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  idempotency TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  reassign_attempts INTEGER NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 10.3 `execution_leases`

```sql
CREATE TABLE execution_leases (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  queue_item_id TEXT NOT NULL,
  runner_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  lease_token TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_renewed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 10.4 `runner_health_samples`

```sql
CREATE TABLE runner_health_samples (
  id TEXT PRIMARY KEY,
  runner_id TEXT NOT NULL,
  cpu_usage REAL NOT NULL,
  memory_usage REAL NOT NULL,
  running_count INTEGER NOT NULL,
  max_concurrency INTEGER NOT NULL,
  heartbeat_latency_ms INTEGER NOT NULL,
  recent_failure_rate REAL NOT NULL,
  sampled_at TEXT NOT NULL
);
```

### 10.5 `runner_dispatch_events`

```sql
CREATE TABLE runner_dispatch_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  runner_id TEXT,
  queue_item_id TEXT,
  execution_id TEXT,
  message TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

---

## 11. 服务边界

| 服务 | 责任 |
| --- | --- |
| `RunnerRegistryService` | 注册本地/远程 Runner，接收心跳，更新资源指标，计算健康状态，提供可调度 Runner 列表 |
| `CapacityScoringService` | 输入 Runner 指标，输出综合评分和解释明细 |
| `DispatchQueueService` | 按任务类型分队列，维护加权轮询游标，处理入队、出队、重入队、取消 |
| `RunnerDispatchService` | 从队列取任务，选择最低分 Runner，下发任务，创建 `ExecutionLease` |
| `ExecutionLeaseService` | 创建、续约、释放、过期扫描 lease |
| `LeaseReconciler` | 扫描过期 lease，标记 orphaned，幂等任务重入队，非幂等任务告警 |
| `RunnerAdapter` | 屏蔽本地 Runner 与远程 Runner 下发差异，提供统一 `dispatch` 接口 |

---

## 12. IPC / API

| 通道 | 说明 |
| --- | --- |
| `runner:registry:list` | 查询 Runner 调度池 |
| `runner:registry:heartbeat` | Runner 心跳 / 指标更新 |
| `runner:registry:drain` | 将 Runner 置为排空 |
| `runner:registry:resume` | 将 Runner 恢复为可调度 |
| `runner:queue:list` | 查询队列状态 |
| `runner:queue:enqueue` | 创建队列项 |
| `runner:queue:cancel` | 取消队列项 |
| `runner:dispatch:tick` | 手动触发一次 dispatch tick，主要用于测试 / 调试 |
| `runner:lease:list` | 查询 lease |
| `runner:lease:renew` | lease 续约 |
| `runner:lease:release` | lease 释放 |
| `runner:lease:reconcile` | 手动触发 reconcile tick，主要用于测试 / 调试 |

---

## 13. tick 时序

> 当前实现以手动触发和显式调用为主：`runner:dispatch:tick` 与 `runner:lease:reconcile` 已可用；自动后台 interval 仍属于下一阶段收口项。

### 13.1 HealthMonitor tick（目标形态）

1. 扫描 `runner_nodes`。
2. 超过 `heartbeatTimeoutMs` 未心跳则标记 `offline`。
3. CPU、内存、失败率超过阈值则标记 `degraded`。
4. 指标恢复后可从 `degraded` 回到 `online`。
5. 写入 `runner_health_samples` 与 `runner_dispatch_events`。

### 13.2 Dispatch tick（当前可手动触发）

1. 从 `DispatchQueueService` 按加权轮询选队列。
2. 取队头 `queued` 项。
3. 过滤不可用 Runner。
4. 用 `CapacityScoringService` 选择最低分 Runner。
5. 调用 `RunnerAdapter.dispatch` 下发。
6. 成功后创建 `execution_leases`，队列项转 `leased`。
7. 失败后按错误类型回队或终止。

### 13.3 LeaseReconciler tick（当前可手动触发）

1. 扫描过期 active lease。
2. 标记 lease 与队列项为 `orphaned`。
3. 等待 `orphanGraceMs`。
4. 幂等任务且未超最大迁移次数则转 `reassigning` 后重新入队。
5. 非幂等、未知或超过迁移次数则生成告警并转 `terminal`。

---

## 14. UI 入口

在自动化页新增 `Runner 调度池` 面板：

- Runner 卡片：状态、类型、本地/远程、负载、失败率、最近心跳。
- 队列看板：`collect / inspect / replay` 三条队列长度、权重、队头等待时间。
- 执行归属：当前执行跑在哪个 Runner，lease 何时过期。
- 异常托管：`orphaned`、`reassigning`、`alert-only` 列表。
- 手动操作：`drain`、`resume`、取消队列项、强制 reconcile。
- 调度解释：展示被选中 Runner 的评分构成，以及其它 Runner 被过滤或未选中的原因。

---

## 15. P0 / P1 需求清单

### P0：近期必须交付

| ID | 名称 | 验收标准 |
| --- | --- | --- |
| CRS-P0-01 | 共享类型与常量 | Runner、队列、lease、幂等性、任务类型类型齐全；IPC channel 唯一且符合命名规范。 |
| CRS-P0-02 | 数据库迁移与 Repository | 5 张表创建成功；Repository 支持创建、查询、状态更新、过期扫描。 |
| CRS-P0-03 | Runner Registry | 本地与远程 Runner 可注册；心跳可更新指标；`online/degraded/offline/draining` 可测。 |
| CRS-P0-04 | Capacity Scorer | 综合评分公式实现；可返回评分明细和过滤原因。 |
| CRS-P0-05 | Dispatch Queue | 支持 `inspect/collect/replay` 分队列，加权轮询，满载时保留队头。 |
| CRS-P0-06 | Dispatch + Lease | 任务从 `queued` 到 `leased`；选中最低分 Runner；创建 lease；容量正确扣减。 |
| CRS-P0-07 | Lease Reconciler | 过期 lease 转 orphan；幂等任务重入队；非幂等 / unknown 告警终止。 |
| CRS-P0-08 | 最小 IPC | 渲染端可查询 Runner、队列、lease，并触发 drain/resume/cancel/tick/reconcile。 |

### P1：近期增强

| ID | 名称 | 验收标准 |
| --- | --- | --- |
| CRS-P1-01 | Runner 调度池 UI | 自动化页可查看 Runner 卡片、队列长度、lease、异常托管列表。 |
| CRS-P1-02 | 手动运维操作 | UI 支持 drain、resume、取消队列项、强制 reconcile。 |
| CRS-P1-03 | 远程 Runner 心跳上报 | daemon 暴露或主动上报 metrics；控制面可更新远程 Runner 指标。 |
| CRS-P1-04 | 调度解释 UI | 展示“为什么选中这个 Runner”和评分构成。 |
| CRS-P1-05 | 配置化策略 | 队列权重、阈值、lease 参数可通过配置读取；默认值与本 spec 一致。 |
| CRS-P1-06 | 任务配置接入 | 任务编辑或 Task-as-Code 支持 `taskType`、`idempotency`。 |

---

## 16. 验收标准

- 本地 + 远程 Runner 同时在线时，新任务分配给综合评分最低者。
- 所有 Runner 满载时，新任务进入对应类型队列等待，不直接失败。
- 队列按 `inspect:collect:replay = 4:3:1` 加权轮询出队。
- Runner 心跳超时后不再接新任务。
- `degraded` Runner 仍可参与调度，但评分明显降权。
- `draining` Runner 不接新任务，但不影响已持有 lease 的执行。
- Runner 失联导致 lease 过期时，幂等任务自动重分配，非幂等 / unknown 只告警。
- UI 能看到 Runner 状态、负载、队列积压、lease 归属、orphaned / reassigning 状态。
- 调度事件可追溯：每次入队、下发、lease 续约、orphan、重分配都有事件记录。

---

## 17. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 调度逻辑过重，拖慢主线 | P0 只实现必要状态机和公式；复杂 quota、抢占、站点限流放到后续。 |
| 自动迁移导致重复副作用 | 仅 `idempotent` 自动迁移；`unknown` 保守告警。 |
| 本地 / 远程 Runner 行为不一致 | 通过 `RunnerAdapter` 统一 dispatch/renew/release 接口。 |
| 状态字段语义混乱 | Runner 健康、队列位置、lease 归属分开建模。 |
| UI 难解释为什么任务没跑 | `runner_dispatch_events` 与 `scoreBreakdown` 记录过滤和评分原因。 |
| tick loop 引入不稳定异步行为 | Repository 和 service 先做可手动触发 tick 的同步单元测试，再接后台 interval。 |

---

## 18. 推荐实施顺序

1. 共享类型、常量、IPC channel。
2. 数据库表与 Repository。
3. `CapacityScoringService`，先独立纯函数化测试。
4. `RunnerRegistryService` 与心跳状态机。
5. `DispatchQueueService` 与加权轮询。
6. `ExecutionLeaseService` 与 `LeaseReconciler`。
7. `RunnerDispatchService` 与本地 / 远程 adapter。
8. IPC handlers。
9. 自动化页 `Runner 调度池` UI。
10. 远程 Runner daemon 心跳 metrics 接入。
