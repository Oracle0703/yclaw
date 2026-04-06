# YClaw Plugin Template

插件开发模板。复制此目录开始开发新插件。

## 结构

```
plugin-name/
├── plugin.json      # 插件元信息
├── package.json
├── src/
│   ├── index.ts     # 入口 (activate/deactivate)
│   └── ui/          # 可选 UI
└── dist/            # 构建产物
```

## plugin.json 字段

| 字段 | 必填 | 说明 |
|------|:----:|------|
| name | ✅ | 唯一标识，小写字母 + 连字符 |
| version | ✅ | 语义化版本 |
| displayName | ✅ | 显示名称 |
| description | ✅ | 简短描述 |
| main | ✅ | 入口文件路径 |
| ui | ❌ | UI 入口 HTML |
| permissions | ✅ | 权限声明数组 |
| permissionLevel | ✅ | 1/2/3 权限等级 |
| engines.yclaw | ✅ | 兼容版本范围 |
