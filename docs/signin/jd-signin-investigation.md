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
| `yclaw-investigation-jd-1777523993065.json` | 次日再次签到并复查余额/状态 | 再次出现真正 `type:5` PC 签到执行；`BEAN_DETAILS_NOCNT` 新增 `amount: 2`；`BEAN_BALANCE.balance = 4`；`pc_interact_sign_query` 返回 `signList: ["2026-04-29_1.0","2026-04-30_1.0"]` + `continueSignDay: 2` |

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
| 执行前 | 通过会话 API 查询 `BEAN_BALANCE`、`BEAN_DETAILS_NOCNT` 和 `pc_interact_sign_query` | 得到执行前余额；仅当 `sign_query` 显示今日已签到时直接返回成功 |
| API 执行 | 通过会话 API 调用 `pc_interact_sign_execute`，请求体使用录制确认的 `type/eaId/itemId/extraType` | 响应 `success: true`，或“任务已完成”可继续进入验证 |
| 执行后 | 再查 `BEAN_BALANCE` 与 `BEAN_DETAILS_NOCNT` | 得到执行后余额与最近明细 |
| 验证 | 优先使用 `sign_query.signList` / `completionFlag` 判断已签到；到账数量优先用今日明细，其次用余额差，再其次用 execute 返回奖励 | 返回“本次获得 N 京豆，当前余额 M 京豆” |
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

## 2026-04-30 补充：新录制 1777523993065 发现

补充录制 `yclaw-investigation-jd-1777523993065.json` 揭示了两个原报告未覆盖的重要字段、一个代码逻辑漏洞，并验证 2026-04-30 当天再次成功领取京豆。

### 0. 今日领取结果

本次录制中，真正 PC 签到请求仍然是：

```json
{
  "type": 5,
  "eaId": "4KpUNjgQZtanUeeqbhMYjT47b9Fo",
  "itemId": "1",
  "extraType": "sign"
}
```

执行后 `BEAN_DETAILS_NOCNT` 最新明细新增：

```json
{
  "userVisibleInfo": "活动奖励京豆",
  "createDate": 1777523982000,
  "amount": 2,
  "amountLong": 2
}
```

同时 `BEAN_BALANCE` 返回：

```json
{
  "data": {
    "balance": 4,
    "balanceStr": "0.04"
  }
}
```

结论：2026-04-30 当天本次签到到账 `2` 京豆，当前总豆数 `4` 京豆。与 2026-04-29 的 `2` 京豆余额相比，余额差同样是 `+2`。

### 1. 新字段：`signDetail.signList` 与 `continueSignDay`

今日已签到后，`pc_interact_sign_query` 返回：

```json
{
  "signDetail": {
    "status": 2,
    "itemId": "1",
    "continueSignDay": 2,
    "signList": ["2026-04-29_1.0", "2026-04-30_1.0"]
  },
  "completionFlag": true,
  "completionCnt": 1
}
```

| 字段 | 含义 | 重要性 |
|---|---|---|
| `signList` | 字符串数组，格式 `YYYY-MM-DD_x.x`，记录近几次签到日期 | **“今日是否已签到”的最强信号**；遇到开今日前缀即可认定 |
| `continueSignDay` | 连续签到天数 | 可以写入 detail，帮助用户识别连续进度 |

### 2. 新字段：`data.newUserGuideTask`

`pc_interact_sign_query` 响应中出现与 `assignmentInfoList` 同级的独立字段：

```json
{
  "newUserGuideTask": {
    "id": "47XrT5DBdtx1vu5f1kAAqQTEqkXx",
    "name": "新人引导签到",
    "type": 0
  }
}
```

再次证明“不能用 `type:0` 的 `errCode:302` 结果判定 PC 签到完成”。代码需仅从 `assignmentInfoList` 中按 `name='PC签到领京豆' && extraType='sign' && signType=1` 筛选，不能误取 `newUserGuideTask`。

### 3. 逻辑漏洞：不能用 `BEAN_DETAILS_NOCNT` 首条作为“今日已签到”短路

