# Windows 安装脚本。by AI.Coding
# 该脚本安装 Node 版本的 workflow-switcher，不发布 npm、不打包二进制。

$ErrorActionPreference = "Stop"

$repoUrl = if ($env:WORKFLOW_SWITCHER_REPO_URL) { $env:WORKFLOW_SWITCHER_REPO_URL } else { "https://github.com/yangquanyun/workflow-switcher/archive/refs/heads/main.zip" }
$installDir = if ($env:WORKFLOW_SWITCHER_INSTALL_DIR) { $env:WORKFLOW_SWITCHER_INSTALL_DIR } else { Join-Path $HOME ".workflow-switcher" }
$binDir = if ($env:WORKFLOW_SWITCHER_BIN_DIR) { $env:WORKFLOW_SWITCHER_BIN_DIR } else { Join-Path $HOME "bin" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "未检测到 Node.js，请先安装 Node.js 20.17 或更高的 LTS 版本，推荐使用 Node.js 22 LTS。"
}

$nodeVersion = (node -p "process.versions.node") 2>$null
$nodeParts = $nodeVersion.Split(".") | ForEach-Object { [int]$_ }
$nodeSupported = ($nodeParts[0] -eq 20 -and $nodeParts[1] -ge 17) -or ($nodeParts[0] -eq 22 -and $nodeParts[1] -ge 13) -or ($nodeParts[0] -eq 23 -and ($nodeParts[1] -gt 5 -or ($nodeParts[1] -eq 5 -and $nodeParts[2] -ge 0))) -or ($nodeParts[0] -gt 23)
if (-not $nodeSupported) {
  Write-Error "当前 Node.js 版本为 $nodeVersion，workflow-switcher 需要 Node.js 20.17 或更高的 LTS 版本，推荐使用 Node.js 22 LTS。处理方式: 请先升级 Node.js，然后重新执行安装命令。"
}

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("workflow-switcher-" + [System.Guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

try {
  $zipPath = Join-Path $tmpDir "workflow-switcher.zip"
  Invoke-WebRequest -Uri $repoUrl -OutFile $zipPath
  Expand-Archive -Path $zipPath -DestinationPath $tmpDir -Force
  $entryFile = Get-ChildItem -Path $tmpDir -Recurse -File -Filter "workflow-switcher.mjs" | Where-Object { $_.FullName -match "[\\/]bin[\\/]workflow-switcher\.mjs$" } | Select-Object -First 1
  if (-not $entryFile) {
    Write-Error "安装包结构无效：未找到 bin/workflow-switcher.mjs"
  }
  $srcDir = $entryFile.Directory.Parent
  $appDir = Join-Path $installDir "app"
  if (Test-Path $appDir) { Remove-Item -Recurse -Force $appDir }
  New-Item -ItemType Directory -Force -Path $appDir | Out-Null
  Copy-Item -Path (Join-Path $srcDir.FullName "*") -Destination $appDir -Recurse -Force
  # 安装运行时依赖，当前 CLI 使用 chalk 提供彩色输出。
  Push-Location $appDir
  npm install --omit=dev
  Pop-Location

  $cmdPath = Join-Path $binDir "workflow-switcher.cmd"
  "@echo off`r`nnode `"$appDir\bin\workflow-switcher.mjs`" %*" | Set-Content -Path $cmdPath -Encoding ASCII

  Write-Host "workflow-switcher 已安装到 $cmdPath"
  Write-Host "如果命令不可用，请把 $binDir 加入 PATH。"
  Write-Host "下一步请执行：$cmdPath setup"
}
finally {
  Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}
