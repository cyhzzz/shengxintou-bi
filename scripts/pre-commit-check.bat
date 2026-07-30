@echo off
REM ============================================================
REM  Shengxintou BI - pre-commit check
REM  Content: rule architecture + cross-platform contract + backend API smoke + frontend build
REM  Runtime: about 1-2 minutes
REM  Usage: run before commit; commit only after all checks pass
REM ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d %~dp0..

echo.
echo ==========================================
echo  Shengxintou BI - Pre-commit Check
echo ==========================================
echo.

set ALL_PASS=1

REM ---- Step 1: rule architecture ----
echo [1/8] Rule architecture check...
python scripts\check_rule_architecture.py
set RULE_EXIT=%ERRORLEVEL%
if %RULE_EXIT%==0 (
    echo [PASS] Rule architecture check passed
) else (
    echo [FAIL] Rule architecture check failed ^(exit: %RULE_EXIT%^)
    set ALL_PASS=0
)
echo.

REM ---- Step 2: cross-platform contract drift ----
echo [2/7] Cross-platform contract: API vs mobileRouteHandler...
python scripts\check_api_contract.py
set CONTRACT_EXIT=%ERRORLEVEL%
if %CONTRACT_EXIT%==0 (
    echo [PASS] API contract check passed
) else (
    echo [FAIL] API contract check failed ^(exit: %CONTRACT_EXIT%^)
    set ALL_PASS=0
)
echo.

echo [3/7] Cross-platform contract: router vs smoke spec...
python scripts\check_route_drift.py
set ROUTE_EXIT=%ERRORLEVEL%
if %ROUTE_EXIT%==0 (
    echo [PASS] Route drift check passed
) else (
    echo [FAIL] Route drift check failed ^(exit: %ROUTE_EXIT%^)
    set ALL_PASS=0
)
echo.

echo [4/8] Cross-platform contract: featureFlags usage...
python scripts\check_feature_flags.py
set FLAGS_EXIT=%ERRORLEVEL%
if %FLAGS_EXIT%==0 (
    echo [PASS] featureFlags check passed
) else (
    echo [FAIL] featureFlags check failed ^(exit: %FLAGS_EXIT%^)
    set ALL_PASS=0
)
echo.

echo [5/8] Cross-platform contract: mobileRouteHandler case coverage...
python scripts\check_mobile_routes_coverage.py
set COVERAGE_EXIT=%ERRORLEVEL%
if %COVERAGE_EXIT%==0 (
    echo [PASS] mobileRouteHandler case coverage check passed
) else (
    echo [FAIL] mobileRouteHandler case coverage check failed ^(exit: %COVERAGE_EXIT%^)
    set ALL_PASS=0
)
echo.

REM ---- Step 6: FilterBar usage ----
echo [6/8] Frontend FilterBar usage vs hand-written RangePicker...
python scripts\check_filter_bar_usage.py
set FILTER_EXIT=%ERRORLEVEL%
if %FILTER_EXIT%==0 (
    echo [PASS] FilterBar usage check passed
) else (
    echo [FAIL] FilterBar usage check failed ^(exit: %FILTER_EXIT%^)
    set ALL_PASS=0
)
echo.

REM ---- Step 7: backend API smoke ----
echo [7/8] Backend API smoke...
python -m unittest discover -s tests/api -q 2>&1
set API_EXIT=%ERRORLEVEL%
if %API_EXIT%==0 (
    echo [PASS] Backend API smoke passed
) else (
    echo [FAIL] Backend API smoke failed ^(exit: %API_EXIT%^)
    set ALL_PASS=0
)
echo.

REM ---- Step 8: frontend build ----
echo [8/8] Frontend build ^(vite build^)...
cd frontend-react
call npm.cmd run build
set BUILD_EXIT=%ERRORLEVEL%
cd ..

if %BUILD_EXIT%==0 (
    echo [PASS] Frontend build passed
) else (
    echo [FAIL] Frontend build failed ^(exit: %BUILD_EXIT%^)
    set ALL_PASS=0
)
echo.

REM ---- Summary ----
echo ==========================================
if %ALL_PASS%==1 (
    echo  [ALL PASS] All checks passed; ready to commit
    echo ==========================================
    exit /b 0
) else (
    echo  [FAIL] Fix failed checks before committing
    echo ==========================================
    exit /b 1
)
