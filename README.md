# Workflow Switcher

一个用于切换本机 agent skills 工作流的跨平台 CLI。

当你同时维护多套业务工作流时，把所有 skills 都放进 Codex、Claude 等工具目录，容易触发错误的 workflow。Workflow Switcher 只把当前选择的那一套工作流通过软链接关联到工具目录，让每个工具在同一时间只看到需要的 skills。

支持 macOS 和 Windows。只使用软链接，不会自动 copy，也不会降级为 junction。

## 快速安装

需要 Node.js 20.17 或更高的 LTS 版本，推荐 Node.js 22 LTS。

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/yangquanyun/workflow-switcher/main/scripts/install.sh | bash
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/yangquanyun/workflow-switcher/main/scripts/install.ps1 | iex
```

安装成功后执行：

```bash
workflow-switcher setup
```

安装脚本会输出安装位置、命令入口、下一步命令。如果当前终端还不能直接执行 `workflow-switcher`，脚本会给出 PATH 处理方式和可直接运行的完整路径命令。

## 三分钟上手

第 1 步，初始化配置：

```bash
workflow-switcher setup
```

向导会要求你配置两类目录：

- 工具目录：Codex、Claude 或其他工具实际读取 skills 的目录。
- 工作流目录：某套业务工作流的 skills 源目录，例如 `V5`、`ZW`。

填写完成后，向导会展示汇总表。确认保存前不会写入配置文件。

第 2 步，检查环境：

```bash
workflow-switcher doctor
```

第 3 步，切换工作流：

```bash
workflow-switcher use
```

切换完成后，请新开对应 agent 会话，或重启对应客户端，让 skills 列表刷新。

## 常用命令

打开交互菜单：

```bash
workflow-switcher
```

初始化配置：

```bash
workflow-switcher setup
```

选择并切换工作流：

```bash
workflow-switcher use
```

指定工作流和工具目录：

```bash
workflow-switcher use V5 --target codex
```

切换到所有已启用工具目录：

```bash
workflow-switcher use ZW --target all
```

查看状态：

```bash
workflow-switcher status
```

检查路径和软链接权限：

```bash
workflow-switcher doctor
```

## 配置管理

添加工作流：

```bash
workflow-switcher source add V5 /path/to/v5/skills
```

添加工具目录：

```bash
workflow-switcher target add codex /path/to/codex/skills
```

查看已配置工作流：

```bash
workflow-switcher source list
```

查看已配置工具目录：

```bash
workflow-switcher target list
```

删除工作流配置：

```bash
workflow-switcher source remove V5
```

删除工具目录配置：

```bash
workflow-switcher target remove codex
```

删除配置不会删除你的真实工作流目录，也不会删除 Codex、Claude 等工具目录。

## 目录概念

### 工具目录

工具目录是 Codex、Claude 或其他 agent 工具实际读取 skills 的目录。

Workflow Switcher 内置的只是 `codex`、`claude`、`自定义` 这几个名称选项，不会预填默认路径。每个人设备不同，路径必须由用户手动确认。

示例：

```text
工具: codex
skills 目录: 你本机 codex 实际读取 skills 的目录
```

### 工作流目录

工作流目录是一套待切换的 skills 源目录。名称完全自定义，不内置任何团队、业务或分类。

示例：

```text
工作流名称: V5
工作流 skills 源目录: /Users/yangqy/workspace/seeyon-new/ai-toolkit/skills
```

```text
工作流名称: ZW
工作流 skills 源目录: /Users/yangqy/workspace/1st/ai-toolkit/skills
```

## 根目录共享项

工作流目录不仅可以包含 skill 子目录，也可以包含共享说明、模板和脚本。命中以下项目时，Workflow Switcher 会一起通过软链接关联到工具目录：

```text
README.md
WORKFLOW.md
WORKFLOW-DETAILS.md
TEMPLATE-STANDARD.md
.best-practices
.scripts
templates
```

## Windows 软链接权限

Windows 创建软链接需要系统权限。如果 `doctor` 或 `use` 提示无法创建符号链接，请选择一种方式处理：

```text
1. 开启 Windows Developer Mode。
2. 让管理员授予 Create symbolic links 权限。
3. 以管理员身份运行终端。
```

修复后重新检查：

```bash
workflow-switcher doctor
```

## 安全规则

Workflow Switcher 只管理自己创建并记录的软链接。

每个工具目录中会写入：

```text
.workflow-switcher.json
```

后续切换时，只会清理这个状态文件中记录的受控项。如果工具目录里已经存在同名文件或目录，但不是 Workflow Switcher 管理的内容，切换会停止并提示你手动处理，避免误删。

## 一键卸载

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/yangquanyun/workflow-switcher/main/scripts/uninstall.sh | bash
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/yangquanyun/workflow-switcher/main/scripts/uninstall.ps1 | iex
```

卸载会删除 Workflow Switcher 自身的安装目录、命令入口和配置目录，不会删除你的真实工作流目录，也不会删除 Codex、Claude 等工具目录。

## 本地开发

安装依赖：

```bash
npm install
```

运行 CLI：

```bash
node bin/workflow-switcher.mjs help
node bin/workflow-switcher.mjs setup
```

运行测试：

```bash
npm test
```
