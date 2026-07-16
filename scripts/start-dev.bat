@echo off
REM v3.1.25: \u4e00\u952e\u542f\u52a8 Flask (:5000) + Vite (:3000) \u5f00\u53d1\u73af\u5883
REM \u8fd0\u884c\u540e\u4f1a\u5728 logs/dev-pids/ \u5199\u5165 PID\uff0c\u8c03\u7528 stop-dev.bat \u53ef\u5168\u90e8\u5173\u95ed

setlocal
cd /d "%~dp0"
if not exist logs\dev-pids mkdir logs\dev-pids

echo.
echo === \u68c0\u67e5\u7aef\u53e3 ===
netstat -ano | findstr ":5000.*LISTENING" >nul && (
    echo [!] :5000 \u5df2\u88ab\u5360\u7528\uff0c\u5148\u8c03\u7528 stop-dev.bat \u6216\u624b\u52a8\u91ca\u653e
    exit /b 1
) || (echo [OK] :5000 \u7a7a\u95f2)
netstat -ano | findstr ":3000.*LISTENING" >nul && (
    echo [!] :3000 \u5df2\u88ab\u5360\u7528\uff0c\u5148\u8c03\u7528 stop-dev.bat \u6216\u624b\u52a8\u91ca\u653e
    exit /b 1
) || (echo [OK] :3000 \u7a7a\u95f2)

echo.
echo === \u542f\u52a8 Flask :5000 ===
set "DEV_MODE=1"
start /B "" python app.py > logs\app.log 2>&1
echo Flask PID \u8bb0\u5f55\u4e2d... >nul
echo \u7b49 5s \u8ba9 Flask ready...
timeout /t 5 /nobreak >nul
for /f "tokens=2" %%i in ('tasklist ^| findstr /i "python.exe" ^| findstr "app\.py"') do echo %%i > logs\dev-pids\flask.pid
echo [OK] Flask :5000  PID: /FI

echo.
echo === \u542f\u52a8 Vite :3000 ===
cd frontend-react
start /B "" npm run dev > ..\logs\vite-dev.log 2>&1
cd ..
timeout /t 6 /nobreak >nul
for /f "tokens=2" %%i in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    if not "%i"=="0" echo %i > logs\dev-pids\vite.pid
)
echo [OK] Vite :3000  PID: /FI

echo.
echo === \u9a8c\u8bc1 ===
curl -s -o nul -w "Flask metadata HTTP %%{http_code}\n" http://127.0.0.1:5000/api/v1/version/local || echo [!] Flask \u672a\u5e94\u7b54
curl -s -o nul -w "Vite HTML     HTTP %%{http_code}\n" http://127.0.0.1:3000/ || echo [!] Vite \u672a\u5e94\u7b54

echo.
echo \u2705 \u4eae\u8d77\u5b8c\u6210\uff1a
echo    Flask \u00b7 http://127.0.0.1:5000  (\u4e1a\u52a1 API + \u751f\u4ea7 dist)
echo    Vite  \u00b7 http://127.0.0.1:3000  (\u5f00\u53d1\u70ed\u66f4\u65b0 + /api \u4ee3\u7406 -> :5000)
echo \u505c\u6b62\uff1adouble-click scripts\stop-dev.bat
endlocal
