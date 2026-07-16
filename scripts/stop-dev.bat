@echo off
REM v3.1.25: \u5b89\u5168\u5173\u95ed Flask (:5000) + Vite (:3000) \u8fdb\u7a0b

setlocal
cd /d "%~dp0"

echo === \u5173\u95ed Flask ===
for /f %%i in (logs\dev-pids\flask.pid 2^>nul) do (
    taskkill /F /PID %%i >nul 2>&1 && echo [OK] Flask PID %%i \u5df2\u7ec8\u6b62
)
if not exist logs\dev-pids\flask.pid (
    for /f "tokens=2" %%i in ('netstat -ano ^| findstr ":5000.*LISTENING"') do (
        taskkill /F /PID %%i >nul 2>&1 && echo [!] :5000 \u5360\u7528\u8fdb\u7a0b PID %%i \u5df2\u7ec8\u6b62
    )
)
del /q logs\dev-pids\flask.pid 2>nul

echo.
echo === \u5173\u95ed Vite ===
for /f %%i in (logs\dev-pids\vite.pid 2^>nul) do (
    taskkill /F /PID %%i >nul 2>&1 && echo [OK] Vite PID %%i \u5df2\u7ec8\u6b62
)
if not exist logs\dev-pids\vite.pid (
    for /f "tokens=2" %%i in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
        taskkill /F /PID %%i >nul 2>&1 && echo [!] :3000 \u5360\u7528\u8fdb\u7a0b PID %%i \u5df2\u7ec8\u6b62
    )
)
del /q logs\dev-pids\vite.pid 2>nul

echo.
echo \u2705 \u5168\u90e8\u505c\u6b62
endlocal
