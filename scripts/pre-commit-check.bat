@echo off
REM ============================================================
REM  省心投 BI - 提交前快速检查（pre-commit check）
REM  内容：后端 API 冒烟 + 前端构建
REM  耗时：约 1~2 分钟
REM  使用：提交代码前双击运行，全部绿灯再 commit
REM ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d "%~dp0.."

echo.
echo ==========================================
echo  省心投 BI - Pre-commit Check
echo ==========================================
echo.

set ALL_PASS=1

REM ---- 步骤 1：后端 API 冒烟测试 ----
echo [1/2] 后端 API 冒烟测试...
python -m unittest discover -s tests/api -q 2>&1
set API_EXIT=%ERRORLEVEL%
if %API_EXIT%==0 (
    echo [PASS] 后端 API 冒烟测试通过
) else (
    echo [FAIL] 后端 API 冒烟测试失败（退出码: %API_EXIT%）
    set ALL_PASS=0
)
echo.

REM ---- 步骤 2：前端构建 ----
echo [2/2] 前端构建（vite build）...
cd frontend-react
call npm.cmd run build 2>&1 | findstr /C:"error" /C:"ERROR" /C:"failed" /C:"✓" /C:"built" /C:"BUILD"
set BUILD_EXIT=%ERRORLEVEL%
cd ..

REM 用返回码判断更准确
cd frontend-react
call npm.cmd run build >nul 2>&1
set BUILD_EXIT=%ERRORLEVEL%
cd ..

if %BUILD_EXIT%==0 (
    echo [PASS] 前端构建通过
) else (
    echo [FAIL] 前端构建失败（退出码: %BUILD_EXIT%）
    set ALL_PASS=0
)
echo.

REM ---- 汇总 ----
echo ==========================================
if %ALL_PASS%==1 (
    echo  [ALL PASS] 全部检查通过，可以提交了 ✓
    echo ==========================================
    exit /b 0
) else (
    echo  [FAIL] 有检查未通过，请修复后再提交 ✗
    echo ==========================================
    exit /b 1
)
