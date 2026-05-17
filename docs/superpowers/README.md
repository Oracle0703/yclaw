# Superpowers 过程产物

> 本目录保存 agent 工作流生成的过程文档，包括设计草案、实施计划和评审材料。它们是历史上下文，不是当前实现的唯一事实源。

## 阅读规则

| 目标 | 优先阅读 |
| --- | --- |
| 了解当前做到哪 | `docs/overview/current-status.md` |
| 了解稳定验收边界 | `docs/specs/` |
| 了解架构与目录 | `docs/architecture/` |
| 追溯某次 agent 设计或实施过程 | 本目录 |

## 子目录

| 目录 | 说明 |
| --- | --- |
| `specs/` | agent 生成的阶段性设计草案，稳定后应回写到 `docs/specs/` |
| `plans/` | agent 生成的实施计划，稳定后应回写到 `docs/plans/` 或对应 spec |
| `reviews/` | agent 评审模板、评审材料和过程记录 |

## 当前已提升为稳定文档的主题

| 过程主题 | 稳定文档 |
| --- | --- |
| 抖音分析台 / Browser HOT Workspace | `docs/specs/browser-hot-workspace-v1.md` |
| 热点监控 / TrendRadar 等价迁移 | `docs/specs/hot-monitor-v1.md` |
| 评论监控 / MediaCrawler 等价迁移 | `docs/specs/comment-monitor-v1.md` |
| MediaCrawler 外部执行器 | `docs/specs/comment-monitor-v1.md` |
| 自动签到 / 京东签到 | `docs/specs/signin-v1.md` |

新增或修改过程文档后，应把长期有效的实现事实回写到 `overview/`、`architecture/` 或 `specs/`，避免事实只散落在本目录。

