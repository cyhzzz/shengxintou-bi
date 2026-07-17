@echo off
REM ============================================================
REM  省心投 BI - 全量功能测试（手动触发）
REM  内容：API 冒烟 + 前端冒烟 + 全量功能测试
REM  耗时：较长（约 10~30 分钟）
REM  使用：发版前手动运行，平时不需要跑
REM ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d "%~dp0.."

echo.
echo ==========================================
echo  省心投 BI - 全量功能测试
echo  注意：本测试耗时较长（10~30 分钟），
echo        仅在发版前手动运行。
echo ==========================================
echo.

set ALL_PASS=1

REM ---- 步骤 1：后端 API 冒烟测试 ----
echo [1/3] 后端 API 冒烟测试...
python -m unittest discover -s tests/api -q 2>&1
set API_EXIT=%ERRORLEVEL%
if %API_EXIT%==0 (
    echo [PASS] 后端 API 冒烟测试通过
) else (
    echo [FAIL] 后端 API 冒烟测试失败
    set ALL_PASS=0
)
echo.

REM ---- 步骤 2：前端构建 ----
echo [2/3] 前端构建...
cd frontend-react
call npm.cmd run build >nul 2>&1
set BUILD_EXIT=%ERRORLEVEL%
cd ..
if %BUILD_EXIT%==0 (
    echo [PASS] 前端构建通过
) else (
    echo [FAIL] 前端构建失败
    set ALL_PASS=0
)
echo.

REM ---- 步骤 3：前端全量功能测试 ----
echo [3/3] 前端全量功能测试（Playwright）...
echo       （首次运行会自动下载浏览器，可能较慢）
cd frontend-react
call npm.cmd run test:functional 2>&1
set FUNC_EXIT=%ERRORLEVEL%
cd ..
if %FUNC_EXIT%==0 (
    echo [PASS] 前端全量功能测试通过
) else (
    echo [FAIL] 前端全量功能测试失败
    set ALL_PASS=0
)
echo.

REM ---- 汇总 ----
echo ==========================================
if %ALL_PASS%==1 (
    echo  [ALL PASS] 全量测试全部通过 ✓
    echo ==========================================
    exit /b 0
) else (
    echo  [FAIL] 全量测试有未通过项 ✗
    echo ==========================================
    exit /b 1
)
