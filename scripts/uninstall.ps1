# Windows 卸载脚本。by AI.Coding
# 只删除 workflow-switcher 自身安装文件和配置，不删除用户的 source/target 目录。

$ErrorActionPreference = "Stop"

$installDir = if ($env:WORKFLOW_SWITCHER_INSTALL_DIR) { $env:WORKFLOW_SWITCHER_INSTALL_DIR } else { Join-Path $HOME ".workflow-switcher" }
$binDir = if ($env:WORKFLOW_SWITCHER_BIN_DIR) { $env:WORKFLOW_SWITCHER_BIN_DIR } else { Join-Path $HOME "bin" }
$configDir = if ($env:WORKFLOW_SWITCHER_CONFIG_DIR) { $env:WORKFLOW_SWITCHER_CONFIG_DIR } else { Join-Path $HOME ".config\workflow-switcher" }
$cmdPath = Join-Path $binDir "workflow-switcher.cmd"

function Remove-WorkflowSwitcherPath {
  param([string]$Path)
  if (Test-Path $Path) {
    Remove-Item -Recurse -Force $Path
    Write-Host "  已删除: $Path"
  } else {
    Write-Host "  未找到: $Path"
  }
}

try {
  Write-Host "🧹 开始卸载 Workflow Switcher"
  Write-Host ""
  Write-Host "删除项目"
  Remove-WorkflowSwitcherPath $installDir
  Remove-WorkflowSwitcherPath $cmdPath
  Remove-WorkflowSwitcherPath $configDir

  Write-Host ""
  Write-Host "✅ Workflow Switcher 已卸载"
  Write-Host ""
  Write-Host "保留内容"
  Write-Host "  你的真实 workflow source 目录不会被删除"
  Write-Host "  codex、claude 等智能体 skills 目录不会被删除"
  Write-Host ""
  Write-Host "如果你之前手动把 $binDir 加入 PATH，需要时可自行从用户 Path 中移除。"
} catch {
  Write-Host "❌ 卸载失败"
  Write-Host ""
  Write-Host "原因"
  Write-Host "  $($_.Exception.Message)"
  Write-Host ""
  Write-Host "处理方式"
  Write-Host "  请确认当前终端有权限删除上述目录，然后重新执行卸载命令。"
  exit 1
}
