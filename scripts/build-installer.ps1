# -*- coding: utf-8 -*-
<#
.SYNOPSIS
  省心投 BI 安装包打包脚本（PyInstaller + 前端 build + electron-builder NSIS）

.DESCRIPTION
  串行执行三个阶段，每阶段失败即终止：
    1. PyInstaller 打包 server.exe（backend + Python 依赖）
    2. 前端 build（React → dist/）
    3. electron-builder 打 NSIS 安装包（含 server.exe + dist/ + resources/）

  脚本自动处理常见阻塞问题：
    - 杀掉占用 release/ 的残留进程（避免 app.asar 被锁）
    - 清理 release/ 输出目录
    - NSIS/winCodeSign 下载失败时用国内镜像重试

.PARAMETER SkipPyInstaller
  跳过阶段 1（server.exe 已是最新时使用）

.PARAMETER SkipFrontend
  跳过阶段 2（前端 dist/ 已是最新时使用）

.PARAMETER OnlyNSIS
  只跑阶段 3（等同 -SkipPyInstaller -SkipFrontend）

.PARAMETER Root
  仓库根目录。缺省用本地开发路径 D:\AIproject\省心投BI；
  CI（GitHub Actions）传 -Root $env:GITHUB_WORKSPACE 复用本脚本。

.EXAMPLE
  .\scripts\build-installer.ps1
  .\scripts\build-installer.ps1 -OnlyNSIS
  .\scripts\build-installer.ps1 -Root $env:GITHUB_WORKSPACE
#>
[CmdletBinding()]
param(
  [switch]$SkipPyInstaller,
  [switch]$SkipFrontend,
  [switch]$OnlyNSIS,
  [string]$Root = ''
)

if ($OnlyNSIS) {
  $SkipPyInstaller = $true
  $SkipFrontend = $true
}

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = 'D:\AIproject\省心投BI'
}
$ROOT = $Root
$DESKTOP = Join-Path $ROOT 'desktop'
$LOG = Join-Path $ROOT 'logs'
# CI 环境没有 logs 目录，确保存在避免日志重定向失败
New-Item -ItemType Directory -Force -Path $LOG | Out-Null

function Write-Step($msg) { Write-Host "`n[1/3] $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  · $msg" -ForegroundColor Gray }

# ============================================================================
# 预处理：杀掉可能占用 release/ 的残留进程
# ============================================================================
Write-Step '预处理：清理残留进程和输出目录'
$lockProcs = Get-Process -ErrorAction SilentlyContinue | Where-Object {
  $_.ProcessName -match '省心投|shengxintou|electron|server' -and
  $_.Path -like '*省心投BI*desktop*'
}
if ($lockProcs) {
  Write-Info "杀掉 $($lockProcs.Count) 个残留进程"
  $lockProcs | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
} else {
  Write-Info '无残留进程'
}

$releaseDir = Join-Path $DESKTOP 'release'
$ymlPath = Join-Path $DESKTOP 'electron-builder.yml'
$outputDirName = 'release'
if (Test-Path $releaseDir) {
  try {
    Remove-Item $releaseDir -Recurse -Force -ErrorAction Stop
    Write-OK '清理 release/ 目录'
  } catch {
    Write-Info "release/ 目录被占用，改用带时间戳的新输出目录"
    $outputDirName = "release_$(Get-Date -Format 'yyyyMMddHHmmss')"
    $releaseDir = Join-Path $DESKTOP $outputDirName
    # 修改 electron-builder.yml 的 output
    $ymlContent = Get-Content $ymlPath -Raw
    $ymlContent = $ymlContent -replace 'output: release(?:_\d+)?', "output: $outputDirName"
    Set-Content $ymlPath $ymlContent -NoNewline
    Write-Info "electron-builder.yml output 改为 $outputDirName"
  }
} else {
  Write-OK 'release/ 目录不存在'
}
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

# ============================================================================
# 阶段 1：PyInstaller 打包 server.exe
# ============================================================================
if (-not $SkipPyInstaller) {
  Write-Step '阶段 1/3：PyInstaller 打包 server.exe'
  # 用 cmd 子进程执行，避开 TRAE PowerShell 对 stderr 的误报
  $cmd = "cd /d `"$ROOT`" && python -m PyInstaller 省心投-server.spec --noconfirm > `"$LOG\pyinstaller.log`" 2>&1"
  cmd /c $cmd | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Err "PyInstaller 失败 (exit $LASTEXITCODE)，查看 $LOG\pyinstaller.log"
    exit 1
  }
  $serverExe = Join-Path $ROOT 'dist\server\server.exe'
  if (Test-Path $serverExe) {
    $sizeMB = [math]::Round((Get-Item $serverExe).Length / 1MB, 1)
    Write-OK "server.exe 生成成功 ($sizeMB MB)"
  } else {
    Write-Err 'server.exe 未生成'
    exit 1
  }
} else {
  Write-Step '阶段 1/3：跳过 PyInstaller（-SkipPyInstaller）'
}

