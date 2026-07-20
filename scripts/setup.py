#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
省心投 BI - 一键依赖安装（跨平台 Python 实现）

当 bash / batch 不可用时的兜底入口。AI 助手 clone 仓库后只需：
    python scripts/setup.py
即可完成全部依赖准备。

步骤：
    1. 自检 Python / Node 版本
    2. 创建 .venv
    3. pip install -r requirements.txt
    4. cd frontend-react && npm install
    5. npm run build（生成 dist/）
    6. 复制 .env.example 为 .env
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
PY_MIN = (3, 9)
NODE_MIN_MAJOR = 20

PIP_INDEX = "https://pypi.tuna.tsinghua.edu.cn/simple"
NPM_REGISTRY = "https://registry.npmmirror.com"


def log(step: str, msg: str) -> None:
    print(f"[{step}] {msg}")


def run(cmd: list[str], cwd: Path | None = None, check: bool = True) -> int:
    """Run subprocess, print the command, return exit code."""
    pretty = " ".join(cmd)
    print(f"  $ {pretty}")
    return subprocess.run(cmd, cwd=cwd, check=check).returncode


def find_python() -> str:
    for cand in ("python3", "python"):
        path = shutil.which(cand)
        if path:
            return path
    print("  [X] 未找到 python3 / python")
    print("    请先安装 Python 3.9+：https://www.python.org/downloads/")
    sys.exit(1)


def find_node() -> str:
    path = shutil.which("node")
    if not path:
        print("  [X] 未找到 node")
        print("    请先安装 Node.js 20+：https://nodejs.org/")
        sys.exit(1)
    return path


def parse_version(v: str) -> tuple[int, ...]:
    return tuple(int(x) for x in v.strip().split(".") if x.isdigit())


def main() -> int:
    print()
    print("=" * 60)
    print("  省心投 BI - 一键依赖安装 (Python 跨平台版)")
    print("=" * 60)
    print()

    # 1. Python
    log("1/6", "检查 Python ...")
    py = find_python()
    out = subprocess.run([py, "--version"], capture_output=True, text=True)
    ver = parse_version(out.stdout.replace("Python", "").strip() or out.stderr.strip())
    print(f"  [OK] Python {ver[0]}.{ver[1]}.{ver[2]}")
    if ver < PY_MIN:
        print(f"  [X] Python 版本过低 ({ver[0]}.{ver[1]})，需要 3.9+")
        return 1

    # 2. .venv
    log("2/6", "准备 Python 虚拟环境 ...")
    venv_py = ROOT_DIR / ".venv" / ("Scripts" if platform.system() == "Windows" else "bin") / ("python.exe" if platform.system() == "Windows" else "python")
    if not venv_py.exists():
        print("  创建 .venv ...")
        run([py, "-m", "venv", str(ROOT_DIR / ".venv")])
        print("  [OK] .venv 已创建")
    else:
        print("  [OK] .venv 已存在")

    # 3. pip install
    log("3/6", "安装 Python 依赖 ...")
    print("  （首次安装可能需要几分钟）")
    pip_args_base = [str(venv_py), "-m", "pip"]
    try:
        run([*pip_args_base, "install", "--upgrade", "pip", "-i", PIP_INDEX, "--quiet"])
    except subprocess.CalledProcessError:
        run([*pip_args_base, "install", "--upgrade", "pip", "--quiet"])
    try:
        run([*pip_args_base, "install", "-r", "requirements.txt", "-i", PIP_INDEX, "--quiet"])
    except subprocess.CalledProcessError:
        run([*pip_args_base, "install", "-r", "requirements.txt", "--quiet"])
    print("  [OK] Python 依赖已就位")

    # 4. Node
    log("4/6", "检查 Node.js ...")
    node = find_node()
    node_ver = parse_version(subprocess.run([node, "-v"], capture_output=True, text=True).stdout.strip().lstrip("v"))
    if node_ver[0] < NODE_MIN_MAJOR:
        print(f"  [X] Node.js 主版本过低 ({node_ver[0]})，需要 20+")
        return 1
    print(f"  [OK] Node.js v{node_ver[0]}.{node_ver[1]}")

    # 5. npm install + build
    fe_dir = ROOT_DIR / "frontend-react"
    log("5/6", "安装前端依赖 ...")
    print("  （首次安装可能需要几分钟）")
    try:
        run(["npm", "install", "--no-audit", "--no-fund", "--registry", NPM_REGISTRY], cwd=fe_dir)
    except subprocess.CalledProcessError:
        run(["npm", "install", "--no-audit", "--no-fund"], cwd=fe_dir)
    print("  [OK] node_modules 已就位")

    log("6/6", "构建前端产物 frontend-react/dist ...")
    run(["npm", "run", "build"], cwd=fe_dir)
    print("  [OK] dist 已生成")

    # 6. .env
    env_file = ROOT_DIR / ".env"
    example = ROOT_DIR / ".env.example"
    if not env_file.exists():
        if example.exists():
            print()
            log("附加", "创建 .env ...")
            shutil.copyfile(example, env_file)
            print("  [OK] .env 已从 .env.example 创建（请按需修改）")
        else:
            print()
            print("[!] .env.example 不存在，跳过")
    else:
        print()
        print("[附加] .env 已存在，跳过")

    # 数据库提示
    db_file = ROOT_DIR / "database" / "shengxintou.db"
    if not db_file.exists():
        print()
        print("[提示] 首次安装，下次启动 Flask 时会自动创建数据库 database/shengxintou.db")

    print()
    print("=" * 60)
    print("  [OK] 所有依赖已就绪")
    print("=" * 60)
    print()
    print("接下来你可以：")
    print("  1. 直接双击 省心投启动器.exe 启动桌面应用")
    print("  2. 或开发模式：")
    print("       跨平台：")
    plat = platform.system()
    if plat == "Windows":
        print("         set DEV_MODE=1 && .venv\\Scripts\\python.exe app.py")
        print("         然后另开终端：cd frontend-react && npm run dev")
    else:
        print("         DEV_MODE=1 .venv/bin/python app.py")
        print("         然后另开终端：cd frontend-react && npm run dev")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())