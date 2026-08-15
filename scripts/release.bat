@echo off
REM ============================================================
REM 省心投 BI - 一键发布（本地打 tag + push + 等待本地构建上传）
REM
REM 用法：
REM   scripts\release.bat              交互式询问版本号
REM   scripts\release.bat 3.3.6        直接指定版本号（PATCH 段）
REM   scripts\release.bat 3.4.0        直接指定版本号（MINOR 段）
REM
REM 流程（release.bat 只负责版本变更与推 tag；打包挂载由 GitHub Actions 自动完成）：
REM   1. 读取 version.json 当前版本
REM   2. 提示/解析新版本号
REM   3. 更新 version.json（version / release_date / changelog 占位）
REM   4. git commit -am "release: vX.Y.Z"
REM   5. git tag vX.Y.Z
REM   6. git push origin main --tags
REM   7. [自动] 推送 vX.Y.Z tag 触发 .github\workflows\release.yml：
REM      GitHub Actions 先等 CI 全绿，再自动构建 server.exe 安装包 + frontend-dist.zip
REM      + Android APK，并挂载到 https://github.com/cyhzzz/shengxintou-bi/releases/tag/vX.Y.Z
REM ============================================================

setlocal EnableDelayedExpansion
chcp 65001 >nul

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%"

if not exist "version.json" (
    echo [X] 未找到 version.json，请在仓库根目录运行
    popd
    exit /b 1
)

REM 读当前版本（依赖 python）
for /f "delims=" %%v in ('python -c "import json; print(json.load(open(r''version.json'', encoding=''utf-8''))['version'])"') do set "CUR_VER=%%v"
echo 当前版本：v%CUR_VER%

REM 解析新版本号
if "%~1"=="" (
    set /p "NEW_VER=请输入新版本号（当前 %CUR_VER%，例 3.3.6 或 3.4.0）："
) else (
    set "NEW_VER=%~1"
)

REM 简单校验：必须形如 X.Y.Z
echo %NEW_VER% | findstr /R "^[0-9]*\.[0-9]*\.[0-9]*$" >nul
if errorlevel 1 (
    echo [X] 版本号格式不对（应为 X.Y.Z，例如 3.3.6）
    popd
    exit /b 1
)

echo.
echo 即将发布 v%NEW_VER%，流程：
echo   1. 更新 version.json
echo   2. git commit + tag v%NEW_VER%
echo   3. git push origin main --tags
echo   4. [自动] GitHub Actions 先等 CI 全绿，再打包 exe + APK + frontend-dist.zip 并挂载到 release
echo      发布页：https://github.com/cyhzzz/shengxintou-bi/releases/tag/v%NEW_VER%
echo.
set /p "CONFIRM=确认？(y/N) "
if /i not "%CONFIRM%"=="y" (
    echo 取消发布
    popd
    exit /b 0
)

REM 检查工作区是否 dirty（不能直接 commit）
git diff --quiet --exit-code 2>nul
if errorlevel 1 (
    echo [警告] 工作区有未提交改动，请先 commit 或 stash
    git status --short
    popd
    exit /b 1
)

REM 更新 version.json：覆盖 version 字段 + 追加 changelog 占位条目
python -c ^
    "import json, sys; p=r'version.json'; d=json.load(open(p,encoding='utf-8')); v='%NEW_VER%'; d['version']=v; d['release_date']=__import__('datetime').date.today().isoformat(); d['changelog'].insert(0, f'v{v} (changelog 待补)'); json.dump(d, open(p,'w',encoding='utf-8'), ensure_ascii=False, indent=4)"

echo [1/4] git add version.json
git add version.json
git commit -m "release: v%NEW_VER%"

echo [2/4] git tag v%NEW_VER%
git tag v%NEW_VER%

echo [3/4] git push origin main --tags
git push origin main --tags
if errorlevel 1 (
    echo [X] push 失败
    popd
    exit /b 1
)

echo [4/4] tag pushed; GitHub Actions 将自动（等 CI 全绿后）打包并挂载产物
echo 查看进度： https://github.com/cyhzzz/shengxintou-bi/actions
echo 发布页：   https://github.com/cyhzzz/shengxintou-bi/releases/tag/v%NEW_VER%
echo.

popd
endlocal
exit /b 0