# ============================================================================
# 阶段 2：前端 build + 产出 frontend-dist.zip（用于热更新 Release asset）
# ============================================================================
if (-not $SkipFrontend) {
  Write-Step '阶段 2/3：前端 build（React → dist/）'
  $feDir = Join-Path $ROOT 'frontend-react'
  $cmd = "cd /d `"$feDir`" && npm run build > `"$LOG\frontend-build.log`" 2>&1"
  cmd /c $cmd | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Err "前端 build 失败 (exit $LASTEXITCODE)，查看 $LOG\frontend-build.log"
    exit 1
  }
  $distDir = Join-Path $ROOT 'frontend-react\dist'
  if (Test-Path $distDir) {
    Write-OK "前端 dist/ 生成成功"
  } else {
    Write-Err '前端 dist/ 未生成'
    exit 1
  }

  # v3.7.0：产出 frontend-dist.zip 作为 Release asset
  #   - 给 Windows 桌面版热更新（self_update.py 从 GitHub Release 下载并解压覆盖 dist）
  #   - 给 Android 移动端热更新（@capacitor/updater 下载并切换 bundle）
  #   - zip 结构：直接包含 index.html 等文件（无 dist/ 顶层目录），兼容 Capacitor Updater
  $frontendDistZip = Join-Path $releaseDir 'frontend-dist.zip'
  if (Test-Path $frontendDistZip) { Remove-Item $frontendDistZip -Force }
  Write-Info '打包 frontend-dist.zip（Release asset，用于客户端热更新）...'
  # Compress-Archive -Path 'dist/*' 让 zip 直接包含文件，不包含顶层 dist/ 目录
  Push-Location $distDir
  try {
    Compress-Archive -Path './*' -DestinationPath $frontendDistZip -CompressionLevel Optimal -Force
    if (Test-Path $frontendDistZip) {
      $zipSizeKB = [math]::Round((Get-Item $frontendDistZip).Length / 1KB, 1)
      Write-OK "frontend-dist.zip 生成成功 ($zipSizeKB KB)"
    } else {
      Write-Err 'frontend-dist.zip 未生成（Compress-Archive 静默失败）'
      exit 1
    }
  } finally {
    Pop-Location
  }
} else {
  Write-Step '阶段 2/3：跳过前端 build（-SkipFrontend）'
}

