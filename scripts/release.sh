#!/usr/bin/env bash
# -*- coding: utf-8 -*-
# 省心投 BI - 一键发布（Unix）
#
# 用法：
#   bash scripts/release.sh              交互式询问版本号
#   bash scripts/release.sh 3.3.6        直接指定版本号
#
# 流程（自当前版本起，release.sh 只负责变更提交，发版构建由开发者本地手动完成）：
#   1. 更新 version.json
#   2. git commit + tag vX.Y.Z
#   3. git push origin main --tags
#   4. [开发者本地手动] scripts/build-installer.ps1（Windows）
#      + cd android && npm run build:apk（Android）
#      + gh release upload vX.Y.Z 上传产物
#
# 仓库内 .github/workflows/release.yml 是历史占位（trigger 语法 bug），
#   CI 不再自动构建发布。这是有意保留的冗余文档，不是缺失功能。

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f "version.json" ]; then
    echo "[X] 未找到 version.json，请在仓库根目录运行"
    exit 1
fi

CUR_VER="$(python3 -c "import json; print(json.load(open('version.json', encoding='utf-8'))['version'])" 2>/dev/null \
    || python -c "import json; print(json.load(open('version.json', encoding='utf-8'))['version'])")"
echo "当前版本：v$CUR_VER"

if [ -z "$1" ]; then
    read -p "请输入新版本号（当前 $CUR_VER，例 3.3.6）：" NEW_VER
else
    NEW_VER="$1"
fi

if ! [[ "$NEW_VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "[X] 版本号格式不对（应为 X.Y.Z，例如 3.3.6）"
    exit 1
fi

echo
echo "即将发布 v$NEW_VER，流程："
echo "  1. 更新 version.json"
echo "  2. git commit + tag v$NEW_VER"
echo "  3. git push origin main --tags"
echo "  4. [本地手动] scripts/build-installer.ps1（Windows） + cd android && npm run build:apk（Android）"
echo "  5. gh release upload v$NEW_VER ... --repo cyhzzz/shengxintou-bi"
echo
read -p "确认？(y/N) " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "取消发布"
    exit 0
fi

if ! git diff --quiet --exit-code 2>/dev/null; then
    echo "[警告] 工作区有未提交改动，请先 commit 或 stash"
    git status --short
    exit 1
fi

NEW_VER="$NEW_VER" python -c "
import json, datetime, os
p = 'version.json'
d = json.load(open(p, encoding='utf-8'))
v = os.environ['NEW_VER']
d['version'] = v
d['release_date'] = datetime.date.today().isoformat()
d['changelog'].insert(0, f'v{v} (changelog 待补)')
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=4)
"

echo "[1/4] git add version.json"
git add version.json
git commit -m "release: v$NEW_VER"

echo "[2/4] git tag v$NEW_VER"
git tag "v$NEW_VER"

echo "[3/4] git push origin main --tags"
git push origin main --tags

echo
echo "[4/4] tag pushed; 等待开发者本地构建 + 上传"
echo "下一步："
echo "  - Windows:  ./scripts/build-installer.ps1  (在 Windows 上跑)"
echo "  - Android:  cd android && npm run build:apk"
echo "  - 上传:      gh release upload v$NEW_VER \"./dist/*setup*.exe\" \"android/release/*.apk\" --repo cyhzzz/shengxintou-bi"