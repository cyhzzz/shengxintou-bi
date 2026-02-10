@echo off
REM ========================================
REM 快速打包启动器
REM ========================================

echo ========================================
echo 省心投启动器 - 快速打包
echo ========================================
echo.

cd /d "%~dp0开发代码"

echo [检查] 检查环境...
where pyinstaller >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 pyinstaller，正在安装...
    pip install pyinstaller
)

echo [清理] 清理旧版本...
if exist "build" rmdir /s /q "build" 2>nul
if exist "dist" rmdir /s /q "dist" 2>nul

echo [打包] 开始打包启动器...
pyinstaller --onefile --name "省心投启动器" --icon "icon\LOGO.ico" --noconsole --distpath "." launcher.py

if errorlevel 1 (
    echo [错误] 打包失败！
    pause
    exit /b 1
)

echo.
echo ========================================
echo 打包完成！
echo ========================================
echo.
echo 输出文件: 开发代码\省心投启动器.exe
echo.
echo 下一步: 双击 省心投启动器.exe 测试功能
echo.
pause