# ============================================================================
# 阶段 2.5：产出 full-update.zip（Windows 桌面版完整静默更新包）
#   - 内含 server/（PyInstaller onedir 产物）+ frontend-react/dist/ + version.json
#   - zip 结构与 exe 内 resources/ 布局一致：解压后可直接替换这三块
#   - 客户端 self_update.py 下载此包 → 重启时整体替换 → 后端+前端+版本号一起更新
# ============================================================================
if (-not $SkipPyInstaller -or -not $SkipFrontend) {
  Write-Step '阶段 2.5/3：打包 full-update.zip（完整静默更新包）'
  $serverDir = Join-Path $ROOT 'dist\server'
  if (-not (Test-Path $serverDir)) {
    Write-Err "full-update.zip 需要 server/（PyInstaller 产物），但 $serverDir 不存在"
    exit 1
  }
  $updateTmp = Join-Path $ROOT 'logs\full-update-tmp'
  if (Test-Path $updateTmp) { Remove-Item $updateTmp -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $updateTmp | Out-Null
  try {
    # 组装 resources 同构目录：server/ + backend/ + app.py + config.py + frontend-react/dist/ + version.json
    # （与 electron-builder.yml extraResources 运行时布局一致；不打包 app.asar/icon/.env.example/elevate.exe）
    $dstServer = Join-Path $updateTmp 'server'
    $dstBackend = Join-Path $updateTmp 'backend'
    $dstDistRoot = Join-Path $updateTmp 'frontend-react'
    $dstDist = Join-Path $dstDistRoot 'dist'
    New-Item -ItemType Directory -Force -Path $dstServer | Out-Null
    New-Item -ItemType Directory -Force -Path $dstBackend | Out-Null
    New-Item -ItemType Directory -Force -Path $dstDist | Out-Null
    Copy-Item -Path (Join-Path $serverDir '*') -Destination $dstServer -Recurse -Force
    Copy-Item -Path (Join-Path $ROOT 'backend\*') -Destination $dstBackend -Recurse -Force
    Copy-Item -Path (Join-Path $ROOT 'app.py') -Destination $updateTmp -Force
    Copy-Item -Path (Join-Path $ROOT 'config.py') -Destination $updateTmp -Force
    Copy-Item -Path (Join-Path $distDir '*') -Destination $dstDist -Recurse -Force
    Copy-Item -Path (Join-Path $ROOT 'version.json') -Destination $updateTmp -Force

    $fullUpdateZip = Join-Path $releaseDir 'full-update.zip'
    if (Test-Path $fullUpdateZip) { Remove-Item $fullUpdateZip -Force }
    Write-Info '打包 full-update.zip（Release asset，用于 Windows 完整静默更新）...'
    Push-Location $updateTmp
    try {
      Compress-Archive -Path './*' -DestinationPath $fullUpdateZip -CompressionLevel Optimal -Force
    } finally {
      Pop-Location
    }
    if (Test-Path $fullUpdateZip) {
      $zipSizeMB = [math]::Round((Get-Item $fullUpdateZip).Length / 1MB, 1)
      Write-OK "full-update.zip 生成成功 ($zipSizeMB MB)"
    } else {
      Write-Err 'full-update.zip 未生成（Compress-Archive 静默失败）'
      exit 1
    }
  } finally {
    if (Test-Path $updateTmp) { Remove-Item $updateTmp -Recurse -Force }
  }
} else {
  Write-Step '阶段 2.5/3：跳过 full-update.zip（-SkipPyInstaller + -SkipFrontend）'
}

# ============================================================================
# 阶段 3：electron-builder 打 NSIS 安装包
# ============================================================================
Write-Step '阶段 3/3：electron-builder 打 NSIS 安装包'
Push-Location $DESKTOP
try {
  # 第一次尝试（默认源）
  Write-Info '尝试 electron-builder（默认源）...'
  $cmd = "cd /d `"$DESKTOP`" && npm run dist > `"$LOG\electron-builder.log`" 2>&1"
  cmd /c $cmd | Out-Null
  $firstExit = $LASTEXITCODE

  if ($firstExit -ne 0) {
    Write-Info '默认源失败，检查是否为 NSIS/winCodeSign 下载问题...'
    # 用国内镜像重试
    $env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
    $env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
    Write-Info '使用国内镜像重试...'
    $cmd = "cd /d `"$DESKTOP`" && npm run dist > `"$LOG\electron-builder-2.log`" 2>&1"
    cmd /c $cmd | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Err "electron-builder 失败 (exit $LASTEXITCODE)，查看 $LOG\electron-builder-2.log"
      Write-Info '常见原因：'
      Write-Info '  1. winCodeSign 符号链接权限：用管理员身份运行本脚本，或开启 Windows 开发者模式'
      Write-Info '  2. app.asar 被占用：确认无 省心投 BI 进程在跑，或重启电脑后重试'
      exit 1
    }
  }

  # 查找生成的 exe
  $setupExe = Get-ChildItem $releaseDir -Filter '*Setup*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($setupExe) {
    $sizeMB = [math]::Round($setupExe.Length / 1MB, 1)
    Write-OK "安装包生成成功！"
    Write-Host ""
    Write-Host "  产物：$($setupExe.FullName)" -ForegroundColor Yellow
    Write-Host "  大小：$sizeMB MB" -ForegroundColor Yellow
    Write-Host "  时间：$($setupExe.LastWriteTime)" -ForegroundColor Yellow
  } else {
    Write-Err '未找到 *Setup*.exe，检查 release/ 目录'
    exit 1
  }
} finally {
  Pop-Location
  # 还原 electron-builder.yml output 为 release
  if ($outputDirName -ne 'release') {
    Write-Info "还原 electron-builder.yml output 为 release"
    $ymlContent = Get-Content $ymlPath -Raw
    $ymlContent = $ymlContent -replace 'output: release(?:_\d+)?', 'output: release'
    Set-Content $ymlPath $ymlContent -NoNewline
  }
  # 清理镜像环境变量
  Remove-Item Env:ELECTRON_BUILDER_BINARIES_MIRROR -ErrorAction SilentlyContinue
  Remove-Item Env:ELECTRON_MIRROR -ErrorAction SilentlyContinue
}

Write-Host "`n=== 打包完成 ===" -ForegroundColor Green
