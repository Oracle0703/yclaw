# SPEC · Remote Runner Control Plane V1

> 状态：**基础版已落地 / 待稳定化与补齐尾项**  
> 关联：[specs/headless-runner-v1.md](headless-runner-v1.md)、[specs/automation-browser-ops-v1.md](automation-browser-ops-v1.md)、[overview/roadmap.md](../overview/roadmap.md)  
> 与主线关系：**近期 P0/P1 增量**，服务于“任务稳定跑起来”的自动化主链路，同时为未来服务化形态预留控制面 / 执行面边界。

## 当前实施状态（截至 2026-04-21）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| Runner 连接管理 | ✅ 已落地 | 已具备保存、删除、测试连接与状态脱敏展示；主进程入口为 `RemoteRunnerService` |
| 协议探测与鉴权 | ✅ 已落地 | 已支持 `GET /v1/runner/info`、`GET /v1/runner/health`、Token 与 `workspaceId` 校验 |
| 远程任务 CRUD | ✅ 已落地 | 已支持任务列表、创建、更新、删除；创建/更新会返回 revision |
| 远程会话 CRUD | ✅ 已落地 | 已支持会话列表、创建、更新、删除与 validate |
| 远程执行闭环 | ✅ 已落地 | 已支持执行创建、详情查询、取消、历史日志与日志流 |
| 自动化页 UI | ✅ 已落地 | 已有 `RemoteRunnerPanel` 与 `RemoteExecutionDrawer` 作为基础控制面 |
| 执行列表 / 结果摘要查询 | ⬜ 待补齐 | `GET /v1/executions` 与 `/results` 仍未进入实际实现 |
| 长连稳定性 / 持久化 | 🟡 雏形 | 当前 daemon 仍以 `InMemoryRemoteRunnerRuntime` 为主，适合联调不适合长期运行 |

---

## 1. 目标

在 YClaw 桌面端中新增一个可用的 **Remote Runner 控制面雏形**，让用户可以把自动化任务交给远程执行节点运行，并在桌面端完成连接管理、远程任务维护、会话配置、执行下发、状态查询、实时日志、取消执行和结果摘要查看。

近期目标不是完整云平台，而是建立一条可运行、可验证、可演进的远程执行链路：

```text
Desktop Control Plane
  → Runner 连接管理
  → 远程任务 / 会话管理
  → 下发执行
  → 查询状态 / 实时日志
  → 取消 / 超时 / 失败恢复入口
  → 结果摘要回看

Remote Runner Execution Plane
  → 保存任务修订
  → 持有会话
  → 执行自动化流程
  → 产生日志与结果
  → 上报状态与能力
```

---

## 2. 非目标（明确不做）

- 不做完整多租户数据库隔离、组织管理、成员管理和 RBAC UI。
- 不做公网级安全方案，如 mTLS、设备证书轮换、审计合规报表。
- 不做远程浏览器画面实时接管；近期只提供远程执行、日志和会话状态。
- 不开放远程插件 UI 托管；Runner 仅暴露核心自动化执行 API。
- 不做本地任务与远程任务的自动双向同步；近期只提供复制、导入或手动维护映射。
- 不替代 `Headless Runner V1` 的 CLI / daemon 方向；本 spec 关注桌面端控制面与远程 Runner 协议。

---

## 3. 产品边界

| 角色 | 近期职责 | 不承担的职责 |
| --- | --- | --- |
| Desktop | 连接配置、任务编辑、会话配置、执行下发、状态与日志查询、结果摘要展示 | 远程任务真实执行、远程浏览器接管 |
| Remote Runner | 任务版本保存、会话持有、自动化执行、日志产出、结果摘要上报 | 桌面 UI、多用户管理、插件市场 |
| 本地 SQLite | 保存连接配置、本地到远程的映射、最近状态缓存 | 作为远程 Runner 的唯一事实源 |
| Runner API | 管理面 API + 日志实时通道 | 直接暴露内部数据库或 Electron IPC |

