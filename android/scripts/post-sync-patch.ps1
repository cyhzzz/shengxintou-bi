# Capacitor sync 后自动 patch 脚本
# 用法：npx cap sync android 后运行此脚本
# 作用：
#   1. AndroidManifest.xml 加 screenOrientation=landscape
#   2. 从 icon/LOGO.png 生成各尺寸 ic_launcher 图标
#   3. patch 插件 build.gradle 的 JDK 21 → 17
#   4. 确认 strings.xml 中 app_name 为"省心投"（非"省心投 BI"）
#   5. settings.gradle 加阿里云镜像（国内网络无法直连 maven.apache.org）
#   6. gradle.properties 加 in-process kotlin + 关闭 daemon（避免 TRAE Sandbox 拦截 ~/.kotlin）
#   7. gradle-wrapper.properties 改腾讯云镜像（services.gradle.org 超时）
#   8. APK 打包后重命名为中文名（省心投-vX.Y.Z.apk）
#
# 注意：PowerShell 5.1 的 Set-Content -Encoding UTF8 会写 BOM，
# Gradle 不支持 BOM，必须用 [System.IO.File]::WriteAllText 写无 BOM 的 UTF-8

$ErrorActionPreference = "Stop"
$androidNativeDir = Join-Path $PSScriptRoot "..\android"
$manifestPath = Join-Path $androidNativeDir "app\src\main\AndroidManifest.xml"
$stringsPath = Join-Path $androidNativeDir "app\src\main\res\values\strings.xml"

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

# ========== 4. 校验 strings.xml app_name = "省心投" ==========
# v3.5.3：Capacitor sync 会用 capacitor.config.ts 的 appName 覆盖 strings.xml
#         若 appName 仍是"省心投 BI"，强制改回"省心投"
if (Test-Path $stringsPath) {
    $strings = Read-FileNoBom $stringsPath
    if ($strings -match '<string name="app_name">省心投 BI</string>') {
        $strings = $strings -replace '<string name="app_name">省心投 BI</string>', '<string name="app_name">省心投</string>'
        Write-FileNoBom $stringsPath $strings
        Write-Output "[patch] strings.xml: app_name '省心投 BI' -> '省心投'"
    } elseif ($strings -match '<string name="app_name">省心投</string>') {
        Write-Output "[skip] strings.xml: app_name already '省心投'"
    } else {
        Write-Output "[warn] strings.xml: app_name pattern not matched, manual check required"
    }
}

# ========== 5. settings.gradle 注入阿里云镜像 ==========
# v3.5.3：国内网络无法访问 maven.apache.org / plugins.gradle.org
#         每次 cap sync 会重新生成 settings.gradle，必须重新注入镜像
$settingsPath = Join-Path $androidNativeDir "settings.gradle"
if (Test-Path $settingsPath) {
    $settings = Read-FileNoBom $settingsPath
    if ($settings -notmatch 'maven.aliyun.com') {
        $aliyunBlock = @"
pluginManagement {
    repositories {
        maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
        maven { url 'https://maven.aliyun.com/repository/public' }
        maven { url 'https://maven.aliyun.com/repository/google' }
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}

plugins {
    id 'org.gradle.toolchains.foojay-resolver-convention' version '0.9.0'
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        maven { url 'https://maven.aliyun.com/repository/public' }
        maven { url 'https://maven.aliyun.com/repository/google' }
        maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
        google()
        mavenCentral()
    }
}

"@
        # 保留 include 行和后续内容
        $includePart = ($settings -split "(?m)^include ':app'")[1]
        if ($includePart) {
            $newContent = $aliyunBlock + "include ':app'" + $includePart
        } else {
            # 兜底：直接在 plugins 块前插入 pluginManagement 和 dependencyResolutionManagement
            $newContent = $aliyunBlock + $settings
        }
        Write-FileNoBom $settingsPath $newContent
        Write-Output "[patch] settings.gradle: aliyun mirrors injected"
    } else {
        Write-Output "[skip] settings.gradle: aliyun mirrors already present"
    }
}

