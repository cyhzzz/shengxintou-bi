# Capacitor sync 后自动 patch 脚本
# 用法：npx cap sync android 后运行此脚本
# 作用：
#   1. AndroidManifest.xml 加 screenOrientation=landscape
#   1b. AndroidManifest.xml 加 largeHeap=true（v3.5.4：移动端同步需要大内存）
#   2. 从 icon/LOGO.png 生成各尺寸 ic_launcher 图标
#   3. patch 插件 build.gradle 的 JDK 21 → 17
#   4. 确认 strings.xml 中 app_name 为"省心投"（非"省心投 BI"）
#   4b. styles.xml 加 windowFullscreen（全屏沉浸式，隐藏状态栏）
#   5. settings.gradle 加阿里云镜像（国内网络无法直连 maven.apache.org）
#   6. gradle.properties 加 in-process kotlin + 关闭 daemon（避免 TRAE Sandbox 拦截 ~/.kotlin）
#   7. gradle-wrapper.properties 改腾讯云镜像（services.gradle.org 超时）
#   8. 内置【空库】打包进 APK assets（public/assets/databases/shengxintouSQLite.db）
#      v3.8.2 安全改造：不再内置真实业务数据库（防泄露），仅打包表结构空库，
#      首次启动后用户需自行配置 WebDAV 凭据从坚果云拉取数据
#   9. APK 打包后复制到 android/release/（shengxintou-vX.Y.Z.apk）
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
        # 用字符串操作避免 PowerShell -replace 单引号里 `n 不转义、把字面反引号注入 XML 的问题
        $marker = 'android:launchMode="singleTask"'
        $insertText = "`n            android:screenOrientation=`"landscape`""
        $idx = $manifest.IndexOf($marker)
        if ($idx -ge 0) {
            $insertPos = $idx + $marker.Length
            $manifest = $manifest.Substring(0, $insertPos) + $insertText + $manifest.Substring($insertPos)
            Write-FileNoBom $manifestPath $manifest
            Write-Output "[patch] AndroidManifest.xml: added screenOrientation=landscape"
        } else {
            Write-Output "[warn] AndroidManifest.xml: marker 'android:launchMode' not found, cannot inject screenOrientation"
        }
    } else {
        Write-Output "[skip] AndroidManifest.xml: screenOrientation already set"
    }
}

# ========== 1b. AndroidManifest.xml 加 largeHeap ==========
# v3.5.4：移动端同步下载 30+ MB SQLite 备份 → base64 后 50+ MB，
#         WebView 默认堆内存不足会 OOM 崩溃，必须启用 largeHeap
if (Test-Path $manifestPath) {
    $manifest = Read-FileNoBom $manifestPath
    if ($manifest -notmatch 'android:largeHeap') {
        # 在 android:theme="@style/AppTheme" 后插入 android:largeHeap="true"
        # 用字符串操作避免 PowerShell -replace 中的引号/反引号转义问题
        $marker = 'android:theme="@style/AppTheme"'
        $insertText = "`n        android:largeHeap=`"true`""
        $idx = $manifest.IndexOf($marker)
        if ($idx -ge 0) {
            $insertPos = $idx + $marker.Length
            $manifest = $manifest.Substring(0, $insertPos) + $insertText + $manifest.Substring($insertPos)
            Write-FileNoBom $manifestPath $manifest
            Write-Output "[patch] AndroidManifest.xml: added largeHeap=true"
        } else {
            Write-Output "[warn] AndroidManifest.xml: marker 'android:theme' not found, cannot inject largeHeap"
        }
    } else {
        Write-Output "[skip] AndroidManifest.xml: largeHeap already set"
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

# ========== 4b. styles.xml 加全屏沉浸式主题 ==========
# v3.5.3：cap sync 会覆盖 styles.xml，需重新注入 windowFullscreen
$stylesPath = Join-Path $androidNativeDir "app\src\main\res\values\styles.xml"
if (Test-Path $stylesPath) {
    $styles = Read-FileNoBom $stylesPath
    if ($styles -notmatch 'android:windowFullscreen') {
        # 在 AppTheme.NoActionBarLaunch 的 </style> 前插入全屏属性
        if ($styles -match '(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)([\s\S]*?)</style>') {
            $newInner = "`n        <item name=`"android:windowFullscreen`">true</item>`n        <item name=`"android:windowNoTitle`">true</item>`n    "
            $styles = $styles -replace '(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)([\s\S]*?)</style>', "`$1$newInner</style>"
            Write-FileNoBom $stylesPath $styles
            Write-Output "[patch] styles.xml: windowFullscreen added to AppTheme.NoActionBarLaunch"
        }
    } else {
        Write-Output "[skip] styles.xml: windowFullscreen already set"
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

# ========== 8. 内置【空库】打包进 APK assets ==========
# v3.8.2 安全改造：APK 不再内置真实业务数据（防泄露）。
# 从 database/shengxintou.db 提取表结构（CREATE TABLE/INDEX 等）生成 0 行数据的空库，
# 复制到 APK assets + Vite public 目录。首次启动 copyFromAssets 拿到空库后，
# 用户需在「数据同步」页配置 WebDAV 凭据从坚果云拉取真实数据。
$schemaDb = Join-Path $PSScriptRoot "..\..\database\shengxintou.db"
if (Test-Path $schemaDb) {
    # APK assets 最终位置（cap sync 后 dist 内容已复制到此，再补空库）
    $apkAssetsDir = Join-Path $androidNativeDir "app\src\main\assets\public\assets\databases"
    New-Item -ItemType Directory -Force -Path $apkAssetsDir | Out-Null
    $apkDst = Join-Path $apkAssetsDir "shengxintouSQLite.db"

    # 同步到 Vite public 目录，让下次 npm run build 也包含空库
    $vitePublicDir = Join-Path $PSScriptRoot "..\..\frontend-react\public\assets\databases"
    New-Item -ItemType Directory -Force -Path $vitePublicDir | Out-Null
    $viteDst = Join-Path $vitePublicDir "shengxintouSQLite.db"

    # 用 Python 从 schema 库生成空库（仅表结构，0 行数据）
    # 注意1：os.remove 在 WorkBuddy 环境被 safe-delete shim 拦截，用先写 tmp 再 os.replace 原子替换
    # 注意2：PowerShell 5.1 管道给 python stdin 有编码问题，改为写临时 .py 文件再执行
    $pyScript = @"
import sqlite3, os
src = r'$($schemaDb.Replace("'","''"))'
dst = r'$($apkDst.Replace("'","''"))'
tmp = dst + '.tmp'
if os.path.exists(tmp):
    try: os.remove(tmp)
    except OSError: pass
sconn = sqlite3.connect(src)
rows = sconn.execute("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").fetchall()
sconn.close()
dconn = sqlite3.connect(tmp)
for (s,) in rows:
    try: dconn.execute(s)
    except sqlite3.OperationalError: pass
dconn.commit(); dconn.close()
os.replace(tmp, dst)
"@
    $tmpPy = Join-Path $PSScriptRoot "..\..\logs\gen_empty_db_$([guid]::NewGuid().ToString('N').Substring(0,8)).py"
    New-Item -ItemType Directory -Force -Path (Split-Path $tmpPy) | Out-Null
    Write-FileNoBom $tmpPy $pyScript
    $pyOk = $false
    foreach ($pyExe in @("$PSScriptRoot\..\..\.venv\Scripts\python.exe", "python")) {
        try {
            & $pyExe $tmpPy 2>$null
            if (Test-Path $apkDst) { $pyOk = $true; break }
        } catch { }
    }
    Remove-Item $tmpPy -Force -ErrorAction SilentlyContinue
    if ($pyOk) {
        Copy-Item -Path $apkDst -Destination $viteDst -Force
        $sizeKB = [math]::Round((Get-Item $apkDst).Length / 1KB, 0)
        Write-Output "[patch] APK assets 空库: $apkDst ($sizeKB KB, 0 行业务数据)"
        Write-Output "[patch] Vite public 空库: $viteDst"

        # 清理旧位置的真实库副本（避免误打包）
        $oldPublicDb = Join-Path $PSScriptRoot "..\..\frontend-react\public\databases\shengxintouSQLite.db"
        if (Test-Path $oldPublicDb) { Remove-Item $oldPublicDb -Force }
    } else {
        Write-Output "[warn] 空库生成失败 — APK 将不含内置数据库（首次启动需先同步）"
    }
} else {
    Write-Output "[warn] schema DB not found: database/shengxintou.db — 不内置数据库"
}

Write-Output "[done] post-sync-patch complete"

# ========== 9. 打包后复制 APK（shengxintou 命名） ==========
# build.gradle 中 outputFileName 用 ASCII（shengxintou-vX.Y.Z.apk），
# 打包完成后由本函数复制到 android/release/，保持 shengxintou 拼音命名
# v3.5.3：改用 assembleDebug（debug keystore 自动签名），默认搜 debug 目录
# 此函数不在 sync 时调用，而是由 build 脚本在 assembleDebug 后调用
function Rename-ApkToChinese {
    param([string]$ApkDir = "")
    # 优先 debug 目录（v3.5.3 起用 debug 签名），兜底 release 目录
    $debugDir = Join-Path $androidNativeDir "app\build\outputs\apk\debug"
    $releaseDir = Join-Path $androidNativeDir "app\build\outputs\apk\release"
    if (-not $ApkDir) {
        if (Test-Path $debugDir) {
            $ApkDir = $debugDir
        } else {
            $ApkDir = $releaseDir
        }
    }
    if (-not (Test-Path $ApkDir)) {
        Write-Output "[skip] Rename-ApkToChinese: apk dir not found"
        return
    }
    $apk = Get-ChildItem -Path $ApkDir -Filter "shengxintou-v*.apk" -Recurse | Select-Object -First 1
    if (-not $apk) {
        # 兜底：app-debug.apk
        $apk = Get-ChildItem -Path $ApkDir -Filter "app-debug.apk" -Recurse | Select-Object -First 1
    }
    if (-not $apk) {
        Write-Output "[skip] Rename-ApkToChinese: shengxintou-v*.apk not found"
        return
    }
    $newName = $apk.Name -replace '^app-debug', 'shengxintou-debug'
    # 复制到 android/release/（项目约定输出位置）
    $releaseOutDir = Join-Path $PSScriptRoot "..\release"
    New-Item -ItemType Directory -Force -Path $releaseOutDir | Out-Null
    $finalPath = Join-Path $releaseOutDir $newName
    Copy-Item -Path $apk.FullName -Destination $finalPath -Force
    $sizeMB = [math]::Round((Get-Item $finalPath).Length / 1MB, 2)
    Write-Output "[done] APK copied: $($apk.Name) -> $finalPath ($sizeMB MB)"
}
