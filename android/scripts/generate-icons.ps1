# 生成 Android 应用图标
# 修复 v3.5.1 的 logo 被切割问题：前景层 LOGO 居中且只占 60% 安全区域
#
# 自适应图标规范：
# - 前景层（ic_launcher_foreground）：画布 108x108dp，安全区域为中心 72x72dp（66%）
# - 背景：纯色或简单图案
# - 实际显示区域会被 mask 裁剪为圆形/圆角矩形

param(
    [string]$LogoPath = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
# android/scripts → android → 省心投BI
if (-not $LogoPath) {
    $LogoPath = Join-Path $projectRoot "icon\LOGO.png"
}
# 兜底：如果按脚本相对路径找不到，尝试用硬编码的项目根
if (-not (Test-Path $LogoPath)) {
    $fallbackPath = "D:\AIproject\省心投BI\icon\LOGO.png"
    if (Test-Path $fallbackPath) {
        $LogoPath = $fallbackPath
    }
}

if (-not (Test-Path $LogoPath)) {
    Write-Error "LOGO not found: $LogoPath"
    exit 1
}

$androidNativeDir = Join-Path $PSScriptRoot "..\android"
$resDir = Join-Path $androidNativeDir "app\src\main\res"

Add-Type -AssemblyName System.Drawing
$srcImg = [System.Drawing.Image]::FromFile($LogoPath)
$srcW = $srcImg.Width
$srcH = $srcImg.Height
Write-Output "[info] Source LOGO: ${srcW}x${srcH}"

# ========== 1. ic_launcher / ic_launcher_round（传统图标，全尺寸填充）==========
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
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    # 白色背景
    $g.Clear([System.Drawing.Color]::White)
    # LOGO 居中填充（保持比例，留 10% 边距）
    $drawSize = [int]($size * 0.8)
    $offset = [int](($size - $drawSize) / 2)
    $g.DrawImage($srcImg, $offset, $offset, $drawSize, $drawSize)
    $bmp.Save((Join-Path $dir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save((Join-Path $dir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}
Write-Output "[done] ic_launcher / ic_launcher_round generated"

# ========== 2. ic_launcher_foreground（自适应图标前景层，LOGO 居中占 60%）==========
# 自适应图标规范：画布 108dp，安全区域为中心 66dp（~61%）
# 为防止被裁剪，LOGO 居中绘制且只占画布 60%
$fgSizes = @{
    "mipmap-mdpi"    = 108
    "mipmap-hdpi"    = 162
    "mipmap-xhdpi"   = 216
    "mipmap-xxhdpi"  = 324
    "mipmap-xxxhdpi" = 432
}
foreach ($entry in $fgSizes.GetEnumerator()) {
    $dir = Join-Path $resDir $entry.Key
    $canvasSize = $entry.Value
    $bmp = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    # 透明背景
    $g.Clear([System.Drawing.Color]::Transparent)
    # LOGO 居中绘制，只占画布 60%（自适应图标安全区域）
    $drawSize = [int]($canvasSize * 0.6)
    $offset = [int](($canvasSize - $drawSize) / 2)
    $g.DrawImage($srcImg, $offset, $offset, $drawSize, $drawSize)
    $bmp.Save((Join-Path $dir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}
Write-Output "[done] ic_launcher_foreground generated (60% safe zone)"

$srcImg.Dispose()
Write-Output "[complete] All icons regenerated"
