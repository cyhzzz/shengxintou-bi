"""
省心投 BI - 启动器（React前端版本）
使用便携Python环境启动Flask后端 + React开发服务器

v2.0 增强：
- 启动前端口占用检测和进程清理
- 进程树完整销毁（Windows taskkill /T）
- 信号处理确保异常退出时清理
"""
import sys
import os
import subprocess
import time as time_module
import webbrowser
import signal
import socket
import atexit
from pathlib import Path

# Windows 特有导入
if os.name == 'nt':
    import ctypes

class LauncherNew:
    # 端口配置
    FLASK_PORT = 5000
    REACT_PORT = 3000

    def __init__(self):
        # 关键：使用sys.executable获取exe文件的实际路径
        # PyInstaller打包后，__file__指向临时目录，而sys.executable指向实际的exe文件
        if getattr(sys, 'frozen', False):
            # PyInstaller打包后的环境
            self.base_dir = Path(sys.executable).parent
        else:
            # 开发环境
            self.base_dir = Path(__file__).parent

        self.portable_python_dir = self.base_dir / "python-3.9-embed"
        self.lib_dir = self.base_dir / "lib"
        self.frontend_react_dir = self.base_dir / "frontend-react"

        # 便携Python可执行文件
        if os.name == 'nt':  # Windows
            self.portable_python = self.portable_python_dir / "python.exe"
        else:
            self.portable_python = self.portable_python_dir / "bin" / "python3"

        # React 开发服务器进程
        self.react_process = None
        # Flask 后端进程
        self.server_process = None

        # 注册退出清理
        atexit.register(self.cleanup_on_exit)
        self._setup_signal_handlers()

    def _setup_signal_handlers(self):
        """设置信号处理器，确保异常退出时清理"""
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        # Windows 不支持 SIGQUIT
        if hasattr(signal, 'SIGBREAK'):
            signal.signal(signal.SIGBREAK, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """信号处理"""
        print(f"\n[信号] 收到退出信号 {signum}，正在清理...")
        self.stop_servers()
        sys.exit(0)

    def cleanup_on_exit(self):
        """atexit 清理"""
        self.stop_servers()

    def is_port_in_use(self, port):
        """检查端口是否被占用（检测 0.0.0.0 绑定）"""
        # 方法1: 尝试绑定 0.0.0.0（检测所有接口的监听）
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('0.0.0.0', port))
            except OSError:
                return True

        # 方法2: 尝试连接（更可靠）
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.settimeout(0.5)
                result = s.connect_ex(('127.0.0.1', port))
                return result == 0
            except:
                pass

        return False

    def get_process_using_port(self, port):
        """获取占用端口的进程 PID"""
        try:
            # 使用 netstat 获取占用端口的进程
            result = subprocess.run(
                ['netstat', '-ano'],
                capture_output=True,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )

            for line in result.stdout.split('\n'):
                # 格式: TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
                if f':{port}' in line and 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        try:
                            return int(parts[-1])  # PID 是最后一个字段
                        except ValueError:
                            continue
            return None
        except Exception as e:
            print(f"[警告] 获取端口进程失败: {e}")
            return None

    def kill_process_tree(self, pid):
        """完整销毁进程树（包括所有子进程）"""
        if os.name == 'nt':
            # Windows: 使用 taskkill /F /T 强制杀死进程树
            try:
                subprocess.run(
                    ['taskkill', '/F', '/T', '/PID', str(pid)],
                    capture_output=True,
                    creationflags=subprocess.CREATE_NO_WINDOW
                )
                print(f"[清理] 已强制终止进程 PID={pid} 及其子进程")
                return True
            except Exception as e:
                print(f"[警告] 终止进程失败: {e}")
                return False
        else:
            # Linux/Mac: 使用 pkill -P 杀死子进程
            try:
                subprocess.run(['pkill', '-TERM', '-P', str(pid)], capture_output=True)
                subprocess.run(['kill', '-TERM', str(pid)], capture_output=True)
                return True
            except Exception as e:
                print(f"[警告] 终止进程失败: {e}")
                return False

    def cleanup_port(self, port, service_name):
        """清理占用端口的进程"""
        if not self.is_port_in_use(port):
            return True

        print(f"[检查] 端口 {port} 被占用，正在查找进程...")
        pid = self.get_process_using_port(port)

        if pid:
            print(f"[清理] 发现占用进程 PID={pid} ({service_name})")
            if self.kill_process_tree(pid):
                # 等待端口释放
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

        return True

    def cleanup_before_start(self):
        """启动前清理：检查并清理可能冲突的端口"""
        print("[检查] 正在检查端口占用情况...")

        results = []
        # 检查 Flask 端口
        if self.is_port_in_use(self.FLASK_PORT):
            print(f"[警告] 端口 {self.FLASK_PORT} 已被占用")
            results.append(self.cleanup_port(self.FLASK_PORT, "Flask后端"))
        else:
            print(f"[OK] 端口 {self.FLASK_PORT} 可用")

        # 检查 React 端口
        if self.is_port_in_use(self.REACT_PORT):
            print(f"[警告] 端口 {self.REACT_PORT} 已被占用")
            results.append(self.cleanup_port(self.REACT_PORT, "React前端"))
        else:
            print(f"[OK] 端口 {self.REACT_PORT} 可用")

        # 短暂等待确保端口完全释放
        if any(not r for r in results):
            print("[等待] 等待端口完全释放...")
            time_module.sleep(2)

        return all(results)

    def check_environment(self):
        """检查环境"""
        print(f"[检查] Python环境: {self.portable_python_dir}")
        print(f"[检查] 依赖目录: {self.lib_dir}")
        print(f"[检查] 应用目录: {self.base_dir}")
        print(f"[检查] React前端目录: {self.frontend_react_dir}")

        if not self.portable_python.exists():
            print("[错误] 便携Python不存在")
            return False

        if not (self.base_dir / "app.py").exists():
            print("[错误] app.py 不存在")
            return False

        if not self.frontend_react_dir.exists():
            print("[错误] frontend-react 目录不存在")
            return False

        if not (self.frontend_react_dir / "node_modules").exists():
            print("[错误] node_modules 不存在，请先运行 npm install")
            return False

        print("[OK] 环境检查通过")
        return True

    def start_flask_server(self):
        """启动Flask后端服务器"""
        try:
            # 配置环境变量
            env = os.environ.copy()
            # PYTHONPATH 顺序：portable_python_dir -> lib_dir -> base_dir
            env["PYTHONPATH"] = str(self.portable_python_dir) + os.pathsep + str(self.lib_dir) + os.pathsep + str(self.base_dir)
            env["PYTHONHOME"] = str(self.portable_python_dir)
            env["DEV_MODE"] = "1"  # 开发模式

            # 切换到base_dir
            os.chdir(self.base_dir)

            print(f"[后端] 正在启动Flask服务器...")

            # 启动Flask服务
            self.server_process = subprocess.Popen(
                [str(self.portable_python), "app.py"],
                env=env
            )

            # 等待服务器启动
            print("[后端] 等待服务器初始化...")
            time_module.sleep(3)

            # 检查进程状态
            if self.server_process.poll() is not None:
                print(f"[错误] Flask服务器启动失败，退出码: {self.server_process.returncode}")
                return False

            print("[OK] Flask服务器启动成功 (端口 5000)")
            return True

        except Exception as e:
            print(f"[错误] 启动Flask服务器失败: {e}")
            return False

    def start_react_server(self):
        """启动React开发服务器"""
        try:
            print(f"[前端] 正在启动React开发服务器...")

            # 切换到 frontend-react 目录
            os.chdir(self.frontend_react_dir)

            # 使用 npm run dev 启动 Vite 开发服务器
            # Windows 下使用 npm.cmd
            npm_cmd = "npm.cmd" if os.name == 'nt' else "npm"

            self.react_process = subprocess.Popen(
                [npm_cmd, "run", "dev"],
                shell=True
            )

            # 等待 React 服务器启动
            print("[前端] 等待React服务器初始化...")
            time_module.sleep(5)

            # 检查进程状态
            if self.react_process.poll() is not None:
                print(f"[错误] React服务器启动失败，退出码: {self.react_process.returncode}")
                return False

            print("[OK] React服务器启动成功 (端口 3000)")
            return True

        except Exception as e:
            print(f"[错误] 启动React服务器失败: {e}")
            return False

    def open_browser(self):
        """打开浏览器访问React前端"""
        try:
            print("[浏览器] 正在打开浏览器...")
            # React 开发服务器端口是 3000
            webbrowser.open("http://127.0.0.1:3000")
            print("[OK] 浏览器已打开")
        except Exception as e:
            print(f"[警告] 自动打开浏览器失败: {e}")
            print("[提示] 请手动访问: http://127.0.0.1:3000")

    def run(self):
        """运行启动器"""
        print("=" * 60)
        print("省心投 BI - 启动器 (React前端版) v2.0")
        print("=" * 60)
        print()

        # 1. 检查环境
        if not self.check_environment():
            print("[提示] 5秒后自动退出...")
            time_module.sleep(5)
            return

        print()

        # 2. 启动前清理（检查并清理端口占用）
        if not self.cleanup_before_start():
            print("[警告] 端口清理未完全成功，继续尝试启动...")

        print()

        # 3. 启动Flask后端服务器
        if not self.start_flask_server():
            print("[提示] 5秒后自动退出...")
            time_module.sleep(5)
            return

        print()

        # 4. 启动React开发服务器
        if not self.start_react_server():
            print("[提示] 5秒后自动退出...")
            time_module.sleep(5)
            return

        print()

        # 5. 打开浏览器
        self.open_browser()

        print()
        print("=" * 60)
        print("应用已启动！")
        print(f"前端地址: http://127.0.0.1:{self.REACT_PORT} (React)")
        print(f"后端地址: http://127.0.0.1:{self.FLASK_PORT} (Flask API)")
        print(f"关闭此窗口即可停止服务器")
        print("=" * 60)
        print()

        # 等待服务结束
        try:
            # 等待任一进程结束
            while True:
                if self.server_process.poll() is not None:
                    print("\n[停止] Flask服务器已停止")
                    break
                if self.react_process.poll() is not None:
                    print("\n[停止] React服务器已停止")
                    break
                time_module.sleep(1)
        except KeyboardInterrupt:
            print("\n[停止] 正在停止服务器...")
        finally:
            self.stop_servers()

    def stop_servers(self):
        """停止所有服务器（完整销毁进程树）"""
        # 先停止 React 服务器
        if self.react_process and self.react_process.poll() is None:
            print("[停止] 正在停止React服务器...")
            pid = self.react_process.pid
            try:
                # Windows: 使用 taskkill /T 杀死整个进程树
                if os.name == 'nt':
                    subprocess.run(
                        ['taskkill', '/F', '/T', '/PID', str(pid)],
                        capture_output=True,
                        creationflags=subprocess.CREATE_NO_WINDOW
                    )
                else:
                    self.react_process.terminate()
                    self.react_process.wait(timeout=5)
                print("[OK] React服务器已停止")
            except Exception as e:
                print(f"[警告] 停止React服务器失败: {e}")
                # 最后尝试
                try:
                    self.react_process.kill()
                except:
                    pass

        # 再停止 Flask 服务器
        if self.server_process and self.server_process.poll() is None:
            print("[停止] 正在停止Flask服务器...")
            pid = self.server_process.pid
            try:
                if os.name == 'nt':
                    subprocess.run(
                        ['taskkill', '/F', '/T', '/PID', str(pid)],
                        capture_output=True,
                        creationflags=subprocess.CREATE_NO_WINDOW
                    )
                else:
                    self.server_process.terminate()
                    self.server_process.wait(timeout=5)
                print("[OK] Flask服务器已停止")
            except Exception as e:
                print(f"[警告] 停止Flask服务器失败: {e}")
                try:
                    self.server_process.kill()
                except:
                    pass

        # 最终验证：确保端口已释放
        time_module.sleep(1)
        if self.is_port_in_use(self.FLASK_PORT):
            print(f"[警告] 端口 {self.FLASK_PORT} 仍被占用，尝试强制清理...")
            self.cleanup_port(self.FLASK_PORT, "Flask残留进程")
        if self.is_port_in_use(self.REACT_PORT):
            print(f"[警告] 端口 {self.REACT_PORT} 仍被占用，尝试强制清理...")
            self.cleanup_port(self.REACT_PORT, "React残留进程")

if __name__ == "__main__":
    launcher = LauncherNew()
    launcher.run()