---

## 4. 最小用户路径

1. 用户在桌面端新增 Runner 连接，填写名称、地址、Token、默认 `workspaceId`。
2. 桌面端测试连接，拉取 Runner 版本、健康状态和能力集。
3. 用户在自动化模块中创建或编辑远程任务，保存后生成 `TaskRevision`。
4. 用户创建或选择远程会话，将会话绑定到远程任务。
5. 用户选择 Runner、任务和 revision，下发一次执行。
6. 执行详情页显示 `queued / running / succeeded / failed / canceled / timeout / interrupted` 状态。
7. 用户可查看实时日志、步骤进度、重试次数、失败原因和结果摘要。
8. 用户可以取消运行中的远程执行。
9. Runner 失联时，桌面端把执行标记为 `interrupted`，重连后重新拉取最终状态。

---

## 5. 核心对象模型

### 5.1 RunnerConnection

桌面端保存的连接配置。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 本地连接 ID |
| `name` | `string` | 用户可读名称 |
| `baseUrl` | `string` | Runner API 地址 |
| `authType` | `'token'` | 近期仅支持 Token |
| `tokenRef` | `string` | Token 存储引用，不在日志中输出明文 |
| `workspaceId` | `string` | 默认工作区；近期可固定为单组织值 |
| `tlsMode` | `'strict' \| 'insecure-dev'` | TLS 校验策略 |
| `proxyUrl` | `string \| null` | 代理地址 |
| `status` | `'unknown' \| 'online' \| 'offline' \| 'auth_failed' \| 'incompatible'` | 最近探测状态 |
| `lastSeenAt` | `string \| null` | 最近心跳时间 |

### 5.2 RunnerInfo

Runner 返回的运行时信息。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `runnerId` | `string` | Runner 自身 ID |
| `name` | `string` | Runner 节点名称 |
| `version` | `string` | Runner 版本 |
| `protocolVersion` | `1` | 协议版本 |
| `capabilities` | `RunnerCapability[]` | 能力集 |
| `limits` | `RunnerLimits` | 并发、超时、日志等限制 |
| `serverTime` | `string` | Runner 当前时间 |

### 5.3 RemoteTask / TaskRevision

远程任务实体与修订版本。

| 对象 | 关键字段 | 说明 |
| --- | --- | --- |
| `RemoteTask` | `id`, `name`, `description`, `tags`, `enabled`, `createdAt`, `updatedAt` | 任务元数据 |
| `TaskRevision` | `revisionId`, `taskId`, `revision`, `flow`, `createdAt`, `createdBy` | 每次保存任务流生成不可变 revision |

执行必须绑定 `revisionId`，避免“编辑后影响正在跑的任务”。

### 5.4 RemoteSession

远程会话元数据。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 会话 ID |
| `name` | `string` | 用户可读名称 |
| `origin` | `string` | 站点域名或 origin |
| `status` | `'unknown' \| 'valid' \| 'expired' \| 'refresh_required'` | 会话状态 |
| `lastValidatedAt` | `string \| null` | 最近校验时间 |
| `expiresAt` | `string \| null` | 过期时间 |

会话内容由 Runner 持有，桌面端只保存元数据与引用，不直接导入导出明文 Cookie。

### 5.5 RemoteExecution

一次远程运行实例。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 执行 ID |
| `taskId` | `string` | 远程任务 ID |
| `revisionId` | `string` | 执行绑定的任务修订 |
| `runnerId` | `string` | 执行节点 |
| `status` | `RemoteExecutionStatus` | 运行状态 |
| `triggeredBy` | `string` | 触发者；近期可固定为本地 actor |
| `startedAt` | `string \| null` | 开始时间 |
| `finishedAt` | `string \| null` | 结束时间 |
| `cancelledBy` | `string \| null` | 取消人 |
| `failureReason` | `RemoteFailureReason \| null` | 失败原因 |
| `resultSummary` | `RemoteResultSummary \| null` | 结果摘要 |

