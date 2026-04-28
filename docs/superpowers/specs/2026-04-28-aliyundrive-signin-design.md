# AliyunDrive Signin Design

> 状态：已完成方案确认，已进入实施；当前为部分已实现。  
> 所属模块：`src/renderer/entries/automation/`、`src/main/services/`  
> 关联代码：`src/main/app.ts`、`src/main/browser/TabManager.ts`、`src/main/services/SessionRegistry.ts`、`src/main/services/SchedulerService.ts`、`src/renderer/entries/automation/`  
> 关联文档：`docs/specs/automation-browser-ops-v1.md`、`docs/overview/current-status.md`  
> 参考脚本：`docs/auto.js`

---

## 1. 背景

当前仓库已经具备自动化任务、浏览器介入、会话绑定、调度骨架、告警与执行面板等基础能力，但“单站点自动签到”还没有形成一个稳定、可维护的产品化场景。

用户当前已有一份运行在 `auto.js` 环境中的阿里云盘签到脚本，主要通过 `refresh_token -> access_token -> sign_in / sign_in_reward` 的 API 链路完成签到与领奖。该方式可用，但存在以下问题：

| 问题 | 说明 |
| --- | --- |
| 运行环境割裂 | 旧脚本不在当前 Electron 工程内，无法复用现有任务、会话、调度和人工介入能力 |
| 维护方式分散 | 页面签到、API 兜底、通知发送都混在一份脚本中，不利于持续维护 |
| 风控现实 | 纯 API 模式虽然稳定，但与真实网页登录态脱节；纯页面模式又容易被活动页结构变化影响 |
| 通知能力薄弱 | 旧脚本内嵌 SMTP 示例与硬编码密钥，不适合继续沿用 |

本设计的目标不是做一个通用爬虫系统，而是先把“阿里云盘单站点签到”收成一个可运行、可维护、可人工接管的专项能力。

---

## 2. 目标

| 目标 | 说明 |
| --- | --- |
| 单站点落地 | 第一版仅支持 `https://www.aliyundrive.com/` |
| 页面优先 | 优先复用应用内浏览器会话，在页面上完成签到与领奖 |
| API 兜底 | 页面链路失败时，可使用 `refresh_token` 调官方接口兜底 |
| 人工介入 | 页面与 API 都无法稳定完成时，转为人工处理并支持“处理完成，重试” |
| 定时执行 | 支持每天固定时间触发，并在当天失败后重试 1~2 次 |
| 结果可见 | 在自动化模块中展示最近执行状态、失败原因、介入入口 |
| 通知可扩展 | 第一版支持应用内通知，建议支持邮件，预留 Webhook 能力 |

---

## 3. 非目标

| 不做项 | 原因 |
| --- | --- |
| 通用多站点签到平台 | 第一版只打透阿里云盘，避免过度抽象 |
| 多账号并发签到 | 第一版先只做单账号，后续再扩展 |
| 验证码破解 / 风控绕过 | 明确不做，仅转人工处理 |
| 通用可视化选择器编辑器 | 第一版直接由阿里云盘专项 provider 维护定位规则 |
| 独立 `signin` 顶级模块 | 第一版挂在 `automation` 下面更合适 |
| 短信 / 第三方 IM 直连 | 第一版先收敛到应用内通知、邮件和预留 Webhook |

---

## 4. 一期范围

### 4.1 用户确认后的边界

| 维度 | 一期结论 |
| --- | --- |
| 站点 | 阿里云盘 |
| 账号 | 单账号 |
| 执行主链路 | 浏览器会话页面签到优先 |
| 兜底链路 | 页面失败后使用 `refresh_token` API 兜底 |
| 失败处理 | 转人工介入，显示失败原因，提供“处理完成，重试”按钮 |
| 调度方式 | 每天固定时间跑一次，失败后当天再重试 1~2 次 |
| 消息通知 | 应用内通知必做，邮件建议做，Webhook 预留 |

