"""
省心投 BI - 启动器（调试版 - 带控制台）
使用便携Python环境启动应用
"""
import sys
import os
import subprocess
import time
import webbrowser
from pathlib import Path

class Launcher:
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

        # 便携Python可执行文件
        if os.name == 'nt':  # Windows
            self.portable_python = self.portable_python_dir / "python.exe"
        else:
            self.portable_python = self.portable_python_dir / "bin" / "python3"

        self.server_process = None

    def check_environment(self):
        """检查环境"""
        print(f"[检查] Python环境: {self.portable_python_dir}")
        print(f"[检查] 依赖目录: {self.lib_dir}")
        print(f"[检查] 应用目录: {self.base_dir}")

        if not self.portable_python.exists():
            print("[错误] 便携Python不存在")
            return False

        if not (self.base_dir / "app.py").exists():
            print("[错误] app.py 不存在")
            return False

        print("[OK] 环境检查通过")
        return True

    def check_port(self):
        """检查端口5000是否被占用"""
        import socket
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', 5000))
                print("[OK] 端口5000可用")
                return True
        except OSError:
            print("[错误] 端口5000已被占用")
            print("[提示] 请关闭占用端口的程序后重试")
            return False

    def start_server(self):
        """启动Flask服务器"""
        try:
            # 配置环境变量
            env = os.environ.copy()
            env["PYTHONPATH"] = str(self.base_dir) + os.pathsep + str(self.lib_dir)
            env["PYTHONHOME"] = str(self.portable_python_dir)
            env["DEV_MODE"] = "1"  # 开发模式，使用浏览器

            # 切换到base_dir
            os.chdir(self.base_dir)

            print(f"[启动] 正在启动服务器...")
            print(f"[工作目录] {os.getcwd()}")

            # 启动Flask服务
            self.server_process = subprocess.Popen(
                [str(self.portable_python), "app.py"],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # 等待服务器启动
            print("[等待] 等待服务器初始化...")
            time.sleep(5)

            # 检查进程状态
            if self.server_process.poll() is not None:
                stdout, stderr = self.server_process.communicate()
                print(f"[错误] 服务器启动失败")
                if stderr:
                    print(f"[错误信息] {stderr}")
                if stdout:
                    print(f"[标准输出] {stdout}")
                return False

            print("[OK] 服务器启动成功")
            return True

        except Exception as e:
            print(f"[错误] 启动服务器失败: {e}")
            import traceback
            traceback.print_exc()
            return False

    def open_browser(self):
        """打开浏览器"""
        try:
            print("[浏览器] 正在打开浏览器...")
            webbrowser.open("http://127.0.0.1:5000")
            print("[OK] 浏览器已打开")
        except Exception as e:
            print(f"[警告] 自动打开浏览器失败: {e}")
            print("[提示] 请手动访问: http://127.0.0.1:5000")

    def run(self):
        """运行启动器"""
        print("=" * 60)
        print("省心投 BI - 启动器 (调试版)")
        print("=" * 60)
        print()

        # 1. 检查环境
        if not self.check_environment():
            print("\n按回车退出...")
            input()
            return

        print()

        # 2. 检查端口
        if not self.check_port():
            print("\n按回车退出...")
            input()
            return

        print()

        # 3. 启动服务器
        if not self.start_server():
            print("\n按回车退出...")
            input()
            return

        print()

        # 4. 打开浏览器
        self.open_browser()

        print()
        print("=" * 60)
        print("应用已启动！")
        print(f"访问地址: http://127.0.0.1:5000")
        print(f"按 Ctrl+C 停止服务器")
        print("=" * 60)
        print()

        # 等待服务结束
        try:
            self.server_process.wait()
        except KeyboardInterrupt:
            print("\n[停止] 正在停止服务器...")
            self.server_process.terminate()
            self.server_process.wait()
            print("[OK] 服务器已停止")

if __name__ == "__main__":
    launcher = Launcher()
    launcher.run()
