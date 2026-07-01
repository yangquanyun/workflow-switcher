# Windows 安装脚本。by AI.Coding
# 该脚本安装 Node 版本的 workflow-switcher，不发布 npm、不打包二进制。

$ErrorActionPreference = "Stop"

$repoUrl = if ($env:WORKFLOW_SWITCHER_REPO_URL) { $env:WORKFLOW_SWITCHER_REPO_URL } else { "https://github.com/yangquanyun/workflow-switcher/archive/refs/heads/main.zip" }
$installDir = if ($env:WORKFLOW_SWITCHER_INSTALL_DIR) { $env:WORKFLOW_SWITCHER_INSTALL_DIR } else { Join-Path $HOME ".workflow-switcher" }
$binDir = if ($env:WORKFLOW_SWITCHER_BIN_DIR) { $env:WORKFLOW_SWITCHER_BIN_DIR } else { Join-Path $HOME "bin" }
$appDir = Join-Path $installDir "app"
$cmdPath = Join-Path $binDir "workflow-switcher.cmd"
$npmLog = Join-Path $installDir "npm-install.log"

function Fail-Install {
  param(
    [string]$Reason,
    [string]$Resolution
  )
  Write-Host "❌ 安装失败"
  Write-Host ""
  Write-Host "原因"
  Write-Host "  $Reason"
  Write-Host ""
  Write-Host "处理方式"
  Write-Host "  $Resolution"
  exit 1
}

function Test-NodeSupported {
  param([string]$Version)
  $parts = $Version.Split(".") | ForEach-Object { [int]$_ }
  return ($parts[0] -eq 20 -and $parts[1] -ge 17) -or ($parts[0] -eq 22 -and $parts[1] -ge 13) -or ($parts[0] -eq 23 -and ($parts[1] -gt 5 -or ($parts[1] -eq 5 -and $parts[2] -ge 0))) -or ($parts[0] -gt 23)
}

function Normalize-PathEntry {
  param([string]$PathEntry)
  if ([string]::IsNullOrWhiteSpace($PathEntry)) { return "" }
  return $PathEntry.Trim().TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
}

function Test-BinDirInPathValue {
  param([string]$PathValue)
  $expected = Normalize-PathEntry $binDir
  $pathParts = $PathValue -split [System.IO.Path]::PathSeparator
  return $pathParts | Where-Object { (Normalize-PathEntry $_) -eq $expected }
}

function Test-BinDirInCurrentPath {
  return Test-BinDirInPathValue $env:PATH
}

function Add-BinDirToUserPath {
  try {
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not (Test-BinDirInPathValue $userPath)) {
      $nextUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $binDir } else { $userPath.TrimEnd(';') + ';' + $binDir }
      [Environment]::SetEnvironmentVariable('Path', $nextUserPath, 'User')
    }

    # 同步当前 PowerShell 会话，避免用户必须立刻重开终端才能继续 setup。
    if (-not (Test-BinDirInCurrentPath)) {
      $env:PATH = if ([string]::IsNullOrWhiteSpace($env:PATH)) { $binDir } else { $env:PATH.TrimEnd(';') + ';' + $binDir }
    }

    return $true
  } catch {
    Write-Host "⚠️ 自动添加 PATH 失败"
    Write-Host ""
    Write-Host "原因"
    Write-Host "  $($_.Exception.Message)"
    Write-Host ""
    return $false
  }
}

function Print-Success {
  Write-Host "✅ Workflow Switcher 安装完成"
  Write-Host ""
  Write-Host "安装位置"
  Write-Host "  应用目录: $appDir"
  Write-Host "  命令入口: $cmdPath"
  Write-Host ""

  if (Test-BinDirInCurrentPath) {
    Write-Host "✅ 命令已可用"
    Write-Host ""
    Write-Host "下一步"
    Write-Host "  workflow-switcher setup"
  } else {
    Write-Host "⚠️ 命令暂时不可用，正在自动添加到用户 PATH"
    Write-Host ""
    Write-Host "原因"
    Write-Host "  workflow-switcher 已安装成功，但当前终端还找不到这个命令。"
    Write-Host "  $binDir 不在当前 PATH 中。"
    Write-Host ""
    if (Add-BinDirToUserPath) {
      Write-Host "✅ 已添加到用户 PATH"
      Write-Host ""
      Write-Host "下一步"
      Write-Host "  workflow-switcher setup"
      Write-Host ""
      Write-Host "如果当前窗口仍提示命令不存在，请重新打开 PowerShell 后再执行。"
    } else {
      Write-Host "处理方式"
      Write-Host "  请重新打开 PowerShell 后重试，或直接执行："
      Write-Host "  $cmdPath setup"
    }
  }

  Write-Host ""
  Write-Host "常用命令"
  Write-Host "  workflow-switcher          打开交互菜单"
  Write-Host "  workflow-switcher use      选择并切换工作流"
  Write-Host "  workflow-switcher doctor   检查环境和软链接权限"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail-Install "未检测到 Node.js。" "请先安装 Node.js 20.17 或更高的 LTS 版本，推荐使用 Node.js 22 LTS。"
}

$nodeVersion = (node -p "process.versions.node") 2>$null
if (-not (Test-NodeSupported $nodeVersion)) {
  Fail-Install "当前 Node.js 版本为 $nodeVersion，版本过低。" "请先升级 Node.js，然后重新执行安装命令。"
}

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("workflow-switcher-" + [System.Guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

try {
  $zipPath = Join-Path $tmpDir "workflow-switcher.zip"
  try {
    Invoke-WebRequest -Uri $repoUrl -OutFile $zipPath
  } catch {
    Fail-Install "下载安装包失败。" "请检查网络是否可以访问 GitHub，然后重新执行安装命令。"
  }

  try {
    Expand-Archive -Path $zipPath -DestinationPath $tmpDir -Force
  } catch {
    Fail-Install "安装包解压失败。" "请重新执行安装命令；如果仍失败，请检查系统 Expand-Archive 是否可用。"
  }

  $entryFile = Get-ChildItem -Path $tmpDir -Recurse -File -Filter "workflow-switcher.mjs" | Where-Object { $_.FullName -match "[\\/]bin[\\/]workflow-switcher\.mjs$" } | Select-Object -First 1
  if (-not $entryFile) {
    Fail-Install "安装包结构无效，未找到 bin/workflow-switcher.mjs。" "请确认安装命令使用的是 workflow-switcher 仓库 main 分支。"
  }

  $srcDir = $entryFile.Directory.Parent
  if (Test-Path $appDir) { Remove-Item -Recurse -Force $appDir }
  New-Item -ItemType Directory -Force -Path $appDir | Out-Null
  Copy-Item -Path (Join-Path $srcDir.FullName "*") -Destination $appDir -Recurse -Force

  Push-Location $appDir
  npm install --omit=dev --silent *> $npmLog
  $npmExitCode = $LASTEXITCODE
  Pop-Location
  if ($npmExitCode -ne 0) {
    Fail-Install "运行依赖安装失败。" "请检查网络是否可以访问 npm registry；详细日志: $npmLog"
  }
  Remove-Item -Force $npmLog -ErrorAction SilentlyContinue

  "@echo off`r`nnode `"$appDir\bin\workflow-switcher.mjs`" %*" | Set-Content -Path $cmdPath -Encoding ASCII
  Print-Success
}
finally {
  Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}
