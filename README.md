# 工作流切换器

工作流切换器用于把用户自定义分类的本地 skills 投影到 Codex、Claude 或其他 agent 的 active skills 目录。分类名称、skills 源路径、agent 目标路径都在初始化时由使用者按本机环境传入。

## 在线安装

团队成员可以从 GitHub marketplace 源安装：

```bash
codex plugin marketplace add https://github.com/yangqy/workflow-switcher-plugin
codex plugin add workflow-switcher@workflow-switcher
```

## 本地开发安装

开发本插件时可以添加本地 marketplace：

```bash
codex plugin marketplace add /Users/yangqy/workflow-switcher-plugin
codex plugin add workflow-switcher@workflow-switcher
```

## 首次初始化

安装后先初始化。初始化时要区分两个路径概念：

- skills 源路径：真实存放某一类 skills 的目录，例如团队规范仓库里的 `skills` 目录。
- target 目标路径：某个 agent 当前读取 skills 的目录，例如 Codex 的 `~/.codex/skills`。

### macOS 示例

下面的分类名只是示例，使用者可以替换为任意有意义的名称：

```bash
$workflow-switcher init \
  --profile work=/Users/<user>/workspace/ai-toolkit/skills \
  --profile writing=/Users/<user>/skills \
  --target-path codex=/Users/<user>/.codex/skills
```

启用 Claude target：

```bash
$workflow-switcher init \
  --target-path claude=/Users/<user>/.claude/skills \
  --enable-target claude
```

### Windows PowerShell 示例

下面的分类名同样只是示例：

```powershell
$workflow-switcher init `
  --profile work="$env:USERPROFILE\workspace\ai-toolkit\skills" `
  --profile writing="$env:USERPROFILE\skills" `
  --target-path codex="$env:USERPROFILE\.codex\skills"
```

启用 Claude target：

```powershell
$workflow-switcher init `
  --target-path claude="$env:USERPROFILE\.claude\skills" `
  --enable-target claude
```

默认配置文件：

```text
~/.config/workflow-switcher/config.json
```

## 根目录附属项

通常不需要手动配置根目录附属项。插件默认使用 `auto` 模式：

- 如果 skills 根目录存在 `WORKFLOW.md`、`TEMPLATE-STANDARD.md`、`.best-practices`、`.scripts`、`templates` 等共享工作流依赖，会自动把这些根附属项一起投影。
- 如果只是普通个人 skills 目录，即使根目录有 `README.md`，也不会单独触发根附属项投影。

需要覆盖默认行为时再使用高级选项：

```bash
$workflow-switcher init --root-mode work=none
$workflow-switcher init --root-mode work=manual --root-entry work:README.md
```

## 切换与查看

```bash
$workflow-switcher profiles
$workflow-switcher status
$workflow-switcher discover
$workflow-switcher discover <分类名>
$workflow-switcher switch <分类名> --target codex
$workflow-switcher switch <分类名> --target all
```

切换前预览：

```bash
$workflow-switcher switch <分类名> --target codex --dry-run --force
```

## 多 agent target

`target` 表示不同 agent 的 active skills 目录。默认启用 `codex`，预置但不启用 `claude`。其他 agent 如果也读取本地 skills 目录，可以按同样方式增加：

```bash
$workflow-switcher init \
  --target-path my-agent=/path/to/my-agent/skills \
  --enable-target my-agent

$workflow-switcher switch <分类名> --target my-agent
```

## macOS 与 Windows 兼容性

- macOS/Linux：`auto` 策略默认使用符号链接。
- Windows：`auto` 策略对目录默认使用 junction，减少管理员权限和 Developer Mode 依赖。
- 如果目标机器无法创建链接，可以初始化或切换时使用 `--link-strategy copy`，改为复制受控项。

```bash
$workflow-switcher init --link-strategy copy
```

## 不同 agent 上如何使用

- Codex：安装插件后直接使用 `$workflow-switcher ...`。
- Claude：Claude 不安装 Codex 插件；把 Claude 的 skills 目录配置为 target 后，由 Codex 执行切换命令管理 `~/.claude/skills`。
- 其他 agent：如果它有兼容的本地 skills 目录，就通过 `--target-path <名称>=<路径>` 注册；如果没有兼容目录，则不能直接复用 Codex 插件能力。

## 安全边界

- 只清理状态文件 `.workflow-switcher.json` 记录过的受控项。
- 普通文件和目录默认不会被覆盖。
- `--force` 只接管已知分类中同名的符号链接。
- 切换后请新开 Codex/Claude 线程或重启对应应用，让技能列表完全刷新。
