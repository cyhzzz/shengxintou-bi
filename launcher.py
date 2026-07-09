"""
省心投 BI - 启动器（便携版 / dev fallback）
使用便捷可用的 Python 启动 Flask 后端，服务 frontend-react/dist 构建产物

v3.1 重构：dev fallback 模式：
- 优先使用便携 Python（python-3.9-embed/）
- 否则 fallback 到 .venv/Scripts/python.exe（开发模式）
- 否则 fallback 到系统 PATH 的 python
"""
import sys
import os
import subprocess
import time as time_module
import webbrowser
import signal
import socket
import shutil
import atexit
from pathlib import Path


class Launcher:
    FLASK_PORT = 5000

    def __init__(self):
        if getattr(sys, 'frozen', False):
            self.base_dir = Path(sys.executable).parent
        else:
            self.base_dir = Path(__file__).parent

        self.portable_python_dir = self.base_dir / "python-3.9-embed"
        self.lib_dir = self.base_dir / "lib"
        self.frontend_react_dir = self.base_dir / "frontend-react"

        if os.name == 'nt':
            self.portable_python = self.portable_python_dir / "python.exe"
        else:
            self.portable_python = self.portable_python_dir / "bin" / "python3"

        # Python 解析：便携 embed > .venv > 系统 PATH
        self.python_exe, self.python_mode = self._resolve_python()

        self.server_process = None

        atexit.register(self.cleanup_on_exit)
        self._setup_signal_handlers()

    def _resolve_python(self):
        """返回 (Path, mode)；mode: portable/venv/system/missing"""
        candidates = []
        if os.name == 'nt':
            candidates.append(self.portable_python)
            candidates.append(self.base_dir / ".venv" / "Scripts" / "python.exe")
            candidates.append(self.base_dir / "venv" / "Scripts" / "python.exe")
        else:
            candidates.append(self.portable_python)
            candidates.append(self.base_dir / ".venv" / "bin" / "python3")
            candidates.append(self.base_dir / "venv" / "bin" / "python3")

        for cand in candidates:
            if cand and cand.exists():
                mode = 'portable' if cand == self.portable_python else 'venv'
                return cand, mode

        path_py = shutil.which('python') or shutil.which('python3')
        if path_py:
            return Path(path_py), 'system'

        return self.portable_python, 'missing'

    def _setup_signal_handlers(self):
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        if hasattr(signal, 'SIGBREAK'):
            signal.signal(signal.SIGBREAK, self._signal_handler)

    def _signal_handler(self, signum, frame):
        print(f"\n[信号] 收到退出信号 {signum}，正在清理...")
        self.stop_servers()
        sys.exit(0)

    def cleanup_on_exit(self):
        self.stop_servers()

    def is_port_in_use(self, port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('0.0.0.0', port))
                return False
            except OSError:
                return True

    def get_process_using_port(self, port):
        try:
            result = subprocess.run(
                ['netstat', '-ano'],
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            for line in result.stdout.split('\n'):
                if f':{port}' in line and 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        try:
                            return int(parts[-1])
                        except ValueError:
                            continue
            return None
        except Exception as e:
            print(f"[警告] 获取端口进程失败: {e}")
            return None

    def kill_process(self, pid):
        """Kill a process (and its children on Windows)"""
        if os.name == 'nt':
            try:
                subprocess.run(
                    ['taskkill', '/F', '/T', '/PID', str(pid)],
                    capture_output=True,
                    creationflags=subprocess.CREATE_NO_WINDOW
                )
                print(f"[OK] 已终止进程 PID={pid} 及其子进程")
                return True
            except Exception as e:
                print(f"[警告] 终止进程失败: {e}")
                return False
        else:
            try:
                subprocess.run(['pkill', '-TERM', '-P', str(pid)], capture_output=True)
                subprocess.run(['kill', '-TERM', str(pid)], capture_output=True)
                return True
            except Exception as e:
                print(f"[警告] 终止进程失败: {e}")
                return False

    def cleanup_port(self, port, service_name):
        if not self.is_port_in_use(port):
            return True

        print(f"[检查] 端口 {port} 被占用，正在查找进程...")
        pid = self.get_process_using_port(port)

        if pid:
            print(f"[清理] 发现占用进程 PID={pid} ({service_name})")
            if self.kill_process(pid):
                for _ in range(10):
                    if not self.is_port_in_use(port):
                        print(f"[OK] 端口 {port} 已释放")
                        return True
                    time_module.sleep(0.5)
                print(f"[警告] 端口 {port} 未能及时释放")
                return False
        else:
            print(f"[警告] 无法确定占用端口 {port} 的进程")
            return False

    def cleanup_before_start(self):
        print("[检查] 正在检查端口占用情况...")
        if self.is_port_in_use(self.FLASK_PORT):
            print(f"[警告] 端口 {self.FLASK_PORT} 已被占用")
            self.cleanup_port(self.FLASK_PORT, "Flask后端")
        else:
            print(f"[OK] 端口 {self.FLASK_PORT} 可用")
        return True

    def check_environment(self):
        mode_label = {
            'portable': '便携 Python (python-3.9-embed)',
            'venv': '开发 .venv',
            'system': '系统 PATH Python',
            'missing': '未找到',
        }.get(self.python_mode, self.python_mode)
        print(f"[检查] Python 解释器: {self.python_exe}")
        print(f"[检查] Python 模式: {mode_label}")
        print(f"[检查] 依赖目录: {self.lib_dir}{' (便携 lib)' if self.lib_dir.exists() else ' (缺失，使用 Python 自带 site-packages)'}")
        print(f"[检查] 应用目录: {self.base_dir}")

        if self.python_mode == 'missing':
            print("[错误] 未找到可用的 Python 解释器")
            print("[提示] 请准备 python-3.9-embed/、.venv/ 或安装 Python 到 PATH")
            return False

        if not (self.base_dir / "app.py").exists():
            print("[错误] app.py 不存在")
            return False

        if not (self.base_dir / "frontend-react" / "dist").exists():
            print("[错误] frontend-react/dist 不存在，请先执行 npm run build")
            return False

        print("[OK] 环境检查通过")
        return True

    def start_flask_server(self):
        """启动Flask后端服务器（生产模式，服务frontend-react/dist）"""
        try:
            env = os.environ.copy()
            env["PYTHONPATH"] = str(self.python_exe.parent) + os.pathsep + str(self.lib_dir) + os.pathsep + str(self.base_dir)
            env["PYTHONHOME"] = str(self.python_exe.parent) if self.python_mode == 'portable' else ""
            env["DEV_MODE"] = "1"  # 启动器场景下使用标准 Flask 服务器（自带 webview 嵌入式窗口已废弃）

            os.chdir(self.base_dir)

            print(f"[后端] 正在启动 Flask 服务器 (Python: {self.python_mode})...")
            print(f"[后端] 命令: {self.python_exe} app.py")

            # 不使用 PIPE，让输出直接到控制台窗口
            self.server_process = subprocess.Popen(
                [str(self.python_exe), "app.py"],
                env=env
            )

            # 等待服务器启动
            print("[后端] 等待服务器初始化...")
            time_module.sleep(5)

            if self.server_process.poll() is not None:
                print(f"[错误] Flask服务器启动失败，退出码: {self.server_process.returncode}")
                return False

            print("[OK] Flask服务器启动成功 (端口 5000)")
            return True

        except Exception as e:
            print(f"[错误] 启动Flask服务器失败: {e}")
            return False

    def open_browser(self):
        """打开浏览器访问前端"""
        try:
            print("[浏览器] 正在打开浏览器...")
            webbrowser.open(f"http://127.0.0.1:{self.FLASK_PORT}")
            print("[OK] 浏览器已打开")
        except Exception as e:
            print(f"[警告] 自动打开浏览器失败: {e}")
            print(f"[提示] 请手动访问: http://127.0.0.1:{self.FLASK_PORT}")

    def run(self):
        print("=" * 60)
        print("省心投 BI - 启动器 (v3.1)")
        print("=" * 60)
        print()

        if not self.check_environment():
            print("[提示] 5秒后自动退出...")
            time_module.sleep(5)
            return

        print()

        if not self.cleanup_before_start():
            print("[警告] 端口清理未完全成功，继续尝试启动...")

        print()

        if not self.start_flask_server():
            print("[提示] 5秒后自动退出...")
            time_module.sleep(5)
            return

        print()

        self.open_browser()

        print()
        print("=" * 60)
        print("应用已启动！")
        print(f"访问地址: http://127.0.0.1:{self.FLASK_PORT}")
        print("关闭此窗口即可停止服务器")
        print("=" * 60)
        print()

        try:
            while True:
                if self.server_process.poll() is not None:
                    print("\n[停止] Flask服务器已停止")
                    break
                time_module.sleep(1)
        except KeyboardInterrupt:
            print("\n[停止] 正在停止服务器...")
        finally:
            self.stop_servers()

    def stop_servers(self):
        if self.server_process and self.server_process.poll() is None:
            print("[停止] 正在停止Flask服务器...")
            pid = self.server_process.pid
            self.kill_process(pid)

        time_module.sleep(1)
        if self.is_port_in_use(self.FLASK_PORT):
            print(f"[警告] 端口 {self.FLASK_PORT} 仍被占用，尝试强制清理...")
            self.cleanup_port(self.FLASK_PORT, "Flask残留进程")


if __name__ == "__main__":
    launcher = Launcher()
    launcher.run()
