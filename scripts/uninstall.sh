#!/usr/bin/env bash
set -Eeuo pipefail

# macOS/Linux 卸载脚本。by AI.Coding
# 只删除 workflow-switcher 自身安装文件和配置，不删除用户的 source/target 目录。

INSTALL_DIR="${WORKFLOW_SWITCHER_INSTALL_DIR:-$HOME/.workflow-switcher}"
BIN_DIR="${WORKFLOW_SWITCHER_BIN_DIR:-$HOME/.local/bin}"
CONFIG_DIR="${WORKFLOW_SWITCHER_CONFIG_DIR:-$HOME/.config/workflow-switcher}"
BIN_PATH="$BIN_DIR/workflow-switcher"

unexpected_error() {
  echo "❌ 卸载失败"
  echo
  echo "原因"
  echo "  卸载过程中出现未预期错误。"
  echo
  echo "处理方式"
  echo "  请确认当前用户有权限删除安装目录和命令入口，然后重新执行卸载命令。"
  exit 1
}

trap unexpected_error ERR

remove_path() {
  local target="$1"
  if [ -e "$target" ] || [ -L "$target" ]; then
    rm -rf "$target"
    echo "  已删除: $target"
  else
    echo "  未找到: $target"
  fi
}

echo "🧹 开始卸载 Workflow Switcher"
echo
echo "删除项目"
remove_path "$INSTALL_DIR"
remove_path "$BIN_PATH"
remove_path "$CONFIG_DIR"

echo
echo "✅ Workflow Switcher 已卸载"
echo
echo "保留内容"
echo "  你的真实 workflow source 目录不会被删除"
echo "  codex、claude 等智能体 skills 目录不会被删除"
echo
echo "如果你之前手动把 $BIN_DIR 加入 PATH，需要时可自行从 shell 配置文件中移除。"
