#!/usr/bin/env bash
# -*- coding: utf-8 -*-
# 省心投 BI - 一键依赖安装（Unix / macOS / Git Bash / WSL）
#
# 用途：clone 仓库后第一件事，让 AI / 用户一行命令搞定所有依赖：
#   1. 检查 Python 3.9+ 与 Node.js 20+
#   2. 创建 .venv 虚拟环境（如果不存在）
#   3. pip install -r requirements.txt
#   4. cd frontend-react && npm install
#   5. npm run build（生成 dist/，启动器必需）
#   6. 复制 .env.example 为 .env（如果不存在）
#
# 用法：
#   bash scripts/setup.sh
# 或在仓库根目录：
#   ./scripts/setup.sh
#
# 此脚本幂等：可重复执行，已就位的步骤会自动跳过。

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo
echo "============================================================"
echo "  省心投 BI - 一键依赖安装"
echo "============================================================"
echo

# ---- 1. Python 检查 ----
echo "[1/6] 检查 Python ..."
if command -v python3 >/dev/null 2>&1; then
    PY=python3
elif command -v python >/dev/null 2>&1; then
    PY=python
else
    echo "  [X] 未找到 python3 / python"
    echo
    echo "  请先安装 Python 3.9 或更高版本：https://www.python.org/downloads/"
    exit 1
fi

PY_VER="$($PY --version 2>&1 | awk '{print $2}')"
echo "  [OK] Python $PY_VER"

PY_MAJOR="$(echo "$PY_VER" | cut -d. -f1)"
PY_MINOR="$(echo "$PY_VER" | cut -d. -f2)"
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 9 ]; }; then
    echo "  [X] Python 版本过低 ($PY_VER)，需要 3.9+"
    exit 1
fi

# ---- 2. 创建 .venv ----
echo
echo "[2/6] 准备 Python 虚拟环境 ..."
if [ ! -x ".venv/bin/python" ]; then
    echo "  创建 .venv ..."
    $PY -m venv .venv
    echo "  [OK] .venv 已创建"
else
    echo "  [OK] .venv 已存在"
fi

# ---- 3. 安装 Python 依赖 ----
echo
echo "[3/6] 安装 Python 依赖（这可能需要几分钟）..."
.venv/bin/python -m pip install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple --quiet 2>/dev/null \
    || .venv/bin/python -m pip install --upgrade pip --quiet
.venv/bin/python -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --quiet 2>/dev/null \
    || .venv/bin/python -m pip install -r requirements.txt --quiet
echo "  [OK] Python 依赖已就位"

# ---- 4. 检查 Node.js ----
echo
echo "[4/6] 检查 Node.js ..."
if ! command -v node >/dev/null 2>&1; then
    echo "  [X] 未找到 node，请先安装 Node.js 20+：https://nodejs.org/"
    exit 1
fi
NODE_MAJOR="$(node -v | sed 's/v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "  [X] Node.js 主版本过低 ($NODE_MAJOR)，需要 20+"
    exit 1
fi
echo "  [OK] Node.js v$(node -v | sed 's/v//')"

# ---- 5. 安装前端依赖 + 构建 ----
echo
echo "[5/6] 安装前端依赖（这可能需要几分钟）..."
cd frontend-react
npm install --silent --no-audit --no-fund --registry=https://registry.npmmirror.com 2>/dev/null \
    || npm install --silent --no-audit --no-fund
echo "  [OK] node_modules 已就位"

echo
echo "[6/6] 构建前端产物 frontend-react/dist ..."
npm run build --silent
echo "  [OK] dist 已生成"
cd "$ROOT_DIR"

# ---- 6. 复制 .env ----
echo
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "[附加] 创建 .env ..."
        cp .env.example .env
        echo "  [OK] .env 已从 .env.example 创建（请按需修改）"
    else
        echo "[!] .env.example 不存在，跳过"
    fi
else
    echo "[附加] .env 已存在，跳过"
fi

# ---- 数据库初始化提示 ----
echo
if [ ! -f "database/shengxintou.db" ]; then
    echo "[提示] 首次安装，下次启动 Flask 时会自动创建数据库 database/shengxintou.db"
fi

echo
echo "============================================================"
echo "  [OK] 所有依赖已就绪"
echo "============================================================"
echo
echo "接下来你可以："
echo "  1. 直接双击 省心投启动器.exe 启动桌面应用"
echo "  2. 或开发模式："
echo "        DEV_MODE=1 .venv/bin/python app.py"
echo "        然后另开终端: cd frontend-react && npm run dev"
echo