### 4.2 页面签到场景

页面路径按当前用户描述收敛为：

`首页 -> 精选活动 -> 第一个日期卡片 -> 弹窗 -> 领取`

第一版默认以此页面结构为目标，但不会把单一选择器写死在任务配置中，而是集中放到阿里云盘专项 locator 规则中维护。

---

## 5. 方案比较与推荐

| 方案 | 说明 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A | 纯页面签到 | 接近真实用户行为，复用浏览器登录态 | 活动页结构变动频繁，维护点全在 UI | 不推荐单独采用 |
| B | 纯 API 签到 | 稳、快、调试简单 | 与网页登录态割裂，不符合“会话优先” | 适合作为兜底 |
| C | 页面优先，API 兜底，最后转人工 | 稳定性最好，符合用户选择的 D 方案 | 第一版实现稍重 | 推荐 |

本设计采用方案 `C`。

---

## 6. 产品形态

第一版不建议新开一个独立菜单，而是放在现有 `automation` 主线下，作为一种“专项任务模板 / 签到任务”能力存在。

### 6.1 入口形态

| 位置 | 设计 |
| --- | --- |
| `automation` 页面 | 新增“阿里云盘签到任务”配置入口 |
| 任务列表 | 作为一种特殊任务展示最近运行结果 |
| 执行面板 | 展示成功、重试、待人工处理等状态 |
| 人工介入入口 | 通过现有浏览器会话和介入链路打开失败现场 |

### 6.2 为什么不单开菜单

| 原因 | 说明 |
| --- | --- |
| 任务属性明显 | 它本质是定时执行 + 结果追踪，不是单纯浏览器操作页 |
| 复用现有主线 | `automation` 已经具备任务、批次、调度、告警、介入骨架 |
| 范围足够窄 | 第一版只有单站点单账号，不值得独立成顶级模块 |

---

## 7. 主链路设计

### 7.1 执行优先级

| 优先级 | 动作 |
| --- | --- |
| P0 | 复用绑定的浏览器会话打开阿里云盘页面并尝试页面签到 |
| P1 | 页面签到失败后，若配置了 `refresh_token`，走 API 兜底 |
| P2 | API 仍失败后，进入人工介入状态 |

### 7.2 主链路步骤

| 步骤 | 行为 |
| --- | --- |
| 1 | 调度器触发签到任务 |
| 2 | 用绑定会话打开 `https://www.aliyundrive.com/` |
| 3 | 查找“精选活动”区域和第一个日期卡片 |
| 4 | 点击卡片，等待弹窗出现并点击“领取” |
| 5 | 根据页面反馈判断是否成功 |
| 6 | 页面失败时，若允许 API 兜底，则尝试签到与领奖接口 |
| 7 | API 成功则记录为“页面失败但 API 兜底成功” |
| 8 | API 失败且当天还有补跑机会，则安排重试 |
| 9 | 无法自动完成时进入人工介入，并打开失败现场 |
| 10 | 用户点击“处理完成，重试”后，从页面签到步骤重新执行 |

---

## 8. 数据模型设计

### 8.1 复用现有任务模型

第一版不建议创建独立任务体系，而是在现有 `TaskFlow` 上叠加一个签到专项配置。

| 对象 | 作用 |
| --- | --- |
| `TaskFlow` | 继续作为任务主记录 |
| `SigninTaskConfig` | 存放阿里云盘签到专项配置 |
| `SigninExecutionRecord` | 存放每次签到执行结果摘要 |

### 8.2 `SigninTaskConfig`

```ts
interface SigninTaskConfig {
  site: 'aliyundrive';
  mode: 'browser-first-api-fallback';
  entryUrl: string;
  fallbackApiEnabled: boolean;
  refreshToken?: string | null;
  maxRetryPerDay: number;
  manualInterventionEnabled: true;
}
```