原实现（修复前）在 `run()` 的第一步就用 `BEAN_DETAILS_NOCNT` 首条 `userVisibleInfo === '活动奖励京豆'` 且 `createDate` 是今天来短路。但 `活动奖励京豆` 是京东多个活动（京豆抽奖、游戏奖励、任务中心等）的通用文案，可能误把非签到京豆认作今日签到证据，从而 **跳过真正的 PC 签到执行**。

修复后的优先级（权威 → 辅助）：

| 次序 | 权威信号 | 依据 |
|---|---|---|
| 1 | `pc_interact_sign_query.signDetail.signList` 包含今日 | 最强，京东专为签到集中记录 |
| 2 | `pc_interact_sign_query.assignmentInfoList[].completionFlag === true` | 次强，但仅是日级布尔 |
| 3 | `BEAN_DETAILS_NOCNT` 首条今日 + `活动奖励京豆` | **仅在 sign_query 不可用时**作为启发式判定 |
| 4 | execute 后 `BEAN_BALANCE` 余额差 | 用于执行后量化到账京豆数 |

### 4. 调用形式差异：页面的 query/execute 带 `h5st` 签名

录制中页面发起的 `pc_interact_sign_query` URL 实际为：

```
GET https://api.m.jd.com/?h5st=20260430123945451%3B...&body=%7B%22type%22%3A1%7D&functionId=pc_interact_sign_query&appid=pc_interact_center
```

2026-04-29 的互动中心录制使用过 `appid=pc_interact_center`；2026-04-30 从京豆页触发的同类 query/execute 则出现在 `appid=asset-h5` 上。两种形式的核心业务字段没有变化，仍是 `functionId`、`body.type`、`eaId`、`itemId` 和 `extraType`。

本代码使用 POST `https://api.m.jd.com/api?functionId=pc_interact_sign_query&appid=pc_interact_center` 加 form body，不携带 `h5st`。现阶段可能被风控拒绝，已靠“打开 https://interact.jd.com/ 补领”的浏览器兜底兜住。后续若需提高 API 路径的成功率，可以考虑在浏览器中执行脚本采集一次 `h5st` 生成函数调用上下文。

## 2026-04-30 代码符合性复查

复查文件：`src/main/services/signin/JdSigninProvider.ts` 与 `tests/unit/services/signin/JdSigninProvider.test.ts`。

| 分析要求 | 当前实现 | 结论 |
|---|---|---|
| 必须先识别 `PC签到领京豆` 任务，不能误用 `type:0` | `tryReadSignTaskInfo()` 只从 `assignmentInfoList` 中匹配 `name = "PC签到领京豆"`、`extraType = "sign"`、`signType = 1` | 符合 |
| 今日已签到优先看 `signDetail.signList` | `run()` 在执行前使用 `signTaskInfo.signedToday || signTaskInfo.completionFlag` 短路；`signedToday` 来自今日日期前缀匹配 `signList` | 符合 |
| `BEAN_DETAILS_NOCNT` 不能单独作为权威短路 | 只有 `sign_query` 不可用时，才用今日 `活动奖励京豆` 明细作为启发式短路 | 符合 |
| 真正执行请求必须是 `type:5 / eaId / itemId / extraType:"sign"` | `tryExecuteApiSignin()` 使用 query 动态返回的 `eaId`、`itemId`，失败时才用录制回退值 | 符合 |
| 到账数量需用明细或余额差确认 | API 执行后再次读取余额/明细，按今日明细金额、余额差、execute 奖励的顺序计算 `earnedBeans` | 符合 |
| API 签名/风控失败要浏览器兜底 | API 失败、无证据的 `302`、或 fetch 异常都会返回 `null` 并进入浏览器脚本流程 | 符合 |

现有单测已覆盖：`signList` 权威短路、动态 `eaId` 执行、`completionFlag` 短路、`302` 无证据时浏览器兜底。仍需关注的风险是：当前 API 路径没有生成 `h5st`，因此真实环境可能频繁依赖浏览器兜底；如果后续要减少兜底比例，需要把 query/execute 放到页面签名上下文中执行。
