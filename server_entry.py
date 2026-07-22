# -*- coding: utf-8 -*-
"""
省心投 BI - PyInstaller 入口

设计：
- 开发模式：python server_entry.py → 直接 from app import app; app.run(...)
- 打包模式：PyInstaller frozen → server.exe 位于 <resources>/server/server.exe
  → app_dir = <resources>/（app.py / config.py / backend/ 都在这里）
  → chdir + sys.path 注入 app_dir，让 from app / from config / from backend 正常工作

Electron 客户端会把整个 server/ onedir 目录放在 resources/server/，应用代码在 resources/，
所以 frozen 模式下需要回退两级到 resources/。
"""
import os
import sys


def _resolve_app_dir() -> str:
    """返回应用根目录（含 app.py 的目录）。

    优先级：
    1. sys.executable 推导（Electron 打包后 server.exe 在 resources/server/，app.py 在 resources/）
    2. cwd（Electron 设 cwd=resources/；开发测试时手动 cd 到项目根）
    3. 脚本所在目录（开发模式）
    """
    if getattr(sys, 'frozen', False):
        # PyInstaller: sys.executable = <resources>/server/server.exe → app_dir = <resources>/
        exe_app_dir = os.path.dirname(os.path.dirname(sys.executable))
        if os.path.exists(os.path.join(exe_app_dir, 'app.py')):
            return exe_app_dir
        # fallback: cwd（Electron 会设 cwd=resources/）
        cwd = os.getcwd()
        if os.path.exists(os.path.join(cwd, 'app.py')):
            return cwd
        # 最后兜底：返回 exe 推导路径，让后续 import 报清晰的错
        return exe_app_dir
    # 开发模式：脚本在项目根
    return os.path.dirname(os.path.abspath(__file__))


def main():
    app_dir = _resolve_app_dir()
    # 注入 sys.path，让 import app / import config / from backend... 工作
    if app_dir not in sys.path:
        sys.path.insert(0, app_dir)
    # chdir 到应用根，让 load_dotenv() / 相对路径能读到 .env / backend/config/anchor_live_types.json
    os.chdir(app_dir)
    # DEV_MODE=1 避免启动器尝试启动 pywebview（与 Electron 主进程抢窗口）
    os.environ.setdefault('DEV_MODE', '1')

    # 延迟 import，让 sys.path / cwd / 环境变量先生效
    from app import app
    from config import PORT, HOST

    # 关闭 reloader（PyInstaller 不支持多进程 fork）
    app.run(
        host=HOST or '127.0.0.1',
        port=int(PORT or 5000),
        debug=False,
        use_reloader=False,
        threaded=True,
    )


if __name__ == '__main__':
    main()