| 字段 | 说明 |
| --- | --- |
| `site` | 站点标识，第一版固定 `aliyundrive` |
| `mode` | 执行策略，第一版固定 `browser-first-api-fallback` |
| `entryUrl` | 页面入口，默认 `https://www.aliyundrive.com/` |
| `fallbackApiEnabled` | 是否启用 API 兜底 |
| `refreshToken` | API 兜底所需 token，可为空 |
| `maxRetryPerDay` | 当天最大重试次数，建议 `1~2` |
| `manualInterventionEnabled` | 是否允许人工处理，第一版固定 `true` |

### 8.3 `SigninExecutionRecord`

```ts
interface SigninExecutionRecord {
  taskId: string;
  runAt: string;
  strategyUsed: 'browser' | 'api-fallback' | 'manual-retry';
  status:
    | 'pending'
    | 'running_browser'
    | 'running_api_fallback'
    | 'retry_scheduled'
    | 'needs_intervention'
    | 'success'
    | 'failed';
  failureReason?:
    | 'session_expired'
    | 'activity_not_found'
    | 'date_card_not_found'
    | 'reward_button_not_found'
    | 'already_claimed'
    | 'api_token_invalid'
    | 'api_request_failed'
    | 'unknown';
  detail?: string;
}
```

---

## 9. 状态机设计

### 9.1 状态定义

| 状态 | 含义 |
| --- | --- |
| `pending` | 等待本次运行 |
| `running_browser` | 正在执行页面签到 |
| `running_api_fallback` | 页面失败后正在执行 API 兜底 |
| `retry_scheduled` | 当天稍后将重试 |
| `needs_intervention` | 需要人工介入处理 |
| `success` | 本次签到成功 |
| `failed` | 本次最终失败 |

### 9.2 状态流转

| 当前状态 | 触发 | 下一状态 |
| --- | --- | --- |
| `pending` | 调度触发 | `running_browser` |
| `running_browser` | 页面成功 | `success` |
| `running_browser` | 页面失败且允许 API | `running_api_fallback` |
| `running_browser` | 页面失败且不允许 API | `needs_intervention` |
| `running_api_fallback` | API 成功 | `success` |
| `running_api_fallback` | API 失败且当天还能重试 | `retry_scheduled` |
| `running_api_fallback` | API 失败且需人工处理 | `needs_intervention` |
| `retry_scheduled` | 到达补跑时间 | `running_browser` |
| `needs_intervention` | 用户点击“处理完成，重试” | `running_browser` |
| 任一运行态 | 超过当天上限 | `failed` |

### 9.3 失败原因结构化

| failureReason | 说明 |
| --- | --- |
| `session_expired` | 会话失效，需要重新登录 |
| `activity_not_found` | 没找到“精选活动”区域 |
| `date_card_not_found` | 没找到日期卡片 |
| `reward_button_not_found` | 找不到弹窗里的领取按钮 |
| `already_claimed` | 今日已领，按成功处理 |
| `api_token_invalid` | `refresh_token` 无效 |
| `api_request_failed` | API 调用失败 |
| `unknown` | 未知异常 |

---

## 10. 模块落点与代码结构规划

### 10.1 层级落点

| 层级 | 建议位置 | 作用 |
| --- | --- | --- |
| 渲染层 | `src/renderer/entries/automation/` | 配置签到任务、展示状态、执行人工重试 |
| 主进程服务层 | `src/main/services/signin/` | 编排页面签到、API 兜底、通知和人工介入 |
| 浏览器控制层 | `src/main/browser/` + `TabManager` | 打开带分区的页面、执行页面动作 |
| 会话层 | 现有 `SessionRegistry` | 绑定阿里云盘登录会话 |
| 调度层 | `SchedulerService` | 负责每日触发与失败补跑 |
| IPC 层 | `src/main/ipc/` + shared constants/types | 对外暴露配置、运行、重试和通知配置通道 |

### 10.2 建议新增的核心单元

