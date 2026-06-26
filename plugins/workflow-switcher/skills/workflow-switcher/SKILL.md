---
name: workflow-switcher
description: 显式初始化、查看和切换本地工作流 skills 分类，把用户自定义分类的 skills 源目录投影到 Codex、Claude 或其他 agent 的 active skills 目录。仅当用户调用 $workflow-switcher，或要求配置/切换/查看本地 skills 分类、管理 Codex/Claude skills 目录、初始化本机 skills 源路径和 agent target 目标路径时使用。
---

# Workflow Switcher

本技能是本地 skills 工作流的显式控制入口。它不内置分类名称和 skills 路径；首次使用必须由用户按本机环境初始化。

运行随附脚本：

```bash
node <skill-dir>/scripts/workflow-switcher.mjs <arguments>
```

首次安装后初始化分类。分类名由用户决定：

```bash
node <skill-dir>/scripts/workflow-switcher.mjs init --profile <分类名>=<skills源路径>
```

macOS 示例：

```bash
node <skill-dir>/scripts/workflow-switcher.mjs init --profile V5=/Users/<user>/workspace/seeyon-new/ai-toolkit/skills --profile ZW=/Users/<user>/workspace/1st/ai-toolkit/skills --target-path codex=/Users/<user>/.codex/skills
```

Windows PowerShell 示例：

```powershell
node <skill-dir>/scripts/workflow-switcher.mjs init --profile "V5=C:\Users\<user>\workspace\seeyon-new\ai-toolkit\skills" --profile "ZW=C:\Users\<user>\workspace\1st\ai-toolkit\skills" --target-path "codex=C:\Users\<user>\.codex\skills"
```

根目录附属项默认使用 `auto` 模式。遇到 `WORKFLOW.md`、`TEMPLATE-STANDARD.md`、`.best-practices`、`.scripts`、`templates` 等共享工作流依赖时会自动纳入；普通根目录 `README.md` 不会单独触发纳入。ai-toolkit 这类目录通常不需要手动传 `--root-entry`，只有自动识别不符合预期时才使用高级覆盖参数：

```bash
node <skill-dir>/scripts/workflow-switcher.mjs init --root-mode <分类名>=none
```

常用命令：

```bash
node <skill-dir>/scripts/workflow-switcher.mjs profiles
node <skill-dir>/scripts/workflow-switcher.mjs status
node <skill-dir>/scripts/workflow-switcher.mjs discover
node <skill-dir>/scripts/workflow-switcher.mjs discover <分类名>
node <skill-dir>/scripts/workflow-switcher.mjs switch <分类名>
```

target 表示不同 agent 的 active skills 目录：

```bash
node <skill-dir>/scripts/workflow-switcher.mjs init --target-path claude=~/.claude/skills --enable-target claude

node <skill-dir>/scripts/workflow-switcher.mjs switch <分类名> --target codex
node <skill-dir>/scripts/workflow-switcher.mjs switch <分类名> --target claude
node <skill-dir>/scripts/workflow-switcher.mjs switch <分类名> --target all
```

当用户要预览切换影响时使用 `--dry-run`。仅当用户明确希望替换阻塞切换的现有符号链接时使用 `--force`。

macOS/Linux 默认使用符号链接。Windows 在 `auto` 策略下会对目录使用 junction；如果目标机器不允许创建链接，可使用 `--link-strategy copy`。

脚本输出、插件描述和提示文案保持中文。命令名、路径、配置字段、分类名和 target 名保持英文或用户输入的原始名称。

每次成功切换后，提醒用户新开 Codex/Claude 线程或重启对应应用，让技能列表完全刷新。
