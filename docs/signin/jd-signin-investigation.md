# 京东 PC 签到领京豆录制分析报告

日期：2026-04-29

## 结论摘要

| 结论 | 依据 |
|---|---|
| 京东 PC 签到已能通过录制区分“是否可签到” | `pc_interact_sign_query` 中 `assignmentInfoList[0].name = "PC签到领京豆"`，且点击前 `completionFlag: false`、点击后 `completionFlag: true` |
| 真正签到执行接口是 `pc_interact_sign_execute` | 真正点击“PC签到领京豆”后，请求体为 `{"type":5,"eaId":"4KpUNjgQZtanUeeqbhMYjT47b9Fo","itemId":"1","extraType":"sign"}`，响应 `success: true` |
| 本次实际到账数量不能只看签到配置奖励列表 | `pc_interact_sign_query.rewards` 是候选/规则配置，实际到账需看 `BEAN_BALANCE` 余额差或 `BEAN_DETAILS_NOCNT` 明细 |
| 本次用户实际获得 `2` 京豆 | 签到前 `BEAN_BALANCE.data.balance = 0`，签到后 `BEAN_BALANCE.data.balance = 2`；明细首条 `userVisibleInfo = "活动奖励京豆"`、`amount = 2` |
| 自动化实现采用 API 优先、浏览器兜底 | 先复用 Electron 会话 Cookie 调用余额/明细与 `pc_interact_sign_execute`；若京东动态签名或风控导致 API 失败，再回落浏览器页面补领 |

## 录制文件清单

| 文件 | 录制目的 | 关键发现 |
|---|---|---|
| `yclaw-investigation-jd-1777452077686.json` | 登录后首页/入口探索 | 已有京东 Cookie/localStorage 登录态，但未进入真正签到页 |
| `yclaw-investigation-jd-1777453030662.json` | 进入互动中心但未点击真正 PC 签到 | 能看到 `PC签到领京豆` 未完成；同时暴露一次误判：`type:0` 的 execute 不是 PC 签到 |
| `yclaw-investigation-jd-1777454538978.json` | 点击真正“PC签到领京豆” | 抓到真正执行请求体，并确认签到状态变为完成、余额变为 2 |
| `yclaw-investigation-jd-1777454808208.json` | 从主页进入“我的京豆”查看余额/明细 | 抓到稳定余额接口 `BEAN_BALANCE` 和明细接口 `BEAN_DETAILS_NOCNT` |

## 接口证据

### 1. 签到状态查询：`pc_interact_sign_query`

录制来源：`yclaw-investigation-jd-1777453030662.json`

请求体：

```json
{
  "type": 1
}
```

点击前核心响应：

```json
{
  "success": true,
  "data": {
    "assignmentInfoList": [
      {
        "id": "4KpUNjgQZtanUeeqbhMYjT47b9Fo",
        "name": "PC签到领京豆",
        "type": 5,
        "extraType": "sign",
        "signType": 1,
        "completionFlag": false,
        "completionCnt": 0,
        "signDetail": {
          "status": 1,
          "itemId": "1",
          "continueSignDay": 0
        }
      }
    ]
  }
}
```

录制来源：`yclaw-investigation-jd-1777454538978.json`

点击后核心响应：

```json
{
  "success": true,
  "data": {
    "assignmentInfoList": [
      {
        "id": "4KpUNjgQZtanUeeqbhMYjT47b9Fo",
        "name": "PC签到领京豆",
        "type": 5,
        "extraType": "sign",
        "signType": 1,
        "completionFlag": true,
        "completionCnt": 1,
        "signDetail": {
          "status": 2,
          "itemId": "1",
          "continueSignDay": 1
        }
      }
    ]
  }
}
```

分析方式：

| 字段 | 含义 | 判断 |
|---|---|---|
| `name` | 任务名称 | 必须是 `PC签到领京豆`，不能把抽奖任务混进来 |
| `extraType` | 任务类型 | `sign` 表示签到类 |
| `signType` | 签到子类型 | `1` 对应 PC 签到领京豆；`0` 对应每日免费抽奖机会 |
| `completionFlag` | 是否完成 | `false` 可签到，`true` 已签到 |
| `completionCnt` | 完成次数 | `0` 未完成，`1` 已完成 |

### 2. 真正签到执行：`pc_interact_sign_execute`

误判请求，录制来源：`yclaw-investigation-jd-1777453030662.json`

```json
{
  "type": 0,
  "eaId": "task"
}
```

响应：

```json
{
  "success": false,
  "errCode": "302",
  "errMessage": "任务已完成"
}
```

修正结论：这不是 `PC签到领京豆`，而是“领取今日免费抽奖机会/新人引导”一类任务。不能用这条响应判断 PC 签到已完成。

真正请求，录制来源：`yclaw-investigation-jd-1777454538978.json`

```json
{
  "type": 5,
  "eaId": "4KpUNjgQZtanUeeqbhMYjT47b9Fo",
  "itemId": "1",
  "extraType": "sign"
}
```

响应：

```json
{
  "success": true,
  "data": {}
}
```