| 文件 / 单元 | 职责 |
| --- | --- |
| `src/main/services/signin/SigninTaskService.ts` | 签到任务总编排入口 |
| `src/main/services/signin/providers/AliyunDriveSigninProvider.ts` | 阿里云盘页面签到与 API 兜底协调者 |
| `src/main/services/signin/providers/AliyunDriveLocators.ts` | 页面定位规则集中维护 |
| `src/main/services/signin/providers/AliyunDriveApiFallback.ts` | 迁移旧 `auto.js` 的 API 逻辑 |
| `src/main/services/signin/types.ts` | 主进程侧签到专项类型 |
| `src/main/ipc/signin-handlers.ts` | 签到任务配置、立即执行、人工重试等 IPC |
| `src/shared/types/signin.ts` | 主/渲染共享类型 |
| `src/renderer/entries/automation/components/SigninTaskPanel.tsx` | 签到任务配置面板 |
| `src/renderer/entries/automation/components/SigninRunStatusCard.tsx` | 最近运行状态、失败原因、重试入口 |

---

## 11. 页面签到策略设计

### 11.1 页面结构目标

第一版当前目标路径如下：

`首页 -> 精选活动 -> 第一个日期卡片 -> 弹窗 -> 领取`

### 11.2 成功判定

页面点击只是动作，最终成功应由页面反馈与必要时接口确认共同判定。

| 判定层级 | 规则 |
| --- | --- |
| P0 | 点击 `领取` 后出现“已领取 / 领取成功 / 今日已领”类反馈 |
| P1 | 弹窗关闭后，活动卡片或奖励状态变为已领取 |
| P2 | 页面判定不明确时，再调用一次签到/领奖查询接口确认 |

### 11.3 Locator 维护策略

第一版不建议把 DOM 定位规则散在任务配置中，而是集中在阿里云盘 provider 内维护，并支持多候选规则。

| 目标元素 | 建议策略 |
| --- | --- |
| 精选活动区 | 文本匹配“精选活动” + 相邻容器结构匹配 |
| 第一个日期卡片 | 活动区内第一个符合日期特征的卡片 |
| 领取按钮 | 文案候选：`领取` / `立即领取` / `马上领取` / `已领取` |

---

## 12. API 兜底策略

### 12.1 参考旧脚本

旧脚本 `docs/auto.js` 已验证以下链路：

| 步骤 | 接口 |
| --- | --- |
| 1 | `https://auth.aliyundrive.com/v2/account/token` |
| 2 | `https://member.aliyundrive.com/v1/activity/sign_in_list` |
| 3 | `https://member.aliyundrive.com/v1/activity/sign_in_reward?_rx-s=mobile` |

### 12.2 新系统中的使用方式

| 规则 | 说明 |
| --- | --- |
| 页面优先 | 默认先走浏览器页面签到 |
| API 兜底 | 仅在页面失败后使用，不作为默认主链路 |
| token 来源 | 第一版允许配置 `refresh_token` 作为兜底凭据 |
| 安全要求 | 不允许继续沿用旧脚本中的硬编码 SMTP / 密钥模式 |

### 12.3 API 兜底结果分类

| 结果 | 处理 |
| --- | --- |
| 签到与领奖成功 | 记录为成功，但附带“页面失败，API 兜底成功” |
| 已签到 / 已领奖 | 按成功处理 |
| token 无效 | 进入人工介入或最终失败 |
| 接口结构异常 | 记录预警，提示可能需要更新 provider |

---

## 13. 人工介入设计

### 13.1 触发条件

| 条件 | 动作 |
| --- | --- |
| 页面失败且 API 未启用 | 转人工 |
| 页面失败且 API 也失败 | 转人工 |
| 登录态失效 | 转人工 |
| 页面结构变化疑似发生 | 转人工并提示维护 |

### 13.2 第一版表现

用户选择的是：

`弹出浏览器页面 + 明确提示失败原因 + 提供“处理完成，重试”按钮`