# ========== 6. gradle.properties 注入 in-process kotlin + 关闭 daemon ==========
# v3.5.3：TRAE Sandbox 会拦截 C:\Users\<user>\AppData\Local\kotlin 写入
#         Kotlin 编译器改 in-process 模式（不单独启动 Kotlin daemon）
$gradlePropsPath = Join-Path $androidNativeDir "gradle.properties"
if (Test-Path $gradlePropsPath) {
    $props = Read-FileNoBom $gradlePropsPath
    $changed = $false
    if ($props -notmatch 'kotlin.compiler.execution.strategy') {
        $props = $props + "`nkotlin.compiler.execution.strategy=in-process`nkotlin.daemon.jvmargs=-Xmx1536m -Dfile.encoding=UTF-8`norg.gradle.daemon=false`norg.gradle.configuration-cache=false`n"
        $changed = $true
    }
    if ($changed) {
        Write-FileNoBom $gradlePropsPath $props
        Write-Output "[patch] gradle.properties: in-process kotlin + daemon disabled"
    } else {
        Write-Output "[skip] gradle.properties: in-process kotlin already set"
    }
}

# ========== 7. gradle-wrapper.properties 改腾讯云镜像 ==========
# v3.5.3：services.gradle.org 在国内网络超时
$wrapperPropsPath = Join-Path $androidNativeDir "gradle\wrapper\gradle-wrapper.properties"
if (Test-Path $wrapperPropsPath) {
    $wrapper = Read-FileNoBom $wrapperPropsPath
    $changed = $false
    if ($wrapper -match 'services.gradle.org/distributions') {
        $wrapper = $wrapper -replace 'https://services.gradle.org/distributions/', 'https://mirrors.cloud.tencent.com/gradle/'
        $changed = $true
    }
    if ($wrapper -match 'networkTimeout=10000') {
        $wrapper = $wrapper -replace 'networkTimeout=10000', 'networkTimeout=120000'
        $changed = $true
    }
    if ($wrapper -match 'validateDistributionUrl=true') {
        $wrapper = $wrapper -replace 'validateDistributionUrl=true', 'validateDistributionUrl=false'
        $changed = $true
    }
    if ($changed) {
        Write-FileNoBom $wrapperPropsPath $wrapper
        Write-Output "[patch] gradle-wrapper.properties: tencent mirror + timeout 120s"
    } else {
        Write-Output "[skip] gradle-wrapper.properties: tencent mirror already set"
    }
}

Write-Output "[done] post-sync-patch complete"

# ========== 8. 打包后重命名 APK（中文名） ==========
# build.gradle 中 outputFileName 用 ASCII（shengxintou-vX.Y.Z.apk），
# 打包完成后由本函数重命名为中文（省心投-vX.Y.Z.apk）
# 此函数不在 sync 时调用，而是由 build 脚本在 assembleRelease 后调用
function Rename-ApkToChinese {
    param([string]$ApkDir = "")
    if (-not $ApkDir) {
        $ApkDir = Join-Path $androidNativeDir "app\build\outputs\apk\release"
    }
    if (-not (Test-Path $ApkDir)) {
        Write-Output "[skip] Rename-ApkToChinese: apk release dir not found"
        return
    }
    $apk = Get-ChildItem -Path $ApkDir -Filter "shengxintou-v*.apk" -Recurse | Select-Object -First 1
    if (-not $apk) {
        Write-Output "[skip] Rename-ApkToChinese: shengxintou-v*.apk not found"
        return
    }
    $newName = $apk.Name -replace '^shengxintou-', '省心投-'
    $newPath = Join-Path $apk.DirectoryName $newName
    if (Test-Path $newPath) { Remove-Item $newPath -Force }
    Rename-Item -Path $apk.FullName -NewName $newName
    Write-Output "[done] APK renamed: $($apk.Name) -> $newName"
}
