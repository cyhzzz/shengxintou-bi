@echo off
REM ========================================
REM 快速打包启动器 (React前端版)
REM ========================================

echo ========================================
echo 省心投启动器 (React版) - 快速打包
echo ========================================
echo.

cd /d "%~dp0"

echo [检查] 检查环境...
where pyinstaller >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 pyinstaller，正在安装...
    pip install pyinstaller
)

echo [清理] 清理旧版本...
if exist "build" rmdir /s /q "build" 2>nul
if exist "dist" rmdir /s /q "dist" 2>nul

echo [打包] 开始打包启动器 (React版)...
pyinstaller --onefile --name "省心投-开发版_new" --icon "icon\LOGO.ico" --noconsole --distpath "." launcher_new.py

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
echo 输出文件: 开发代码\省心投-开发版_new.exe
echo.
echo 使用说明:
echo   1. 双击 省心投-开发版_new.exe 启动
echo   2. 将同时启动 Flask后端 和 React开发服务器
echo   3. 浏览器将自动打开 http://127.0.0.1:3000
echo.
echo 注意事项:
echo   - React前端需要先运行 npm install
echo   - Flask后端端口: 5000
echo   - React前端端口: 3000
echo.
pause