### 13.3 人工介入时应展示的信息

| 字段 | 作用 |
| --- | --- |
| 当前页面 URL | 判断是否已跳登录页或活动页 |
| 失败步骤 | 判断卡在哪一步 |
| 失败原因码 | 提供稳定可维护的错误语义 |
| 截图 | 快速查看页面是否改版 |
| 建议动作 | 例如“请重新登录后点击重试” |

---

## 14. 调度与重试策略

### 14.1 用户已确认的策略

| 项目 | 结论 |
| --- | --- |
| 固定执行 | 每天固定时间执行一次 |
| 补跑 | 失败后当天再重试 1~2 次 |
| 账号范围 | 第一版单账号 |

### 14.2 建议重试策略

| 场景 | 策略 |
| --- | --- |
| 网络异常 | 当天稍后重试 |
| 页面结构变化 | 先尝试 API 兜底，仍失败则转人工 |
| 登录失效 | 不盲目重试，直接转人工 |
| API token 无效 | 不盲目重试，直接转人工或失败 |

---

## 15. 消息推送设计

### 15.1 通知通道策略

第一版建议把通知抽象成通道层，而不是把邮箱写死在签到逻辑里。

| 通道 | 第一版建议 |
| --- | --- |
| 应用内通知 / 告警列表 | 必做 |
| 邮件 | 建议做 |
| Webhook | 预留 |
| 系统通知 | 可选 |
| 短信 / 第三方 IM 直连 | 不做 |

### 15.2 触发规则

| 事件 | 是否通知 | 说明 |
| --- | --- | --- |
| 页面签到成功 | 可选 | 默认不发，或只计入摘要 |
| API 兜底成功 | 建议发 | 说明页面策略可能失效 |
| 转人工介入 | 必发 | 需要用户处理 |
| 当天最终失败 | 必发 | 任务未完成 |
| 今日已领取 | 默认不发 | 作为正常成功处理 |
| 页面结构变化疑似发生 | 建议发 | 便于后续维护 |

### 15.3 通知内容

| 字段 | 示例 |
| --- | --- |
| 任务名 | `阿里云盘签到` |
| 账号 | `默认账号` |
| 时间 | `2026-04-28 09:00:02` |
| 结果 | `页面失败，API 兜底成功` |
| 失败原因 | `reward_button_not_found` |
| 是否需要人工处理 | `是 / 否` |
| 重试次数 | `1/2` |
| 建议动作 | `请重新登录后点击“处理完成，重试”` |

### 15.4 邮件标题建议

| 场景 | 标题 |
| --- | --- |
| 成功 | `YClaw 通知 - 阿里云盘签到成功` |
| API 兜底成功 | `YClaw 预警 - 阿里云盘页面签到失败，已改用 API 成功` |
| 转人工 | `YClaw 待处理 - 阿里云盘签到需要人工介入` |
| 最终失败 | `YClaw 失败 - 阿里云盘签到最终失败` |

### 15.5 邮件配置要求

旧脚本中硬编码 SMTP 账号和授权码的方式不能沿用。新设计要求：

| 项目 | 设计 |
| --- | --- |
| 配置位置 | 应用设置页 / `ConfigService` |
| 字段 | `host`、`port`、`secure`、`username`、`password`、`from` |
| 能力 | 提供“发送测试邮件”按钮 |
| 粒度 | 支持任务级通知开关 |

### 15.6 通知服务抽象

| 单元 | 职责 |
| --- | --- |
| `NotificationService` | 通知总入口 |
| `InAppNotifier` | 应用内告警 / 事件推送 |
| `EmailNotifier` | SMTP 邮件发送 |
| `WebhookNotifier` | 预留 HTTP 推送 |

---

## 16. 维护策略

### 16.1 三层维护模型