状态集合：

```text
queued → running → succeeded
queued → running → failed
queued → running → timeout
queued → canceled
running → canceled
running → interrupted
interrupted → running
interrupted → failed
```

---

## 6. P0 / P1 需求清单

### P0：近期必须交付

| ID | 名称 | 验收标准 |
| --- | --- | --- |
| RRC-P0-01 | Runner 连接管理 | 可新增、编辑、删除、测试 Runner 连接；列表展示在线状态、版本、能力摘要。 |
| RRC-P0-02 | Token 鉴权与工作区上下文 | 所有远程请求带 Token、`workspaceId`、`actor`；认证失败返回统一错误码 `auth_failed`。 |
| RRC-P0-03 | 能力探测与兼容性检查 | 桌面端调用 `GET /v1/runner/info`，协议版本不兼容时阻止执行并提示。 |
| RRC-P0-04 | 远程任务 CRUD | 桌面端可创建、查看、编辑、删除远程任务；保存任务生成递增 revision。 |
| RRC-P0-05 | 远程执行下发 | 可选择 Runner、任务、revision、会话并触发执行，返回 `executionId`。 |
| RRC-P0-06 | 执行状态查询 | 可查看执行详情、步骤进度、开始结束时间、失败原因、结果摘要。 |
| RRC-P0-07 | 实时日志流 | 执行详情页通过 SSE 或 WebSocket 展示步骤级日志，断线后可重新拉取历史日志。 |
| RRC-P0-08 | 取消与超时 | 支持取消 `queued` / `running` 执行；任务级超时进入 `timeout` 状态。 |
| RRC-P0-09 | Runner 健康检查 | 提供心跳、最近错误摘要、队列深度、运行中数量和能力探测失败提示。 |
| RRC-P0-10 | 最小 Runner Daemon | 本地可启动一个 Runner daemon，支持本 spec 的 P0 API，供桌面端联调和 e2e 使用。 |

### P1：近期增强

| ID | 名称 | 验收标准 |
| --- | --- | --- |
| RRC-P1-01 | 远程会话管理 | 可创建、编辑、删除、校验远程会话元数据，并将会话绑定到远程任务执行。 |
| RRC-P1-02 | 失败恢复与重试策略 | 可配置最大重试次数、退避策略、断点恢复标记；重试来源写入日志。 |
| RRC-P1-03 | 结果摘要与查询 | 可查询最近执行列表、结果摘要、失败聚合和日志检索入口。 |
| RRC-P1-04 | 本地 / 远程任务映射 | 本地保存 `localTaskId → runnerConnectionId → remoteTaskId` 映射，支持手动复制和重新绑定。 |
| RRC-P1-05 | 远程调度预留字段 | API 与数据模型保留 `scheduleRef`、`triggerSource`，近期由桌面端触发执行。 |
| RRC-P1-06 | 操作审计最小版 | 记录连接测试、任务保存、执行创建、取消、会话校验等操作事件。 |

---

## 7. Runner HTTP API 草案

所有 API 均以 `/v1` 为前缀，请求头包含：

```http
Authorization: Bearer <token>
X-YClaw-Workspace: <workspaceId>
X-YClaw-Actor: <actorId>
```

### 7.1 连接与健康

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/v1/runner/info` | 获取 Runner 信息、版本、能力集 |
| `GET` | `/v1/runner/health` | 获取健康状态、队列、运行中数量、最近错误 |

### 7.2 任务与修订

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/v1/tasks` | 查询远程任务列表 |
| `POST` | `/v1/tasks` | 创建远程任务，返回 `taskId` 与首个 revision |
| `GET` | `/v1/tasks/:taskId` | 查询任务详情 |
| `PUT` | `/v1/tasks/:taskId` | 更新任务并生成新 revision |
| `DELETE` | `/v1/tasks/:taskId` | 删除任务；已有执行记录保留 |
| `GET` | `/v1/tasks/:taskId/revisions` | 查询 revision 列表 |
| `GET` | `/v1/tasks/:taskId/revisions/:revisionId` | 查询指定 revision |

