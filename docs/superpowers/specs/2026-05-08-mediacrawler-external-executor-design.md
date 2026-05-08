# MediaCrawler 外部执行器设计

## 1. 目标

| 项目 | 说明 |
| --- | --- |
| 集成方式 | 将用户本地已有的 MediaCrawler 仓库作为外部执行器调用 |
| 平台范围 | `xhs`、`dy`、`ks`、`bili`、`wb`、`tieba`、`zhihu` |
| 入口类型 | 映射 MediaCrawler 的 `search`、`detail`、`creator` |
| YClaw 职责 | 配置、启动、日志、退出码、结果导入、报告复用 |
| 边界 | 不复制 MediaCrawler 源码，不绕过验证码/风控，不默认代理池/大规模并发 |

## 2. 架构

| 层级 | 新增内容 | 职责 |
| --- | --- | --- |
| Shared 类型 | `MediaCrawler*` 类型 | 平台、登录方式、配置、运行结果 |
| Main 服务 | `MediaCrawlerCommandBuilder` | 生成 `python main.py ...` 命令 |
| Main 服务 | `MediaCrawlerResultImporter` | 扫描 JSON/JSONL 输出并归一为 `CommentItem` |
| Main 服务 | `MediaCrawlerExternalExecutor` | 调用 child process、写日志、导入结果 |
| IPC | `comment:mediacrawler:*` | 配置读写、测试、启动 |
| Renderer | 评论监控配置区 | 后续增加外部执行器路径与模式配置 |

## 3. 配置

| 字段 | 说明 |
| --- | --- |
| `repoPath` | MediaCrawler 本地仓库根目录，必须包含 `main.py` |
| `pythonPath` | Python 可执行文件，默认 `python` |
| `outputDir` | MediaCrawler 输出目录，默认使用仓库下 `data` |
| `loginType` | `qrcode`、`phone`、`cookie`、`browser` |
| `enabled` | 是否启用外部执行器 |

配置保存在 `AppConfig.modules.commentMonitor.settings.mediaCrawler`。

## 4. 执行流程

| 步骤 | 说明 |
| --- | --- |
| 1 | 用户配置 MediaCrawler 仓库路径 |
| 2 | 评论源选择平台与入口 |
| 3 | YClaw 创建 batch，并启动外部进程 |
| 4 | stdout/stderr 进入 execution log |
| 5 | 进程结束后扫描输出目录 |
| 6 | JSON/JSONL 记录归一为 YClaw `CommentItem` |
| 7 | 写入 `ResultService`，页面与报告复用现有评论链路 |

## 5. 命令映射

| YClaw 字段 | MediaCrawler 参数 |
| --- | --- |
| `platform` | `--platform` |
| `entryKind: keyword` | `--type search` |
| `entryKind: note` | `--type detail` |
| `entryKind: creator` | `--type creator` |
| `loginType` | `--lt` |
| `entryValue` | 先作为通用关键词/ID 参数候选，缺失上游参数时写入日志提示 |

## 6. 结果导入

导入器按宽松字段映射处理不同平台输出：

| YClaw 字段 | 候选字段 |
| --- | --- |
| `commentId` | `comment_id`、`commentId`、`id` |
| `content` | `content`、`text`、`comment_content` |
| `authorName` | `nickname`、`user_nickname`、`authorName` |
| `authorId` | `user_id`、`authorId` |
| `contentId` | `note_id`、`aweme_id`、`video_id`、`contentId` |
| `likeCount` | `like_count`、`likes` |
| `parentCommentId` | `parent_comment_id`、`parentCommentId` |

## 7. 错误处理

| 错误 | 行为 |
| --- | --- |
| 未配置仓库 | 启动失败，提示配置 MediaCrawler 路径 |
| 无 `main.py` | 启动失败 |
| Python 退出码非 0 | batch 失败并记录 stderr |
| 无输出文件 | batch 成功但导入 0 条，并写 warn log |
| 解析失败 | 单文件失败写 warn，其他文件继续导入 |

## 8. 测试

| 测试 | 覆盖 |
| --- | --- |
| `MediaCrawlerCommandBuilder.test.ts` | 七平台和三入口命令映射 |
| `MediaCrawlerResultImporter.test.ts` | JSON/JSONL 导入、字段归一、脏数据跳过 |
| `MediaCrawlerExternalExecutor.test.ts` | spawn 调用、日志、退出码、导入结果 |
| `comment-handlers.spec.ts` | IPC 注册与 payload 校验 |
| `AppComposition.test.ts` | app 注入 executor |

## 9. 手动使用

| 步骤 | 操作 |
| --- | --- |
| 1 | 在本机准备 MediaCrawler 仓库，并按该仓库说明安装 Python 依赖 |
| 2 | 在 YClaw 打开“评论监控”，点击“外部执行器” |
| 3 | 填写 MediaCrawler 仓库路径、Python 路径、输出目录与登录方式 |
| 4 | 点击“保存配置”，再点击“测试连接”确认仓库根目录下存在 `main.py` |
| 5 | 先创建或选择一个评论源，并至少有一个运行批次 |
| 6 | 点击“外部采集”，YClaw 会调用外部 `python main.py` 并在进程结束后导入 JSON/JSONL 评论结果 |

| 注意项 | 说明 |
| --- | --- |
| 登录态 | 平台登录、验证码、风控处理仍由用户在 MediaCrawler 或对应浏览器会话中完成 |
| 依赖 | YClaw 不安装 MediaCrawler 依赖，也不复制 MediaCrawler 源码 |
| 无结果 | 若 MediaCrawler 输出目录没有可识别的评论 JSON/JSONL 文件，本次导入会是 0 条 |
| 平台展示 | 当前评论结果管线仍以 `xhs`、`douyin` 为主；七平台外部执行已接入，精确平台展示可在后续扩展 `CommentPlatform` |
