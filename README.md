# Workflow Switcher

Workflow Switcher 是一个跨平台本地 CLI 脚手架，用于把用户自定义的 workflow skills `source` 切换到一个或多个智能体 `target` 的 active skills 目录。

它的核心目标是：同一时间每个 target 只暴露一套 workflow，减少 Codex、Claude 等智能体在自动命中 skills 时的冲突。

## 设计边界

- 支持 macOS 和 Windows。
- 使用 symlink only，不使用 copy fallback，不使用 junction fallback。
- 可以内置智能体名称选项，例如 `Codex`、`Claude`、`自定义`。
- 不内置任何 active skills 默认路径，所有 target 路径都必须由用户手动输入。
- 不内置任何 source 名称、团队分类或业务路径。
- 第一阶段不发布 npm，不打包二进制，通过安装脚本分发 Node.js CLI。

## 核心概念

`source` 表示一套 workflow skills 源目录。

`target` 表示某个智能体实际读取 active skills 的目录。

示例：

```text
source:
  V5 -> /Users/yangqy/workspace/seeyon-new/ai-toolkit/skills
  ZW -> /Users/yangqy/workspace/1st/ai-toolkit/skills

target:
  codex  -> 用户手动输入的 Codex active skills 目录
  claude -> 用户手动输入的 Claude active skills 目录
```

## 安装

macOS/Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/yangquanyun/workflow-switcher-plugin/main/scripts/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/yangquanyun/workflow-switcher-plugin/main/scripts/install.ps1 | iex
```

安装脚本会检查 Node.js 版本。当前实现要求 Node.js 18 或更高版本。

## 本地开发

```bash
node bin/workflow-switcher.mjs help
node bin/workflow-switcher.mjs setup
```

## 常用命令

```bash
workflow-switcher setup
workflow-switcher source add
workflow-switcher source list
workflow-switcher source remove <name>

workflow-switcher target add
workflow-switcher target list
workflow-switcher target remove <name>

workflow-switcher use <source>
workflow-switcher use <source> --target <target>
workflow-switcher use <source> --target all

workflow-switcher current
workflow-switcher status
workflow-switcher doctor
```

## 首次配置示例

运行：

```bash
workflow-switcher setup
```

交互中可以选择智能体名称：

```text
1. Codex
2. Claude
3. 自定义
```

注意：选择 `Codex` 或 `Claude` 后，工具仍会要求你手动输入 active skills 目录，不会预填任何默认路径。

添加 source 时，所有名称和路径也由用户输入。例如：

```text
source 名称: V5
source skills 目录: /Users/yangqy/workspace/seeyon-new/ai-toolkit/skills

source 名称: ZW
source skills 目录: /Users/yangqy/workspace/1st/ai-toolkit/skills
```

## 根附属项

source 目录可能不只是 skill 目录集合，还可能包含 workflow 级共享依赖。

当 source 根目录存在以下任意标记时：

```text
WORKFLOW.md
WORKFLOW-DETAILS.md
TEMPLATE-STANDARD.md
.best-practices
.scripts
templates
```

工具会把这些存在的根附属项一起 symlink 到 target：

```text
README.md
WORKFLOW.md
WORKFLOW-DETAILS.md
TEMPLATE-STANDARD.md
.best-practices
.scripts
templates
```

这些根附属项会写入 `.workflow-switcher.json` 的 `managedRootEntries`，后续切换时只清理受控项。

## 切换流程

`workflow-switcher use <source>` 会执行：

```text
1. 读取配置。
2. 校验 source 和 target。
3. 扫描 SKILL.md，并解析 frontmatter name。
4. 校验重复 skill name。
5. 识别根附属项。
6. 检查 target 目录可写。
7. 检查文件 symlink 和目录 symlink 权限。
8. 检查非受控同名冲突。
9. 全部通过后清理旧受控 symlink。
10. 创建新的 symlink。
11. 写入 .workflow-switcher.json。
```

切换完成后，请新开对应智能体会话或重启客户端，让 skills 列表刷新。

## Windows 权限

Windows 创建 symlink 需要系统权限。Workflow Switcher 不会自动 fallback 到 junction 或 copy。

如果 `doctor` 或 `use` 提示无法创建符号链接，请任选一种方式处理：

```text
1. 开启 Developer Mode。
2. 让管理员授予 Create symbolic links 权限。
3. 以管理员身份运行终端。
```

修复后执行：

```bash
workflow-switcher doctor
workflow-switcher use <source>
```

## 安全边界

- 只删除 `.workflow-switcher.json` 中记录的受控 symlink。
- 遇到非受控同名文件或目录时，阻止切换。
- symlink preflight 失败时，不清理旧链接，不写入新状态。
- `source remove` 和 `target remove` 只删除配置，不删除用户目录。