### 7.3 会话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/v1/sessions` | 查询远程会话列表 |
| `POST` | `/v1/sessions` | 创建会话元数据 |
| `PUT` | `/v1/sessions/:sessionId` | 更新会话元数据 |
| `DELETE` | `/v1/sessions/:sessionId` | 删除会话 |
| `POST` | `/v1/sessions/:sessionId/validate` | 校验会话状态 |

### 7.4 执行、日志、结果

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/v1/executions` | 创建执行，返回 `executionId` |
| `GET` | `/v1/executions` | 查询最近执行列表 |
| `GET` | `/v1/executions/:executionId` | 查询执行详情 |
| `POST` | `/v1/executions/:executionId/cancel` | 取消执行 |
| `GET` | `/v1/executions/:executionId/logs` | 查询历史日志 |
| `GET` | `/v1/executions/:executionId/logs/stream` | 实时日志流 |
| `GET` | `/v1/executions/:executionId/results` | 查询结果摘要和结果项 |

### 7.5 当前 API 落地边界

当前代码已落地的 API 子集：

| 范围 | 已实现 |
| --- | --- |
| Runner 探测 | `/v1/runner/info`、`/v1/runner/health` |
| 任务 | `GET/POST /v1/tasks`、`PUT/DELETE /v1/tasks/:taskId` |
| 会话 | `GET/POST /v1/sessions`、`PUT/DELETE /v1/sessions/:sessionId`、`POST /v1/sessions/:sessionId/validate` |
| 执行 | `POST /v1/executions`、`GET /v1/executions/:executionId`、`POST /v1/executions/:executionId/cancel` |
| 日志 | `GET /v1/executions/:executionId/logs`、`GET /v1/executions/:executionId/logs/stream` |

当前仍保留在 spec、尚未实现的接口：

- `GET /v1/tasks/:taskId`
- `GET /v1/tasks/:taskId/revisions`
- `GET /v1/tasks/:taskId/revisions/:revisionId`
- `GET /v1/executions`
- `GET /v1/executions/:executionId/results`

---

## 8. 错误模型

远程 API 统一返回：

```json
{
  "error": {
    "code": "auth_failed",
    "message": "Runner token is invalid",
    "data": {
      "requestId": "req_123"
    }
  }
}
```

近期错误码：

| code | 场景 |
| --- | --- |
| `auth_failed` | Token 无效或缺失 |
| `workspace_forbidden` | workspace 不匹配 |
| `protocol_incompatible` | 协议版本不兼容 |
| `runner_unavailable` | Runner 不可用 |
| `task_not_found` | 远程任务不存在 |
| `revision_not_found` | 任务 revision 不存在 |
| `session_expired` | 会话失效 |
| `execution_not_found` | 执行不存在 |
| `execution_not_cancelable` | 当前状态不允许取消 |
| `execution_timeout` | 任务或步骤超时 |
| `rate_limited` | 请求超出频率限制 |

---

## 9. 安全与服务化预留

| 项 | 近期实现 | 未来演进 |
| --- | --- | --- |
| 认证 | Token 鉴权 | 设备证书、短期令牌、OAuth / SSO |
| 授权 | `workspaceId` + Runner 白名单 | 组织、项目、角色、细粒度权限 |
| 传输 | HTTPS 优先；开发环境允许 `insecure-dev` | 强制 TLS、mTLS |
| Token 存储 | 本地配置仅保存引用或脱敏值 | 系统钥匙串、密钥轮换 |
| 审计 | 最小操作日志 | 审计检索、导出、告警 |
| 隔离 | 单组织 / 单控制面 | 多租户数据隔离和资源配额 |

---

## 10. 桌面端 UI 范围

| 页面 / 组件 | 能力 |
| --- | --- |
| `RemoteRunnerPanel` | 列表、新增、编辑、删除、测试连接、能力展示、远程任务与会话基础操作 |
| `RemoteExecutionDrawer` | 状态、步骤进度、历史日志、取消按钮 |
| 自动化任务页 | 承载远程 Runner 入口，与本地任务/结果视图并存 |
| 设置页 | 默认 Runner、默认 workspace、TLS / proxy 策略（仍以基础配置为主） |

近期 UI 可以优先落在自动化模块中，后续再拆到独立 Runner Center。

---

## 11. 与现有 spec 的关系

| 现有 spec | 关系 | 说明 |
| --- | --- | --- |
| [automation-browser-ops-v1.md](automation-browser-ops-v1.md) | 增强 | 自动化任务、结果、日志仍是主链路；Remote Runner 只是新增执行面。 |
| [headless-runner-v1.md](headless-runner-v1.md) | 互补 | Headless Runner 定义 CLI / daemon 形态；本 spec 定义桌面控制面与远程协议闭环。 |
| [task-as-code-v1.md](task-as-code-v1.md) | 可复用 | 远程任务导入导出可复用 Task-as-Code schema，但近期不强制自动同步。 |
| [v1.0-baseline.md](v1.0-baseline.md) | 兼容 | 不改变本地桌面端基线能力，只新增远程执行路径。 |

---

## 12. 里程碑

| 里程碑 | 范围 | 验收结果 |
| --- | --- | --- |
| RRC-M0 | 共享协议与数据模型 | 类型、错误模型、IPC channel、协议文档落地并有单测。 |
| RRC-M1 | 连接与健康检查 | 已完成基础版：桌面端可保存连接、测试连接、展示 Runner 信息。 |
| RRC-M2 | 最小 Runner Daemon | 已完成基础版：可本地启动 daemon，支持任务 CRUD、执行创建、状态查询。 |
| RRC-M3 | 远程执行闭环 | 已完成基础版：桌面端可下发执行、看状态、看日志、取消任务。 |
| RRC-M4 | 会话与结果摘要 | 部分完成：会话管理已具备，执行结果摘要与执行列表查询仍待补齐。 |
| RRC-M5 | e2e 验收 | 进行中：本地 daemon 联调已可跑通，仍需更稳定的端到端收口。 |

---

## 13. 验收指标

| 指标 | 建议目标 |
| --- | --- |
| 连接测试延迟 | 局域网 Runner `GET /v1/runner/info` P95 < 500ms |
| 状态刷新 | 执行状态变化 2s 内在桌面端可见 |
| 日志实时性 | Runner 产生日志后 2s 内显示在执行详情 |
| 取消响应 | 取消请求成功后 5s 内进入 `canceled` 或明确失败状态 |
| 断线恢复 | 日志流断开后重新进入详情页可拉取历史日志 |
| 协议兼容 | 协议版本不匹配时禁止执行并展示明确原因 |
| 本地回归 | 未配置 Runner 时，现有本地任务流程不受影响 |

---

## 14. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 范围过大 | 拖慢自动化主线 | 按 M0-M5 分段验收，P0 先闭环，P1 后补强。 |
| 远程协议过早固化 | 后续服务化成本高 | 所有协议带 `protocolVersion`，资源带 `workspaceId` 与 `revision`。 |
| Token 泄漏 | 远程 Runner 被滥用 | 日志脱敏、本地存储引用、请求失败不回显 Token。 |
| Runner 失联状态模糊 | 用户无法判断任务是否还在跑 | 引入 `interrupted` 状态，重连后补查最终状态。 |
| 本地 / 远程任务混淆 | 用户误操作 | UI 明确标识任务来源与绑定的 Runner。 |
