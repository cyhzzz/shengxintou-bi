# -*- coding: utf-8 -*-
"""
系统自更新 API（v3.1.17）

通过 subprocess 调用 git pull origin main，把 GitHub 最新代码同步到本地。

设计原则：
- 不在本进程热重载任何 Python 模块：调用方需要重启 Flask / Vite。
- 后端只负责执行 git pull + 解析结果，不主动 build。
- 前端版本比对 + 触发入口仍在 HelpModal（v3.1.16 接入）。
- 全部路径经 `os.path.dirname(__file__)` 推导 project_root，兼容 PyInstaller 打包环境。
"""

import os
import subprocess
import threading
import uuid
import logging
from datetime import datetime

from flask import Blueprint, request, jsonify, current_app

from backend.utils.decorators import handle_exceptions
from backend.routes.version import get_local_version

logger = logging.getLogger(__name__)

bp = Blueprint("system", __name__, url_prefix="/api/v1/system")

_update_tasks: dict = {}
_update_lock = threading.Lock()


def _project_root() -> str:
    """获取项目根目录（backend/routes/system/self_update.py -> project_root）。"""
    here = os.path.dirname(os.path.abspath(__file__))
    # 三层 dirname：self_update.py -> system/ -> routes/ -> backend/ -> project_root
    return os.path.dirname(os.path.dirname(os.path.dirname(here)))


def _run_git(args, cwd, timeout=60):
    """执行 git 命令，返回 (returncode, stdout, stderr)。"""
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
            creationflags=0x08000000,  # CREATE_NO_WINDOW
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "git " + " ".join(args) + " 超时（" + str(timeout) + "s）"
    except FileNotFoundError:
        return 127, "", "未找到 git 可执行文件，请先安装 Git 并加入 PATH"
    except Exception as e:
        logger.exception("git 执行失败")
        return 1, "", "git 执行异常: " + str(e)


