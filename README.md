# Workflow Switcher

Workflow Switcher 是一个本地命令行工具，用来在不同工作流之间切换可用的 agent skills。

当你同时维护多套业务工作流时，例如一套用于 V5 项目、一套用于 ZW 项目，如果把所有 skills 都放进 codex、claude 等智能体的 skills 目录，智能体可能会自动命中错误的 workflow。Workflow Switcher 的作用就是让每个智能体在同一时间只看到你当前选择的那一套工作流。

它支持 macOS 和 Windows。

## 它解决什么问题

你可以用它完成这些事情：

- 给本机添加多套工作流目录，例如 `V5`、`ZW`。
- 给本机添加多个智能体目标目录，例如 `codex`、`claude`。
- 一条命令把某套工作流切换到一个或多个智能体。
- 切换前自动检查路径、重复 skill 名称、符号链接权限和同名冲突。
- 切换失败时保留原来的工作流，不会先删后失败。

## 安装前准备

需要先安装 Node.js 20.17 或更高的 LTS 版本，推荐使用 Node.js 22 LTS。

检查版本：

```bash
node -v
```

如果版本不满足上述要求，请先升级 Node.js。CLI 使用新版交互组件，旧版本 Node 可能无法启动。

## 一键安装

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/yangquanyun/workflow-switcher/main/scripts/install.sh | bash
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/yangquanyun/workflow-switcher/main/scripts/install.ps1 | iex
```

安装完成后，按提示执行 `workflow-switcher setup` 进入初始化向导。

如果安装后提示找不到 `workflow-switcher` 命令，请把安装脚本提示的 bin 目录加入 `PATH`。

## 第一次使用

运行：

```bash
workflow-switcher setup
```

向导会让你配置两类信息。

交互中可以使用方向键选择，按回车确认；多选 target 时使用空格勾选。

第一类是 `target`：某个智能体读取 skills 的目录。

例如你可以添加：

```text
target 名称: codex
active skills 目录: 你本机 codex 实际读取 skills 的目录
```

也可以继续添加：

```text
target 名称: claude
active skills 目录: 你本机 claude 实际读取 skills 的目录
```

工具只提供 `codex`、`claude`、`自定义` 这类 target 名称选项，不会预填默认路径。路径必须由你自己确认后输入。

第二类是 `source`：一套工作流 skills 的源目录。

例如：

```text
source 名称: V5
source skills 目录: /Users/yangqy/workspace/seeyon-new/ai-toolkit/skills
```

再添加一套：

```text
source 名称: ZW
source skills 目录: /Users/yangqy/workspace/1st/ai-toolkit/skills
```

`source` 名称可以按你的习惯自定义，工具不会内置任何团队分类或业务名称。

## 日常使用

打开交互菜单：

```bash
workflow-switcher
```

查看已配置的工作流和目标目录：

```bash
workflow-switcher source list
workflow-switcher target list
```

切换工作流：

```bash
workflow-switcher use
workflow-switcher use V5 --target codex
workflow-switcher use ZW --target all
```

不带 source 执行 `workflow-switcher use` 时，会进入交互选择；如果配置了多个 target，也会继续让你勾选要切换的目标目录。

查看当前状态：

```bash
workflow-switcher current
workflow-switcher status
```

检查环境和常见问题：

```bash
workflow-switcher doctor
```

## 添加和删除配置

添加配置：

```bash
workflow-switcher source add V5 /path/to/v5/skills
workflow-switcher target add codex /path/to/active/skills
```

删除配置：

```bash
workflow-switcher source remove V5
workflow-switcher target remove codex
```

删除配置不会删除你的真实工作流目录，也不会删除智能体目录。

## 切换后需要做什么

切换完成后，请新开对应智能体会话，或重启对应客户端，让它重新读取 skills 列表。

例如你刚执行：

```bash
workflow-switcher use V5 --target codex
```

然后需要新开一个 codex 会话，才能稳定使用 V5 的 skills。

## 输出说明

命令行输出会用图标区分状态：

```text
✓ 成功
✗ 失败
⚠ 警告
ℹ 提示
→ 当前步骤
```

操作失败时会给出失败原因和处理方式。例如路径不存在、Windows 无法创建符号链接、目标目录存在同名非受控文件等。

## Windows 用户注意

Workflow Switcher 只使用符号链接，不会自动改用 copy 或 junction。

Windows 创建符号链接需要系统权限。如果 `doctor` 或 `use` 提示无法创建符号链接，请选择一种方式处理：

```text
1. 开启 Windows Developer Mode。
2. 让管理员授予 Create symbolic links 权限。
3. 以管理员身份运行终端。
```

修复后重新执行：

```bash
workflow-switcher doctor
```

确认通过后再切换：

```bash
workflow-switcher use <source> --target <target>
```

## 工作流根目录中的共享文件

有些工作流目录不仅包含 skill 子目录，还包含共享说明、模板和脚本。Workflow Switcher 会自动识别这些根目录文件和目录，并一起切换到 target。

会识别的共享项包括：

```text
README.md
WORKFLOW.md
WORKFLOW-DETAILS.md
TEMPLATE-STANDARD.md
.best-practices
.scripts
templates
```

例如你的 source 是：

```text
/Users/yangqy/workspace/seeyon-new/ai-toolkit/skills
```

切换时，里面的 skill 目录和这些共享项都会通过符号链接出现在 target 目录中。

## 安全规则

Workflow Switcher 只管理自己创建和记录的符号链接。

它会在 target 目录中写入：

```text
.workflow-switcher.json
```

后续切换时，只会清理这个状态文件中记录的受控项。

如果 target 目录里已经存在同名文件或目录，但不是 Workflow Switcher 管理的内容，切换会停止，并提示你手动处理，避免误删你的文件。

## 本地开发

在仓库内直接运行：

```bash
node bin/workflow-switcher.mjs help
node bin/workflow-switcher.mjs setup
```

运行测试：

```bash
npm test
```
