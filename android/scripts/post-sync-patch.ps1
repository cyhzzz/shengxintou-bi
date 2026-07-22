# Capacitor sync 后自动 patch 脚本
# 用法：npx cap sync android 后运行此脚本
# 作用：
#   1. AndroidManifest.xml 加 screenOrientation=landscape
#   2. 从 icon/LOGO.png 生成各尺寸 ic_launcher 图标
#   3. patch 插件 build.gradle 的 JDK 21 → 17

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$androidNativeDir = Join-Path $PSScriptRoot "..\android"
$manifestPath = Join-Path $androidNativeDir "app\src\main\AndroidManifest.xml"

# ========== 1. AndroidManifest.xml 加横屏 ==========
if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath -Raw -Encoding UTF8
    if ($manifest -notmatch 'android:screenOrientation') {
        $manifest = $manifest -replace 'android:launchMode="singleTask"', 'android:launchMode="singleTask"`n            android:screenOrientation="landscape"'
        Set-Content $manifestPath -Value $manifest -Encoding UTF8 -NoNewline
        Write-Output "[patch] AndroidManifest.xml: added screenOrientation=landscape"
    } else {
        Write-Output "[skip] AndroidManifest.xml: screenOrientation already set"
    }
}

# ========== 2. 生成 ic_launcher 图标 ==========
$logoPath = Join-Path $projectRoot "icon\LOGO.png"
if (Test-Path $logoPath) {
    Add-Type -AssemblyName System.Drawing
    $srcImg = [System.Drawing.Image]::FromFile($logoPath)
    $resDir = Join-Path $androidNativeDir "app\src\main\res"

    # ic_launcher / ic_launcher_round（48~192px）
    $launcherSizes = @{
        "mipmap-mdpi"    = 48
        "mipmap-hdpi"    = 72
        "mipmap-xhdpi"   = 96
        "mipmap-xxhdpi"  = 144
        "mipmap-xxxhdpi" = 192
    }
    foreach ($entry in $launcherSizes.GetEnumerator()) {
        $dir = Join-Path $resDir $entry.Key
        $size = $entry.Value
        $bmp = New-Object System.Drawing.Bitmap($size, $size)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.Clear([System.Drawing.Color]::White)
        $g.DrawImage($srcImg, 0, 0, $size, $size)
        $bmp.Save((Join-Path $dir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Save((Join-Path $dir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose(); $bmp.Dispose()
    }

    # ic_launcher_foreground（108~432px，透明背景）
    $fgSizes = @{
        "mipmap-mdpi"    = 108
        "mipmap-hdpi"    = 162
        "mipmap-xhdpi"   = 216
        "mipmap-xxhdpi"  = 324
        "mipmap-xxxhdpi" = 432
    }
    foreach ($entry in $fgSizes.GetEnumerator()) {
        $dir = Join-Path $resDir $entry.Key
        $size = $entry.Value
        $bmp = New-Object System.Drawing.Bitmap($size, $size)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($srcImg, 0, 0, $size, $size)
        $bmp.Save((Join-Path $dir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose(); $bmp.Dispose()
    }
    $srcImg.Dispose()
    Write-Output "[patch] ic_launcher icons: generated from icon/LOGO.png"
} else {
    Write-Output "[skip] icon/LOGO.png not found"
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
        $content = Get-Content $f -Raw -Encoding UTF8
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
            Set-Content $f -Value $content -Encoding UTF8 -NoNewline
            Write-Output "[patch] $rel : JDK 21 -> 17"
        }
    }
}

Write-Output "[done] post-sync-patch complete"