def _read_version_json() -> dict:
    """读项目根 version.json，纯函数版本（不依赖 Flask app context）。"""
    import json
    root = _project_root()
    vf = os.path.join(root, "version.json")
    try:
        with open(vf, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        logger.warning("_read_version_json failed: %s", e)
        return {}


def _git_status_snapshot(project_root):
    """读取 git 当前状态：HEAD hash、branch、dirty、remote HEAD。"""
    rc, sha, err = _run_git(["rev-parse", "HEAD"], project_root)
    if rc != 0:
        return {"available": False, "error": err or "git rev-parse 失败"}

    rc2, branch, _ = _run_git(["rev-parse", "--abbrev-ref", "HEAD"], project_root)
    branch = (branch or "").strip() or "main"

    rc3, status_out, _ = _run_git(["status", "--porcelain"], project_root)
    dirty = bool((status_out or "").strip())

    rc4, remote_sha, _ = _run_git(["ls-remote", "origin", "HEAD"], project_root, timeout=30)
    remote_head = ""
    if rc4 == 0 and remote_sha:
        parts = remote_sha.split()
        remote_head = parts[0] if parts else ""

    return {
        "available": True,
        "branch": branch,
        "local_sha": (sha or "").strip(),
        "remote_sha": remote_head,
        "dirty": dirty,
        "checked_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }


@bp.route("/self-update/git-status", methods=["GET"])
@handle_exceptions
def git_status():
    """读取本地 git 状态，供前端判断是否显示更新按钮。"""
    project_root = _project_root()
    snap = _git_status_snapshot(project_root)
    local_version = get_local_version() or {}
    snap["local_version"] = local_version.get("version", "")
    return jsonify({"success": True, "data": snap})


def _do_self_update(task_id, force):
    """实际执行 self-update 的核心逻辑（被异步线程调用）。"""
    project_root = _project_root()
    log_lines = []

    # 进度阶段（running 中单调递增，仅 success 才会被覆盖为 100）：
    #   5  -> 已提交任务（start_self_update 写入）
    #  15  -> 读取本地状态完成
    #  25  -> git stash（仅 dirty + force 走）
    #  40  -> git fetch origin 完成
    #  60  -> 准备 git pull
    #  85  -> git pull 完成，正在校验
    #  95  -> 恢复 stash（仅 dirty + force 走）
    # 100  -> success（在成功分支写入）
    def log(msg, progress=None):
        ts = datetime.now().strftime("%H:%M:%S")
        line = "[" + ts + "] " + msg
        log_lines.append(line)
        with _update_lock:
            _update_tasks[task_id]["log"] = list(log_lines)
            _update_tasks[task_id]["message"] = msg
            if progress is not None:
                _update_tasks[task_id]["progress"] = progress
        logger.info("[self-update %s] %s", task_id, msg)

    try:
        before_version = (_read_version_json() or {}).get("version", "")
        before_snap = _git_status_snapshot(project_root)
        log("开始更新：本地 v" + before_version + " @ " + (before_snap.get("local_sha") or "?")[:8], progress=15)

        if before_snap.get("dirty") and not force:
            log("工作区有未提交改动（force=False 拒绝覆盖）")
            with _update_lock:
                _update_tasks[task_id].update({
                    "status": "failed",
                    "error": "DIRTY_WORKTREE",
                    "message": "工作区有未提交改动，未执行 git pull，避免覆盖本地修改。可重试 force=true 强制更新（自动 stash + pop）。",
                })
            return

        if before_snap.get("dirty") and force:
            log("工作区有改动，force=True 执行 git stash ...", progress=25)
            rc, out, err = _run_git(["stash", "push", "-u", "-m", "self-update-" + task_id], project_root)
            if rc != 0:
                log("git stash 失败: " + err)
                with _update_lock:
                    _update_tasks[task_id].update({
                        "status": "failed",
                        "error": "STASH_FAILED",
                        "message": "git stash 失败: " + err,
                    })
                return
            first_line = (out or "").strip().splitlines()
            log("已 stash: " + (first_line[0] if first_line else "OK"))

        log("执行 git fetch origin（github偶尔慢，最多等 3 分钟）...", progress=40)
        rc, out, err = _run_git(["fetch", "origin"], project_root, timeout=180)
        if rc != 0:
            log("git fetch 失败: " + err)
            with _update_lock:
                _update_tasks[task_id].update({
                    "status": "failed",
                    "error": "FETCH_FAILED",
                    "message": "git fetch 失败: " + err,
                })
            return

        log("执行 git pull --ff-only origin <branch> ...", progress=60)
        rc, out, err = _run_git(["pull", "--ff-only", "origin", before_snap.get("branch", "main")], project_root, timeout=120)
        if rc != 0:
            log("git pull 失败: " + (err or out))
            with _update_lock:
                _update_tasks[task_id].update({
                    "status": "failed",
                    "error": "PULL_FAILED",
                    "message": "git pull 失败: " + (err or out),
                    "log": log_lines,
                })
            return
        log("git pull 完成：" + (out or "").strip()[:200], progress=85)

        after_snap = _git_status_snapshot(project_root)
        after_version = (_read_version_json() or {}).get("version", "")
        log("更新完成：v" + before_version + " -> v" + after_version + " @ " + (after_snap.get("local_sha") or "?")[:8])

        if before_snap.get("dirty") and force:
            log("尝试恢复 stash ...", progress=95)
            rc, out, err = _run_git(["stash", "pop"], project_root)
            if rc != 0:
                log("stash pop 冲突，需手动处理：" + err)
                with _update_lock:
                    _update_tasks[task_id].update({
                        "status": "completed_with_conflicts",
                        "error": "STASH_POP_CONFLICT",
                        "message": "代码已更新，但本地改动与远端冲突。请手动处理冲突后删除多余的 stash。",
                    })
                return

        with _update_lock:
            _update_tasks[task_id].update({
                "status": "success",
                "progress": 100,
                "message": "更新成功：v" + before_version + " -> v" + after_version,
                "before_version": before_version,
                "after_version": after_version,
                "before_sha": before_snap.get("local_sha"),
                "after_sha": after_snap.get("local_sha"),
                "log": log_lines,
            })
    except Exception as e:
        logger.exception("self-update 异常")
        with _update_lock:
            _update_tasks[task_id].update({
                "status": "failed",
                "error": "EXCEPTION",
                "message": "更新异常: " + str(e),
                "log": log_lines,
            })


@bp.route("/self-update/start", methods=["POST"])
@handle_exceptions
def start_self_update():
    """
    启动一次自更新（异步任务）。

    Request:
        { "force": true|false }

    Response:
        { "success": true, "task_id": "<uuid>" }
    """
    data = request.get_json(silent=True) or {}
    force = bool(data.get("force", False))

    task_id = str(uuid.uuid4())
    with _update_lock:
        _update_tasks[task_id] = {
            "status": "running",
            "progress": 5,
            "message": "排队中...",
            "log": [],
            "started_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }

    thread = threading.Thread(target=_do_self_update, args=(task_id, force), daemon=True)
    thread.start()

    return jsonify({"success": True, "data": {"task_id": task_id, "message": "更新任务已启动"}})


@bp.route("/self-update/status", methods=["GET"])
@handle_exceptions
def self_update_status():
    """查询自更新任务状态。前端 1s 轮询。"""
    task_id = request.args.get("task_id", "").strip()
    if not task_id or task_id not in _update_tasks:
        return jsonify({"success": False, "error": "TASK_NOT_FOUND", "message": "任务不存在或已过期"}), 404
    with _update_lock:
        return jsonify({"success": True, "data": {"task_id": task_id, **_update_tasks[task_id]}})


# ============================================================================
# 前端热更新（v3.7.0）
# 从 GitHub Release 下载 frontend-dist.zip，解压覆盖本地 dist 目录。
# 仅适用于 Windows Electron（后端不重启）。Android 端已移除 capacitor-updater，
# 改为直接重装 APK 更新。
# ============================================================================

import io
import zipfile
import tempfile
import shutil
import urllib.request

# GitHub Release latest 的 frontend-dist.zip 下载 URL
_DIST_ZIP_URL = "https://github.com/cyhzzz/shengxintou-bi/releases/latest/download/frontend-dist.zip"


def _dist_dir() -> str:
    """获取 frontend-react/dist 的绝对路径（兼容 PyInstaller 打包环境）。"""
    root = _project_root()
    return os.path.join(root, "frontend-react", "dist")


def _do_frontend_update(task_id):
    """执行前端 dist 热更新（异步线程调用）。"""
    log_lines = []

    def _log(msg):
        log_lines.append(msg)
        logger.info(f"[frontend-update:{task_id}] {msg}")

    try:
        with _update_lock:
            _update_tasks[task_id].update({
                "status": "running",
                "progress": 10,
                "message": "正在下载前端资源包...",
            })

        dist_path = _dist_dir()
        _log(f"目标目录: {dist_path}")

        # 1. 下载 zip
        with _update_lock:
            _update_tasks[task_id].update({
                "progress": 20,
                "message": "正在下载 frontend-dist.zip...",
            })

        req = urllib.request.Request(_DIST_ZIP_URL, headers={
            "User-Agent": "shengxintou-bi-updater/1.0",
        })
        with urllib.request.urlopen(req, timeout=60) as resp:
            zip_data = resp.read()
        _log(f"下载完成: {len(zip_data)} bytes")

        with _update_lock:
            _update_tasks[task_id].update({
                "progress": 50,
                "message": "正在解压并替换文件...",
            })

        # 2. 解压到临时目录
        tmp_dir = tempfile.mkdtemp(prefix="sxt_update_")
        try:
            with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
                zf.extractall(tmp_dir)

            # 找到 dist 根目录（zip 内可能是 dist/ 根或直接文件）
            extracted_items = os.listdir(tmp_dir)
            if len(extracted_items) == 1 and os.path.isdir(os.path.join(tmp_dir, extracted_items[0])):
                # zip 内有顶层目录（如 dist/），进入它
                src_dir = os.path.join(tmp_dir, extracted_items[0])
            else:
                src_dir = tmp_dir

            # 3. 备份旧 dist
            backup_dir = dist_path + ".bak"
            if os.path.exists(backup_dir):
                shutil.rmtree(backup_dir)
            if os.path.exists(dist_path):
                os.rename(dist_path, backup_dir)
                _log("已备份旧 dist 到 dist.bak")

            # 4. 复制新 dist
            os.makedirs(dist_path, exist_ok=True)
            for item in os.listdir(src_dir):
                src_item = os.path.join(src_dir, item)
                dst_item = os.path.join(dist_path, item)
                if os.path.isdir(src_item):
                    shutil.copytree(src_item, dst_item)
                else:
                    shutil.copy2(src_item, dst_item)
            _log("前端资源替换完成")

            # 5. 清理备份
            if os.path.exists(backup_dir):
                shutil.rmtree(backup_dir)

        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

        with _update_lock:
            _update_tasks[task_id].update({
                "status": "completed",
                "progress": 100,
                "message": "前端热更新完成，请刷新页面生效。",
                "log": log_lines,
            })
        _log("热更新任务完成")

    except Exception as e:
        _log(f"热更新失败: {e}")
        with _update_lock:
            _update_tasks[task_id].update({
                "status": "failed",
                "progress": 0,
                "message": f"热更新失败: {e}",
                "log": log_lines,
            })


@bp.route("/frontend-update/start", methods=["POST"])
@handle_exceptions
def start_frontend_update():
    """
    启动前端热更新（异步任务）。
    从 GitHub Release 下载 frontend-dist.zip，解压覆盖本地 dist 目录。
    仅适用于 Windows 桌面版（Electron + Flask 托管）。Android 端走重装 APK。

    Response:
        { "success": true, "data": { "task_id": "<uuid>" } }
    """
    task_id = str(uuid.uuid4())
    with _update_lock:
        _update_tasks[task_id] = {
            "status": "running",
            "progress": 5,
            "message": "排队中...",
            "log": [],
            "started_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }

    thread = threading.Thread(target=_do_frontend_update, args=(task_id,), daemon=True)
    thread.start()

    return jsonify({"success": True, "data": {"task_id": task_id, "message": "前端热更新任务已启动"}})


@bp.route("/frontend-update/status", methods=["GET"])
@handle_exceptions
def frontend_update_status():
    """查询前端热更新任务状态。前端 1s 轮询。"""
    task_id = request.args.get("task_id", "").strip()
    if not task_id or task_id not in _update_tasks:
        return jsonify({"success": False, "error": "TASK_NOT_FOUND", "message": "任务不存在或已过期"}), 404
    with _update_lock:
        return jsonify({"success": True, "data": {"task_id": task_id, **_update_tasks[task_id]}})


# ============================================================================
# Windows 完整静默更新（v3.9.0）
# 从 GitHub Release 下载 full-update.zip（server/ + frontend-react/dist/ + version.json），
# 解压校验后暂存到 resources/.update-staging/，由 Electron 主进程在重启时替换。
# 设计边界：
#   - 后端只负责「下载 + 校验 + 暂存」，不做自我替换（server.exe 运行时被占用）。
#   - 替换动作由 Electron 主进程执行：停 Flask → 从 staging 覆盖 resources 三块 → 重启 Flask → 刷新窗口。
#   - 替代并废弃旧的 frontend-update（仅前端，不更新后端与版本号）。
# ============================================================================

_FULL_UPDATE_ZIP_URL = "https://github.com/cyhzzz/shengxintou-bi/releases/latest/download/full-update.zip"
_FULL_UPDATE_STAGING_DIR = ".update-staging"


def _staging_dir() -> str:
    """resources/.update-staging（frozen 下 project_root = resources/）。"""
    return os.path.join(_project_root(), _FULL_UPDATE_STAGING_DIR)


def _validate_full_update_zip(zf: zipfile.ZipFile) -> dict:
    """校验 full-update.zip 结构，返回其中 version.json 内容。"""
    names = zf.namelist()
    # 与 Electron updater.ts REQUIRED_STAGING 对齐：完整更新需含全部运行时资产
    required = [
        ("server/server.exe", "server/"),
        ("backend/routes/version.py", "backend/"),
        ("app.py", "app.py"),
        ("config.py", "config.py"),
        ("frontend-react/dist/index.html", "frontend-react/dist/"),
        ("version.json", "version.json"),
    ]
    missing = [label for needle, label in required if not any(n.startswith(needle) for n in names)]
    if missing:
        raise ValueError("full-update.zip 结构不完整，缺少: " + ", ".join(missing))
    try:
        raw = zf.read("version.json").decode("utf-8")
        import json  # 局部 import（与 _read_version_json 一致，顶部未导入 json）
        version_data = json.loads(raw)
    except Exception as e:
        raise ValueError("full-update.zip 内 version.json 解析失败: " + str(e)) from e
    return version_data


def _do_full_update_download(task_id):
    """下载 full-update.zip → 校验 → 解压到 .update-staging（异步线程）。"""
    log_lines = []

    def _log(msg):
        log_lines.append(msg)
        logger.info(f"[full-update:{task_id}] {msg}")

    try:
        with _update_lock:
            _update_tasks[task_id].update({"status": "running", "progress": 5, "message": "排队中..."})

        staging = _staging_dir()
        # 清理旧暂存，避免残留脏数据
        if os.path.exists(staging):
            shutil.rmtree(staging)
        os.makedirs(staging, exist_ok=True)

        _log(f"下载 {_FULL_UPDATE_ZIP_URL} ...")
        with _update_lock:
            _update_tasks[task_id].update({"progress": 15, "message": "正在下载完整更新包..."})

        req = urllib.request.Request(_FULL_UPDATE_ZIP_URL, headers={"User-Agent": "shengxintou-bi-updater/1.0"})
        with urllib.request.urlopen(req, timeout=300) as resp:
            zip_data = resp.read()
        _log(f"下载完成: {len(zip_data)} bytes ({round(len(zip_data)/1024/1024, 1)} MB)")
        with _update_lock:
            _update_tasks[task_id].update({"progress": 50, "message": "下载完成，正在校验更新包..."})

        # 校验 zip 结构 + 版本
        with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
            version_data = _validate_full_update_zip(zf)
            _log(f"更新包版本: v{version_data.get('version')}")
            with _update_lock:
                _update_tasks[task_id].update({"progress": 65, "message": "校验通过，正在解压..."})
            zf.extractall(staging)

        _log(f"已解压到 {staging}")
        with _update_lock:
            _update_tasks[task_id].update({
                "status": "completed",
                "progress": 100,
                "message": "完整更新包已就绪，重启应用后生效。",
                "data": {"version": version_data.get("version"), "staging": staging},
                "log": log_lines,
            })
    except Exception as e:
        _log(f"完整更新下载失败: {e}")
        with _update_lock:
            _update_tasks[task_id].update({
                "status": "failed",
                "progress": 0,
                "message": f"完整更新下载失败: {e}",
                "log": log_lines,
            })


@bp.route("/full-update/download", methods=["POST"])
@handle_exceptions
def start_full_update_download():
    """启动完整静默更新：下载 full-update.zip 并暂存到 .update-staging。"""
    task_id = str(uuid.uuid4())
    with _update_lock:
        _update_tasks[task_id] = {
            "status": "running",
            "progress": 5,
            "message": "排队中...",
            "log": [],
            "started_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }
    thread = threading.Thread(target=_do_full_update_download, args=(task_id,), daemon=True)
    thread.start()
    return jsonify({"success": True, "data": {"task_id": task_id, "message": "完整更新下载任务已启动"}})


@bp.route("/full-update/status", methods=["GET"])
@handle_exceptions
def full_update_status():
    """查询完整更新下载状态。前端 1s 轮询。"""
    task_id = request.args.get("task_id", "").strip()
    if not task_id or task_id not in _update_tasks:
        return jsonify({"success": False, "error": "TASK_NOT_FOUND", "message": "任务不存在或已过期"}), 404
    with _update_lock:
        return jsonify({"success": True, "data": {"task_id": task_id, **_update_tasks[task_id]}})