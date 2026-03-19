@echo off
chcp 65001 >nul
echo ============================================
echo   省心投新前端功能测试
echo ============================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查 Playwright 是否安装
if not exist "node_modules\@playwright" (
    echo [提示] 正在安装 Playwright...
    call npm install
)

echo.
echo [1/3] 启动后端服务...
echo [提示] 请确保后端服务已启动 (python app.py)
echo.
echo [2/3] 启动新前端开发服务器...
echo [提示] 将在后台启动前端服务 (npm run dev)
start "新前端开发服务器" cmd /k "cd /d %CD% && npm run dev"

echo [提示] 等待前端服务启动 (15秒)...
timeout /t 15 /nobreak >nul

echo.
echo [3/3] 运行功能测试...
echo.

cd /d %~dp0..

npx playwright test tests/functional --config=tests/functional/playwright.functional.config.ts %*

echo.
echo ============================================
echo   测试完成
echo ============================================
echo.
echo 查看测试报告:
echo   - HTML 报告: test-results/functional-html\index.html
echo   - JSON 报告: test-results\functional-results.json
echo.
pause
