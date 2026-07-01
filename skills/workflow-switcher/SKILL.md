---
name: workflow-switcher
description: 初始化、诊断和切换本地 workflow skills source 到用户自定义 target 目录。仅当用户明确要求配置或切换 workflow-switcher 时使用。
---

# Workflow Switcher

本 skill 只是 CLI 的轻量入口，不内置任何 source、target 路径或团队配置。

当用户需要初始化时，优先建议在终端运行：

```bash
workflow-switcher setup
```

当用户已经提供明确参数时，可以调用非交互命令：

```bash
workflow-switcher source add <source-name> <skills-dir>
workflow-switcher target add <target-name> <active-skills-dir>
workflow-switcher use <source-name> --target <target-name>
workflow-switcher doctor
workflow-switcher status
```

切换完成后，提醒用户新开对应智能体会话或重启客户端，让 skills 列表刷新。
