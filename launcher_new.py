"""
省心投 BI - 启动器（React前端版本）
使用便携Python环境启动Flask后端 + React开发服务器
"""
import sys
import os
import subprocess
import time as time_module
import webbrowser
from pathlib import Path

class LauncherNew:
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
        print("省心投 BI - 启动器 (React前端版)")
        print("=" * 60)
        print()

        # 1. 检查环境
        if not self.check_environment():
            print("[提示] 5秒后自动退出...")
            time_module.sleep(5)
            return

        print()

        # 2. 启动Flask后端服务器
        if not self.start_flask_server():
            print("[提示] 5秒后自动退出...")
            time_module.sleep(5)
            return

        print()

        # 3. 启动React开发服务器
        if not self.start_react_server():
            print("[提示] 5秒后自动退出...")
            time_module.sleep(5)
            return

        print()

        # 4. 打开浏览器
        self.open_browser()

        print()
        print("=" * 60)
        print("应用已启动！")
        print(f"前端地址: http://127.0.0.1:3000 (React)")
        print(f"后端地址: http://127.0.0.1:5000 (Flask API)")
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
        """停止所有服务器"""
        if self.react_process:
            print("[停止] 正在停止React服务器...")
            self.react_process.terminate()
            try:
                self.react_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.react_process.kill()
            print("[OK] React服务器已停止")

        if self.server_process:
            print("[停止] 正在停止Flask服务器...")
            self.server_process.terminate()
            try:
                self.server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.server_process.kill()
            print("[OK] Flask服务器已停止")

if __name__ == "__main__":
    launcher = LauncherNew()
    launcher.run()