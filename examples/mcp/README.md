# MCP 客户端配置示例

本目录提供外部 LLM 客户端连接 YClaw MCP Server 的最小配置模板。

## 使用方式

1. 将 `claude-desktop.json` 或 `cursor.json` 中的 `yclaw` 配置复制到对应客户端的 MCP 配置文件。
2. 把 `YCLAW_MCP_TOKEN` 替换为本机自定义 token。
3. 确保客户端启动命令的工作目录是 YClaw 仓库根目录，或将 `command` / `args` 调整为本机绝对路径启动脚本。
4. 重启 Claude Desktop / Cursor 后，在客户端工具列表中应能看到 YClaw 暴露的 MCP tools。

## 当前模式

- 示例默认使用 `stdio` transport，适合 Claude Desktop / Cursor 本机集成。
- 当前 CLI 侧保持只读模式，默认暴露任务、批次、日志和结果查询能力。
- 桌面应用内的 Embedded HTTP 模式可在「设置 → Embedded MCP HTTP」中启动，并通过 Bearer Token 鉴权。
