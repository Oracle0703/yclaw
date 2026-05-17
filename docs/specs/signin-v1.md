# SPEC · Signin V1

> 状态：京东签到首期闭环已落地。本文档是自动签到能力的稳定规格入口；京东接口取证细节见 `docs/signin/jd-signin-investigation.md`。

## 1. 定位

| 项目 | 说明 |
| --- | --- |
| 模块入口 | `src/renderer/entries/signin/`，在 workbench 内以 `/signin` 路由加载 |
| 自动化复用入口 | `src/renderer/entries/automation/` 中也保留京东签到配置与状态卡 |
| 主进程子域 | `src/main/services/signin/`、`src/main/ipc/signin-handlers.ts` |
| 共享类型 | `src/shared/types/signin.ts` 与 `TaskFlow.signin` 元数据 |
| 目标 | 创建京东签到任务、采集登录态、立即执行、查看最近运行和历史记录 |

## 2. 当前已落地能力

| 能力 | 状态 | 代表实现 |
| --- | --- | --- |
| 独立自动签到页 | 已做 | `src/renderer/entries/signin/App.tsx` |
| 京东签到任务模型 | 已做 | `TaskFlow.kind = 'jd-signin'`、`signin.site = 'jd'` |
| 登录态采集 | 已做 | `SIGNIN_TASK_LOGIN_CAPTURE` 与浏览器会话复用 |
| API 优先执行 | 已做 | `JdSigninProvider` 查询余额、明细和签到状态后执行 |
| 浏览器兜底 | 已做 | API 失败或风控异常时打开页面补领 |
| 运行记录 | 已做 | `SigninRunRepository` 与 `signin_task_runs` 表 |
| 状态卡与历史 | 已做 | `SigninRunStatusCard`、独立签到页历史列表 |
| 通知配置 | 已做基础版 | Settings 中有 SMTP 草稿配置与测试邮件能力 |

## 3. 京东签到判断规则

| 优先级 | 信号 | 用途 |
| --- | --- | --- |
| 1 | `pc_interact_sign_query.signDetail.signList` 包含今日 | 判断今日已签到的最强信号 |
| 2 | `assignmentInfoList` 中 `PC签到领京豆` 的 `completionFlag` | 判断当前签到任务是否完成 |
| 3 | `BEAN_DETAILS_NOCNT` 今日明细 | 仅在签到状态接口不可用时作为辅助证据 |
| 4 | `BEAN_BALANCE` 余额差 | 计算本次到账京豆数 |

只允许从 `assignmentInfoList` 中匹配 `name = "PC签到领京豆"`、`extraType = "sign"`、`signType = 1` 的任务；不能把 `type:0` 的新人引导或抽奖任务当作 PC 签到。

## 4. 主链路

| 步骤 | 行为 |
| --- | --- |
| 1 | 用户在自动签到页或自动化页创建京东签到任务 |
| 2 | 用户打开京东登录态采集窗口，系统保存 Cookie/localStorage 诊断摘要 |
| 3 | 立即执行时，服务优先用会话请求查询签到状态、余额和京豆明细 |
| 4 | 未签到时，服务调用真正的 PC 签到执行接口 |
| 5 | 执行后再次查询余额和明细，计算本次获得京豆和当前余额 |
| 6 | API 路径失败时进入浏览器页面兜底补领 |
| 7 | 写入运行记录，并在状态卡展示最近结果和历史 |

## 5. 范围边界

| 范围 | 当前状态 |
| --- | --- |
| 站点 | 当前稳定支持京东 |
| 调度 | 已接入任务与重试分流；长期后台自动调度仍依赖自动化主线继续增强 |
| 通知 | 已有 SMTP 配置和测试邮件基础能力，真实 SMTP 长期联调仍需继续验证 |
| 安全 | 文档不保存 Cookie、token、pin、h5st、x-api-eid-token 原值 |
| 泛化 | 暂不承诺多站点签到模板市场 |

## 6. 测试覆盖

| 测试 | 覆盖 |
| --- | --- |
| `tests/unit/services/signin/JdSigninProvider.test.ts` | 京东状态识别、执行、到账计算与浏览器兜底 |
| `tests/unit/services/signin/SigninTaskService.test.ts` | 签到任务保存、执行和服务分流 |
| `tests/unit/services/repositories/SigninRunRepository.test.ts` | 运行记录持久化 |
| `tests/unit/ipc/signin-handlers.spec.ts` | IPC 边界 |
| `tests/unit/components/SigninTaskPanel.test.tsx` | 签到任务表单 |
| `tests/unit/components/SigninRunStatusCard.test.tsx` | 运行状态卡 |
| `tests/unit/components/SigninApp.test.tsx` | 独立签到页 |

## 7. 未完成项

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 历史记录分页/筛选 | 未完整 | 当前已有最近运行历史，复杂筛选仍可增强 |
| SMTP 真实服务长稳验证 | 未完整 | 已有客户端和测试入口，仍需真实环境覆盖 |
| API 签名上下文优化 | 未做 | 当前未生成京东 `h5st`，真实环境可能更依赖浏览器兜底 |
| 多站点支持 | 未做 | V1 只稳定承接京东 |