| 层 | 内容 | 变化频率 | 维护方式 |
| --- | --- | --- | --- |
| 第 1 层 | 调度、任务、状态机、人工介入 | 低 | 基本不动 |
| 第 2 层 | API 兜底逻辑 | 中 | 接口或 token 规则变化时调整 |
| 第 3 层 | 页面 locator 与成功判定 | 高 | 集中在阿里云盘 provider 中维护 |

### 16.2 失败排障输出

第一版建议每次失败都尽量保留以下信息：

| 信息 | 作用 |
| --- | --- |
| 页面 URL | 判断页面是否跳走 |
| 失败步骤 | 快速定位挂点 |
| DOM 片段摘要 | 快速修 locator |
| 截图 | 便于人工查看改版情况 |
| 失败原因码 | 与 UI、通知和日志统一 |

---

## 17. 测试策略

### 17.1 单元测试

覆盖以下重点：

| 测试对象 | 覆盖点 |
| --- | --- |
| `AliyunDriveSigninProvider` | 页面成功、页面失败转 API、最终转人工 |
| `AliyunDriveApiFallback` | token 无效、已签到、已领奖、接口异常 |
| `SigninTaskService` | 状态流转、补跑调度、失败分类 |
| `NotificationService` | 不同事件是否触发对应通知 |

### 17.2 组件测试

| 组件 | 覆盖点 |
| --- | --- |
| `SigninTaskPanel` | 配置时间、API 兜底开关、token 输入 |
| `SigninRunStatusCard` | 展示最近状态、失败原因、人工重试入口 |

### 17.3 集成测试

主链路建议覆盖：

1. 创建阿里云盘签到任务。
2. 绑定会话并设置执行时间。
3. 触发页面签到成功。
4. 模拟页面失败后 API 兜底成功。
5. 模拟页面和 API 均失败后进入人工介入。
6. 用户点击“处理完成，重试”并成功收口。

---

## 18. 验收标准

一期验收建议按以下清单执行：

| # | 验收项 | 通过标准 |
| --- | --- | --- |
| 1 | 任务配置 | 能在 `automation` 中创建阿里云盘签到任务 |
| 2 | 会话复用 | 能绑定一个阿里云盘浏览器会话 |
| 3 | 页面签到 | 正常情况下可通过页面完成签到 / 领奖 |
| 4 | API 兜底 | 页面失败时可使用 `refresh_token` 成功兜底 |
| 5 | 人工介入 | 自动失败时可打开页面并提示失败原因，支持“处理完成，重试” |
| 6 | 重试策略 | 当天失败后可按配置进行补跑 |
| 7 | 状态可见 | 最近运行状态、失败原因、使用的策略在 UI 可见 |
| 8 | 通知 | 应用内通知可用；若启用邮件，关键事件能发出通知 |
| 9 | 可维护性 | 页面定位规则集中维护，不需要改动任务模型和调度主链路 |

---

## 19. 后续扩展顺序

| 顺序 | 方向 |
| --- | --- |
| 1 | 单账号稳定运行后的多账号支持 |
| 2 | Webhook 通知正式落地 |
| 3 | 站点策略抽象后扩展到其他签到站点 |
| 4 | 更细粒度的通知规则和日报摘要 |
| 5 | 会话登录态自检与一键续登 |

---

## 20. 结论

本设计将阿里云盘自动签到收敛为一个“单站点、单账号、页面优先、API 兜底、失败转人工、带通知通道”的专项任务能力，明确复用现有 `automation`、`session`、`scheduler`、`browser`、`intervention` 基础设施，不新造一套独立系统。

这样做的核心收益是：

| 收益 | 说明 |
| --- | --- |
| 可落地 | 第一版范围可控，不会直接膨胀成通用平台 |
| 可维护 | 页面规则和 API 逻辑集中维护，后续只改 provider 即可 |
| 可恢复 | 自动链路失败后有人工接管，而不是直接放弃 |
| 可扩展 | 后续可平滑扩到多账号、多通道通知和多站点 |