分析方式：

| 判断条件 | 说明 |
|---|---|
| `type = 5` | 与 `PC签到领京豆` 任务 `type` 对齐 |
| `eaId` | 与 `pc_interact_sign_query.assignmentInfoList[0].id` 对齐 |
| `itemId = "1"` | 与 `signDetail.itemId` 对齐 |
| `extraType = "sign"` | 明确是签到任务 |
| 响应 `success: true` | 执行请求被京东接受，但仍需再查余额确认到账 |

### 3. 当前京豆余额：`BEAN_BALANCE`

互动中心来源，录制文件：`yclaw-investigation-jd-1777454538978.json`

返回：

```json
{
  "msg": "request success",
  "code": "0000",
  "data": {
    "balance": 2,
    "balanceStr": "0.02"
  }
}
```

我的京豆页来源，录制文件：`yclaw-investigation-jd-1777454808208.json`

请求：

```http
POST https://api.m.jd.com/api?functionId=BEAN_BALANCE&appid=asset-h5
```

表单体：

```text
appid=asset-h5&loginType=3&functionId=BEAN_BALANCE&body=%7B%7D&client=pc&_t=1777454804289
```

返回：

```json
{
  "msg": "request success",
  "code": "0000",
  "data": {
    "balance": 2,
    "balanceStr": "0.02"
  }
}
```

分析方式：

| 字段 | 含义 |
|---|---|
| `data.balance` | 当前账户京豆整数余额 |
| `data.balanceStr` | 页面展示金额格式，`0.02` 对应 2 京豆 |

### 4. 京豆明细：`BEAN_DETAILS_NOCNT`

录制来源：`yclaw-investigation-jd-1777454808208.json`

请求：

```http
POST https://api.m.jd.com/api?functionId=BEAN_DETAILS_NOCNT&appid=asset-h5
```

请求体：

```json
{
  "pageNo": 1,
  "pageSize": 10,
  "dataType": 0
}
```

核心响应：

```json
{
  "msg": "request success",
  "code": "0000",
  "data": {
    "list": [
      {
        "userVisibleInfo": "活动奖励京豆",
        "createDate": 1777454533000,
        "amount": 2,
        "amountLong": 2
      }
    ]
  }
}
```

分析方式：

| 字段 | 含义 |
|---|---|
| `userVisibleInfo` | 明细来源文案，本次为“活动奖励京豆” |
| `amount` / `amountLong` | 本条明细的京豆变动，本次为 `2` |
| `createDate` | 明细产生时间，可用于与本次执行时间窗口对齐 |

## 自动化实现建议

| 阶段 | 动作 | 成功判断 |
|---|---|---|
| 准备 | 通过“打开浏览器采集登录态”保存京东 Cookie/localStorage 到指定 Electron 会话 | 后续任务能复用同一会话访问京东接口 |
| 执行前 | 通过会话 API 查询 `BEAN_BALANCE` 与 `BEAN_DETAILS_NOCNT` | 得到执行前余额；若今天已有“活动奖励京豆”，直接返回成功且不打开页面 |
| API 执行 | 通过会话 API 调用 `pc_interact_sign_execute`，请求体使用录制确认的 `type/eaId/itemId/extraType` | 响应 `success: true`，或“任务已完成”可继续进入验证 |
| 执行后 | 再查 `BEAN_BALANCE` 与 `BEAN_DETAILS_NOCNT` | 得到执行后余额与最近明细 |
| 验证 | 优先使用今日“活动奖励京豆”明细，其次使用余额差，再其次使用 execute 返回奖励 | 返回“本次获得 N 京豆，当前余额 M 京豆” |
| 兜底 | 如果 API 执行失败，打开 `https://interact.jd.com/` 执行页面脚本补领 | 避免京东动态签名字段变化时直接中断任务 |
| 返回 | 写入运行记录 detail | 包含“本次获得 N 京豆，当前余额 M 京豆” |

## 后续变化时的对比方法

如果京东页面或接口变化，重新录制后按以下顺序复查：

| 对比点 | 预期 | 变化风险 |
|---|---|---|
| `pc_interact_sign_query` 是否仍返回 `PC签到领京豆` | 能找到任务对象 | 活动迁移或任务名变化 |
| `assignmentInfoList[].id` 是否仍作为 execute 的 `eaId` | 二者一致 | 字段名变化 |
| execute 请求体是否仍为 `type/eaId/itemId/extraType` | 与本报告一致 | 新增风控字段 |
| execute 是否仍需 `h5st` / `x-api-eid-token` | 当前实现先尝试会话 API，失败后浏览器兜底 | 签名算法升级或风控收紧 |
| `BEAN_BALANCE` 是否仍返回 `balance/balanceStr` | 返回当前余额 | 接口迁移 |
| `BEAN_DETAILS_NOCNT` 是否仍有 `amount/userVisibleInfo` | 可识别到账明细 | 明细接口迁移 |

## 敏感信息处理

本报告不保存 Cookie、token、pin、h5st、x-api-eid-token 原值。复查时只需要对比接口名、请求体结构、响应字段和数值变化。
