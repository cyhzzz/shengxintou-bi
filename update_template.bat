@echo off
REM ========================================
REM 省心投 BI - 自动更新脚本模板
REM ========================================
REM 用法：
REM   1. 开发者修改版本号和文件列表
REM   2. 用户将此脚本放到 开发代码/ 目录
REM   3. 双击运行，自动完成更新
REM ========================================

setlocal enabledelayedexpansion

echo ========================================
echo 省心投 BI - 自动更新工具
echo ========================================
echo.

REM ========================================
REM 配置区域（开发者修改）
REM ========================================
set "VERSION=1.0.1"
set "UPDATE_DATE=2026-02-03"

REM 定义要更新的文件列表
set "FILES_TO_UPDATE="
set "FILES_TO_UPDATE=%FILES_TO_UPDATE%|app.py"
set "FILES_TO_UPDATE=%FILES_TO_UPDATE%|backend\routes\data.py"
set "FILES_TO_UPDATE=%FILES_TO_UPDATE%|frontend\js\main.js"

echo [信息] 版本: v%VERSION%
echo [信息] 日期: %UPDATE_DATE%
echo [信息] 更新文件数: 3
echo.

REM ========================================
REM 步骤1: 检查环境
REM ========================================
echo ========================================
echo 步骤 1/4: 检查环境
echo ========================================
echo.

REM 检查是否在正确的目录
if not exist "省心投启动器.exe" (
    echo [错误] 请将此脚本放到 开发代码\ 目录下运行
    pause
    exit /b 1
)

if not exist "app.py" (
    echo [错误] 未找到 app.py，请确保在正确的目录
    pause
    exit /b 1
)

echo [OK] 环境检查通过
echo.

REM ========================================
REM 步骤2: 备份当前版本
REM ========================================
echo ========================================
echo 步骤 2/4: 备份当前版本
echo ========================================
echo.

set "BACKUP_DIR=backup_v%VERSION%_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "BACKUP_DIR=%BACKUP_DIR: =0%"

if exist "%BACKUP_DIR%" (
    echo [警告] 备份目录已存在: %BACKUP_DIR%
    choice /C YN /M "是否继续并覆盖旧备份？"
    if errorlevel 2 (
        echo [取消] 更新已取消
        pause
        exit /b 0
    )
    rmdir /s /q "%BACKUP_DIR%"
)

mkdir "%BACKUP_DIR%"

echo [备份] 正在备份文件...

REM 备份将要更新的文件
for %%F in (%FILES_TO_UPDATE%) do (
    if exist "%%F" (
        copy /y "%%F" "%BACKUP_DIR%\%%F" >nul 2>&1
        if not errorlevel 1 (
            echo   [OK] %%F
        )
    )
)

echo [OK] 备份完成: %BACKUP_DIR%
echo.

REM ========================================
REM 步骤3: 应用更新
REM ========================================
echo ========================================
echo 步骤 3/4: 应用更新
echo ========================================
echo.

echo [更新] 正在应用更新文件...
echo.

REM 检查更新文件是否存在
set "MISSING_FILES=0"

for %%F in (%FILES_TO_UPDATE%) do (
    if not exist "%%F" (
        echo   [警告] 更新文件不存在: %%F
        set /a MISSING_FILES+=1
    )
)

if %MISSING_FILES% GTR 0 (
    echo.
    echo [警告] 有 %MISSING_FILES% 个更新文件缺失
    echo.
    choice /C YN /M "是否继续应用现有更新？"
    if errorlevel 2 (
        echo [取消] 更新已取消
        pause
        exit /b 0
    )
)

echo.
echo [更新] 开始复制文件...
echo.

REM 应用更新
set "UPDATED_COUNT=0"
set "FAILED_COUNT=0"

for %%F in (%FILES_TO_UPDATE%) do (
    if exist "%%F.new" (
        REM 如果存在 .new 文件，使用新文件
        move /y "%%F.new" "%%F" >nul 2>&1
        if not errorlevel 1 (
            echo   [OK] %%F
            set /a UPDATED_COUNT+=1
        ) else (
            echo   [失败] %%F
            set /a FAILED_COUNT+=1
        )
    )
)

echo.
echo [完成] 更新了 %UPDATED_COUNT% 个文件，失败 %FAILED_COUNT% 个
echo.

REM ========================================
REM 步骤4: 验证更新
REM ========================================
echo ========================================
echo 步骤 4/4: 验证更新
echo ========================================
echo.

echo [验证] 正在验证更新...

REM 验证Python语法
python-3.9-embed\python.exe -m py_compile app.py
if errorlevel 1 (
    echo [警告] app.py 存在语法错误
) else (
    echo [OK] app.py 语法检查通过
)

REM 验证配置文件
python-3.9-embed\python.exe -c "import config; print('Config OK')"
if errorlevel 1 (
    echo [警告] config.py 存在错误
) else (
    echo [OK] config.py 检查通过
)

echo.
echo ========================================
echo 更新完成！
echo ========================================
echo.
echo 版本: v%VERSION%
echo 日期: %UPDATE_DATE%
echo.
echo 下一步操作:
echo   1. 关闭当前的省心投应用（如果正在运行）
echo   2. 重新双击"省心投启动器.exe"
echo   3. 验证新功能是否正常
echo.
echo 备份位置: %BACKUP_DIR%
echo.
echo 如遇问题，可以从备份目录恢复文件。
echo.
echo ========================================
pause
