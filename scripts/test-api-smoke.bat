@echo off
REM ============================================================
REM  省心投 BI - 后端 API 冒烟测试
REM  耗时：约 1~3 秒
REM ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d "%~dp0.."

echo.
echo ==========================================
echo  后端 API 冒烟测试
echo ==========================================
echo.

python -m unittest discover -s tests/api -v
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE%==0 (
    echo [PASS] 后端 API 冒烟测试全部通过
) else (
    echo [FAIL] 后端 API 冒烟测试失败，退出码: %EXIT_CODE%
)

exit /b %EXIT_CODE%
