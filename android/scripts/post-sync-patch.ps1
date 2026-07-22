# Capacitor sync 后自动 patch 脚本
# 用法：npx cap sync android 后运行此脚本
# 作用：
#   1. AndroidManifest.xml 加 screenOrientation=landscape
#   2. 从 icon/LOGO.png 生成各尺寸 ic_launcher 图标
#   3. patch 插件 build.gradle 的 JDK 21 → 17
#
# 注意：PowerShell 5.1 的 Set-Content -Encoding UTF8 会写 BOM，
# Gradle 不支持 BOM，必须用 [System.IO.File]::WriteAllText 写无 BOM 的 UTF-8

$ErrorActionPreference = "Stop"
$androidNativeDir = Join-Path $PSScriptRoot "..\android"
$manifestPath = Join-Path $androidNativeDir "app\src\main\AndroidManifest.xml"

# 无 BOM UTF-8 写文件
function Write-FileNoBom([string]$path, [string]$content) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

# 无 BOM UTF-8 读文件
function Read-FileNoBom([string]$path) {
    return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

# ========== 1. AndroidManifest.xml 加横屏 ==========
if (Test-Path $manifestPath) {
    $manifest = Read-FileNoBom $manifestPath
    if ($manifest -notmatch 'android:screenOrientation') {
        $manifest = $manifest -replace 'android:launchMode="singleTask"', 'android:launchMode="singleTask"`n            android:screenOrientation="landscape"'
        Write-FileNoBom $manifestPath $manifest
        Write-Output "[patch] AndroidManifest.xml: added screenOrientation=landscape"
    } else {
        Write-Output "[skip] AndroidManifest.xml: screenOrientation already set"
    }
}

# ========== 2. 生成 ic_launcher 图标（调用独立脚本）==========
$genIconsScript = Join-Path $PSScriptRoot "generate-icons.ps1"
if (Test-Path $genIconsScript) {
    & powershell -ExecutionPolicy Bypass -File $genIconsScript
    Write-Output "[patch] ic_launcher icons: regenerated"
} else {
    Write-Output "[skip] generate-icons.ps1 not found"
}

# ========== 3. patch JDK 21 → 17 ==========
$gradleFiles = @(
    "app\capacitor.build.gradle"
    "node_modules\@capacitor-community\sqlite\android\build.gradle"
    "node_modules\@capacitor\android\capacitor\build.gradle"
    "node_modules\@capacitor\preferences\android\build.gradle"
    "node_modules\@capacitor\status-bar\android\build.gradle"
    "node_modules\@capacitor\filesystem\android\build.gradle"
)
foreach ($rel in $gradleFiles) {
    $f = Join-Path $androidNativeDir $rel
    if (Test-Path $f) {
        $content = Read-FileNoBom $f
        $changed = $false
        if ($content -match 'VERSION_21') {
            $content = $content -replace 'JavaVersion\.VERSION_21', 'JavaVersion.VERSION_17'
            $changed = $true
        }
        if ($content -match 'jvmToolchain\(21\)') {
            $content = $content -replace 'jvmToolchain\(21\)', 'jvmToolchain(17)'
            $changed = $true
        }
        if ($changed) {
            Write-FileNoBom $f $content
            Write-Output "[patch] $rel : JDK 21 -> 17"
        }
    }
}

Write-Output "[done] post-sync-patch complete"
