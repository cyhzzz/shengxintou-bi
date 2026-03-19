@echo off
REM 前端迁移对比测试运行脚本
REM 用于运行 Playwright 对比测试并生成报告

echo ========================================
echo 前端迁移对比测试
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 进入测试目录
cd /d "%~dp0"

REM 检查 node_modules 是否存在
if not exist "node_modules" (
    echo [信息] 正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

REM 检查 Playwright 是否安装
if not exist "node_modules\@playwright" (
    echo [信息] 正在安装 Playwright...
    call npm install -D @playwright/test
    call npx playwright install
    if %errorlevel% neq 0 (
        echo [错误] Playwright 安装失败
        pause
        exit /b 1
    )
)

echo.
echo [步骤 1/4] 检查服务器状态...
echo.

REM 检查旧前端服务器 (端口 5000)
curl -s http://127.0.0.1:5000 >nul 2>nul
if %errorlevel% neq 0 (
    echo [警告] 旧前端服务器 (端口 5000) 未运行
    echo        请先启动旧前端服务器: cd 开发代码 ^&^& set DEV_MODE=1 ^&^& python-3.9-embed\python.exe app.py
    echo.
    set OLD_SERVER_RUNNING=0
) else (
    echo [OK] 旧前端服务器 (端口 5000) 运行中
    set OLD_SERVER_RUNNING=1
)

REM 检查新前端服务器 (端口 5173)
curl -s http://127.0.0.1:5173 >nul 2>nul
if %errorlevel% neq 0 (
    echo [警告] 新前端服务器 (端口 5173) 未运行
    echo        请先启动新前端服务器: cd 开发代码/frontend-react ^&^& npm run dev
    echo.
    set NEW_SERVER_RUNNING=0
) else (
    echo [OK] 新前端服务器 (端口 5173) 运行中
    set NEW_SERVER_RUNNING=1
)

echo.

REM 如果两个服务器都没有运行，提示用户
if %OLD_SERVER_RUNNING%==0 if %NEW_SERVER_RUNNING%==0 (
    echo [错误] 两个服务器都未运行，无法执行对比测试
    echo.
    echo 请先启动服务器:
    echo   旧前端: cd 开发代码 ^&^& set DEV_MODE=1 ^&^& set PYTHONPATH=%%CD%%;%%CD%%\lib ^&^& python-3.9-embed\python.exe app.py
    echo   新前端: cd 开发代码/frontend-react ^&^& npm run dev
    echo.
    pause
    exit /b 1
)

echo [步骤 2/4] 运行对比测试...
echo.

REM 运行 Playwright 测试
npx playwright test --config=playwright.comparison.config.ts --reporter=list

if %errorlevel% neq 0 (
    echo.
    echo [警告] 部分测试失败
) else (
    echo.
    echo [OK] 所有测试通过
)

echo.
echo [步骤 3/4] 生成测试报告...
echo.

REM 打开 HTML 报告（如果存在）
if exist "playwright-report\index.html" (
    echo 测试报告已生成: playwright-report/index.html
    start playwright-report\index.html
) else (
    echo [信息] 未生成 HTML 报告
)

echo.
echo [步骤 4/4] 完成
echo.
echo ========================================
echo 测试完成！
echo ========================================
echo.

pause