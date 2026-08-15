<#
.SYNOPSIS
  Android APK 一键编译脚本

.DESCRIPTION
  流程：
    1. 前端 build
    2. 若原生工程不存在则 npx cap add android（CI 检出无 android/android，需先生成）
    3. cap sync android
    4. post-sync-patch（注入镜像/JDK17/全屏/横屏/内置DB/图标/中文名）
    5. gradlew assembleDebug（优先用 $env:JAVA_HOME，fallback 到 tools/jdk17）
    6. 把产物复制到 android/release/ 并重命名为 shengxintou-v{version}.apk

.EXAMPLE
  cd android
  npm run build:apk
#>
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path "$PSScriptRoot\..\.."
$androidRoot = Join-Path $repoRoot 'android'
$frontendRoot = Join-Path $repoRoot 'frontend-react'
$gradleRoot = Join-Path $androidRoot 'android'
$apkSrcDir = Join-Path $gradleRoot 'app\build\outputs\apk\debug'
$releaseDir = Join-Path $androidRoot 'release'
# JDK 优先用环境变量（CI 用 actions/setup-java 设置 JAVA_HOME），本地 fallback 到 tools/jdk17
$jdkPath = $env:JAVA_HOME
if (-not $jdkPath -or -not (Test-Path $jdkPath)) {
    $jdkPath = Join-Path $repoRoot 'tools\jdk17'
}

Write-Host '[1/6] 前端 build...' -ForegroundColor Cyan
Push-Location $frontendRoot
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "前端 build 失败" }
} finally { Pop-Location }

Write-Host '[2/6] 原生工程检查（cap add android）...' -ForegroundColor Cyan
if (-not (Test-Path $gradleRoot)) {
    Push-Location $androidRoot
    try {
        npx cap add android
        if ($LASTEXITCODE -ne 0) { throw "cap add android 失败" }
    } finally { Pop-Location }
} else {
    Write-Host '  原生工程已存在，跳过 cap add'
}

Write-Host '[3/6] cap sync android...' -ForegroundColor Cyan
Push-Location $androidRoot
try {
    npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw "cap sync 失败" }
} finally { Pop-Location }

Write-Host '[4/6] post-sync-patch...' -ForegroundColor Cyan
Push-Location $androidRoot
try {
    npm run post-sync-patch
    if ($LASTEXITCODE -ne 0) { throw "post-sync-patch 失败" }
} finally { Pop-Location }

Write-Host '[5/6] gradlew assembleDebug...' -ForegroundColor Cyan
if (-not (Test-Path $jdkPath)) { throw "JDK17 未找到：$jdkPath（请设置 JAVA_HOME 或准备 tools/jdk17）" }
$env:JAVA_HOME = $jdkPath
Push-Location $gradleRoot
try {
    & .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "gradlew assembleDebug 失败" }
} finally { Pop-Location }

Write-Host '[6/6] 复制产物到 release 目录并重命名中文名...' -ForegroundColor Cyan
$versionJson = Get-Content (Join-Path $repoRoot 'version.json') -Raw | ConvertFrom-Json
$version = $versionJson.version
$apkName = "shengxintou-v$version.apk"
$apkSrc = Join-Path $apkSrcDir $apkName
if (-not (Test-Path $apkSrc)) {
    # 兜底：找目录下任意 apk
    $apkSrc = (Get-ChildItem -Path $apkSrcDir -Filter '*.apk' | Select-Object -First 1).FullName
    if (-not $apkSrc) { throw "未找到编译产物 APK" }
}
if (-not (Test-Path $releaseDir)) { New-Item -ItemType Directory -Path $releaseDir | Out-Null }
$apkDst = Join-Path $releaseDir "shengxintou-v$version.apk"
Copy-Item -Path $apkSrc -Destination $apkDst -Force
$size = (Get-Item $apkDst).Length / 1MB

Write-Host ''
Write-Host 'BUILD SUCCESS' -ForegroundColor Green
Write-Host "  产物: $apkDst"
Write-Host "  大小: $([math]::Round($size, 2)) MB"
Write-Host "  版本: v$version"
