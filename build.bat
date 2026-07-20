@echo off
REM 省心投启动器打包脚本
REM 用法:  python -m pip install pyinstaller
REM        build.bat           — 清理 + 打包便携版（无 console）
REM        build.bat dev       — 打包开发版（带 console，便于调试）

setlocal

if \"%1\"==\"dev\" (
    set SPEC=省心投-开发版.spec
    set LABEL=开发版（带 console）
) else (
    set SPEC=省心投启动器.spec
    set LABEL=便携版（无 console）
)

echo === 省心投BI PyInstaller 打包 (%LABEL%) ===
echo spec: %SPEC%

REM 清理上次构建
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

pyinstaller --noconfirm %SPEC%

echo === 完成：dist\省心投启动器.exe ===
endlocal
