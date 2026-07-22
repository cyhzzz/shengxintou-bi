# 生成 Android 应用图标
# v3.5.3：进一步缩小前景图到 50%（半径 27dp）适配更激进的圆形 mask
#
# 自适应图标规范：
# - 前景层（ic_launcher_foreground）：画布 108x108dp，安全区域为中心 66dp（~61%）
# - 实际显示会被 mask 裁剪为圆形/圆角矩形/方型，安全区域外会被裁掉
# - v3.5.2 用 60% 仍被切割 → v3.5.3 改为 50%，更保守

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

# ========== 1. ic_launcher / ic_launcher_round（传统位图图标，全尺寸填充）==========
# 注意：旧版 Android 不支持 adaptive icon，会回退到 ic_launcher.png
#       此处 LOGO 居中占 70%（保留一点边距，避免边缘被 mask 切掉）
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
    # 白色背景（与自适应图标背景色一致）
    $g.Clear([System.Drawing.Color]::White)
    # LOGO 居中填充（保持比例，留 15% 边距）
    $drawSize = [int]($size * 0.7)
    $offset = [int](($size - $drawSize) / 2)
    $g.DrawImage($srcImg, $offset, $offset, $drawSize, $drawSize)
    $bmp.Save((Join-Path $dir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save((Join-Path $dir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}
Write-Output "[done] ic_launcher / ic_launcher_round generated (70% safe zone)"

# ========== 2. ic_launcher_foreground（自适应图标前景层，LOGO 居中占 50%）==========
# 自适应图标规范：画布 108dp，安全区域为中心 66dp（~61%）
# v3.5.3：改为 50% 进一步缩小，确保即使圆形 mask 也不会切割
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
    # LOGO 居中绘制，只占画布 50%（v3.5.3 进一步保守）
    $drawSize = [int]($canvasSize * 0.5)
    $offset = [int](($canvasSize - $drawSize) / 2)
    $g.DrawImage($srcImg, $offset, $offset, $drawSize, $drawSize)
    $bmp.Save((Join-Path $dir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}
Write-Output "[done] ic_launcher_foreground generated (50% safe zone)"

# ========== 3. 清理旧的 drawable-v24/ic_launcher_foreground.xml（vector，避免覆盖位图）==========
# 该 vector 是 Capacitor 默认的兜底前景，绘制的是个机器人图标，需删除让 mipmap 位图生效
$oldVectorPath = Join-Path $resDir "drawable-v24\ic_launcher_foreground.xml"
if (Test-Path $oldVectorPath) {
    Remove-Item $oldVectorPath -Force
    Write-Output "[clean] removed drawable-v24/ic_launcher_foreground.xml (default robot vector)"
}

$srcImg.Dispose()
Write-Output "[complete] All icons regenerated"
