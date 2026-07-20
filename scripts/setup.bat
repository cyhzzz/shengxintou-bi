@echo off
REM ============================================================
REM 省心投 BI - 一键依赖安装（Windows）
REM
REM 用途：clone 仓库后第一件事，让 AI / 用户一行命令搞定所有依赖：
REM   1. 检查 Python 3.9+ 与 Node.js 20+
REM   2. 创建 .venv 虚拟环境（如果不存在）
REM   3. pip install -r requirements.txt
REM   4. cd frontend-react && npm install
REM   5. npm run build（生成 dist/，启动器必需）
REM   6. 复制 .env.example 为 .env（如果不存在）
REM
REM 用法：
REM   scripts\setup.bat
REM 或在仓库根目录：
REM   .\scripts\setup.bat
REM
REM 此脚本幂等：可重复执行，已就位的步骤会自动跳过。
REM ============================================================

setlocal EnableDelayedExpansion
chcp 65001 >nul

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%"

echo.
echo ============================================================
echo   省心投 BI - 一键依赖安装
echo ============================================================
echo.

REM ---- 1. Python 检查 ----
echo [1/6] 检查 Python ...
where python >nul 2>&1
if errorlevel 1 (
    echo   [X] 未找到 Python
    echo.
    echo   请先安装 Python 3.9 或更高版本：
    echo     https://www.python.org/downloads/
    echo.
    echo   安装时务必勾选 "Add Python to PATH"。
    popd
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set "PY_VER=%%v"
echo   [OK] Python !PY_VER!

REM 解析主版本号
for /f "tokens=1,2 delims=." %%a in ("!PY_VER!") do (
    set "PY_MAJOR=%%a"
    set "PY_MINOR=%%b"
)
if !PY_MAJOR! LSS 3 (
    echo   [X] Python 版本过低（!PY_VER!），需要 3.9+
    popd
    exit /b 1
)
if !PY_MAJOR! EQU 3 if !PY_MINOR! LSS 9 (
    echo   [X] Python 版本过低（!PY_VER!），需要 3.9+
    popd
    exit /b 1
)

REM ---- 2. 创建 .venv ----
echo.
echo [2/6] 准备 Python 虚拟环境 ...
if not exist ".venv\Scripts\python.exe" (
    echo   创建 .venv ...
    python -m venv .venv
    if errorlevel 1 (
        echo   [X] 创建 .venv 失败
        popd
        exit /b 1
    )
    echo   [OK] .venv 已创建
) else (
    echo   [OK] .venv 已存在
)

REM ---- 3. 安装 Python 依赖 ----
echo.
echo [3/6] 安装 Python 依赖（这可能需要几分钟）...
call ".venv\Scripts\python.exe" -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple --quiet 2>nul
if errorlevel 1 call ".venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
call ".venv\Scripts\python.exe" -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --quiet 2>nul
if errorlevel 1 call ".venv\Scripts\python.exe" -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo   [X] pip install 失败
    popd
    exit /b 1
)
echo   [OK] Python 依赖已就位

REM ---- 4. 检查 Node.js ----
echo.
echo [4/6] 检查 Node.js ...
where node >nul 2>&1
if errorlevel 1 (
    echo   [X] 未找到 node，请先安装 Node.js 20+：
    echo     https://nodejs.org/
    popd
    exit /b 1
)
for /f "tokens=1 delims=." %%a in ('node -v 2^>^&1') do set "NODE_RAW=%%a"
set "NODE_MAJOR=!NODE_RAW:v=!"
if !NODE_MAJOR! LSS 20 (
    echo   [X] Node.js 主版本过低（!NODE_MAJOR!），需要 20+
    popd
    exit /b 1
)
echo   [OK] Node.js !NODE_RAW!

REM ---- 5. 安装前端依赖 + 构建 ----
echo.
echo [5/6] 安装前端依赖（这可能需要几分钟）...
pushd frontend-react
call npm install --silent --no-audit --no-fund --registry=https://registry.npmmirror.com 2>nul
if errorlevel 1 call npm install --silent --no-audit --no-fund
if errorlevel 1 (
    echo   [X] npm install 失败
    popd
    popd
    exit /b 1
)
echo   [OK] node_modules 已就位

echo.
echo [6/6] 构建前端产物 frontend-react\dist ...
call npm run build --silent
if errorlevel 1 (
    echo   [X] npm run build 失败
    popd
    popd
    exit /b 1
)
echo   [OK] dist 已生成
popd

REM ---- 6. 复制 .env ----
echo.
if not exist ".env" (
    if exist ".env.example" (
        echo [附加] 创建 .env ...
        copy /Y .env.example .env >nul
        echo   [OK] .env 已从 .env.example 创建（请按需修改）
    ) else (
        echo [!] .env.example 不存在，跳过
    )
) else (
    echo [附加] .env 已存在，跳过
)

REM ---- 数据库初始化提示 ----
echo.
if not exist "database\shengxintou.db" (
    echo [提示] 首次安装，下次启动 Flask 时会自动创建数据库 database\shengxintou.db
)

echo.
echo ============================================================
echo   [OK] 所有依赖已就绪
echo ============================================================
echo.
echo 接下来你可以：
echo   1. 直接双击 省心投启动器.exe 启动桌面应用
echo   2. 或开发模式：
echo        $env:DEV_MODE='1'; .venv\Scripts\python.exe app.py
echo        然后另开终端: cd frontend-react ^&^& npm run dev
echo.

popd
endlocal
exit /b 0