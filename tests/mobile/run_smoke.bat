@echo off
REM 省心投 BI Android 端 smoke 测试启动脚本
REM
REM 用法：双击或命令行执行 tests\mobile\run_smoke.bat
REM 前置：
REM   1. 手机开启 USB 调试并连接
REM   2. APK 已构建（android\release\省心投-vX.Y.Z.apk）

setlocal

set PROJECT_ROOT=%~dp0..\..
cd /d %PROJECT_ROOT%

REM 添加 platform-tools 到 PATH
set PATH=%PROJECT_ROOT%\tools\platform-tools;%PATH%

echo ============================================
echo  省心投 BI Android Smoke 测试
echo ============================================

REM 1. 检查设备
echo [1/4] 检查设备连接...
adb devices | findstr "\tdevice" >nul
if errorlevel 1 (
    echo [ERROR] 未检测到设备
    echo 请: 1.开启 USB 调试  2.连接手机  3.手机上点"允许"
    pause
    exit /b 1
)
echo [OK] 设备已连接

REM 2. 检查 APK（取最新版本，避免硬编码版本号）
echo [2/4] 检查 APK...
set "APK_PATH="
for /f "delims=" %%i in ('dir /b /o-d "android\release\省心投-v*.apk" 2^>nul') do (
    set "APK_PATH=android\release\%%i"
    goto :found_apk
)
echo [ERROR] 未找到 APK: android\release\省心投-v*.apk
echo 请先执行: cd android ^&^& npm run build:apk
pause
exit /b 1
:found_apk
echo [OK] APK: %APK_PATH%

REM 3. 启动 Appium Server（后台）
echo [3/4] 启动 Appium Server...
tasklist | findstr "node.*appium" >nul
if errorlevel 1 (
    start /b "" appium --use-plugins=images --allow-cors --port 4723 > tests\mobile\appium.log 2>&1
    echo 等待 Appium 启动...
    timeout /t 8 /nobreak >nul
)
echo [OK] Appium 已启动

REM 4. 运行测试
echo [4/4] 运行 smoke 测试...
python tests\mobile\smoke_test.py

set EXITCODE=%ERRORLEVEL%

echo.
echo ============================================
if %EXITCODE% equ 0 (
    echo  测试通过
) else (
    echo  测试失败，查看截图和日志
)
echo  截图: tests\mobile\screenshots\
echo  日志: tests\mobile\logcat.txt
echo  Appium: tests\mobile\appium.log
echo ============================================

pause
exit /b %EXITCODE%
